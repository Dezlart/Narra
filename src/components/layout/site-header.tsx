import Link from "next/link";
import { PenLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/types/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { NotificationBell } from "@/features/notifications/bell";
import { AccountMenu } from "@/components/layout/account-menu";
import { MobileNavigation } from "@/components/layout/mobile-navigation";

const navigation: readonly NavigationItem[] = [
  { label: "Главная", href: "/" },
  { label: "Категории", href: "/categories" },
  { label: "Поиск", href: "/search" },
  { label: "Подписки", href: "/following" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const activeUser = user && !user.isBanned ? user : null;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="page-container flex h-18 items-center gap-3">
        <Link href="/" prefetch={false} aria-label="Narra — на главную" className="wordmark">
          narra<span className="text-primary">.</span>
        </Link>
        <nav aria-label="Основная навигация" className="ml-7 hidden items-center gap-6 text-sm font-medium lg:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} prefetch={false} className="nav-link">{item.label}</Link>)}
        </nav>
        <form action="/search" method="get" role="search" className="ml-auto hidden h-10 w-[min(22vw,19rem)] items-center gap-2 rounded-lg border border-border bg-card px-3 xl:flex">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="header-search" className="sr-only">Поиск публикаций</label>
          <input id="header-search" name="q" type="search" maxLength={120} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Статьи, авторы, темы…" />
        </form>
        <div className="ml-auto flex items-center gap-2 xl:ml-0">
        {activeUser && <Button asChild size="sm" className="hidden md:inline-flex"><Link href="/editor/new" prefetch={false}><PenLine aria-hidden="true" />Написать</Link></Button>}
        {activeUser && <NotificationBell />}
        {activeUser ? <AccountMenu name={activeUser.name} role={activeUser.role} username={activeUser.username} /> : <>
          <Button asChild variant="ghost" size="sm"><Link href="/login" prefetch={false}>Войти</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register" prefetch={false}>Регистрация</Link></Button>
        </>}
        <MobileNavigation items={navigation} showRegistration={!activeUser} />
        </div>
      </div>
    </header>
  );
}
