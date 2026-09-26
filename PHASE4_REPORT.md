# NARRA — PHASE 4: Moderation & Publishing

Дата: 26 сентября 2026. PHASE 4 реализована. PHASE 5 не начата.

Git был инициализирован: ветка `main`, исходный чистый HEAD
`c91bf91 feat: implement article editor and drafts`. Изменения PHASE 4 оставлены
в working tree для review; commit, staging и push не выполнялись.
Зависимости и package-lock.json не изменены. Секреты и `.env` не добавлялись.
Финальный аудит 106 файлов Git не обнаружил значений секретов из окружения
или private keys; staging пуст, `git diff --check` проходит. `.env`, `.next`,
generated Prisma и browser artifacts игнорируются. Временные production server
и QA tunnel остановлены; порты 3000 и 15432 освобождены.

## 1. State machine

ArticleRevision: `DRAFT → PENDING → APPROVED | REJECTED`. Контент отправленной
и рассмотренной версии неизменяем. Исправления создают отдельную DRAFT.
Article сохраняет прежние `DRAFT/PUBLISHED/ARCHIVED`: до первого approval она
DRAFT, после него PUBLISHED даже при новом черновике, pending или rejection.
Статус Article и статус рабочей revision показаны отдельно.

## 2. Submit for moderation

Редактор замораживает ввод, ждёт текущий autosave и сохраняет изменения,
появившиеся во время него. Submit передаёт только articleId/revisionId и
подтверждённую editVersion. Ошибка сохранения или конфликт останавливают отправку.
Сервис под блокировками повторно проверяет owner/ban/status/version и именно
сохранённый snapshot: title 5–180, excerpt 10–500, существующая категория,
body от 40 непробельных символов или inline image, валидные теги и свои изображения.
Обложка и теги необязательны. Проверка документа переиспользует whitelist PHASE 3.
Транзакция ставит PENDING/submittedAt, увеличивает editVersion и очищает review metadata.

## 3. Запрет редактирования PENDING

Редактор показывает состояние и ссылку на историю. Сервер запрещает save/delete,
upload и создание новой DRAFT при PENDING. Проверяются права и состояние в сервисах,
а не только наличие кнопок. Запоздавший autosave не перезаписывает snapshot.

## 4. Moderation queue

`/admin/moderation` читает реальные PENDING неархивированных статей из PostgreSQL,
сортирует по submittedAt/id по возрастанию, показывает по 20 записей с пагинацией.
Есть loading/empty states и данные автора, категории, версии и времени отправки.
Доступ только MODERATOR/ADMIN; USER получает 404, guest переходит к login.
Queries/actions отдельно проверяют права.

## 5. Moderation preview

`/admin/moderation/[revisionId]` показывает неизменяемый snapshot: заголовок,
описание, категорию, теги, тело, обложку, автора и metadata. Используется безопасный
React RichText без HTML injection; email/session/auth data не выдаются.
Рассмотренная версия остаётся доступной в режиме чтения, без формы повторного решения.
Private images читаются через отдельный no-store endpoint только после проверки роли,
принадлежности ArticleImage и ссылки в этом snapshot. Доступ к DRAFT не расширен.

## 6. Approve

MODERATOR/ADMIN подтверждает действие. Сервер повторно проверяет роль, ban,
PENDING и snapshot. Одна транзакция записывает APPROVED, reviewedAt/reviewedById,
очищает rejectionReason и публикует Article с указателем на эту revision.
Первый publishedAt устанавливается один раз. Slug стабилен.

## 7. Reject

MODERATOR/ADMIN вводит обязательную причину и подтверждает действие. Транзакция
ставит REJECTED, reviewedAt/reviewedById/rejectionReason. Статус публикации,
publishedRevisionId и publishedAt не меняются. До первой публикации Article остаётся DRAFT.

## 8. Rejection reason

Причина хранится в ArticleRevision.rejectionReason: trim, от 5 до 2000 символов,
серверная валидация обязательна. Автор видит её в списке/истории и read-only состоянии
редактора; модератор — в рассмотренной версии. При копировании она остаётся только
в истории исходной revision, metadata нового DRAFT пусты.

## 9. Новая revision после rejection

«Исправить статью» копирует последнюю REJECTED revision вместе с контентом,
категорией, тегами и обложкой, в том числе если у Article уже есть публикация.
Новая revision получает новый version и editVersion=0. Исходная REJECTED неизменна.
Существующая DRAFT переиспользуется; PENDING запрещает параллельный черновик.

## 10. Редактирование опубликованной Article

При обычном редактировании источником служит текущая опубликованная APPROVED
revision. Создаётся отдельный DRAFT. При наличии последней REJECTED для исправления
копируется она. Сохранение и отправка DRAFT не меняют текущую публикацию.

## 11. Сохранность старой published revision

Старые APPROVED и REJECTED snapshots и их теги остаются в истории. Pending/rejection
обновления не скрывают публикацию и не заменяют её данные. История автора показывает
текущую опубликованную версию отдельно от последней рабочей, по 20 revisions на страницу.

## 12. Переключение publishedRevisionId

Указатель меняется только в транзакции approval вместе со статусом revision
и Article. publishedAt сохраняет дату первой публикации; updatedAt обновляется.
Существующие composite FK и ограничения связи статьи с опубликованной версией сохранены.
Публичных страниц на PHASE 4 нет: публикация пока означает состояние данных.

## 13. Двойной и concurrent review

Порядок блокировок согласован с авторскими операциями: User FOR SHARE, затем
Article FOR UPDATE. Роль/ban перечитываются под блокировкой; обновление revision
условно по PENDING. Конкурирующие approve/reject дают ровно одного победителя,
второй получает конфликт. Повторное решение также отклоняется. Самопроверка
MODERATOR/ADMIN отдельно не запрещена заданной моделью ролей.

## 14. Prisma schema changes

Новые таблицы, enum и поля не понадобились: review metadata, reviewer relation
и индекс очереди уже существовали. В schema.prisma добавлен комментарий о новом
SQL partial index. Исходные CHECK/FK и DRAFT-only index сохранены.

## 15. Миграции

Создана и применена к существующей development Neon миграция
`20260925230000_moderation`: уникальный partial index по articleId для статусов
DRAFT/PENDING. Он запрещает и два PENDING, и сочетание DRAFT+PENDING одной статьи.
Перед применением конфликтов не было; данные не переписывались. `db push` не использован.
Четыре миграции применены; SHA-256 всех четырёх SQL совпали с `_prisma_migrations`.
Три старые миграции не изменены. Финальная проверка активных конфликтов: 0.

## 16. UI routes и основные файлы

- `/admin/moderation` — очередь.
- `/admin/moderation/[revisionId]` — snapshot и решение.
- `/dashboard/articles/[id]` — собственная история, причины и действия.
- `/api/moderation/revisions/[revisionId]/images/[imageId]` — защищённый image stream.

Добавлен `src/features/moderation` (schemas/services/queries/actions/images/review UI),
общая проверка image references и отображение workflow. Обновлены редактор/autosave,
список статей, guards/returnTo и меню аккаунта. Уточнены PROJECT_SPEC, README,
описание features и текущий разрешённый scope в AGENTS.md.

## 17. Автоматические тесты

- `npm test`: 68 unit tests PASS, включая 15 новых в moderation.test.ts.
- `npm run test:moderation:integration`: 5 PASS на реальной development БД.
- `npm run test:auth:integration`: 2 PASS.
- `npm run test:articles:integration`: 4 PASS.

Новые тесты покрывают сохранённый snapshot, пустой/недопустимый контент,
подделку полей, owner/roles/ban/revoked role, stale editVersion, submit race,
блокировку PENDING, DB unique constraint, первый approve, reject/copy/reapprove,
сохранность snapshots/tags/publishedAt, concurrent review, queue pagination,
безопасные metadata и image authorization. Для image access checks используются
тестовые записи ArticleImage; реальные загрузки или Blob storage не подменяются.

## 18. Реальные browser scenarios

Production build проверен в Chromium с настоящими Better Auth и development БД:

- Реальный вход автора и модератора; создание временных аккаунтов через Better Auth API.
- USER получает 404 на странице модерации; guest перенаправляется на login.
- Submit во время искусственно задержанного autosave сохраняет и последующие правки.
- Вторая вкладка с устаревшим редактором не может сохранить PENDING; редактор read-only.
- Модератор видит именно отправленный snapshot; approve первой версии публикует её.
- Следующее обновление отклоняется с причиной; прежняя публикация сохраняется.
- Автор создаёт исправленный DRAFT из REJECTED, отправляет; approval переключает pointer.
- Старые APPROVED/REJECTED и первая дата публикации после полного цикла сохранены.
- Пустая причина отклонения блокируется; preview проверен при ширине 320/390/1440 px
  без горизонтального переполнения, финальный сценарий без JavaScript page errors.

Скриншоты локально в игнорируемой `.playwright-mcp/`: phase4-preview-{320,390,1440}.png,
phase4-author-history.png. Визуально просмотрены мобильный preview и история автора.
Browser harness и сетевой helper временные, вне Git. Первые попытки прерывались из-за
таймаута idle DB-соединения и слишком ранней проверки навигации в harness. Исправлены
именно QA helper/ожидание; полный повторный сценарий прошёл. Это не заявка на проверку
всех браузеров или реальной Blob-загрузки.

## 19. Typecheck

`npm run typecheck` — PASS, строгий TypeScript сохранён.

## 20. Lint

`npm run lint` — PASS, zero warnings. Правила не отключались, ESLint остался 9.

## 21. Production build

`npm run build` — PASS (Prisma generate + Next.js production build).
Браузерный сценарий выполнен на production server, а не только dev mode.

## 22. Prisma validation/status

`npm run db:validate` — PASS. `npm run db:status` — PASS: четыре миграции,
database schema up to date. Дополнительно сверены применённые SQL checksums.

## 23. Регрессии PHASE 2–3

В выполненных проверках регрессий не обнаружено. Auth integration проверяет
registration/login/logout, cookie/session, profile/ownership, роли и ban. Article
integration проверяет создание, autosave/version conflicts, категории, теги,
копирование revision, ограничения публикации и image authorization. Browser
проверка подтверждает работу редактора, autosave и авторского/moderator workflow.
Все прежние UI-сценарии регистрации/профиля/logout отдельно в браузере заново
не проходились: здесь они покрыты интеграционными тестами, а не заявлены как browser QA.

## 24. Оставшиеся ограничения

Blob credentials отсутствуют: реальная загрузка и выдача изображений из private
Vercel Blob не проверены. Реализованы совместимый preview endpoint и проверки
доступа/ссылок; текстовая модерация проверена полностью. Mock storage не добавлен.
Прямая связь с Neon при включённом VPN нестабильна. Проверки и migration deploy
выполнялись через временный loopback tunnel и существующий локальный proxy к той
же БД, с проверкой удалённого TLS-сертификата. `.env`, VPN и конфигурация приложения
не менялись; это не постоянное исправление сети. Публичная выдача, notifications,
social features, admin user-management и image garbage collection не добавлялись.

Все временные тестовые роли выдавались только созданным тестами аккаунтам.
Реальные пользователи не повышались. Тестовые данные очищены; финальная проверка
оставшихся PHASE 4 QA identities: 0. Секреты не выводились и не сохранялись в Git.

## 25. Ручные действия пользователя

Проверить изменения в working tree и самостоятельно решить вопрос commit.
Для обычного запуска обеспечить устойчивое соединение с development PostgreSQL
при нужных настройках VPN. Для ручной модерации назначить свой существующий аккаунт
ADMIN командой из README: `npm run admin:promote -- --email <ваш-email> --confirm`.
При необходимости настроить private Vercel Blob по README и проверить реальные
обложки/inline images и их preview под модератором. Новая миграция в текущей
development БД уже применена; в другой среде применять штатные Prisma migrations.

## 26. PHASE 5

Только по отдельной команде: public content — homepage feed, страницы статей,
профили, категории, теги и поиск по PROJECT_SPEC. Публичный контент должен читаться
из publishedRevision, без доступа к черновикам и отклонённым обновлениям.
Реализация PHASE 5 не начата.
