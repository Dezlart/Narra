"use client";
import { useEffect } from "react";
import { prepareVisitorAction, registerArticleViewAction } from "./actions";
let preparing: Promise<boolean> | undefined;
export function ViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    let cancelled = false;
    async function track() {
      try {
        const ready = await (preparing ??= prepareVisitorAction().finally(() => { preparing = undefined; }));
        if (ready && !cancelled) await registerArticleViewAction(articleId);
      } catch { /* Reading works even when analytics is unavailable. */ }
    }
    function visible() { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", visible); void track(); } }
    if (document.visibilityState === "visible") void track();
    else document.addEventListener("visibilitychange", visible);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", visible); };
  }, [articleId]);
  return null;
}
