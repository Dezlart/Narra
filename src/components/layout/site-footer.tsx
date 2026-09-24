import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border py-8">
      <div className="page-container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/" className="wordmark text-3xl" aria-label="Narra — на главную">narra<span className="text-primary">.</span></Link>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Независимые голоса. Новые точки зрения.<br />Все материалы на этой странице — демонстрационные.</p>
        <a href="#top" className="text-sm underline decoration-border underline-offset-4 hover:decoration-primary">Наверх ↑</a>
      </div>
    </footer>
  );
}
