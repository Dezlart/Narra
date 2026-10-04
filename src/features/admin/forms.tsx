"use client";
import { fieldClass } from "@/components/ui/form-field";
import { useId } from "react";
import { changeUserAction, articleStateAction, categoryStateAction, createCategoryAction, updateCategoryAction } from "./actions";
import { resolveReportAction } from "@/features/reports/actions";
import { MutationForm } from "@/components/ui/mutation-form";
export function UserControls({ userId, name, role, banned, self }: { userId: string; name: string; role: string; banned: boolean; self: boolean }) {
  const id = useId();
  return <div className="min-w-48">
    <MutationForm submit={(data) => changeUserAction({ operation: "role", userId, role: data.get("role") })} label="Изменить роль"
      confirmation={`Изменить роль пользователя «${name}»? Права изменятся сразу. Проверьте выбранную роль; ADMIN получает полный доступ.`}>
      <label htmlFor={id} className="block text-xs">Роль для {name}</label><select id={id} name="role" defaultValue={role} className={fieldClass}>
        <option value="USER">USER</option><option value="MODERATOR">MODERATOR</option><option value="ADMIN">ADMIN</option></select>
    </MutationForm>
    {!self && <MutationForm submit={() => changeUserAction({ operation: "ban", userId, banned: !banned })} label={banned ? "Снять блокировку" : "Заблокировать"}
      confirmation={banned ? `Снять блокировку «${name}»? Пользователю потребуется войти снова.` : `Заблокировать «${name}» и отозвать все сессии? Контент останется опубликованным.`} />}
    {self && <p className="text-xs text-muted-foreground">Блокировка собственного аккаунта запрещена.</p>}
  </div>;
}
export function ArticleStateControl({ articleId, archived }: { articleId: string; archived: boolean }) {
  return <MutationForm submit={() => articleStateAction({ articleId, archived: !archived })} label={archived ? "Восстановить публикацию" : "Архивировать статью"}
    confirmation={archived ? "Вернуть сохранённую одобренную версию в публичный доступ?" : "Снять статью с публичного доступа? Версии и реакции сохранятся."} />;
}
export function CategoryForm({ category }: { category?: { id: string; name: string; slug: string; description: string | null } }) {
  const id = useId();
  return <MutationForm label={category ? "Сохранить категорию" : "Создать категорию"} submit={(data) => {
    const fields = { name: data.get("name"), description: data.get("description") };
    return category ? updateCategoryAction({ ...fields, categoryId: category.id }) : createCategoryAction({ ...fields, slug: data.get("slug") });
  }}><label htmlFor={`${id}-name`} className="block text-sm">Название</label><input id={`${id}-name`} name="name" required minLength={2} maxLength={80} defaultValue={category?.name} className={fieldClass} />
    {!category && <><label htmlFor={`${id}-slug`} className="block text-sm">Slug — латиница, цифры и дефисы</label><input id={`${id}-slug`} name="slug" required minLength={2} maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={fieldClass} /></>}
    {category && <p className="break-all text-xs text-muted-foreground">Адрес: /categories/{category.slug} (не меняется)</p>}
    <label htmlFor={`${id}-description`} className="block text-sm">Описание</label><textarea id={`${id}-description`} name="description" maxLength={500} rows={2} defaultValue={category?.description ?? ""} className={fieldClass} />
  </MutationForm>;
}
export function CategoryStateControl({ categoryId, archived }: { categoryId: string; archived: boolean }) {
  return <MutationForm submit={() => categoryStateAction({ categoryId, archived: !archived })} label={archived ? "Восстановить категорию" : "Архивировать категорию"}
    confirmation={archived ? "Вернуть категорию в выбор автора и навигацию?" : "Убрать категорию из выбора и навигации? Старые публикации останутся доступны."} />;
}
export function ReportReviewForm({ reportId, targetType, admin }: { reportId: string; targetType: string; admin: boolean }) {
  const id = useId();
  return <MutationForm label="Подтвердить решение" confirmation="Закрыть жалобу с выбранным решением? Связанное действие применяется одновременно."
    submit={(data) => { const decision = String(data.get("decision")); return resolveReportAction({ reportId,
      status: decision === "DISMISSED" ? "DISMISSED" : "RESOLVED", action: ["HIDE_COMMENT", "ARCHIVE_ARTICLE"].includes(decision) ? decision : "NONE", note: data.get("note") }); }}>
    <label htmlFor={`${id}-decision`} className="block text-sm">Решение</label><select id={`${id}-decision`} name="decision" className={fieldClass}>
      <option value="DISMISSED">Отклонить жалобу, контент не менять</option><option value="RESOLVED">Решено, без изменения контента</option>
      {targetType === "COMMENT" && <option value="HIDE_COMMENT">Скрыть комментарий и решить</option>}
      {targetType === "ARTICLE" && admin && <option value="ARCHIVE_ARTICLE">Архивировать статью и решить</option>}
    </select><label htmlFor={`${id}-note`} className="block text-sm">Комментарий к решению</label><textarea id={`${id}-note`} name="note" maxLength={2000} rows={3} className={fieldClass} />
    {targetType === "ARTICLE" && !admin && <p className="text-sm text-muted-foreground">Для архивирования статьи оставьте жалобу открытой: это действие ADMIN.</p>}
  </MutationForm>;
}
