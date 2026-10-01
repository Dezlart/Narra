import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPrisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth/server";
import { requireAdmin, requireModerator } from "@/lib/auth/guards";
import { changeUser, createCategory, updateCategory, setCategoryArchived, setArticleArchived } from "@/features/admin/service";
import { listUsers, listAdminArticles, listAdminCategories, getAdminArticle } from "@/features/admin/queries";
import { createReport, resolveReport } from "@/features/reports/service";
import { listReports, getReport } from "@/features/reports/queries";
import { getPlatformAnalytics, getAuthorAnalytics } from "@/features/analytics/queries";
import { analyticsSecret, issueVisitor, visitorHash, utcBucket } from "@/features/analytics/identity";
import { registerArticleView } from "@/features/analytics/service";
import { createArticleDraft, createDraftRevision, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { listCategories } from "@/features/articles/queries";
import { approveArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { getPublishedArticleBySlug, searchPublishedArticles, getPublishedArticlesByCategory, getPublishedArticlesByAuthor, getPublicCategories } from "@/features/public-content/queries";
import { createComment } from "@/features/comments/service";
import { getArticleComments } from "@/features/comments/queries";
import { followUser } from "@/features/follows/service";
import { getFollowingFeed } from "@/features/follows/feed";
import { likeArticle } from "@/features/likes/service";
import { saveArticle } from "@/features/bookmarks/service";
const db = getPrisma(), run = randomBytes(6).toString("hex"), guest = new Headers();
const emails = Array.from({ length: 4 }, (_, i) => `narra-phase8-${run}-${i}@example.test`);
const passwords = emails.map(() => randomBytes(24).toString("base64url"));
const people: { id: string; headers: Headers; username: string }[] = [];
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
let categoryId: string, articleId: string, slug: string, commentId: string;
const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Настоящая статья для проверки административных прав, жалоб, статистики и публикации." }] }] };
function cookies(response: Response) { return new Headers({ cookie: response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => v.includes("session_token=")).join("; ") }); }
async function authRequest(path: string, data: object) { return getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/${path}`, { method: "POST",
  headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(data) })); }
async function publish() {
  const id = (await createArticleDraft(people[2].headers)).articleId;
  const revision = (await getArticleDraftById(id, people[2].headers)).draft!;
  await updateArticleDraft({ articleId: id, revisionId: revision.revisionId, editVersion: 0,
    patch: { title: `Администрирование ${run}`, excerpt: "Описание статьи для реального интеграционного сценария.", content: body, categoryId } }, people[2].headers);
  await submitArticleForModeration({ articleId: id, revisionId: revision.revisionId, editVersion: 1 }, people[2].headers);
  await approveArticleRevision({ revisionId: revision.revisionId }, people[1].headers);
  return id;
}
beforeAll(async () => {
  for (let i = 0; i < emails.length; i++) {
    const username = `phase8_${run}_${i}`;
    const response = await authRequest("sign-up/email", { name: `Phase8 ${i} ${run}`, email: emails[i], username, password: passwords[i] });
    expect(response.status).toBe(200);
    people.push({ id: (await db.user.findUniqueOrThrow({ where: { email: emails[i] } })).id, headers: cookies(response), username });
  }
  await db.user.update({ where: { id: people[0].id }, data: { role: "ADMIN" } });
  await db.user.update({ where: { id: people[1].id }, data: { role: "MODERATOR" } });
  categoryId = (await createCategory({ name: `QA ${run}`, slug: `qa-phase8-${run}`, description: "Проверка" }, people[0].headers)).id;
  articleId = await publish(); slug = (await db.article.findUniqueOrThrow({ where: { id: articleId } })).slug!;
}, 120000);
afterAll(async () => {
  try {
    const ids = (await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })).map((u) => u.id);
    await db.report.deleteMany({ where: { reporterId: { in: ids } } });
    await db.article.updateMany({ where: { authorId: { in: ids } }, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: { authorId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.category.deleteMany({ where: { slug: { startsWith: `qa-phase8-${run}` } } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } finally { await db.$disconnect(); }
}, 120000);
describe("PHASE 8 real administration/report/analytics workflow", () => {
  it("authorizes each private query and mutation independently of pages", async () => {
    for (const actor of [guest, people[2].headers, people[1].headers]) {
      await expect(listUsers({}, actor)).rejects.toThrow(); await expect(getPlatformAnalytics(actor)).rejects.toThrow();
      await expect(listAdminCategories({}, actor)).rejects.toThrow(); await expect(listAdminArticles({}, actor)).rejects.toThrow();
      await expect(changeUser({ operation: "role", userId: people[2].id, role: "ADMIN" }, actor)).rejects.toThrow();
      await expect(changeUser({ operation: "ban", userId: people[2].id, banned: true }, actor)).rejects.toThrow();
      await expect(createCategory({ name: "Test", slug: `qa-phase8-${run}-forbidden`, description: "" }, actor)).rejects.toThrow();
    }
    await expect(listReports({}, people[2].headers)).rejects.toThrow("FORBIDDEN");
    await expect(getAuthorAnalytics(1, guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(changeUser({ operation: "role", userId: people[2].id, role: "OWNER" }, people[0].headers)).rejects.toThrow();
    const users = await listUsers({ q: run, state: "active", role: "USER" }, people[0].headers);
    expect(users.items).toHaveLength(2); expect(JSON.stringify(users)).not.toMatch(/password|session|accessToken/);
    expect((await listAdminArticles({ q: run }, people[0].headers)).items).toHaveLength(1);
  }, 90000);
  it("applies roles immediately; ban revokes sessions, unban requires new login and preserves content", async () => {
    await changeUser({ operation: "role", userId: people[3].id, role: "MODERATOR" }, people[0].headers);
    expect((await requireModerator(people[3].headers)).role).toBe("MODERATOR");
    await changeUser({ operation: "role", userId: people[3].id, role: "USER" }, people[0].headers);
    await expect(requireModerator(people[3].headers)).rejects.toThrow("FORBIDDEN");
    await expect(changeUser({ operation: "ban", userId: people[0].id, banned: true }, people[0].headers)).rejects.toThrow();
    await changeUser({ operation: "ban", userId: people[2].id, banned: true }, people[0].headers);
    expect(await db.session.count({ where: { userId: people[2].id } })).toBe(0);
    await expect(createArticleDraft(people[2].headers)).rejects.toThrow("UNAUTHENTICATED");
    expect(await getPublishedArticleBySlug(slug)).not.toBeNull();
    expect((await authRequest("sign-in/email", { email: emails[2], password: passwords[2] })).status).toBe(403);
    // Direct delayed session insertion is also stopped by the DB trigger.
    await expect(db.session.create({ data: { userId: people[2].id, token: randomUUID(), expiresAt: new Date(Date.now() + 100000) } })).rejects.toThrow();
    await changeUser({ operation: "ban", userId: people[2].id, banned: false }, people[0].headers);
    await expect(createArticleDraft(people[2].headers)).rejects.toThrow("UNAUTHENTICATED");
    const response = await authRequest("sign-in/email", { email: emails[2], password: passwords[2] }); expect(response.status).toBe(200); people[2].headers = cookies(response);
  }, 90000);
  it("archives/restores only approved publications without losing history or reactions", async () => {
    await followUser({ username: people[2].username }, people[3].headers);
    await likeArticle({ articleId }, people[3].headers); await saveArticle({ articleId }, people[3].headers);
    const before = await db.article.findUniqueOrThrow({ where: { id: articleId } });
    for (const actor of [people[1].headers, people[2].headers]) await expect(setArticleArchived({ articleId, archived: true }, actor)).rejects.toThrow("FORBIDDEN");
    await setArticleArchived({ articleId, archived: true }, people[0].headers);
    expect(await getPublishedArticleBySlug(slug)).toBeNull();
    expect((await searchPublishedArticles(run, 1)).items).toEqual([]);
    expect((await getFollowingFeed(1, people[3].headers)).items).toEqual([]);
    expect((await getPublishedArticlesByCategory(`qa-phase8-${run}`, 1)).items).toEqual([]);
    expect((await getPublishedArticlesByAuthor(people[2].username, 1)).items).toEqual([]);
    expect(await db.like.count({ where: { articleId } })).toBe(1); expect(await db.bookmark.count({ where: { articleId } })).toBe(1);
    expect((await db.article.findUniqueOrThrow({ where: { id: articleId } })).publishedRevisionId).toBe(before.publishedRevisionId);
    expect((await getAdminArticle(articleId, 1, people[0].headers))!.items).toHaveLength(1);
    await setArticleArchived({ articleId, archived: false }, people[0].headers);
    expect((await getPublishedArticleBySlug(slug))!.publishedAt).toEqual(before.publishedAt);
    const draft = await createArticleDraft(people[2].headers);
    await expect(setArticleArchived({ articleId: draft.articleId, archived: false }, people[0].headers)).rejects.toThrow();
  }, 90000);
  it("archives category without breaking published snapshots; prevents new selection and preserves slug", async () => {
    await expect(createCategory({ name: "Duplicate", slug: `qa-phase8-${run}`, description: "" }, people[0].headers)).rejects.toThrow();
    await updateCategory({ categoryId, name: `Renamed ${run}`, description: "Изменено" }, people[0].headers);
    await setCategoryArchived({ categoryId, archived: true }, people[0].headers);
    expect((await getPublishedArticleBySlug(slug))!.category!.slug).toBe(`qa-phase8-${run}`);
    expect((await getPublicCategories()).some((c) => c.slug === `qa-phase8-${run}`)).toBe(false);
    expect((await listCategories()).some((c) => c.id === categoryId)).toBe(false);
    const revision = await createDraftRevision(articleId, people[2].headers); expect(revision.categoryId).toBeNull();
    await expect(updateArticleDraft({ articleId, revisionId: revision.revisionId, editVersion: 0, patch: { categoryId } }, people[2].headers)).rejects.toThrow();
    await setCategoryArchived({ categoryId, archived: false }, people[0].headers);
    expect((await listCategories()).some((c) => c.id === categoryId)).toBe(true);
    await updateArticleDraft({ articleId, revisionId: revision.revisionId, editVersion: 0, patch: { categoryId } }, people[2].headers);
    await setCategoryArchived({ categoryId, archived: true }, people[0].headers);
    await updateArticleDraft({ articleId, revisionId: revision.revisionId, editVersion: 1, patch: { title: "Черновик с исторической категорией" } }, people[2].headers);
    await expect(submitArticleForModeration({ articleId, revisionId: revision.revisionId, editVersion: 2 }, people[2].headers)).rejects.toThrow("активную");
    await setCategoryArchived({ categoryId, archived: false }, people[0].headers);
  }, 90000);
  it("validates report ownership, visibility, concurrency and DB target/lifecycle constraints", async () => {
    const input = { targetType: "ARTICLE", targetId: articleId, reason: "SPAM", description: "Проверка жалобы" };
    await expect(createReport(input, guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(createReport(input, people[2].headers)).rejects.toThrow("собственный");
    await expect(createReport({ ...input, reporterId: people[0].id }, people[3].headers)).rejects.toThrow();
    const privateId = (await createArticleDraft(people[2].headers)).articleId;
    await expect(createReport({ ...input, targetId: privateId }, people[3].headers)).rejects.toThrow("недоступен");
    const outcomes = await Promise.all([createReport(input, people[3].headers), createReport(input, people[3].headers)]);
    expect(outcomes.filter((r) => r.created)).toHaveLength(1);
    const r = await db.report.findFirstOrThrow({ where: { articleId, status: "OPEN" } });
    expect((await getReport(r.id, people[1].headers))!.reason).toBe("SPAM");
    await expect(db.report.create({ data: { reporterId: people[3].id, targetType: "ARTICLE", articleId, reason: "SPAM", activeKey: "forged" } })).rejects.toThrow();
    await resolveReport({ reportId: r.id, status: "DISMISSED", action: "NONE", note: "Не подтверждено" }, people[1].headers);
    expect(await db.report.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "DISMISSED", resolvedById: people[1].id, activeKey: null });
    expect(await getPublishedArticleBySlug(slug)).not.toBeNull();
    expect((await createReport(input, people[3].headers)).created).toBe(true);
    const next = await db.report.findFirstOrThrow({ where: { articleId, status: "OPEN" } });
    await expect(resolveReport({ reportId: next.id, status: "RESOLVED", action: "ARCHIVE_ARTICLE" }, people[1].headers)).rejects.toThrow("FORBIDDEN");
    await resolveReport({ reportId: next.id, status: "RESOLVED", action: "ARCHIVE_ARTICLE" }, people[0].headers);
    expect(await getPublishedArticleBySlug(slug)).toBeNull();
    await setArticleArchived({ articleId, archived: false }, people[0].headers);
  }, 120000);
  it("hides comment and resolves report atomically; failed action leaves OPEN; ban keeps historical comment", async () => {
    commentId = (await createComment({ articleId, content: `Контекст жалобы ${run}`, requestId: randomUUID() }, people[3].headers)).id;
    const input = { targetType: "COMMENT", targetId: commentId, reason: "OTHER", description: "Описание проблемы" };
    await expect(createReport(input, people[3].headers)).rejects.toThrow("собственный");
    await createReport(input, people[2].headers);
    const report = await db.report.findFirstOrThrow({ where: { commentId, status: "OPEN" } });
    await expect(resolveReport({ reportId: report.id, status: "RESOLVED", action: "ARCHIVE_ARTICLE" }, people[0].headers)).rejects.toThrow();
    expect((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe("OPEN");
    await resolveReport({ reportId: report.id, status: "RESOLVED", action: "HIDE_COMMENT", note: "Скрыто" }, people[1].headers);
    expect((await db.comment.findUniqueOrThrow({ where: { id: commentId } })).hiddenById).toBe(people[1].id);
    expect(JSON.stringify(await getArticleComments(articleId, 1, guest))).not.toContain(`Контекст жалобы ${run}`);
    await expect(createReport(input, people[2].headers)).rejects.toThrow("недоступен");
    await db.comment.update({ where: { id: commentId }, data: { hiddenAt: null, hiddenById: null } });
    const removed = await db.comment.create({ data: { articleId, authorId: people[3].id, requestId: randomUUID(), content: "Удалится после жалобы" } });
    await createReport({ ...input, targetId: removed.id }, people[2].headers);
    const removedReport = await db.report.findFirstOrThrow({ where: { commentId: removed.id } });
    await db.comment.update({ where: { id: removed.id }, data: { deletedAt: new Date(), content: "" } });
    await expect(resolveReport({ reportId: removedReport.id, status: "RESOLVED", action: "HIDE_COMMENT" }, people[1].headers)).rejects.toThrow("удалил");
    expect((await db.report.findUniqueOrThrow({ where: { id: removedReport.id } })).status).toBe("OPEN");
    await resolveReport({ reportId: removedReport.id, status: "RESOLVED", action: "NONE", note: "Уже удалён автором" }, people[1].headers);
    await changeUser({ operation: "ban", userId: people[3].id, banned: true }, people[0].headers);
    expect(JSON.stringify(await getArticleComments(articleId, 1, guest))).toContain(`Контекст жалобы ${run}`);
    await expect(createReport({ targetType: "ARTICLE", targetId: articleId, reason: "SPAM" }, people[3].headers)).rejects.toThrow();
    await changeUser({ operation: "ban", userId: people[3].id, banned: false }, people[0].headers);
    const response = await authRequest("sign-in/email", { email: emails[3], password: passwords[3] }); expect(response.status).toBe(200); people[3].headers = cookies(response);
  }, 120000);
  it("deduplicates views across concurrent refreshes and isolates article/day/visitor without raw identity", async () => {
    const now = new Date(); now.setUTCHours(23, 50, 0, 0); const secret = analyticsSecret()!; expect(secret).toBeTruthy();
    const token = issueVisitor(secret, now);
    const outcomes = await Promise.all(Array.from({ length: 4 }, () => registerArticleView(articleId, token, now)));
    expect(outcomes.filter((r) => r.counted)).toHaveLength(1);
    const next = new Date(now.getTime() + 1200000); expect((await registerArticleView(articleId, token, next)).counted).toBe(true);
    expect((await registerArticleView(articleId, issueVisitor(secret, now), now)).counted).toBe(true);
    const second = await publish(); expect((await registerArticleView(second, token, now)).counted).toBe(true);
    const row = await db.articleView.findFirstOrThrow({ where: { articleId, visitorHash: visitorHash(token, articleId, utcBucket(now), secret) } });
    expect(row.visitorHash).toBe(visitorHash(token, articleId, utcBucket(now), secret));
    expect(JSON.stringify(row)).not.toContain(token); expect(row).not.toHaveProperty("userId"); expect(row).not.toHaveProperty("ipAddress");
    expect((await registerArticleView("missing", token, now)).counted).toBe(false);
    const draft = (await createArticleDraft(people[2].headers)).articleId; expect((await registerArticleView(draft, token, now)).counted).toBe(false);
    await setArticleArchived({ articleId, archived: true }, people[0].headers);
    expect((await registerArticleView(articleId, issueVisitor(secret, now), now)).counted).toBe(false);
    await setArticleArchived({ articleId, archived: false }, people[0].headers);
    vi.stubEnv("ANALYTICS_HASH_SECRET", ""); try { expect((await registerArticleView(articleId, token, now)).counted).toBe(false); } finally { vi.unstubAllEnvs(); }
  }, 120000);
  it("aggregates own metrics and platform trends with bounded pagination", async () => {
    const result = await getAuthorAnalytics(1, people[2].headers);
    expect(result.metrics).toEqual({ views: 4, likes: 1, comments: 1, followers: 1 });
    expect(result.items.find((a) => a.id === articleId)!._count).toEqual({ views: 3, likes: 1, comments: 1 });
    expect((await getAuthorAnalytics({ authorId: people[2].id }, people[3].headers)).items).toEqual([]);
    expect((await getPlatformAnalytics(people[0].headers)).daily).toHaveLength(14);
    const data = Array.from({ length: 21 }, (_, i) => ({ reporterId: people[3].id, targetType: "ARTICLE" as const, articleId, reason: "SPAM" as const,
      status: "DISMISSED" as const, resolvedAt: new Date(), resolvedById: people[1].id, description: `page-${run}-${i}` }));
    await db.report.createMany({ data });
    const one = await listReports({ status: "DISMISSED" }, people[1].headers), two = await listReports({ status: "DISMISSED", page: "2" }, people[1].headers);
    expect(one.items.length).toBeLessThanOrEqual(20); expect(one.hasNext).toBe(true); expect(two.items.length).toBeGreaterThan(0);
    expect(one.items.every((r) => !two.items.some((s) => s.id === r.id))).toBe(true);
    await db.report.deleteMany({ where: { description: { startsWith: `page-${run}-` } } });
    await requireAdmin(people[0].headers);
    const fixtureIds: string[] = [], stamp = new Date();
    for (let i = 0; i < 19; i++) {
      const a = await db.article.create({ data: { authorId: people[2].id, slug: `qa-phase8-page-${run}-${i}`,
        revisions: { create: { version: 1, status: "APPROVED", content: body, title: `Страница ${i}` } } }, include: { revisions: true } });
      fixtureIds.push(a.id);
      await db.article.update({ where: { id: a.id }, data: { status: "PUBLISHED", publishedAt: stamp, publishedRevisionId: a.revisions[0].id } });
    }
    const first = await getAuthorAnalytics(1, people[2].headers), second = await getAuthorAnalytics(2, people[2].headers);
    expect(first.items).toHaveLength(20); expect(first.hasNext).toBe(true); expect(second.items).toHaveLength(1);
    expect(new Set([...first.items, ...second.items].map((a) => a.id)).size).toBe(21);
    expect((await getAuthorAnalytics(1, people[3].headers)).items).toEqual([]);
    await db.article.updateMany({ where: { id: { in: fixtureIds } }, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: { id: { in: fixtureIds } } });
  }, 90000);
  it.skipIf(!process.env.NARRA_ADMIN_BROWSER_QA)("verifies production admin, reports, views and author UI", async () => {
    console.log(execFileSync(process.execPath, [process.env.NARRA_ADMIN_BROWSER_QA!], { input: JSON.stringify({ run, articleId, slug, categoryId, commentId,
      users: people.map((u, i) => ({ ...u, headers: undefined, cookie: u.headers.get("cookie"), email: emails[i], password: passwords[i] })) }), encoding: "utf8", timeout: 360000 }).trim());
  }, 390000);
});
