import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { emptyDocument, safeLink, validDocument } from "@/features/articles/content";
import { draftFieldsSchema, saveDraftSchema, tagNameSchema } from "@/features/articles/schemas";
import { RichText } from "@/features/articles/rich-text";
import { prepareImage, MAX_IMAGE_BYTES } from "@/features/articles/image-processing";
import { safeReturnTo } from "@/features/auth/schemas";
const paragraph = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
describe("bounded article documents", () => {
  it("accepts empty and formatted supported blocks", () => {
    expect(validDocument(emptyDocument)).toBe(true);
    expect(validDocument({ type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Заголовок", marks: [{ type: "bold" }] }] },
      { type: "orderedList", attrs: { start: 2, type: null }, content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
      { type: "image", attrs: { src: "/api/articles/a/images/i", alt: "Описание", title: null, width: null, height: null } },
      { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "const n = 1;" }] },
    ] })).toBe(true);
  });
  it.each(["javascript:alert(1)", "data:text/html,test", "//evil.example", "file:///secret", "https://user:pass@example.com", "https://exa\nmple.com"])("rejects unsafe URL %s", (href) => {
    expect(safeLink(href)).toBe(false);
    expect(validDocument({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }] }] })).toBe(false);
  });
  it.each(["https://example.com/story", "http://localhost:3000", "mailto:hello@example.com"])("accepts safe URL %s", (value) => expect(safeLink(value)).toBe(true));
  it("accepts Tiptap 3 link attributes and bounds optional titles", () => {
    const linkDocument = (title: unknown) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Ссылка", marks: [{ type: "link", attrs: { href: "https://example.com/", target: "_blank", rel: "noopener noreferrer nofollow", class: null, title } }] }] }] });
    expect(validDocument(linkDocument(null))).toBe(true);
    expect(validDocument(linkDocument("Источник"))).toBe(true);
    expect(validDocument(linkDocument("x".repeat(301)))).toBe(false);
    expect(validDocument(linkDocument({ onclick: "alert(1)" }))).toBe(false);
  });
  it.each([
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }] },
    { type: "doc", content: [{ type: "image", attrs: { src: "https://evil.example/track" } }] },
    { type: "doc", content: [{ type: "image", attrs: { src: "data:image/svg+xml,test" } }] },
    { type: "doc", content: [{ type: "heading", attrs: { level: 6 } }] },
    { type: "doc", content: [{ type: "text", text: "not a block" }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "image", attrs: { src: "/api/articles/a/images/i" } }] }] },
    { type: "doc", content: [{ type: "bulletList", content: [{ type: "paragraph" }] }] },
  ])("rejects unexpected nodes, attributes and nesting", (content) => expect(validDocument(content)).toBe(false));
  it("bounds text size, depth and node count", () => {
    expect(validDocument(paragraph("a".repeat(100001)))).toBe(false);
    let nested: unknown = { type: "paragraph" };
    for (let i = 0; i < 30; i++) nested = { type: "blockquote", content: [nested] };
    expect(validDocument({ type: "doc", content: [nested] })).toBe(false);
    expect(validDocument({ type: "doc", content: Array.from({ length: 10001 }, () => ({ type: "paragraph" })) })).toBe(false);
  });
  it("renders text as escaped React content", () => {
    const html = renderToStaticMarkup(createElement(RichText, { content: paragraph('<script>alert("x")</script>') }));
    expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
  });
});
describe("draft input boundaries", () => {
  it("rejects privileged and unknown fields at both levels", () => {
    const input = { articleId: "a", revisionId: "r", editVersion: 0, patch: { title: "Title" } };
    for (const key of ["authorId", "status", "publishedRevisionId", "reviewedById", "version", "editVersion"]) {
      expect(saveDraftSchema.safeParse({ ...input, patch: { [key]: "APPROVED" } }).success).toBe(false);
    }
    expect(saveDraftSchema.safeParse({ ...input, status: "PUBLISHED" }).success).toBe(false);
    expect(saveDraftSchema.safeParse({ ...input, patch: {} }).success).toBe(false);
  });
  it("normalizes tags, deduplicates and limits count", () => {
    expect(tagNameSchema.parse("  ДИЗАЙН  ")).toBe("дизайн");
    expect(tagNameSchema.parse("Ｃ＋＋")).toBe("c++");
    const fields = { title: "", excerpt: "", content: emptyDocument, categoryId: null, coverImage: null, tags: ["Дизайн", "дизайн"] };
    expect(draftFieldsSchema.parse(fields).tags).toEqual(["дизайн"]);
    expect(draftFieldsSchema.safeParse({ ...fields, tags: Array(9).fill("tag") }).success).toBe(false);
  });
  it("only expands returnTo to actual editor and article routes", () => {
    expect(safeReturnTo("/editor/abc-123")).toBe("/editor/abc-123");
    expect(safeReturnTo("/dashboard/articles")).toBe("/dashboard/articles");
    for (const url of ["/editor/../admin", "/editor/%2f%2fevil", "/editor/a?next=//evil", "//evil"]) expect(safeReturnTo(url)).toBe("/dashboard");
  });
});
describe("image decoding", () => {
  it.each(["jpeg", "png", "webp"] as const)("decodes %s and emits a static WebP", async (format) => {
    const source = await sharp({ create: { width: 4, height: 3, channels: 3, background: "#b8492e" } }).toFormat(format).toBuffer();
    const output = await prepareImage(source, `image/${format}`);
    expect((await sharp(output).metadata()).format).toBe("webp");
  });
  it("rejects spoofed types, SVG, oversized and corrupt images", async () => {
    await expect(prepareImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png")).rejects.toThrow();
    await expect(prepareImage(Buffer.from("no image"), "image/jpeg")).rejects.toThrow();
    await expect(prepareImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/png")).rejects.toThrow();
    await expect(prepareImage(Buffer.from("svg"), "image/svg+xml")).rejects.toThrow();
  });
});
