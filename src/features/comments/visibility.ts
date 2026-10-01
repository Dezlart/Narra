import type { Prisma } from "@/generated/prisma/client";
export const visibleCommentWhere = { deletedAt: null, hiddenAt: null } satisfies Prisma.CommentWhereInput;
