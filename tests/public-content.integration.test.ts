import "dotenv/config";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPrisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth/server";
import { createArticleDraft, createDraftRevision, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { submitArticleForModeration, approveArticleRevision, rejectArticleRevision } from "@/features/moderation/service";
import { getPublishedArticles, getPublishedArticleBySlug, getPublishedArticlesByAuthor, getPublishedArticlesByCategory, getPublishedArticlesByTag, getPublicTag, searchPublishedArticles } from "@/features/public-content/queries";
import { getPublishedImageRecord, readPublishedImage } from "@/features/public-content/images";
import { articleMetadata } from "@/features/public-content/metadata";
import { getPublicSitemapPaths } from "@/features/public-content/sitemap";
import type { RichNode } from "@/features/articles/content";

const db = getPrisma();
const run = randomBytes(6).toString("hex");
const emails = [0, 1].map((i) => `narra-public-${run}-${i}@example.test`);
const usernames = [0, 1].map((i) => `public_${run}_${i}`);
const users: { id: string; headers: Headers }[] = [];
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const categories: { id: string; slug: string }[] = [];
const tags = [`public-${run}`, `private-${run}`];
const body = (text: string): RichNode => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const originalText = "Одобренная история о людях и городе. Настоящий текст для проверки публичной страницы.";
const title = `История ${run}`;
const privateTitle = `Скрытый-${run}`;
let slug: string;
let articleId: string;
let revisionId: string;
let imageA: string;
let imageB: string;
let tagSlug: string;
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: `Автор ${run}`, email: emails[i], username: usernames[i], password: randomBytes(24).toString("base64url") }),
    }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).filter((value) => /^(?:__Secure-)?better-auth.session_token=/.test(value)).join("; ");
    users.push({ id: (await db.user.findUniqueOrThrow({ where: { email: emails[i] } })).id, headers: new Headers({ cookie }) });
  }
  await db.user.update({ where: { id: users[1].id }, data: { role: "MODERATOR" } });
  for (let i = 0; i < 2; i++) categories.push(await db.category.create({ data: { slug: `qa-public-${run}-${i}`, name: `Тема ${i} ${run}` } }));
  await db.article.create({ data: { authorId: users[0].id, slug: `qa-hidden-${run}`, revisions: { create: { version: 1, title: `HiddenDraft-${run}`, content: body(originalText) } } } });
}, 120000);
afterAll(async () => {
  try {
    const owned = { author: { email: { in: emails } } };
    await db.article.updateMany({ where: owned, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: owned });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.category.deleteMany({ where: { slug: { startsWith: `qa-public-${run}-` } } });
    await db.tag.deleteMany({ where: { name: { in: tags }, revisions: { none: {} } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } finally { await db.$disconnect(); }
}, 120000);
function browser(stage: string) {
  if (process.env.NARRA_BROWSER_QA) {
    const output = execFileSync(process.execPath, [process.env.NARRA_BROWSER_QA, JSON.stringify({ stage, slug, articleId, imageId: stage === "updated" ? imageB : imageA, username: usernames[0], category: categories[stage === "updated" ? 1 : 0].slug, tag: tagSlug, title: stage === "updated" ? privateTitle : title, privateTitle, run })], { encoding: "utf8", timeout: 180000 });
    console.log(output.trim());
  }
}
describe("real public content and discovery", () => {
  it("hides first draft/pending/rejected and publishes only after real approval", async () => {
    articleId = (await createArticleDraft(users[0].headers)).articleId;
    const draft = (await getArticleDraftById(articleId, users[0].headers)).draft!;
    revisionId = draft.revisionId;
    slug = (await db.article.findUniqueOrThrow({ where: { id: articleId } })).slug!;
    const images = await Promise.all(["a", "b"].map((name) => db.articleImage.create({ data: { articleId, pathname: `qa-public/${run}/${name}.webp` } })));
    [imageA, imageB] = images.map((image) => image.id);
    // Metadata records only: this does not pretend an object was uploaded to Blob.
    await updateArticleDraft({ articleId, revisionId, editVersion: 0, patch: { title, excerpt: `Опубликованное описание ${run}`, content: body(originalText), categoryId: categories[0].id, tags: [tags[0]], coverImage: `/api/articles/${articleId}/images/${imageA}` } }, users[0].headers);
    expect(await getPublishedArticleBySlug(slug)).toBeNull();
    expect((await searchPublishedArticles(title, 1)).items).toHaveLength(0);
    expect((await getPublishedArticlesByAuthor(usernames[0], 1)).items).toHaveLength(0);
    expect(await getPublishedImageRecord(articleId, imageA)).toBeNull();
    await submitArticleForModeration({ articleId, revisionId, editVersion: 1 }, users[0].headers);
    expect(await getPublishedArticleBySlug(slug)).toBeNull();
    await rejectArticleRevision({ revisionId, reason: "Нужна проверка источников." }, users[1].headers);
    expect(await getPublishedArticleBySlug(slug)).toBeNull();
    const copy = await createDraftRevision(articleId, users[0].headers);
    revisionId = copy.revisionId;
    await submitArticleForModeration({ articleId, revisionId, editVersion: 0 }, users[0].headers);
    await approveArticleRevision({ revisionId }, users[1].headers);
    const published = await getPublishedArticleBySlug(slug);
    expect(published).toMatchObject({ title, content: body(originalText), readingMinutes: 1 });
    expect((await getPublishedArticles()).items.some((a) => a.id === articleId)).toBe(true);
    expect(await getPublishedImageRecord(articleId, imageA)).not.toBeNull();
    expect(await getPublishedImageRecord(articleId, imageB)).toBeNull();
    expect(await getPublishedImageRecord("foreign", imageA)).toBeNull();
    expect(await getPublishedImageRecord(articleId, "../../secret")).toBeNull();
    await expect(readPublishedImage(articleId, imageB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    tagSlug = published!.tags[0].slug;
    expect((await getPublishedArticlesByCategory(categories[0].slug, 1)).items.map((a) => a.id)).toContain(articleId);
    expect((await getPublishedArticlesByTag(tagSlug, 1)).items.map((a) => a.id)).toContain(articleId);
  }, 180000);
  it("keeps metadata, images, search and taxonomy on the published snapshot through draft/pending/rejection", async () => {
    const before = await getPublishedArticleBySlug(slug);
    const draft = await createDraftRevision(articleId, users[0].headers);
    const input = { articleId, revisionId: draft.revisionId, editVersion: 0 };
    const updatedContent: RichNode = { type: "doc", content: [...body(`Приватный текст ${run} ` + "слово ".repeat(420)).content!,
      { type: "image", attrs: { src: `/api/articles/${articleId}/images/${imageB}`, alt: "Иллюстрация новой версии" } }] };
    await updateArticleDraft({ ...input, patch: { title: privateTitle, excerpt: `СекретноеОписание-${run}`, categoryId: categories[1].id, tags: [tags[1]], content: updatedContent, coverImage: null } }, users[0].headers);
    expect(await getPublishedArticleBySlug(slug)).toEqual(before);
    await submitArticleForModeration({ ...input, editVersion: 1 }, users[0].headers);
    const pendingTag = await db.tag.findFirstOrThrow({ where: { name: tags[1] } });
    expect(await getPublicTag(pendingTag.slug)).toBeNull();
    expect((await getPublishedArticlesByTag(pendingTag.slug, 1)).items).toHaveLength(0);
    expect((await getPublishedArticlesByCategory(categories[1].slug, 1)).items).toHaveLength(0);
    expect((await searchPublishedArticles(privateTitle, 1)).items).toHaveLength(0);
    expect((await searchPublishedArticles(`СекретноеОписание-${run}`, 1)).items).toHaveLength(0);
    expect(articleMetadata((await getPublishedArticleBySlug(slug))!)).toMatchObject({ title: `${title} — Narra`, description: before!.excerpt });
    expect(await getPublishedImageRecord(articleId, imageA)).not.toBeNull(); expect(await getPublishedImageRecord(articleId, imageB)).toBeNull();
    // Extra real DB fixtures solely for stable pagination, never product/demo data.
    for (let i = 0; i < 13; i++) {
      const formatted: RichNode = { type: "doc", content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Город начинается с внимания" }] },
        ...body(originalText).content!,
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Заметить повседневное" }] },
        { type: "paragraph", content: [{ type: "text", text: "Важная мысль", marks: [{ type: "bold" }] }, { type: "text", text: " и маленькая деталь.", marks: [{ type: "italic" }] }] },
        { type: "blockquote", content: body("Хорошая история начинается с простого вопроса.").content },
        { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Попробовать самому" }] },
        { type: "bulletList", content: [{ type: "listItem", content: body("Выбрать новый маршрут").content }] },
        { type: "orderedList", content: [{ type: "listItem", content: body("Записать наблюдения").content }] },
        { type: "paragraph", content: [{ type: "text", text: "https://example.test/" + "long-link".repeat(35), marks: [{ type: "link", attrs: { href: "https://example.test/" } }] }] },
        { type: "codeBlock", content: [{ type: "text", text: "const observation = '" + "long-code".repeat(50) + "';" }] },
      ] };
      const row = await db.article.create({ data: { authorId: users[0].id, slug: `qa-page-${run}-${i}`, revisions: { create: { version: 1, status: "APPROVED", title: `Публикация ${run} ${i}`, excerpt: "Описание опубликованного материала", content: i === 0 ? formatted : body(originalText), categoryId: categories[0].id, tags: { create: { tag: { connect: { slug: tagSlug } } } } } } }, include: { revisions: true } });
      await db.article.update({ where: { id: row.id }, data: { status: "PUBLISHED", publishedRevisionId: row.revisions[0].id, publishedAt: new Date("2026-01-01") } });
    }
    // Browser QA reports storage-unavailable for metadata-only image fixtures;
    // it never treats them as successful cloud uploads.
    browser("pending");
    await rejectArticleRevision({ revisionId: input.revisionId, reason: "Требуются уточнения текста." }, users[1].headers);
    expect(await getPublishedArticleBySlug(slug)).toEqual(before);
    const correction = await createDraftRevision(articleId, users[0].headers);
    await submitArticleForModeration({ articleId, revisionId: correction.revisionId, editVersion: 0 }, users[0].headers);
    await approveArticleRevision({ revisionId: correction.revisionId }, users[1].headers);
    const after = (await getPublishedArticleBySlug(slug))!;
    expect(after).toMatchObject({ title: privateTitle, excerpt: `СекретноеОписание-${run}`, publishedAt: before!.publishedAt, readingMinutes: 3 });
    expect(after.category?.slug).toBe(categories[1].slug); expect(after.tags[0].slug).toBe(pendingTag.slug);
    expect(articleMetadata(after).title).toBe(`${privateTitle} — Narra`);
    expect((await getPublishedArticlesByCategory(categories[0].slug, 1)).items.map((a) => a.id)).not.toContain(articleId);
    expect((await getPublishedArticlesByCategory(categories[1].slug, 1)).items.map((a) => a.id)).toContain(articleId);
    expect((await searchPublishedArticles(privateTitle, 1)).items.map((a) => a.id)).toContain(articleId);
    expect(await getPublishedImageRecord(articleId, imageA)).toBeNull(); expect(await getPublishedImageRecord(articleId, imageB)).not.toBeNull();
    tagSlug = pendingTag.slug;
    browser("updated");
  }, 480000);
  it("paginates all catalogues stably, escapes wildcards and keeps private data out", async () => {
    const first = await getPublishedArticlesByAuthor(usernames[0], 1);
    const second = await getPublishedArticlesByAuthor(usernames[0], 2);
    expect(first.items).toHaveLength(12); expect(first.hasNext).toBe(true); expect(second.items).toHaveLength(2); expect(second.hasNext).toBe(false);
    expect(new Set([...first.items, ...second.items].map((a) => a.id)).size).toBe(14);
    expect((await getPublishedArticlesByAuthor(usernames[0], "-1")).items).toEqual(first.items);
    expect((await getPublishedArticlesByAuthor(usernames[0], 9999)).items).toHaveLength(0);
    expect((await searchPublishedArticles(usernames[0], 2)).items).toHaveLength(2);
    expect((await searchPublishedArticles(`Автор ${run}`, 1)).items).toHaveLength(12);
    expect((await searchPublishedArticles(" ", 1)).items).toHaveLength(0);
    expect((await searchPublishedArticles("x".repeat(121), 1)).error).toBeTruthy();
    expect((await searchPublishedArticles(`%' OR 1=1 -- ${run}`, 1)).items).toHaveLength(0);
    expect((await searchPublishedArticles(`%${run}`, 1)).items).toHaveLength(0);
    const serialized = JSON.stringify(first);
    for (const secret of [emails[0], "rejectionReason", "reviewedById", "editVersion", "pathname", "content"]) expect(serialized).not.toContain(secret);
    expect((await getPublicSitemapPaths()).some((row) => row.path === `/articles/${slug}`)).toBe(true);
  }, 120000);
  it("hides archived/nonapproved articles but preserves banned author publications", async () => {
    await db.article.update({ where: { id: articleId }, data: { status: "ARCHIVED" } });
    expect(await getPublishedArticleBySlug(slug)).toBeNull(); expect(await getPublishedImageRecord(articleId, imageB)).toBeNull();
    expect((await getPublicSitemapPaths()).some((row) => row.path === `/articles/${slug}`)).toBe(false);
    await db.article.update({ where: { id: articleId }, data: { status: "PUBLISHED" } });
    const pointer = (await db.article.findUniqueOrThrow({ where: { id: articleId } })).publishedRevisionId!;
    await db.articleRevision.update({ where: { id: pointer }, data: { status: "REJECTED", rejectionReason: "Test inconsistent legacy pointer" } });
    expect(await getPublishedArticleBySlug(slug)).toBeNull(); expect(await getPublishedImageRecord(articleId, imageB)).toBeNull();
    await db.articleRevision.update({ where: { id: pointer }, data: { status: "APPROVED", rejectionReason: null } });
    await db.user.update({ where: { id: users[0].id }, data: { isBanned: true } });
    expect((await getPublishedArticlesByAuthor(usernames[0], 1)).items.length).toBeGreaterThan(0);
    expect((await searchPublishedArticles(run, 1)).items.length).toBeGreaterThan(0);
    expect(await getPublishedArticleBySlug(slug)).not.toBeNull(); expect(await getPublishedImageRecord(articleId, imageB)).not.toBeNull();
  }, 120000);
});
