import Link from "next/link";
import { ArrowDownRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavigationItem } from "@/types/navigation";

const navigation: readonly NavigationItem[] = [
  { label: "Свежие истории", href: "/#latest" },
  { label: "В фокусе", href: "/#spotlight" },
  { label: "О Narra", href: "/#about" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="page-container flex h-22 items-center justify-between gap-6">
        <Link href="/" aria-label="Narra — на главную" className="wordmark">
          narra<span className="text-primary">.</span>
        </Link>
        <nav aria-label="Основная навигация" className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navigation.map((item) => <Link key={item.href} href={item.href} className="nav-link">{item.label}</Link>)}
        </nav>
        <Button asChild className="hidden sm:inline-flex">
          <Link href="/#latest">Открыть новое <ArrowDownRight aria-hidden="true" /></Link>
        </Button>
        <details className="mobile-navigation relative md:hidden">
          <summary className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-border" aria-label="Открыть меню">
            <Menu className="size-5" aria-hidden="true" />
          </summary>
          <nav aria-label="Мобильная навигация" className="absolute right-0 top-14 z-20 w-60 border border-border bg-background p-3 shadow-lg">
            {navigation.map((item) => <Link key={item.href} href={item.href} className="block rounded-sm px-3 py-3 text-sm hover:bg-muted">{item.label}</Link>)}
          </nav>
        </details>
      </div>
    </header>
  );
}
