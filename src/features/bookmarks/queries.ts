import "server-only";
import { getPrisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { cardSelect, toCard } from "@/features/public-content/queries";
import { publicPage, PAGE_SIZE } from "@/features/public-content/params";
export async function getOwnBookmarks(pageInput: unknown = 1, requestHeaders?: Headers) {
  const actor = await requireAuth(requestHeaders);
  const page = publicPage(pageInput);
  const rows = await getPrisma().bookmark.findMany({ where: { userId: actor.id, article: publicArticleWhere },
    select: { createdAt: true, article: { select: cardSelect } },
    orderBy: [{ createdAt: "desc" }, { articleId: "asc" }], take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE });
  return { items: rows.slice(0, PAGE_SIZE).map((row) => ({ ...toCard(row.article), savedAt: row.createdAt })),
    page, hasNext: rows.length > PAGE_SIZE && page < 1000 };
}
