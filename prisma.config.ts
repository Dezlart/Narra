import "dotenv/config";
import { defineConfig } from "prisma/config";

// Serverless development databases may need more than Prisma's 5s default.
// Preserve credentials and any explicit timeout chosen by the owner.
// Prisma 7 CLI uses datasource.url. Runtime PrismaPg still uses DATABASE_URL.
const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
let databaseUrl: URL | undefined;
try { databaseUrl = migrationUrl ? new URL(migrationUrl) : undefined; }
catch { throw new Error("DIRECT_URL / DATABASE_URL must be a valid PostgreSQL URL."); }
if (databaseUrl && !databaseUrl.searchParams.has("connect_timeout")) databaseUrl.searchParams.set("connect_timeout", "30");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // No fallback credentials. Generation and validation work without a database.
  datasource: { url: databaseUrl?.toString() },
});
