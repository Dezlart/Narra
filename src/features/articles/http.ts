import { ZodError } from "zod";
import { AuthorizationError } from "@/features/auth/permissions";
import { ArticleError } from "./errors";
export function articleHttpError(error: unknown) {
  const status = error instanceof AuthorizationError ? (error.code === "UNAUTHENTICATED" ? 401 : 403) : error instanceof ZodError ? 400 : error instanceof ArticleError ? ({ NOT_FOUND: 404, LOCKED: 409, CONFLICT: 409, INVALID_IMAGE: 400, STORAGE: 503, LIMIT: 429 } as const)[error.code] : 500;
  const message = error instanceof ArticleError ? error.message : "Не удалось выполнить запрос. Проверьте вход и попробуйте снова.";
  return Response.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
