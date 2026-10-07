import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/types/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { NotificationBell } from "@/features/notifications/bell";
import { Disclosure } from "@/components/ui/disclosure";
import { AccountMenu } from "@/components/layout/account-menu";

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
    <header className="border-b border-border">
      <div className="page-container flex h-22 items-center justify-between gap-3">
        <Link href="/" aria-label="Narra — на главную" className="wordmark">
          narra<span className="text-primary">.</span>
        </Link>
        <nav aria-label="Основная навигация" className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
        {activeUser && <NotificationBell />}
        {activeUser ? <AccountMenu name={activeUser.name} role={activeUser.role} username={activeUser.username} /> : <>
          <Button asChild variant="ghost" size="sm"><Link href="/login">Войти</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register">Регистрация</Link></Button>
        </>}
        <Disclosure className="mobile-navigation relative lg:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-border" aria-label="Открыть меню">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <nav aria-label="Мобильная навигация" className="absolute right-0 top-14 z-20 w-60 border border-border bg-background p-3 shadow-lg">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">{item.label}</Link>)}
            {!activeUser && <Link href="/register" className="mt-2 block rounded-sm bg-primary px-3 py-3 text-sm text-primary-foreground sm:hidden">Регистрация</Link>}
          </nav>
        </Disclosure>
        </div>
      </div>
    </header>
  );
}
