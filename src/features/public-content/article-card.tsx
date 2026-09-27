import { ContentImage } from "@/features/articles/content-image";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Avatar } from "@/features/users/avatar";
import type { PublicArticleCard } from "./queries";
import { publicImageUrl } from "./images";

export function PublicationDate({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)}</time>;
}
export function AuthorLink({ author }: { author: PublicArticleCard["author"] }) {
  const content = <><Avatar name={author.name} /><span className="min-w-0 break-words">{author.name}</span></>;
  return author.username ? <Link href={`/profile/${author.username}`} className="inline-flex min-w-0 items-center gap-2 text-sm hover:text-primary">{content}</Link>
    : <span className="inline-flex min-w-0 items-center gap-2 text-sm">{content}</span>;
}
export function ArticleCard({ article, featured = false }: { article: PublicArticleCard; featured?: boolean }) {
  const href = `/articles/${article.slug}`;
  return <article className={featured ? "grid min-w-0 gap-6 border-y border-border py-7 md:grid-cols-2 md:gap-10" : "flex min-w-0 flex-col border-b border-border pb-7"}>
    <Link href={href} tabIndex={-1} aria-hidden="true" className="relative mb-5 block aspect-[16/10] overflow-hidden rounded-sm bg-muted">
      {article.coverImage ? <ContentImage src={publicImageUrl(article.coverImage)} alt="" fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" />
        : <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"><BookOpen className="size-10 stroke-1" /><span className="eyebrow">История в словах</span></div>}
    </Link>
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      {featured && <p className="eyebrow mb-5 text-muted-foreground">Новая публикация</p>}
      {article.category && <Link href={`/categories/${article.category.slug}`} className="mb-3 w-fit text-xs font-medium text-primary hover:underline">{article.category.name}</Link>}
      <h2 className={`break-words font-editorial leading-tight tracking-tight ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}><Link href={href} className="hover:text-primary">{article.title}{featured && <ArrowUpRight className="ml-2 inline size-6" aria-hidden="true" />}</Link></h2>
      <p className="mt-4 break-words text-sm leading-7 text-muted-foreground">{article.excerpt}</p>
      <div className="mt-6"><AuthorLink author={article.author} /></div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-6 text-muted-foreground"><PublicationDate date={article.publishedAt} /><span>≈ {article.readingMinutes} мин чтения</span></div>
    </div>
  </article>;
}
