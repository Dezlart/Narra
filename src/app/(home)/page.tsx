import type { ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Bookmark, Clock3, Flame, Home, MessageCircle, PenLine, Rss, Sparkles, UserRound } from "lucide-react";
import { getPublicCategories, getPublishedArticles, type PublicArticleCard } from "@/features/public-content/queries";
import { ArticleCard } from "@/features/public-content/article-card";
import { ArticleFeed } from "@/features/public-content/feed";
import { publicMetadata } from "@/features/public-content/metadata";
import { Avatar } from "@/features/users/avatar";
import { Button } from "@/components/ui/button";
import type { SearchParams } from "@/features/public-content/params";

export const metadata = publicMetadata("Идеи, которые стоит прочитать", "Свежие публикации авторов Narra о технологиях, культуре и людях.", "/");

function SidebarPanel({ title, icon, children, id }: { title: string; icon: ReactNode; children: ReactNode; id?: string }) {
  return <section id={id} className="rounded-xl border border-border bg-card p-5">
    <h2 className="mb-4 flex items-center gap-2 font-editorial text-xl"><span className="text-primary" aria-hidden="true">{icon}</span>{title}</h2>
    {children}
  </section>;
}

function PopularList({ articles }: { articles: PublicArticleCard[] }) {
  if (!articles.length) return <p className="text-sm leading-6 text-muted-foreground">Популярные публикации появятся вместе с первыми историями.</p>;
  return <ol className="divide-y divide-border">{articles.map((article, index) => <li key={article.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 py-3 first:pt-0 last:pb-0">
    <span className="flex size-7 items-center justify-center rounded-md bg-primary/8 text-xs font-medium text-primary">{index + 1}</span>
    <div className="min-w-0"><Link href={`/articles/${article.slug}`} className="wrap-anywhere text-sm font-medium leading-5 hover:text-primary">{article.title}</Link>
      <p className="mt-1 flex gap-3 text-xs text-muted-foreground"><span>{article.likesCount} нравится</span><span className="inline-flex items-center gap-1"><MessageCircle className="size-3" aria-hidden="true" />{article.commentsCount}</span></p>
    </div>
  </li>)}</ol>;
}

function AuthorList({ articles }: { articles: PublicArticleCard[] }) {
  const authors = [...new Map(articles.map((article) => [article.author.username || article.author.name, article.author])).values()].slice(0, 5);
  if (!authors.length) return <p className="text-sm leading-6 text-muted-foreground">Авторы появятся после первой публикации.</p>;
  return <ul className="space-y-4">{authors.map((author) => <li key={author.username || author.name} className="flex min-w-0 items-center gap-3">
    <Avatar name={author.name} />
    <div className="min-w-0"><p className="truncate text-sm font-medium">{author.name}</p>{author.username ? <Link href={`/profile/${author.username}`} className="text-xs text-muted-foreground hover:text-primary">@{author.username}</Link> : <p className="text-xs text-muted-foreground">Автор Narra</p>}</div>
  </li>)}</ul>;
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { page } = await searchParams;
  const [feed, categories] = await Promise.all([getPublishedArticles(page), getPublicCategories()]);
  const featured = feed.page === 1 ? feed.items[0] : null;
  const remaining = featured ? feed.items.slice(1) : feed.items;
  const popular = [...feed.items].sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount) || b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 5);
  const primaryNavigation = [
    { label: "Главная", href: "/", icon: Home },
    { label: "Свежие", href: "#latest", icon: Clock3 },
    { label: "Популярное", href: "#popular", icon: Flame },
    { label: "Подписки", href: "/following", icon: Rss },
    { label: "Сохранённое", href: "/dashboard/bookmarks", icon: Bookmark },
  ] as const;

  return <main id="main-content" tabIndex={-1} className="page-container py-6 sm:py-8">
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_17.5rem] xl:grid-cols-[11rem_minmax(0,1fr)_17.5rem]">
      <aside aria-label="Разделы главной" className="hidden xl:block">
        <div className="sticky top-24 space-y-7">
          <nav aria-label="Навигация по ленте"><ul className="space-y-1">{primaryNavigation.map((item, index) => { const Icon = item.icon; return <li key={item.label}><Link href={item.href} className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-muted hover:text-primary ${index === 0 ? "bg-primary/8 font-medium text-primary" : "text-muted-foreground"}`}><Icon className="size-4" aria-hidden="true" />{item.label}</Link></li>; })}</ul></nav>
          {categories.length > 0 && <nav aria-label="Категории" className="border-t border-border pt-6"><p className="eyebrow mb-3 px-3 text-muted-foreground">Категории</p><ul className="space-y-1">{categories.slice(0, 8).map((category) => <li key={category.slug}><Link href={`/categories/${category.slug}`} className="block min-h-9 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-primary">{category.name}</Link></li>)}</ul><Link href="/categories" className="mt-2 inline-flex min-h-10 items-center px-3 text-xs font-medium text-primary hover:underline">Все категории →</Link></nav>}
        </div>
      </aside>

      <div className="min-w-0">
        <p className="eyebrow mb-4 text-muted-foreground">Главная</p>
        {featured ? <ArticleCard article={featured} featured /> : <section className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"><Sparkles className="mx-auto mb-4 size-8 text-primary" aria-hidden="true" /><h2 className="font-editorial text-3xl">Первая история ещё впереди</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Когда авторы опубликуют материалы, здесь появится редакционная лента Narra.</p><Button asChild className="mt-6"><Link href="/editor/new">Написать статью</Link></Button></section>}

        <nav aria-label="Темы журнала" className="my-6 flex flex-wrap gap-2 border-b border-border pb-6"><Link href="/" prefetch={false} aria-current="page" className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background">Все темы</Link>{categories.slice(0, 8).map((category) => <Link key={category.slug} href={`/categories/${category.slug}`} className="rounded-full border border-border bg-card px-4 py-2 text-xs hover:border-primary hover:text-primary">{category.name}</Link>)}{categories.length > 8 && <Link href="/categories" className="rounded-full border border-border px-4 py-2 text-xs font-medium text-primary hover:border-primary">Ещё →</Link>}</nav>

        <section id="latest" aria-labelledby="latest-title"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow text-primary">Новые публикации</p><h1 id="latest-title" className="mt-2 font-editorial text-3xl tracking-tight">Свежие истории</h1></div></div>
          <div className="mt-3">{featured && feed.items.length === 1 ? <div className="border-b border-border py-8 text-sm text-muted-foreground">Первая история уже здесь. Новые публикации появятся в этой ленте.</div> : <ArticleFeed feed={{ ...feed, items: remaining }} path="/" layout="list" empty="Первые истории ещё впереди" />}</div>
        </section>
      </div>

      <aside aria-label="Дополнительные материалы" className="min-w-0 space-y-5 lg:self-start">
        <SidebarPanel id="popular" title="Популярное сейчас" icon={<Flame className="size-5" />}><PopularList articles={popular} /></SidebarPanel>
        <SidebarPanel title="Авторы ленты" icon={<UserRound className="size-5" />}><AuthorList articles={feed.items} /></SidebarPanel>
        <SidebarPanel title="Актуальные темы" icon={<span className="font-sans text-base font-semibold">#</span>}>
          {categories.length ? <ul className="divide-y divide-border">{categories.slice(0, 7).map((category) => <li key={category.slug}><Link href={`/categories/${category.slug}`} className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm hover:text-primary"><span className="wrap-anywhere">{category.name}</span><span className="text-primary" aria-hidden="true">#</span></Link></li>)}</ul> : <p className="text-sm leading-6 text-muted-foreground">Темы появятся вместе с публикациями.</p>}
        </SidebarPanel>
        <section className="rounded-xl bg-primary/8 p-5"><div className="flex size-10 items-center justify-center rounded-full bg-background text-primary"><PenLine className="size-5" aria-hidden="true" /></div><h2 className="mt-4 font-editorial text-xl">Делитесь своими идеями</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Публикуйте истории и находите читателей в Narra.</p><Button asChild className="mt-5 w-full"><Link href="/editor/new">Написать статью</Link></Button></section>
      </aside>
    </div>
  </main>;
}
