# PHASE 9 — Quality, Accessibility & Polish

Аудит 2–4 октября 2026. Рабочая база: `main`, исходный commit `04d0edc`.
PHASE 1–8 были зафиксированы; исходное рабочее дерево было чистым.
Изменения PHASE 9 оставлены для review. Commit/push/deployment не выполняются.
PHASE 10 не начата. Schema и восемь существующих migrations не изменены.

Полный browser acceptance (route matrix + browsers + journey + failure scenarios)
прошёл 4 октября. Открытые ограничения: Blob credentials, physical-device/accessibility
QA и dev-only braces advisory без опубликованного исправления (пункт 27).

## Область аудита и воспроизведение

Прочитаны PROJECT_SPEC, PHASE7_REPORT, PHASE8_REPORT, README, package/config/schema,
актуальные installed Next.js guides по Server/Client Components, error boundaries,
accessibility и lazy loading. Используются npm, strict TypeScript, Server Components.
VPN оставлен включённым; тесты обращаются к существующей development Neon БД.
Production server — `npm run build`, затем `npm run start` на localhost:3000.

Новый `npm run test:quality:integration` создаёт собственные случайные fixtures,
передаёт временные credentials только через stdin, удаляет свои записи в afterAll.
`NARRA_QUALITY_MODE=journey` сокращает запуск до пользовательского пути;
`audit` собирает диагностическую матрицу; без режима выполняется весь acceptance.
Логи, JSON и screenshots находятся в `.playwright-mcp/` (Git ignored).
Браузеры устанавливаются через `npx playwright install chromium firefox webkit`.
Отдельный fault server использует localhost:3002 и закрытый loopback DB port;
настоящая БД и `.env` при этом не меняются.

## Результаты по 46 пунктам задания

### 1. Страницы UI audit

29 фактических UI routes, каждая на 1440/1024/768/390/320 px (145 views):

| Группа | Маршруты |
| --- | --- |
| Public | `/`, `/articles/[slug]`, `/profile/[username]`, `/categories`, `/categories/[slug]`, `/tags/[slug]`, `/search` |
| Auth | `/login`, `/register` |
| Personal | `/following`, `/dashboard`, `/dashboard/articles`, `/dashboard/articles/[id]`, `/dashboard/bookmarks`, `/dashboard/notifications`, `/dashboard/analytics`, `/dashboard/settings` |
| Editor | `/editor/new`, `/editor/[id]` |
| Admin | `/admin`, `/admin/moderation`, `/admin/moderation/[revisionId]`, `/admin/articles`, `/admin/articles/[id]`, `/admin/users`, `/admin/comments`, `/admin/reports`, `/admin/reports/[id]`, `/admin/categories` |

Дополнительные реальные endpoints: `/api/auth/[...all]`,
`/api/articles/[id]/images`, `/api/articles/[id]/images/[imageId]`,
`/api/moderation/revisions/[revisionId]/images/[imageId]`,
`/api/public/articles/[articleId]/images/[imageId]`, `/robots.txt`, `/sitemap.xml`,
`/icon.svg`, framework not-found. Это не дополнительные UI страницы.

### 2. Responsive issues

В исходной матрице найдено 23 переполнения: длинные title/name/category/comment/
report в карточках, статье, профиле, поиске, moderation и admin history.
`wrap-anywhere` учитывает длинные слова при расчёте минимальной ширины flex/grid;
одного прежнего `break-words` было недостаточно. Ограничены author/category links,
добавлен общий overflow-wrap. Финальная уже выполненная матрица: 0 overflow/145.
Admin tables сохраняют горизонтальную прокрутку внутри подписанного focusable
контейнера. Полное имя доступно в account panel; панель ограничена высотой viewport.
Визуально просмотрены editor/report/article mobile и users desktop screenshots.

### 3. Найденные accessibility issues

Axe выявил heading-order, недоступную клавиатуре прокрутку code block,
admin content вне landmark и ссылку автора, различимую только цветом.
Исправлены соответствующие semantic/focus/link стили. Формам добавлены связи ошибок.

### 4. Keyboard

Account/mobile disclosure закрываются Escape с возвратом focus, blur/outside click
и при переходе по ссылке. Link form Tiptap получает focus при открытии,
Escape/Cancel возвращает его кнопке. Code block доступен Tab и прокрутке.
У editor contenteditable появился явный focus-visible outline.
Существующий notification bell Escape/focus проверяется regression harness.
Native confirm остаётся системным диалогом для опасных действий.

### 5. Semantic HTML

Страница владеет H1; RichText отображает внутренние headings начиная с H2,
не пропуская уровень. Визуальный уровень сохранён data-heading-level; JSON не меняется.
Editor shell получил sr-only H1. Admin navigation включает подпись внутри nav.
Mutation controls остаются buttons, переходы — links, landmarks и labels сохранены.

### 6. Forms

FormField связывает hint/error через aria-describedby и помечает aria-invalid.
Auth form показывает ошибки Zod по полям, фокусирует первое невалидное поле,
имеет aria-busy и pending guard. Autocomplete name/username/email/current-password/
new-password сохранён. Link validation связана с полем. Upload network/JSON failure
теперь показывает понятное сообщение вместо необработанного исключения.

### 7. Loading states

Исправлено лишнее autosave: `setEditable()` Tiptap по умолчанию испускает update
даже при открытии редактора. Теперь переключение editability использует
`setEditable(value, false)`. Оно не меняет editVersion и не создаёт ложный конфликт
между вкладками. Pending/disabled guards существующих social/admin/report/comment
форм сохранены. Состояние «Сохранено» зависит от подтверждения сервера.

### 8. Empty states

Проверены no own articles/bookmarks/notifications/following/public analytics,
пустая категория, пустой поиск и existing comments/admin filter states.
Они уже объясняют ситуацию; механического переписывания не потребовалось.
Draft-only/непубличный tag возвращает 404 согласно privacy policy, а не перечисляет
приватную taxonomy. Пустая notification выборка больше не запускает context queries.
Глобально очищать moderation queue/reports ради пустого экрана не стали:
эти ветки проверены по коду, существующие данные не удалялись.

### 9. Error states

Page error использует Next.js 16.3 `retry()` (refetch+reset); добавлен global-error
для root layout. UI не выводит stack/Prisma codes. Offline autosave сохраняет текст,
conflict предлагает скачать локальную копию. Улучшены ошибки upload/link/auth.
Изолированный отказ БД подтвердил anonymous boundary, ошибку session storage,
отсутствие внутренних деталей в UI и реальный refetch при retry.

### 10. 404

Проверены неизвестные article/profile/category/tag/revision, guest private draft,
archived article. USER→admin и MODERATOR→ADMIN-only проверяются отдельно.
Политика запрета не раскрывает существование чужого ресурса.

### 11. Security regression

Существующие integration suites реально проверили forged role/userId, ownership
профиля/черновика/notification/analytics/report, banned mutations/session revoke,
private article social actions, role guards, last ADMIN races, report lifecycle,
archive/restore и revision constraints. Новое Follow ограничение: 10 transitions/
60 sec под существующим actor lock; ошибка откатывает Follow+Notification.
Unfollow не стирает историю лимита; идемпотентный retry не расходует его.
Auth/comments/reports/uploads используют существующие DB limits; новая инфраструктура
не вводилась. Like/bookmark идемпотентны и не генерируют notification spam.

### 12. XSS / open redirect

Новых уязвимостей в reviewed paths не найдено. React escaping + validDocument,
safeLink и внутренние image paths сохранены. `dangerouslySetInnerHTML` отсутствует.
Unsafe scheme и unsafe returnTo покрыты unit/integration; browser проверяет
javascript link rejection и внешний login returnTo. Better Auth trusted origin
ограничен configured origin; Next Server Actions используют framework origin model.
Upload handler проверяет origin; чувствительных state-changing GET нет.

### 13. Client boundaries

Header/pages/queries остаются server-side. Маленький Disclosure добавляет только
поведение меню. Публичный ReportButton больше не импортирует admin/forms:
общая MutationForm и fieldClass вынесены в components/ui.
Client editor, autosave, interaction forms, notification list/bell, image fallback,
view tracker и private lifecycle нужны для их фактического поведения.

### 14. Large components

Выделена общая MutationForm из admin/forms. Editor и discussion имеют связанное
состояние; дополнительное дробление ради числа строк не выполнялось.
Permission/business logic уже находится в server services/guards.

### 15. Prisma queries

Empty notifications теперь выполняют на три context queries меньше.
Card select не включает rich content, историю revisions, массивы likes/comments.
Owner list/moderation page используют общую нормализацию и cap 1000.
Точная собственная revision из notification по-прежнему доступна через history.

### 16. N+1 и индексы

В reviewed feed/search/article/profile/following/notifications/admin/analytics
не найден per-item await-query N+1. Notifications получают context пакетами,
counts/select bounded, trends агрегируются SQL за 14 дней, take+1 pagination в БД.
Public lists — 12, admin/analytics — 20, notifications — bounded page/preview.
Индексы сопоставлены с status/publication, author, recipient/read, comment parent,
report status и view day queries. Спекулятивных индексов/migrations не добавлено.
EXPLAIN на production-scale данных и нагрузочный benchmark не проводились.

### 17. Bundle issues

Устранена связь public report с admin forms. Удалён неиспользуемый demo UI.
Fresh Chromium pages: home 561325 bytes, article 988460 bytes, editor 1398769 bytes
JavaScript response bodies (uncompressed, включая shared Next chunks и возможный
prefetch; это не gzip transfer size). Непредвиденного Tiptap на public pages нет.
Это лабораторное измерение localhost, не production performance SLO.

### 18. Tiptap bundle

Public renderer независим от Tiptap и остаётся Server Component.
Fresh home/article requests не содержат ProseMirror/Tiptap code; editor содержит.
Проверено по реально загруженным script response bodies production build.

### 19. Images / fonts / performance

Существующие ContentImage имеют alt, размеры/контейнер, lazy loading и fallback.
Private images остаются за авторизованными proxy routes, `unoptimized` не обходит
проверку прав и не создаёт публичный optimizer cache. Upload ошибки обработаны.
Golos Text/Lora — локальные variable fonts, font-display swap, без внешнего CDN.
Финальные measurements: CLS home 0.00057, article 0.01058, editor 0.00143;
font resource requests 6/4/4 соответственно (разные unicode/style файлы).
Дублирующихся font URL requests: 0/0/0. Это single-run lab figures, не field CWV.
Реальный Blob flow без token не выполнялся.

### 20. Caching

Shared per-user cache не найден. React cache используется в пределах запроса,
private routes request-time/noindex, private lifecycle обновляет BFCache state.
Public visibility зависит от approved pointer; revalidation paths сохранены.
Новый cache layer не добавлен. Revision isolation проверяется service и browser.

### 21. Stream warning

Сообщение наблюдалось в production логе, без полезного application stack
(`ignore-listed frames`, digest 3095426621). В установленном React Server DOM
webpack production коде оно связано с `destination.on("close", createCancelHandler(...))`.
Первый контролируемый HTTP эксперимент: 8 полных и 8 прерванных после первого chunk
GET, 0/0 warnings, последующее чтение прошло. Это не доказательство безвредности всех
наблюдений. Второй эксперимент выполнен без параллельной regression нагрузки:
5 обычных article navigations — 0 warnings; 8 закрытий страницы сразу после
начала analytics Server Action — 1 warning; последующее чтение — PASS.
В этом опыте warning связан с отменой browser request/закрытием destination stream.
При повторе в combined acceptance: 5 обычных / 8 cancelled, 0/0 warnings,
recovery PASS. Не воспроизводится на каждом закрытии; все исторические случаи
этим не доказаны.

### 22. Первопричина stream warning

Подавление stdout, monkey patches и искусственная фильтрация не применялись.
Для воспроизведённого случая причина — закрытие клиентского stream во время Server
Action. Исправлять framework cancellation патчем не стали. Потери публикации или
данных этот опыт не выявил. Если сообщение появится при завершённых запросах без
закрытия страницы, потребуется новое расследование с request context.

### 23. Console/server warnings

Остаётся pg-connection-string предупреждение о будущей смене semantics sslmode=require.
Текущая TLS проверка не отключена, DATABASE_URL не изменён. Для следующего major
потребуется явный выбор verify-full. Git предупреждает о LF→CRLF согласно Windows
настройке. Expected offline/403/404 errors отделяются от неожиданных runtime errors.
Финальный browser log: 0 page errors, 3 ожидаемых console errors от намеренного
offline/aborted mutation. Hydration/key/font warnings отсутствуют. Старые
beforeunload warnings на нетронутом editor устранены вместе с лишним mount save.

### 24. Dead code

Удалены шесть неиспользуемых `components/home` файлов: demo-content,
editorial-art, featured-story, spotlight, story-card, story-preview.
Imports предварительно проверены. Demo не переносилось в backend.
README/features README очищены от устаревших phase scaffolding указаний.

### 25. TODO / TypeScript

В authored src/tests/scripts нет TODO/FIXME/HACK/XXX и @ts-ignore.
Оставлен обоснованный `globalThis as unknown as` для process-wide Prisma singleton.
Strict TypeScript сохранён; generated code не редактировался.

### 26. Dependencies

Добавлены только dev Playwright 1.63.0 и @axe-core/playwright 4.13.0.
`npm outdated` выполнен: доступны patch/minor updates Next/Better Auth/Tiptap и др.
Runtime обновления не выполнялись; новые Prisma 8 / TypeScript 7 major updates
оставлены для отдельного совместимого обновления. Для найденной dev-only проблемы
braces безопасной опубликованной patched версии нет.
ESLint 9.39.5 сохранён по заданию; миграция ESLint 10 не возобновлялась.

### 27. npm audit

2 октября audit вернул 0; повтор 4 октября вернул **8 high**, все по цепочкам
одной advisory `braces <=3.0.3` (stack exhaustion при deeply nested glob patterns):
braces → micromatch → fast-glob → Next ESLint plugin/config и shadcn/ts-morph.
`npm audit --omit=dev`: **0 vulnerabilities**. `npm view braces version`: 3.0.3.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
указывает отсутствие patched версии. Предлагаемые npm downgrades eslint-config-next
до 14.2.35 и shadcn до 1.0.0 несовместимы с текущим стеком; не выполнялись.
Это открытый риск dev tooling при обработке недоверенных glob patterns, а не
восемь независимых runtime уязвимостей. Проверки используют repository-controlled
patterns; пользовательские статьи не передаются в glob. Нужен повтор audit после
upstream исправления. Force/legacy-peer/самодельные patches не применялись.

### 28. Браузеры

Chromium, Firefox и WebKit установлены и реально прошли smoke семи маршрутов:
home/login/article/profile/editor/dashboard/admin. Повтор в combined acceptance PASS.

### 29. Cross-browser ограничения

Windows headless WebKit неустойчиво получает native window focus: Tab может
не сдвигать activeElement при document.hasFocus=false. Route/editor smoke прошёл,
keyboard проверен в Chromium/Firefox. Это ограничение тестового окружения, не
заявление о проверке Safari/iOS клавиатурой. Физические устройства не использовались.

### 30. E2E additions

Новый путь: register/login → editor → autosave/reopen → offline retry → two-tab
conflict → reject/reason/correct → approve/public → like/bookmark/comment/follow →
following/notifications → published v1 isolation during draft/pending v2 → approve v2.
Дополнительно: unsafe login returnTo, CSRF sign-out, mount without mutation,
network-failed reactions/comments, DB fault boundary, cancellation experiment.
Существующие social/notifications/admin harness сохранены. Public external harness
получил отдельную NARRA_PUBLIC_BROWSER_QA: прежняя переменная конфликтовала с social.
Полный journey PASS. Исправлены и тестовые гонки: ожидание server-confirmed
«Решение сохранено» вместо исчезновения прежнего имени pending кнопки;
точный logout locator и нормализованная причина отклонения.

### 31. Accessibility automated tests

Playwright+axe проверяют все 29 UI screens, а не только главную.
Unit tests проверяют public heading strategy/escaping/code focus, error descriptions,
timezone/pagination и отсутствие queries для пустых notifications.
Browser assertions покрывают focus/Escape, 99+, menus, reduced motion и back/forward.

### 32. Accessibility результат

Пройденная матрица: 0 serious/critical axe violations.
Остаётся один moderate best-practice heading-order внутри Tiptap source document
(авторский H1→H3). Он явно зафиксирован, исходный JSON не переписывается.
Read-only renderer эту проблему исправляет. Это не формальная WCAG сертификация;
screen-reader/manual assistive technology аудит не выполнялся.

### 33. Blob E2E

Не выполнен: BLOB_READ_WRITE_TOKEN отсутствует. Credentials не выдумывались.

### 34. Private/public image flow

Cloud upload/download не объявляются проверенными. Service tests проверяют
ownership/publication pointer/image metadata visibility и запреты чужого доступа.
Для реального upload→private→moderator→published→archive flow нужен private Blob store.

### 35. Typecheck

`npm run typecheck`: PASS после последних правок 4 октября.

### 36. Lint

`npm run lint`: PASS после последних правок, 0 warnings.

### 37. Unit tests

`npm test`: 119 PASS / 8 files.

### 38. Integration tests

Предыдущие фазы: 39 PASS + 2 failures в первом общем запуске из-за коллизии
NARRA_BROWSER_QA (public запустил social harness с неверным протоколом fixtures).
После изоляции public suite: 4/4 PASS, остальные 37 ранее PASS; 41 unique cases.
Quality journey + follow rate/rollback/idempotency: 2/2 PASS, 224.06 sec 4 октября.
Итого 43 уникальных integration cases прошли (8 прежних suites + новая quality).
Повтор полного quality suite с route matrix также 2/2 PASS, 346.22 sec.

### 39. Playwright

Route/axe matrix и три browser smoke прошли. Existing social/notifications/admin
browser cases вошли в успешные предыдущие integration suites.
Новый сквозной journey и финальный combined browser acceptance PASS.
Промежуточные harness failures описаны выше и не выдаются за продуктовые успехи.

### 40. Production build

Production build с исправлением Tiptap setEditable: PASS (4 октября).
Все UI pages dynamic/server-rendered; schema generation прошла.

### 41. Prisma

`db:validate` PASS, `db:status`: 8 migrations, database up to date.
Новые migrations не нужны, старые не изменены; SHA-256 всех 8 SQL файлов совпадает
с `_prisma_migrations`, все finished, ни одной rolled back. Финальный read-only audit:
0 QA users, 0 временных QA schemas, 0 duplicate active DRAFT/PENDING revisions.

### 42. Regression

Service regression: Auth, Profiles, Editor, Autosave, Moderation, Publication,
Public feed/Search/Category/Tag, Likes/Bookmarks/Comments/Follows, Following,
Notifications, Reports/Admin/Analytics. Новый цельный browser путь также PASS.

### 43. Известные ограничения

Не выполнены cloud Blob E2E, physical mobile/Safari, screen-reader, production-scale
нагрузка, Lighthouse/real-user metrics. Editor source heading warning объяснён выше.
Dev-only braces advisory без patched release остаётся открытой. Stream cancellation
расследование выполнено в описанных границах; warning возможен при отмене запроса.

### 44. Neon / VPN

VPN остаётся включённым по требованию пользователя. Реальная development Neon
доступна; tests учитывают сетевую задержку, не используют подменную БД или фальшивые
успехи. Зависимость времени прогона от Neon/VPN сохраняется. TLS не ослаблялся.

### 45. Ручные действия

После завершения review: проверить diff, подключить private Blob credentials локально
и выполнить image E2E, проверить Safari/iOS/assistive technology. Самостоятельно
решить вопрос commit. Не публиковать `.env`; staging пуст. Secret scan 222 актуальных
Git-кандидатов: 0 совпадений с environment secret values/private-key markers.
Ранее проверены 7 commits / 321 unique historical blobs: 0 совпадений; HEAD не менялся.
`.env`, Prisma generated, build и QA artifacts ignored. `git diff --check` PASS.
Созданный для QA production server остановлен; рабочее дерево сохранено для review.

### 46. PHASE 10

Только после отдельного задания: deployment/runbook, production environment URLs,
private Blob E2E, backup/restore/retention, observability, real-device/performance QA,
план безопасных dependency updates. Эти задачи в PHASE 9 не реализовывались.

## Команды проверки

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
npm run db:status
npm audit
npm audit --omit=dev
npm outdated
# В отдельном терминале: npm run start
$env:NARRA_BROWSER_QA = (Resolve-Path tests/social.browser.mjs).Path
$env:NARRA_NOTIFICATION_BROWSER_QA = (Resolve-Path tests/notifications.browser.mjs).Path
$env:NARRA_ADMIN_BROWSER_QA = (Resolve-Path tests/administration.browser.mjs).Path
npx vitest run tests/auth.integration.test.ts tests/articles.integration.test.ts tests/moderation.integration.test.ts tests/public-content.integration.test.ts tests/social.integration.test.ts tests/notifications.integration.test.ts tests/administration.integration.test.ts tests/admin-protection.integration.test.ts --maxWorkers=1
Remove-Item Env:NARRA_QUALITY_MODE -ErrorAction SilentlyContinue
npm run test:quality:integration
```

Tests используют development DATABASE_URL и доступ к созданию временной schema
для last-ADMIN isolation. Пример не подключает новую БД и не применяет db push.
`npm audit` возвращает ненулевой код при описанной dev advisory, `npm outdated` —
при доступных обновлениях; эти результаты не маскируются под PASS.

## Источники и границы выводов

Локальные Next.js 16.3 guides и установленный source — источник для retry/RSC API.
Практическая accessibility цель: [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
[Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible).
Инструменты: [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing),
[browser engines](https://playwright.dev/docs/browsers).
Автоматические проверки не заменяют пользователя со screen reader и не подтверждают
поведение невыполненных cloud/production сценариев.
