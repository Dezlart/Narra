import { readArticleImage } from "@/features/articles/images";
import { articleHttpError } from "@/features/articles/http";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  try {
    const { id, imageId } = await params;
    const result = await readArticleImage(id, imageId, request.headers);
    if (!result || result.statusCode !== 200) return new Response(null, { status: 404 });
    return new Response(result.stream, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
  } catch (error) { return articleHttpError(error); }
}
