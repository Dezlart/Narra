import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createCommentSchema, repliesSchema } from "@/features/comments/schemas";
import { publicCommentView, type CommentRow } from "@/features/comments/view";
import { articleSocialSchema, followSchema } from "@/features/social/schemas";
import { socialErrorMessage } from "@/features/social/errors";
import { safeReturnTo } from "@/features/auth/schemas";
const comment = { articleId: "article", content: "  Мысль  ", requestId: "39e5f7a6-5e4f-4a2d-9d85-170d77ace568" };
describe("social input and privacy boundaries", () => {
  it("normalizes plain text and rejects forged identities/status", () => {
    expect(createCommentSchema.parse(comment)).toMatchObject({ content: "Мысль", parentId: null });
    for (const extra of [{ authorId: "other" }, { role: "ADMIN" }, { hiddenAt: null }, { id: "chosen" }]) expect(createCommentSchema.safeParse({ ...comment, ...extra }).success).toBe(false);
    expect(articleSocialSchema.safeParse({ articleId: "article", userId: "other" }).success).toBe(false);
    expect(followSchema.safeParse({ username: "author", followerId: "other" }).success).toBe(false);
  });
  it.each(["", "  ", "\u200b\u200c", "x".repeat(2001), "hello\u0000"])("rejects invalid comment body %#", (content) => {
    expect(createCommentSchema.safeParse({ ...comment, content }).success).toBe(false);
  });
  it("bounds reply requests and requires a nonce", () => {
    for (const page of [0, -1, 1.5, 1001, "2"]) expect(repliesSchema.safeParse({ articleId: "a", parentId: "b", page }).success).toBe(false);
    expect(createCommentSchema.safeParse({ ...comment, requestId: "bad" }).success).toBe(false);
  });
  it("redacts removed, moderated and banned content before serialization", () => {
    const row: CommentRow = { id: "c", authorId: "u", parentId: null, content: "PRIVATE-TEXT", createdAt: new Date(), updatedAt: new Date(), deletedAt: null, hiddenAt: null, author: { name: "PRIVATE-NAME", username: "author", isBanned: false }, _count: { replies: 2 } };
    expect(publicCommentView(row, "u")).toMatchObject({ content: "PRIVATE-TEXT", canDelete: true, canReply: true, hasReplies: true });
    for (const hidden of [{ ...row, hiddenAt: new Date() }, { ...row, deletedAt: new Date() }, { ...row, author: { ...row.author, isBanned: true } }]) {
      const view = publicCommentView(hidden, "u");
      expect(view.content).toBeNull(); expect(view.author).toBeNull(); expect(view.canReply).toBe(false);
      expect(JSON.stringify(view)).not.toContain("PRIVATE-"); expect(view).not.toHaveProperty("authorId");
    }
    expect(publicCommentView({ ...row, deletedAt: new Date() }, "u").canDelete).toBe(false);
  });
  it("never surfaces raw infrastructure errors", () => {
    expect(socialErrorMessage(new Error("postgres://secret@host DATABASE"))).not.toMatch(/secret|postgres|DATABASE/);
  });
  it("allows return to social destinations without open redirects", () => {
    for (const path of ["/articles/story-1", "/profile/author_1", "/dashboard/bookmarks", "/admin/comments"]) expect(safeReturnTo(path)).toBe(path);
    for (const path of ["//evil.test", "/articles/../admin", "/profile/a%2Fb", "/articles/a?returnTo=//evil", "/articles/a#x", "/profile/ab"]) expect(safeReturnTo(path)).toBe("/dashboard");
  });
});
