import { z } from "zod";
import { imageSourcePattern, validDocument } from "./content";
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const tagNameSchema = z.string().trim().transform((v) => v.normalize("NFKC").toLowerCase().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(32).regex(/^[\p{L}\p{N}][\p{L}\p{N} +#.-]*$/u, "Тег содержит неподдерживаемые символы."));
export const draftFieldsSchema = z.strictObject({
  title: z.string().max(180, "Заголовок — не более 180 символов."),
  excerpt: z.string().max(500, "Описание — не более 500 символов."),
  categoryId: idSchema.nullable(),
  tags: z.array(tagNameSchema).max(8, "Не более 8 тегов.").transform((v) => [...new Set(v)]),
  coverImage: z.string().regex(imageSourcePattern).nullable(),
  content: z.custom<import("./content").RichNode>(validDocument, "Некорректный документ, ссылка или изображение. Максимум 100 000 символов."),
});
export const saveDraftSchema = z.strictObject({
  articleId: idSchema, revisionId: idSchema, editVersion: z.number().int().min(0).max(2147483646),
  patch: draftFieldsSchema.partial().refine((v) => Object.keys(v).length > 0, "Нет изменений."),
});
export const deleteDraftSchema = z.strictObject({ articleId: idSchema, revisionId: idSchema, editVersion: z.number().int().min(0) });
export type DraftFields = z.infer<typeof draftFieldsSchema>;
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;
export type DraftView = DraftFields & { articleId: string; revisionId: string; editVersion: number; version: number; published: boolean };
