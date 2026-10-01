import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAdmin } from "@/lib/auth/guards";
import { getAdminArticle } from "@/features/admin/queries";
import { AdminPage, Table, Pager, date } from "@/features/admin/ui";
import { ArticleStateControl } from "@/features/admin/forms";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params; await requirePageAdmin(`/admin/articles/${id}`);
  const result = await getAdminArticle(id, (await searchParams).page); if (!result) notFound(); const a = result.article;
  return <AdminPage title={a.publishedRevision?.title || a.revisions[0]?.title || "История статьи"} description="История доступна только ADMIN. Текст чужих черновиков нельзя менять через редактор.">
    <p>{a.status} · Автор: {a.author.name} {a.author.username && <Link className="text-primary" href={`/profile/${a.author.username}`}>@{a.author.username}</Link>}</p>
    <p className="mt-3">Опубликованная версия: {a.publishedRevision?.version ?? "—"} · {a.publishedRevision?.status ?? "Нет"}</p>
    {a.status === "PUBLISHED" && a.slug && <Link className="my-3 inline-block text-primary underline" href={`/articles/${a.slug}`}>Открыть публичную статью</Link>}
    {a.publishedRevision?.status === "APPROVED" && <ArticleStateControl articleId={a.id} archived={a.status === "ARCHIVED"} />}
    <Table caption="История версий" labels={["Версия", "Заголовок", "Состояние", "Дата / решение"]}>{result.items.map((r) => <tr key={r.id}><td>{r.version}{r.id === a.publishedRevisionId && " · опубликованная"}</td><td>{r.title || "Без заголовка"}</td><td>{r.status}{r.status !== "DRAFT" && <Link className="mt-2 block text-primary underline" href={`/admin/moderation/${r.id}`}>Открыть snapshot</Link>}</td><td>{date(r.createdAt)}<br />{r.rejectionReason}</td></tr>)}</Table><Pager {...result} />
  </AdminPage>;
}
