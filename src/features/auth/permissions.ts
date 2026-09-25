import type { UserRole } from "@/generated/prisma/enums";

export class AuthorizationError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "BANNED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthorizationError";
  }
}

export function assertActiveUser<T extends { isBanned: boolean }>(user: T | null): asserts user is T {
  if (!user) throw new AuthorizationError("UNAUTHENTICATED");
  if (user.isBanned) throw new AuthorizationError("BANNED");
}

export function assertRole(user: { isBanned: boolean; role: UserRole }, allowedRoles: readonly UserRole[]) {
  assertActiveUser(user);
  if (!allowedRoles.includes(user.role)) throw new AuthorizationError("FORBIDDEN");
}
