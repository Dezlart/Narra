import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  notification: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
  article: { findMany: vi.fn() }, articleRevision: { findMany: vi.fn() }, comment: { findMany: vi.fn() },
}));
vi.mock("@/lib/auth/guards", () => ({ requireAuth: mock.requireAuth }));
vi.mock("@/lib/prisma", () => ({ getPrisma: () => mock }));
import { getOwnNotifications, getUnreadNotificationCount } from "@/features/notifications/queries";
import { getFollowingFeed } from "@/features/follows/feed";
import { notificationIdSchema } from "@/features/notifications/schemas";
import { safeReturnTo } from "@/features/auth/schemas";
import { publicArticleWhere } from "@/features/public-content/visibility";

const stamp = new Date("2026-09-28T12:00:00Z");
const row = { id: "notification", type: "ARTICLE_COMMENT", articleId: "article", revisionId: null, commentId: "comment", createdAt: stamp, readAt: null,
  actor: { name: "Читатель", username: "reader", isBanned: false } };
beforeEach(() => {
  vi.resetAllMocks(); mock.requireAuth.mockResolvedValue({ id: "me" });
  mock.notification.findMany.mockResolvedValue([]); mock.notification.count.mockResolvedValue(3);
  mock.article.findMany.mockResolvedValue([]); mock.articleRevision.findMany.mockResolvedValue([]); mock.comment.findMany.mockResolvedValue([]);
});
describe("notification boundary and contextual privacy", () => {
  it("accepts only a notification ID, rejecting actor, URL and event creation payloads", () => {
    expect(notificationIdSchema.parse({ notificationId: "abc-123" })).toEqual({ notificationId: "abc-123" });
    for (const extra of [{ type: "ARTICLE_APPROVED" }, { recipientId: "victim" }, { href: "https://evil.test" }, { readAt: stamp }]) {
      expect(notificationIdSchema.safeParse({ notificationId: "abc", ...extra }).success).toBe(false);
    }
    for (const notificationId of ["", "../secret", "a".repeat(81)]) expect(notificationIdSchema.safeParse({ notificationId }).success).toBe(false);
  });
  it("allows exact private return destinations without arbitrary URLs", () => {
    for (const path of ["/following", "/dashboard/notifications"]) expect(safeReturnTo(path)).toBe(path);
    for (const path of ["//evil.test", "/following?redirect=https://evil.test", "/dashboard/notifications/other"]) expect(safeReturnTo(path)).toBe("/dashboard");
  });
  it("rejects unauthenticated reads before database queries", async () => {
    mock.requireAuth.mockRejectedValue(new Error("UNAUTHENTICATED"));
    await expect(getOwnNotifications()).rejects.toThrow("UNAUTHENTICATED");
    await expect(getFollowingFeed()).rejects.toThrow("UNAUTHENTICATED");
    expect(mock.notification.findMany).not.toHaveBeenCalled(); expect(mock.article.findMany).not.toHaveBeenCalled();
  });
  it("counts unread only for the authenticated recipient without loading rows", async () => {
    expect(await getUnreadNotificationCount()).toBe(3);
    expect(mock.notification.count).toHaveBeenCalledWith({ where: { recipientId: "me", readAt: null } });
    expect(mock.notification.findMany).not.toHaveBeenCalled();
  });
  it("does not fetch contextual relations for an empty notification page", async () => {
    expect((await getOwnNotifications()).items).toEqual([]);
    expect(mock.article.findMany).not.toHaveBeenCalled();
    expect(mock.articleRevision.findMany).not.toHaveBeenCalled();
    expect(mock.comment.findMany).not.toHaveBeenCalled();
  });
  it("bounds pagination and orders notifications by timestamp then ID", async () => {
    await getOwnNotifications(2);
    expect(mock.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { recipientId: "me" }, skip: 20, take: 21, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }));
    expect((await getOwnNotifications("bad")).page).toBe(1);
    expect((await getOwnNotifications("9999")).page).toBe(1000);
  });
  it("uses one following relation filter, published snapshot, bounded server pagination", async () => {
    await getFollowingFeed(2);
    expect(mock.article.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [publicArticleWhere, { author: { followers: { some: { followerId: "me" } } } }] },
      skip: 12, take: 13, orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    }));
    const select = mock.article.findMany.mock.calls[0][0].select;
    expect(select.publishedRevision.select.content).toBeUndefined(); expect(select.revisions).toBeUndefined();
  });
  it("does not disclose unavailable comment or article context", async () => {
    mock.notification.findMany.mockResolvedValue([row]);
    const result = (await getOwnNotifications()).items[0];
    expect(result).toMatchObject({ text: "Комментарий больше недоступен", href: null, unread: true });
    expect(result).not.toHaveProperty("actor"); expect(result).not.toHaveProperty("commentId");
    expect(mock.comment.findMany.mock.calls[0][0].select).toEqual({ id: true });
  });
  it("renders comment events from current public title, never a copied comment body", async () => {
    mock.notification.findMany.mockResolvedValue([row]);
    mock.article.findMany.mockResolvedValue([{ id: "article", slug: "story", publishedRevision: { title: "Публичная история" } }]);
    mock.comment.findMany.mockResolvedValue([{ id: "comment" }]);
    expect((await getOwnNotifications()).items[0]).toMatchObject({ text: "Читатель прокомментировал статью «Публичная история»", href: "/articles/story#comments" });
  });
  it("masks banned actors and keeps historical follows unavailable", async () => {
    mock.notification.findMany.mockResolvedValue([{ ...row, type: "NEW_FOLLOWER", actor: { ...row.actor, isBanned: true } }]);
    expect((await getOwnNotifications()).items[0]).toMatchObject({ text: "Новый подписчик больше недоступен", href: null });
  });
  it("selects moderation revisions only through recipient ownership and verifies article relation", async () => {
    mock.notification.findMany.mockResolvedValue([{ ...row, type: "ARTICLE_REJECTED", revisionId: "revision" }]);
    mock.articleRevision.findMany.mockResolvedValue([{ id: "revision", articleId: "different", title: "Private" }]);
    expect((await getOwnNotifications()).items[0]).toMatchObject({ text: "Решение по недоступной статье", href: null });
    expect(mock.articleRevision.findMany.mock.calls[0][0].where.article).toEqual({ authorId: "me" });
  });
  it("links own moderation event to its exact history revision", async () => {
    mock.notification.findMany.mockResolvedValue([{ ...row, type: "ARTICLE_REJECTED", revisionId: "revision", readAt: stamp }]);
    mock.articleRevision.findMany.mockResolvedValue([{ id: "revision", articleId: "article", title: "Моя история" }]);
    expect((await getOwnNotifications()).items[0]).toMatchObject({ text: "Ваша статья «Моя история» отклонена", href: "/dashboard/articles/article?revision=revision#revision-revision", unread: false });
  });
});
