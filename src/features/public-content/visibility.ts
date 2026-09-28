import type { Prisma } from "@/generated/prisma/client";

// Shared by public reading, image access and social mutations.
export const publicArticleWhere = {
  status: "PUBLISHED", publishedRevisionId: { not: null },
  publishedAt: { not: null }, slug: { not: null },
  publishedRevision: { is: { status: "APPROVED" } }, author: { isBanned: false },
} satisfies Prisma.ArticleWhereInput;
