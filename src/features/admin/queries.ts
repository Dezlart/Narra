import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { idSchema } from "@/features/articles/schemas";
import { publicPage, literalContains } from "@/features/public-content/params";
import { roleSchema } from "./schemas";
export type QueryParams = Record<string, string | string[] | undefined>;
export const single = (value: unknown) => typeof value === "string" ? value : "";
export function queryText(value: unknown) { return z.string().trim().max(120, "Поиск — до 120 символов.").parse(single(value)); }
export function pageResult<T>(rows: T[], page: number) { return { items: rows.slice(0, 20), page, hasNext: rows.length > 20 && page < 1000 }; }
export async function listUsers(params: QueryParams = {}, headers?: Headers) {
  await requireAdmin(headers);
  const page = publicPage(params.page), q = queryText(params.q), role = roleSchema.safeParse(params.role);
  const match = { contains: literalContains(q), mode: "insensitive" as const };
  const where: Prisma.UserWhereInput = { ...(q ? { OR: [{ name: match }, { username: match }, { email: match }] } : {}),
    ...(role.success ? { role: role.data } : {}), ...(params.state === "banned" ? { isBanned: true } : params.state === "active" ? { isBanned: false } : {}) };
  const rows = await getPrisma().user.findMany({ where, select: { id: true, name: true, username: true, email: true, role: true, isBanned: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, skip: (page - 1) * 20 });
  return pageResult(rows, page);
}
const articleSelect = { id: true, slug: true, status: true, publishedAt: true, updatedAt: true, publishedRevisionId: true,
  author: { select: { name: true, username: true } }, publishedRevision: { select: { id: true, title: true, status: true, version: true } },
  revisions: { orderBy: { version: "desc" }, take: 1, select: { id: true, title: true, status: true, version: true } } } satisfies Prisma.ArticleSelect;
export async function listAdminArticles(params: QueryParams = {}, headers?: Headers) {
  await requireAdmin(headers);
  const page = publicPage(params.page), q = queryText(params.q), author = queryText(params.author);
  const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).safeParse(params.status);
  const match = { contains: literalContains(q), mode: "insensitive" as const };
  const where: Prisma.ArticleWhereInput = { ...(status.success ? { status: status.data } : {}), ...(author ? { author: { username: author } } : {}),
    ...(q ? { OR: [{ revisions: { some: { title: match } } }, { author: { username: match } }] } : {}) };
  return pageResult(await getPrisma().article.findMany({ where, select: articleSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 21, skip: (page - 1) * 20 }), page);
}
export async function getAdminArticle(input: unknown, pageInput: unknown, headers?: Headers) {
  await requireAdmin(headers);
  const id = idSchema.parse(input), page = publicPage(pageInput), db = getPrisma();
  const article = await db.article.findUnique({ where: { id }, select: articleSelect });
  if (!article) return null;
  const rows = await db.articleRevision.findMany({ where: { articleId: id }, orderBy: { version: "desc" }, take: 21, skip: (page - 1) * 20,
    select: { id: true, title: true, status: true, version: true, createdAt: true, reviewedAt: true, rejectionReason: true } });
  return { article, ...pageResult(rows, page) };
}
export async function listAdminCategories(params: QueryParams = {}, headers?: Headers) {
  await requireAdmin(headers);
  const page = publicPage(params.page), q = queryText(params.q);
  return pageResult(await getPrisma().category.findMany({ where: { ...(q ? { name: { contains: literalContains(q), mode: "insensitive" } } : {}),
    ...(params.state === "archived" ? { archivedAt: { not: null } } : params.state === "active" ? { archivedAt: null } : {}) },
    orderBy: [{ name: "asc" }, { id: "asc" }], take: 21, skip: (page - 1) * 20 }), page);
}
