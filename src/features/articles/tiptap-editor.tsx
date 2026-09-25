"use client";
import { useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote, Code, Undo2, Redo2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";
import { ImageUpload } from "./image-upload";
import { imageSourcePattern, safeLink, type RichNode } from "./content";

const SafeImage = TiptapImage.extend({
  parseHTML() { return [{ tag: "img[src]", getAttrs: (element) => imageSourcePattern.test(element.getAttribute("src") ?? "") ? null : false }]; },
});
export function TiptapEditor({ initialContent, onChange, articleId, uploadEnabled, uploading, onBusy }: {
  initialContent: RichNode; onChange: (content: RichNode) => void; articleId: string; uploadEnabled: boolean; uploading: boolean; onBusy: (busy: boolean) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false), [url, setUrl] = useState(""), [linkError, setLinkError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, strike: false,
      link: { openOnClick: false, isAllowedUri: safeLink, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" } } }), SafeImage.configure({ allowBase64: false })],
    content: initialContent,
    editorProps: { attributes: { class: "article-prose min-h-96 p-5 outline-none sm:p-10", role: "textbox", "aria-label": "Текст статьи", "aria-multiline": "true" } },
    // ProseMirror attrs have a null prototype. Normalize to plain JSON before
    // React Server Actions serialization (otherwise Flight sends temporary refs).
    onUpdate: ({ editor }) => onChange(JSON.parse(JSON.stringify(editor.getJSON())) as RichNode),
  });
  const selectedState = useEditorState({ editor, selector: ({ editor }) => editor ? {
    bold: editor.isActive("bold"), italic: editor.isActive("italic"), bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), quote: editor.isActive("blockquote"), code: editor.isActive("codeBlock"), link: editor.isActive("link"),
    heading: [1, 2, 3].find((level) => editor.isActive("heading", { level })) ?? 0,
    undo: editor.can().undo(), redo: editor.can().redo(),
  } : null });
  if (!editor) return <div className="min-h-96 border border-border p-6" role="status">Загружаем редактор…</div>;
  // Mount EditorContent even before the toolbar receives its first transaction.
  const state = selectedState ?? { bold: false, italic: false, bullet: false, ordered: false, quote: false, code: false, link: false, heading: 0, undo: false, redo: false };
  const controls = [
    { label: "Жирный", icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { label: "Курсив", icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Маркированный список", icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Нумерованный список", icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: "Цитата", icon: Quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: "Блок кода", icon: Code, active: state.code, run: () => editor.chain().focus().toggleCodeBlock().run() },
  ];
  return <div className="overflow-clip rounded-md border border-border bg-card">
    <div role="group" aria-label="Форматирование текста" className="flex flex-wrap items-center gap-1 border-b border-border bg-background p-2">
      <select aria-label="Стиль абзаца" value={state.heading} className="h-11 max-w-36 rounded-md border border-border bg-card px-2 text-sm" onChange={(e) => {
        const level = Number(e.target.value);
        if (!level) editor.chain().focus().setParagraph().run();
        else if (level === 1 || level === 2 || level === 3) editor.chain().focus().toggleHeading({ level }).run();
      }}>
        <option value={0}>Обычный текст</option><option value={1}>Заголовок 1</option><option value={2}>Заголовок 2</option><option value={3}>Заголовок 3</option>
      </select>
      {controls.map(({ label, icon: Icon, active, run }) => <Button key={label} type="button" variant={active ? "secondary" : "ghost"} size="icon" aria-label={label} title={label} aria-pressed={active} onClick={run}><Icon /></Button>)}
      <Button type="button" size="icon" variant={state.link ? "secondary" : "ghost"} aria-label="Добавить ссылку" aria-expanded={linkOpen} onClick={() => { setUrl(String(editor.getAttributes("link").href ?? "")); setLinkOpen(!linkOpen); }}><LinkIcon /></Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Убрать ссылку" disabled={!state.link} onClick={() => editor.chain().focus().unsetLink().run()}><Unlink /></Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Отменить" disabled={!state.undo} onClick={() => editor.chain().focus().undo().run()}><Undo2 /></Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Повторить" disabled={!state.redo} onClick={() => editor.chain().focus().redo().run()}><Redo2 /></Button>
    </div>
    {linkOpen && <form className="space-y-2 border-b border-border p-4" onSubmit={(event) => {
      event.preventDefault();
      if (!safeLink(url)) { setLinkError("Введите полную ссылку https://, http:// или mailto:."); return; }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); setLinkOpen(false); setLinkError("");
    }}><label htmlFor="article-link" className="text-sm">Адрес ссылки для выделенного текста</label><div className="flex flex-wrap gap-2"><input id="article-link" value={url} onChange={(e) => setUrl(e.target.value)} className={`${inputClass} min-w-0 flex-1`} placeholder="https://" /><Button type="submit">Применить</Button></div>{linkError && <p role="alert" className="text-sm text-destructive">{linkError}</p>}</form>}
    <EditorContent editor={editor} />
    <div className="border-t border-border p-4 sm:px-10"><ImageUpload articleId={articleId} label="Изображение в текст" disabled={!uploadEnabled || uploading} onBusy={onBusy} onUpload={(src) => editor.chain().focus().setImage({ src, alt: "" }).run()} /></div>
  </div>;
}
