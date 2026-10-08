import { ContentImage } from "@/features/articles/content-image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Heart, MessageCircle } from "lucide-react";
import { Avatar } from "@/features/users/avatar";
import { cn } from "@/lib/utils";
import type { PublicArticleCard } from "./queries";
import { publicImageUrl } from "./images";

export function PublicationDate({ date }: { date: Date }) {
  return <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)}</time>;
}
export function AuthorLink({ author }: { author: PublicArticleCard["author"] }) {
  const content = <><Avatar name={author.name} /><span className="min-w-0 wrap-anywhere">{author.name}</span></>;
  return author.username ? <Link href={`/profile/${author.username}`} className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm hover:text-primary">{content}</Link>
    : <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm">{content}</span>;
}
export function ArticleCard({ article, featured = false, compact = false }: { article: PublicArticleCard; featured?: boolean; compact?: boolean }) {
  const href = `/articles/${article.slug}`;
  return <article className={cn(
    "min-w-0",
    featured && "grid overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]",
    compact && "grid grid-cols-[6rem_minmax(0,1fr)] gap-3 border-b border-border py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5",
    !featured && !compact && "flex flex-col border-b border-border pb-7",
  )}>
    <Link href={href} tabIndex={-1} aria-hidden="true" className={cn(
      "relative block overflow-hidden bg-muted",
      featured && "aspect-[16/10] md:aspect-auto md:min-h-[24rem]",
      compact && "aspect-[4/3] self-start rounded-lg",
      !featured && !compact && "mb-5 aspect-[16/10] rounded-sm",
    )}>
      {article.coverImage ? <ContentImage src={publicImageUrl(article.coverImage)} alt="" fill sizes={featured ? "(max-width: 767px) 100vw, 42vw" : compact ? "(max-width: 639px) 96px, 176px" : "(max-width: 767px) 100vw, 33vw"} className="object-cover transition-transform duration-300 hover:scale-[1.02]" />
        : <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"><BookOpen className="size-10 stroke-1" /><span className="eyebrow">История в словах</span></div>}
    </Link>
    <div className={cn("flex min-w-0 flex-1 flex-col justify-center", featured && "p-6 sm:p-8", compact && "py-0.5")}>
      {featured && <p className="eyebrow mb-5 text-muted-foreground">Новая публикация</p>}
      {article.category && <Link href={`/categories/${article.category.slug}`} className={cn("w-fit max-w-full font-medium uppercase tracking-[0.12em] text-primary hover:underline", compact ? "mb-2 text-[0.625rem]" : "mb-3 text-xs")}>{article.category.name}</Link>}
      <h2 className={cn("wrap-anywhere font-editorial leading-tight tracking-tight", featured ? "text-3xl sm:text-4xl" : compact ? "text-lg sm:text-2xl" : "text-2xl")}><Link href={href} className="hover:text-primary">{article.title}{featured && <ArrowUpRight className="ml-2 inline size-6" aria-hidden="true" />}</Link></h2>
      <p className={cn("wrap-anywhere text-sm text-muted-foreground", compact ? "mt-2 hidden leading-6 sm:line-clamp-2 sm:block" : "mt-4 leading-7")}>{article.excerpt}</p>
      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", compact ? "mt-3" : "mt-6")}><AuthorLink author={article.author} />
        <span className="text-xs text-muted-foreground"><PublicationDate date={article.publishedAt} /></span>
        <span className="text-xs text-muted-foreground">≈ {article.readingMinutes} мин чтения</span>
      </div>
      <div className={cn("flex flex-wrap gap-4 text-xs text-muted-foreground", compact ? "mt-2" : "mt-3")}><span className="inline-flex items-center gap-1.5" aria-label={`Лайки: ${article.likesCount}`}><Heart className="size-3.5" aria-hidden="true" />{article.likesCount}</span><Link href={`${href}#comments`} className="inline-flex min-h-6 items-center gap-1.5 hover:text-primary" aria-label={`Комментарии: ${article.commentsCount}`}><MessageCircle className="size-3.5" aria-hidden="true" />{article.commentsCount}</Link></div>
    </div>
  </article>;
}
