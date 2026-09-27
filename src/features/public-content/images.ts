import "server-only";
import { get } from "@vercel/blob";
import { getPrisma } from "@/lib/prisma";
import { documentImages, imageSourcePattern, validDocument } from "@/features/articles/content";
import { storageConfigured } from "@/features/articles/images";
import { ArticleError } from "@/features/articles/errors";
import { publicArticleWhere } from "./queries";

export function publicImageUrl(source: string) {
  const match = imageSourcePattern.exec(source);
  return match ? `/api/public/articles/${match[1]}/images/${match[2]}` : "";
}
/** Authorization is independently testable without pretending a Blob file exists. */
export async function getPublishedImageRecord(articleId: string, imageId: string) {
  if (![articleId, imageId].every((id) => /^[a-zA-Z0-9_-]{1,80}$/.test(id))) return null;
  const image = await getPrisma().articleImage.findFirst({
    where: { id: imageId, articleId, article: publicArticleWhere },
    select: { pathname: true, article: { select: { publishedRevision: { select: { content: true, coverImage: true } } } } },
  });
  const revision = image?.article.publishedRevision;
  if (!image || !revision) return null;
  const source = `/api/articles/${articleId}/images/${imageId}`;
  const references = [revision.coverImage, ...(validDocument(revision.content) ? documentImages(revision.content) : [])];
  return references.includes(source) ? { pathname: image.pathname } : null;
}
export async function readPublishedImage(articleId: string, imageId: string) {
  const image = await getPublishedImageRecord(articleId, imageId);
  if (!image) throw new ArticleError("NOT_FOUND", "Изображение не найдено.");
  if (!storageConfigured()) throw new ArticleError("STORAGE", "Хранилище не настроено.");
  return get(image.pathname, { access: "private", useCache: false });
}
