"use client";

import { useEffect } from "react";

/** Revalidate authorization when the browser restores a private document from BFCache. */
export function PrivatePageLifecycle() {
  useEffect(() => {
    function onShow(event: PageTransitionEvent) { if (event.persisted) window.location.reload(); }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return null;
}
