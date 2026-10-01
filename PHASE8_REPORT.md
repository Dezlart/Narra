# PHASE 8 — Administration, Reports & Analytics

2 октября 2026. Исходное состояние: чистая main, HEAD `51c6d78 phase 7 ready`.
PHASE 1–7 были зафиксированы. Реализована только PHASE 8. Изменения оставлены
в working tree для review, без staging/commit/push. Новых зависимостей нет.

## 1. Реализовано

Единое управление платформой, users/roles/ban, archive/restore публикаций,
category management, reports, privacy-friendly views, author/platform analytics.
PostgreSQL — источник данных; fake API/analytics/demo backend не добавлены.

## 2. Admin shell

`src/app/admin/layout.tsx` объединяет прежние `/admin/moderation` и `/admin/comments`
с новыми dashboard/users/articles/categories/reports. Responsive navigation,
прежние Golos Text/Lora/светлая тема/терракота. Без второй админки и redesign.
Layout и каждая страница/сервис имеют собственные проверки прав, noindex,
private-page lifecycle; layout сам по себе не считается границей безопасности.

## 3. MODERATOR

Moderation queue/preview/approve/reject, comments hide/restore, reports review.
Нет доступа к platform overview/users/roles/ban/categories/admin articles/archive.
Прямые URL ADMIN-only дают USER/MODERATOR 404; guest получает login.

## 4. ADMIN

Все moderator возможности плюс platform metrics, управление users/roles/ban,
всеми статьями/archive/restore и категориями. Права читаются из User, повторно
проверяются в write transaction. Клиент не назначает себе actor/permissions.

## 5. Platform dashboard

`/admin`, только ADMIN, реальные COUNT и параметризованные SQL aggregates.
Private request-time queries без общего response/data cache. Данные обновляются
при следующем запросе; live dashboard/polling не добавлены.

## 6. Platform metrics

Всего users; текущие public articles; PENDING неархивированных articles;
видимые comments public articles; все historical ArticleView; OPEN reports.
Бан не удаляет users/контент. Архивные views остаются в platform total.

## 7. Динамика

14 календарных дней UTC, включая текущий. Registrations, первые publications,
views. PostgreSQL date grouping/generate_series, явный TrendRow, без загрузки
исходных коллекций в JS. Публикации отражают первую дату, включая поздний архив.
CSS bars, подписи и раскрываемая доступная таблица. Chart dependency не добавлена.

## 8. Users

`/admin/users`: name/username/email/role/isBanned/createdAt. Поиск до 120 символов
по name/username/email с literal LIKE escaping, filters role/state, 20+1 строк,
createdAt DESC/id DESC, максимум 1000 страниц. Password/Account/Session не выбираются.

## 9. Ban / Unban

Self-ban запрещён. Другого ADMIN можно заблокировать лишь сохранив активного ADMIN.
Confirmation UI через native browser confirm. Ban меняет только доступ аккаунта:
с PHASE 8 опубликованные articles/comments/profile остаются доступны согласно
своему moderation status. Это намеренно заменяет прежнюю PHASE 5–7 семантику.
Archive Article и hide Comment — отдельные действия. Unban требует нового входа.
Likes/follow counters сохраняют прежний фильтр active участников; связи не удаляются.

## 10. Sessions

User.isBanned и deleteMany Session выполняются в одной transaction. Session trigger
перед INSERT берёт User FOR SHARE и проверяет активность, закрывая login-vs-ban
race. Заблокированный пользователь не создаёт позднюю сессию; после unban старые
не восстанавливаются. Прежний Better Auth adapter и guards сохранены.

## 11. Roles

Строгий discriminated Zod payload, enum USER/MODERATOR/ADMIN, actor только session.
Role change применяется сразу через свежие guards, без cookie-cached privileges.
Выбор роли и отдельное подтверждение, предупреждение о полном доступе ADMIN.

## 12. Последний ADMIN

Нельзя понизить последнего активного ADMIN или заблокировать себя. Проверка count
находится внутри сериализованной transaction; не обычный count-then-update вне БД.
Самопонижение возможно, если остаётся другой active ADMIN.

## 13. Конкурентные изменения

Transaction advisory lock `(78421,8)` перед User locks, ordered User row locks,
повторная actor authorization и READ COMMITTED count после ожидания. Mutual demotion
оставляет одного ADMIN; проигравший запрос уже не имеет права завершить изменение.
Проверка использует отдельную случайную schema и настоящие PostgreSQL/Better Auth,
не понижает роли реальных пользователей. Схема удаляется после теста.

## 14. Admin articles

`/admin/articles`: все articles, автор, public/unpublished/status, последняя revision,
publishedAt/updatedAt. Поиск title/username, точный author filter, status, pagination.
`/admin/articles/[id]`: текущая publishedRevision, история по 20, ссылки на public
article и существующий moderation snapshot. Чужие DRAFT не редактируются.

## 15. Archive / Restore

ADMIN-only transaction под Article FOR UPDATE. Archive сохраняет pointer,
approved revisions, первую дату и все social records. Restore требует валидную
APPROVED publishedRevision, slug/publishedAt и исходный PUBLISHED/ARCHIVED status.
Нельзя превратить неопубликованный draft в public через restore. Notification
повторной публикации не создаётся. Рабочие draft/pending сохраняются, при archive
редактор и review недоступны до восстановления.

## 16. Public visibility

Общий publicArticleWhere исключает архив на homepage/article/search/category/tag/
profile/following/bookmarks/sitemap/images. URL архивной статьи даёт 404.
RevalidatePath('/', 'layout') обновляет инициатора; другие вкладки — navigation/refresh.
Бан автора больше не скрывает его публикации; эта политика документирована.

## 17. Categories

`/admin/categories`: create/name/description/archive/restore, search/state filters,
20+1 server pagination. Slug валидируется при создании, UNIQUE защищает совпадения,
редактирование name/description не принимает slug. Физического delete нет.

## 18. Category archive

Архивная категория исключена из выбора новых revisions, навигации и sitemap,
но её public URL и исторические published references сохранены. Новая revision
не наследует архивный categoryId. Старый draft может autosave текст с прежней
категорией, submit требует выбрать active. Уже PENDING review использует сохранённый
snapshot. Category FOR SHARE при выборе/submit согласует операции с archive.

## 19. Report model

reporter, targetType, ровно один articleId/commentId, reason/description, status,
createdAt, resolvedAt/resolvedById/resolutionNote, nullable activeKey. FK Restrict
сохраняет историю/контекст при попытке физического удаления; текущий soft delete
Comment оставляет Report, но стирает текст. Удаление аккаунтов/истории требует
отдельно спроектированной процедуры, она не добавлена в PHASE 8.

## 20. Report enums

Targets ARTICLE/COMMENT; status OPEN/RESOLVED/DISMISSED. Reasons SPAM/HARASSMENT/
HATE_OR_ABUSE/ILLEGAL_OR_DANGEROUS/PRIVACY/MISLEADING/OTHER. Description <=2000,
OTHER требует >=5 символов после trim. Resolution note <=2000.

## 21. Создание Report

«Пожаловаться» на article/visible comment, reason/description и success feedback.
Guest login link. Active session actor, public target, self-report запрещён.
Private/missing targets дают одинаковую ошибку. До 10 новых жалоб в час под User
row lock; никакие reporterId/status/review metadata от клиента не принимаются.

## 22. Duplicate OPEN

UNIQUE(activeKey), CHECK связывает OPEN key с reporter:type:target. Неверный key
не обходит ограничение. Retry OPEN возвращает безопасный success без второй записи.
Resolution ставит activeKey=null, поэтому после закрытия допустима новая жалоба.
Concurrent creation проверяется реальной БД.

## 23. Reports queue

`/admin/reports`: MODERATOR/ADMIN, OPEN по умолчанию, status/type filters,
createdAt ASC/id ASC, 20+1. Detail показывает reporter, reason/description,
текущее состояние, контекст и links; статья после archive доступна через сохранённый
moderation snapshot. Deleted/hidden comments обрабатываются явно, без UI crash.

## 24. Resolve / Dismiss

Report FOR UPDATE, актуальный OPEN status. Закрытие сохраняет reviewer/time/note;
повторное решение отклоняется. Dismiss не допускает moderation mutation.
Вся review metadata остаётся приватной, reporter получает только feedback отправки.

## 25. Moderation integration

Hide-comment + resolve используют тот же PHASE 6 transaction helper, без второго
механизма скрытия. ADMIN archive + resolve использует общий article helper.
Обе операции в одной transaction; failure оставляет Report OPEN. MODERATOR,
которому нужно архивировать Article, оставляет её report открытым для ADMIN.
Нет новых Notification types, писем или spam notifications администраторам.

## 26. ArticleView

articleId, visitorHash, viewBucket DATE, createdAt; FK Cascade к Article.
Source of truth — COUNT ArticleView, без mutable viewsCount. Public-only registration
под Article FOR SHARE; draft/pending-first/archived/missing не считаются.
Pending update опубликованной статьи сохраняет Article identity.

## 27. Visitor deduplication

Одинаковая стратегия для guest/member: first-party случайный signed token в cookie.
HttpOnly, SameSite=Lax, Secure production, maxAge 86400; сервер также проверяет возраст
и подпись. Сначала отдельная POST action устанавливает cookie, следующая считает view.
Cookie-less request не создаёт запись. Client запускается после mount видимой статьи,
не из SSR/GET/metadata/prefetch и не при каждом rerender.

## 28. Privacy

В ArticleView только HMAC-SHA256 с отдельным ANALYTICS_HASH_SECRET от token/article/day.
Нет raw token/IP/userId/session secret/browser fingerprint. Hash различается между
статьями и UTC днями; не является постоянным общим tracking ID. Прежние Better Auth
Session IP/userAgent не используются аналитикой. Автоматический retention hashes
пока не реализован. Секрет локально сгенерирован в .env без вывода значения.

## 29. Окно

Один visitor+Article+UTC day = один view. UNIQUE обеспечивает concurrency/retry.
Cookie живёт 24 часа без продления при refresh. Новый день допускает новый view.
Удаление cookie/новый контекст/параллельная первая выдача cookie в разных вкладках
могут дать дополнительные views: защита от простого refresh, не anti-fraud.
Нет secret или БД — чтение статьи продолжается, view не засчитывается.

## 30. Author analytics

`/dashboard/analytics`, только current active session user. Нет input authorId,
ID через query params не меняет владельца. Noindex, request-time queries,
собственные totals, график 14 дней и таблица публикаций с pagination.

## 31. Author metrics

Views и visible comments текущих public статей; likes всех own статей (включая архив)
от active users; active followers. Archive исключает views из author totals/table,
но не удаляет историю — restore возвращает её. Platform views включают также архив.

## 32. Article statistics

Published-only таблица: title/date/views/likes/comments, publishedAt DESC/id DESC,
20+1 rows, до 1000 страниц. Filtered Prisma relation counts без N+1. Hidden/deleted
comments исключены, комментарии banned авторов остаются видимыми до отдельного hide.

## 33. Prisma changes

Report и три enums; ArticleView; Category.archivedAt; обратные relations User/Article/
Comment. User(role,isBanned) index. Article/revision constraints и старые SQL сохранены.

## 34. Migration

`20260928200000_administration`: сначала SQL dry-run в transaction с rollback,
затем db:deploy к прежней development Neon через разрешённый verified TLS tunnel.
Применены все восемь миграций. Отдельный integration replay воспроизводит все SQL
в чистой временной schema, проверяя совместимость migration chain. Production DB,
reset/db push и изменение старых migrations не использовались.

## 35. Indexes / constraints

Report UNIQUE(activeKey), status/createdAt/id, reporter/createdAt и FK indexes;
CHECK target XOR/lifecycle/text. ArticleView UNIQUE(articleId,visitorHash,viewBucket),
article/createdAt, createdAt, CHECK hex hash. User(role,isBanned). Session active-user
trigger закрывает гонку нового login против ban; существующие строки не переписываются.

## 36. Unit tests

9 новых cases в administration.test.ts: strict role/ban/category/report payloads,
immutable slug, OTHER, dismiss без mutation, safe returns, signed token expiry/tamper,
article/day hash isolation, отсутствие analytics secret. Прежние ожидания ban и
whitelist обновлены под явные правила PHASE 8, защитные проверки не отключались.
`npm test`: 114 PASS.

## 37. Integration

administration.integration.test.ts: 8 DB scenarios плюс browser scenario.
admin-protection.integration.test.ts: реальный isolated schema replay и concurrent
ADMIN demotion/mutual ban/last ADMIN guard. Проверены реальные signup/login/roles/ban/session
revocation/unban, privacy, search, archive/restore и сохранность, category slug/archive,
reports/dedup/resolution/atomicity, view concurrency/window/privacy, own aggregates.
Первый полный PHASE 8 run с browser: 10 PASS. Финальный расширенный повтор: 10 PASS, 243,32 секунды. Добавлены mutual ban, историческая категория в autosave/submit, failure при hide удалённого comment и реальная пагинация 21 публикации автора.

## 38. Browser

Production Next server + Chromium/Playwright, реальные Better Auth/Neon. Проверены
ADMIN nav/metrics/chart table, USER/MODERATOR direct URL denial, users search/filters,
role changes с немедленной сменой доступа, cancel/confirm ban, revoked session и новый
login, create/archive/restore category, article/comment reports, moderator dismiss/hide,
public privacy, archive 404/restore, anonymous view/reloads/second context, own analytics.
Шесть страниц × 1440/768/390/320 = 24 responsive views без page overflow; keyboard
skip-link, native confirmations, zero JavaScript page errors. Desktop overview,
mobile users и author analytics screenshots просмотрены визуально. Мобильные tables
прокручиваются внутри focusable region; подсказка вынесена за пределы прокрутки.

## 39. Typecheck

npm run typecheck — PASS, strict сохранён. Нет any/ts-ignore/типовых подавлений.

## 40. Lint

npm run lint — PASS, zero warnings; ESLint 9 сохранён. Rules не отключались.

## 41. Build

npm run build — PASS. Финальная сборка повторена после уточнения category locks,
report context и мобильной подсказки таблиц. Production server использует её.

## 42. Prisma validation / status

npm run db:validate — PASS. Deployment восьмой migration успешен.
npm run db:status — PASS: 8 migrations, Database schema is up to date. Checksum audit ниже.

## 43. Regression

Auth integration 2 PASS, articles 4 PASS, moderation 5 PASS, public-content 4 PASS.
Проверены registration/login/logout/profiles, drafts/autosave conflict, moderation,
publication, public reading/search/taxonomy/SEO. Финальный social/notifications repeat
2 октября на той же production сборке: 16 PASS, 2 файла, 373,97 секунды, включая
оба реальных browser scenarios. Social: persist likes/bookmarks/follows, guest return,
comments/replies/delete/hide/restore/privacy, keyboard и 16 responsive views.
Notifications: login/logout, following/empty/pagination, read state после relogin,
bell/Escape/preview/open/mark-all, recipient isolation, точная rejected revision,
guest denial и 12 responsive views. JavaScript page errors отсутствуют.
Всего по выполненным integration suites: 41 PASS, включая три browser cases;
вместе с PHASE 8 проверены 52 responsive views. 114 unit tests — PASS.

## 44. Ограничения и промежуточные ошибки

- Первый view-test выбрал произвольную строку findFirst без фильтра visitorHash:
  исправлен тестовый lookup, dedup logic не ослаблялась.
- Старые тесты ban предполагали скрытие профиля/article/comment. Их ожидания явно
  обновлены согласно новому заданию; промежуточные failing runs не выдаются за PASS.
- Blob credentials не настроены, cloud upload/read E2E не заявляется. SITE_URL не
  придуман; production indexing/deployment/HTTPS hosting не тестировались.
- VPN остаётся включённым. QA через прежний loopback tunnel к той же Neon, внешний
  TLS-сертификат проверяется. .env DATABASE_URL и security/firewall не изменялись.
  Это не постоянное исправление сетевого маршрута. Финальная регрессия 2 октября
  запущена напрямую к той же Neon: соединение восстановилось без отключения VPN.
- Нет CAPTCHA/full anti-fraud, raw IP analytics, automatic retention/report cleanup,
  enterprise audit log, realtime/email/queues. Offset pagination ограничена 1000.
- Chromium desktop/mobile viewports, без физических устройств и иных browser engines.
  Старые полные PHASE 3–5 UI harness не выдаются за повторно выполненные проверки.
  Реальные Blob uploads и production deployment не входят в проверенный результат.
- В журнале финального QA server зафиксированы четыре `The destination stream closed
  early`; причина отдельно не локализована. Browser assertions и проверки отсутствия
  JavaScript page errors прошли. Полное отсутствие server-log ошибок не заявляется.

## 45. Ручные действия

Просмотреть diff/результат, самостоятельно решить commit. В текущей development БД
миграция применена и ANALYTICS_HASH_SECRET настроен локально. В другой development
среде указать собственные secrets, npm ci/db:deploy/db:generate. Для обычной работы
обеспечить устойчивое соединение с Neon при нужном VPN. Если собственный ADMIN ещё
не назначен, использовать прежнюю явную admin:promote команду README. При подготовке
production отдельно настроить private Blob, реальные SITE_URL/BETTER_AUTH_URL и
server-only ANALYTICS_HASH_SECRET. Фактические secret values нигде не публикуются.

## 46. PHASE 9

Только после отдельного задания: quality/polish, доступность, responsive refinement,
расширение тестов/ошибок/loading/empty states. PHASE 9/10, deployment и CI/CD не начаты.

## Финальная проверка

PHASE 8 завершена. Typecheck, lint, production build, Prisma validation/status — PASS.
Последний повтор social/notifications завершён; предыдущий прерванный сеанс не
использован как доказательство успешного результата.

Финальный аудит: 216 Git-visible файлов проверены на фактические локальные secrets
и private-key markers, совпадений нет; staging пуст. `.env`, generated Prisma,
`.next` и screenshots игнорируются. HEAD по-прежнему `51c6d78 phase 7 ready`.
Старые миграции не изменены; контрольные суммы всех 8 SQL совпадают с записью
в development БД, finished/rollback status корректен. Остаточных QA users и
временных PHASE 8 schemas нет, конфликтов активных DRAFT/PENDING revisions нет.
`git diff --check` — PASS. Локальный QA server остановлен после проверок.
Commit, staging и push не выполнялись; все изменения оставлены для review.
PHASE 9 и дальнейшие этапы не начаты.
