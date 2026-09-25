import "dotenv/config";
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAuth } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser, requireAdmin, requireAuth, requireModerator } from "@/lib/auth/guards";
import { getPublicProfile, updateOwnProfile } from "@/features/users/service";

// Explicit opt-in command only. Real Better Auth, Prisma and development DB;
// no mocked users or sessions. Cleanup is limited to this run's random identities.
const run = randomBytes(6).toString("hex");
const username = `test_${run}`;
const emails = [0, 1, 2, 3].map((index) => `narra-${run}-${index}@example.test`);
const password = randomBytes(24).toString("base64url");
const testIP = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const origin = process.env.BETTER_AUTH_URL!;

async function request(path: string, body?: Record<string, unknown>, cookie?: string, requestOrigin = origin) {
  return getAuth().handler(new Request(`${origin}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", origin: requestOrigin, "x-forwarded-for": testIP, ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
}

function sessionHeaders(response: Response) {
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).filter((value) => value.startsWith("better-auth.session_token=") || value.startsWith("__Secure-better-auth.session_token=")).join("; ");
  expect(Boolean(cookie)).toBe(true);
  return new Headers({ cookie });
}

afterAll(async () => {
  const prisma = getPrisma();
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `${testIP}|` } } });
  await prisma.$disconnect();
});

describe("real database authentication", () => {
  it("registers, enforces ownership/roles/uniqueness, updates a profile, blocks banned sessions and logs out", async () => {
    const registration = { email: emails[0], password, name: "Тестовый автор", username: username.toUpperCase(), role: "ADMIN", isBanned: false, emailVerified: true };
    const signup = await request("/sign-up/email", registration);
    expect(signup.status).toBe(200);
    const headers = sessionHeaders(signup);
    const cookie = headers.get("cookie")!;
    expect(signup.headers.getSetCookie().some((value) => /HttpOnly/i.test(value) && /SameSite=Lax/i.test(value))).toBe(true);
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });
    expect(user.role).toBe("USER");
    expect(user.emailVerified).toBe(false);
    expect(user.username).toBe(username);
    const account = await prisma.account.findFirstOrThrow({ where: { userId: user.id, providerId: "credential" } });
    expect(Boolean(account.password) && account.password !== password).toBe(true);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    expect((await request("/sign-up/email", { ...registration, email: emails[1] })).status).toBe(409);
    expect((await request("/sign-up/email", { ...registration, username: `${username}_other` })).ok).toBe(false);

    await expect(requireAuth(new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await expect(requireAdmin(headers)).rejects.toThrow("FORBIDDEN");
    await expect(requireModerator(headers)).rejects.toThrow("FORBIDDEN");
    expect((await getCurrentUser(headers))?.id === user.id).toBe(true);
    await prisma.user.update({ where: { id: user.id }, data: { role: "MODERATOR" } });
    expect((await requireModerator(headers)).role).toBe("MODERATOR");
    await expect(requireAdmin(headers)).rejects.toThrow("FORBIDDEN");
    await prisma.user.update({ where: { id: user.id }, data: { role: "USER" } });
    await expect(requireModerator(headers)).rejects.toThrow("FORBIDDEN");

    const second = await request("/sign-up/email", { ...registration, email: emails[1], username: `${username}_other` });
    expect(second.status).toBe(200);
    const other = await prisma.user.findUniqueOrThrow({ where: { email: emails[1] } });
    const profile = { name: "Новое имя", username: `${username}_new`, bio: "Настоящий профиль в PostgreSQL." };
    await expect(updateOwnProfile(profile, new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await expect(updateOwnProfile({ ...profile, userId: other.id }, headers)).rejects.toThrow();
    await expect(updateOwnProfile({ ...profile, role: "ADMIN" }, headers)).rejects.toThrow();
    expect((await request("/update-user", { name: "Bypass", role: "ADMIN" }, cookie)).status).toBe(403);
    await expect(updateOwnProfile({ ...profile, username: other.username }, headers)).rejects.toThrow("Этот username уже занят.");
    await updateOwnProfile(profile, headers);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).name).toBe("Тестовый автор");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("USER");
    const publicProfile = await getPublicProfile(profile.username);
    expect(publicProfile?.name).toBe(profile.name);
    expect(Object.keys(publicProfile!).sort()).toEqual(["bio", "createdAt", "image", "name", "username"]);
    expect(await getPublicProfile(username)).toBeNull();

    expect((await request("/sign-in/email", { email: emails[0], password: "incorrect-password" })).status).toBe(401);
    expect((await request("/sign-in/email", { email: emails[0], password, callbackURL: "https://evil.example" })).status).toBe(403);
    const login = await request("/sign-in/email", { email: emails[0], password, callbackURL: "/dashboard/settings" });
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.url).toBe("/dashboard/settings");
    expect((await request("/sign-up/email", { ...registration, email: emails[2], username: `${username}_csrf` }, undefined, "https://evil.example")).status).toBe(403);
    const signedIn = sessionHeaders(login);
    expect((await getCurrentUser(signedIn))?.id === user.id).toBe(true);
    await prisma.user.update({ where: { id: user.id }, data: { isBanned: true } });
    await expect(requireAuth(signedIn)).rejects.toThrow("BANNED");
    await expect(updateOwnProfile({ ...profile, name: "Blocked" }, signedIn)).rejects.toThrow("BANNED");
    expect((await request("/sign-in/email", { email: emails[0], password })).status).toBe(403);
    expect(await getPublicProfile(profile.username)).toBeNull();
    await prisma.user.update({ where: { id: user.id }, data: { isBanned: false } });
    const logout = await request("/sign-out", {}, signedIn.get("cookie")!);
    expect(logout.status).toBe(200);
    expect(await getCurrentUser(signedIn)).toBeNull();
  }, 120000);

  it("lets only one concurrent registration claim a username", async () => {
    const responses = await Promise.all(emails.slice(2).map((email) => request("/sign-up/email", { name: "Конкурентный тест", email, password, username: `${username}_race` })));
    expect(responses.filter((response) => response.ok).length).toBe(1);
    expect(await getPrisma().user.count({ where: { username: `${username}_race` } })).toBe(1);
  }, 60000);
});
