"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { hideCommentAction, restoreCommentAction } from "./actions";
export function CommentModerationButton({ commentId, hidden }: { commentId: string; hidden: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  return <div className="mt-4">
    {confirm ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">{hidden ? "Вернуть комментарий в обсуждение?" : "Скрыть текст от читателей? Ответы останутся."}</p><Button disabled={pending} onClick={() => {
      setError(""); startTransition(async () => {
        try { const result = await (hidden ? restoreCommentAction : hideCommentAction)({ commentId }); if (!result.ok) setError(result.message); else setConfirm(false); }
        catch { setError("Не удалось сохранить изменение. Повторите попытку."); }
      });
    }}>Подтвердить</Button><Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Отмена</Button></div>
      : <Button variant="outline" onClick={() => setConfirm(true)}>{hidden ? "Восстановить" : "Скрыть"}</Button>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </div>;
}
