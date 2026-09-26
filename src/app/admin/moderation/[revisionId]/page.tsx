import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePageModerator } from "@/lib/auth/guards";
import { idSchema } from "@/features/articles/schemas";
import { ArticleError } from "@/features/articles/errors";
import { RichText } from "@/features/articles/rich-text";
import { formatDate, revisionLabels } from "@/features/articles/workflow-status";
import { getRevisionForModeration } from "@/features/moderation/queries";
import { moderationImageUrl } from "@/features/moderation/images";
import { ReviewForm } from "@/features/moderation/review-form";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
export const metadata: Metadata = { title: "Рассмотрение версии", robots: { index: false, follow: false } };
export default async function ModerationPreview({ params }: { params: Promise<{ revisionId: string }> }) {
  const { revisionId } = await params;
  await requirePageModerator(`/admin/moderation/${revisionId}`);
  if (!idSchema.safeParse(revisionId).success) notFound();
  let revision;
  try { revision = await getRevisionForModeration(revisionId); }
  catch (error) { if (error instanceof ArticleError && error.code === "NOT_FOUND") notFound(); throw error; }
  const imageUrl = (source: string) => moderationImageUrl(revision.id, source);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle /><div className="mx-auto max-w-reading">
    <Link href="/admin/moderation" className="text-sm text-primary">← Очередь модерации</Link>
    <p className="eyebrow mb-4 mt-10 text-primary">{revisionLabels[revision.status]} · Версия {revision.version}</p>
    <h1 className="break-words font-editorial text-3xl leading-tight sm:text-5xl">{revision.title}</h1><p className="my-6 whitespace-pre-wrap break-words text-lg leading-8 text-muted-foreground">{revision.excerpt}</p>
    <div className="mb-8 space-y-2 border-y border-border py-5 text-sm"><p>{revision.article.author.name}{revision.article.author.username && ` · @${revision.article.author.username}`}</p><p>Отправлено: {formatDate(revision.submittedAt)}</p><p>{revision.category?.name ?? "Без категории"}{revision.tags.length ? ` · ${revision.tags.map(({ tag }) => tag.name).join(", ")}` : ""}</p><p className="text-muted-foreground">{revision.article.publishedRevisionId ? "У статьи есть опубликованная версия. До одобрения новой она остаётся текущей." : "Первая публикация статьи."} Перед вами неизменяемый снимок отправленной версии.</p></div>
    {revision.coverImage && <Image src={imageUrl(revision.coverImage)} alt="Обложка статьи" width={1200} height={675} unoptimized className="mb-10 h-auto w-full rounded-md" />}
    <RichText content={revision.content} imageUrl={imageUrl} />
    {revision.status === "PENDING" && revision.article.status !== "ARCHIVED" ? <ReviewForm revisionId={revision.id} /> : <section className="mt-12 space-y-3 border-t border-border pt-8" role="status"><h2 className="font-editorial text-2xl">{revision.article.status === "ARCHIVED" ? "Статья в архиве" : "Решение сохранено"}</h2><p>{revisionLabels[revision.status]} · {formatDate(revision.reviewedAt)}{revision.reviewedBy && ` · ${revision.reviewedBy.name}`}</p>{revision.rejectionReason && <p className="whitespace-pre-wrap break-words">Причина: {revision.rejectionReason}</p>}<p className="text-sm text-muted-foreground">Повторное рассмотрение этой версии недоступно.</p></section>}
  </div></main>;
}
