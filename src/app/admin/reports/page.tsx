import Link from "next/link";
import { requirePageModerator } from "@/lib/auth/guards";
import { listReports } from "@/features/reports/queries";
import { reportReasons } from "@/features/reports/schemas";
import { single, type QueryParams } from "@/features/admin/queries";
import { AdminPage, Table, Pager, Empty, date } from "@/features/admin/ui";
import { fieldClass } from "@/features/admin/forms";
import { Button } from "@/components/ui/button";
export default async function Page({ searchParams }: { searchParams: Promise<QueryParams> }) {
  await requirePageModerator("/admin/reports"); const p = await searchParams, result = await listReports(p);
  return <AdminPage title="Жалобы" description="По умолчанию — открытые жалобы, сначала наиболее ранние. Архивирование статей доступно ADMIN; скрытие комментариев — также MODERATOR.">
    <form className="mb-6 flex flex-wrap items-end gap-3"><label className="text-sm">Статус<select name="status" defaultValue={single(p.status) || "OPEN"} className={fieldClass}><option value="ALL">Все</option><option value="OPEN">Открыта</option><option value="RESOLVED">Решена</option><option value="DISMISSED">Отклонена</option></select></label>
    <label className="text-sm">Материал<select name="targetType" defaultValue={single(p.targetType)} className={fieldClass}><option value="">Все</option><option value="ARTICLE">Статья</option><option value="COMMENT">Комментарий</option></select></label><Button type="submit">Применить</Button></form>
    <Table caption="Очередь жалоб" labels={["Материал", "Причина", "Заявитель", "Статус / дата"]}>{result.items.map((r) => <tr key={r.id}><td><Link className="text-primary underline" href={`/admin/reports/${r.id}`}>{r.targetType === "ARTICLE" ? r.article?.publishedRevision?.title || "Статья недоступна" : "Комментарий"}</Link></td><td>{reportReasons[r.reason]}</td><td>{r.reporter.name}<br />@{r.reporter.username}</td><td>{r.status}<br />{date(r.createdAt)}</td></tr>)}</Table><Empty count={result.items.length} /><Pager {...result} params={p} />
  </AdminPage>;
}
