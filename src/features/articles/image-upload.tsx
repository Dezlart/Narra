"use client";
import { useId, useState } from "react";
export function ImageUpload({ articleId, label, disabled, onUpload, onBusy }: {
  articleId: string; label: string; disabled?: boolean; onUpload: (src: string) => void; onBusy: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <input id={id} type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy}
      className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-3 file:text-foreground disabled:opacity-60"
      onChange={async (event) => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (!file) return;
        if (file.size > 3 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("JPEG, PNG или WebP до 3 МБ."); return; }
        setBusy(true); onBusy(true); setError("");
        try {
          const response = await fetch(`/api/articles/${articleId}/images`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
          const result: { src?: string; message?: string } = await response.json();
          if (!response.ok || !result.src) throw new Error(result.message ?? "Загрузка не удалась.");
          onUpload(result.src);
        } catch (error) { setError(error instanceof Error ? error.message : "Не удалось загрузить изображение."); }
        finally { setBusy(false); onBusy(false); }
      }} />
    {busy && <p role="status" className="text-sm text-muted-foreground">Загружаем изображение…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
