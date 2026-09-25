import type { Metadata } from "next";
import Link from "next/link";
import { PenLine, ArrowUpRight } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { listOwnArticles } from "@/features/articles/queries";
import { DeleteDraftButton } from "@/features/articles/draft-buttons";
export const metadata: Metadata = { title: "Мои статьи", robots: { index: false, follow: false } };
const statuses = { DRAFT: "Черновик", PENDING: "На модерации", APPROVED: "Одобрено", REJECTED: "Отклонено" };
export default async function ArticlesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("/dashboard/articles");
  const result = await listOwnArticles(Number((await searchParams).page ?? 1));
  return <main id="main-content" tabIndex={-1} className="page-container py-10 sm:py-16"><PrivatePageLifecycle />
    <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary">← Личный кабинет</Link>
    <div className="mb-10 mt-8 flex flex-wrap items-end justify-between gap-6"><div><p className="eyebrow mb-3 text-primary">Кабинет автора</p><h1 className="font-editorial text-4xl tracking-tight sm:text-5xl">Мои статьи</h1><p className="mt-4 text-muted-foreground">Ваши мысли, которым предстоит стать историями.</p></div><Button asChild><Link href="/editor/new"><PenLine /> Написать статью</Link></Button></div>
    {!result.articles.length ? <section className="border-y border-border py-20 text-center"><PenLine className="mx-auto mb-6 size-9 text-primary" /><h2 className="font-editorial text-2xl">{result.page === 1 ? "Первая история ещё впереди" : "На этой странице нет статей"}</h2><p className="mx-auto mb-8 mt-4 max-w-md leading-7 text-muted-foreground">{result.page === 1 ? "У вас пока нет статей. Создайте свою первую публикацию в Narra." : "Вернитесь к началу списка."}</p><Button asChild variant="outline"><Link href={result.page === 1 ? "/editor/new" : "/dashboard/articles"}>{result.page === 1 ? "Начать писать" : "К первым статьям"}<ArrowUpRight /></Link></Button></section>
      : <ul className="border-t border-border">{result.articles.map((article) => {
        const revision = article.revisions[0];
        return <li key={article.id} className="flex flex-col justify-between gap-5 border-b border-border py-7 sm:flex-row sm:items-center"><div className="min-w-0"><div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="text-primary">{article.status === "ARCHIVED" ? "В архиве" : revision ? statuses[revision.status] : "Без черновика"}{article.publishedRevisionId ? " · Есть опубликованная версия" : ""}</span><time dateTime={article.updatedAt.toISOString()}>{article.updatedAt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</time></div><h2 className="break-words font-editorial text-2xl">{revision?.title.trim() || "Без названия"}</h2></div><div className="flex shrink-0 flex-wrap items-center gap-2"><Button asChild variant="outline" size="sm"><a href={`/editor/${article.id}`}>{revision?.status === "DRAFT" ? "Редактировать" : "Открыть"}</a></Button>{article.status !== "ARCHIVED" && revision?.status === "DRAFT" && <DeleteDraftButton articleId={article.id} revisionId={revision.id} editVersion={revision.editVersion} published={!!article.publishedRevisionId} />}</div></li>;
      })}</ul>}
    <nav aria-label="Страницы статей" className="mt-8 flex justify-between text-sm">{result.page > 1 ? <Link href={`/dashboard/articles?page=${result.page - 1}`}>← Назад</Link> : <span />}{result.hasNext && <Link href={`/dashboard/articles?page=${result.page + 1}`}>Далее →</Link>}</nav>
  </main>;
}
