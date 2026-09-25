import { requireAuth } from "@/lib/auth/guards";
import { getArticleDraftById } from "@/features/articles/service";
import { uploadArticleImage } from "@/features/articles/images";
import { MAX_IMAGE_BYTES } from "@/features/articles/image-processing";
import { ArticleError } from "@/features/articles/errors";
import { articleHttpError } from "@/features/articles/http";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.BETTER_AUTH_URL || request.headers.get("origin") !== new URL(process.env.BETTER_AUTH_URL).origin) return new Response(null, { status: 403 });
    await requireAuth(request.headers);
    const { id } = await params;
    const article = await getArticleDraftById(id, request.headers);
    if (!article.draft || article.locked) throw new ArticleError("LOCKED", "Черновик недоступен.");
    if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new ArticleError("INVALID_IMAGE", "Максимальный размер — 3 МБ.");
    const reader = request.body?.getReader();
    if (!reader) throw new ArticleError("INVALID_IMAGE", "Выберите изображение.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_IMAGE_BYTES) { await reader.cancel(); throw new ArticleError("INVALID_IMAGE", "Максимальный размер — 3 МБ."); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const result = await uploadArticleImage(id, Buffer.concat(chunks), request.headers.get("content-type") ?? "", request.headers);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return articleHttpError(error); }
}
