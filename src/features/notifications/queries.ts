import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { visibleCommentWhere } from "@/features/comments/visibility";
import { MAX_PAGE, publicPage } from "@/features/public-content/params";
import { NOTIFICATION_PAGE_SIZE, NOTIFICATION_PREVIEW_SIZE } from "./schemas";

const select = { id: true, type: true, articleId: true, revisionId: true, commentId: true,
  createdAt: true, readAt: true, actor: { select: { name: true, username: true, isBanned: true } } } satisfies Prisma.NotificationSelect;
type Row = Prisma.NotificationGetPayload<{ select: typeof select }>;
type Reader = Pick<Prisma.TransactionClient, "article" | "articleRevision" | "comment" | "notification">;

// Bounded batch queries apply authorization before selecting contextual data.
// No draft content, comment bodies, email, or tokens are ever fetched here.
async function present(db: Reader, rows: Row[], recipientId: string) {
  const articleIds = rows.flatMap((row) => row.articleId ? [row.articleId] : []);
  const revisionIds = rows.filter((row) => row.type === "ARTICLE_APPROVED" || row.type === "ARTICLE_REJECTED")
    .flatMap((row) => row.revisionId ? [row.revisionId] : []);
  const commentIds = rows.flatMap((row) => row.commentId ? [row.commentId] : []);
  const [articles, revisions, comments] = await Promise.all([
    db.article.findMany({ where: { AND: [publicArticleWhere, { id: { in: articleIds } }] },
      select: { id: true, slug: true, publishedRevision: { select: { title: true } } } }),
    db.articleRevision.findMany({ where: { id: { in: revisionIds }, article: { authorId: recipientId }, status: { in: ["APPROVED", "REJECTED"] } },
      select: { id: true, articleId: true, title: true } }),
    db.comment.findMany({ where: { AND: [visibleCommentWhere, { id: { in: commentIds }, article: publicArticleWhere }] }, select: { id: true } }),
  ]);
  const publicById = new Map(articles.map((row) => [row.id, row]));
  const ownById = new Map(revisions.map((row) => [row.id, row]));
  const visibleComments = new Set(comments.map((row) => row.id));
  return rows.map((row) => {
    const article = row.articleId ? publicById.get(row.articleId) : undefined;
    const ownRevision = row.revisionId ? ownById.get(row.revisionId) : undefined;
    const actor = row.actor && !row.actor.isBanned ? row.actor : null;
    const name = actor?.name || "Пользователь";
    const publicHref = article?.slug ? `/articles/${encodeURIComponent(article.slug)}` : null;
    let text: string;
    let href: string | null = null;
    switch (row.type) {
      case "ARTICLE_APPROVED":
      case "ARTICLE_REJECTED": {
        const valid = ownRevision?.articleId === row.articleId ? ownRevision : null;
        text = valid ? `Ваша статья «${valid.title}» ${row.type === "ARTICLE_APPROVED" ? "одобрена" : "отклонена"}` : "Решение по недоступной статье";
        // Owner history includes the exact revision and rejection reason.
        href = valid ? `/dashboard/articles/${valid.articleId}?revision=${valid.id}#revision-${valid.id}` : null;
        break;
      }
      case "NEW_FOLLOWER":
        text = actor ? `${name} подписался на вас` : "Новый подписчик больше недоступен";
        href = actor?.username ? `/profile/${encodeURIComponent(actor.username)}` : null;
        break;
      case "FOLLOWED_AUTHOR_PUBLISHED":
        text = article ? `${name} опубликовал статью «${article.publishedRevision!.title}»` : "Публикация больше недоступна";
        href = publicHref;
        break;
      case "ARTICLE_COMMENT":
      case "COMMENT_REPLY": {
        const available = row.commentId && visibleComments.has(row.commentId);
        text = available && article ? `${name} ${row.type === "COMMENT_REPLY" ? "ответил на ваш комментарий" : "прокомментировал статью"} «${article.publishedRevision!.title}»` : "Комментарий больше недоступен";
        href = available && publicHref ? `${publicHref}#comments` : null;
        break;
      }
    }
    return { id: row.id, type: row.type, text, href, createdAt: row.createdAt.toISOString(), unread: row.readAt === null };
  });
}
export type NotificationView = Awaited<ReturnType<typeof present>>[number];

async function readPage(pageInput: unknown, preview: boolean, requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  const page = publicPage(pageInput), size = preview ? NOTIFICATION_PREVIEW_SIZE : NOTIFICATION_PAGE_SIZE;
  const db = getPrisma();
  const rows = await db.notification.findMany({ where: { recipientId: user.id }, select,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: size + 1, skip: (page - 1) * size });
  return { items: await present(db, rows.slice(0, size), user.id), page, hasNext: rows.length > size && page < MAX_PAGE };
}
export const getOwnNotifications = (page: unknown = 1, headers?: Headers) => readPage(page, false, headers);
export async function getUnreadNotificationCount(requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  return getPrisma().notification.count({ where: { recipientId: user.id, readAt: null } });
}
// Request-local only, never a shared persistent per-user cache.
export const getNotificationPreview = cache(async () => {
  const [feed, unreadCount] = await Promise.all([readPage(1, true), getUnreadNotificationCount()]);
  return { items: feed.items, unreadCount };
});
export async function getOwnedNotificationView(db: Reader, recipientId: string, id: string) {
  const row = await db.notification.findFirst({ where: { id, recipientId }, select });
  return row ? (await present(db, [row], recipientId))[0] : null;
}
