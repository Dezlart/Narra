import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageModerator } from "@/lib/auth/guards";
import { getReport } from "@/features/reports/queries";
import { reportReasons } from "@/features/reports/schemas";
import { AdminPage, date } from "@/features/admin/ui";
import { ReportReviewForm } from "@/features/admin/forms";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const actor = await requirePageModerator(`/admin/reports/${id}`), r = await getReport(id); if (!r) notFound();
  const article = r.article ?? r.comment?.article;
  return <AdminPage title="Рассмотрение жалобы"><div className="max-w-3xl space-y-5"><p>{r.status} · {r.targetType} · {date(r.createdAt)}</p><p>Заявитель: {r.reporter.name} (@{r.reporter.username})</p>
    <h2 className="font-editorial text-2xl">{reportReasons[r.reason]}</h2><p className="whitespace-pre-wrap break-words text-sm leading-7">{r.description || "Без описания."}</p>
    <section className="rounded-md border border-border bg-card p-5"><h2 className="font-medium">Материал</h2><p className="mt-3 break-words">{r.article?.publishedRevision?.title}</p>
      {r.article?.publishedRevision && <><p className="mt-3 break-words text-sm leading-7">{r.article.publishedRevision.excerpt}</p><Link className="mt-3 block text-primary underline" href={`/admin/moderation/${r.article.publishedRevision.id}`}>Прочитать сохранённую опубликованную версию</Link></>}
      {r.comment && <><p className="mt-2 text-sm">{r.comment.deletedAt ? "Удалён автором" : r.comment.hiddenAt ? "Скрыт" : "Видимый"} · {r.comment.author.name}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{r.comment.deletedAt ? "Текст удалён." : r.comment.content}</p></>}
      <p className="mt-3 text-sm">Статья: {article?.status ?? "Недоступна"}</p>
      {article?.slug && article.status === "PUBLISHED" && <Link className="mt-3 inline-block text-primary underline" href={`/articles/${article.slug}${r.comment ? "#comments" : ""}`}>Открыть публикацию</Link>}
      {actor.role === "ADMIN" && article && <Link className="mt-3 block text-primary underline" href={`/admin/articles/${article.id}`}>Управление статьёй</Link>}
    </section>
    {r.status === "OPEN" ? <ReportReviewForm reportId={r.id} targetType={r.targetType} admin={actor.role === "ADMIN"} /> : <p className="whitespace-pre-wrap break-words text-sm">Рассмотрел: {r.resolvedBy?.name} · {date(r.resolvedAt)}<br />{r.resolutionNote}</p>}
    </div></AdminPage>;
}
