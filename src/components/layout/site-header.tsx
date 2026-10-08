import Link from "next/link";
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
    <header className="border-b border-border">
      <div className="page-container flex h-22 items-center justify-between gap-3">
        <Link href="/" aria-label="Narra — на главную" className="wordmark">
          narra<span className="text-primary">.</span>
        </Link>
        <nav aria-label="Основная навигация" className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} prefetch={!activeUser && item.href === "/following" ? false : undefined} className="nav-link">{item.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
        {activeUser && <NotificationBell />}
        {activeUser ? <AccountMenu name={activeUser.name} role={activeUser.role} username={activeUser.username} /> : <>
          <Button asChild variant="ghost" size="sm"><Link href="/login">Войти</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register">Регистрация</Link></Button>
        </>}
        <MobileNavigation items={navigation} showRegistration={!activeUser} />
        </div>
      </div>
    </header>
  );
}
