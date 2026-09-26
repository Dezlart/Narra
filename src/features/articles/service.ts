import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { AuthorizationError } from "@/features/auth/permissions";
import { ArticleError } from "./errors";
import { deleteDraftSchema, idSchema, saveDraftSchema, type DraftView } from "./schemas";
import { emptyDocument, type RichNode } from "./content";
import { validateImageReferences } from "./image-references";

type Tx = Prisma.TransactionClient;
const revisionInclude = { tags: { include: { tag: true } } } satisfies Prisma.ArticleRevisionInclude;
type Revision = Prisma.ArticleRevisionGetPayload<{ include: typeof revisionInclude }>;
function view(articleId: string, published: boolean, revision: Revision): DraftView {
  return { articleId, published, revisionId: revision.id, editVersion: revision.editVersion, version: revision.version,
    title: revision.title, excerpt: revision.excerpt, content: revision.content as RichNode, coverImage: revision.coverImage,
    categoryId: revision.categoryId, tags: revision.tags.map((v) => v.tag.name) };
}
export async function lockActiveAuthor(tx: Tx, userId: string) {
  // Shared row lock allows concurrent edits but prevents a ban from racing a write.
  const users = await tx.$queryRaw<{ isBanned: boolean }[]>`SELECT "isBanned" FROM "User" WHERE id = ${userId} FOR SHARE`;
  if (!users[0] || users[0].isBanned) throw new AuthorizationError("BANNED");
}
export async function lockOwnedArticle(tx: Tx, articleId: string, userId: string) {
  await lockActiveAuthor(tx, userId);
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Article" WHERE id = ${articleId} AND "authorId" = ${userId} FOR UPDATE`;
  if (!rows.length) throw new ArticleError("NOT_FOUND", "Статья не найдена.");
  const article = await tx.article.findUniqueOrThrow({ where: { id: articleId } });
  if (article.status === "ARCHIVED") throw new ArticleError("LOCKED", "Архивная статья недоступна для редактирования.");
  if (await tx.articleRevision.count({ where: { articleId, status: "PENDING" } })) throw new ArticleError("LOCKED", "Версия на модерации. Дождитесь решения.");
  return article;
}
const transactionOptions = { maxWait: 10000, timeout: 25000 };

export async function createArticleDraft(requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  return getPrisma().$transaction(async (tx) => {
    await lockActiveAuthor(tx, actor.id);
    const article = await tx.article.create({ data: { authorId: actor.id, slug: `story-${randomUUID()}`,
      revisions: { create: { version: 1, content: emptyDocument as Prisma.InputJsonValue } } } });
    return { articleId: article.id };
  }, transactionOptions);
}

/** Explicit POST operation; opening/prefetching a page never creates revisions. */
export async function createDraftRevision(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const articleId = idSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    const article = await lockOwnedArticle(tx, articleId, actor.id);
    const existing = await tx.articleRevision.findFirst({ where: { articleId, status: "DRAFT" }, include: revisionInclude });
    if (existing?.id === article.publishedRevisionId) throw new ArticleError("LOCKED", "Опубликованную версию редактировать нельзя.");
    if (existing) return view(articleId, !!article.publishedRevisionId, existing);
    const latest = await tx.articleRevision.findFirst({ where: { articleId }, orderBy: { version: "desc" }, include: revisionInclude });
    const source = latest?.status === "REJECTED" ? latest : article.publishedRevisionId
      ? await tx.articleRevision.findUniqueOrThrow({ where: { id: article.publishedRevisionId }, include: revisionInclude }) : latest;
    if (!source) throw new ArticleError("LOCKED", "Нет исходной версии.");
    if (source.id === article.publishedRevisionId && source.status !== "APPROVED") throw new ArticleError("LOCKED", "Опубликованная версия имеет некорректный статус.");
    const draft = await tx.articleRevision.create({ data: {
      articleId, version: (latest?.version ?? 0) + 1, title: source.title, excerpt: source.excerpt,
      content: source.content as Prisma.InputJsonValue, categoryId: source.categoryId, coverImage: source.coverImage,
      tags: { create: source.tags.map(({ tagId }) => ({ tagId })) },
    }, include: revisionInclude });
    return view(articleId, !!article.publishedRevisionId, draft);
  }, transactionOptions);
}

export async function updateArticleDraft(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const { articleId, revisionId, editVersion, patch } = saveDraftSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    const article = await lockOwnedArticle(tx, articleId, actor.id);
    if (article.publishedRevisionId === revisionId) throw new ArticleError("LOCKED", "Опубликованную версию редактировать нельзя.");
    const draft = await tx.articleRevision.findFirst({ where: { id: revisionId, articleId, status: "DRAFT" } });
    if (!draft) throw new ArticleError("LOCKED", "Эта версия больше не редактируется.");
    if (draft.editVersion !== editVersion) throw new ArticleError("CONFLICT", "Черновик изменён в другой вкладке. Ваш текст сохранён в редакторе. Скачайте копию перед перезагрузкой.");
    if (patch.categoryId && !await tx.category.findUnique({ where: { id: patch.categoryId } })) throw new ArticleError("LOCKED", "Выберите существующую категорию.");
    await validateImageReferences(tx, articleId, patch);
    const { tags, content, ...fields } = patch;
    const changed = await tx.articleRevision.updateMany({ where: { id: revisionId, articleId, status: "DRAFT", editVersion },
      data: { ...fields, ...(content ? { content: content as Prisma.InputJsonValue } : {}), editVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new ArticleError("CONFLICT", "Версия изменилась. Скачайте копию текста и перезагрузите страницу.");
    if (tags !== undefined) {
      await tx.articleRevisionTag.deleteMany({ where: { revisionId } });
      for (const name of [...tags].sort()) {
        // Injective, URL-safe encoding of the normalized name avoids slug collisions.
        const slug = `tag-${Buffer.from(name).toString("hex")}`;
        const tag = await tx.tag.upsert({ where: { slug }, create: { name, slug }, update: {} });
        await tx.articleRevisionTag.create({ data: { revisionId, tagId: tag.id } });
      }
    }
    const savedAt = new Date();
    await tx.article.update({ where: { id: articleId }, data: { updatedAt: savedAt } });
    return { editVersion: editVersion + 1, savedAt: savedAt.toISOString() };
  }, transactionOptions);
}

export async function deleteArticleDraft(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const { articleId, revisionId, editVersion } = deleteDraftSchema.parse(input);
  return getPrisma().$transaction(async (tx) => {
    const article = await lockOwnedArticle(tx, articleId, actor.id);
    const draft = await tx.articleRevision.findFirst({ where: { id: revisionId, articleId, status: "DRAFT", editVersion } });
    if (!draft) throw new ArticleError("CONFLICT", "Черновик изменён или уже удалён. Обновите список.");
    if (article.publishedRevisionId === revisionId) throw new ArticleError("LOCKED", "Опубликованную версию удалить нельзя.");
    if (article.status === "DRAFT" && !article.publishedRevisionId && await tx.articleRevision.count({ where: { articleId } }) === 1) {
      // Only the single initial DRAFT and its own relations can cascade here.
      await tx.article.delete({ where: { id: articleId } });
    } else {
      await tx.articleRevision.delete({ where: { id: revisionId } });
      await tx.article.update({ where: { id: articleId }, data: { updatedAt: new Date() } });
    }
    // Blob objects deliberately retained: cleanup must account for every revision.
  }, transactionOptions);
}

export async function getArticleDraftById(input: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const id = idSchema.parse(input);
  const article = await getPrisma().article.findFirst({ where: { id, authorId: actor.id }, include: {
    revisions: { where: { status: { in: ["DRAFT", "PENDING"] } }, orderBy: { version: "desc" }, include: revisionInclude },
  } });
  if (!article) throw new ArticleError("NOT_FOUND", "Статья не найдена.");
  const locked = article.status === "ARCHIVED" || article.revisions.some((r) => r.status === "PENDING" || r.id === article.publishedRevisionId);
  const draft = article.revisions.find((r) => r.status === "DRAFT");
  return { articleId: id, locked, draft: !locked && draft ? view(id, !!article.publishedRevisionId, draft) : null };
}
