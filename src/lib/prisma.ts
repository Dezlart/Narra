import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  narraPrisma: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

/** Lazy initialization allows generation and build without opening a DB connection. */
export function getPrisma(): PrismaClient {
  if (client) return client;
  if (globalForPrisma.narraPrisma) return globalForPrisma.narraPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 15000, idleTimeoutMillis: 60000, keepAlive: true });
  client = new PrismaClient({ adapter });

  // Route handlers and RSC bundles may each load this module. Share one pool
  // across them in production too, not only across development hot reloads.
  globalForPrisma.narraPrisma = client;

  return client;
}
