import "server-only";
import type { Metadata } from "next";
import { publicImageUrl } from "./images";
import { storageConfigured } from "@/features/articles/images";

/** Explicit deployment origin only; never infer it from request Host/auth URL. */
export function siteOrigin(): string | undefined {
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash
      || url.hostname === "localhost" || url.hostname === "127.0.0.1") return undefined;
    return url.origin;
  } catch { return undefined; }
}
export function publicMetadata(title: string, description: string, path: string): Metadata {
  const origin = siteOrigin();
  return { title: `${title} — Narra`, description,
    ...(origin ? { alternates: { canonical: origin + path } } : {}),
    openGraph: { title, description, siteName: "Narra", locale: "ru_RU", type: "website",
      ...(origin ? { url: origin + path } : {}) },
  };
}
export function articleMetadata(article: { slug: string; title: string; excerpt: string; coverImage: string | null; publishedAt: Date }): Metadata {
  const metadata = publicMetadata(article.title, article.excerpt, `/articles/${article.slug}`);
  const origin = siteOrigin();
  const cover = article.coverImage && publicImageUrl(article.coverImage);
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article", publishedTime: article.publishedAt.toISOString(),
    ...(origin && cover && storageConfigured() ? { images: [{ url: origin + cover }] } : {}) } };
}
