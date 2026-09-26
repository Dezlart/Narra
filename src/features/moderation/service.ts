import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma, UserRole } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAuth, requireModerator } from "@/lib/auth/guards";
import { assertActiveUser, assertRole } from "@/features/auth/permissions";
import { lockOwnedArticle } from "@/features/articles/service";
import { ArticleError } from "@/features/articles/errors";
import { validateImageReferences } from "@/features/articles/image-references";
import { publicationSchema, rejectSchema, reviewSchema, submitSchema } from "./schemas";

const options = { maxWait: 10000, timeout: 25000 };
const snapshotInclude = { tags: { include: { tag: true } } } satisfies Prisma.ArticleRevisionInclude;
type Snapshot = Prisma.ArticleRevisionGetPayload<{ include: typeof snapshotInclude }>;
async function validateSnapshot(tx: Prisma.TransactionClient, revision: Snapshot) {
  const fields = publicationSchema.parse({ title: revision.title, excerpt: revision.excerpt, content: revision.content,
    categoryId: revision.categoryId, coverImage: revision.coverImage, tags: revision.tags.map(({ tag }) => tag.name) });
  if (!await tx.category.findUnique({ where: { id: fields.categoryId } })) throw new ArticleError("LOCKED", "Выберите существующую категорию.");
  await validateImageReferences(tx, revision.articleId, fields);
}

export async function submitArticleForModeration(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const { articleId, revisionId, editVersion } = submitSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    const article = await lockOwnedArticle(tx, articleId, actor.id);
    const revision = await tx.articleRevision.findFirst({ where: { id: revisionId, articleId, status: "DRAFT" }, include: snapshotInclude });
    if (!revision || article.publishedRevisionId === revisionId) throw new ArticleError("LOCKED", "Отправить можно только текущий черновик.");
    if (revision.editVersion !== editVersion) throw new ArticleError("CONFLICT", "Черновик изменён. Сохраните копию текста и загрузите актуальную версию перед отправкой.");
    if (await tx.articleRevision.count({ where: { articleId, id: { not: revisionId }, status: { in: ["DRAFT", "PENDING"] } } })) throw new ArticleError("LOCKED", "У статьи уже есть активная версия.");
    await validateSnapshot(tx, revision);
    const now = new Date();
    const changed = await tx.articleRevision.updateMany({ where: { id: revisionId, articleId, status: "DRAFT", editVersion },
      data: { status: "PENDING", submittedAt: now, reviewedAt: null, reviewedById: null, rejectionReason: null, editVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new ArticleError("CONFLICT", "Версия уже изменилась. Обновите страницу.");
    await tx.article.update({ where: { id: articleId }, data: { updatedAt: now } });
    return { articleId, revisionId };
  }, options);
}

async function reviewRevision(revisionId: string, decision: "APPROVED" | "REJECTED", reason: string | null, requestHeaders?: Headers) {
  const actor = await requireModerator(requestHeaders);
  const target = await getPrisma().articleRevision.findUnique({ where: { id: revisionId }, select: { articleId: true } });
  if (!target) throw new ArticleError("NOT_FOUND", "Версия не найдена.");
  return getPrisma().$transaction(async (tx) => {
    // Same User -> Article lock order as author writes. Recheck role under lock:
    // revoking a role or banning a reviewer cannot race the decision.
    const reviewers = await tx.$queryRaw<{ isBanned: boolean; role: UserRole }[]>`SELECT "isBanned", role FROM "User" WHERE id = ${actor.id} FOR SHARE`;
    const reviewer = reviewers[0] ?? null;
    assertActiveUser(reviewer); assertRole(reviewer, ["MODERATOR", "ADMIN"]);
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${target.articleId} FOR UPDATE`;
    const article = await tx.article.findUnique({ where: { id: target.articleId } });
    const revision = await tx.articleRevision.findFirst({ where: { id: revisionId, articleId: target.articleId }, include: snapshotInclude });
    if (!article || !revision) throw new ArticleError("NOT_FOUND", "Версия не найдена.");
    if (article.status === "ARCHIVED" || article.publishedRevisionId === revisionId) throw new ArticleError("LOCKED", "Эту версию нельзя рассмотреть.");
    if (revision.status !== "PENDING") throw new ArticleError("CONFLICT", "Решение уже принято или версия не находится на модерации. Обновите страницу.");
    if (decision === "APPROVED") await validateSnapshot(tx, revision);
    const now = new Date();
    const changed = await tx.articleRevision.updateMany({ where: { id: revisionId, articleId: article.id, status: "PENDING" },
      data: { status: decision, reviewedAt: now, reviewedById: actor.id, rejectionReason: reason } });
    if (changed.count !== 1) throw new ArticleError("CONFLICT", "Другой модератор уже принял решение.");
    await tx.article.update({ where: { id: article.id }, data: decision === "APPROVED"
      ? { status: "PUBLISHED", publishedRevisionId: revision.id, publishedAt: article.publishedAt ?? now, slug: article.slug || `story-${randomUUID()}`, updatedAt: now }
      : { updatedAt: now } });
    return { articleId: article.id, revisionId, decision };
  }, options);
}
export async function approveArticleRevision(input: unknown, requestHeaders?: Headers) {
  const { revisionId } = reviewSchema.parse(input);
  return reviewRevision(revisionId, "APPROVED", null, requestHeaders);
}
export async function rejectArticleRevision(input: unknown, requestHeaders?: Headers) {
  const { revisionId, reason } = rejectSchema.parse(input);
  return reviewRevision(revisionId, "REJECTED", reason, requestHeaders);
}
