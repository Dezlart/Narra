import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicTag, getPublishedArticlesByTag } from "@/features/public-content/queries";
import { ArticleFeed, FeedSkeleton } from "@/features/public-content/feed";
import { publicMetadata } from "@/features/public-content/metadata";
import type { SearchParams } from "@/features/public-content/params";
type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };
async function tag(params: Props["params"]) {
  await connection();
  const value = await getPublicTag((await params).slug);
  if (!value) notFound();
  return value;
}
export async function generateMetadata({ params }: Props) {
  const value = await tag(params);
  return publicMetadata(`#${value.name}`, `Опубликованные истории с тегом «${value.name}».`, `/tags/${value.slug}`);
}
async function Feed({ slug, searchParams }: { slug: string; searchParams: SearchParams }) {
  return <ArticleFeed feed={await getPublishedArticlesByTag(slug, (await searchParams).page)} path={`/tags/${slug}`} />;
}
export default async function TagPage({ params, searchParams }: Props) {
  const value = await tag(params);
  return <main id="main-content" tabIndex={-1} className="page-container py-12"><p className="eyebrow text-primary">Общий интерес</p><h1 className="my-6 break-all font-editorial text-4xl">#{value.name}</h1><div className="mt-10"><Suspense fallback={<FeedSkeleton />}><Feed slug={value.slug} searchParams={searchParams} /></Suspense></div></main>;
}
