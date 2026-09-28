import type { Prisma } from "@/generated/prisma/client";
export const visibleCommentWhere = { deletedAt: null, hiddenAt: null, author: { isBanned: false } } satisfies Prisma.CommentWhereInput;
