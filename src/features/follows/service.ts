import "server-only";
import { randomUUID } from "node:crypto";
import { createNotification } from "@/features/notifications/events";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { followSchema } from "@/features/social/schemas";
import { SocialError } from "@/features/social/errors";
import { lockSocialUsers, socialTransactionOptions } from "@/features/social/transaction";
async function setFollowing(input: unknown, desired: boolean, requestHeaders?: Headers) {
  const { username } = followSchema.parse(input);
  const actor = await requireAuth(requestHeaders);
  const target = await getPrisma().user.findFirst({ where: { username, isBanned: false }, select: { id: true } });
  if (!target) throw new SocialError("NOT_FOUND", "Пользователь недоступен.");
  if (target.id === actor.id) throw new SocialError("FORBIDDEN", "Нельзя подписаться на себя.");
  return getPrisma().$transaction(async (tx) => {
    await lockSocialUsers(tx, actor.id, target.id);
    const where = { followerId: actor.id, followingId: target.id };
    if (desired) {
      const created = await tx.follow.createMany({ data: [where], skipDuplicates: true });
      if (created.count) await createNotification(tx, { recipientId: target.id, actorId: actor.id,
        type: "NEW_FOLLOWER", eventKey: `follow:${randomUUID()}` });
    }
    else await tx.follow.deleteMany({ where });
  }, socialTransactionOptions);
}
export const followUser = (input: unknown, requestHeaders?: Headers) => setFollowing(input, true, requestHeaders);
export const unfollowUser = (input: unknown, requestHeaders?: Headers) => setFollowing(input, false, requestHeaders);
