import type { InputHTMLAttributes } from "react";

export const inputClass = "w-full rounded-md border border-input bg-card px-3 py-3 text-base outline-offset-2 placeholder:text-muted-foreground disabled:opacity-60";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string };

export function FormField({ label, hint, id, name, ...props }: Props) {
  const fieldId = id ?? name;
  return <div className="space-y-2">
    <label htmlFor={fieldId} className="block text-sm font-medium">{label}</label>
    <input {...props} id={fieldId} name={name} className={inputClass} aria-describedby={hint ? `${fieldId}-hint` : undefined} />
    {hint && <p id={`${fieldId}-hint`} className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
  </div>;
}
