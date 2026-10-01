import Link from "next/link";
import type { Metadata } from "next";
import { requirePageModerator } from "@/lib/auth/guards";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
export const metadata: Metadata = { title: "Управление Narra", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageModerator("/admin/moderation");
  const links = [...(user.role === "ADMIN" ? [["/admin", "Обзор"], ["/admin/users", "Пользователи"], ["/admin/articles", "Статьи"], ["/admin/categories", "Категории"]] : []),
    ["/admin/moderation", "Модерация"], ["/admin/comments", "Комментарии"], ["/admin/reports", "Жалобы"]];
  return <><PrivatePageLifecycle /><div className="border-b border-border bg-card"><div className="page-container py-4"><p className="eyebrow mb-3 text-primary">Управление Narra · {user.role}</p>
    <nav aria-label="Административная навигация" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">{links.map(([href, title]) => <Link key={href} href={href} className="inline-flex min-h-11 items-center hover:text-primary">{title}</Link>)}</nav></div></div>{children}</>;
}
