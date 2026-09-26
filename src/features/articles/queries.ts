import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { idSchema } from "./schemas";
import { ArticleError } from "./errors";
const historyFields = { id: true, title: true, version: true, status: true, editVersion: true, submittedAt: true, reviewedAt: true, rejectionReason: true, createdAt: true } as const;
export async function listOwnArticles(page: number, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const rows = await getPrisma().article.findMany({ where: { authorId: actor.id }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * 20, take: 21, select: { id: true, status: true, updatedAt: true, publishedRevisionId: true,
      revisions: { take: 1, orderBy: { version: "desc" }, select: historyFields } } });
  return { articles: rows.slice(0, 20), hasNext: rows.length > 20, page: safePage };
}
export async function listCategories() { return getPrisma().category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }); }

export async function getArticleRevisionHistory(input: unknown, page = 1, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const id = idSchema.parse(input);
  const currentPage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const article = await getPrisma().article.findFirst({ where: { id, authorId: actor.id }, select: { id: true, status: true, publishedRevisionId: true, publishedAt: true,
    revisions: { orderBy: { version: "desc" }, take: 1, select: historyFields } } });
  if (!article) throw new ArticleError("NOT_FOUND", "Статья не найдена.");
  const rows = await getPrisma().articleRevision.findMany({ where: { articleId: id, article: { authorId: actor.id } }, orderBy: { version: "desc" }, skip: (currentPage - 1) * 20, take: 21, select: historyFields });
  return { article, revisions: rows.slice(0, 20), page: currentPage, hasNext: rows.length > 20 };
}
