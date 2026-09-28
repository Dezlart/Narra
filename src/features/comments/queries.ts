import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser, requireModerator } from "@/lib/auth/guards";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { publicPage } from "@/features/public-content/params";
import { SocialError } from "@/features/social/errors";
import { idSchema } from "@/features/articles/schemas";
import { publicCommentView } from "./view";
import { COMMENT_PAGE_SIZE, REPLY_PAGE_SIZE, repliesSchema } from "./schemas";
import { visibleCommentWhere } from "./visibility";
const commentSelect = { id: true, authorId: true, parentId: true, content: true, createdAt: true, updatedAt: true, deletedAt: true, hiddenAt: true,
  author: { select: { name: true, username: true, isBanned: true } }, _count: { select: { replies: true } } } satisfies Prisma.CommentSelect;
async function publicContext(articleInput: unknown, requestHeaders?: Headers) {
  const articleId = idSchema.parse(articleInput);
  const [article, user] = await Promise.all([
    getPrisma().article.findFirst({ where: { AND: [publicArticleWhere, { id: articleId }] }, select: { id: true } }),
    getCurrentUser(requestHeaders),
  ]);
  if (!article) throw new SocialError("NOT_FOUND", "Публикация недоступна.");
  return { articleId, viewerId: user && !user.isBanned ? user.id : null };
}
export async function getArticleComments(articleInput: unknown, pageInput: unknown = 1, requestHeaders?: Headers) {
  const { articleId, viewerId } = await publicContext(articleInput, requestHeaders);
  const page = publicPage(pageInput);
  const [rows, count] = await Promise.all([
    getPrisma().comment.findMany({ where: { articleId, parentId: null }, select: commentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * COMMENT_PAGE_SIZE, take: COMMENT_PAGE_SIZE + 1 }),
    getPrisma().comment.count({ where: { articleId, ...visibleCommentWhere } }),
  ]);
  return { items: rows.slice(0, COMMENT_PAGE_SIZE).map((row) => publicCommentView(row, viewerId)), count, page, hasNext: rows.length > COMMENT_PAGE_SIZE && page < 1000 };
}
export async function getCommentReplies(input: unknown, requestHeaders?: Headers) {
  const { articleId, parentId, page } = repliesSchema.parse(input);
  const { viewerId } = await publicContext(articleId, requestHeaders);
  // Existing replies remain readable below a deleted/hidden root.
  const parent = await getPrisma().comment.findFirst({ where: { id: parentId, articleId, parentId: null }, select: { id: true } });
  if (!parent) throw new SocialError("NOT_FOUND", "Обсуждение недоступно.");
  const rows = await getPrisma().comment.findMany({ where: { articleId, parentId }, select: commentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: (page - 1) * REPLY_PAGE_SIZE, take: REPLY_PAGE_SIZE + 1 });
  return { items: rows.slice(0, REPLY_PAGE_SIZE).map((row) => publicCommentView(row, viewerId)), page, hasNext: rows.length > REPLY_PAGE_SIZE && page < 1000 };
}
export async function getCommentsForModeration(pageInput: unknown, commentInput?: unknown, requestHeaders?: Headers) {
  await requireModerator(requestHeaders);
  const page = publicPage(pageInput);
  const parsedId = typeof commentInput === "string" && commentInput ? idSchema.safeParse(commentInput) : null;
  if (parsedId && !parsedId.success) return { items: [], page: 1, hasNext: false };
  const rows = await getPrisma().comment.findMany({ where: parsedId?.success ? { id: parsedId.data } : {},
    select: { ...commentSelect, articleId: true, hiddenBy: { select: { name: true } }, article: { select: { slug: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21, skip: (page - 1) * 20 });
  return { items: rows.slice(0, 20), page, hasNext: rows.length > 20 && page < 1000 };
}
