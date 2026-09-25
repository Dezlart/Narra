import "dotenv/config";
import { defineConfig } from "prisma/config";

// Serverless development databases may need more than Prisma's 5s default.
// Preserve credentials and any explicit timeout chosen by the owner.
const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : undefined;
if (databaseUrl && !databaseUrl.searchParams.has("connect_timeout")) databaseUrl.searchParams.set("connect_timeout", "30");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // No fallback credentials. Generation and validation work without a database.
  datasource: { url: databaseUrl?.toString() },
});
