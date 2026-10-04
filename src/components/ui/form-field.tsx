import type { InputHTMLAttributes } from "react";

export const inputClass = "w-full rounded-md border border-input bg-card px-3 py-3 text-base outline-offset-2 placeholder:text-muted-foreground disabled:opacity-60";
export const fieldClass = "w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string };

export function FormField({ label, hint, error, id, name, ...props }: Props) {
  const fieldId = id ?? name;
  return <div className="space-y-2">
    <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
    <input {...props} id={fieldId} name={name} className={inputClass} aria-invalid={Boolean(error)} aria-describedby={[hint && `${fieldId}-hint`, error && `${fieldId}-error`, props["aria-describedby"]].filter(Boolean).join(" ") || undefined} />
    {hint && <p id={`${fieldId}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    {error && <p id={`${fieldId}-error`} className="text-sm text-destructive">{error}</p>}
  </div>;
}
