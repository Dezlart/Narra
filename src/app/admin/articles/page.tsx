import { fieldClass } from "@/components/ui/form-field";
import Link from "next/link";
import { requirePageAdmin } from "@/lib/auth/guards";
import { listAdminArticles, single, type QueryParams } from "@/features/admin/queries";
import { AdminPage, Table, Pager, Empty, date } from "@/features/admin/ui";

import { Button } from "@/components/ui/button";
export default async function Page({ searchParams }: { searchParams: Promise<QueryParams> }) {
  await requirePageAdmin("/admin/articles"); const p = await searchParams, result = await listAdminArticles(p);
  return <AdminPage title="Все статьи" description="Публикации, рабочие версии и архив. Административные действия не редактируют авторский текст.">
    <form className="mb-6 grid gap-3 sm:grid-cols-4"><label className="text-sm">Заголовок или username<input name="q" maxLength={120} defaultValue={single(p.q)} className={fieldClass} /></label>
    <label className="text-sm">Username автора (точно)<input name="author" maxLength={120} defaultValue={single(p.author)} className={fieldClass} /></label>
    <label className="text-sm">Статус<select name="status" defaultValue={single(p.status)} className={fieldClass}><option value="">Все</option>{["DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => <option key={s}>{s}</option>)}</select></label><Button type="submit" className="self-end">Найти</Button></form>
    <Table caption="Статьи платформы" labels={["Статья", "Автор", "Состояние", "Даты"]}>{result.items.map((a) => <tr key={a.id}><td><Link className="text-primary underline" href={`/admin/articles/${a.id}`}>{a.publishedRevision?.title || a.revisions[0]?.title || "Без заголовка"}</Link></td><td>{a.author.name}<br />@{a.author.username}</td><td>{a.status}<br />{a.status === "PUBLISHED" ? "Публичная" : "Непубличная"}<br />Последняя версия: {a.revisions[0]?.status ?? "—"}</td><td>Публикация: {date(a.publishedAt)}<br />Обновлена: {date(a.updatedAt)}</td></tr>)}</Table><Empty count={result.items.length} /><Pager {...result} params={p} />
  </AdminPage>;
}
