import { connection } from "next/server";
import { searchPublishedArticles } from "@/features/public-content/queries";
import { ArticleFeed } from "@/features/public-content/feed";
import type { SearchParams } from "@/features/public-content/params";
export const metadata = { title: "Поиск — Narra", description: "Найдите историю или автора в Narra.", robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { q, page } = await searchParams;
  const result = await searchPublishedArticles(q, page);
  return <main id="main-content" tabIndex={-1} className="page-container py-12"><p className="eyebrow text-primary">Найти свою историю</p><h1 className="my-6 font-editorial text-4xl">Поиск в Narra</h1>
    <form action="/search" method="get" role="search" className="mb-10 max-w-2xl"><label htmlFor="search-query" className="mb-3 block text-sm">Название, описание или автор</label><div className="flex gap-3"><input id="search-query" name="q" type="search" defaultValue={result.query.slice(0, 120)} maxLength={120} className="min-w-0 flex-1 rounded-md border border-border bg-card px-4 py-3" placeholder="Что вам интересно?" /><button type="submit" className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Найти</button></div></form>
    {result.error ? <p role="alert" className="text-destructive">{result.error}</p> : !result.query ? <p className="text-muted-foreground">Введите тему или имя автора, чтобы найти публикации.</p> : <><h2 className="mb-7 wrap-anywhere font-editorial text-2xl">Результаты для «{result.query}»</h2><ArticleFeed feed={result} path="/search" query={result.query} empty="По этому запросу ничего не найдено" /></>}
  </main>;
}
