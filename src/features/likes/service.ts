import "server-only";
import { articleSocialSchema } from "@/features/social/schemas";
import { withPublicArticle } from "@/features/social/transaction";
export async function likeArticle(input: unknown, requestHeaders?: Headers) {
  const { articleId } = articleSocialSchema.parse(input);
  return withPublicArticle(articleId, requestHeaders, async (tx, userId) => {
    await tx.like.createMany({ data: [{ userId, articleId }], skipDuplicates: true });
  });
}
export async function unlikeArticle(input: unknown, requestHeaders?: Headers) {
  const { articleId } = articleSocialSchema.parse(input);
  return withPublicArticle(articleId, requestHeaders, async (tx, userId) => {
    await tx.like.deleteMany({ where: { userId, articleId } });
  });
}
