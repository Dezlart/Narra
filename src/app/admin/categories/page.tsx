import { fieldClass } from "@/components/ui/form-field";
import { requirePageAdmin } from "@/lib/auth/guards";
import { listAdminCategories, single, type QueryParams } from "@/features/admin/queries";
import { AdminPage, Pager, Empty } from "@/features/admin/ui";
import { CategoryForm, CategoryStateControl } from "@/features/admin/forms";
import { Button } from "@/components/ui/button";
export default async function Page({ searchParams }: { searchParams: Promise<QueryParams> }) {
  await requirePageAdmin("/admin/categories"); const p = await searchParams, result = await listAdminCategories(p);
  return <AdminPage title="Категории" description="Slug сохраняется при переименовании. Архив убирает категорию из навигации и новых версий; существующие публикации и их адреса работают.">
    <details className="mb-8 max-w-xl rounded-md border border-border p-4"><summary className="cursor-pointer py-2 font-medium">Новая категория</summary><CategoryForm /></details>
    <form className="mb-6 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Название<input name="q" maxLength={120} defaultValue={single(p.q)} className={fieldClass} /></label><label className="text-sm">Статус<select name="state" defaultValue={single(p.state)} className={fieldClass}><option value="">Все</option><option value="active">Активные</option><option value="archived">Архив</option></select></label><Button type="submit">Найти</Button></form>
    <ul className="grid gap-5 md:grid-cols-2">{result.items.map((c) => <li key={`${c.id}-${c.archivedAt}`} className="min-w-0 rounded-md border border-border bg-card p-5"><h2 className="wrap-anywhere font-editorial text-xl">{c.name}</h2><p className="mt-2 text-xs text-primary">{c.archivedAt ? "В архиве" : "Активна"}</p><CategoryForm category={c} /><CategoryStateControl categoryId={c.id} archived={Boolean(c.archivedAt)} /></li>)}</ul><Empty count={result.items.length} /><Pager {...result} params={p} />
  </AdminPage>;
}
