"use client";

import { useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Popover } from "radix-ui";
import type { NavigationItem } from "@/types/navigation";

export function MobileNavigation({ items, showRegistration }: { items: readonly NavigationItem[]; showRegistration: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(false);
    window.location.assign(href);
  }

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button ref={triggerRef} type="button" className="flex size-11 cursor-pointer items-center justify-center rounded-md border border-border outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden" aria-label="Открыть меню">
        <Menu className="size-5" aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        aria-label="Основное меню"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        className="z-20 w-60 border border-border bg-background p-3 shadow-lg outline-none lg:hidden"
      >
        <nav aria-label="Мобильная навигация">
          {items.map((item) => <Link key={item.href} href={item.href} prefetch={false} onClick={(event) => navigate(event, item.href)} className="block rounded-sm px-3 py-3 text-sm outline-none hover:bg-muted focus:bg-muted">{item.label}</Link>)}
          {showRegistration && <Link href="/register" prefetch={false} onClick={(event) => navigate(event, "/register")} className="mt-2 block rounded-sm bg-primary px-3 py-3 text-sm text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden">Регистрация</Link>}
        </nav>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
