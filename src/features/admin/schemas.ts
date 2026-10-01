import { z } from "zod";
import { idSchema } from "@/features/articles/schemas";
export const roleSchema = z.enum(["USER", "MODERATOR", "ADMIN"]);
export const userChangeSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("ban"), userId: idSchema, banned: z.boolean() }).strict(),
  z.object({ operation: z.literal("role"), userId: idSchema, role: roleSchema }).strict(),
]);
export const articleStateSchema = z.object({ articleId: idSchema, archived: z.boolean() }).strict();
const categoryFields = { name: z.string().trim().min(2).max(80), description: z.string().trim().max(500) };
export const createCategorySchema = z.object({ ...categoryFields, slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug: латиница, цифры и дефисы.") }).strict();
export const updateCategorySchema = z.object({ ...categoryFields, categoryId: idSchema }).strict();
export const categoryStateSchema = z.object({ categoryId: idSchema, archived: z.boolean() }).strict();
