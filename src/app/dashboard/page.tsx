import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, BarChart3, Bell, Bookmark, FileText, PenLine, Rss, Settings } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/features/users/avatar";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";

export const metadata: Metadata = { title: "Личный кабинет", robots: { index: false, follow: false } };

export default async function DashboardPage() {
  const user = await requirePageUser("/dashboard");
  const actions = [
    { href: "/dashboard/analytics", label: "Моя аналитика", description: "Просмотры и отклик", icon: BarChart3 },
    { href: "/dashboard/bookmarks", label: "Сохранённые", description: "Отложенные статьи", icon: Bookmark },
    { href: "/following", label: "Лента подписок", description: "Новые истории авторов", icon: Rss },
    { href: "/dashboard/notifications", label: "Уведомления", description: "События и обновления", icon: Bell },
  ] as const;
  return <main id="main-content" tabIndex={-1} className="page-container py-10 sm:py-14">
    <PrivatePageLifecycle />
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow mb-4 text-primary">Личный кабинет</p>
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end"><div><h1 className="wrap-anywhere font-editorial text-4xl leading-tight tracking-tight sm:text-5xl">Здравствуйте, {user.name}.</h1><p className="mt-3 text-muted-foreground">Управляйте публикациями и своим пространством в Narra.</p></div><div className="flex flex-wrap gap-3"><Button asChild><Link href="/dashboard/articles"><FileText aria-hidden="true" />Мои статьи</Link></Button><Button variant="outline" asChild><Link href="/editor/new"><PenLine aria-hidden="true" />Написать</Link></Button></div></div>

      <section aria-labelledby="quick-actions-title" className="mt-8"><h2 id="quick-actions-title" className="sr-only">Быстрые действия</h2><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{actions.map((action) => { const Icon = action.icon; return <Link key={action.href} href={action.href} className="group flex min-h-36 flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/3 sm:p-5"><span className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="size-5" aria-hidden="true" /></span><span className="mt-5 flex items-start justify-between gap-2"><span className="wrap-anywhere text-sm font-medium sm:text-base">{action.label}</span><ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span><span className="mt-1 hidden text-xs leading-5 text-muted-foreground sm:block">{action.description}</span></Link>; })}</div></section>

      <section aria-label="Ваш профиль" className="my-8 rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start"><div className="flex min-w-0 items-center gap-5">
          <Avatar name={user.name} large />
          <div className="min-w-0">
            <h2 className="wrap-anywhere text-xl font-medium">{user.name}</h2>
            {user.username && <p className="mt-1 break-all text-sm text-primary">@{user.username}</p>}
            <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div><span className="eyebrow w-fit rounded-full bg-muted px-3 py-2 text-muted-foreground">Профиль автора</span></div>
        <p className="mt-6 max-w-2xl whitespace-pre-wrap wrap-anywhere text-sm leading-7 text-muted-foreground">{user.bio || "Расскажите немного о себе в настройках, чтобы читатели могли познакомиться с вами."}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user.username && <Button asChild><Link href={`/profile/${user.username}`}>Публичный профиль <ArrowUpRight aria-hidden="true" /></Link></Button>}
          <Button variant="outline" asChild><Link href="/dashboard/settings"><Settings aria-hidden="true" /> Настройки</Link></Button>
        </div>
      </section>
      <div className="border-t border-border pt-6"><SignOutButton /></div>
    </div>
  </main>;
}
