"use client";
import { fieldClass } from "@/components/ui/form-field";
import Link from "next/link";
import { useId, useState } from "react";
import { MutationForm } from "@/components/ui/mutation-form";
import { createReportAction } from "./actions";
import { reportReasons } from "./schemas";
import type { Viewer } from "@/features/social/social-button";
export function ReportButton({ targetId, targetType, viewer, path }: { targetId: string; targetType: "ARTICLE" | "COMMENT"; viewer: Viewer; path: string }) {
  const id = useId(), [sent, setSent] = useState(false);
  if (viewer === "guest") return <Link className="inline-flex min-h-11 items-center text-xs text-muted-foreground hover:text-primary" href={`/login?returnTo=${encodeURIComponent(path)}`}>Войти, чтобы пожаловаться</Link>;
  if (viewer === "banned") return null;
  return <details className="my-2 max-w-lg"><summary className="cursor-pointer py-2 text-xs text-muted-foreground">Пожаловаться</summary>
    {sent ? <p role="status" className="py-3 text-sm text-primary">Жалоба принята. Модератор рассмотрит её.</p> : <MutationForm label="Отправить жалобу" submit={async (data) => {
      const result = await createReportAction({ targetId, targetType, reason: data.get("reason"), description: data.get("description") });
      if (result.ok) setSent(true); return result;
    }}><label htmlFor={`${id}-reason`} className="block text-sm">Причина жалобы</label><select id={`${id}-reason`} name="reason" className={fieldClass}>{Object.entries(reportReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor={`${id}-description`} className="block text-sm">Описание (для «Другое» обязательно)</label><textarea id={`${id}-description`} name="description" maxLength={2000} rows={3} className={fieldClass} />
    </MutationForm>}
  </details>;
}
