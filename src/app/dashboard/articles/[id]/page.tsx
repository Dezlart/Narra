import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guards";
import { getArticleRevisionHistory } from "@/features/articles/queries";
import { idSchema } from "@/features/articles/schemas";
import { ArticleError } from "@/features/articles/errors";
import { ArticleWorkflowActions, formatDate, revisionLabels, WorkflowStatus } from "@/features/articles/workflow-status";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
export const metadata: Metadata = { title: "История версий", robots: { index: false, follow: false } };
export default async function ArticleHistoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  await requirePageUser(`/dashboard/articles/${id}`);
  if (!idSchema.safeParse(id).success) notFound();
  let result;
  try { result = await getArticleRevisionHistory(id, Number((await searchParams).page ?? 1)); }
  catch (error) { if (error instanceof ArticleError && error.code === "NOT_FOUND") notFound(); throw error; }
  const { article } = result, latest = article.revisions[0];
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle /><div className="mx-auto max-w-reading">
    <Link href="/dashboard/articles" className="text-sm text-primary">← Мои статьи</Link>
    <p className="eyebrow mb-3 mt-10 text-muted-foreground">История вашей публикации</p><h1 className="mb-6 break-words font-editorial text-3xl sm:text-4xl">{latest?.title || "Без названия"}</h1>
    <WorkflowStatus status={article.status} publishedRevisionId={article.publishedRevisionId} revision={latest} />
    {article.publishedAt && <p className="mt-3 text-xs text-muted-foreground">Первая публикация: {formatDate(article.publishedAt)}</p>}
    <div className="my-8 flex flex-wrap gap-3"><ArticleWorkflowActions articleId={id} status={article.status} publishedRevisionId={article.publishedRevisionId} revision={latest} /></div>
    <h2 className="mb-5 font-editorial text-2xl">Все версии</h2>
    <ol className="border-t border-border">{result.revisions.map((revision) => <li key={revision.id} className="space-y-3 border-b border-border py-6">
      <div className="flex flex-wrap justify-between gap-3"><h3 className="font-medium">Версия {revision.version} · {revisionLabels[revision.status]}</h3>{revision.id === article.publishedRevisionId && <span className="text-xs text-primary">Текущая опубликованная версия</span>}</div>
      <p className="break-words text-sm">{revision.title || "Без названия"}</p><p className="text-xs text-muted-foreground">Создана {formatDate(revision.createdAt)}{revision.submittedAt && ` · Отправлена ${formatDate(revision.submittedAt)}`}{revision.reviewedAt && ` · Решение ${formatDate(revision.reviewedAt)}`}</p>
      {revision.status === "REJECTED" && <p className="whitespace-pre-wrap break-words border-l-2 border-primary pl-3 text-sm">Причина: {revision.rejectionReason}</p>}
    </li>)}</ol>
    <nav aria-label="Страницы истории" className="mt-8 flex justify-between text-sm">{result.page > 1 ? <Link href={`?page=${result.page - 1}`}>← Назад</Link> : <span />}{result.hasNext && <Link href={`?page=${result.page + 1}`}>Далее →</Link>}</nav>
  </div></main>;
}
