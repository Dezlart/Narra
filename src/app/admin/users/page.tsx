import { fieldClass } from "@/components/ui/form-field";
import { requirePageAdmin } from "@/lib/auth/guards";
import { listUsers, single, type QueryParams } from "@/features/admin/queries";
import { AdminPage, Table, Pager, Empty, date } from "@/features/admin/ui";
import { UserControls } from "@/features/admin/forms";
import { Button } from "@/components/ui/button";
export default async function Page({ searchParams }: { searchParams: Promise<QueryParams> }) {
  const actor = await requirePageAdmin("/admin/users"), p = await searchParams;
  const result = await listUsers(p);
  return <AdminPage title="Пользователи" description="Блокировка отзывает сессии и запрещает действия аккаунта. Контент сохраняет статус модерации. Изменения ролей действуют сразу.">
    <form className="mb-6 grid gap-3 sm:grid-cols-4"><label className="text-sm">Имя, username или email<input name="q" maxLength={120} defaultValue={single(p.q)} className={fieldClass} /></label>
    <label className="text-sm">Роль<select name="role" defaultValue={single(p.role)} className={fieldClass}><option value="">Все</option>{["USER", "MODERATOR", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</select></label>
    <label className="text-sm">Состояние<select name="state" defaultValue={single(p.state)} className={fieldClass}><option value="">Все</option><option value="active">Активен</option><option value="banned">Заблокирован</option></select></label><Button type="submit" className="self-end">Найти</Button></form>
    <Table caption="Пользователи" labels={["Пользователь", "Статус", "Создан", "Управление"]}>{result.items.map((u) => <tr key={`${u.id}-${u.role}-${u.isBanned}`}><td><p className="font-medium">{u.name}</p><p>@{u.username ?? "—"}</p><p className="break-all text-muted-foreground">{u.email}</p></td><td>{u.role}<br />{u.isBanned ? "Заблокирован" : "Активен"}</td><td>{date(u.createdAt)}</td><td><UserControls userId={u.id} name={u.name} role={u.role} banned={u.isBanned} self={u.id === actor.id} /></td></tr>)}</Table><Empty count={result.items.length} /><Pager {...result} params={p} />
  </AdminPage>;
}
