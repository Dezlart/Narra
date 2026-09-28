import "server-only";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/guards";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { visibleCommentWhere } from "@/features/comments/visibility";
import { idSchema } from "@/features/articles/schemas";
import { SocialError } from "./errors";
export async function getArticleSocialState(articleInput: unknown, requestHeaders?: Headers) {
  const articleId = idSchema.parse(articleInput);
  const db = getPrisma();
  const user = await getCurrentUser(requestHeaders);
  const viewer = user && !user.isBanned ? user : null;
  const article = await db.article.findFirst({ where: { AND: [publicArticleWhere, { id: articleId }] }, select: {
    _count: { select: { likes: { where: { user: { isBanned: false } } }, comments: { where: visibleCommentWhere } } },
    ...(viewer ? { likes: { where: { userId: viewer.id }, select: { userId: true }, take: 1 },
      bookmarks: { where: { userId: viewer.id }, select: { userId: true }, take: 1 } } : {}),
  } });
  if (!article) throw new SocialError("NOT_FOUND", "Публикация недоступна.");
  return { likes: article._count.likes, comments: article._count.comments,
    liked: Boolean(article.likes?.length), saved: Boolean(article.bookmarks?.length),
    viewer: viewer ? "member" as const : user ? "banned" as const : "guest" as const };
}
