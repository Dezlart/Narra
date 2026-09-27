import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicCategory, getPublishedArticlesByCategory } from "@/features/public-content/queries";
import { ArticleFeed, FeedSkeleton } from "@/features/public-content/feed";
import { publicMetadata } from "@/features/public-content/metadata";
import type { SearchParams } from "@/features/public-content/params";
type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };
async function category(params: Props["params"]) {
  await connection();
  const value = await getPublicCategory((await params).slug);
  if (!value) notFound();
  return value;
}
export async function generateMetadata({ params }: Props) {
  const value = await category(params);
  return publicMetadata(value.name, value.description || `Опубликованные истории на тему «${value.name}».`, `/categories/${value.slug}`);
}
async function Feed({ slug, searchParams }: { slug: string; searchParams: SearchParams }) {
  const feed = await getPublishedArticlesByCategory(slug, (await searchParams).page);
  return <ArticleFeed feed={feed} path={`/categories/${slug}`} />;
}
export default async function CategoryPage({ params, searchParams }: Props) {
  const value = await category(params);
  return <main id="main-content" tabIndex={-1} className="page-container py-12"><p className="eyebrow text-primary">Тема журнала</p><h1 className="my-5 break-words font-editorial text-4xl">{value.name}</h1>{value.description && <p className="mb-8 max-w-2xl leading-7 text-muted-foreground">{value.description}</p>}<div className="mt-10"><Suspense fallback={<FeedSkeleton />}><Feed slug={value.slug} searchParams={searchParams} /></Suspense></div></main>;
}
