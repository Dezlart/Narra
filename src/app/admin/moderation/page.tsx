import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePageModerator } from "@/lib/auth/guards";
import { getPendingModerationQueue } from "@/features/moderation/queries";
import { formatDate } from "@/features/articles/workflow-status";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
export const metadata: Metadata = { title: "Модерация", robots: { index: false, follow: false } };
async function Queue({ page }: { page: number }) {
  const result = await getPendingModerationQueue(page);
  return <>{!result.revisions.length ? <div className="border-y border-border py-20 text-center"><h2 className="font-editorial text-2xl">{result.page === 1 ? "Всё рассмотрено" : "На этой странице заявок нет"}</h2><p className="mt-3 text-muted-foreground">{result.page === 1 ? "Новые материалы появятся здесь после отправки авторами." : "Вернитесь к началу очереди."}</p></div>
    : <ul className="divide-y divide-border border-y border-border">{result.revisions.map((revision) => <li key={revision.id} className="grid gap-4 py-6 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="eyebrow mb-3 text-primary">{revision.article.publishedRevisionId ? "Обновление публикации" : "Первая публикация"} · Версия {revision.version}</p><h2 className="break-words font-editorial text-2xl"><Link className="hover:text-primary" href={`/admin/moderation/${revision.id}`}>{revision.title}</Link></h2><p className="mt-3 text-sm text-muted-foreground">{revision.article.author.name}{revision.article.author.username && ` · @${revision.article.author.username}`} · {revision.category?.name ?? "Без категории"}</p><p className="mt-2 text-xs text-muted-foreground">Отправлено {formatDate(revision.submittedAt)}</p></div><Link href={`/admin/moderation/${revision.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Рассмотреть →</Link></li>)}</ul>}
    <nav aria-label="Страницы очереди" className="mt-8 flex justify-between text-sm">{result.page > 1 ? <Link href={`?page=${result.page - 1}`}>← Назад</Link> : <span />}{result.hasNext && <Link href={`?page=${result.page + 1}`}>Далее →</Link>}</nav></>;
}
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageModerator("/admin/moderation");
  const page = Number((await searchParams).page ?? 1);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle />
    <Link href="/dashboard" className="text-sm text-muted-foreground">← Личный кабинет</Link><p className="eyebrow mb-3 mt-10 text-primary">Редакция Narra</p><h1 className="font-editorial text-4xl sm:text-5xl">Очередь модерации</h1><p className="mb-10 mt-5 max-w-prose leading-7 text-muted-foreground">Истории, готовые к вашему вниманию. Сначала показываем самые ранние заявки.</p>
    <Suspense fallback={<p role="status" className="py-12 text-muted-foreground">Загружаем очередь…</p>}><Queue page={page} /></Suspense>
  </main>;
}
