import { ViewTracker } from "@/features/analytics/view-tracker";
import { ContentImage } from "@/features/articles/content-image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedArticleBySlug, getRelatedPublishedArticles } from "@/features/public-content/queries";
import { ArticleCard, AuthorLink, PublicationDate } from "@/features/public-content/article-card";
import { articleMetadata } from "@/features/public-content/metadata";
import { publicImageUrl } from "@/features/public-content/images";
import { RichText } from "@/features/articles/rich-text";
import { Suspense } from "react";
import { ArticleSocial } from "@/features/social/article-social";
import { Discussion } from "@/features/comments/discussion";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ commentsPage?: string }> };
async function readArticle(params: Props["params"]) {
  await connection();
  const article = await getPublishedArticleBySlug((await params).slug);
  if (!article) notFound();
  return article;
}
export async function generateMetadata({ params }: Props) { return articleMetadata(await readArticle(params)); }
export default async function ArticlePage({ params, searchParams }: Props) {
  const article = await readArticle(params);
  const related = article.category ? await getRelatedPublishedArticles(article.id, article.category.slug) : [];
  return <main id="main-content" tabIndex={-1} className="page-container py-10 sm:py-16">
    <ViewTracker articleId={article.id} />
    <article>
      <header className="mx-auto max-w-4xl">
        {article.category && <Link href={`/categories/${article.category.slug}`} className="text-sm text-primary hover:underline">{article.category.name}</Link>}
        <h1 className="mt-5 wrap-anywhere font-editorial text-[clamp(2rem,4.5vw,3.7rem)] leading-[1.15] tracking-tight">{article.title}</h1>
        <p className="mt-6 wrap-anywhere text-lg leading-8 text-muted-foreground">{article.excerpt}</p>
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3"><AuthorLink author={article.author} /><span className="text-xs text-muted-foreground"><PublicationDate date={article.publishedAt} /></span><span className="text-xs text-muted-foreground">≈ {article.readingMinutes} мин чтения</span></div>
        <Suspense fallback={<p role="status" className="mt-7 text-sm text-muted-foreground">Загружаем реакции…</p>}><ArticleSocial articleId={article.id} path={`/articles/${article.slug}`} /></Suspense>
      </header>
      {article.coverImage && <div className="mx-auto mt-10 max-w-5xl"><ContentImage src={publicImageUrl(article.coverImage)} alt="" width={1600} height={1000} className="h-auto w-full rounded-sm" /></div>}
      <div className="mx-auto mt-12 min-w-0 max-w-reading"><RichText content={article.content} imageUrl={publicImageUrl} />
        <footer className="mt-12 border-y border-border py-7">
          <div className="mb-6 flex flex-wrap gap-3">{article.category && <Link href={`/categories/${article.category.slug}`} className="text-sm text-primary hover:underline">{article.category.name}</Link>}{article.tags.map((tag) => <Link key={tag.slug} href={`/tags/${tag.slug}`} className="break-all text-sm text-primary hover:underline">#{tag.name}</Link>)}</div>
          <AuthorLink author={article.author} /><p className="mt-3 text-xs text-muted-foreground">Опубликовано <PublicationDate date={article.publishedAt} /></p>
        </footer>
      </div>
    </article>
    <Suspense fallback={<p role="status" className="py-12 text-center text-muted-foreground">Загружаем обсуждение…</p>}><Discussion articleId={article.id} path={`/articles/${article.slug}`} page={(await searchParams).commentsPage} /></Suspense>
    {related.length > 0 && <section className="mt-16" aria-labelledby="related-title"><h2 id="related-title" className="section-title mb-8 font-editorial">Ещё в этой теме</h2><div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">{related.map((item) => <ArticleCard key={item.id} article={item} />)}</div></section>}
  </main>;
}
