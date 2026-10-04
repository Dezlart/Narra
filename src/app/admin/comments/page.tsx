import Link from "next/link";
import type { Metadata } from "next";
import { requirePageModerator } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { getCommentsForModeration } from "@/features/comments/queries";
import { CommentModerationButton } from "@/features/comments/moderation-button";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Модерация комментариев", robots: { index: false, follow: false } };
export default async function CommentsModerationPage({ searchParams }: { searchParams: Promise<{ page?: string; commentId?: string }> }) {
  await requirePageModerator("/admin/comments");
  const params = await searchParams;
  const result = await getCommentsForModeration(params.page, params.commentId);
  const href = (page: number) => `?${new URLSearchParams({ page: String(page), ...(params.commentId ? { commentId: params.commentId } : {}) })}`;
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle />
    <Link href="/admin/moderation" className="text-sm text-primary">← Модерация статей</Link>
    <h1 className="mt-8 wrap-anywhere font-editorial text-4xl sm:text-5xl">Комментарии</h1>
    <p className="mt-4 max-w-prose text-sm leading-7 text-muted-foreground">Последние сообщения и ответы. Скрытие сохраняет ветку обсуждения; удалённый автором текст восстановить нельзя.</p>
    <form className="my-8 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><label htmlFor="comment-search" className="mb-2 block text-sm">Найти по ID комментария</label><input id="comment-search" name="commentId" maxLength={80} defaultValue={params.commentId} className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm" /></div><Button type="submit">Найти</Button><Button variant="ghost" asChild><Link href="/admin/comments">Сбросить</Link></Button></form>
    <ul className="divide-y divide-border border-y border-border">{result.items.map((item) => <li key={item.id} className="min-w-0 py-6">
      <p className="text-xs text-primary">{item.deletedAt ? "Удалён автором" : item.hiddenAt ? "Скрыт модератором" : item.author.isBanned ? "Автор заблокирован" : "Видимый"}{item.parentId ? " · Ответ" : " · Комментарий"}</p>
      <p className="mt-3 wrap-anywhere text-sm font-medium">{item.author.name}{item.author.username && ` · @${item.author.username}`}</p>
      <p className="mt-2 break-all text-xs text-muted-foreground">ID: {item.id} · {item.createdAt.toISOString()}</p>
      <p className="mt-4 whitespace-pre-wrap wrap-anywhere text-sm leading-7">{item.deletedAt ? "Текст удалён автором." : item.content}</p>
      {item.hiddenBy && <p className="mt-2 text-xs text-muted-foreground">Скрыл: {item.hiddenBy.name}</p>}
      {item.article.slug && <Link className="mt-3 inline-block text-sm text-primary" href={`/articles/${item.article.slug}#comments`}>К обсуждению статьи →</Link>}
      {!item.deletedAt && <CommentModerationButton commentId={item.id} hidden={Boolean(item.hiddenAt)} />}
    </li>)}</ul>
    {!result.items.length && <p className="py-12 text-center text-muted-foreground">Комментарии не найдены.</p>}
    <nav aria-label="Страницы модерации комментариев" className="mt-8 flex justify-between gap-4 text-sm">{result.page > 1 ? <Link href={href(result.page - 1)}>← Назад</Link> : <span />}{result.hasNext && <Link href={href(result.page + 1)}>Далее →</Link>}</nav>
  </main>;
}
