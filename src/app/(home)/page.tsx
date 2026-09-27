import Link from "next/link";
import { connection } from "next/server";
import { getPublicCategories, getPublishedArticles } from "@/features/public-content/queries";
import { ArticleCard } from "@/features/public-content/article-card";
import { ArticleFeed } from "@/features/public-content/feed";
import { publicMetadata } from "@/features/public-content/metadata";
import type { SearchParams } from "@/features/public-content/params";

export const metadata = publicMetadata("Идеи, которые стоит прочитать", "Технологии, культура и люди. Истории авторов Narra — новые точки зрения каждый день.", "/");
export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { page } = await searchParams;
  const [feed, categories] = await Promise.all([getPublishedArticles(page), getPublicCategories()]);
  const featured = feed.page === 1 ? feed.items[0] : null;
  return <main id="main-content" tabIndex={-1} className="page-container">
    <section className="py-10 sm:py-14" aria-labelledby="welcome-title">
      <p className="eyebrow mb-6 text-muted-foreground">Журнал любопытных людей</p>
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><h1 id="welcome-title" className="font-editorial text-[clamp(2.3rem,4.5vw,4.1rem)] leading-[1.12] tracking-[-0.045em]">Есть идеи.<br />Есть что <span className="italic text-primary">рассказать.</span></h1><p className="max-w-78 text-sm leading-7 text-muted-foreground">Технологии, культура и люди.<br />Истории, которые помогают понять мир — и увидеть в нём больше.</p></div>
    </section>
    {featured && <ArticleCard article={featured} featured />}
    <nav aria-label="Темы журнала" className="my-8 flex flex-wrap gap-3 border-b border-border pb-7"><Link href="/" className="rounded-full bg-foreground px-4 py-2 text-sm text-background">Все темы</Link>{categories.map((category) => <Link key={category.slug} href={`/categories/${category.slug}`} className="rounded-full border border-border px-4 py-2 text-sm hover:border-primary hover:text-primary">{category.name}</Link>)}</nav>
    <section id="latest" aria-labelledby="latest-title"><h2 id="latest-title" className="section-title mb-8 font-editorial">Свежие истории</h2>
      {featured && feed.items.length === 1 ? <p className="border-b border-border pb-8 text-sm text-muted-foreground">Первая история уже здесь. Скоро будет больше.</p> : <ArticleFeed feed={{ ...feed, items: featured ? feed.items.slice(1) : feed.items }} path="/" empty="Первые истории ещё впереди" />}
    </section>
    <section id="about" className="mt-14 grid gap-6 border-y border-border bg-muted/50 px-6 py-8 md:grid-cols-2"><h2 className="font-editorial text-3xl leading-tight">Хорошие истории<br />расширяют мир</h2><p className="text-sm leading-7 text-muted-foreground">Narra — пространство для тех, кому есть чем поделиться и о чём задуматься. Личный опыт, внимательный взгляд и разговор по существу.</p></section>
  </main>;
}
