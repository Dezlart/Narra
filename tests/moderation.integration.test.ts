import "dotenv/config";
import { randomBytes } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getAuth } from "@/lib/auth/server";
import { getPrisma } from "@/lib/prisma";
import { createArticleDraft, createDraftRevision, deleteArticleDraft, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { getArticleRevisionHistory } from "@/features/articles/queries";
import { approveArticleRevision, rejectArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { getPendingModerationQueue, getRevisionForModeration } from "@/features/moderation/queries";
import { readModerationImage } from "@/features/moderation/images";
import { uploadArticleImage } from "@/features/articles/images";

const run = randomBytes(6).toString("hex");
const emails = [0, 1, 2, 3].map((i) => `narra-moderation-${run}-${i}@example.test`);
const ip = `198.19.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const users: { id: string; headers: Headers }[] = [];
const prisma = getPrisma();
let categoryId: string;
const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Настоящий материал о городе, людях и событиях с достаточным количеством полезного текста." }] }] };
const tag = `phase4-${run}`;
beforeAll(async () => {
  for (let i = 0; i < emails.length; i++) {
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, { method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ name: "Проверка модерации", email: emails[i], username: `moderation_${run}_${i}`, password: randomBytes(24).toString("base64url") }) }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => /^(?:__Secure-)?better-auth.session_token=/.test(v)).join("; ");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[i] } });
    users.push({ id: user.id, headers: new Headers({ cookie }) });
  }
  // Explicitly authorized PHASE 4 test roles, only on this run's new identities.
  await prisma.user.update({ where: { id: users[2].id }, data: { role: "MODERATOR" } });
  await prisma.user.update({ where: { id: users[3].id }, data: { role: "ADMIN" } });
  categoryId = (await prisma.category.create({ data: { slug: tag, name: "Категория проверки" } })).id;
}, 120000);
afterAll(async () => {
  try {
    const owners = { author: { email: { in: emails } } };
    await prisma.article.updateMany({ where: owners, data: { publishedRevisionId: null, publishedAt: null, status: "DRAFT" } });
    await prisma.article.deleteMany({ where: owners });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.category.deleteMany({ where: { slug: tag } });
    await prisma.tag.deleteMany({ where: { name: tag, revisions: { none: {} } } });
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } catch (error) { console.error(`Cleanup required for moderation test run ${run}`); throw error; }
  finally { await prisma.$disconnect(); }
}, 120000);
async function validDraft() {
  const { articleId } = await createArticleDraft(users[0].headers);
  const draft = (await getArticleDraftById(articleId, users[0].headers)).draft!;
  await updateArticleDraft({ articleId, revisionId: draft.revisionId, editVersion: 0, patch: { title: "Материал для модерации", excerpt: "Подробное описание тестовой истории.", content, categoryId, tags: [tag] } }, users[0].headers);
  return { articleId, revisionId: draft.revisionId, editVersion: 1 };
}
async function snapshot(id: string) { return prisma.articleRevision.findUniqueOrThrow({ where: { id }, include: { tags: true } }); }
describe("real moderation and publishing", () => {
  it("validates the stored snapshot, owner, ban, version and exactly one active submission", async () => {
    const draft = await validDraft();
    await expect(submitArticleForModeration(draft, new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await expect(submitArticleForModeration(draft, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createDraftRevision(draft.articleId, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteArticleDraft(draft, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getArticleRevisionHistory(draft.articleId, 1, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRevisionForModeration(draft.revisionId, users[2].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.user.update({ where: { id: users[0].id }, data: { isBanned: true } });
    try { await expect(submitArticleForModeration(draft, users[0].headers)).rejects.toThrow("BANNED"); }
    finally { await prisma.user.update({ where: { id: users[0].id }, data: { isBanned: false } }); }
    await expect(submitArticleForModeration({ ...draft, editVersion: 0 }, users[0].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(submitArticleForModeration({ ...draft, status: "APPROVED" }, users[0].headers)).rejects.toThrow();
    for (const patch of [{ title: "" }, { excerpt: "" }, { categoryId: null }, { content: { type: "doc", content: [{ type: "paragraph" }] } }, { coverImage: "/api/articles/foreign/images/x" }]) {
      await prisma.articleRevision.update({ where: { id: draft.revisionId }, data: patch });
      await expect(submitArticleForModeration(draft, users[0].headers)).rejects.toThrow();
      expect((await snapshot(draft.revisionId)).status).toBe("DRAFT");
      await prisma.articleRevision.update({ where: { id: draft.revisionId }, data: { title: "Материал для модерации", excerpt: "Подробное описание тестовой истории.", categoryId, content, coverImage: null } });
    }
    const other = await validDraft();
    await expect(submitArticleForModeration({ ...draft, revisionId: other.revisionId }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    const submissions = await Promise.allSettled([submitArticleForModeration(draft, users[0].headers), submitArticleForModeration(draft, users[0].headers)]);
    expect(submissions.filter((value) => value.status === "fulfilled")).toHaveLength(1);
    const pending = await snapshot(draft.revisionId);
    expect(pending.status).toBe("PENDING"); expect(pending.submittedAt).not.toBeNull(); expect(pending.reviewedAt).toBeNull(); expect(pending.reviewedById).toBeNull(); expect(pending.rejectionReason).toBeNull();
    await expect(updateArticleDraft({ ...draft, patch: { title: "Bypass" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(deleteArticleDraft(draft, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(createDraftRevision(draft.articleId, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(uploadArticleImage(draft.articleId, Buffer.from("not decoded"), "image/png", users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    expect(await snapshot(draft.revisionId)).toEqual(pending);
    await expect(prisma.articleRevision.create({ data: { articleId: draft.articleId, version: 2, content } })).rejects.toThrow();
    await expect(prisma.articleRevision.create({ data: { articleId: draft.articleId, version: 2, content, status: "PENDING", submittedAt: new Date() } })).rejects.toThrow();
  }, 180000);
  it("publishes, rejects an update, copies the rejected snapshot, then atomically publishes a correction", async () => {
    const first = await validDraft();
    await submitArticleForModeration(first, users[0].headers);
    await approveArticleRevision({ revisionId: first.revisionId }, users[2].headers);
    const publication = await prisma.article.findUniqueOrThrow({ where: { id: first.articleId } });
    expect(publication.status).toBe("PUBLISHED"); expect(publication.publishedRevisionId).toBe(first.revisionId); expect(publication.publishedAt).not.toBeNull();
    const approved = await snapshot(first.revisionId);
    expect(approved.reviewedById).toBe(users[2].id); expect(approved.reviewedAt).not.toBeNull(); expect(approved.rejectionReason).toBeNull();
    await expect(submitArticleForModeration(first, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(updateArticleDraft({ ...first, patch: { title: "Change approved" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    const copies = await Promise.all([createDraftRevision(first.articleId, users[0].headers), createDraftRevision(first.articleId, users[0].headers)]);
    expect(copies[0].revisionId).toBe(copies[1].revisionId);
    const next = copies[0]; expect(next.version).toBe(2); expect(next.content).toEqual(content); expect(next.tags).toEqual([tag]); expect(next.categoryId).toBe(categoryId);
    const second = { articleId: first.articleId, revisionId: next.revisionId, editVersion: 0 };
    await updateArticleDraft({ ...second, patch: { title: "Новая история с исправлениями", tags: [], excerpt: "Описание новой версии для отдельной проверки." } }, users[0].headers);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: first.articleId } })).publishedRevisionId).toBe(first.revisionId);
    await submitArticleForModeration({ ...second, editVersion: 1 }, users[0].headers);
    await rejectArticleRevision({ revisionId: second.revisionId, reason: "  Добавьте подтверждающие источники.  " }, users[3].headers);
    const rejected = await snapshot(second.revisionId);
    expect(rejected.status).toBe("REJECTED"); expect(rejected.rejectionReason).toBe("Добавьте подтверждающие источники."); expect(rejected.reviewedById).toBe(users[3].id);
    expect((await prisma.article.findUniqueOrThrow({ where: { id: first.articleId } })).publishedRevisionId).toBe(first.revisionId);
    await expect(updateArticleDraft({ ...second, editVersion: rejected.editVersion, patch: { title: "Change rejected" } }, users[0].headers)).rejects.toMatchObject({ code: "LOCKED" });
    await expect(deleteArticleDraft({ ...second, editVersion: rejected.editVersion }, users[0].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    const correction = await createDraftRevision(first.articleId, users[0].headers);
    expect(correction.version).toBe(3); expect(correction.title).toBe(rejected.title); expect(correction.excerpt).toBe(rejected.excerpt); expect(correction.tags).toEqual([]);
    const fresh = await snapshot(correction.revisionId); expect(fresh.rejectionReason).toBeNull(); expect(fresh.reviewedById).toBeNull(); expect(fresh.reviewedAt).toBeNull(); expect(fresh.submittedAt).toBeNull();
    await submitArticleForModeration({ articleId: first.articleId, revisionId: correction.revisionId, editVersion: 0 }, users[0].headers);
    await approveArticleRevision({ revisionId: correction.revisionId }, users[3].headers);
    const updated = await prisma.article.findUniqueOrThrow({ where: { id: first.articleId } });
    expect(updated.status).toBe("PUBLISHED"); expect(updated.publishedRevisionId).toBe(correction.revisionId); expect(updated.publishedAt).toEqual(publication.publishedAt);
    expect(await snapshot(first.revisionId)).toEqual(approved); expect(await snapshot(second.revisionId)).toEqual(rejected);
    expect((await getArticleRevisionHistory(first.articleId, 1, users[0].headers)).revisions.map((value) => value.status)).toEqual(["APPROVED", "REJECTED", "APPROVED"]);
  }, 180000);
  it("enforces reviewer permissions, terminal decisions, reason and first-rejection semantics", async () => {
    const draft = await validDraft();
    await expect(approveArticleRevision({ revisionId: draft.revisionId }, users[2].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    await submitArticleForModeration(draft, users[0].headers);
    const input = { revisionId: draft.revisionId };
    await expect(approveArticleRevision(input, new Headers())).rejects.toThrow("UNAUTHENTICATED");
    await expect(getPendingModerationQueue(1, users[0].headers)).rejects.toThrow("FORBIDDEN");
    await expect(getRevisionForModeration(draft.revisionId, users[0].headers)).rejects.toThrow("FORBIDDEN");
    await expect(approveArticleRevision(input, users[0].headers)).rejects.toThrow("FORBIDDEN");
    await expect(rejectArticleRevision({ ...input, reason: "Причина отказа" }, users[0].headers)).rejects.toThrow("FORBIDDEN");
    await expect(rejectArticleRevision({ ...input, reason: " " }, users[2].headers)).rejects.toThrow();
    await prisma.user.update({ where: { id: users[2].id }, data: { isBanned: true } });
    try { await expect(approveArticleRevision(input, users[2].headers)).rejects.toThrow("BANNED"); }
    finally { await prisma.user.update({ where: { id: users[2].id }, data: { isBanned: false, role: "USER" } }); }
    try { await expect(approveArticleRevision(input, users[2].headers)).rejects.toThrow("FORBIDDEN"); }
    finally { await prisma.user.update({ where: { id: users[2].id }, data: { role: "MODERATOR" } }); }
    await rejectArticleRevision({ ...input, reason: "Материал требует доработки." }, users[2].headers);
    const article = await prisma.article.findUniqueOrThrow({ where: { id: draft.articleId } });
    expect(article.status).toBe("DRAFT"); expect(article.publishedRevisionId).toBeNull(); expect(article.publishedAt).toBeNull();
    const rejected = await snapshot(draft.revisionId);
    await expect(approveArticleRevision(input, users[3].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(rejectArticleRevision({ ...input, reason: "Другое решение" }, users[3].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot(draft.revisionId)).toEqual(rejected);
    const corrected = await createDraftRevision(draft.articleId, users[0].headers);
    expect(corrected.version).toBe(2); expect(corrected.title).toBe(rejected.title);
  }, 150000);
  it("commits exactly one concurrent review with consistent reviewer and publication metadata", async () => {
    const draft = await validDraft(); await submitArticleForModeration(draft, users[0].headers);
    const outcomes = await Promise.allSettled([approveArticleRevision({ revisionId: draft.revisionId }, users[2].headers), rejectArticleRevision({ revisionId: draft.revisionId, reason: "Решение второго модератора." }, users[3].headers)]);
    expect(outcomes.filter((value) => value.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((value) => value.status === "rejected")).toHaveLength(1);
    const revision = await snapshot(draft.revisionId), article = await prisma.article.findUniqueOrThrow({ where: { id: draft.articleId } });
    if (outcomes[0].status === "fulfilled") { expect(revision.status).toBe("APPROVED"); expect(revision.reviewedById).toBe(users[2].id); expect(revision.rejectionReason).toBeNull(); expect(article.publishedRevisionId).toBe(revision.id); expect(article.status).toBe("PUBLISHED"); }
    else { expect(revision.status).toBe("REJECTED"); expect(revision.reviewedById).toBe(users[3].id); expect(revision.rejectionReason).toBe("Решение второго модератора."); expect(article.publishedRevisionId).toBeNull(); expect(article.status).toBe("DRAFT"); }
    expect(revision.reviewedAt).not.toBeNull();
    await expect(approveArticleRevision({ revisionId: draft.revisionId }, users[2].headers)).rejects.toThrow();
    await expect(rejectArticleRevision({ revisionId: draft.revisionId, reason: "Повторное решение" }, users[3].headers)).rejects.toThrow();
  }, 90000);
  it("returns a bounded chronological queue and authorizes only images in submitted snapshots", async () => {
    const draft = await validDraft();
    const referenced = await prisma.articleImage.create({ data: { articleId: draft.articleId, pathname: `qa/${run}/referenced.webp` } });
    const unrelated = await prisma.articleImage.create({ data: { articleId: draft.articleId, pathname: `qa/${run}/unrelated.webp` } });
    await updateArticleDraft({ ...draft, patch: { coverImage: `/api/articles/${draft.articleId}/images/${referenced.id}` } }, users[0].headers);
    await submitArticleForModeration({ ...draft, editVersion: 2 }, users[0].headers);
    await prisma.articleRevision.update({ where: { id: draft.revisionId }, data: { submittedAt: new Date("2000-01-01T00:00:00Z") } });
    const queue = await getPendingModerationQueue(1, users[2].headers);
    expect(queue.revisions.length).toBeLessThanOrEqual(20); expect(queue.revisions.some((value) => value.id === draft.revisionId)).toBe(true);
    const dates = queue.revisions.map((value) => value.submittedAt!.getTime()); expect(dates).toEqual([...dates].sort((a, b) => a - b));
    const preview = await getRevisionForModeration(draft.revisionId, users[2].headers);
    expect(preview.content).toEqual(content); expect(preview.tags.map(({ tag }) => tag.name)).toEqual([tag]); expect(preview.article.author).not.toHaveProperty("email");
    await expect(readModerationImage(draft.revisionId, referenced.id, users[0].headers)).rejects.toThrow("FORBIDDEN");
    await expect(readModerationImage(draft.revisionId, unrelated.id, users[2].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", ""); vi.stubEnv("BLOB_STORE_ID", "");
    try { await expect(readModerationImage(draft.revisionId, referenced.id, users[2].headers)).rejects.toMatchObject({ code: "STORAGE" }); }
    finally { vi.unstubAllEnvs(); }
    // Metadata fixtures only, never fake a Blob upload or contact external storage.
  }, 90000);
});
