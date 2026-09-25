import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
export async function listOwnArticles(page: number, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const safePage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const rows = await getPrisma().article.findMany({ where: { authorId: actor.id }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * 20, take: 21, select: { id: true, status: true, updatedAt: true, publishedRevisionId: true,
      revisions: { take: 1, orderBy: { version: "desc" }, select: { id: true, title: true, status: true, editVersion: true } } } });
  return { articles: rows.slice(0, 20), hasNext: rows.length > 20, page: safePage };
}
export async function listCategories() { return getPrisma().category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }); }
