import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/types/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { Avatar } from "@/features/users/avatar";
import { SignOutButton } from "@/features/auth/sign-out-button";

const navigation: readonly NavigationItem[] = [
  { label: "Свежие истории", href: "/#latest" },
  { label: "В фокусе", href: "/#spotlight" },
  { label: "О Narra", href: "/#about" },
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
        {activeUser ? <details className="mobile-navigation relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md" aria-label="Меню аккаунта">
            <Avatar name={activeUser.name} /><span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{activeUser.name}</span><ChevronDown className="size-4" aria-hidden="true" />
          </summary>
          <nav aria-label="Аккаунт" className="absolute right-0 top-14 z-30 w-60 rounded-md border border-border bg-background p-3 shadow-lg">
            <p className="truncate px-3 py-2 text-sm font-medium">{activeUser.name}</p>
            <Link href="/dashboard" className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">Личный кабинет</Link>
            <Link href="/dashboard/articles" className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">Мои статьи</Link>
            <Link href="/dashboard/settings" className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">Настройки</Link>
            {activeUser.username && <Link href={`/profile/${activeUser.username}`} className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">Мой профиль</Link>}
            <div className="mt-2 border-t border-border px-3 pt-3"><SignOutButton /></div>
          </nav>
        </details> : <>
          <Button asChild variant="ghost" size="sm"><Link href="/login">Войти</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/register">Регистрация</Link></Button>
        </>}
        <details className="mobile-navigation relative lg:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-border" aria-label="Открыть меню">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <nav aria-label="Мобильная навигация" className="absolute right-0 top-14 z-20 w-60 border border-border bg-background p-3 shadow-lg">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">{item.label}</Link>)}
            {!activeUser && <Link href="/register" className="mt-2 block rounded-sm bg-primary px-3 py-3 text-sm text-primary-foreground sm:hidden">Регистрация</Link>}
          </nav>
        </details>
        </div>
      </div>
    </header>
  );
}
