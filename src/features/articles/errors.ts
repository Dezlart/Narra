export class ArticleError extends Error {
  constructor(public code: "NOT_FOUND" | "LOCKED" | "CONFLICT" | "INVALID_IMAGE" | "STORAGE" | "LIMIT", message: string) { super(message); }
}
