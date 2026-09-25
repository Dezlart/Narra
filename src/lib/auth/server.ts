import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { getPrisma } from "@/lib/prisma";
import { safeReturnTo, signInSchema, signUpSchema } from "@/features/auth/schemas";

function createNarraAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error("Set BETTER_AUTH_SECRET (32+ characters) and BETTER_AUTH_URL.");
  }
  const origin = new URL(baseURL).origin;
  const prisma = getPrisma();

  return betterAuth({
    appName: "Narra",
    baseURL: origin,
    secret,
    trustedOrigins: [origin],
    // Keep the same protection in Vitest: Better Auth otherwise relaxes Origin
    // checking when NODE_ENV=test.
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    database: prismaAdapter(prisma, { provider: "postgresql", transaction: true }),
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    user: {
      additionalFields: {
        username: { type: "string", required: true, input: true },
        bio: { type: "string", required: false, input: false },
        role: { type: ["USER", "MODERATOR", "ADMIN"], required: false, defaultValue: "USER", input: false },
        isBanned: { type: "boolean", required: false, defaultValue: false, input: false, returned: false },
      },
    },
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 10 }, "/sign-up/email": { window: 60, max: 10 } },
    },
    // Do not log request bodies, passwords, session tokens or database exceptions.
    logger: { level: "error", log: () => console.error("[Narra auth] Authentication operation failed.") },
    onAPIError: { onError: () => { /* Expected API errors are returned to the caller without payload logging. */ } },
    disabledPaths: ["/change-email", "/change-password", "/set-password", "/delete-user"],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Profile changes use our validated, ownership-checked application service.
        if (ctx.path === "/update-user") {
          throw new APIError("FORBIDDEN", { code: "PROFILE_SETTINGS_REQUIRED", message: "Используйте настройки профиля." });
        }
        if (ctx.path === "/sign-up/email") {
          const parsed = signUpSchema.safeParse(ctx.body);
          if (!parsed.success) throw new APIError("BAD_REQUEST", { code: "INVALID_INPUT", message: parsed.error.issues[0].message });
          if (await prisma.user.findUnique({ where: { username: parsed.data.username }, select: { id: true } })) {
            throw new APIError("CONFLICT", { code: "USERNAME_TAKEN", message: "Этот username уже занят." });
          }
          // Whitelist replaces the payload; roles, ban flags and verification cannot enter.
          return { context: { ...ctx, body: { ...parsed.data, callbackURL: "/dashboard" } } };
        }
        if (ctx.path === "/sign-in/email") {
          const parsed = signInSchema.safeParse(ctx.body);
          if (!parsed.success) throw new APIError("BAD_REQUEST", { code: "INVALID_INPUT", message: parsed.error.issues[0].message });
          return { context: { ...ctx, body: { ...parsed.data, callbackURL: safeReturnTo(ctx.body?.callbackURL) } } };
        }
      }),
    },
    databaseHooks: {
      user: { create: { before: async (user) => ({ data: { ...user, role: "USER", isBanned: false, emailVerified: false, image: null } }) } },
      session: { create: { before: async (session, ctx) => {
        // Internal adapter participates in the signup transaction: the new user
        // is not yet visible to an independent Prisma connection.
        const user = await ctx?.context.internalAdapter.findUserById(session.userId);
        if (!user || !("isBanned" in user) || user.isBanned !== false) throw new APIError("FORBIDDEN", { code: "ACCOUNT_BANNED", message: "Доступ к аккаунту ограничен." });
        return { data: session };
      } } },
    },
    plugins: [nextCookies()],
  });
}

export type NarraAuth = ReturnType<typeof createNarraAuth>;
let auth: NarraAuth | undefined;

export function getAuth(): NarraAuth {
  return auth ??= createNarraAuth();
}
