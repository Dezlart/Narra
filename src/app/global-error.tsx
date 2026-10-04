"use client";
import "./globals.css";

/** Root layout failures (including session storage) bypass the segment boundary. */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="ru"><body><main className="page-container py-20">
    <h1 className="font-editorial text-3xl">Narra временно недоступна</h1>
    <p className="my-6">Не удалось загрузить страницу. Попробуйте ещё раз чуть позже.</p>
    <button onClick={retry} className="min-h-11 rounded-md bg-primary px-5 py-3 text-primary-foreground">Попробовать снова</button>
  </main></body></html>;
}
