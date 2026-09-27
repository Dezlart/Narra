import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { PublicFeed } from "./queries";
import { ArticleCard } from "./article-card";

export function Pagination({ feed, path, query }: { feed: PublicFeed; path: string; query?: string }) {
  function href(page: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (page > 1) params.set("page", String(page));
    return path + (params.size ? `?${params}` : "");
  }
  if (feed.page === 1 && !feed.hasNext) return null;
  return <nav aria-label="Страницы публикаций" className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm">
    {feed.page > 1 ? <Link href={href(feed.page - 1)} className="nav-link">← Назад</Link> : <span />}
    <span aria-current="page">Страница {feed.page}</span>
    {feed.hasNext ? <Link href={href(feed.page + 1)} className="nav-link">Далее →</Link> : <span />}
  </nav>;
}
export function ArticleFeed({ feed, path, query, empty = "Здесь пока нет публикаций" }: { feed: PublicFeed; path: string; query?: string; empty?: string }) {
  return <>
    {feed.items.length ? <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{feed.items.map((article) => <ArticleCard key={article.id} article={article} />)}</div>
      : <div className="border-y border-dashed border-border py-14 text-center"><BookOpen className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden="true" /><p className="font-editorial text-2xl">{empty}</p><p className="mt-3 text-sm leading-6 text-muted-foreground">Можно заглянуть в другие темы или вернуться позже.</p><Link href="/" className="mt-5 inline-block text-sm text-primary underline underline-offset-4">К свежим историям</Link></div>}
    <Pagination feed={feed} path={path} query={query} />
  </>;
}
export function FeedSkeleton() {
  return <div aria-busy="true" aria-label="Загрузка публикаций" className="grid gap-7 md:grid-cols-2 lg:grid-cols-3"><p role="status" className="sr-only">Загружаем публикации…</p>{[1, 2, 3].map((id) => <div key={id} aria-hidden="true" className="h-80 bg-muted motion-safe:animate-pulse" />)}</div>;
}
