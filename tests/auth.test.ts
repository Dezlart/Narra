import { describe, expect, it } from "vitest";
import { registrationFormSchema, safeReturnTo, signUpSchema } from "@/features/auth/schemas";
import { assertActiveUser, assertRole } from "@/features/auth/permissions";
import { profileSchema } from "@/features/users/schemas";

const valid = { name: "  Автор Narra  ", username: "  New_Author  ", email: "AUTHOR@example.test", password: "a-long-test-password", confirmPassword: "a-long-test-password" };

describe("registration", () => {
  it("normalizes identity and requires matching password confirmation", () => {
    expect(registrationFormSchema.parse(valid)).toMatchObject({ name: "Автор Narra", username: "new_author", email: "author@example.test" });
    expect(registrationFormSchema.safeParse({ ...valid, confirmPassword: "different" }).success).toBe(false);
  });
  it.each(["ab", "../admin", "with space", "РусскоеИмя", "_leading", "x".repeat(31)])("rejects invalid username %s", (username) => {
    expect(signUpSchema.safeParse({ ...valid, username }).success).toBe(false);
  });
  it("strips privileged registration fields", () => {
    const data = signUpSchema.parse({ ...valid, role: "ADMIN", isBanned: false, emailVerified: true, id: "victim" });
    expect(Object.keys(data).sort()).toEqual(["email", "name", "password", "username"]);
  });
});

describe("authorization", () => {
  it("rejects missing and banned users", () => {
    expect(() => assertActiveUser(null)).toThrow("UNAUTHENTICATED");
    expect(() => assertActiveUser({ isBanned: true })).toThrow("BANNED");
  });
  it("enforces the role hierarchy on the server", () => {
    expect(() => assertRole({ role: "USER", isBanned: false }, ["ADMIN"])).toThrow("FORBIDDEN");
    expect(() => assertRole({ role: "MODERATOR", isBanned: false }, ["ADMIN"])).toThrow("FORBIDDEN");
    expect(() => assertRole({ role: "MODERATOR", isBanned: false }, ["MODERATOR", "ADMIN"])).not.toThrow();
    expect(() => assertRole({ role: "ADMIN", isBanned: false }, ["ADMIN"])).not.toThrow();
    expect(() => assertRole({ role: "ADMIN", isBanned: true }, ["ADMIN"])).toThrow("BANNED");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/dashboard?next=https://evil.example", "/admin", null, ["/dashboard"]])("rejects unsafe return URL %s", (url) => {
    expect(safeReturnTo(url)).toBe("/dashboard");
  });
  it("keeps a safe settings return path", () => expect(safeReturnTo("/dashboard/settings")).toBe("/dashboard/settings"));
  it.each(["id", "userId", "role", "isBanned", "emailVerified", "email", "image"])("rejects profile mass assignment: %s", (field) => {
    expect(profileSchema.safeParse({ name: "Автор", username: "author", bio: "", [field]: "forbidden" }).success).toBe(false);
  });
});
