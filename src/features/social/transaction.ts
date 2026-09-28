import "server-only";
import { Prisma, type UserRole } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { assertActiveUser, assertRole } from "@/features/auth/permissions";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { SocialError } from "./errors";

export const socialTransactionOptions = { maxWait: 10000, timeout: 25000 };
export async function lockSocialUsers(tx: Prisma.TransactionClient, actorId: string, otherId?: string, moderator = false) {
  const ids = [...new Set([actorId, ...(otherId ? [otherId] : [])])].sort();
  // Ordered locks also prevent mutual-follow deadlocks and serialize rate checks.
  // NO KEY UPDATE still blocks ban/role changes but allows notification FK KEY
  // SHARE locks, avoiding cross-recipient deadlocks between concurrent comments.
  const rows = await tx.$queryRaw<{ id: string; role: UserRole; isBanned: boolean }[]>`
    SELECT id, role, "isBanned" FROM "User" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR NO KEY UPDATE`;
  const actor = rows.find((row) => row.id === actorId) ?? null;
  assertActiveUser(actor);
  if (moderator) assertRole(actor, ["MODERATOR", "ADMIN"]);
  if (otherId && !rows.some((row) => row.id === otherId && !row.isBanned)) throw new SocialError("NOT_FOUND", "Пользователь недоступен.");
}
export async function withPublicArticle<T>(articleId: string, requestHeaders: Headers | undefined,
  work: (tx: Prisma.TransactionClient, actorId: string, article: { id: string; slug: string | null; authorId: string }) => Promise<T>) {
  const actor = await requireAuth(requestHeaders);
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, actor.id);
    // Keep the publication stable until this mutation commits. Same User→Article
    // lock order as drafts/moderation; new pending revisions do not close access.
    await tx.$queryRaw`SELECT id FROM "Article" WHERE id = ${articleId} FOR SHARE`;
    const article = await tx.article.findFirst({ where: { AND: [publicArticleWhere, { id: articleId }] }, select: { id: true, slug: true, authorId: true } });
    if (!article) throw new SocialError("NOT_FOUND", "Публикация недоступна.");
    return work(tx, actor.id, article);
  }, socialTransactionOptions);
}
