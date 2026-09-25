"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Download, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form-field";
import { PrivatePageLifecycle } from "@/features/auth/private-page-lifecycle";
import { TiptapEditor } from "./tiptap-editor";
import { ImageUpload } from "./image-upload";
import { useAutosave, useUnsavedChanges } from "./use-autosave";
import { tagNameSchema, type DraftView } from "./schemas";
import type { RichNode } from "./content";

export function ArticleEditor({ initial, categories, uploadEnabled }: { initial: DraftView; categories: { id: string; name: string }[]; uploadEnabled: boolean }) {
  const { fields, change, save, dirty, status, message } = useAutosave(initial);
  const [tag, setTag] = useState(""), [tagError, setTagError] = useState(""), [uploading, setUploading] = useState(false);
  useUnsavedChanges(dirty || uploading || !!tag);
  const changeContent = useCallback((content: RichNode) => change("content", content), [change]);
  function addTag() {
    const result = tagNameSchema.safeParse(tag);
    if (!result.success) { setTagError("Введите тег: до 32 символов, буквы и цифры."); return; }
    if (fields.tags.length >= 8 && !fields.tags.includes(result.data)) { setTagError("Не более 8 тегов."); return; }
    change("tags", [...new Set([...fields.tags, result.data])]); setTag(""); setTagError("");
  }
  const statusText = status === "saving" ? "Сохраняем…" : status === "conflict" ? "Конфликт сохранения" : status === "error" ? "Ошибка сохранения" : dirty ? "Есть изменения…" : "Сохранено";
  return <main id="main-content" tabIndex={-1} className="page-container pb-20">
    <PrivatePageLifecycle />
    <div className="sticky top-0 z-10 -mx-1 mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-1 py-4 backdrop-blur-sm">
      <a href="/dashboard/articles" className="inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Мои статьи</a>
      <div className="flex flex-wrap items-center gap-3"><span role="status" aria-live="polite" className={`text-xs ${status === "error" || status === "conflict" ? "text-destructive" : "text-muted-foreground"}`}>{statusText}</span>
        <Button size="sm" onClick={() => void save()} disabled={!dirty || status === "saving" || status === "conflict"}><Save /> Сохранить</Button></div>
    </div>
    <div className="mx-auto max-w-[52rem]">
      <div className="mb-8 flex flex-wrap items-center gap-3"><span className="eyebrow rounded-sm bg-accent px-3 py-2">Черновик · версия {initial.version}</span><p className="text-xs text-muted-foreground">Виден только вам</p></div>
      {initial.published && <p className="mb-6 rounded-md border border-border bg-muted p-4 text-sm">Вы редактируете новую версию. Опубликованный материал остаётся неизменным.</p>}
      {message && <div role="alert" className="mb-6 space-y-3 rounded-md border border-destructive/40 p-4 text-sm text-destructive"><p>{message}</p>
        <Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(fields, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "narra-draft-backup.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}><Download /> Скачать копию текста</Button>
        {status === "conflict" && <Button variant="outline" className="ml-2" onClick={() => { if (window.confirm("Загрузить версию с сервера? Несохранённые изменения будут потеряны. Сначала скачайте копию.")) window.location.reload(); }}>Загрузить версию с сервера</Button>}
      </div>}
      <div className="mb-6 space-y-2"><label htmlFor="article-title" className="eyebrow text-muted-foreground">Заголовок</label>
        <textarea id="article-title" rows={2} maxLength={180} placeholder="Начните с хорошего заголовка" value={fields.title} onChange={(e) => change("title", e.target.value)} className="w-full resize-y border-0 bg-transparent font-editorial text-3xl leading-tight tracking-tight placeholder:text-muted-foreground/55 sm:text-5xl" /></div>
      <div className="mb-8 space-y-2"><label htmlFor="article-excerpt" className="eyebrow text-muted-foreground">Краткое описание</label><textarea id="article-excerpt" rows={3} maxLength={500} placeholder="О чём эта история и почему её стоит прочитать?" value={fields.excerpt} onChange={(e) => change("excerpt", e.target.value)} className={`${inputClass} resize-y bg-transparent leading-relaxed`} /></div>
      <section aria-label="Обложка и тема" className="mb-10 space-y-6 rounded-md border border-border p-4 sm:p-6">
        {fields.coverImage && <div><Image src={fields.coverImage} alt="Обложка статьи" width={1200} height={675} unoptimized className="mb-3 aspect-video h-auto w-full rounded-md object-cover" /><Button variant="outline" size="sm" onClick={() => change("coverImage", null)}>Убрать обложку</Button></div>}
        <ImageUpload articleId={initial.articleId} label="Обложка статьи" disabled={!uploadEnabled || uploading} onBusy={setUploading} onUpload={(src) => change("coverImage", src)} />
        <p className="text-xs leading-relaxed text-muted-foreground">{uploadEnabled ? "JPEG, PNG или WebP до 3 МБ, максимум 20 мегапикселей. Изображения доступны только вам." : "Загрузка изображений пока недоступна: требуется настройка Vercel Blob владельцем сайта. Текст можно сохранять."}</p>
        <div className="grid gap-6 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="article-category" className="block text-sm font-medium">Категория</label><select id="article-category" value={fields.categoryId ?? ""} onChange={(e) => change("categoryId", e.target.value || null)} className={inputClass}><option value="">Пока без категории</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{!categories.length && <p className="text-xs text-muted-foreground">Категории ещё не добавлены.</p>}</div>
          <div className="space-y-2"><label htmlFor="article-tags" className="block text-sm font-medium">Теги <span className="text-muted-foreground">· до 8</span></label><div className="flex gap-2"><input id="article-tags" maxLength={32} value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="Например, дизайн" className={`${inputClass} min-w-0`} /><Button variant="outline" aria-label="Добавить тег" onClick={addTag}>+</Button></div>{tagError && <p role="alert" className="text-xs text-destructive">{tagError}</p>}</div></div>
        {!!fields.tags.length && <ul aria-label="Теги статьи" className="flex flex-wrap gap-2">{fields.tags.map((value) => <li key={value}><button type="button" onClick={() => change("tags", fields.tags.filter((v) => v !== value))} className="flex min-h-10 items-center gap-2 rounded-md bg-muted px-3 text-sm" aria-label={`Удалить тег ${value}`}>{value}<X className="size-3" /></button></li>)}</ul>}
      </section>
      <h2 className="eyebrow mb-3 text-muted-foreground">Ваша история</h2>
      <TiptapEditor initialContent={initial.content} onChange={changeContent} articleId={initial.articleId} uploadEnabled={uploadEnabled} uploading={uploading} onBusy={setUploading} />
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Изменения сохраняются автоматически. Черновик можно закрыть после отметки «Сохранено».</p>
    </div>
  </main>;
}
