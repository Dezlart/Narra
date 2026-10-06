/** Pure server configuration validation. Errors never include input values. */
type Environment = Record<string, string | undefined>;
export function configuredOrigin(value: string | undefined, allowLoopback = false): string | undefined {
  try {
    const url = new URL(value ?? "");
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || (loopback && !allowLoopback) || (url.protocol !== "https:" && !(allowLoopback && loopback && url.protocol === "http:"))) return undefined;
    return url.origin;
  } catch { return undefined; }
}

export function environmentIssues(env: Environment, requireDeployment = false): string[] {
  const hosted = requireDeployment || env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview"
    || (env.NODE_ENV === "production" && !configuredOrigin(env.BETTER_AUTH_URL, true)?.match(/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/));
  const issues: string[] = [];
  let database: URL | undefined;
  try { database = new URL(env.DATABASE_URL ?? ""); } catch { /* Report the key below. */ }
  if (!database || !["postgres:", "postgresql:"].includes(database.protocol)) issues.push("DATABASE_URL must be a PostgreSQL URL");
  if (hosted && database && !["require", "verify-ca", "verify-full"].includes(database.searchParams.get("sslmode") ?? "")) issues.push("DATABASE_URL requires TLS (sslmode)");
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) issues.push("BETTER_AUTH_SECRET must have at least 32 characters");
  const origin = configuredOrigin(env.BETTER_AUTH_URL, !hosted);
  if (!origin) issues.push("BETTER_AUTH_URL must be an exact HTTPS origin (loopback HTTP allowed locally)");
  if (hosted || env.NODE_ENV === "production") {
    if (!env.ANALYTICS_HASH_SECRET || env.ANALYTICS_HASH_SECRET.length < 32) issues.push("ANALYTICS_HASH_SECRET must have at least 32 characters");
    if (env.ANALYTICS_HASH_SECRET && env.ANALYTICS_HASH_SECRET === env.BETTER_AUTH_SECRET) issues.push("ANALYTICS_HASH_SECRET must differ from BETTER_AUTH_SECRET");
  }
  if (hosted) {
    if (!env.BLOB_READ_WRITE_TOKEN && !(env.BLOB_STORE_ID && env.VERCEL_OIDC_TOKEN)) issues.push("Private Blob credentials are required (BLOB_READ_WRITE_TOKEN or managed OIDC with BLOB_STORE_ID)");
    if (env.VERCEL_ENV !== "preview" && (!configuredOrigin(env.SITE_URL) || configuredOrigin(env.SITE_URL) !== origin)) issues.push("SITE_URL must match the public BETTER_AUTH_URL HTTPS origin");
  }
  return issues;
}

export function assertRuntimeEnvironment(env: Environment = process.env): void {
  const issues = environmentIssues(env);
  if (issues.length) throw new Error(`Narra environment configuration: ${issues.join("; ")}.`);
}
