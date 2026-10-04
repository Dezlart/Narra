import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPrisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth/server";
import { createArticleDraft, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { approveArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { createComment } from "@/features/comments/service";
import { createReport } from "@/features/reports/service";
import { followUser, unfollowUser } from "@/features/follows/service";

const db = getPrisma(), run = randomBytes(6).toString("hex");
const emails = Array.from({ length: 6 }, (_, i) => `narra-quality-${run}-${i}@example.test`);
const passwords = emails.map(() => randomBytes(24).toString("base64url"));
const people: { id: string; cookie: string; username: string; email: string; password: string }[] = [];
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const headers = (i: number) => new Headers({ cookie: people[i].cookie });
const title = `История ${run} ${"длинныйзаголовок".repeat(9)}`;
const body = { type: "doc", content: [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Начало истории" }] },
  { type: "paragraph", content: [{ type: "text", text: "Содержательная история о городе и людях. ".repeat(20) }] },
  { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Подробности истории" }] },
  { type: "codeBlock", content: [{ type: "text", text: "code_".repeat(100) }] },
  { type: "paragraph", content: [{ type: "text", text: "длиннаястрока".repeat(60) }] },
] };
let categoryId: string, articleId: string, slug: string, draftId: string, pendingId: string, reportId: string, archivedSlug: string, privateSlug: string, tagSlug: string;
async function draft(submit = false, publish = false) {
  const id = (await createArticleDraft(headers(2))).articleId;
  const revision = (await getArticleDraftById(id, headers(2))).draft!;
  await updateArticleDraft({ articleId: id, revisionId: revision.revisionId, editVersion: 0, patch: { title, excerpt: "Описание реальной истории для проверки качества интерфейса.", content: body, categoryId, tags: [`качество${run}`] } }, headers(2));
  if (submit) await submitArticleForModeration({ articleId: id, revisionId: revision.revisionId, editVersion: 1 }, headers(2));
  if (publish) await approveArticleRevision({ revisionId: revision.revisionId }, headers(1));
  return { id, revisionId: revision.revisionId, slug: (await db.article.findUniqueOrThrow({ where: { id } })).slug! };
}
beforeAll(async () => {
  for (let i = 0; i < 5; i++) {
    const username = `quality_${run}_${i}`;
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, { method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ name: `Проверка ${i} ${"ДлинноеИмя".repeat(5)}`, username, email: emails[i], password: passwords[i] }) }));
    expect(response.status).toBe(200);
    people.push({ id: (await db.user.findUniqueOrThrow({ where: { email: emails[i] } })).id, cookie: response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => v.includes("session_token=")).join("; "), username, email: emails[i], password: passwords[i] });
  }
  await db.user.update({ where: { id: people[0].id }, data: { role: "ADMIN" } });
  await db.user.update({ where: { id: people[1].id }, data: { role: "MODERATOR" } });
  categoryId = (await db.category.create({ data: { name: `Тема ${run} ${"длинная".repeat(7)}`, slug: `qa-quality-${run}`, description: "Описание категории" } })).id;
  await db.category.create({ data: { name: `Пустая ${run}`, slug: `qa-quality-${run}-empty` } });
  const published = await draft(true, true); articleId = published.id; slug = published.slug;
  const archived = await draft(true, true); archivedSlug = archived.slug;
  await db.article.update({ where: { id: archived.id }, data: { status: "ARCHIVED" } });
  const editable = await draft(); draftId = editable.id; privateSlug = editable.slug;
  pendingId = (await draft(true)).revisionId;
  tagSlug = (await db.tag.findFirstOrThrow({ where: { name: `качество${run}` } })).slug;
  await createComment({ articleId, parentId: null, content: "ДлинныйКомментарий".repeat(90), requestId: randomUUID() }, headers(3));
  await createReport({ targetType: "ARTICLE", targetId: articleId, reason: "OTHER", description: "ПодробнаяЖалоба".repeat(100) }, headers(3));
  reportId = (await db.report.findFirstOrThrow({ where: { reporterId: people[3].id, articleId } })).id;
  await followUser({ username: people[2].username }, headers(3));
  // Bounded QA history exercises the 99+ badge and long notification text.
  await db.notification.createMany({ data: Array.from({ length: 101 }, (_, i) => ({
    recipientId: people[2].id, actorId: people[1].id, type: "ARTICLE_APPROVED" as const,
    articleId, revisionId: published.revisionId, eventKey: `quality:${run}:${i}`,
  })) });
}, 180000);
afterAll(async () => {
  try {
    const ids = (await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await db.report.deleteMany({ where: { reporterId: { in: ids } } });
    await db.article.updateMany({ where: { authorId: { in: ids } }, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: { authorId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.category.deleteMany({ where: { slug: { startsWith: `qa-quality-${run}` } } });
    await db.tag.deleteMany({ where: { name: `качество${run}`, revisions: { none: {} } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } finally { await db.$disconnect(); }
}, 120000);
it("audits real production routes and completes the browser publication journey", () => {
  const output = execFileSync(process.execPath, ["tests/quality.browser.mjs"], { input: JSON.stringify({ run, people, categoryId, articleId, slug, draftId, pendingId, reportId, archivedSlug, privateSlug, tagSlug, title, registration: { email: emails[5], password: passwords[5], username: `quality_${run}_5` } }), encoding: "utf8", timeout: 1200000 });
  console.log(output.trim());
}, 1230000);
it("limits repeated follows atomically without counting idempotent retries", async () => {
  const actor = people[4], target = { username: people[2].username }, ownHeaders = headers(4);
  const start = await db.notification.count({ where: { actorId: actor.id, type: "NEW_FOLLOWER" } });
  for (let i = 0; i < 10; i++) { await followUser(target, ownHeaders); await unfollowUser(target, ownHeaders); }
  await expect(followUser(target, ownHeaders)).rejects.toMatchObject({ code: "RATE_LIMIT" });
  expect(await db.follow.count({ where: { followerId: actor.id, followingId: people[2].id } })).toBe(0);
  expect(await db.notification.count({ where: { actorId: actor.id, type: "NEW_FOLLOWER" } })).toBe(start + 10);
  await db.notification.updateMany({ where: { actorId: actor.id, type: "NEW_FOLLOWER" }, data: { createdAt: new Date(Date.now()-120000) } });
  await followUser(target, ownHeaders);
  await Promise.all([followUser(target, ownHeaders), followUser(target, ownHeaders)]);
  expect(await db.notification.count({ where: { actorId: actor.id, type: "NEW_FOLLOWER" } })).toBe(start + 11);
}, 120000);
