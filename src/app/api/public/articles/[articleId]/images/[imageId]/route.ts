import { readPublishedImage } from "@/features/public-content/images";
import { articleHttpError } from "@/features/articles/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ articleId: string; imageId: string }> }) {
  try {
    const { articleId, imageId } = await params;
    const result = await readPublishedImage(articleId, imageId);
    const headers = { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    if (!result || result.statusCode !== 200) return new Response(null, { status: 404, headers });
    return new Response(result.stream, { headers });
  } catch (error) { return articleHttpError(error); }
}
