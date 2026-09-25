import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 }) });
const categories = [
  { slug: "technology", name: "Технологии" }, { slug: "development", name: "Разработка" },
  { slug: "design", name: "Дизайн" }, { slug: "business", name: "Бизнес" },
  { slug: "science", name: "Наука" }, { slug: "other", name: "Другое" },
];
try {
  for (const category of categories) await prisma.category.upsert({ where: { slug: category.slug }, create: category, update: {} });
  console.log("Базовые категории готовы. Существующие записи сохранены.");
} catch { console.error("Не удалось подготовить категории. Проверьте development DATABASE_URL и миграции."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
