"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import { Avatar } from "@/features/users/avatar";
import { SignOutButton } from "@/features/auth/sign-out-button";

type AccountMenuProps = {
  name: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  username: string | null;
};

function AccountLink({ href, children, onNavigate }: { href: string; children: ReactNode; onNavigate: () => void }) {
  return <Link href={href} onClick={onNavigate} className="block rounded-sm px-3 py-3 text-sm outline-none hover:bg-muted focus:bg-muted">
    {children}
  </Link>;
}

export function AccountMenu({ name, role, username }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button ref={triggerRef} type="button" className="group flex min-h-11 cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Меню аккаунта">
        <Avatar name={name} />
        <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{name}</span>
        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        aria-label="Аккаунт"
        align="end"
        sideOffset={12}
        collisionPadding={12}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        className="z-30 max-h-[calc(100dvh-7rem)] w-60 overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-3 shadow-lg outline-none"
      >
        <p className="wrap-anywhere px-3 py-2 text-sm font-medium">{name}</p>
        <AccountLink href="/dashboard" onNavigate={() => setOpen(false)}>Личный кабинет</AccountLink>
        <AccountLink href="/dashboard/articles" onNavigate={() => setOpen(false)}>Мои статьи</AccountLink>
        <AccountLink href="/dashboard/analytics" onNavigate={() => setOpen(false)}>Моя аналитика</AccountLink>
        {role === "ADMIN" && <AccountLink href="/admin" onNavigate={() => setOpen(false)}>Управление платформой</AccountLink>}
        <AccountLink href="/dashboard/bookmarks" onNavigate={() => setOpen(false)}>Сохранённые статьи</AccountLink>
        <AccountLink href="/dashboard/notifications" onNavigate={() => setOpen(false)}>Уведомления</AccountLink>
        {(role === "MODERATOR" || role === "ADMIN") && <AccountLink href="/admin/moderation" onNavigate={() => setOpen(false)}>Модерация</AccountLink>}
        {(role === "MODERATOR" || role === "ADMIN") && <AccountLink href="/admin/comments" onNavigate={() => setOpen(false)}>Комментарии</AccountLink>}
        <AccountLink href="/dashboard/settings" onNavigate={() => setOpen(false)}>Настройки</AccountLink>
        {username && <AccountLink href={`/profile/${username}`} onNavigate={() => setOpen(false)}>Мой профиль</AccountLink>}
        <div className="mt-2 border-t border-border px-3 pt-3"><SignOutButton /></div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
