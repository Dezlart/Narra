import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
import { publicPage, searchInput, literalContains } from "@/features/public-content/params";
import { readingMinutes } from "@/features/articles/reading-time";
import { articleMetadata, siteOrigin } from "@/features/public-content/metadata";
import { publicImageUrl } from "@/features/public-content/images";
import { RichText } from "@/features/articles/rich-text";
import { ArticleCard } from "@/features/public-content/article-card";
afterEach(() => vi.unstubAllEnvs());
describe("public inputs, metadata and safe rendering", () => {
  it.each([undefined, null, [], ["2"], "-1", "0", "1.5", "Infinity", "1e3", "2x", "99999999999999999"])("bounds invalid page %s", (page) => expect(publicPage(page)).toBe(1));
  it("caps valid pages and normalizes search", () => {
    expect(publicPage("2")).toBe(2); expect(publicPage("9999")).toBe(1000);
    expect(searchInput("  город   люди  ")).toEqual({ query: "город люди", error: null });
    expect(searchInput(" ").query).toBe(""); expect(searchInput("x".repeat(121)).error).toBeTruthy();
    expect(literalContains("100%_\\")).toBe("100\\%\\_\\\\");
  });
  it("derives reading time only from valid document text", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "слово ".repeat(401) }] }] };
    expect(readingMinutes(doc)).toBe(3); expect(readingMinutes({ type: "script" })).toBe(1);
  });
  it("never invents production URLs; builds metadata from supplied publication", () => {
    vi.stubEnv("SITE_URL", "");
    const snapshot = { slug: "story-one", title: "Одобренный заголовок", excerpt: "Одобренное описание", coverImage: "/api/articles/a/images/i", publishedAt: new Date("2026-09-01") };
    expect(articleMetadata(snapshot)).toMatchObject({ title: "Одобренный заголовок — Narra", description: snapshot.excerpt });
    expect(articleMetadata(snapshot).alternates).toBeUndefined();
    vi.stubEnv("SITE_URL", "https://narra.example"); vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-only-not-a-real-token");
    expect(articleMetadata(snapshot)).toMatchObject({ alternates: { canonical: "https://narra.example/articles/story-one" }, openGraph: { images: [{ url: "https://narra.example/api/public/articles/a/images/i" }] } });
    for (const value of ["http://localhost:3000", "https://user:password@example.test", "https://example.test/path", "javascript:alert(1)"]) {
      vi.stubEnv("SITE_URL", value); expect(siteOrigin()).toBeUndefined();
    }
  });
  it("maps only internal image sources; renderer rejects script URLs/attributes", () => {
    expect(publicImageUrl("https://storage.example/private")).toBe("");
    expect(publicImageUrl("/api/articles/a/images/i")).toBe("/api/public/articles/a/images/i");
    const invalid = { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }] };
    expect(renderToStaticMarkup(createElement(RichText, { content: invalid }))).not.toContain("onclick");
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "<script>alert(1)</script>" }] }, { type: "image", attrs: { src: "/api/articles/a/images/i", alt: "Подпись" } }] };
    const html = renderToStaticMarkup(createElement(RichText, { content, imageUrl: publicImageUrl }));
    expect(html).toContain("&lt;script&gt;"); expect(html).toContain("/api/public/articles/a/images/i"); expect(html).not.toContain("/_next/image");
  });
  it("renders a real card without invented engagement or storage credentials", () => {
    const html = renderToStaticMarkup(createElement(ArticleCard, { article: { id: "a", likesCount: 3, commentsCount: 2, slug: "s", title: "История", excerpt: "Описание", publishedAt: new Date(), coverImage: null, category: { name: "Тема", slug: "theme" }, readingMinutes: 2, author: { name: "Автор", username: "author" } } }));
    expect(html).toContain('/articles/s'); expect(html).toContain('/profile/author'); expect(html).toContain("≈ 2 мин чтения");
    expect(html).not.toContain("<img"); expect(html).not.toMatch(/просмотр/i); expect(html).toContain("Лайки: 3"); expect(html).toContain("Комментарии: 2");
  });
});
