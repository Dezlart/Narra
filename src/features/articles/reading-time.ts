import { validDocument, type RichNode } from "./content";

/** Approximation: 200 words/minute. Only called with the approved snapshot. */
export function readingMinutes(content: unknown): number {
  if (!validDocument(content)) return 1;
  function words(node: RichNode): number {
    return (node.text?.trim().split(/\s+/u).filter(Boolean).length ?? 0)
      + (node.content ?? []).reduce((total, child) => total + words(child), 0);
  }
  return Math.max(1, Math.ceil(words(content) / 200));
}
