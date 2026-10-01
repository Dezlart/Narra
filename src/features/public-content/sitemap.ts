import "server-only";
import { getPrisma } from "@/lib/prisma";
import { publicArticleWhere } from "./queries";

// Bounded first release: 30,202 URLs maximum; split sitemaps before exceeding this.
export async function getPublicSitemapPaths() {
  const db = getPrisma();
  const [articles, categories, tags, authors] = await Promise.all([
    db.article.findMany({ where: publicArticleWhere, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 10000,
      select: { slug: true, publishedRevision: { select: { reviewedAt: true } } } }),
    db.category.findMany({ where: { archivedAt: null }, select: { slug: true }, orderBy: { slug: "asc" }, take: 200 }),
    db.tag.findMany({ where: { revisions: { some: { revision: { publishedBy: { some: publicArticleWhere } } } } },
      select: { slug: true }, orderBy: { slug: "asc" }, take: 10000 }),
    db.user.findMany({ where: { username: { not: null }, articles: { some: publicArticleWhere } },
      select: { username: true }, orderBy: { username: "asc" }, take: 10000 }),
  ]);
  return [
    { path: "/" }, { path: "/categories" },
    ...articles.map((row) => ({ path: `/articles/${row.slug}`, lastModified: row.publishedRevision?.reviewedAt ?? undefined })),
    ...categories.map((row) => ({ path: `/categories/${row.slug}` })),
    ...tags.map((row) => ({ path: `/tags/${row.slug}` })),
    ...authors.map((row) => ({ path: `/profile/${row.username}` })),
  ];
}
