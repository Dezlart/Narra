import type { TrendRow } from "./queries";
export function TrendChart({ rows, author = false }: { rows: TrendRow[]; author?: boolean }) {
  const series = author ? ["views"] as const : ["registrations", "publications", "views"] as const;
  const names = { views: "Просмотры", registrations: "Регистрации", publications: "Первые публикации" };
  return <section className="mt-10" aria-label="Динамика за 14 дней"><h2 className="font-editorial text-2xl">Последние 14 дней · UTC</h2>
    <div className="mt-6 grid gap-8 lg:grid-cols-3">{series.map((key) => { const max = Math.max(1, ...rows.map((r) => r[key])); return <div key={key}><h3 className="text-sm font-medium">{names[key]}</h3>
      <div aria-hidden="true" className="mt-4 flex h-28 items-end gap-1 border-b border-border">{rows.map((r) => <div key={r.day} className="min-w-0 flex-1 bg-primary/75" style={{ height: `${r[key] / max * 100}%` }} />)}</div>
      <p className="mt-2 text-xs text-muted-foreground">{rows[0]?.day} — {rows.at(-1)?.day}</p></div>; })}</div>
    <details className="mt-5"><summary className="cursor-pointer py-3 text-sm text-primary">Данные графика в таблице</summary><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Динамика по дням UTC</caption><thead><tr><th scope="col" className="py-2">Дата</th>{series.map((key) => <th scope="col" key={key}>{names[key]}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.day} className="border-t border-border"><th scope="row" className="py-2 font-normal">{r.day}</th>{series.map((key) => <td key={key}>{r[key]}</td>)}</tr>)}</tbody></table></div></details>
  </section>;
}
export function Metrics({ items }: { items: [string, number][] }) {
  return <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">{items.map(([label, count]) => <div key={label} className="border-t-2 border-primary bg-card p-4 sm:p-6"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-3 break-all text-3xl tabular-nums">{count.toLocaleString("ru")}</dd></div>)}</dl>;
}
