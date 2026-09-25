import "dotenv/config";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getAuth } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import { createArticleDraft, createDraftRevision, deleteArticleDraft, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { listOwnArticles } from "@/features/articles/queries";
import { readArticleImage, uploadArticleImage } from "@/features/articles/images";
import { POST as uploadRoute } from "@/app/api/articles/[id]/images/route";
import sharp from "sharp";
const run = randomBytes(6).toString("hex");
const emails = [0, 1].map((i) => `narra-articles-${run}-${i}@example.test`);
const tag = `test-${run}`;
const ip = `198.19.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const users: { id: string; headers: Headers }[] = [];
let categoryId: string;
const prisma = getPrisma();
beforeAll(async () => {
  for (let i = 0; i < 2; i++) {
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, { method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ name: "Тест статей", email: emails[i], username: `articles_${run}_${i}`, password: randomBytes(24).toString("base64url") }) }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => /^(?:__Secure-)?better-auth.session_token=/.test(v)).join("; ");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[i] } });
    users.push({ id: user.id, headers: new Headers({ cookie }) });
  }
  categoryId = (await prisma.category.create({ data: { slug: `test-${run}`, name: "Тестовая категория" } })).id;
}, 60000);
afterAll(async () => {
  const owners = { author: { email: { in: emails } } };
  await prisma.article.updateMany({ where: owners, data: { publishedRevisionId: null, publishedAt: null, status: "DRAFT" } });
  await prisma.article.deleteMany({ where: owners });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.category.deleteMany({ where: { slug: `test-${run}` } });
  await prisma.tag.deleteMany({ where: { name: tag, revisions: { none: {} } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  await prisma.$disconnect();
}, 60000);
async function newDraft() {
  const { articleId } = await createArticleDraft(users[0].headers);
  return (await getArticleDraftById(articleId, users[0].headers)).draft!;
}
describe("real PostgreSQL draft services", () => {
  it("creates atomically, rejects guests/bans, enforces ownership and persists content/category/tags", async () => {
    await expect(createArticleDraft(new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await prisma.user.update({ where: { id: users[1].id }, data: { isBanned: true } });
    await expect(createArticleDraft(users[1].headers)).rejects.toThrow("BANNED");
    await prisma.user.update({ where: { id: users[1].id }, data: { isBanned: false } });
    const draft = await newDraft();
    const article = await prisma.article.findUniqueOrThrow({ where: { id: draft.articleId }, include: { revisions: true } });
    expect(article.authorId).toBe(users[0].id); expect(article.status).toBe("DRAFT"); expect(article.revisions).toHaveLength(1);
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Текст в Neon", marks: [{ type: "bold" }] }] }] };
    const input = { articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0, patch: { title: "Одинаковый заголовок", excerpt: "Описание", content, categoryId, tags: [tag.toUpperCase(), tag] } };
    await expect(getArticleDraftById(draft.articleId, users[1].headers)).rejects.toThrow("Статья не найдена");
    await expect(updateArticleDraft(input, users[1].headers)).rejects.toThrow("Статья не найдена");
    await expect(deleteArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0 }, users[1].headers)).rejects.toThrow("Статья не найдена");
    expect((await listOwnArticles(1, users[1].headers)).articles).toHaveLength(0);
    await updateArticleDraft(input, users[0].headers);
    const reopened = (await getArticleDraftById(draft.articleId, users[0].headers)).draft!;
    expect(reopened.content).toEqual(content); expect(reopened.categoryId).toBe(categoryId); expect(reopened.tags).toEqual([tag]); expect(reopened.editVersion).toBe(1);
    for (const status of ["APPROVED", "PUBLISHED"]) await expect(updateArticleDraft({ ...input, editVersion: 1, patch: { status } }, users[0].headers)).rejects.toThrow();
    await expect(updateArticleDraft({ ...input, editVersion: 1, patch: { categoryId: "missing" } }, users[0].headers)).rejects.toThrow();
    await expect(updateArticleDraft({ ...input, editVersion: 1, patch: { content: { type: "doc", content: [{ type: "script" }] } } }, users[0].headers)).rejects.toThrow();
    const otherDraft = await newDraft();
    await updateArticleDraft({ articleId: otherDraft.articleId, revisionId: otherDraft.revisionId, editVersion: 0, patch: { title: input.patch.title } }, users[0].headers);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: otherDraft.articleId } })).slug).not.toBe(article.slug);
    await deleteArticleDraft({ articleId: otherDraft.articleId, revisionId: otherDraft.revisionId, editVersion: 1 }, users[0].headers);
    expect(await prisma.article.findUnique({ where: { id: otherDraft.articleId } })).toBeNull();
    expect(await prisma.articleRevision.count({ where: { articleId: otherDraft.articleId } })).toBe(0);
  }, 120000);
  it("only accepts one concurrent writer and rejects delayed stale writes and deletes", async () => {
    const draft = await newDraft();
    const base = { articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0 };
    const writes = await Promise.allSettled(["A", "B"].map((title) => updateArticleDraft({ ...base, patch: { title } }, users[0].headers)));
    expect(writes.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((v) => v.status === "rejected")).toHaveLength(1);
    await updateArticleDraft({ ...base, editVersion: 1, patch: { title: "Самая новая версия" } }, users[0].headers);
    await expect(updateArticleDraft({ ...base, patch: { title: "Старый запрос" } }, users[0].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(deleteArticleDraft(base, users[0].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getArticleDraftById(draft.articleId, users[0].headers)).draft?.title).toBe("Самая новая версия");
  }, 60000);
  it("preserves approved content and public pointer, copies metadata, blocks PENDING and prevents cross-article pointers", async () => {
    const draft = await newDraft();
    await updateArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0, patch: { title: "Published fixture", tags: [tag], categoryId } }, users[0].headers);
    // Synthetic fixture only: there is no application publication endpoint in PHASE 3.
    await prisma.$transaction(async (tx) => {
      await tx.articleRevision.update({ where: { id: draft.revisionId }, data: { status: "APPROVED" } });
      await tx.article.update({ where: { id: draft.articleId }, data: { status: "PUBLISHED", publishedRevisionId: draft.revisionId, publishedAt: new Date() } });
    });
    const approved = await prisma.articleRevision.findUniqueOrThrow({ where: { id: draft.revisionId }, include: { tags: true } });
    const copies = await Promise.all([createDraftRevision(draft.articleId, users[0].headers), createDraftRevision(draft.articleId, users[0].headers)]);
    expect(copies[0].revisionId).toBe(copies[1].revisionId); expect(copies[0].tags).toEqual([tag]); expect(copies[0].categoryId).toBe(categoryId);
    const copy = copies[0];
    await updateArticleDraft({ articleId: copy.articleId, revisionId: copy.revisionId, editVersion: 0, patch: { title: "New draft", tags: [], categoryId: null } }, users[0].headers);
    await expect(updateArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 1, patch: { title: "Attack" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    expect(await prisma.articleRevision.findUniqueOrThrow({ where: { id: draft.revisionId }, include: { tags: true } })).toEqual(approved);
    await deleteArticleDraft({ articleId: copy.articleId, revisionId: copy.revisionId, editVersion: 1 }, users[0].headers);
    const publication = await prisma.article.findUniqueOrThrow({ where: { id: draft.articleId } });
    expect(publication.status).toBe("PUBLISHED"); expect(publication.publishedRevisionId).toBe(draft.revisionId);
    const pending = await createDraftRevision(draft.articleId, users[0].headers);
    await prisma.articleRevision.update({ where: { id: pending.revisionId }, data: { status: "PENDING", submittedAt: new Date() } });
    expect((await getArticleDraftById(draft.articleId, users[0].headers)).locked).toBe(true);
    await expect(updateArticleDraft({ articleId: pending.articleId, revisionId: pending.revisionId, editVersion: 0, patch: { title: "Forbidden" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(createDraftRevision(draft.articleId, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(deleteArticleDraft({ articleId: pending.articleId, revisionId: pending.revisionId, editVersion: 0 }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    const other = await newDraft();
    await expect(prisma.article.update({ where: { id: other.articleId }, data: { status: "PUBLISHED", publishedRevisionId: draft.revisionId, publishedAt: new Date() } })).rejects.toThrow();
    // Defense in depth: even inconsistent legacy status must not expose the pointer as editable.
    await prisma.article.update({ where: { id: other.articleId }, data: { status: "PUBLISHED", publishedRevisionId: other.revisionId, publishedAt: new Date() } });
    expect((await getArticleDraftById(other.articleId, users[0].headers)).locked).toBe(true);
    await expect(updateArticleDraft({ articleId: other.articleId, revisionId: other.revisionId, editVersion: 0, patch: { title: "Pointer attack" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(createDraftRevision(other.articleId, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    const constraintNames = [...readFileSync("prisma/migrations/20260924140000_foundation/migration.sql", "utf8").matchAll(/CONSTRAINT "([^"]+)"\s+CHECK/g)].map((m) => m[1]);
    const checks = await prisma.$queryRaw<{ conname: string }[]>`SELECT conname FROM pg_constraint WHERE contype = 'c'`;
    expect(constraintNames).toHaveLength(4); for (const name of constraintNames) expect(checks.some((v) => v.conname === name)).toBe(true);
  }, 120000);
  it("authorizes images, rejects foreign sources, validates origin and missing storage without mocks", async () => {
    const draft = await newDraft();
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    await expect(uploadArticleImage(draft.articleId, bytes, "image/png", users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(uploadArticleImage(draft.articleId, bytes, "image/png", new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await expect(readArticleImage(draft.articleId, "missing", users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0, patch: { coverImage: "/api/articles/foreign/images/image" } }, users[0].headers)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    await expect(updateArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0, patch: { coverImage: `/api/articles/${draft.articleId}/images/missing` } }, users[0].headers)).rejects.toMatchObject({ code: "INVALID_IMAGE" });
    const request = new Request(`${process.env.BETTER_AUTH_URL}/api/articles/${draft.articleId}/images`, { method: "POST", headers: { cookie: users[0].headers.get("cookie")!, origin: "https://evil.example", "content-type": "image/png" }, body: bytes });
    expect((await uploadRoute(request, { params: Promise.resolve({ id: draft.articleId }) })).status).toBe(403);
    // Deterministic missing-config branch; never contacts external storage.
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("BLOB_STORE_ID", "");
    try { await expect(uploadArticleImage(draft.articleId, bytes, "image/png", users[0].headers)).rejects.toMatchObject({ code: "STORAGE" }); }
    finally { vi.unstubAllEnvs(); }
    expect(await prisma.articleImage.count({ where: { articleId: draft.articleId } })).toBe(0);
    await prisma.user.update({ where: { id: users[0].id }, data: { isBanned: true } });
    try {
      await expect(getArticleDraftById(draft.articleId, users[0].headers)).rejects.toThrow("BANNED");
      await expect(updateArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0, patch: { title: "banned" } }, users[0].headers)).rejects.toThrow("BANNED");
      await expect(deleteArticleDraft({ articleId: draft.articleId, revisionId: draft.revisionId, editVersion: 0 }, users[0].headers)).rejects.toThrow("BANNED");
    } finally { await prisma.user.update({ where: { id: users[0].id }, data: { isBanned: false } }); }
  }, 120000);
});
