import "server-only";
import { cache } from "react";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./server";
import { getPrisma } from "@/lib/prisma";
import { assertActiveUser, assertRole, AuthorizationError } from "@/features/auth/permissions";
import { safeReturnTo } from "@/features/auth/schemas";

export async function getCurrentSession(requestHeaders?: Headers) {
  const currentHeaders = requestHeaders ?? await headers();
  return getAuth().api.getSession({ headers: currentHeaders, query: { disableCookieCache: true } });
}

async function readCurrentUser(requestHeaders?: Headers) {
  const session = await getCurrentSession(requestHeaders);
  if (!session) return null;
  // Fresh database lookup: never authorize from cookie-cached roles or client claims.
  return getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, username: true, email: true, bio: true, image: true, role: true, isBanned: true, createdAt: true },
  });
}

// React cache lives only for the current RSC request. Header/page/service share
// the lookup; API calls with explicit headers and later requests always re-read.
const currentRequestUser = cache(() => readCurrentUser());
export async function getCurrentUser(requestHeaders?: Headers) {
  return requestHeaders ? readCurrentUser(requestHeaders) : currentRequestUser();
}

export async function requireAuth(requestHeaders?: Headers) {
  const user = await getCurrentUser(requestHeaders);
  assertActiveUser(user);
  return user;
}

export async function requireModerator(requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  assertRole(user, ["MODERATOR", "ADMIN"]);
  return user;
}

export async function requireAdmin(requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  assertRole(user, ["ADMIN"]);
  return user;
}

export async function requirePageUser(returnTo: string) {
  try { return await requireAuth(); }
  catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    const query = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
    if (error.code === "BANNED") query.set("error", "banned");
    redirect(`/login?${query}`);
  }
}
