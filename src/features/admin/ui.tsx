import Link from "next/link";
import type { ReactNode } from "react";
import type { QueryParams } from "./queries";
export function AdminPage({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main id="main-content" tabIndex={-1} className="page-container min-w-0 py-10 sm:py-14"><h1 className="break-words font-editorial text-3xl sm:text-5xl">{title}</h1>
    {description && <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">{description}</p>}<div className="mt-8 min-w-0">{children}</div></main>;
}
export function Table({ labels, children, caption }: { labels: string[]; children: ReactNode; caption: string }) {
  return <div><p className="mb-3 text-xs leading-5 text-muted-foreground">{caption} · На узком экране прокрутите таблицу в сторону.</p><div tabIndex={0} role="region" aria-label={caption} className="max-w-full overflow-x-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-primary"><table className="w-full min-w-160 text-left text-sm">
    <caption className="sr-only">{caption}</caption>
    <thead className="bg-muted"><tr>{labels.map((label) => <th scope="col" className="p-4 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border [&_td]:max-w-80 [&_td]:break-words [&_td]:p-4 [&_td]:align-top">{children}</tbody>
  </table></div></div>;
}
export function Pager({ page, hasNext, params = {} }: { page: number; hasNext: boolean; params?: QueryParams }) {
  const href = (n: number) => { const query = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v.length <= 120) query.set(k, v); query.set("page", String(n)); return `?${query}`; };
  return <nav aria-label="Страницы результатов" className="mt-6 flex flex-wrap items-center gap-5 text-sm"><span>Страница {page}</span>{page > 1 && <Link className="py-3 text-primary" href={href(page - 1)}>← Назад</Link>}{hasNext && <Link className="py-3 text-primary" href={href(page + 1)}>Далее →</Link>}</nav>;
}
export function Empty({ count }: { count: number }) { return count === 0 ? <p className="py-10 text-muted-foreground">Ничего не найдено.</p> : null; }
export const date = (value: Date | null) => value ? new Intl.DateTimeFormat("ru", { dateStyle: "medium", timeZone: "UTC" }).format(value) : "—";
