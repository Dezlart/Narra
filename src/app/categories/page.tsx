import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { getPublicCategories } from "@/features/public-content/queries";
import { publicMetadata } from "@/features/public-content/metadata";
export const metadata = publicMetadata("Категории", "Выберите тему и найдите новые истории авторов Narra.", "/categories");
export default async function CategoriesPage() {
  await connection();
  const categories = await getPublicCategories();
  return <main id="main-content" tabIndex={-1} className="page-container py-10 sm:py-14">
    <header className="mb-8 max-w-2xl sm:mb-10"><p className="eyebrow flex items-center gap-2 text-primary"><LayoutGrid className="size-4" aria-hidden="true" />Все направления</p><h1 className="mt-4 font-editorial text-4xl tracking-tight sm:text-5xl">Категории</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">Выберите тему и откройте опубликованные истории авторов Narra.</p></header>
    {categories.length ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <Link key={category.slug} href={`/categories/${category.slug}`} className="group flex min-h-36 items-start justify-between gap-5 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-primary/3 sm:p-6">
      <span className="min-w-0"><span className="block wrap-anywhere font-editorial text-2xl leading-tight group-hover:text-primary">{category.name}</span><span className="mt-3 line-clamp-2 block text-sm leading-6 text-muted-foreground">{category.description || "Смотреть публикации в этой категории."}</span></span>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"><ArrowRight className="size-4" aria-hidden="true" /></span>
    </Link>)}</div> : <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"><LayoutGrid className="mx-auto mb-4 size-8 text-muted-foreground" aria-hidden="true" /><p className="font-editorial text-2xl">Темы скоро появятся</p><p className="mt-2 text-sm text-muted-foreground">Категории будут доступны после публикации первых материалов.</p></div>}
  </main>;
}
