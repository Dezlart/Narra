import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { getOwnBookmarks } from "@/features/bookmarks/queries";
import { ArticleCard } from "@/features/public-content/article-card";
import { Pagination } from "@/features/public-content/feed";
import { SocialButton } from "@/features/social/social-button";
export const metadata: Metadata = { title: "Сохранённые статьи", robots: { index: false, follow: false } };
export default async function BookmarksPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("/dashboard/bookmarks");
  const feed = await getOwnBookmarks((await searchParams).page);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle />
    <Link href="/dashboard" className="text-sm text-primary">← Личный кабинет</Link>
    <h1 className="mt-8 wrap-anywhere font-editorial text-4xl sm:text-5xl">Сохранённые статьи</h1>
    <p className="mb-10 mt-4 text-sm leading-7 text-muted-foreground">Истории, к которым хочется вернуться. Недоступные публикации здесь не показываются.</p>
    {feed.items.length ? <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{feed.items.map((article) => <div key={article.id} className="min-w-0"><ArticleCard article={article} /><div className="mt-4"><SocialButton kind="bookmark" target={article.id} active returnTo="/dashboard/bookmarks" /></div></div>)}</div>
      : <div className="border-y border-dashed border-border py-14 text-center"><p className="font-editorial text-2xl">{feed.page === 1 ? "У вас пока нет сохранённых статей" : "На этой странице закладок нет"}</p><Link className="mt-5 inline-block text-sm text-primary underline underline-offset-4" href={feed.page === 1 ? "/" : "/dashboard/bookmarks"}>{feed.page === 1 ? "Найти интересную историю" : "К первым закладкам"}</Link></div>}
    <Pagination feed={feed} path="/dashboard/bookmarks" />
  </main>;
}
