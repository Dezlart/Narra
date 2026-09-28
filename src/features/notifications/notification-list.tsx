"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, MessageCircle, UserPlus, FileCheck, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NotificationView } from "./queries";
import { readNotificationAction, readAllNotificationsAction } from "./actions";

const icons = { ARTICLE_APPROVED: FileCheck, ARTICLE_REJECTED: FileX, NEW_FOLLOWER: UserPlus,
  ARTICLE_COMMENT: MessageCircle, COMMENT_REPLY: MessageCircle, FOLLOWED_AUTHOR_PUBLISHED: Bell };
export function NotificationList({ items, onOpen }: { items: NotificationView[]; onOpen?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function read(item: NotificationView, navigate: boolean) {
    setError("");
    startTransition(async () => {
      try {
        const result = await readNotificationAction({ notificationId: item.id });
        if (!result.ok) { setError(result.message); return; }
        if (navigate && result.value.href) { onOpen?.(); router.push(result.value.href); }
        else if (navigate && !result.value.href) setError("Материал больше недоступен. Уведомление отмечено прочитанным.");
      } catch { setError("Не удалось обновить уведомление. Попробуйте снова."); }
    });
  }
  return <div aria-busy={pending}>
    {error && <p role="alert" className="mb-3 break-words text-sm text-destructive">{error}</p>}
    {items.length ? <ul className="divide-y divide-border">{items.map((item) => {
      const Icon = icons[item.type];
      return <li key={item.id} data-notification-id={item.id} className="flex min-w-0 gap-3 py-4">
        <Icon className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {item.href ? <button disabled={pending} onClick={() => read(item, true)} className="w-full cursor-pointer break-words text-left text-sm leading-6 hover:underline disabled:opacity-60">{item.text}</button>
            : <p className="break-words text-sm leading-6">{item.text}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short" })}</time>
            <span className={item.unread ? "font-medium text-primary" : ""}>{item.unread ? "Новое" : "Прочитано"}</span>
          </div>
          {item.unread && <button disabled={pending} onClick={() => read(item, false)} className="mt-1 inline-flex min-h-9 items-center gap-1 text-xs text-primary underline underline-offset-4 disabled:opacity-60"><Check className="size-3" aria-hidden="true" />Отметить прочитанным</button>}
        </div>
      </li>;
    })}</ul> : <p className="py-8 text-sm leading-6 text-muted-foreground">Здесь пока нет уведомлений. Новые события появятся здесь.</p>}
  </div>;
}
export function ReadAllNotificationsButton({ disabled = false }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div><Button variant="outline" disabled={disabled || pending} onClick={() => {
    setError(""); startTransition(async () => {
      try { const result = await readAllNotificationsAction(); if (!result.ok) setError(result.message); }
      catch { setError("Не удалось обновить уведомления. Попробуйте снова."); }
    });
  }}>{pending ? "Сохраняем…" : "Прочитать все"}</Button>{error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}</div>;
}
