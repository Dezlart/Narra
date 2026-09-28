import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { getArticleComments } from "./queries";
import { CommentComposer, CommentThread } from "./discussion-client";
export async function Discussion({ articleId, path, page }: { articleId: string; path: string; page: unknown }) {
  const [comments, user] = await Promise.all([getArticleComments(articleId, page), getCurrentUser()]);
  const viewer = user ? user.isBanned ? "banned" : "member" : "guest";
  return <section id="comments" aria-labelledby="comments-title" className="mx-auto mt-14 max-w-reading scroll-mt-24">
    <h2 id="comments-title" className="font-editorial text-3xl">Обсуждение <span className="text-muted-foreground">{comments.count}</span></h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Делитесь мыслями и уважайте собеседников.</p>
    {viewer === "member" ? <CommentComposer articleId={articleId} path={path} /> : <p className="my-6 text-sm">{viewer === "guest" ? <Link className="text-primary underline underline-offset-4" href={`/login?returnTo=${encodeURIComponent(path)}`}>Войдите, чтобы оставить комментарий</Link> : "Ваш аккаунт заблокирован. Комментирование недоступно."}</p>}
    {comments.items.length ? <ul>{comments.items.map((item) => <CommentThread key={item.id} item={item} articleId={articleId} viewer={viewer} path={path} />)}</ul> : <p className="border-t border-border py-10 text-sm text-muted-foreground">{comments.page === 1 ? "Пока нет комментариев. Начните обсуждение." : "На этой странице комментариев нет."}</p>}
    {(comments.page > 1 || comments.hasNext) && <nav aria-label="Страницы комментариев" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      {comments.page > 1 ? <Link href={`${path}?commentsPage=${comments.page - 1}#comments`}>← Назад</Link> : <span />}
      <span>Страница {comments.page}</span>
      {comments.hasNext && <Link href={`${path}?commentsPage=${comments.page + 1}#comments`}>Далее →</Link>}
    </nav>}
  </section>;
}
