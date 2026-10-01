import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { AuthorizationError } from "@/features/auth/permissions";

export class SocialError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "INVALID_PARENT" | "RATE_LIMIT" | "CONFLICT" | "FORBIDDEN", message: string) { super(message); }
}
export function socialErrorMessage(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "Такая запись уже существует. Проверьте уникальный адрес или обновите страницу.";
  if (error instanceof SocialError) return error.message;
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Проверьте введённые данные.";
  if (error instanceof AuthorizationError) return error.code === "BANNED" ? "Действия этого аккаунта ограничены."
    : error.code === "UNAUTHENTICATED" ? "Войдите, чтобы выполнить действие." : "Недостаточно прав для этого действия.";
  return "Не удалось сохранить изменения. Проверьте соединение и попробуйте снова.";
}
