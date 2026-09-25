import type { Metadata } from "next";
import Link from "next/link";
import { requirePageUser } from "@/lib/auth/guards";
import { CreateDraftButton } from "@/features/articles/draft-buttons";
export const metadata: Metadata = { title: "Новая история", robots: { index: false, follow: false } };
export default async function NewArticlePage() {
  await requirePageUser("/editor/new");
  return <main id="main-content" tabIndex={-1} className="page-container py-16 sm:py-24"><div className="mx-auto max-w-reading">
    <Link href="/dashboard/articles" className="text-sm text-muted-foreground hover:text-primary">← Мои статьи</Link>
    <p className="eyebrow mb-5 mt-12 text-primary">Место для вашей истории</p><h1 className="font-editorial text-4xl leading-tight sm:text-6xl">О чём вы хотите рассказать?</h1>
    <p className="my-8 max-w-xl leading-8 text-muted-foreground">Начните с мысли, наблюдения или вопроса. Черновик будет виден только вам — к нему можно вернуться в любое время.</p><CreateDraftButton />
  </div></main>;
}
