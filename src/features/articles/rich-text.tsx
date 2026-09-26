import { createElement, Fragment, type ReactNode } from "react";
import Image from "next/image";
import { validDocument, type RichNode } from "./content";
/** Safe React renderer prepared for PHASE 5; never interprets HTML strings. */
export function RichText({ content, imageUrl = (source) => source }: { content: unknown; imageUrl?: (source: string) => string }) {
  if (!validDocument(content)) return <p>Не удалось отобразить содержимое.</p>;
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
    if (node.type === "image") return <Image key={index} src={imageUrl(String(node.attrs?.src))} alt={String(node.attrs?.alt ?? "")} width={1200} height={800} unoptimized className="h-auto max-w-full" />;
    if (node.type === "hardBreak") return <br key={index} />;
    if (node.type === "horizontalRule") return <hr key={index} />;
    if (node.type === "doc") return <Fragment key={index}>{children}</Fragment>;
    if (node.type === "codeBlock") return <pre key={index}><code>{children}</code></pre>;
    if (node.type === "orderedList") return <ol key={index} start={Number(node.attrs?.start ?? 1)}>{children}</ol>;
    const tag = node.type === "heading" ? `h${node.attrs?.level}` : ({ paragraph: "p", blockquote: "blockquote", bulletList: "ul", listItem: "li" })[node.type] ?? "div";
    return createElement(tag, { key: index }, children);
  }
  return <div className="article-prose">{render(content, 0)}</div>;
}
