import { readModerationImage } from "@/features/moderation/images";
import { articleHttpError } from "@/features/articles/http";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ revisionId: string; imageId: string }> }) {
  try {
    const { revisionId, imageId } = await params;
    const result = await readModerationImage(revisionId, imageId, request.headers);
    if (!result || result.statusCode !== 200) return new Response(null, { status: 404 });
    return new Response(result.stream, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return articleHttpError(error); }
}
