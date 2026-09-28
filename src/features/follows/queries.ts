import "server-only";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/guards";
import { usernameSchema } from "@/features/auth/schemas";
import { SocialError } from "@/features/social/errors";
export async function getFollowState(usernameInput: unknown, requestHeaders?: Headers) {
  const username = usernameSchema.parse(usernameInput);
  const user = await getCurrentUser(requestHeaders);
  const viewer = user && !user.isBanned ? user : null;
  const target = await getPrisma().user.findFirst({ where: { username, isBanned: false }, select: { id: true,
    _count: { select: { followers: { where: { follower: { isBanned: false } } }, following: { where: { following: { isBanned: false } } } } },
    ...(viewer ? { followers: { where: { followerId: viewer.id }, select: { followerId: true }, take: 1 } } : {}),
  } });
  if (!target) throw new SocialError("NOT_FOUND", "Пользователь недоступен.");
  return { followers: target._count.followers, following: target._count.following, active: Boolean(target.followers?.length),
    isSelf: target.id === viewer?.id, viewer: viewer ? "member" as const : user ? "banned" as const : "guest" as const };
}
