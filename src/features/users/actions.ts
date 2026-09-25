"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AuthorizationError } from "@/features/auth/permissions";
import { updateOwnProfile, UsernameTakenError } from "./service";
import type { ProfileState } from "./schemas";

export async function saveProfile(_previous: ProfileState, form: FormData): Promise<ProfileState> {
  try {
    const input = Object.fromEntries([...form.entries()].filter(([key]) => !key.startsWith("$ACTION_")));
    const result = await updateOwnProfile(input);
    if (result.previousUsername) revalidatePath(`/profile/${result.previousUsername}`);
    revalidatePath(`/profile/${result.username}`);
    revalidatePath("/", "layout");
    return { success: true, message: "Профиль сохранён." };
  } catch (error) {
    if (error instanceof ZodError) return { success: false, message: error.issues[0].code === "unrecognized_keys" ? "Форма содержит недопустимые поля." : error.issues[0].message };
    if (error instanceof UsernameTakenError) return { success: false, message: error.message };
    if (error instanceof AuthorizationError) return { success: false, message: "Нет доступа. Войдите в активный аккаунт." };
    // Database details and submitted values must not reach the response or logs.
    return { success: false, message: "Не удалось сохранить профиль. Попробуйте ещё раз." };
  }
}
