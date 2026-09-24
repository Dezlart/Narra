"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="page-container flex min-h-[55vh] flex-col items-start justify-center py-16">
      <p className="eyebrow mb-4 text-primary">Что-то пошло не так</p>
      <h1 className="font-editorial text-4xl leading-tight">Не удалось загрузить страницу</h1>
      <p className="mt-4 mb-8 text-muted-foreground">Попробуйте ещё раз. Если ошибка повторится, вернитесь чуть позже.</p>
      <Button onClick={reset}><RotateCcw aria-hidden="true" /> Попробовать снова</Button>
    </main>
  );
}
