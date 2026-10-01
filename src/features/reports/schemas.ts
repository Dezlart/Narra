import { z } from "zod";
import { idSchema } from "@/features/articles/schemas";
export const reportReasons = { SPAM: "Спам", HARASSMENT: "Преследование", HATE_OR_ABUSE: "Оскорбления и ненависть", ILLEGAL_OR_DANGEROUS: "Опасный или незаконный контент", PRIVACY: "Нарушение приватности", MISLEADING: "Вводит в заблуждение", OTHER: "Другое" } as const;
export const reportSchema = z.object({ targetType: z.enum(["ARTICLE", "COMMENT"]), targetId: idSchema,
  reason: z.enum(Object.keys(reportReasons) as [keyof typeof reportReasons, ...(keyof typeof reportReasons)[]]),
  description: z.string().trim().max(2000).default("") }).strict().refine((v) => v.reason !== "OTHER" || v.description.length >= 5,
  { path: ["description"], message: "Для другой причины опишите проблему (от 5 символов)." });
export const resolveReportSchema = z.object({ reportId: idSchema, status: z.enum(["RESOLVED", "DISMISSED"]),
  action: z.enum(["NONE", "HIDE_COMMENT", "ARCHIVE_ARTICLE"]), note: z.string().trim().max(2000).default("") }).strict()
  .refine((v) => v.status !== "DISMISSED" || v.action === "NONE", { message: "Отклонение жалобы не меняет контент." });
