import "server-only";
import { articleSocialSchema } from "@/features/social/schemas";
import { withPublicArticle } from "@/features/social/transaction";
export async function saveArticle(input: unknown, requestHeaders?: Headers) {
  const { articleId } = articleSocialSchema.parse(input);
  return withPublicArticle(articleId, requestHeaders, async (tx, userId) => {
    await tx.bookmark.createMany({ data: [{ userId, articleId }], skipDuplicates: true });
  });
}
export async function unsaveArticle(input: unknown, requestHeaders?: Headers) {
  const { articleId } = articleSocialSchema.parse(input);
  return withPublicArticle(articleId, requestHeaders, async (tx, userId) => {
    await tx.bookmark.deleteMany({ where: { userId, articleId } });
  });
}
