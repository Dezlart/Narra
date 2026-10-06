# PHASE 10 — Production Preparation, Deployment & Final QA

5–6 октября 2026. Исходная ветка `main`, HEAD `bea749c phase 9 ready`, чистое дерево.
PHASE 1–9 зафиксированы. Изменения PHASE 10 оставлены для review: без commit/push/staging.
Отдельные production Neon/Blob/Vercel и публичный URL в этой среде не подтверждены.
Ниже различаются локальная проверка кода и фактическая проверка инфраструктуры.

## Реализованные изменения

- Node engines ограничен поддерживаемым Vercel major 24.x; lockfile обновлён npm.
- Prisma 7 CLI предпочитает DIRECT_URL, runtime остаётся на DATABASE_URL/PrismaPg.
  Восемь исторических migrations и publication constraints не изменены.
- Server startup instrumentation и getPrisma проверяют environment без вывода значений.
  Deploy требует HTTPS origin, SITE_URL, TLS, независимые auth/analytics keys и Blob.
  Local loopback HTTP остаётся для development и production-build QA; build без env работает.
- Production preflight с безопасными ошибками; fresh migration check через настоящий
  Prisma migrate deploy/status в уникальной development schema с ограниченным cleanup.
- Secure auth cookies явно зависят от HTTPS, origins точные, CSRF не отключён.
  На Vercel rate-limit IP берётся из platform-managed x-vercel-forwarded-for.
- HTTP headers nosniff, DENY, Referrer-Policy, Permissions-Policy. Preview noindex
  через header и robots, без canonical/sitemap production host.
- .env.example полностью пуст по значениям; назначение каждого ключа объяснено.
- Удалены неиспользуемые **прямые** dependencies clsx/tailwind-merge. clsx остаётся
  необходимой транзитивной зависимостью class-variance-authority. cn используется
  src/lib/utils.ts и сохранён; shadcn/tailwind.css реально импортируется и сохранён.
- 6 октября повторный audit выявил source-map-js <1.2.2. Совместимый patch 1.2.2
  установлен обычным npm update: изменился один транзитивный package, без force,
  overrides или обхода peer conflicts. Production audit снова 0.
- README преобразован в описание проекта/архитектуры/запуска/проверок/ограничений.
  DEPLOYMENT.md содержит ручной runbook и checklist. PROJECT_SPEC уточнён только
  для production architecture; AGENTS отражает авторизацию текущей фазы.

## Результаты по 52 пунктам задания

1. **Конфигурация:** перечисленные выше изменения; новая функциональность платформы
   не добавлена. Server Components/strict TypeScript/Node runtime сохранены.
2. **Prisma/Neon:** datasource URL в prisma.config.ts, runtime driver adapter-pg;
   отдельная production БД не подменяется текущей development БД.
3. **Pooled/direct:** pooled DATABASE_URL для runtime, DIRECT_URL той же БД для CLI.
   Это схема Prisma 7; устаревший directUrl в schema.prisma не добавлен. Локальный
   fallback сохранён. Generation/validation/build не требуют реального URL.
4. **История миграций:** все 8 просмотрены на DROP/TRUNCATE/DELETE; destructive
   migration не обнаружена. Исторические SQL/checksums не редактировались.
5. **Fresh database check:** PASS — Prisma migrate deploy применил все 8 в новой
   временной schema реальной development Neon; migrate status up to date; SHA-256
   совпали. Собственная временная schema удалена, остальные сохранены.
6. **Prisma Client:** генерируется postinstall и build; исходники generated ignored.
7. **npm ci:** PASS в независимом чистом каталоге из Git HEAD + текущего diff,
   без node_modules/.next/generated/.env исходного checkout; повтор после удаления
   зависимостей и после source-map-js 1.2.2 также PASS (938 packages).
   .env в каталоги не копировался.
8. **Фактические env:** DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
   ANALYTICS_HASH_SECRET, SITE_URL, BLOB_READ_WRITE_TOKEN/BLOB_STORE_ID. Управляемые:
   NODE_ENV, VERCEL, VERCEL_ENV, VERCEL_OIDC_TOKEN; внутренние NEXT_RUNTIME/NEXT_PHASE.
9. **Development-only:** локальные DATABASE_URL/auth URL/ключи; test-only NARRA_*_QA,
   NARRA_QUALITY_MODE, QA_BASE_URL, PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE.
   Эти overrides не копируются в Vercel Production. Resend key не требуется.
10. **Production secrets:** отдельные значения ещё не предоставлены. Preflight с
    локальным env корректно завершился отказом: localhost auth, отсутствующие Blob/SITE_URL.
    Secret values не печатаются. Минимум 32 символа для двух независимых ключей.
11. **Better Auth:** HTTPS origin обязателен для deployed runtime; startup не допускает
    отсутствующий secret. Build без секретов проходит. Реальный production auth не проверен.
12. **Trusted origins:** ровно BETTER_AUTH_URL origin, без wildcard. Origin/CSRF checks
    сохранены. Vercel header для IP соответствует документации платформы.
13. **Cookies/sessions:** HttpOnly, SameSite=Lax, Secure для HTTPS; session cache отключён.
    Дополнительный real-DB auth suite с reserved HTTPS test origin: 2 PASS, включая
    Secure assertion, logout, ban/session и ownership/role проверки. Это не сетевой TLS smoke.
14. **Production Blob env:** не настроен/не подтверждён. Managed OIDC или private
    read-write token описаны; реальные credentials не выдумывались.
15. **Реальный Blob E2E:** BLOCKED — нет credentials/store. Upload/download не выданы
    за проверенные; точная последовательность acceptance записана в runbook.
16. **Private/public flow:** существующие owner/moderator/approved snapshot checks,
    private store, Sharp, no-store и запрет optimizer сохранены; cloud flow не проверен.
17. **Analytics secret:** обязательный при production runtime, минимум 32 символа,
    не равен auth secret. Независимость/отсутствие ключа покрыты unit tests.
18. **SITE_URL:** локально пуст; на production должен совпадать с реальным HTTPS auth
    origin. Никакого фиктивного live URL в metadata не добавлено.
19. **Canonical/robots/sitemap:** public approved snapshots; private/search noindex.
    Preview принудительно закрыт. HTTP smoke пяти локальных routes подтвердил headers,
    local robots disallow, пустой sitemap и search noindex; production URL не проверен.
20. **Headers:** nosniff, X-Frame-Options DENY, strict-origin-when-cross-origin,
    запрет camera/microphone/geolocation, без x-powered-by. HSTS проверяется на
    реальном HTTPS Vercel; preload/includeSubDomains вслепую не добавлены.
21. **CSP:** не внедрена. Nonce-based policy для App Router/RSC/editor — FUTURE;
    permissive unsafe-inline policy не маскирует отсутствие полноценной CSP.
22. **Secrets audit:** 229 текущих Git-кандидатов и 379 уникальных historical blobs
    проверены на известные .env secrets/decoded DB password, private-key markers,
    Blob/GitHub token markers. Совпадений нет; staging пуст. Это не доказательство
    отсутствия любого возможного неизвестного секрета. .env/build/generated/QA ignored.
    Дополнительно 55 файлов клиентской .next/static: известных secret values нет.
23. **Dependencies:** npm outdated выполнен. Рутинные patch/minor и новые major не
    обновлялись без необходимости. Удалены две подтверждённо лишние прямые зависимости.
24. **braces:** 3.0.3 остаётся последней опубликованной; GHSA-vfj7-8cjw-p6xm не имеет
    patched release на дату проверки. Force/downgrade config-next/shadcn не применены.
25. **Production audit:** `npm audit --omit=dev`: 0 vulnerabilities.
26. **Полный audit:** 8 high по одной dev-only braces advisory через glob/ESLint/shadcn.
    Repository-controlled patterns не получают пользовательские статьи. Это открытый
    HIGH tooling risk, а не восемь runtime уязвимостей. Не объявлен audit PASS.
27. **Node/Vercel:** 24.x закреплён; фактически Node 24.20.0. Vercel документирует 24.x;
    Node/Prisma/Sharp production build совместимы локально, облачный запуск не проверен.
28. **Clean build:** полный clean-install/typecheck/lint/unit/validate/build PASS
    без .env, включая финальный повтор 6 октября с source-map-js 1.2.2. Отдельный запуск
    чистой сборки с development env только в процессе: public/DB routes и guest protection PASS.
29. **Unit tests:** 130 PASS / 9 файлов (119 прежних + 11 environment/Preview tests).
30. **Integration tests:** прежние 8 suites: 41/41 PASS, 741.55 sec. Дополнительно
    HTTPS-origin auth suite: 2/2 PASS, 16.93 sec (повтор тех же auth cases).
    Quality: 2/2 PASS, 286.62 sec. Итого 43 уникальных integration cases.
31. **Playwright:** full quality и прежние social/notifications/admin browser harness
    PASS. 29 экранов × 5 ширин = 145 views, 0 overflow, 0 page errors. Три ожидаемых
    console errors — намеренные offline/aborted requests. Axe: 0 serious/critical,
    одно известное moderate heading-order в author editor; JSON не переписывается.
32. **Cross-browser:** Chromium/Firefox/WebKit smoke PASS. Keyboard Chromium/Firefox
    PASS; Windows headless WebKit focus ограничивает keyboard evidence, не Safari/iOS QA.
33. **Prisma validation:** PASS; schema не менялась.
34. **Migration status:** existing development и fresh schema up to date, 8 migrations.
    Финальный existing DB checksum audit 6 октября: 8/8 совпали, failed/rolled-back нет.
35. **Production DB:** создание не выполнялось; отдельный target не подтверждён.
36. **Production migrations:** не применялись. Инструкция migrate deploy/status готова.
37. **Production Blob:** создание не выполнялось; private store не подтверждён.
38. **Vercel project:** создание/import не выполнялись; нет локальной project binding
    или подтверждённого доступа/настроек. CLI credentials не искались по чужим хранилищам.
39. **Deployment:** не выполнен. Git push не разрешён автоматически и не выполнялся;
    reviewed commit и infrastructure остаются ручными prerequisites.
40. **URL:** реальный публичный URL неизвестен, live demo не заявлен.
41. **Production auth smoke:** не выполнен; нужен deployment и согласованный QA account.
42. **Production public content smoke:** не выполнен; локальный acceptance отдельно.
43. **Production admin protection:** не выполнен; серверные guards покрыты development tests.
44. **Production Blob E2E:** не выполнен; BLOCKER, а не optional future polish.
45. **Production analytics:** не выполнен; реальная development analytics входит в regression.
46. **QA cleanup:** 0 тестовых пользователей, 0 временных phase8/phase10 schemas,
    0 conflicting active revisions. Серверы QA не оставлены слушать порты.
    Удаление временной файловой копии заблокировано автоматической проверкой — ниже.
47. **Runbook:** DEPLOYMENT.md — Neon, private Blob, import, env, migrations/seed, owner
    ADMIN, smoke, domain, rollback/recovery, checklist, operations/privacy boundaries.
48. **Backup/recovery:** реальный Neon plan/history window не известен. Документ требует
    подтвердить их и репетировать restore; application rollback отделён от DB/Blob.
    Нет обещания one-click DB rollback или самовольного платного backup/cron.
49. **Ограничения:** cloud Blob, real HTTPS runtime, physical devices/screen reader,
    нагрузка, CSP, retention/GC; прежний editor heading-order и cancellation warning.
50. **Блокеры:** production resources/env/deployment/smoke/Blob acceptance и проверенный
    recovery plan. Нельзя считать runtime code check подтверждением real infrastructure.
51. **Ручные шаги:** review→commit/push→отдельные Neon/Blob→Vercel env/region→migrations/seed
    →deploy→owner ADMIN→согласованный smoke/Blob E2E→cleanup; checklist в DEPLOYMENT.md.
52. **Итог:** CODE READY / INFRASTRUCTURE NOT READY. Real infrastructure NOT VERIFIED.
    Нельзя объявлять PRODUCTION READY без закрытия пунктов 35–45/50.

## Журнал финальных проверок

| Проверка | Результат |
| --- | --- |
| Typecheck / lint / build / db:validate, 6 октября после security patch | PASS |
| Чистая копия финального lockfile: npm ci / typecheck / lint / unit / build / validate, без env | PASS |
| Unit tests после source-map-js 1.2.2 | 130 PASS / 9 files |
| Integration regression, 5 октября | 41 PASS / 8 suites |
| Quality journey + follow concurrency/rate tests, 5 октября | 2 PASS |
| HTTPS-origin auth (real development DB, synthetic reserved origin) | 2 PASS, повтор auth cases |
| Browser responsive / axe / 3 engines | PASS в указанных границах |
| Fresh migrations via CLI | 8 applied, checksums/status PASS, own schema removed |
| Existing development migration/checksum/QA audit, 6 октября | PASS, leftovers/conflicts 0 |
| HTTP security headers / local robots/sitemap/search | 5 routes PASS |
| Production env preflight с development env | Ожидаемый отказ, не ложный PASS |
| Runtime без env | Hook rejects config; успешный HTTP response отсутствует |

Full DB/browser acceptance выполнялся на финальном application source 5 октября.
Единственное последующее исполняемое изменение — транзитивный source-map-js patch
6 октября; после него повторены typecheck/lint/unit/build/validate и runtime smoke.
Prisma/schema/auth/UI source после acceptance не менялись. QA artifacts находятся
в ignored `.playwright-mcp`, итоговая browser матрица скопирована в phase10-final.json.
Секреты/пароли в отчёты не копировались. VPN оставлен включённым.

Особенность Next 16.3.6: при ошибке instrumentation локальный процесс может вывести
Ready до ошибки подготовки и не завершиться самостоятельно. Неверно считать это
здоровым startup: HTTP не обслуживается успешно. Preflight возвращает ненулевой код;
runbook требует HTTP/платформенную health проверку. Тестовый процесс явно остановлен.

Рекурсивное удаление временной clean-install копии автоматическая проверка отклонила
с причиной `blocked by policy`, включая повтор с проверенным абсолютным путём.
Не предпринимались обходы другим shell/API. Без `.env` осталась папка:
`C:\Users\Pavel\AppData\Local\Temp\narra-phase10-clean-199cb0e6511a4581a06518c851ec7288`.
Это файловый QA artifact, не оставленные пользователи/данные в БД.
Вторая финальная копия сохранена без удаления в
`C:\Users\Pavel\AppData\Local\Temp\narra-phase10-clean-final-20261006`.
Она перемещена из ignored QA каталога за пределы рабочего проекта. Вложенное
расположение при её сборке вызвало предупреждение Next о нескольких lockfiles;
сама сборка прошла. Основной checkout этого предупреждения не имел. Обе временные
копии не содержат `.env`, секретов или пользовательских fixtures; можно удалить вручную.

## Классификация ограничений

| Приоритет | Ограничение |
| --- | --- |
| BLOCKER | Нет подтверждённых production Neon/Blob/Vercel, env, deployment и production smoke/Blob E2E |
| BLOCKER | Production backup plan/history window и restore rehearsal ещё не подтверждены |
| HIGH | Dev-only braces advisory без patched release; не запускать tooling на недоверенных glob patterns |
| MEDIUM | Не измерены реальные production latency/scale; auth/session и Blob должны пройти hosted smoke |
| LOW | Windows headless WebKit focus ограничивает keyboard evidence; editor source heading-order warning; pg TLS semantics warning; occasional Next cancellation warning |
| FUTURE | CSP nonce, screen-reader/physical-device audit, retention/Blob GC, Privacy/Terms как отдельная организационная работа; email/realtime не добавлены |

## Источники

Текущая документация Next.js (включая node_modules/next/dist/docs), Prisma 7, Neon,
Better Auth, Vercel Node/regions/headers/Blob/rollback проверена до изменений.
Точные ссылки и deployment решения: [DEPLOYMENT.md](DEPLOYMENT.md).
Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Исправленная advisory: [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).
Предыдущий baseline и ограничения: [PHASE9_REPORT.md](PHASE9_REPORT.md).
