import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPrisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth/server";
import { createArticleDraft, createDraftRevision, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { approveArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { likeArticle, unlikeArticle } from "@/features/likes/service";
import { saveArticle, unsaveArticle } from "@/features/bookmarks/service";
import { getOwnBookmarks } from "@/features/bookmarks/queries";
import { followUser, unfollowUser } from "@/features/follows/service";
import { getFollowState } from "@/features/follows/queries";
import { createComment, deleteOwnComment, hideComment, restoreComment } from "@/features/comments/service";
import { getArticleComments, getCommentReplies, getCommentsForModeration } from "@/features/comments/queries";
import { getArticleSocialState } from "@/features/social/queries";
import { getPublishedArticleBySlug } from "@/features/public-content/queries";

const db = getPrisma();
const run = randomBytes(6).toString("hex");
const emails = [0, 1, 2].map((i) => `narra-social-${run}-${i}@example.test`);
const usernames = [0, 1, 2].map((i) => `social_${run}_${i}`);
const users: { id: string; headers: Headers }[] = [];
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const guest = new Headers();
const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "История о людях и городе. Достаточно содержательный материал для проверки социальных функций." }] }] };
let categoryId: string, articleId: string, slug: string, unpublished: string, rootId: string, replyId: string;
const commentInput = (content: string, parentId: string | null = null, target = articleId) => ({ articleId: target, parentId, content, requestId: randomUUID() });
const coolDown = () => db.comment.updateMany({ where: { authorId: { in: users.map((u) => u.id) } }, data: { createdAt: new Date(Date.now() - 120000) } });
async function validDraft() {
  const draftId = (await createArticleDraft(users[0].headers)).articleId;
  const draft = (await getArticleDraftById(draftId, users[0].headers)).draft!;
  await updateArticleDraft({ articleId: draftId, revisionId: draft.revisionId, editVersion: 0, patch: { title: `Социальная история ${run}`, excerpt: "Описание истории о внимании к людям.", content: body, categoryId } }, users[0].headers);
  return { articleId: draftId, revisionId: draft.revisionId, editVersion: 1 };
}
beforeAll(async () => {
  for (let i = 0; i < emails.length; i++) {
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: `Читатель ${i} ${run}`, email: emails[i], username: usernames[i], password: randomBytes(24).toString("base64url") }),
    }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => /^(?:__Secure-)?better-auth.session_token=/.test(v)).join("; ");
    users.push({ id: (await db.user.findUniqueOrThrow({ where: { email: emails[i] } })).id, headers: new Headers({ cookie }) });
  }
  await db.user.update({ where: { id: users[2].id }, data: { role: "MODERATOR" } });
  categoryId = (await db.category.create({ data: { name: `Социальная проверка ${run}`, slug: `qa-social-${run}` } })).id;
  const published = await validDraft(); articleId = published.articleId;
  await submitArticleForModeration(published, users[0].headers);
  await approveArticleRevision({ revisionId: published.revisionId }, users[2].headers);
  slug = (await db.article.findUniqueOrThrow({ where: { id: articleId } })).slug!;
}, 120000);
afterAll(async () => {
  try {
    const owned = { author: { email: { in: emails } } };
    await db.article.updateMany({ where: owned, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: owned });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.category.deleteMany({ where: { slug: `qa-social-${run}` } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } finally { await db.$disconnect(); }
}, 120000);
describe("real social features with PostgreSQL and Better Auth", () => {
  it("enforces public visibility, authentication, ban and strict identity inputs", async () => {
    const draft = await validDraft(); unpublished = draft.articleId;
    const input = { articleId };
    for (const action of [likeArticle, unlikeArticle, saveArticle, unsaveArticle]) {
      await expect(action(input, guest)).rejects.toThrow("UNAUTHENTICATED");
      await expect(action({ articleId: unpublished }, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(action({ ...input, userId: users[0].id }, users[1].headers)).rejects.toThrow();
    }
    await expect(createComment(commentInput("Гость"), guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(createComment(commentInput("Черновик", null, unpublished), users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await submitArticleForModeration(draft, users[0].headers);
    for (const action of [likeArticle, saveArticle]) await expect(action({ articleId: unpublished }, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createComment(commentInput("Pending", null, unpublished), users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.user.update({ where: { id: users[1].id }, data: { isBanned: true } });
    try {
      for (const action of [likeArticle, unlikeArticle, saveArticle, unsaveArticle]) await expect(action(input, users[1].headers)).rejects.toThrow("BANNED");
      await expect(createComment(commentInput("Блокировка"), users[1].headers)).rejects.toThrow("BANNED");
      await expect(followUser({ username: usernames[0] }, users[1].headers)).rejects.toThrow("BANNED");
      expect((await getArticleSocialState(articleId, users[1].headers)).viewer).toBe("banned");
    } finally { await db.user.update({ where: { id: users[1].id }, data: { isBanned: false } }); }
  }, 120000);
  it("handles concurrent idempotent likes/bookmarks and isolates personal state", async () => {
    const input = { articleId };
    await Promise.all([likeArticle(input, users[1].headers), likeArticle(input, users[1].headers), saveArticle(input, users[1].headers), saveArticle(input, users[1].headers)]);
    expect(await db.like.count({ where: input })).toBe(1); expect(await db.bookmark.count({ where: input })).toBe(1);
    expect(await getArticleSocialState(articleId, users[1].headers)).toMatchObject({ liked: true, saved: true, likes: 1 });
    expect(await getArticleSocialState(articleId, users[0].headers)).toMatchObject({ liked: false, saved: false, likes: 1 });
    expect(await getArticleSocialState(articleId, guest)).toMatchObject({ liked: false, saved: false, likes: 1, viewer: "guest" });
    await unlikeArticle(input, users[0].headers); await unsaveArticle(input, users[0].headers);
    expect(await db.like.count({ where: input })).toBe(1); expect(await db.bookmark.count({ where: input })).toBe(1);
    expect((await getOwnBookmarks(1, users[1].headers)).items.map((a) => a.id)).toEqual([articleId]);
    expect((await getOwnBookmarks(1, users[0].headers)).items).toEqual([]);
    await expect(getOwnBookmarks(1, guest)).rejects.toThrow("UNAUTHENTICATED");
    await Promise.all([unlikeArticle(input, users[1].headers), unlikeArticle(input, users[1].headers), unsaveArticle(input, users[1].headers), unsaveArticle(input, users[1].headers)]);
    expect(await getArticleSocialState(articleId, users[1].headers)).toMatchObject({ liked: false, saved: false, likes: 0 });
    await likeArticle(input, users[1].headers); await saveArticle(input, users[1].headers);
    await expect(db.like.create({ data: { ...input, userId: users[1].id } })).rejects.toThrow();
    await expect(db.bookmark.create({ data: { ...input, userId: users[1].id } })).rejects.toThrow();
  }, 120000);
  it("creates nonce-idempotent comments, rate limits, validates parents, and preserves deleted threads", async () => {
    for (const content of [" ", "x".repeat(2001)]) await expect(createComment(commentInput(content), users[1].headers)).rejects.toThrow();
    const input = commentInput(`<script>window.xss=1</script> Комментарий ${run}`);
    const same = await Promise.all([createComment(input, users[1].headers), createComment(input, users[1].headers)]);
    expect(same[0].id).toBe(same[1].id); rootId = same[0].id;
    expect(await db.comment.count({ where: { authorId: users[1].id, requestId: input.requestId } })).toBe(1);
    await expect(createComment({ ...input, content: "Different" }, users[1].headers)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(createComment(commentInput(input.content), users[1].headers)).rejects.toMatchObject({ code: "RATE_LIMIT" });
    await expect(createComment(commentInput("Слишком быстро"), users[1].headers)).rejects.toMatchObject({ code: "RATE_LIMIT" });
    await coolDown();
    await expect(createComment(commentInput("Missing", "not-found"), users[1].headers)).rejects.toMatchObject({ code: "INVALID_PARENT" });
    const foreign = await db.comment.create({ data: { articleId: unpublished, authorId: users[0].id, content: "Foreign root", requestId: randomUUID() } });
    await expect(createComment(commentInput("Wrong article", foreign.id), users[1].headers)).rejects.toMatchObject({ code: "INVALID_PARENT" });
    await coolDown();
    replyId = (await createComment(commentInput("Ответ читателя", rootId), users[0].headers)).id;
    await expect(createComment(commentInput("Nested", replyId), users[1].headers)).rejects.toMatchObject({ code: "INVALID_PARENT" });
    await expect(deleteOwnComment({ commentId: rootId }, users[0].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteOwnComment({ commentId: rootId, authorId: users[1].id }, users[0].headers)).rejects.toThrow();
    await deleteOwnComment({ commentId: rootId }, users[1].headers);
    await deleteOwnComment({ commentId: rootId }, users[1].headers);
    expect(await db.comment.findUniqueOrThrow({ where: { id: rootId } })).toMatchObject({ content: "" });
    expect((await getArticleComments(articleId, 1, guest)).items.find((c) => c.id === rootId)).toMatchObject({ status: "deleted", content: null, hasReplies: true });
    expect((await getCommentReplies({ articleId, parentId: rootId, page: 1 }, guest)).items[0].id).toBe(replyId);
    await expect(createComment(commentInput("Deleted parent", rootId), users[1].headers)).rejects.toMatchObject({ code: "INVALID_PARENT" });
    expect((await createComment(input, users[1].headers)).id).toBe(rootId);
    await expect(restoreComment({ commentId: rootId }, users[2].headers)).rejects.toMatchObject({ code: "CONFLICT" });
  }, 120000);
  it("checks moderation roles freshly and removes hidden text from all public DTOs/counts", async () => {
    const input = { commentId: replyId };
    await expect(hideComment(input, users[1].headers)).rejects.toThrow("FORBIDDEN");
    await expect(getCommentsForModeration(1, undefined, users[1].headers)).rejects.toThrow("FORBIDDEN");
    await hideComment(input, users[2].headers); await hideComment(input, users[2].headers);
    const replies = await getCommentReplies({ articleId, parentId: rootId, page: 1 }, guest);
    expect(replies.items[0]).toMatchObject({ status: "hidden", content: null, author: null });
    expect(JSON.stringify(replies)).not.toContain("Ответ читателя");
    expect((await getArticleSocialState(articleId, guest)).comments).toBe(0);
    expect((await getCommentsForModeration(1, replyId, users[2].headers)).items[0].content).toBe("Ответ читателя");
    await db.user.update({ where: { id: users[2].id }, data: { role: "USER" } });
    try { await expect(restoreComment(input, users[2].headers)).rejects.toThrow("FORBIDDEN"); }
    finally { await db.user.update({ where: { id: users[2].id }, data: { role: "MODERATOR", isBanned: true } }); }
    try { await expect(restoreComment(input, users[2].headers)).rejects.toThrow("BANNED"); }
    finally { await db.user.update({ where: { id: users[2].id }, data: { isBanned: false } }); }
    await restoreComment(input, users[2].headers); await restoreComment(input, users[2].headers);
    expect((await getArticleSocialState(articleId, guest)).comments).toBe(1);
  }, 120000);
  it("keeps follow counts correct through concurrency, retries, self/ban checks and unfollow", async () => {
    const input = { username: usernames[0] };
    await expect(followUser(input, guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(followUser({ username: usernames[1] }, users[1].headers)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(followUser({ username: `absent_${run}` }, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await Promise.all([followUser(input, users[1].headers), followUser(input, users[1].headers), followUser({ username: usernames[1] }, users[0].headers)]);
    expect(await getFollowState(usernames[0], users[1].headers)).toMatchObject({ followers: 1, following: 1, active: true, isSelf: false });
    expect(await getFollowState(usernames[1], users[1].headers)).toMatchObject({ followers: 1, following: 1, isSelf: true });
    expect((await getFollowState(usernames[0], guest)).active).toBe(false);
    await expect(db.follow.create({ data: { followerId: users[1].id, followingId: users[0].id } })).rejects.toThrow();
    await expect(db.follow.create({ data: { followerId: users[1].id, followingId: users[1].id } })).rejects.toThrow();
    await db.user.update({ where: { id: users[1].id }, data: { isBanned: true } });
    try {
      expect(await getFollowState(usernames[0], guest)).toMatchObject({ followers: 0, following: 0 });
      await expect(followUser({ username: usernames[1] }, users[0].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await getArticleSocialState(articleId, guest)).likes).toBe(0);
    } finally { await db.user.update({ where: { id: users[1].id }, data: { isBanned: false } }); }
    await Promise.all([unfollowUser(input, users[1].headers), unfollowUser(input, users[1].headers)]);
    await unfollowUser({ username: usernames[1] }, users[0].headers);
    expect(await getFollowState(usernames[0], guest)).toMatchObject({ followers: 0, following: 0 });
    await followUser(input, users[1].headers);
  }, 120000);
  it("preserves social records on the stable Article through pending and approved revisions", async () => {
    const before = await getPublishedArticleBySlug(slug);
    const draft = await createDraftRevision(articleId, users[0].headers);
    const input = { articleId, revisionId: draft.revisionId, editVersion: 0 };
    await updateArticleDraft({ ...input, patch: { title: `Новая социальная история ${run}` } }, users[0].headers);
    await submitArticleForModeration({ ...input, editVersion: 1 }, users[0].headers);
    expect((await getOwnBookmarks(1, users[1].headers)).items[0].title).toBe(before!.title);
    expect(await getArticleSocialState(articleId, users[1].headers)).toMatchObject({ likes: 1, liked: true, saved: true, comments: 1 });
    await approveArticleRevision({ revisionId: draft.revisionId }, users[2].headers);
    expect((await getOwnBookmarks(1, users[1].headers)).items[0].title).toBe(`Новая социальная история ${run}`);
    expect(await db.comment.count({ where: { articleId } })).toBe(2);
    expect(await getArticleSocialState(articleId, users[1].headers)).toMatchObject({ likes: 1, liked: true, saved: true, comments: 1 });
    await db.article.update({ where: { id: articleId }, data: { status: "ARCHIVED" } });
    expect((await getOwnBookmarks(1, users[1].headers)).items).toEqual([]);
    await expect(getArticleComments(articleId, 1, guest)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getCommentReplies({ articleId, parentId: rootId, page: 1 }, guest)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(likeArticle({ articleId }, users[1].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.article.update({ where: { id: articleId }, data: { status: "PUBLISHED" } });
  }, 120000);
  it("enforces database parent constraints and bounded root/reply/bookmark pagination", async () => {
    await expect(db.comment.create({ data: { articleId, parentId: replyId, authorId: users[1].id, requestId: randomUUID(), content: "Too deep" } })).rejects.toThrow();
    await expect(db.comment.create({ data: { articleId: unpublished, parentId: rootId, authorId: users[1].id, requestId: randomUUID(), content: "Wrong article" } })).rejects.toThrow();
    await expect(db.comment.update({ where: { id: replyId }, data: { parentId: null } })).rejects.toThrow();
    await coolDown();
    const visibleRoot = await createComment(commentInput("Проверка страниц"), users[1].headers);
    await db.comment.createMany({ data: Array.from({ length: 11 }, (_, i) => ({ articleId, authorId: users[0].id, content: `Основной ${i}`, requestId: randomUUID() })) });
    await db.comment.createMany({ data: Array.from({ length: 6 }, (_, i) => ({ articleId, authorId: users[0].id, parentId: visibleRoot.id, content: `Ответ ${i}`, requestId: randomUUID() })) });
    const first = await getArticleComments(articleId, 1, guest), second = await getArticleComments(articleId, 2, guest);
    expect(first.items).toHaveLength(10); expect(first.hasNext).toBe(true); expect(second.items).toHaveLength(3); expect(second.hasNext).toBe(false);
    expect(new Set([...first.items, ...second.items].map((c) => c.id)).size).toBe(13);
    expect((await getCommentReplies({ articleId, parentId: visibleRoot.id, page: 1 }, guest)).items).toHaveLength(5);
    expect((await getCommentReplies({ articleId, parentId: visibleRoot.id, page: 2 }, guest)).items).toHaveLength(1);
    // Per-minute cap survives multiple server instances and even soft deletion.
    await coolDown();
    const capIds = Array.from({ length: 10 }, () => randomUUID());
    await db.comment.createMany({ data: capIds.map((requestId) => ({ articleId, authorId: users[2].id, content: "", deletedAt: new Date(), createdAt: new Date(Date.now() - 10000), requestId })) });
    await expect(createComment(commentInput("Minute cap"), users[2].headers)).rejects.toMatchObject({ code: "RATE_LIMIT" });
    await db.comment.deleteMany({ where: { authorId: users[2].id, requestId: { in: capIds } } });
    await db.user.update({ where: { id: users[1].id }, data: { isBanned: true } });
    try {
      const comments = [...(await getArticleComments(articleId, 1, guest)).items, ...(await getArticleComments(articleId, 2, guest)).items];
      expect(comments.find((c) => c.id === visibleRoot.id)).toMatchObject({ content: "Проверка страниц", status: "visible" });
    } finally { await db.user.update({ where: { id: users[1].id }, data: { isBanned: false } }); }
    for (let i = 0; i < 12; i++) {
      const row = await db.article.create({ data: { authorId: users[0].id, slug: `qa-social-${run}-${i}`, revisions: { create: { version: 1, status: "APPROVED", title: `Закладка ${i}`, excerpt: "Описание", content: body } } }, include: { revisions: true } });
      await db.article.update({ where: { id: row.id }, data: { status: "PUBLISHED", publishedAt: new Date(), publishedRevisionId: row.revisions[0].id } });
      await db.bookmark.create({ data: { articleId: row.id, userId: users[1].id } });
    }
    const bookmarks = await getOwnBookmarks(1, users[1].headers), next = await getOwnBookmarks(2, users[1].headers);
    expect(bookmarks.items).toHaveLength(12); expect(bookmarks.hasNext).toBe(true); expect(next.items).toHaveLength(1);
    expect(new Set([...bookmarks.items, ...next.items].map((a) => a.id)).size).toBe(13);
    // Remove only pagination fixtures so browser starts with a readable discussion.
    await db.comment.deleteMany({ where: { articleId, id: { notIn: [rootId, replyId] } } });
    await db.bookmark.deleteMany({ where: { userId: users[1].id, articleId: { not: articleId } } });
  }, 180000);
  it.skipIf(!process.env.NARRA_BROWSER_QA)("checks authenticated and guest browser scenarios when explicitly enabled", async () => {
    await coolDown();
    const output = execFileSync(process.execPath, [process.env.NARRA_BROWSER_QA!], { input: JSON.stringify({ run, articleId, slug, username: usernames[0], readerCookie: users[1].headers.get("cookie"), moderatorCookie: users[2].headers.get("cookie") }), encoding: "utf8", timeout: 300000 });
    console.log(output.trim());
  }, 330000);
});
