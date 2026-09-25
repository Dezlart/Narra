"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createDraftAction, createRevisionAction, deleteDraftAction } from "./actions";
export function CreateDraftButton({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <div><Button disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const result = articleId ? await createRevisionAction(articleId) : await createDraftAction();
      if (!result.ok) { setError(result.message); setPending(false); return; }
      router.push(`/editor/${result.value.articleId}`);
    } catch { setError("Не удалось создать черновик. Попробуйте снова."); setPending(false); }
  }}>{pending ? "Создаём черновик…" : articleId ? "Создать новую версию" : "Создать черновик"}</Button>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</div>;
}
export function DeleteDraftButton({ articleId, revisionId, editVersion, published }: { articleId: string; revisionId: string; editVersion: number; published: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  return <div><Button variant="ghost" size="sm" disabled={pending} onClick={async () => {
    if (!window.confirm(published ? "Удалить новую черновую версию? Опубликованная статья сохранится." : "Удалить этот черновик? Восстановить его будет нельзя.")) return;
    setPending(true); setError("");
    try {
      const result = await deleteDraftAction({ articleId, revisionId, editVersion });
      if (!result.ok) setError(result.message); else router.refresh();
    } catch { setError("Не удалось удалить черновик. Попробуйте снова."); }
    finally { setPending(false); }
  }}>{pending ? "Удаляем…" : "Удалить черновик"}</Button>{error && <p role="alert" className="mt-2 max-w-xs text-xs text-destructive">{error}</p>}</div>;
}
