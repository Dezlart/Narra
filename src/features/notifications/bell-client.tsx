"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { NotificationView } from "./queries";
import { NotificationList } from "./notification-list";
export function NotificationBellClient({ items, unreadCount }: { items: NotificationView[]; unreadCount: number }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function close() { if (ref.current) ref.current.open = false; }
  return <details ref={ref} className="relative" onKeyDown={(event) => {
    if (event.key === "Escape") { close(); ref.current?.querySelector("summary")?.focus(); }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <summary aria-label={`Уведомления: ${unreadCount} непрочитанных`} className="relative flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-border">
      <Bell className="size-5" aria-hidden="true" />
      {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-center text-[10px] leading-5 text-primary-foreground">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </summary>
    <section aria-label="Последние уведомления" className="fixed inset-x-3 top-24 z-40 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain rounded-md border border-border bg-background p-4 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-14 sm:w-88">
      <h2 className="font-editorial text-xl">Уведомления</h2>
      <NotificationList items={items} onOpen={close} />
      <Link href="/dashboard/notifications" onClick={close} className="block border-t border-border pt-4 text-sm text-primary underline underline-offset-4">Все уведомления →</Link>
    </section>
  </details>;
}
