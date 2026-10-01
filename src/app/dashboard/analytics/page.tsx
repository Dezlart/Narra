import Link from "next/link";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { getAuthorAnalytics } from "@/features/analytics/queries";
import { Metrics, TrendChart } from "@/features/analytics/chart";
import { AdminPage, Table, Pager, Empty, date } from "@/features/admin/ui";
export const metadata: Metadata = { title: "Моя аналитика", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("/dashboard/analytics"); const result = await getAuthorAnalytics((await searchParams).page), m = result.metrics;
  return <AdminPage title="Моя аналитика" description="Просмотры и видимые комментарии — у текущих опубликованных статей. Лайки — у всех ваших статей, включая архив, от активных пользователей. Подписчики — активные аккаунты. Таблица содержит только публичные статьи."><PrivatePageLifecycle />
    <Metrics items={[["Просмотры", m.views], ["Лайки", m.likes], ["Комментарии", m.comments], ["Подписчики", m.followers]]} /><TrendChart rows={result.daily} author />
    <h2 className="mb-5 mt-10 font-editorial text-2xl">Опубликованные статьи</h2><Table caption="Статистика ваших статей" labels={["Статья", "Опубликована", "Просмотры", "Лайки", "Комментарии"]}>{result.items.map((a) => <tr key={a.id}><td><Link className="text-primary underline" href={`/articles/${a.slug}`}>{a.publishedRevision?.title}</Link></td><td>{date(a.publishedAt)}</td><td>{a._count.views}</td><td>{a._count.likes}</td><td>{a._count.comments}</td></tr>)}</Table><Empty count={result.items.length} /><Pager {...result} />
  </AdminPage>;
}
