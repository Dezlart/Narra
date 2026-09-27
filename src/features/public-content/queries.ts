import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { MAX_PAGE, PAGE_SIZE, publicPage, literalContains, searchInput } from "./params";

// Every public surface, including storage authorization and sitemap, shares this.
// Banned authors are hidden consistently with the existing public-profile policy.
export const publicArticleWhere = {
  status: "PUBLISHED", publishedRevisionId: { not: null },
  publishedAt: { not: null }, slug: { not: null },
  publishedRevision: { is: { status: "APPROVED" } }, author: { isBanned: false },
} satisfies Prisma.ArticleWhereInput;
const revisionCardSelect = {
  title: true, excerpt: true, coverImage: true, readingMinutes: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ArticleRevisionSelect;
const cardSelect = {
  id: true, slug: true, publishedAt: true,
  author: { select: { name: true, username: true } },
  publishedRevision: { select: revisionCardSelect },
} satisfies Prisma.ArticleSelect;
type CardRow = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;
function toCard(row: CardRow) {
  if (!row.slug || !row.publishedAt || !row.publishedRevision) throw new Error("Invalid public snapshot");
  return { id: row.id, slug: row.slug, publishedAt: row.publishedAt, author: row.author, ...row.publishedRevision };
}
export type PublicArticleCard = ReturnType<typeof toCard>;
export type PublicFeed = { items: PublicArticleCard[]; page: number; hasNext: boolean };
type Filters = { categorySlug?: string; tagSlug?: string; username?: string; query?: string; excludeId?: string };
function filterWhere(filters: Filters): Prisma.ArticleWhereInput {
  const extra: Prisma.ArticleWhereInput[] = [];
  if (filters.categorySlug) extra.push({ publishedRevision: { is: { category: { slug: filters.categorySlug } } } });
  if (filters.tagSlug) extra.push({ publishedRevision: { is: { tags: { some: { tag: { slug: filters.tagSlug } } } } } });
  if (filters.username) extra.push({ author: { username: filters.username } });
  if (filters.excludeId) extra.push({ id: { not: filters.excludeId } });
  if (filters.query) {
    const match = { contains: literalContains(filters.query), mode: "insensitive" as const };
    extra.push({ OR: [
      { publishedRevision: { is: { OR: [{ title: match }, { excerpt: match }] } } },
      { author: { OR: [{ name: match }, { username: match }] } },
    ] });
  }
  return { AND: [publicArticleWhere, ...extra] };
}
export async function getPublishedArticles(pageInput: unknown = 1, filters: Filters = {}): Promise<PublicFeed> {
  const page = publicPage(pageInput);
  const rows = await getPrisma().article.findMany({ where: filterWhere(filters), select: cardSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 });
  return { items: rows.slice(0, PAGE_SIZE).map(toCard), page, hasNext: rows.length > PAGE_SIZE && page < MAX_PAGE };
}
export const getPublishedArticlesByCategory = (slug: string, page: unknown) => getPublishedArticles(page, { categorySlug: slug });
export const getPublishedArticlesByTag = (slug: string, page: unknown) => getPublishedArticles(page, { tagSlug: slug });
export const getPublishedArticlesByAuthor = (username: string, page: unknown) => getPublishedArticles(page, { username });
export async function searchPublishedArticles(input: unknown, page: unknown) {
  const { query, error } = searchInput(input);
  const feed = query && !error ? await getPublishedArticles(page, { query }) : { items: [], page: 1, hasNext: false };
  return { ...feed, query, error };
}
// Request-local deduplication keeps metadata and body on the same snapshot.
export const getPublishedArticleBySlug = cache(async (slug: string) => {
  if (!slug || slug.length > 200) return null;
  const row = await getPrisma().article.findFirst({ where: { AND: [publicArticleWhere, { slug }] },
    select: { ...cardSelect, publishedRevision: { select: { ...revisionCardSelect, content: true,
      tags: { select: { tag: { select: { name: true, slug: true } } }, orderBy: { tag: { name: "asc" } } } } } } });
  return row?.publishedRevision ? { ...toCard(row), content: row.publishedRevision.content,
    tags: row.publishedRevision.tags.map(({ tag }) => tag) } : null;
});
export async function getRelatedPublishedArticles(id: string, categorySlug: string) {
  const rows = await getPrisma().article.findMany({ where: filterWhere({ excludeId: id, categorySlug }),
    select: cardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 3 });
  return rows.map(toCard);
}
export const getPublicCategories = cache(() => getPrisma().category.findMany({
  select: { name: true, slug: true, description: true }, orderBy: { name: "asc" }, take: 200,
}));
export const getPublicCategory = cache((slug: string) => slug.length > 200 ? Promise.resolve(null) : getPrisma().category.findUnique({
  where: { slug }, select: { name: true, slug: true, description: true },
}));
// Tags are user-generated: a draft-only tag name must not be publicly enumerable.
export const getPublicTag = cache((slug: string) => slug.length > 300 ? Promise.resolve(null) : getPrisma().tag.findFirst({
  where: { slug, revisions: { some: { revision: { publishedBy: { some: publicArticleWhere } } } } },
  select: { name: true, slug: true },
}));
