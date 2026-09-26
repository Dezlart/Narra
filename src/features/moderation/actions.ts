"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/features/auth/permissions";
import { ArticleError } from "@/features/articles/errors";
import { approveArticleRevision, rejectArticleRevision, submitArticleForModeration } from "./service";

async function perform<T extends { articleId: string; revisionId: string }>(work: () => Promise<T>) {
  try {
    const value = await work();
    revalidatePath("/dashboard/articles");
    revalidatePath(`/dashboard/articles/${value.articleId}`);
    revalidatePath("/admin/moderation");
    revalidatePath(`/admin/moderation/${value.revisionId}`);
    return { ok: true as const, value };
  } catch (error) {
    const message = error instanceof ArticleError ? error.message
      : error instanceof ZodError ? (error.issues[0]?.path.includes("categoryId") ? "Выберите категорию." : error.issues[0]?.message ?? "Проверьте поля.")
      : error instanceof AuthorizationError ? "У вас нет доступа к этому действию. Войдите в активный аккаунт с нужной ролью."
      : "Не удалось выполнить действие. Проверьте соединение и обновите страницу перед повторной попыткой.";
    return { ok: false as const, message };
  }
}
export async function submitArticleAction(input: unknown) { return perform(() => submitArticleForModeration(input)); }
export async function approveRevisionAction(input: unknown) { return perform(() => approveArticleRevision(input)); }
export async function rejectRevisionAction(input: unknown) { return perform(() => rejectArticleRevision(input)); }
