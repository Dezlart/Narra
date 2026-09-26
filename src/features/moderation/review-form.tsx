"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";
import { approveRevisionAction, rejectRevisionAction } from "./actions";
import { rejectionReasonSchema } from "./schemas";
export function ReviewForm({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState(""), [pending, setPending] = useState(false), [error, setError] = useState("");
  async function decide(approve: boolean) {
    setError("");
    const parsed = rejectionReasonSchema.safeParse(reason);
    if (!approve && !parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (!window.confirm(approve ? "Одобрить и опубликовать эту версию? Решение нельзя отменить повторным рассмотрением." : "Отклонить эту версию с указанной причиной?")) return;
    setPending(true);
    try {
      const result = approve ? await approveRevisionAction({ revisionId }) : await rejectRevisionAction({ revisionId, reason });
      if (!result.ok) setError(result.message);
      router.refresh();
    } catch { setError("Не удалось получить результат. Обновите страницу, чтобы проверить, сохранено ли решение."); }
    finally { setPending(false); }
  }
  return <section aria-label="Решение модератора" className="mt-12 space-y-5 border-t border-border pt-8">
    <h2 className="font-editorial text-2xl">Решение по этой версии</h2>
    <p className="text-sm leading-6 text-muted-foreground">Одобрение сделает эту версию текущей опубликованной. При отклонении прежняя публикация сохранится.</p>
    <Button disabled={pending} onClick={() => void decide(true)}>{pending ? "Сохраняем решение…" : "Одобрить и опубликовать"}</Button>
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void decide(false); }}>
      <label htmlFor="rejection-reason" className="block text-sm font-medium">Причина отклонения</label>
      <textarea id="rejection-reason" required minLength={5} maxLength={2000} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} className={`${inputClass} resize-y`} placeholder="Объясните автору, что нужно исправить…" />
      <Button variant="outline" type="submit" disabled={pending}>Отклонить версию</Button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
