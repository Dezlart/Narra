import { z } from "zod";
import { idSchema } from "@/features/articles/schemas";
export const COMMENT_PAGE_SIZE = 10;
export const REPLY_PAGE_SIZE = 5;
export const commentContentSchema = z.string().max(4000, "Комментарий слишком длинный.").trim()
  .min(1, "Напишите комментарий.").max(2000, "Комментарий — не более 2000 символов.")
  .refine((value) => value.replace(/[\s\u200B-\u200D\uFEFF]/gu, "").length > 0, "Напишите комментарий.")
  .refine((value) => !value.includes("\u0000"), "Комментарий содержит недопустимый символ.");
export const createCommentSchema = z.strictObject({ articleId: idSchema, parentId: idSchema.nullable().default(null),
  content: commentContentSchema, requestId: z.uuid("Некорректный идентификатор отправки.") });
export const commentIdSchema = z.strictObject({ commentId: idSchema });
export const repliesSchema = z.strictObject({ articleId: idSchema, parentId: idSchema, page: z.number().int().min(1).max(1000) });
