import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth/guards";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { visibleCommentWhere } from "@/features/comments/visibility";
import { publicPage } from "@/features/public-content/params";
import { pageResult } from "@/features/admin/queries";
import { utcBucket } from "./identity";
export type TrendRow = { day: string; registrations: number; publications: number; views: number };
async function trends(authorId?: string): Promise<TrendRow[]> {
  const start = utcBucket(new Date()); start.setUTCDate(start.getUTCDate() - 13);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 14);
  // UTC timestamps in Prisma's TIMESTAMP columns. Bounded SQL aggregation, never
  // loading raw visitors, users or articles into the web process.
  return getPrisma().$queryRaw<TrendRow[]>(Prisma.sql`
    WITH days AS (SELECT generate_series(${start}::timestamp, ${end}::timestamp - interval '1 day', interval '1 day') AS day),
    registrations AS (SELECT date_trunc('day', "createdAt") AS day, count(*)::int AS n FROM "User"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} ${authorId ? Prisma.sql`AND false` : Prisma.empty} GROUP BY 1),
    publications AS (SELECT date_trunc('day', "publishedAt") AS day, count(*)::int AS n FROM "Article"
      WHERE "publishedAt" >= ${start} AND "publishedAt" < ${end} ${authorId ? Prisma.sql`AND "authorId" = ${authorId}` : Prisma.empty} GROUP BY 1),
    views AS (SELECT date_trunc('day', v."createdAt") AS day, count(*)::int AS n FROM "ArticleView" v JOIN "Article" a ON a.id = v."articleId"
      WHERE v."createdAt" >= ${start} AND v."createdAt" < ${end} ${authorId ? Prisma.sql`AND a."authorId" = ${authorId} AND a.status = 'PUBLISHED'` : Prisma.empty} GROUP BY 1)
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day, coalesce(r.n, 0)::int AS registrations,
      coalesce(p.n, 0)::int AS publications, coalesce(v.n, 0)::int AS views
    FROM days d LEFT JOIN registrations r USING(day) LEFT JOIN publications p USING(day) LEFT JOIN views v USING(day) ORDER BY d.day`);
}
export async function getPlatformAnalytics(headers?: Headers) {
  await requireAdmin(headers);
  const db = getPrisma();
  const [users, articles, pending, comments, views, reports, daily] = await Promise.all([
    db.user.count(), db.article.count({ where: publicArticleWhere }),
    db.articleRevision.count({ where: { status: "PENDING", article: { status: { not: "ARCHIVED" } } } }),
    db.comment.count({ where: { ...visibleCommentWhere, article: publicArticleWhere } }), db.articleView.count(), db.report.count({ where: { status: "OPEN" } }), trends(),
  ]);
  return { metrics: { users, articles, pending, comments, views, reports }, daily };
}
export async function getAuthorAnalytics(pageInput: unknown = 1, headers?: Headers) {
  const actor = await requireAuth(headers), db = getPrisma(), page = publicPage(pageInput);
  const ownPublic: Prisma.ArticleWhereInput = { AND: [publicArticleWhere, { authorId: actor.id }] };
  const [views, likes, comments, followers, rows, daily] = await Promise.all([
    db.articleView.count({ where: { article: ownPublic } }),
    db.like.count({ where: { article: { authorId: actor.id }, user: { isBanned: false } } }),
    db.comment.count({ where: { ...visibleCommentWhere, article: ownPublic } }),
    db.follow.count({ where: { followingId: actor.id, follower: { isBanned: false } } }),
    db.article.findMany({ where: ownPublic, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: 21, skip: (page - 1) * 20,
      select: { id: true, slug: true, publishedAt: true, publishedRevision: { select: { title: true } }, _count: { select: { views: true,
        likes: { where: { user: { isBanned: false } } }, comments: { where: visibleCommentWhere } } } } }), trends(actor.id),
  ]);
  return { metrics: { views, likes, comments, followers }, ...pageResult(rows, page), daily };
}
