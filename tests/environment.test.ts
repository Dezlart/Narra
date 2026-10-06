import { afterEach, describe, expect, it, vi } from "vitest";
import { assertRuntimeEnvironment, configuredOrigin, environmentIssues } from "@/lib/environment";
vi.mock("server-only", () => ({}));
import { siteOrigin } from "@/features/public-content/metadata";
import robots from "@/app/robots";
import nextConfig from "../next.config";

// Reserved test domains and synthetic keys; no real credentials.
const production = {
  NODE_ENV: "production", VERCEL_ENV: "production",
  DATABASE_URL: "postgresql://example.test/narra?sslmode=verify-full",
  BETTER_AUTH_URL: "https://narra.example.test", SITE_URL: "https://narra.example.test",
  BETTER_AUTH_SECRET: "a".repeat(32), ANALYTICS_HASH_SECRET: "b".repeat(32),
  BLOB_STORE_ID: "store_fixture", VERCEL_OIDC_TOKEN: "synthetic-managed-token",
};
afterEach(() => vi.unstubAllEnvs());
describe("deployment configuration boundaries", () => {
  it("accepts complete production settings and managed private store credentials", () => {
    expect(environmentIssues(production)).toEqual([]);
    expect(() => assertRuntimeEnvironment(production)).not.toThrow();
  });
  it.each(["http://narra.example.test", "https://localhost", "https://narra.example.test/path", "https://user:password@narra.example.test", "https://narra.example.test?x=y", "https://narra.example.test#x"])("rejects unsafe origin %s", (value) => {
    expect(configuredOrigin(value)).toBeUndefined();
    expect(environmentIssues({ ...production, BETTER_AUTH_URL: value }).length).toBeGreaterThan(0);
  });
  it("rejects missing secrets, reused keys, missing Blob, wrong canonical host and plaintext DB", () => {
    const issues = environmentIssues({ ...production, DATABASE_URL: "postgresql://example.test/db", ANALYTICS_HASH_SECRET: production.BETTER_AUTH_SECRET, BLOB_STORE_ID: "", SITE_URL: "https://other.example.test" });
    expect(issues).toHaveLength(4);
    expect(environmentIssues({ ...production, BETTER_AUTH_SECRET: "", ANALYTICS_HASH_SECRET: "" }).join(" ")).toContain("32 characters");
  });
  it("keeps local build QA possible but production preflight rejects local settings", () => {
    const local = { ...production, VERCEL_ENV: undefined, BETTER_AUTH_URL: "http://localhost:3000", SITE_URL: "", BLOB_STORE_ID: "", VERCEL_OIDC_TOKEN: "" };
    expect(environmentIssues(local)).toEqual([]);
    expect(environmentIssues(local, true).length).toBeGreaterThan(0);
    expect(environmentIssues({ ...local, ANALYTICS_HASH_SECRET: "" })).toHaveLength(1);
  });
  it("never echoes parser input in errors", () => {
    expect(() => assertRuntimeEnvironment({ ...production, DATABASE_URL: "sensitive-invalid-value" })).toThrow("DATABASE_URL");
    try { assertRuntimeEnvironment({ ...production, DATABASE_URL: "sensitive-invalid-value" }); } catch (error) { expect(String(error)).not.toContain("sensitive-invalid-value"); }
  });
  it("Preview cannot advertise production canonicals/sitemap even when SITE_URL is inherited", async () => {
    vi.stubEnv("VERCEL_ENV", "preview"); vi.stubEnv("SITE_URL", production.SITE_URL);
    expect(siteOrigin()).toBeUndefined();
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(await nextConfig.headers!()).toEqual(expect.arrayContaining([expect.objectContaining({ headers: expect.arrayContaining([{ key: "X-Robots-Tag", value: "noindex, nofollow" }]) })]));
    expect(environmentIssues({ ...production, VERCEL_ENV: "preview", SITE_URL: "" })).toEqual([]);
  });
});
