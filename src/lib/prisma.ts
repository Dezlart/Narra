import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  narraPrisma: PrismaClient | undefined;
};

let client: PrismaClient | undefined;

/** Lazy initialization keeps the presentation-only foundation independent of DB credentials. */
export function getPrisma(): PrismaClient {
  if (client) return client;
  if (globalForPrisma.narraPrisma) return globalForPrisma.narraPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access the database.");
  }

  const adapter = new PrismaPg({ connectionString });
  client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.narraPrisma = client;
  }

  return client;
}
