import { describe, expect, it } from "vitest";
import { publicationSchema, rejectionReasonSchema, rejectSchema, reviewSchema, submitSchema } from "@/features/moderation/schemas";
import { safeReturnTo } from "@/features/auth/schemas";
const fields = { title: "Настоящая история", excerpt: "Описание материала для будущих читателей.", categoryId: "category", tags: [], coverImage: null,
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Достаточно содержательный текст статьи о людях и событиях нашего города." }] }] } };
describe("publication boundaries", () => {
  it("accepts valid text without tags or cover", () => expect(publicationSchema.safeParse(fields).success).toBe(true));
  it.each([
    { title: "    " }, { title: "tiny" }, { title: "x".repeat(181) }, { excerpt: " " }, { excerpt: "x".repeat(501) }, { categoryId: null },
    { content: { type: "doc", content: [{ type: "paragraph" }] } },
    { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: " \n\u200B".repeat(40) }] }] } },
    { content: { type: "doc", content: [{ type: "script" }] } }, { content: null },
  ])("rejects incomplete or malicious snapshots", (patch) => expect(publicationSchema.safeParse({ ...fields, ...patch }).success).toBe(false));
  it("accepts media in the document, not a cover as a substitute for an empty body", () => {
    const image = "/api/articles/a/images/i";
    expect(publicationSchema.safeParse({ ...fields, content: { type: "doc", content: [{ type: "image", attrs: { src: image } }] } }).success).toBe(true);
    expect(publicationSchema.safeParse({ ...fields, coverImage: image, content: { type: "doc", content: [{ type: "paragraph" }] } }).success).toBe(false);
  });
  it("rejects forged privilege/status/reviewer fields", () => {
    for (const key of ["status", "reviewedById", "authorId", "publishedRevisionId"]) {
      expect(submitSchema.safeParse({ articleId: "a", revisionId: "r", editVersion: 1, [key]: "APPROVED" }).success).toBe(false);
      expect(reviewSchema.safeParse({ revisionId: "r", [key]: "APPROVED" }).success).toBe(false);
      expect(rejectSchema.safeParse({ revisionId: "r", reason: "Причина отказа", [key]: "APPROVED" }).success).toBe(false);
    }
  });
  it("requires a bounded trimmed rejection reason", () => {
    expect(rejectionReasonSchema.parse("  Добавьте источники.  ")).toBe("Добавьте источники.");
    for (const reason of ["", "     ", "нет", "x".repeat(2001)]) expect(rejectionReasonSchema.safeParse(reason).success).toBe(false);
  });
  it("allows only implemented moderation/history return destinations", () => {
    for (const value of ["/admin/moderation", "/admin/moderation/rev-1", "/dashboard/articles/story1"]) expect(safeReturnTo(value)).toBe(value);
    for (const value of ["/admin/users", "/admin/moderation/../users", "/admin/moderation/r?url=//evil", "//evil"]) expect(safeReturnTo(value)).toBe("/dashboard");
  });
});
