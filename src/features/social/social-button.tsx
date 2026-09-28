"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, Heart, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { likeArticleAction, unlikeArticleAction } from "@/features/likes/actions";
import { saveArticleAction, unsaveArticleAction } from "@/features/bookmarks/actions";
import { followUserAction, unfollowUserAction } from "@/features/follows/actions";

export type Viewer = "guest" | "member" | "banned";
export function SocialButton({ kind, target, active, viewer = "member", returnTo, count }: {
  kind: "like" | "bookmark" | "follow"; target: string; active: boolean; viewer?: Viewer; returnTo: string; count?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const label = kind === "like" ? (active ? "Убрать лайк" : "Нравится") : kind === "bookmark" ? (active ? "Убрать из закладок" : "Сохранить") : active ? "Отписаться" : "Подписаться";
  const Icon = kind === "like" ? Heart : kind === "bookmark" ? Bookmark : active ? UserCheck : UserPlus;
  const content = <><Icon aria-hidden="true" className={active && kind !== "follow" ? "fill-current" : ""} />{label}{count !== undefined && <span>{count}</span>}</>;
  function act() {
    setError("");
    startTransition(async () => {
      try {
        const result = kind === "like" ? await (active ? unlikeArticleAction : likeArticleAction)({ articleId: target })
          : kind === "bookmark" ? await (active ? unsaveArticleAction : saveArticleAction)({ articleId: target })
            : await (active ? unfollowUserAction : followUserAction)({ username: target });
        if (!result.ok) setError(result.message);
      } catch { setError("Не удалось связаться с сервером. Попробуйте ещё раз."); }
    });
  }
  return <div className="min-w-0">
    {viewer === "guest" ? <Button variant="outline" asChild><Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>{content}</Link></Button>
      : <Button variant={active ? "secondary" : "outline"} aria-pressed={active} disabled={pending || viewer === "banned"} aria-busy={pending} onClick={act}>{content}</Button>}
    {error && <p role="alert" className="mt-2 max-w-xs text-sm text-destructive">{error}</p>}
  </div>;
}
