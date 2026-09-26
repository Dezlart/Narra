import Link from "next/link";
import type { ArticleRevisionStatus, ArticleStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { CreateDraftButton, DeleteDraftButton } from "./draft-buttons";
export const revisionLabels = { DRAFT: "Черновик", PENDING: "На модерации", APPROVED: "Одобрено", REJECTED: "Отклонено" };
export function formatDate(value: Date | null) { return value?.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) ?? "—"; }
type RevisionSummary = { id: string; status: ArticleRevisionStatus; editVersion: number; submittedAt: Date | null; reviewedAt: Date | null; rejectionReason: string | null };
export function WorkflowStatus({ status, publishedRevisionId, revision }: { status: ArticleStatus; publishedRevisionId: string | null; revision?: RevisionSummary }) {
  const published = !!publishedRevisionId;
  return <div className="space-y-2 text-sm">
    <p className="font-medium text-primary">{status === "ARCHIVED" ? "В архиве" : published ? "Опубликовано" : revision ? revisionLabels[revision.status] : "Нет рабочей версии"}</p>
    {published && revision && revision.id !== publishedRevisionId && <p>Новая версия: {revisionLabels[revision.status].toLowerCase()}</p>}
    {revision?.status === "PENDING" && <p className="text-muted-foreground">Отправлено {formatDate(revision.submittedAt)}. Редактирование закрыто до решения.</p>}
    {revision?.status === "REJECTED" && <div className="max-w-prose break-words border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">Решение от {formatDate(revision.reviewedAt)}</p><p className="mt-1 whitespace-pre-wrap">Причина: {revision.rejectionReason}</p></div>}
  </div>;
}
export function ArticleWorkflowActions({ articleId, status, publishedRevisionId, revision }: { articleId: string; status: ArticleStatus; publishedRevisionId: string | null; revision?: RevisionSummary }) {
  if (status === "ARCHIVED" || revision?.status === "PENDING") return null;
  if (revision?.status === "DRAFT") return <>
    <Button asChild variant="outline" size="sm"><Link href={`/editor/${articleId}`}>Редактировать</Link></Button>
    <DeleteDraftButton articleId={articleId} revisionId={revision.id} editVersion={revision.editVersion} published={!!publishedRevisionId} />
  </>;
  return <CreateDraftButton articleId={articleId} label={revision?.status === "REJECTED" ? "Исправить статью" : "Редактировать"} />;
}
export function HistoryLink({ articleId }: { articleId: string }) {
  return <Link href={`/dashboard/articles/${articleId}`} className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">История версий</Link>;
}
