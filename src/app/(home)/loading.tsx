export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="page-container py-12" aria-busy="true" aria-label="Загрузка страницы">
      <p role="status" className="sr-only">Загружаем Narra…</p>
      <div className="space-y-8 motion-safe:animate-pulse" aria-hidden="true">
        <div className="h-4 w-44 rounded bg-muted" />
        <div className="h-24 w-3/4 rounded bg-muted" />
        <div className="h-96 rounded-lg bg-muted" />
        <div className="grid gap-6 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 rounded-lg bg-muted" />)}</div>
      </div>
    </main>
  );
}
