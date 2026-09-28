import "server-only";
import { requireAuth } from "@/lib/auth/guards";
import { getPrisma } from "@/lib/prisma";
import { publicArticleWhere } from "@/features/public-content/visibility";
import { cardSelect, toCard } from "@/features/public-content/queries";
import { publicPage, PAGE_SIZE, MAX_PAGE } from "@/features/public-content/params";

export async function getFollowingFeed(pageInput: unknown = 1, requestHeaders?: Headers) {
  const user = await requireAuth(requestHeaders);
  const page = publicPage(pageInput);
  const rows = await getPrisma().article.findMany({
    where: { AND: [publicArticleWhere, { author: { followers: { some: { followerId: user.id } } } }] },
    select: cardSelect, orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1, skip: (page - 1) * PAGE_SIZE,
  });
  return { items: rows.slice(0, PAGE_SIZE).map(toCard), page, hasNext: rows.length > PAGE_SIZE && page < MAX_PAGE };
}
