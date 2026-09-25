import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase()
  .min(3, "Username должен содержать от 3 до 30 символов.")
  .max(30, "Username должен содержать от 3 до 30 символов.")
  .regex(/^[a-z0-9][a-z0-9_]*$/, "Используйте латинские буквы, цифры и подчёркивание.");

export const nameSchema = z.string().trim().min(2, "Введите имя: от 2 до 80 символов.").max(80, "Имя не длиннее 80 символов.");
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Введите корректный email.").max(254));
export const passwordSchema = z.string().min(12, "Пароль должен содержать не менее 12 символов.").max(128, "Пароль не длиннее 128 символов.");

export const signUpSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const registrationFormSchema = signUpSchema.extend({
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Пароли не совпадают.", path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введите пароль.").max(128, "Пароль слишком длинный."),
});

/** Only implemented internal destinations; rejects protocol-relative/encoded URLs. */
export function safeReturnTo(value: unknown): string {
  return typeof value === "string" && (["/", "/dashboard", "/dashboard/settings", "/dashboard/articles", "/editor/new"].includes(value) || /^\/editor\/[a-zA-Z0-9_-]{1,80}$/.test(value))
    ? value : "/dashboard";
}
