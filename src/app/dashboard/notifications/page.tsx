import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { getOwnNotifications, getUnreadNotificationCount } from "@/features/notifications/queries";
import { NotificationList, ReadAllNotificationsButton } from "@/features/notifications/notification-list";
export const metadata: Metadata = { title: "Уведомления", robots: { index: false, follow: false } };
export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("/dashboard/notifications");
  const [feed, count] = await Promise.all([getOwnNotifications((await searchParams).page), getUnreadNotificationCount()]);
  return <main id="main-content" tabIndex={-1} className="page-container py-12 sm:py-16"><PrivatePageLifecycle /><div className="mx-auto max-w-reading">
    <Link href="/dashboard" className="text-sm text-primary">← Личный кабинет</Link>
    <h1 className="mt-8 font-editorial text-4xl sm:text-5xl">Уведомления</h1>
    <div className="my-6 flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Непрочитанных: {count}</p><ReadAllNotificationsButton disabled={count === 0} /></div>
    <p className="mb-4 text-sm leading-6 text-muted-foreground">Откройте событие или отметьте его прочитанным. Просмотр списка не меняет статус.</p>
    <NotificationList items={feed.items} />
    {(feed.hasNext || feed.page > 1) && <nav aria-label="Страницы уведомлений" className="mt-8 flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-sm">
      {feed.page > 1 ? <Link href={`?page=${feed.page - 1}`}>← Назад</Link> : <span />}
      <span aria-current="page">Страница {feed.page}</span>{feed.hasNext && <Link href={`?page=${feed.page + 1}`}>Далее →</Link>}
    </nav>}
  </div></main>;
}
