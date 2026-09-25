"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, inputClass } from "@/components/ui/form-field";
import { saveProfile } from "./actions";
import type { ProfileInput } from "./schemas";

export function ProfileForm({ profile }: { profile: ProfileInput }) {
  const [state, action, pending] = useActionState(saveProfile, { success: false, message: "" });
  return <form action={action} className="space-y-6">
    <fieldset disabled={pending} className="space-y-5">
      <FormField name="name" label="Имя" defaultValue={profile.name} required minLength={2} maxLength={80} autoComplete="name" />
      <FormField name="username" label="Username" defaultValue={profile.username} required minLength={3} maxLength={30} autoComplete="username" autoCapitalize="none" spellCheck={false} hint="3–30 символов: латинские буквы, цифры и подчёркивание. При изменении поменяется ссылка на профиль." />
      <div className="space-y-2">
        <label htmlFor="bio" className="block text-sm font-medium">О себе</label>
        <textarea id="bio" name="bio" defaultValue={profile.bio} maxLength={500} rows={5} className={inputClass} aria-describedby="bio-hint" />
        <p id="bio-hint" className="text-xs text-muted-foreground">До 500 символов. Расскажите о том, что вам интересно.</p>
      </div>
    </fieldset>
    {state.message && <p role={state.success ? "status" : "alert"} className={`rounded-md border p-3 text-sm ${state.success ? "border-border bg-accent" : "border-destructive/30 text-destructive"}`}>{state.message}</p>}
    <Button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить изменения"}</Button>
  </form>;
}
