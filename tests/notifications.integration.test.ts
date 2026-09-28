import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPrisma } from "@/lib/prisma";
import { getAuth } from "@/lib/auth/server";
import { createArticleDraft, createDraftRevision, getArticleDraftById, updateArticleDraft } from "@/features/articles/service";
import { getArticleRevisionHistory } from "@/features/articles/queries";
import { approveArticleRevision, rejectArticleRevision, submitArticleForModeration } from "@/features/moderation/service";
import { followUser, unfollowUser } from "@/features/follows/service";
import { getFollowingFeed } from "@/features/follows/feed";
import { createComment, deleteOwnComment, hideComment, restoreComment } from "@/features/comments/service";
import { getOwnNotifications, getUnreadNotificationCount } from "@/features/notifications/queries";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/features/notifications/service";
import { createNotification, createFollowerPublicationNotifications } from "@/features/notifications/events";

const db = getPrisma(), run = randomBytes(6).toString("hex");
const emails = [0, 1, 2, 3].map((i) => `narra-notifications-${run}-${i}@example.test`);
const usernames = [0, 1, 2, 3].map((i) => `notify_${run}_${i}`);
const passwords = emails.map(() => randomBytes(24).toString("base64url"));
const users: { id: string; headers: Headers }[] = [];
const ip = `198.18.${parseInt(run.slice(0, 2), 16)}.${parseInt(run.slice(2, 4), 16)}`;
const guest = new Headers();
const body = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Настоящая история для проверки персональной ленты, уведомлений и публикации версий." }] }] };
let categoryId: string, articleId: string, revisionId: string, slug: string, rootId: string, replyId: string;
const count = (recipientId: string, type?: "NEW_FOLLOWER" | "ARTICLE_APPROVED" | "ARTICLE_REJECTED" | "FOLLOWED_AUTHOR_PUBLISHED" | "ARTICLE_COMMENT" | "COMMENT_REPLY") => db.notification.count({ where: { recipientId, ...(type ? { type } : {}) } });
const coolDown = () => db.comment.updateMany({ where: { authorId: { in: users.map((u) => u.id) } }, data: { createdAt: new Date(Date.now() - 120000) } });
const comment = (content: string, parentId: string | null = null, target = articleId) => ({ articleId: target, parentId, content, requestId: randomUUID() });
async function draft(owner = 0) {
  const id = (await createArticleDraft(users[owner].headers)).articleId;
  const row = (await getArticleDraftById(id, users[owner].headers)).draft!;
  await updateArticleDraft({ articleId: id, revisionId: row.revisionId, editVersion: 0,
    patch: { title: `История уведомлений ${run}`, excerpt: "Описание настоящей истории для проверки.", content: body, categoryId } }, users[owner].headers);
  return { articleId: id, revisionId: row.revisionId, editVersion: 1 };
}
beforeAll(async () => {
  for (let i = 0; i < emails.length; i++) {
    const response = await getAuth().handler(new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-up/email`, {
      method: "POST", headers: { origin: process.env.BETTER_AUTH_URL!, "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ name: `Автор ${i} ${run}`, email: emails[i], username: usernames[i], password: passwords[i] }),
    }));
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().map((v) => v.split(";")[0]).filter((v) => /^(?:__Secure-)?better-auth.session_token=/.test(v)).join("; ");
    users.push({ id: (await db.user.findUniqueOrThrow({ where: { email: emails[i] } })).id, headers: new Headers({ cookie }) });
  }
  await db.user.update({ where: { id: users[2].id }, data: { role: "MODERATOR" } });
  categoryId = (await db.category.create({ data: { name: `Уведомления ${run}`, slug: `qa-notify-${run}` } })).id;
}, 120000);
afterAll(async () => {
  try {
    const owned = { author: { email: { in: emails } } };
    await db.article.updateMany({ where: owned, data: { status: "DRAFT", publishedRevisionId: null, publishedAt: null } });
    await db.article.deleteMany({ where: owned });
    await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.category.deleteMany({ where: { slug: `qa-notify-${run}` } });
    await db.rateLimit.deleteMany({ where: { key: { startsWith: `${ip}|` } } });
  } finally { await db.$disconnect(); }
}, 120000);

describe("persistent personalized feed and notification workflow", () => {
  it("rejects guests and invalid follows; concurrent follow produces one event, refollow a new one", async () => {
    for (const read of [getOwnNotifications, getFollowingFeed]) await expect(read(1, guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(getUnreadNotificationCount(guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(markAllNotificationsAsRead(guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(followUser({ username: usernames[1] }, users[1].headers)).rejects.toThrow();
    await expect(followUser({ username: `missing_${run}` }, users[1].headers)).rejects.toThrow();
    expect(await count(users[0].id)).toBe(0);
    await Promise.all([followUser({ username: usernames[0] }, users[1].headers), followUser({ username: usernames[0] }, users[1].headers)]);
    expect(await count(users[0].id, "NEW_FOLLOWER")).toBe(1);
    await unfollowUser({ username: usernames[0] }, users[1].headers);
    expect(await count(users[0].id, "NEW_FOLLOWER")).toBe(1);
    await followUser({ username: usernames[0] }, users[1].headers);
    expect(await count(users[0].id, "NEW_FOLLOWER")).toBe(2);
    expect((await getOwnNotifications(1, users[0].headers)).items[0].href).toBe(`/profile/${usernames[1]}`);
  }, 120000);

  it("publishes atomically, excludes unfollowed/banned recipients and deduplicates repeated approval/bulk event", async () => {
    const input = await draft(); articleId = input.articleId; revisionId = input.revisionId;
    expect((await getFollowingFeed(1, users[1].headers)).items).toEqual([]);
    await submitArticleForModeration(input, users[0].headers);
    expect((await getFollowingFeed(1, users[1].headers)).items).toEqual([]);
    await followUser({ username: usernames[0] }, users[3].headers);
    await unfollowUser({ username: usernames[0] }, users[3].headers);
    // A banned subscriber relation remains but must not receive publication events.
    await followUser({ username: usernames[0] }, users[2].headers);
    await db.user.update({ where: { id: users[2].id }, data: { isBanned: true } });
    await db.user.update({ where: { id: users[3].id }, data: { role: "MODERATOR" } });
    try {
      const outcomes = await Promise.allSettled([approveArticleRevision({ revisionId }, users[3].headers), approveArticleRevision({ revisionId }, users[3].headers)]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await count(users[2].id, "FOLLOWED_AUTHOR_PUBLISHED")).toBe(0);
    } finally {
      await db.user.update({ where: { id: users[2].id }, data: { isBanned: false } });
      await db.user.update({ where: { id: users[3].id }, data: { role: "USER" } });
      await unfollowUser({ username: usernames[0] }, users[2].headers);
    }
    expect(await count(users[0].id, "ARTICLE_APPROVED")).toBe(1);
    expect(await count(users[1].id, "FOLLOWED_AUTHOR_PUBLISHED")).toBe(1);
    expect(await count(users[3].id, "FOLLOWED_AUTHOR_PUBLISHED")).toBe(0);
    await db.$transaction((tx) => createFollowerPublicationNotifications(tx, articleId, users[0].id));
    expect(await count(users[1].id, "FOLLOWED_AUTHOR_PUBLISHED")).toBe(1);
    const feed = await getFollowingFeed(1, users[1].headers);
    expect(feed.items.map((a) => a.id)).toEqual([articleId]); slug = feed.items[0].slug;
    expect((await getFollowingFeed(1, users[3].headers)).items).toEqual([]);
    expect((await getOwnNotifications(1, users[1].headers)).items[0].href).toBe(`/articles/${slug}`);
  }, 120000);

  it("creates root/reply events once, suppresses self and duplicate reply notifications", async () => {
    const input = comment(`Private comment body ${run}`);
    const roots = await Promise.all([createComment(input, users[1].headers), createComment(input, users[1].headers)]);
    rootId = roots[0].id; expect(roots[1].id).toBe(rootId);
    expect(await count(users[0].id, "ARTICLE_COMMENT")).toBe(1);
    replyId = (await createComment(comment("Ответ автора", rootId), users[0].headers)).id;
    expect(await count(users[1].id, "COMMENT_REPLY")).toBe(1);
    expect(await count(users[0].id, "ARTICLE_COMMENT")).toBe(1);
    await coolDown();
    const selfRoot = await createComment(comment("Собственный комментарий"), users[0].headers);
    await coolDown();
    await createComment(comment("Собственный ответ", selfRoot.id), users[0].headers);
    expect(await count(users[0].id, "ARTICLE_COMMENT")).toBe(1);
    expect(await count(users[0].id, "COMMENT_REPLY")).toBe(0);
    await coolDown();
    await createComment(comment("Читатель отвечает автору", selfRoot.id), users[1].headers);
    expect(await count(users[0].id, "ARTICLE_COMMENT")).toBe(1);
    expect(await count(users[0].id, "COMMENT_REPLY")).toBe(1);
    const serialized = JSON.stringify(await getOwnNotifications(1, users[0].headers));
    expect(serialized).not.toContain(input.content); expect(serialized).not.toContain(emails[1]);
    await hideComment({ commentId: rootId }, users[2].headers);
    expect((await getOwnNotifications(1, users[0].headers)).items.find((n) => n.type === "ARTICLE_COMMENT")).toMatchObject({ text: "Комментарий больше недоступен", href: null });
    await restoreComment({ commentId: rootId }, users[2].headers);
    await deleteOwnComment({ commentId: rootId }, users[1].headers);
    expect((await getOwnNotifications(1, users[0].headers)).items.find((n) => n.type === "ARTICLE_COMMENT")!.href).toBeNull();
    expect((await getOwnNotifications(1, users[1].headers)).items.find((n) => n.type === "COMMENT_REPLY")!.href).toBe(`/articles/${slug}#comments`);
  }, 120000);

  it("preserves snapshot through pending/rejection and sends followers no approved-update event", async () => {
    const initial = (await getFollowingFeed(1, users[1].headers)).items[0];
    const update = await createDraftRevision(articleId, users[0].headers);
    const input = { articleId, revisionId: update.revisionId, editVersion: 0 };
    const secretTitle = `Private rejected title ${run}`;
    await updateArticleDraft({ ...input, patch: { title: secretTitle } }, users[0].headers);
    await submitArticleForModeration({ ...input, editVersion: 1 }, users[0].headers);
    expect((await getFollowingFeed(1, users[1].headers)).items[0].title).toBe(initial.title);
    expect(JSON.stringify(await getOwnNotifications(1, users[1].headers))).not.toContain(secretTitle);
    await rejectArticleRevision({ revisionId: update.revisionId, reason: "Уточните содержание перед публикацией" }, users[2].headers);
    expect(await count(users[0].id, "ARTICLE_REJECTED")).toBe(1);
    const rejection = (await getOwnNotifications(1, users[0].headers)).items.find((n) => n.type === "ARTICLE_REJECTED")!;
    expect(rejection.text).toContain(secretTitle); expect(rejection.href).toContain(update.revisionId);
    expect(JSON.stringify(await getOwnNotifications(1, users[1].headers))).not.toContain(secretTitle);
    const fixed = await createDraftRevision(articleId, users[0].headers);
    await submitArticleForModeration({ articleId, revisionId: fixed.revisionId, editVersion: 0 }, users[0].headers);
    await approveArticleRevision({ revisionId: fixed.revisionId }, users[2].headers);
    expect(await count(users[0].id, "ARTICLE_APPROVED")).toBe(2);
    expect(await count(users[1].id, "FOLLOWED_AUTHOR_PUBLISHED")).toBe(1);
    expect((await getFollowingFeed(1, users[1].headers)).items[0]).toMatchObject({ title: secretTitle, publishedAt: initial.publishedAt });
    expect((await getArticleRevisionHistory(articleId, 1, users[0].headers, update.revisionId)).revisions.some((r) => r.id === update.revisionId && r.status === "REJECTED")).toBe(true);
  }, 120000);

  it("isolates read operations, preserves readAt on retry, rejects ban and forged payload", async () => {
    const author = await getOwnNotifications(1, users[0].headers), reader = await getOwnNotifications(1, users[1].headers);
    expect(author.items.every((a) => !reader.items.some((b) => a.id === b.id))).toBe(true);
    expect(await getUnreadNotificationCount(users[1].headers)).toBe(reader.items.length);
    const id = reader.items[0].id;
    await expect(markNotificationAsRead({ notificationId: id }, users[0].headers)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(markNotificationAsRead({ notificationId: id }, guest)).rejects.toThrow("UNAUTHENTICATED");
    await expect(markNotificationAsRead({ notificationId: id, recipientId: users[1].id, type: "ARTICLE_APPROVED" }, users[0].headers)).rejects.toThrow();
    await markNotificationAsRead({ notificationId: id }, users[1].headers);
    const timestamp = (await db.notification.findUniqueOrThrow({ where: { id } })).readAt;
    await markNotificationAsRead({ notificationId: id }, users[1].headers);
    expect((await db.notification.findUniqueOrThrow({ where: { id } })).readAt).toEqual(timestamp);
    expect(await getUnreadNotificationCount(users[1].headers)).toBe(reader.items.length - 1);
    await markAllNotificationsAsRead(users[1].headers);
    expect(await getUnreadNotificationCount(users[1].headers)).toBe(0);
    expect(await getUnreadNotificationCount(users[0].headers)).toBe(author.items.length);
    await db.user.update({ where: { id: users[1].id }, data: { isBanned: true } });
    try {
      await expect(getOwnNotifications(1, users[1].headers)).rejects.toThrow("BANNED");
      await expect(getFollowingFeed(1, users[1].headers)).rejects.toThrow("BANNED");
      await expect(markAllNotificationsAsRead(users[1].headers)).rejects.toThrow("BANNED");
    } finally { await db.user.update({ where: { id: users[1].id }, data: { isBanned: false } }); }
  }, 120000);

  it("rolls back event with its mutation, deduplicates event keys and allows cross-recipient concurrency", async () => {
    const event = { recipientId: users[1].id, actorId: users[0].id, type: "NEW_FOLLOWER" as const, eventKey: `rollback:${run}` };
    await expect(db.$transaction(async (tx) => {
      await tx.follow.create({ data: { followerId: users[0].id, followingId: users[1].id } });
      await createNotification(tx, event); throw new Error("intentional rollback");
    })).rejects.toThrow("intentional rollback");
    expect(await db.notification.count({ where: { eventKey: event.eventKey } })).toBe(0);
    expect(await db.follow.count({ where: { followerId: users[0].id, followingId: users[1].id } })).toBe(0);
    await Promise.all([db.$transaction((tx) => createNotification(tx, event)), db.$transaction((tx) => createNotification(tx, event))]);
    expect(await db.notification.count({ where: { eventKey: event.eventKey } })).toBe(1);
    await db.notification.deleteMany({ where: { eventKey: event.eventKey } });
    const other = await draft(1); await submitArticleForModeration(other, users[1].headers);
    await approveArticleRevision({ revisionId: other.revisionId }, users[2].headers);
    await coolDown();
    const results = await Promise.all([
      createComment(comment("Взаимный комментарий A", null, other.articleId), users[0].headers),
      createComment(comment("Взаимный комментарий B"), users[1].headers),
    ]);
    expect(results).toHaveLength(2);
  }, 120000);

  it("paginates stably, hides archived/banned articles, degrades deleted relations without losing history", async () => {
    const stamp = new Date();
    for (let i = 0; i < 12; i++) {
      const a = await db.article.create({ data: { authorId: users[0].id, slug: `qa-notify-${run}-${i}`, revisions: { create: { version: 1, status: "APPROVED", title: `Лента ${i}`, excerpt: "Описание", content: body } } }, include: { revisions: true } });
      await db.article.update({ where: { id: a.id }, data: { status: "PUBLISHED", publishedAt: stamp, publishedRevisionId: a.revisions[0].id } });
    }
    const one = await getFollowingFeed("bad", users[1].headers), two = await getFollowingFeed(2, users[1].headers);
    expect(one.page).toBe(1); expect(one.items).toHaveLength(12); expect(one.hasNext).toBe(true); expect(two.items).toHaveLength(1);
    expect(new Set([...one.items, ...two.items].map((a) => a.id)).size).toBe(13);
    expect(one.items.map((a) => a.id)).toEqual([...one.items.map((a) => a.id)].sort().reverse());
    await db.article.update({ where: { id: articleId }, data: { status: "ARCHIVED" } });
    expect((await getOwnNotifications(1, users[1].headers)).items.find((n) => n.type === "FOLLOWED_AUTHOR_PUBLISHED")!.href).toBeNull();
    expect((await getFollowingFeed(2, users[1].headers)).items).toEqual([]);
    await db.article.update({ where: { id: articleId }, data: { status: "PUBLISHED" } });
    await db.user.update({ where: { id: users[0].id }, data: { isBanned: true } });
    try { expect((await getFollowingFeed(1, users[1].headers)).items).toEqual([]); }
    finally { await db.user.update({ where: { id: users[0].id }, data: { isBanned: false } }); }
    const ids = Array.from({ length: 24 }, () => randomUUID());
    await db.notification.createMany({ data: ids.map((id) => ({ id, recipientId: users[3].id, type: "NEW_FOLLOWER", eventKey: `page:${id}`, createdAt: stamp })) });
    const first = await getOwnNotifications(1, users[3].headers), second = await getOwnNotifications(2, users[3].headers);
    expect(first.items).toHaveLength(20); expect(first.hasNext).toBe(true); expect(second.items).toHaveLength(4);
    expect(first.items.map((n) => n.id)).toEqual([...ids].sort().reverse().slice(0, 20));
    expect(first.items.every((n) => n.href === null)).toBe(true);
    await db.notification.deleteMany({ where: { id: { in: ids } } });
    await db.comment.deleteMany({ where: { id: replyId } });
    expect((await getOwnNotifications(1, users[1].headers)).items.find((n) => n.type === "COMMENT_REPLY")!.href).toBeNull();
    // Keep pagination fixtures for browser navigation; afterAll removes them.
  }, 180000);

  it.skipIf(!process.env.NARRA_NOTIFICATION_BROWSER_QA)("checks production browser notifications and following", async () => {
    // Transport only over stdin: no passwords/cookies in files or logs.
    const output = execFileSync(process.execPath, [process.env.NARRA_NOTIFICATION_BROWSER_QA!], { input: JSON.stringify({ run, slug, username: usernames[0],
      readerEmail: emails[1], readerPassword: passwords[1], readerCookie: users[1].headers.get("cookie"), authorCookie: users[0].headers.get("cookie") }), encoding: "utf8", timeout: 300000 });
    console.log(output.trim());
  }, 330000);
});
