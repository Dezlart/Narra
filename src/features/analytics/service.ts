import "server-only";
import { getPrisma } from "@/lib/prisma";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { idSchema } from "@/features/articles/schemas";
import { analyticsSecret, utcBucket, validVisitor, visitorHash } from "./identity";
export async function registerArticleView(input: unknown, token: string, now = new Date()) {
  const articleId = idSchema.parse(input), secret = analyticsSecret();
  if (!secret || !validVisitor(token, secret, now)) return { counted: false };
  const viewBucket = utcBucket(now);
  return getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${articleId} FOR SHARE`;
    if (!await tx.article.count({ where: { AND: [publicArticleWhere, { id: articleId }] } })) return { counted: false };
    const result = await tx.articleView.createMany({ data: { articleId, visitorHash: visitorHash(token, articleId, viewBucket, secret), viewBucket, createdAt: now }, skipDuplicates: true });
    return { counted: result.count === 1 };
  });
}
