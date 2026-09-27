import Link from "next/link";
import { connection } from "next/server";
import { getPublicCategories } from "@/features/public-content/queries";
import { publicMetadata } from "@/features/public-content/metadata";
export const metadata = publicMetadata("Категории", "Выберите тему и найдите новые истории авторов Narra.", "/categories");
export default async function CategoriesPage() {
  await connection();
  const categories = await getPublicCategories();
  return <main id="main-content" tabIndex={-1} className="page-container py-12"><p className="eyebrow text-primary">Навстречу новому</p><h1 className="my-6 font-editorial text-4xl">Темы журнала</h1><div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <section key={category.slug} className="border-b border-border py-7"><h2 className="font-editorial text-2xl"><Link href={`/categories/${category.slug}`} className="hover:text-primary">{category.name} ↗</Link></h2>{category.description && <p className="mt-3 text-sm leading-7 text-muted-foreground">{category.description}</p>}</section>)}</div>{!categories.length && <p>Темы скоро появятся.</p>}</main>;
}
