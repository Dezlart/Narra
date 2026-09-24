import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="page-container flex min-h-[55vh] flex-col items-start justify-center py-16">
      <p className="eyebrow mb-4 text-primary">404 / Страница не найдена</p>
      <h1 className="font-editorial text-4xl leading-tight">Эта история ещё не написана</h1>
      <p className="mt-4 mb-8 max-w-lg text-muted-foreground">Проверьте адрес или вернитесь на главную — там начинается знакомство с Narra.</p>
      <Button asChild><Link href="/"><ArrowLeft aria-hidden="true" /> На главную</Link></Button>
    </main>
  );
}
