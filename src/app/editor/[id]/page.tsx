import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guards";
import { getArticleDraftById } from "@/features/articles/service";
import { getArticleRevisionHistory, listCategories } from "@/features/articles/queries";
import { idSchema } from "@/features/articles/schemas";
import { ArticleError } from "@/features/articles/errors";
import { ArticleEditor } from "@/features/articles/article-editor";
import { ArticleWorkflowActions, HistoryLink, WorkflowStatus } from "@/features/articles/workflow-status";
import { storageConfigured } from "@/features/articles/images";
export const metadata: Metadata = { title: "Редактор", robots: { index: false, follow: false } };
export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePageUser(`/editor/${id}`);
  if (!idSchema.safeParse(id).success) notFound();
  let article;
  try { article = await getArticleDraftById(id); }
  catch (error) { if (error instanceof ArticleError && error.code === "NOT_FOUND") notFound(); throw error; }
  if (!article.draft) {
    const { article: summary } = await getArticleRevisionHistory(id);
    return <main id="main-content" tabIndex={-1} className="page-container py-16"><div className="mx-auto max-w-reading">
    <Link href="/dashboard/articles" className="text-sm text-primary">← Мои статьи</Link><h1 className="my-8 font-editorial text-4xl">{article.locked ? "Редактирование недоступно" : "Новая версия вашей истории"}</h1>
    <p className="mb-8 leading-7 text-muted-foreground">{article.locked ? "Статья в архиве или её версия ожидает решения модератора. Содержимое отправленной версии изменять нельзя." : "Создайте отдельный черновик. Предыдущие версии и опубликованный материал останутся неизменными."}</p>
    <WorkflowStatus status={summary.status} publishedRevisionId={summary.publishedRevisionId} revision={summary.revisions[0]} />
    <div className="mt-8 flex flex-wrap gap-4">{!article.locked && <ArticleWorkflowActions articleId={id} status={summary.status} publishedRevisionId={summary.publishedRevisionId} revision={summary.revisions[0]} />}<HistoryLink articleId={id} /></div>
  </div></main>;
  }
  return <ArticleEditor key={article.draft.revisionId} initial={article.draft} categories={await listCategories()} uploadEnabled={storageConfigured()} />;
}
