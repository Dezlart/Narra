import { cn } from "@/lib/utils";

// Initials are the default avatar; image uploads belong to a later phase.
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const initials = (name.match(/\p{L}[\p{L}\p{M}]*/gu) ?? ["N"]).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("ru");
  return <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-medium text-foreground", large ? "size-20 text-2xl" : "size-9 text-xs")}>{initials}</span>;
}
