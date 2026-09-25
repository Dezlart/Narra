import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { AuthorizationError } from "@/features/auth/permissions";
import { profileSchema } from "./schemas";

export class UsernameTakenError extends Error {}

export async function updateOwnProfile(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const data = profileSchema.parse(input);
  try {
    const result = await getPrisma().user.updateMany({
      // Identity comes exclusively from the verified session. Ban is checked
      // again in the write to cover changes since requireAuth.
      where: { id: actor.id, isBanned: false },
      data: { name: data.name, username: data.username, bio: data.bio || null },
    });
    if (result.count !== 1) throw new AuthorizationError("BANNED");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UsernameTakenError("Этот username уже занят.");
    }
    throw error;
  }
  return { previousUsername: actor.username, username: data.username };
}

export async function getPublicProfile(username: string) {
  return getPrisma().user.findFirst({
    where: { username, isBanned: false },
    select: { name: true, username: true, bio: true, image: true, createdAt: true },
  });
}
