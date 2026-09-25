"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { authClient } from "@/lib/auth/client";
import { registrationFormSchema, safeReturnTo, signInSchema } from "./schemas";

const errorMessages: Record<string, string> = {
  USERNAME_TAKEN: "Этот username уже занят. Выберите другой.",
  USER_ALREADY_EXISTS: "Этот email уже зарегистрирован. Попробуйте войти.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Этот email уже зарегистрирован. Попробуйте войти.",
  INVALID_EMAIL_OR_PASSWORD: "Неверный email или пароль.",
  ACCOUNT_BANNED: "Доступ к аккаунту ограничен.",
  TOO_MANY_REQUESTS: "Слишком много попыток. Подождите минуту.",
  FAILED_TO_CREATE_USER: "Не удалось создать аккаунт. Возможно, email или username уже занят.",
};

export function AuthForm({ mode, returnTo = "/dashboard" }: { mode: "login" | "register"; returnTo?: string }) {
  const registering = mode === "register";
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (registering ? registrationFormSchema : signInSchema).safeParse(input);
    if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
    setPending(true);
    try {
      const result = registering
        ? await authClient.signUp.email(registrationFormSchema.parse(input))
        : await authClient.signIn.email({ ...signInSchema.parse(input), callbackURL: safeReturnTo(returnTo) });
      if (result.error) {
        setMessage(errorMessages[result.error.code ?? ""] ?? (result.error.status === 429 ? errorMessages.TOO_MANY_REQUESTS : "Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз."));
        setPending(false);
        return;
      }
      // Full navigation discards any previously cached private RSC payloads.
      window.location.assign(registering ? "/dashboard" : safeReturnTo(returnTo));
    } catch {
      setMessage("Не удалось связаться с сервером. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6">
    <fieldset disabled={pending} className="space-y-5">
      {registering && <>
        <FormField name="name" label="Имя" autoComplete="name" required minLength={2} maxLength={80} />
        <FormField name="username" label="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={30} hint="3–30 символов: латинские буквы, цифры и подчёркивание." />
      </>}
      <FormField name="email" label="Email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} />
      <FormField name="password" label="Пароль" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 12 : 1} maxLength={128} hint={registering ? "От 12 до 128 символов." : undefined} />
      {registering && <FormField name="confirmPassword" label="Подтвердите пароль" type="password" autoComplete="new-password" required maxLength={128} />}
    </fieldset>
    {message && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <><LoaderCircle aria-hidden="true" className="animate-spin" /> Подождите…</> : <>{registering ? "Создать аккаунт" : "Войти"} <ArrowRight aria-hidden="true" /></>}
    </Button>
    <p className="text-center text-sm text-muted-foreground">
      {registering ? "Уже есть аккаунт? " : "Ещё нет аккаунта? "}
      <Link className="font-medium text-primary underline-offset-4 hover:underline" href={registering ? "/login" : "/register"}>{registering ? "Войти" : "Зарегистрироваться"}</Link>
    </p>
  </form>;
}
