"use client";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "./button";

type Result = { ok: boolean; message?: string };
export function MutationForm({ children, submit, label, confirmation }: { children?: ReactNode; submit: (data: FormData) => Promise<Result>; label: string; confirmation?: string }) {
  const [pending, start] = useTransition(), [message, setMessage] = useState(""), [failed, setFailed] = useState(false);
  return <form className="my-3 space-y-3" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (confirmation && !window.confirm(confirmation)) return;
    setMessage(""); start(async () => {
      try { const result = await submit(data); setFailed(!result.ok); setMessage(result.ok ? "Сохранено." : result.message ?? "Не удалось сохранить."); }
      catch { setFailed(true); setMessage("Не удалось сохранить. Проверьте соединение и повторите."); }
    });
  }}><fieldset disabled={pending} className="min-w-0 space-y-3">{children}<Button type="submit" variant="outline" disabled={pending}>{pending ? "Сохраняем…" : label}</Button></fieldset>
    {message && <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-destructive" : "text-primary"}`}>{message}</p>}
  </form>;
}
