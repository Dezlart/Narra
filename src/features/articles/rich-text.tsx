import { createElement, Fragment, type ReactNode } from "react";
import { ContentImage } from "./content-image";
import { validDocument, type RichNode } from "./content";
function headingLevels(document: RichNode) {
  const headings = (node: RichNode): RichNode[] => [
    ...(node.type === "heading" ? [node] : []), ...(node.content?.flatMap(headings) ?? []),
  ];
  const levels = new Map<RichNode, number>();
  let previous = 1;
  for (const node of headings(document)) {
    previous = Math.min(Number(node.attrs?.level) + 1, previous + 1);
    levels.set(node, previous);
  }
  return levels;
}
/** Shared author/moderator/public renderer; never interprets HTML strings. */
export function RichText({ content, imageUrl = (source) => source }: { content: unknown; imageUrl?: (source: string) => string }) {
  if (!validDocument(content)) return <p>Не удалось отобразить содержимое.</p>;
  const levels = headingLevels(content);
  function render(node: RichNode, index: number): ReactNode {
    const children = node.content?.map(render);
    if (node.type === "text") {
      let text: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === "link") text = <a href={mark.attrs?.href ?? ""} rel="noopener noreferrer nofollow" target="_blank">{text}</a>;
        else text = createElement(({ bold: "strong", italic: "em", code: "code" })[mark.type] ?? "span", null, text);
      }
      return <Fragment key={index}>{text}</Fragment>;
    }
    if (node.type === "image") return <ContentImage key={index} src={imageUrl(String(node.attrs?.src))} alt={String(node.attrs?.alt ?? "")} width={1200} height={800} className="h-auto max-w-full" />;
    if (node.type === "hardBreak") return <br key={index} />;
    if (node.type === "horizontalRule") return <hr key={index} />;
    if (node.type === "doc") return <Fragment key={index}>{children}</Fragment>;
    if (node.type === "codeBlock") return <pre key={index} tabIndex={0} role="region" aria-label="Блок кода с горизонтальной прокруткой"><code>{children}</code></pre>;
    if (node.type === "orderedList") return <ol key={index} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
    if (node.type === "heading") {
      // The page owns H1. Preserve visual levels without skipped outline levels.
      return createElement(`h${levels.get(node)}`, { key: index, "data-heading-level": node.attrs?.level }, children);
    }
    const tag = ({ paragraph: "p", blockquote: "blockquote", bulletList: "ul", listItem: "li" })[node.type] ?? "div";
    return createElement(tag, { key: index }, children);
  }
  return <div className="article-prose">{render(content, 0)}</div>;
}
