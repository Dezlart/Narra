import { requirePageAdmin } from "@/lib/auth/guards";
import { getPlatformAnalytics } from "@/features/analytics/queries";
import { Metrics, TrendChart } from "@/features/analytics/chart";
import { AdminPage } from "@/features/admin/ui";
export default async function Page() {
  await requirePageAdmin("/admin"); const { metrics: m, daily } = await getPlatformAnalytics();
  return <AdminPage title="Платформа" description="Текущее состояние Narra. Комментарии — видимые у публичных статей; просмотры — все засчитанные, включая архив. Динамика публикаций учитывает первую дату публикации, в том числе у статей, позже отправленных в архив.">
    <Metrics items={[["Всего пользователей", m.users], ["Опубликованных статей", m.articles], ["На модерации", m.pending], ["Видимых комментариев", m.comments], ["Просмотров", m.views], ["Открытых жалоб", m.reports]]} /><TrendChart rows={daily} />
  </AdminPage>;
}
