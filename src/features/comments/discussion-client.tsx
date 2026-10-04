"use client";
import { ReportButton } from "@/features/reports/report-button";
import { formatDateTime } from "@/lib/dates";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Viewer } from "@/features/social/social-button";
import type { PublicComment } from "./view";
import { createCommentAction, deleteCommentAction, loadRepliesAction } from "./actions";

export function CommentComposer({ articleId, parentId = null, path, onCreated }: {
  articleId: string; parentId?: string | null; path: string; onCreated?: (page: number) => Promise<void>;
}) {
  const id = useId();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const submission = useRef<{ content: string; requestId: string } | null>(null);
  return <form className="my-5" onSubmit={(event) => {
    event.preventDefault(); setError("");
    if (submission.current?.content !== content) submission.current = { content, requestId: crypto.randomUUID() };
    const requestId = submission.current.requestId;
    startTransition(async () => {
      try {
        const result = await createCommentAction({ articleId, parentId, content, requestId });
        if (!result.ok) { setError(result.message); return; }
        setContent(""); submission.current = null;
        if (onCreated) await onCreated(result.value.replyPage);
        else router.replace(`${path}#comments`, { scroll: false });
      } catch { setError("Не удалось отправить комментарий. Повторите попытку — дубликат не появится."); }
    });
  }}>
    <label htmlFor={id} className="mb-2 block text-sm font-medium">{parentId ? "Ваш ответ" : "Ваш комментарий"}</label>
    <textarea id={id} required maxLength={2000} value={content} disabled={pending} onChange={(event) => setContent(event.target.value)} rows={3}
      aria-describedby={`${id}-hint`} className="w-full min-w-0 resize-y rounded-lg border border-border bg-card p-3 text-sm leading-6 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60" />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p id={`${id}-hint`} className="text-xs text-muted-foreground">Обычный текст · {content.length}/2000</p><Button disabled={pending || !content.trim()} type="submit">{pending ? "Отправляем…" : parentId ? "Отправить ответ" : "Отправить комментарий"}</Button></div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  </form>;
}
function CommentBody({ item, viewer, path, afterDelete }: { item: PublicComment; viewer: Viewer; path: string; afterDelete?: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  return <div className="min-w-0" id={`comment-${item.id}`}>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {item.author && (item.author.username ? <Link className="break-all text-sm font-medium text-foreground hover:text-primary" href={`/profile/${item.author.username}`}>{item.author.name}</Link> : <span>{item.author.name}</span>)}
      <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
    </div>
    <p className={`mt-3 whitespace-pre-wrap wrap-anywhere text-sm leading-7 ${item.status === "visible" ? "" : "italic text-muted-foreground"}`}>{item.content ?? (item.status === "deleted" ? "Комментарий удалён автором." : "Комментарий скрыт.")}</p>
    {item.status === "visible" && !item.canDelete && <ReportButton targetId={item.id} targetType="COMMENT" viewer={viewer} path={path} />}
    {item.canDelete && <div className="mt-2">
      {!confirm ? <Button variant="ghost" onClick={() => setConfirm(true)}>Удалить</Button> : <div className="flex flex-wrap items-center gap-2"><span className="text-xs">Удалить текст без возможности восстановления?</span><Button variant="destructive" disabled={pending} onClick={() => {
        setError(""); startTransition(async () => {
          try { const result = await deleteCommentAction({ commentId: item.id }); if (!result.ok) setError(result.message); else { setConfirm(false); await afterDelete?.(); } }
          catch { setError("Не удалось удалить комментарий. Попробуйте ещё раз."); }
        });
      }}>Да, удалить</Button><Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Отмена</Button></div>}
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}
type Replies = { items: PublicComment[]; page: number; hasNext: boolean };
export function CommentThread({ item, articleId, viewer, path }: { item: PublicComment; articleId: string; viewer: Viewer; path: string }) {
  const [replies, setReplies] = useState<Replies | null>(null);
  const [replying, setReplying] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  async function load(page: number) {
    setError("");
    try {
      const result = await loadRepliesAction({ articleId, parentId: item.id, page });
      if (result.ok) setReplies(result.value); else { setReplies(null); setError(result.message); }
    } catch { setReplies(null); setError("Не удалось загрузить ответы. Попробуйте ещё раз."); }
  }
  return <li className="min-w-0 border-t border-border py-6">
    <CommentBody item={item} viewer={viewer} path={path} />
    <div className="mt-2 flex flex-wrap gap-2">
      {item.canReply && viewer === "member" && <Button variant="ghost" aria-expanded={replying} onClick={() => setReplying(!replying)}>{replying ? "Отменить ответ" : "Ответить"}</Button>}
      {item.canReply && viewer === "guest" && <Link href={`/login?returnTo=${encodeURIComponent(path)}`} className="inline-flex min-h-11 items-center text-sm text-primary">Войти, чтобы ответить</Link>}
      {(item.hasReplies || replies) && <Button variant="ghost" disabled={pending} aria-expanded={Boolean(replies)} onClick={() => replies ? setReplies(null) : startTransition(() => load(1))}>{pending ? "Загружаем…" : replies ? "Свернуть ответы" : "Показать ответы"}</Button>}
    </div>
    {replying && item.canReply && <CommentComposer articleId={articleId} parentId={item.id} path={path} onCreated={async (page) => { setReplying(false); await load(page); }} />}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {replies && <div className="mt-4 min-w-0 border-l-2 border-border pl-3 sm:pl-6" aria-label="Ответы">
      <ul className="space-y-6">{replies.items.map((reply) => <li key={`${reply.id}-${reply.version}`}><CommentBody item={reply} viewer={viewer} path={path} afterDelete={() => load(replies.page)} /></li>)}</ul>
      {replies.items.length === 0 && <p className="text-sm text-muted-foreground">На этой странице ответов нет.</p>}
      <nav aria-label="Страницы ответов" className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        {replies.page > 1 && <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => load(replies.page - 1))}>← Назад</Button>}
        <span>Страница {replies.page}</span>
        {replies.hasNext && <Button variant="ghost" disabled={pending} onClick={() => startTransition(() => load(replies.page + 1))}>Далее →</Button>}
      </nav>
    </div>}
  </li>;
}
