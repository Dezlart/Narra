/** Bounded, allowlisted Tiptap JSON. Shared by validation, editor and renderer. */
export type RichMark = { type: string; attrs?: Record<string, string | null> };
export type RichNode = { type: string; attrs?: Record<string, string | number | null>; text?: string; marks?: RichMark[]; content?: RichNode[] };
export const emptyDocument: RichNode = { type: "doc", content: [{ type: "paragraph" }] };
export const imageSourcePattern = /^\/api\/articles\/([a-zA-Z0-9_-]{1,80})\/images\/([a-zA-Z0-9_-]{1,80})$/;
export function safeLink(value: string): boolean {
  if (value.length > 2048 || /[\s\u0000-\u001f\u007f]/u.test(value)) return false;
  try { const url = new URL(value); return ["https:", "http:", "mailto:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function only(value: Record<string, unknown>, keys: string[]) { return Object.keys(value).every((key) => keys.includes(key)); }
const blocks = ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "image", "horizontalRule"];
export function validDocument(value: unknown): value is RichNode {
  let count = 0, textLength = 0;
  function visit(node: unknown, depth: number): boolean {
    if (++count > 10000 || depth > 24 || !record(node) || !only(node, ["type", "attrs", "text", "marks", "content"]) || typeof node.type !== "string") return false;
    const type = node.type;
    if (!["doc", "text", "hardBreak", "listItem", ...blocks].includes(type) || (type === "doc" && depth !== 0)) return false;
    const attrs = node.attrs ?? {};
    if (!record(attrs)) return false;
    if (type === "heading") { if (!only(attrs, ["level"]) || ![1, 2, 3].includes(Number(attrs.level)) || typeof attrs.level !== "number") return false; }
    else if (type === "orderedList") { if (!only(attrs, ["start", "type"]) || (attrs.start !== undefined && (!Number.isSafeInteger(attrs.start) || Number(attrs.start) < 1 || Number(attrs.start) > 10000)) || (attrs.type !== undefined && attrs.type !== null && attrs.type !== "1")) return false; }
    else if (type === "codeBlock") { if (!only(attrs, ["language"]) || (attrs.language !== undefined && attrs.language !== null && (typeof attrs.language !== "string" || !/^[a-z0-9+-]{1,30}$/i.test(attrs.language)))) return false; }
    else if (type === "image") {
      if (!only(attrs, ["src", "alt", "title", "width", "height"]) || typeof attrs.src !== "string" || !imageSourcePattern.test(attrs.src)) return false;
      for (const key of ["alt", "title"]) if (attrs[key] !== undefined && attrs[key] !== null && (typeof attrs[key] !== "string" || (attrs[key] as string).length > 300)) return false;
      for (const key of ["width", "height"]) if (attrs[key] !== undefined && attrs[key] !== null) return false;
    } else if (Object.keys(attrs).length) return false;
    if (type === "text") {
      if (typeof node.text !== "string" || !node.text.length || node.content !== undefined) return false;
      textLength += node.text.length;
      if (textLength > 100000) return false;
    } else if (node.text !== undefined) return false;
    if (node.marks !== undefined) {
      if (type !== "text" || !Array.isArray(node.marks) || node.marks.length > 4) return false;
      const seen = new Set();
      for (const mark of node.marks) {
        if (!record(mark) || !only(mark, ["type", "attrs"]) || !["bold", "italic", "code", "link"].includes(String(mark.type)) || seen.has(mark.type)) return false;
        seen.add(mark.type);
        const a = mark.attrs ?? {};
        if (!record(a)) return false;
        if (mark.type === "link") {
          if (!only(a, ["href", "target", "rel", "class", "title"]) || typeof a.href !== "string" || !safeLink(a.href)) return false;
          if (a.title !== undefined && a.title !== null && (typeof a.title !== "string" || a.title.length > 300)) return false;
          if (a.target !== undefined && a.target !== null && !["_blank", "_self"].includes(String(a.target))) return false;
          if (a.class !== undefined && a.class !== null) return false;
          if (a.rel !== undefined && a.rel !== null && (typeof a.rel !== "string" || a.rel.split(" ").some((v) => !["noopener", "noreferrer", "nofollow"].includes(v)))) return false;
        } else if (Object.keys(a).length) return false;
      }
    }
    if (node.content !== undefined && !Array.isArray(node.content)) return false;
    const children = (node.content ?? []) as unknown[];
    if (["text", "image", "horizontalRule", "hardBreak"].includes(type) && children.length) return false;
    if (["doc", "blockquote", "bulletList", "orderedList", "listItem"].includes(type) && !children.length) return false;
    for (const child of children) {
      if (!record(child)) return false;
      const allowed = ["paragraph", "heading"].includes(type) ? ["text", "hardBreak"] : type === "codeBlock" ? ["text"] : ["bulletList", "orderedList"].includes(type) ? ["listItem"] : blocks;
      if (!allowed.includes(String(child.type)) || !visit(child, depth + 1)) return false;
      if (type === "codeBlock" && child.marks !== undefined && (!Array.isArray(child.marks) || child.marks.length)) return false;
    }
    if (type === "listItem" && (!record(children[0]) || children[0].type !== "paragraph")) return false;
    return true;
  }
  try { return record(value) && value.type === "doc" && visit(value, 0) && new TextEncoder().encode(JSON.stringify(value)).length <= 400000; }
  catch { return false; }
}
export function documentImages(node: RichNode): string[] {
  return [...(node.type === "image" ? [String(node.attrs?.src)] : []), ...(node.content ?? []).flatMap(documentImages)];
}
