import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { z } from "zod";

class CommandError extends Error {}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== "--email" || args[2] !== "--confirm") {
    throw new CommandError("Usage: npm run admin:promote -- --email <registered-owner-email> --confirm");
  }
  const email = z.email().parse(args[1].trim().toLowerCase());
  if (!process.env.DATABASE_URL) throw new CommandError("DATABASE_URL is required.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isBanned: true } });
    if (!user || user.isBanned) throw new CommandError("An existing, active registered account is required.");
    const credentials = await prisma.account.count({ where: { userId: user.id, providerId: "credential" } });
    if (!credentials) throw new CommandError("Register the owner's account before promotion.");
    const result = await prisma.user.updateMany({ where: { id: user.id, email, isBanned: false }, data: { role: "ADMIN" } });
    if (result.count !== 1) throw new CommandError("Account changed; promotion cancelled.");
    console.info("ADMIN assigned to the explicitly selected account. No new account was created.");
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  // Only our own operational messages are public; do not print Prisma errors.
  if (error instanceof CommandError) console.error(error.message);
  else console.error("Promotion failed. Check the arguments and development database configuration.");
  process.exitCode = 1;
});
