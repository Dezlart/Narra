import "server-only";
import { get } from "@vercel/blob";
import { getPrisma } from "@/lib/prisma";
import { idSchema } from "@/features/articles/schemas";
import { documentImages, imageSourcePattern, validDocument } from "@/features/articles/content";
import { storageConfigured } from "@/features/articles/images";
import { ArticleError } from "@/features/articles/errors";
import { getRevisionForModeration } from "./queries";

export async function readModerationImage(revisionInput: unknown, imageInput: unknown, requestHeaders?: Headers) {
  const revision = await getRevisionForModeration(revisionInput, requestHeaders);
  const id = idSchema.parse(imageInput);
  const source = `/api/articles/${revision.articleId}/images/${id}`;
  const references = [...(validDocument(revision.content) ? documentImages(revision.content) : []), revision.coverImage];
  if (!references.includes(source)) throw new ArticleError("NOT_FOUND", "Изображение не входит в отправленную версию.");
  const record = await getPrisma().articleImage.findFirst({ where: { id, articleId: revision.articleId } });
  if (!record) throw new ArticleError("NOT_FOUND", "Изображение не найдено.");
  if (!storageConfigured()) throw new ArticleError("STORAGE", "Хранилище не настроено.");
  return get(record.pathname, { access: "private" });
}
export function moderationImageUrl(revisionId: string, source: string) {
  const match = imageSourcePattern.exec(source);
  return match ? `/api/moderation/revisions/${revisionId}/images/${match[2]}` : "";
}
