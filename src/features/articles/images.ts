import "server-only";
import { randomUUID } from "node:crypto";
import { put, del, get } from "@vercel/blob";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { lockOwnedArticle } from "./service";
import { idSchema } from "./schemas";
import { ArticleError } from "./errors";
import { prepareImage } from "./image-processing";
export function storageConfigured() { return !!(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)); }
export async function uploadArticleImage(articleInput: unknown, bytes: Buffer, mime: string, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const articleId = idSchema.parse(articleInput);
  // Ownership is checked before decoding or contacting storage.
  await getPrisma().$transaction(async (tx) => {
    await lockOwnedArticle(tx, articleId, actor.id);
    if (!await tx.articleRevision.count({ where: { articleId, status: "DRAFT" } })) throw new ArticleError("LOCKED", "Сначала создайте черновик.");
  }, { timeout: 25000 });
  const data = await prepareImage(bytes, mime);
  if (!storageConfigured()) throw new ArticleError("STORAGE", "Загрузка пока недоступна: владелец сайта должен настроить Vercel Blob.");
  const id = randomUUID();
  const pathname = `articles/${articleId}/${id}.webp`;
  await getPrisma().$transaction(async (tx) => {
    await lockOwnedArticle(tx, articleId, actor.id);
    if (!await tx.articleRevision.count({ where: { articleId, status: "DRAFT" } })) throw new ArticleError("LOCKED", "Черновик уже закрыт.");
    if (await tx.articleImage.count({ where: { articleId } }) >= 100 || await tx.articleImage.count({ where: { articleId, createdAt: { gte: new Date(Date.now() - 60000) } } }) >= 10) throw new ArticleError("LIMIT", "Лимит изображений: 100 на статью, 10 в минуту.");
    await tx.articleImage.create({ data: { id, articleId, pathname } });
  }, { timeout: 25000 });
  try {
    await put(pathname, data, { access: "private", contentType: "image/webp", addRandomSuffix: false, allowOverwrite: false });
    await getPrisma().$transaction(async (tx) => {
      await lockOwnedArticle(tx, articleId, actor.id);
      if (!await tx.articleRevision.count({ where: { articleId, status: "DRAFT" } })) throw new ArticleError("LOCKED", "Черновик уже закрыт.");
    }, { timeout: 25000 });
    return { src: `/api/articles/${articleId}/images/${id}` };
  } catch {
    // Only this operation's unique object can be cleaned up, never shared images.
    await del(pathname).catch(() => undefined);
    await getPrisma().articleImage.deleteMany({ where: { id, articleId } });
    throw new ArticleError("STORAGE", "Не удалось загрузить изображение. Проверьте соединение и настройку хранилища.");
  }
}
export async function readArticleImage(articleInput: unknown, imageInput: unknown, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const articleId = idSchema.parse(articleInput), id = idSchema.parse(imageInput);
  const record = await getPrisma().articleImage.findFirst({ where: { id, articleId, article: { authorId: actor.id } } });
  if (!record) throw new ArticleError("NOT_FOUND", "Изображение не найдено.");
  if (!storageConfigured()) throw new ArticleError("STORAGE", "Хранилище не настроено.");
  return get(record.pathname, { access: "private" });
}
