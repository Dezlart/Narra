import { z } from "zod";
import { draftFieldsSchema, idSchema } from "@/features/articles/schemas";
import { documentImages, validDocument, type RichNode } from "@/features/articles/content";

function textContent(node: RichNode): string {
  return (node.text ?? "") + (node.content ?? []).map(textContent).join(" ");
}
export const publicationSchema = draftFieldsSchema.extend({
  title: z.string().trim().min(5, "Заголовок — от 5 до 180 символов.").max(180),
  excerpt: z.string().trim().min(10, "Добавьте описание: от 10 до 500 символов.").max(500),
  categoryId: idSchema,
}).superRefine((value, ctx) => {
  if (!validDocument(value.content)) return;
  const text = textContent(value.content).replace(/[\s\u200B-\u200D\uFEFF]/gu, "");
  if (text.length < 40 && !documentImages(value.content).length) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Добавьте содержимое: минимум 40 непробельных символов или изображение в тексте." });
  }
});
export const submitSchema = z.strictObject({
  articleId: idSchema, revisionId: idSchema, editVersion: z.number().int().min(0).max(2147483646),
});
export const reviewSchema = z.strictObject({ revisionId: idSchema });
export const rejectionReasonSchema = z.string().trim().min(5, "Укажите причину: от 5 до 2000 символов.").max(2000, "Причина — не более 2000 символов.");
export const rejectSchema = reviewSchema.extend({ reason: rejectionReasonSchema });
