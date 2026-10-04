import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichText } from "@/features/articles/rich-text";
import { FormField } from "@/components/ui/form-field";
import { formatDateTime } from "@/lib/dates";
import { publicPage } from "@/features/public-content/params";

describe("accessible reader and form recovery", () => {
  it("reserves H1 for the page and prevents skipped public heading levels without changing source", () => {
    const content = { type: "doc", content: [3, 1, 3, 2].map(level => ({ type: "heading", attrs: { level }, content: [{ type: "text", text: "Название" }] })) };
    const original = JSON.stringify(content);
    const html = renderToStaticMarkup(createElement(RichText, { content }));
    expect([...html.matchAll(/<h(\d)/g)].map(match => match[1])).toEqual(["2", "2", "3", "3"]);
    expect(html).toContain('data-heading-level="3"');
    expect(JSON.stringify(content)).toBe(original);
  });
  it("makes overflowing code keyboard reachable without interpreting markup", () => {
    const html = renderToStaticMarkup(createElement(RichText, { content: { type: "doc", content: [{ type: "codeBlock", content: [{ type: "text", text: "<script>alert(1)</script>" }] }] } }));
    expect(html).toContain('tabindex="0"'); expect(html).toContain('role="region"');
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
  });
  it("associates error and hint with the field while preserving additional descriptions", () => {
    const html = renderToStaticMarkup(createElement(FormField, { name: "username", label: "Username", hint: "Правила", error: "Ошибка", "aria-describedby": "context" }));
    expect(html).toContain('aria-invalid="true"'); expect(html).toContain('aria-describedby="username-hint username-error context"');
    expect(html).toContain('id="username-error"');
  });
  it("formats timestamps independently of host timezone and normalizes invalid pages", () => {
    expect(formatDateTime("2026-10-01T23:30:00Z")).toContain("23:30 UTC"); expect(formatDateTime(null)).toBe("—");
    for (const page of [0,-1,"abc",999999,Infinity,NaN]) expect(publicPage(page)).toBe(1);
    expect(publicPage(9999)).toBe(1000);
  });
});
