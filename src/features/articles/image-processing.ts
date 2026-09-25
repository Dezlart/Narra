import sharp from "sharp";
import { ArticleError } from "./errors";
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
export async function prepareImage(bytes: Buffer, mime: string) {
  if (!formats[mime] || !bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ArticleError("INVALID_IMAGE", "Выберите JPEG, PNG или WebP до 3 МБ.");
  try {
    const decoder = sharp(bytes, { limitInputPixels: 20000000, failOn: "warning", animated: false });
    const meta = await decoder.metadata();
    if (meta.format !== formats[mime] || (meta.pages ?? 1) !== 1) throw new Error("Invalid format");
    // Decode and re-encode; strip metadata and any appended non-image payload.
    const result = await decoder.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (result.length > MAX_IMAGE_BYTES) throw new Error("Too large");
    return result;
  } catch { throw new ArticleError("INVALID_IMAGE", "Файл повреждён или не поддерживается. Максимум 20 мегапикселей, без анимации."); }
}
