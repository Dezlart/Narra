"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native disclosure semantics, with keyboard dismissal for navigation panels. */
export function Disclosure({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return <details ref={ref} className={className} onKeyDown={(event) => {
    if (event.key === "Escape" && ref.current?.open) {
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
      event.stopPropagation();
    }
  }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}
    onClick={(event) => { if (event.target instanceof Element && event.target.closest("a[href]") && ref.current) ref.current.open = false; }}>
    {children}
  </details>;
}
