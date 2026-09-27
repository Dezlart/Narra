export const PAGE_SIZE = 12;
export const MAX_PAGE = 1000;
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export function publicPage(value: unknown): number {
  if (typeof value !== "string" && typeof value !== "number") return 1;
  if (!/^[1-9]\d{0,3}$/.test(String(value))) return 1;
  return Math.min(Number(value), MAX_PAGE);
}
export function searchInput(value: unknown) {
  const query = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
  return { query, error: query.length > 120 ? "Введите не больше 120 символов." : null };
}
/** Prisma contains uses LIKE: treat %, _ and backslash as literal search text. */
export function literalContains(value: string) { return value.replace(/[\\%_]/g, "\\$&"); }
