import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { userChangeSchema, createCategorySchema, updateCategorySchema } from "@/features/admin/schemas";
import { reportSchema, resolveReportSchema } from "@/features/reports/schemas";
import { analyticsSecret, issueVisitor, validVisitor, visitorHash, utcBucket } from "@/features/analytics/identity";
import { safeReturnTo } from "@/features/auth/schemas";
afterEach(() => vi.unstubAllEnvs());
describe("administrative input and short-lived analytics identity", () => {
  it("rejects forged user/role mutations", () => {
    for (const input of [{ operation: "role", userId: "u", role: "OWNER" }, { operation: "ban", userId: "u", banned: "false" },
      { operation: "role", userId: "u", role: "ADMIN", actorId: "fake" }]) expect(userChangeSchema.safeParse(input).success).toBe(false);
  });
  it("keeps category slugs stable and validates new slugs", () => {
    expect(createCategorySchema.safeParse({ name: "Тема", slug: "../evil", description: "" }).success).toBe(false);
    expect(updateCategorySchema.safeParse({ categoryId: "c", name: "Тема", description: "", slug: "changed" }).success).toBe(false);
  });
  it("rejects self-assigned reporter and invalid targets", () => {
    const input = { targetType: "ARTICLE", targetId: "a", reason: "SPAM" };
    expect(reportSchema.safeParse({ ...input, reporterId: "victim" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...input, targetType: "USER" }).success).toBe(false);
    expect(reportSchema.safeParse({ ...input, description: "x".repeat(2001) }).success).toBe(false);
  });
  it("requires an explanation for OTHER", () => {
    expect(reportSchema.safeParse({ targetType: "COMMENT", targetId: "c", reason: "OTHER", description: " " }).success).toBe(false);
  });
  it("dismiss cannot mutate content or forge review metadata", () => {
    expect(resolveReportSchema.safeParse({ reportId: "r", status: "DISMISSED", action: "HIDE_COMMENT" }).success).toBe(false);
    expect(resolveReportSchema.safeParse({ reportId: "r", status: "RESOLVED", action: "NONE", resolvedById: "fake" }).success).toBe(false);
  });
  it("allows implemented admin URLs but rejects arbitrary return destinations", () => {
    for (const path of ["/admin", "/admin/users", "/admin/reports/r", "/dashboard/analytics"]) expect(safeReturnTo(path)).toBe(path);
    for (const path of ["//evil.test", "/admin/users?role=ADMIN", "/admin/../users"]) expect(safeReturnTo(path)).toBe("/dashboard");
  });
  const secret = "unit-test-only-secret-".repeat(3), now = new Date("2026-10-01T23:50:00Z");
  it("issues signed tokens and rejects tampering and expiry", () => {
    const token = issueVisitor(secret, now);
    expect(validVisitor(token, secret, now)).toBe(true);
    expect(validVisitor(token, "different".repeat(8), now)).toBe(false);
    expect(validVisitor(`${token.slice(0, -2)}xx`, secret, now)).toBe(false);
    expect(validVisitor(token, secret, new Date(now.getTime() + 86400000))).toBe(false);
    expect(validVisitor(token, secret, new Date(now.getTime() - 1000))).toBe(false);
  });
  it("does not correlate articles or days through the stored hash", () => {
    const token = issueVisitor(secret, now), day = utcBucket(now), next = new Date("2026-10-02T00:00:00Z");
    const hash = visitorHash(token, "a", day, secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); expect(hash).not.toContain(token);
    expect(visitorHash(token, "b", day, secret)).not.toBe(hash);
    expect(visitorHash(token, "a", next, secret)).not.toBe(hash);
    expect(utcBucket(new Date("2026-10-02T02:00:00+03:00"))).toEqual(day);
  });
  it("fails closed when analytics secret is absent or short", () => {
    vi.stubEnv("ANALYTICS_HASH_SECRET", ""); expect(analyticsSecret()).toBeNull();
    vi.stubEnv("ANALYTICS_HASH_SECRET", "short"); expect(analyticsSecret()).toBeNull();
  });
});
