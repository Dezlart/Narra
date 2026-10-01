import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireAuth, requireModerator } from "@/lib/auth/guards";
import { assertRole } from "@/features/auth/permissions";
import { lockSocialUsers, socialTransactionOptions } from "@/features/social/transaction";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { visibleCommentWhere } from "@/features/comments/visibility";
import { setCommentHiddenInTransaction } from "@/features/comments/service";
import { setArticleArchivedInTransaction } from "@/features/admin/service";
import { SocialError } from "@/features/social/errors";
import { reportSchema, resolveReportSchema } from "./schemas";
export async function createReport(input: unknown, headers?: Headers) {
  const actor = await requireAuth(headers), data = reportSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, actor.id);
    const comment = data.targetType === "COMMENT" ? await tx.comment.findFirst({
      where: { id: data.targetId, ...visibleCommentWhere, article: publicArticleWhere }, select: { articleId: true, authorId: true } }) : null;
    const articleId = data.targetType === "ARTICLE" ? data.targetId : comment?.articleId;
    const unavailable = () => new SocialError("NOT_FOUND", "Материал недоступен для жалобы.");
    if (!articleId) throw unavailable();
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${articleId} FOR SHARE`;
    const article = await tx.article.findFirst({ where: { AND: [publicArticleWhere, { id: articleId }] }, select: { authorId: true } });
    if (!article) throw unavailable();
    if (data.targetType === "COMMENT") {
      await tx.$queryRaw`SELECT id FROM "Comment" WHERE id = ${data.targetId} FOR SHARE`;
      if (!await tx.comment.count({ where: { id: data.targetId, ...visibleCommentWhere } })) throw unavailable();
    }
    if ((comment?.authorId ?? article.authorId) === actor.id) throw new SocialError("FORBIDDEN", "Нельзя пожаловаться на собственный материал.");
    const activeKey = [actor.id, data.targetType, data.targetId].join(":");
    if (await tx.report.findUnique({ where: { activeKey }, select: { id: true } })) return { created: false };
    if (await tx.report.count({ where: { reporterId: actor.id, createdAt: { gte: new Date(Date.now() - 3600000) } } }) >= 10) {
      throw new SocialError("RATE_LIMIT", "Не более 10 жалоб в час. Попробуйте позже.");
    }
    const result = await tx.report.createMany({ data: { reporterId: actor.id, targetType: data.targetType,
      articleId: data.targetType === "ARTICLE" ? data.targetId : null, commentId: data.targetType === "COMMENT" ? data.targetId : null,
      reason: data.reason, description: data.description || null, activeKey }, skipDuplicates: true });
    return { created: result.count === 1 };
  }, socialTransactionOptions);
}
export async function resolveReport(input: unknown, headers?: Headers) {
  const actor = await requireModerator(headers), data = resolveReportSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, actor.id, undefined, true);
    if (data.action === "ARCHIVE_ARTICLE") assertRole(await tx.user.findUniqueOrThrow({ where: { id: actor.id }, select: { role: true, isBanned: true } }), ["ADMIN"]);
    await tx.$queryRaw`SELECT id FROM "Report" WHERE id = ${data.reportId} FOR UPDATE`;
    const report = await tx.report.findUnique({ where: { id: data.reportId } });
    if (!report) throw new SocialError("NOT_FOUND", "Жалоба не найдена.");
    if (report.status !== "OPEN") throw new SocialError("CONFLICT", "Жалоба уже рассмотрена. Обновите страницу.");
    if (data.action === "HIDE_COMMENT") {
      if (!report.commentId) throw new SocialError("CONFLICT", "Жалоба не относится к комментарию.");
      await setCommentHiddenInTransaction(tx, report.commentId, actor.id, true);
    }
    if (data.action === "ARCHIVE_ARTICLE") {
      if (!report.articleId) throw new SocialError("CONFLICT", "Жалоба не относится к статье.");
      await setArticleArchivedInTransaction(tx, report.articleId, true);
    }
    await tx.report.update({ where: { id: report.id }, data: { status: data.status, activeKey: null,
      resolvedAt: new Date(), resolvedById: actor.id, resolutionNote: data.note || null } });
  }, socialTransactionOptions);
}
