import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createNotification } from "@/features/notifications/events";
import { getPrisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/auth/guards";
import { SocialError } from "@/features/social/errors";
import { withPublicArticle, lockSocialUsers, socialTransactionOptions } from "@/features/social/transaction";
import { createCommentSchema, commentIdSchema, REPLY_PAGE_SIZE } from "./schemas";

export async function createComment(input: unknown, requestHeaders?: Headers) {
  const data = createCommentSchema.parse(input);
  return withPublicArticle(data.articleId, requestHeaders, async (tx, authorId, article) => {
    const existing = await tx.comment.findUnique({ where: { authorId_requestId: { authorId, requestId: data.requestId } } });
    if (existing) {
      if (existing.articleId !== data.articleId || existing.parentId !== data.parentId || (!existing.deletedAt && existing.content !== data.content)) {
        throw new SocialError("CONFLICT", "Эта отправка уже использована. Обновите страницу.");
      }
      const position = existing.parentId ? await tx.comment.count({ where: { articleId: data.articleId, parentId: existing.parentId,
        OR: [{ createdAt: { lt: existing.createdAt } }, { createdAt: existing.createdAt, id: { lte: existing.id } }] } }) : 0;
      return { id: existing.id, replyPage: Math.max(1, Math.ceil(position / REPLY_PAGE_SIZE)) };
    }
    let recipientId = article.authorId;
    if (data.parentId) {
      await tx.$queryRaw`SELECT id FROM "Comment" WHERE id = ${data.parentId} FOR UPDATE`;
      const parent = await tx.comment.findFirst({ where: { id: data.parentId, articleId: data.articleId, parentId: null,
        deletedAt: null, hiddenAt: null }, select: { id: true, authorId: true } });
      if (!parent) throw new SocialError("INVALID_PARENT", "Ответить можно только на доступный основной комментарий этой статьи.");
      recipientId = parent.authorId;
    }
    const now = new Date();
    // The actor's PostgreSQL row lock serializes these checks across instances.
    const recent = await tx.comment.findMany({ where: { authorId, createdAt: { gte: new Date(now.getTime() - 60000) } },
      select: { id: true, articleId: true, parentId: true, content: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 });
    if (recent.some((row) => row.articleId === data.articleId && row.parentId === data.parentId && row.content === data.content)) {
      throw new SocialError("RATE_LIMIT", "Такой комментарий уже отправлен. Не повторяйте его сразу.");
    }
    if (recent.length >= 10 || (recent[0] && now.getTime() - recent[0].createdAt.getTime() < 5000)) {
      throw new SocialError("RATE_LIMIT", "Подождите немного перед следующим комментарием (не менее 5 секунд, до 10 в минуту).");
    }
    const comment = await tx.comment.create({ data: { ...data, authorId }, select: { id: true } });
    if (recipientId !== authorId) await createNotification(tx, { recipientId, actorId: authorId,
      type: data.parentId ? "COMMENT_REPLY" : "ARTICLE_COMMENT", articleId: article.id,
      commentId: comment.id, eventKey: `comment:${comment.id}` });
    const replyCount = data.parentId ? await tx.comment.count({ where: { articleId: data.articleId, parentId: data.parentId } }) : 0;
    return { id: comment.id, replyPage: Math.max(1, Math.ceil(replyCount / REPLY_PAGE_SIZE)) };
  });
}
export async function deleteOwnComment(input: unknown, requestHeaders?: Headers) {
  const { commentId } = commentIdSchema.parse(input);
  const target = await getPrisma().comment.findUnique({ where: { id: commentId }, select: { articleId: true } });
  // The service still authenticates even if an attacker supplies an unknown ID.
  return withPublicArticle(target?.articleId ?? "missing", requestHeaders, async (tx, authorId) => {
    await tx.$queryRaw`SELECT id FROM "Comment" WHERE id = ${commentId} FOR UPDATE`;
    const comment = await tx.comment.findFirst({ where: { id: commentId, authorId }, select: { deletedAt: true } });
    if (!comment) throw new SocialError("NOT_FOUND", "Комментарий недоступен.");
    if (!comment.deletedAt) await tx.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), content: "" } });
  });
}
async function setHidden(input: unknown, hidden: boolean, requestHeaders?: Headers) {
  const { commentId } = commentIdSchema.parse(input);
  const actor = await requireModerator(requestHeaders);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, actor.id, undefined, true);
    await setCommentHiddenInTransaction(tx, commentId, actor.id, hidden);
  }, socialTransactionOptions);
}
export const hideComment = (input: unknown, requestHeaders?: Headers) => setHidden(input, true, requestHeaders);
export const restoreComment = (input: unknown, requestHeaders?: Headers) => setHidden(input, false, requestHeaders);

// Shared by ordinary moderation and atomic report resolution. Caller authorizes and locks actor.
export async function setCommentHiddenInTransaction(tx: Prisma.TransactionClient, commentId: string, actorId: string, hidden: boolean) {
    await tx.$queryRaw`SELECT id FROM "Comment" WHERE id = ${commentId} FOR UPDATE`;
    const comment = await tx.comment.findUnique({ where: { id: commentId }, select: { deletedAt: true, hiddenAt: true } });
    if (!comment) throw new SocialError("NOT_FOUND", "Комментарий недоступен.");
    if (comment.deletedAt) throw new SocialError("CONFLICT", "Автор удалил комментарий. Восстановление невозможно.");
    if (Boolean(comment.hiddenAt) !== hidden) await tx.comment.update({ where: { id: commentId },
      data: { hiddenAt: hidden ? new Date() : null, hiddenById: hidden ? actorId : null } });
}
