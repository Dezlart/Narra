"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/features/auth/permissions";
import { ArticleError } from "./errors";
import { createArticleDraft, createDraftRevision, deleteArticleDraft, updateArticleDraft } from "./service";
type Result<T> = { ok: true; value: T } | { ok: false; message: string; conflict: boolean };
async function result<T>(work: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await work() }; }
  catch (error) {
    const message = error instanceof ArticleError ? error.message : error instanceof ZodError ? "Проверьте поля, длину текста, ссылки и изображения. Не более 8 тегов." : error instanceof AuthorizationError ? "Войдите в активный аккаунт, чтобы продолжить." : "Не удалось сохранить изменения. Попробуйте ещё раз.";
    return { ok: false, message, conflict: error instanceof ArticleError && error.code === "CONFLICT" };
  }
}
export async function createDraftAction() { return result(() => createArticleDraft()); }
export async function createRevisionAction(articleId: unknown) { return result(() => createDraftRevision(articleId)); }
export async function saveDraftAction(input: unknown) { return result(() => updateArticleDraft(input)); }
export async function deleteDraftAction(input: unknown) {
  return result(async () => { await deleteArticleDraft(input); revalidatePath("/dashboard/articles"); return null; });
}
