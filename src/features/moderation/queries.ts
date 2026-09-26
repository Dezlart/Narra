import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireModerator } from "@/lib/auth/guards";
import { idSchema } from "@/features/articles/schemas";
import { ArticleError } from "@/features/articles/errors";
export async function getPendingModerationQueue(page = 1, requestHeaders?: Headers) {
  await requireModerator(requestHeaders);
  const currentPage = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const rows = await getPrisma().articleRevision.findMany({ where: { status: "PENDING", article: { status: { not: "ARCHIVED" } } },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }], skip: (currentPage - 1) * 20, take: 21,
    select: { id: true, title: true, version: true, submittedAt: true, category: { select: { name: true } },
      article: { select: { publishedRevisionId: true, author: { select: { name: true, username: true } } } } } });
  return { revisions: rows.slice(0, 20), hasNext: rows.length > 20, page: currentPage };
}
export async function getRevisionForModeration(input: unknown, requestHeaders?: Headers) {
  await requireModerator(requestHeaders);
  const id = idSchema.parse(input);
  const revision = await getPrisma().articleRevision.findFirst({ where: { id, status: { not: "DRAFT" } },
    select: { id: true, articleId: true, title: true, excerpt: true, content: true, coverImage: true, version: true,
      status: true, submittedAt: true, reviewedAt: true, rejectionReason: true,
      reviewedBy: { select: { name: true, username: true } }, category: { select: { name: true } }, tags: { select: { tag: { select: { name: true } } } },
      article: { select: { status: true, publishedRevisionId: true, author: { select: { name: true, username: true } } } } } });
  if (!revision) throw new ArticleError("NOT_FOUND", "Отправленная версия не найдена.");
  return revision;
}
