import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { assertRole } from "@/features/auth/permissions";
import { lockSocialUsers, socialTransactionOptions } from "@/features/social/transaction";
import { SocialError } from "@/features/social/errors";
import { userChangeSchema, articleStateSchema, createCategorySchema, updateCategorySchema, categoryStateSchema } from "./schemas";

export async function lockAdministrator(tx: Prisma.TransactionClient, actorId: string, targetId?: string) {
  await lockSocialUsers(tx, actorId, targetId);
  const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { role: true, isBanned: true } });
  assertRole(actor, ["ADMIN"]);
}
export async function changeUser(input: unknown, headers?: Headers) {
  const actor = await requireAdmin(headers);
  const data = userChangeSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    // One transaction-scoped lock for all role/ban transitions, acquired before
    // any User locks. Counts are read AFTER waiting (READ COMMITTED).
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(78421, 8)::text`;
    // Target may already be banned (unban), so validate it separately.
    const ids = [...new Set([actor.id, data.userId])].sort();
    for (const id of ids) await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR NO KEY UPDATE`;
    await lockAdministrator(tx, actor.id);
    const target = await tx.user.findUnique({ where: { id: data.userId } });
    if (!target) throw new SocialError("NOT_FOUND", "Пользователь не найден.");
    if (data.operation === "ban" && data.banned && target.id === actor.id) throw new SocialError("FORBIDDEN", "Нельзя заблокировать себя.");
    const removesAdmin = target.role === "ADMIN" && !target.isBanned && (data.operation === "role" ? data.role !== "ADMIN" : data.banned);
    if (removesAdmin && await tx.user.count({ where: { role: "ADMIN", isBanned: false } }) <= 1) {
      throw new SocialError("CONFLICT", "Нельзя заблокировать или понизить последнего активного администратора.");
    }
    await tx.user.update({ where: { id: target.id }, data: data.operation === "ban" ? { isBanned: data.banned } : { role: data.role } });
    if (data.operation === "ban" && data.banned) await tx.session.deleteMany({ where: { userId: target.id } });
  }, socialTransactionOptions);
}
export async function setArticleArchivedInTransaction(tx: Prisma.TransactionClient, articleId: string, archived: boolean) {
  await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${articleId} FOR UPDATE`;
  const article = await tx.article.findUnique({ where: { id: articleId }, include: { publishedRevision: { select: { status: true } } } });
  if (!article || !article.publishedAt || !article.slug || article.publishedRevision?.status !== "APPROVED") {
    throw new SocialError("CONFLICT", "Нужна сохранённая одобренная опубликованная версия.");
  }
  if (article.status !== "PUBLISHED" && article.status !== "ARCHIVED") throw new SocialError("CONFLICT", "Статья ещё не опубликована.");
  await tx.article.update({ where: { id: articleId }, data: { status: archived ? "ARCHIVED" : "PUBLISHED" } });
}
export async function setArticleArchived(input: unknown, headers?: Headers) {
  const actor = await requireAdmin(headers), data = articleStateSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockAdministrator(tx, actor.id);
    await setArticleArchivedInTransaction(tx, data.articleId, data.archived);
  }, socialTransactionOptions);
}
export async function createCategory(input: unknown, headers?: Headers) {
  const actor = await requireAdmin(headers), data = createCategorySchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockAdministrator(tx, actor.id);
    return tx.category.create({ data, select: { id: true } });
  }, socialTransactionOptions);
}
export async function updateCategory(input: unknown, headers?: Headers) {
  const actor = await requireAdmin(headers), { categoryId, ...data } = updateCategorySchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockAdministrator(tx, actor.id);
    await tx.category.update({ where: { id: categoryId }, data });
  }, socialTransactionOptions);
}
export async function setCategoryArchived(input: unknown, headers?: Headers) {
  const actor = await requireAdmin(headers), data = categoryStateSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockAdministrator(tx, actor.id);
    await tx.category.update({ where: { id: data.categoryId }, data: { archivedAt: data.archived ? new Date() : null } });
  }, socialTransactionOptions);
}
