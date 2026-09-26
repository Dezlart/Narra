"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "./actions";
import type { DraftFields, DraftView } from "./schemas";
export function changedFields(current: DraftFields, saved: DraftFields): Partial<DraftFields> {
  return Object.fromEntries(Object.entries(current).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key as keyof DraftFields])));
}
export function useAutosave(initial: DraftView) {
  const initialFields: DraftFields = { title: initial.title, excerpt: initial.excerpt, content: initial.content, categoryId: initial.categoryId, tags: initial.tags, coverImage: initial.coverImage };
  const [fields, setFields] = useState(initialFields);
  const current = useRef(initialFields), saved = useRef(initialFields), version = useRef(initial.editVersion);
  const [acknowledged, setAcknowledged] = useState(JSON.stringify(initialFields));
  const [status, setStatus] = useState<"saved" | "saving" | "error" | "conflict">("saved");
  const [message, setMessage] = useState("");
  const inFlight = useRef<Promise<boolean> | null>(null), conflict = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useCallback(function performSave(): Promise<boolean> {
    if (conflict.current) return Promise.resolve(false);
    if (inFlight.current) return inFlight.current;
    const snapshot = current.current;
    const patch = changedFields(snapshot, saved.current);
    if (!Object.keys(patch).length) return Promise.resolve(true);
    setStatus("saving"); setMessage("");
    const work = async () => {
      let succeeded = false;
      try {
        const response = await saveDraftAction({ articleId: initial.articleId, revisionId: initial.revisionId, editVersion: version.current, patch });
        if (!response.ok) {
          conflict.current = response.conflict;
          setStatus(response.conflict ? "conflict" : "error"); setMessage(response.message);
        } else {
          version.current = response.value.editVersion; saved.current = snapshot;
          setAcknowledged(JSON.stringify(snapshot)); setStatus("saved"); succeeded = true;
        }
      } catch { setStatus("error"); setMessage("Нет связи с сервером. Текст остаётся в редакторе. Повторите сохранение или скачайте копию."); }
      finally {
        inFlight.current = null;
        if (succeeded && Object.keys(changedFields(current.current, saved.current)).length) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void performSave(), 1300);
        }
      }
      return succeeded;
    };
    inFlight.current = Promise.resolve().then(work);
    return inFlight.current;
  }, [initial.articleId, initial.revisionId]);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current && !await inFlight.current) return null;
    while (Object.keys(changedFields(current.current, saved.current)).length) {
      if (!await save()) return null;
    }
    if (timer.current) clearTimeout(timer.current);
    return conflict.current ? null : version.current;
  }, [save]);
  const change = useCallback(<K extends keyof DraftFields>(key: K, value: DraftFields[K]) => {
    current.current = { ...current.current, [key]: value };
    setFields(current.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1300);
  }, [save]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const dirty = JSON.stringify(fields) !== acknowledged;
  return { fields, change, save, flush, dirty, status, message };
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.getAttribute("download") !== null || link.getAttribute("target") === "_blank") return;
      if (!window.confirm("Есть несохранённые изменения. Покинуть редактор и потерять их?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    // Navigation API also covers same-document Back/Forward in supported browsers.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      if ((event as Event & { navigationType?: string }).navigationType === "traverse" && event.cancelable && !window.confirm("Есть несохранённые изменения. Покинуть редактор?")) event.preventDefault();
    };
    navigation?.addEventListener("navigate", navigate);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); navigation?.removeEventListener("navigate", navigate); };
  }, [dirty]);
}
