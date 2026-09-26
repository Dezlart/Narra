import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { documentImages, imageSourcePattern, type RichNode } from "./content";
import { ArticleError } from "./errors";

export async function validateImageReferences(tx: Prisma.TransactionClient, articleId: string, fields: { content?: RichNode; coverImage?: string | null }) {
  const sources = [...(fields.content ? documentImages(fields.content) : []), ...(fields.coverImage ? [fields.coverImage] : [])];
  const ids = new Set<string>();
  for (const source of sources) {
    const match = imageSourcePattern.exec(source);
    if (!match || match[1] !== articleId) throw new ArticleError("INVALID_IMAGE", "Изображение не принадлежит статье.");
    ids.add(match[2]);
  }
  if (ids.size && await tx.articleImage.count({ where: { articleId, id: { in: [...ids] } } }) !== ids.size) {
    throw new ArticleError("INVALID_IMAGE", "Изображение не найдено.");
  }
}
