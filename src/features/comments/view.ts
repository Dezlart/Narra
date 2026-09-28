export type CommentRow = {
  id: string; parentId: string | null; authorId: string; content: string;
  createdAt: Date; updatedAt: Date; deletedAt: Date | null; hiddenAt: Date | null;
  author: { name: string; username: string | null; isBanned: boolean };
  _count: { replies: number };
};
/** Never return the raw row: hidden/deleted text must not enter HTML or Flight. */
export function publicCommentView(row: CommentRow, viewerId: string | null) {
  const status = row.deletedAt ? "deleted" : row.hiddenAt || row.author.isBanned ? "hidden" : "visible";
  return {
    id: row.id, parentId: row.parentId, status, createdAt: row.createdAt.toISOString(),
    version: row.updatedAt.toISOString(), content: status === "visible" ? row.content : null,
    author: status === "visible" ? { name: row.author.name, username: row.author.username } : null,
    canDelete: viewerId === row.authorId && !row.deletedAt, canReply: status === "visible" && row.parentId === null,
    hasReplies: row._count.replies > 0,
  };
}
export type PublicComment = ReturnType<typeof publicCommentView>;
