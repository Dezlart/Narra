import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { getFollowingFeed } from "@/features/follows/feed";
import { ArticleFeed } from "@/features/public-content/feed";
export const metadata: Metadata = { title: "Лента подписок", robots: { index: false, follow: false } };
export default async function FollowingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("/following");
  const feed = await getFollowingFeed((await searchParams).page);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle />
    <p className="eyebrow mb-4 text-primary">Ваш круг чтения</p>
    <h1 className="font-editorial text-4xl sm:text-5xl">Лента подписок</h1>
    <p className="mb-10 mt-4 max-w-reading text-sm leading-7 text-muted-foreground">Свежие публикации авторов, на которых вы подписаны. Подпишитесь на интересных авторов, чтобы видеть их истории здесь.</p>
    <ArticleFeed feed={feed} path="/following" empty={feed.page === 1 ? "Ваша лента пока пуста" : "На этой странице публикаций нет"} />
  </main>;
}
