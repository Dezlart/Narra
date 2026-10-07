# Narra — Deployment runbook

Дата проверки официальной документации: 5 октября 2026.
Цель: Vercel / Node 24.x + отдельная production Neon + private Vercel Blob.
Этот документ не подтверждает создание облачных ресурсов. Текущий фактический
статус — в PHASE10_REPORT.md. Секреты не должны попадать в Git, чат или screenshots.

## 1. Подготовка и границы окружений

Сначала review diff PHASE 10, затем самостоятельный commit/push владельца.
В Vercel должен попасть именно проверенный commit из `Dezlart/Narra`, branch `main`.
Незафиксированные локальные изменения Git integration не увидит.
Зафиксируйте release SHA и результаты проверок до публикации.

Development, Preview и Production используют разные credentials, БД/ветки и stores.
Production данные и секреты нельзя выдавать Preview, fork PR или интеграционным тестам.
Не подключайте текущую локальную development DB как production.
Нужны доступ владельца к GitHub/Vercel/Neon и подтверждённый бюджет/план.

## 2. Neon production setup

Создайте отдельный production project/database в Neon, выберите нужный регион.
Для Frankfurt DB разместите Vercel Functions в Frankfurt (`fra1`). Регион функций
задаётся в Project Settings → Functions; проверьте итоговый deployment summary.
Не оставляйте случайный далёкий default. Фактические plans/regions ещё не подтверждены.
Используйте выданные Neon connection strings, а не вручную угаданные hostnames.

Скопируйте pooled URL в `DATABASE_URL`, direct/unpooled URL той же database/branch
в `DIRECT_URL` защищённой migration shell. Проверьте database name, branch/endpoint,
роль и TLS. Пароль не должен попадать в аргументы команд, историю или logs.
Для нового окружения предпочитайте `sslmode=verify-full`, проверьте совместимость
с выданными провайдером параметрами. Не отключайте certificate verification.

Runtime PrismaPg использует пул; Prisma 7 CLI читает DIRECT_URL из prisma.config.ts.
Fallback DATABASE_URL сохранён для существующей локальной конфигурации.
DIRECT_URL не требуется клиентскому bundle, сборке или серверному runtime.
Не добавляйте устаревший datasource.directUrl в schema.prisma и не меняйте adapter.

До релиза откройте Neon Backup & Restore и запишите **фактические** plan, history window,
branch type, retention, доступность восстановления, владельца и желаемые RPO/RTO.
Тариф не известен, поэтому конкретные сроки восстановления здесь не обещаны.

## 3. Private Blob

В Vercel Storage создайте **Private** store и подключите его только к Production.
Preview/Development — отдельный store. В интерфейсе connection environments проверьте
выбранные пункты: Production и Preview могут быть предвыбраны одновременно.

Предпочтителен управляемый OIDC: в Vercel runtime достаточно store binding
`BLOB_STORE_ID`. Платформа передаёт короткоживущий OIDC token через request context
(`x-vercel-oidc-token`), а `@vercel/blob` читает его через `@vercel/oidc`.
`VERCEL_OIDC_TOKEN` существует как environment variable при build и local env pull,
но instrumentation не должна требовать его в Functions runtime. Не добавляйте этот
token вручную и не передавайте `token`/`oidcToken` явно в `put/get/del`.
Альтернатива вне Vercel — server-only `BLOB_READ_WRITE_TOKEN`.
Public store несовместим с защитой черновиков. Webhooks/client upload не используются.
Значения private storage не должны попасть в NEXT_PUBLIC_* или браузерный JSON.

В Narra upload идёт через Node Route Handler: до 3 MiB, JPEG/PNG/WebP, до 20 MP,
Sharp перекодирует в WebP до 2400 px без EXIF. Лимит учитывает размер запроса Functions.
Image optimizer исключён из guarded image paths. В БД — ArticleImage и внутренние URL.

Обычное удаление draft не выполняет массовую очистку Blob: старые revisions могут
ссылаться на те же объекты. Orphan files возможны, quota нужно контролировать.
GC/retention — отдельная будущая задача с проверкой ссылок всех revisions и grace period.
Нельзя очищать store по одному только текущему cover или published snapshot.

## 4. Vercel import и env

Import Git repository `Dezlart/Narra`, Production Branch `main`, root directory `/`.
Framework: Next.js. Node.js: 24.x. Install: `npm ci`. Build: `npm run build`.
Output directory — framework default. Не ставьте `npm ci --omit=dev`: сборке нужны
TypeScript/Prisma. Postinstall генерирует Prisma Client. vercel.json не требуется.
Node runtime сохранён; PrismaPg/Sharp не переводить в Edge.

Настройте Production scope:

| Ключ | Значение, источник |
| --- | --- |
| DATABASE_URL | Pooled production Neon, TLS |
| BETTER_AUTH_SECRET | Новый случайный ключ минимум 32 символа |
| ANALYTICS_HASH_SECRET | Другой независимый случайный ключ минимум 32 символа |
| BETTER_AUTH_URL | Точный публичный HTTPS origin проекта |
| SITE_URL | Тот же публичный HTTPS origin |
| BLOB_STORE_ID | Managed production private store binding |
| BLOB_READ_WRITE_TOKEN | Только если выбран static-token вариант вместо OIDC |

DIRECT_URL оставьте в защищённой migration shell; на Vercel он не нужен, пока
миграции выполняются отдельно. `VERCEL`, `VERCEL_ENV` и runtime OIDC request header
управляются платформой. `VERCEL_OIDC_TOKEN` вручную не задаётся. NEXT_PHASE —
внутреннее значение Next.js.

Получите настоящий assigned domain в Vercel, затем задайте оба URL. Не используйте
фиктивный narra.example или localhost. Ошибка environment format останавливает runtime
с именами отсутствующих переменных, без их значений. Сборка не требует этих секретов.
`npm run env:check:production` проверяет настройки в текущей shell. Managed OIDC
с `BLOB_STORE_ID` считается доступным только при платформенном `VERCEL=1`; вне Vercel
для проверки и работы нужен `BLOB_READ_WRITE_TOKEN`. Реальный OIDC проверяется
request-time Blob операцией внутри Vercel Function.
Preflight не доказывает, что БД production, Blob private или credentials рабочие.
При invalid env instrumentation отклоняет подготовку сервера. Локальный Next 16.3.6
может вывести Ready до ошибки hook и оставить процесс живым: проверяйте успешный
HTTP response/health платформы, а не только startup banner или наличие процесса.

Для Preview настройте отдельные resources/secrets, BETTER_AUTH_URL точного HTTPS
preview origin; при неизвестном временном домене сначала получите deployment URL,
обновите env для выбранного preview и redeploy. SITE_URL оставьте пустым.
Не добавляйте wildcard trustedOrigins. Preview всегда noindex, robots disallow,
без production canonical/sitemap. Защита Preview средствами Vercel желательна;
robots не является контролем доступа.

## 5. Миграции и seed перед приёмкой

Откройте отдельный терминал с явно выбранными production DATABASE_URL/DIRECT_URL.
Не заменяйте development `.env` production secrets. Не выводите environment целиком.
Перед командой сверьте target по Neon Console. Убедитесь, что имеется доступный
backup/recovery plan, особенно при будущих изменениях непустой БД.

```powershell
npm ci
npm run db:validate
npm run db:status
npm run db:deploy
npm run db:status
npm run db:seed
```

До первого deploy `db:status` может показать pending migrations и ненулевой exit;
после deploy должны быть применены все 8 и status up to date. Если failed migration,
checksum mismatch или destructive change — остановиться и расследовать.
Не выполнять migrate dev/reset/db push на production, не удалять migration records,
не менять исторические SQL/checksums и не использовать migrate resolve вслепую.
Build/start не выполняют миграции автоматически: отдельный шаг предотвращает гонки.

Seed идемпотентно добавляет только шесть отсутствующих категорий, `update: {}`;
нет fake articles, пользователей или admin. Повтор не должен менять имеющиеся данные.
Выполняется через DATABASE_URL, поэтому обе строки должны указывать на один target.
Fresh-schema test предназначен только для development и уже выполнен при подготовке.

## 6. Deploy и первый ADMIN

После env/migrations/seed выполните deployment проверенного commit в Vercel.
Убедитесь, что build зелёный, выбран Node 24, регион верный, env scope Production.
Проверьте HTTPS и startup logs, затем основную страницу и защищённые маршруты.
Не объявляйте успешный build подтверждением рабочего runtime или БД.

Владелец самостоятельно регистрирует свой аккаунт на реальном `/register`.
В отдельной shell с подтверждённой production DATABASE_URL:

```sh
npm run admin:promote -- --email <реальный-email-владельца> --confirm
```

Команда не создаёт пользователей и требует существующий активный credential account.
Не оставляйте тестовый пароль/admin в seed. Проверьте `/admin` с аккаунтом владельца.
Не блокируйте/понижайте последнего ADMIN в production smoke.

## 7. Production smoke и Blob acceptance

Запишите дату, SHA, реальный URL и результаты. Автоматические development suites
создают/меняют fixtures: **не направлять их в production**. Для production auth/статей
нужен специально разрешённый владельцем QA аккаунт и согласованный тестовый контент.

- Гость: `/`, категории, поиск, существующая публичная статья/профиль; корректные 404.
- `/dashboard`, `/editor/new`, `/following`, `/admin`: guest/login, USER без admin access.
  Проверить прямые action/API запросы, а не только скрытые пункты меню.
- Register/login/logout, safe returnTo, session persistence/revocation. Cookies:
  HttpOnly, Secure, SameSite=Lax. Запрос с чужим Origin отвергается, origin без wildcard.
- Автор: draft, autosave, reload, submit. Модератор: preview, reject/correct/approve.
  Новая pending revision не меняет опубликованную до approval.
- Like/bookmark/comment/follow, following/notification/read state, report/admin review,
  авторская аналитика; repeated view того же посетителя в UTC day не удваивает запись.
- **Реальный Blob:** cover + inline upload → autosave → reload → submit → moderator
  preview → approve → guest public images. До approval guest/другой автор получает отказ.
  Pending/draft-only image IDs нельзя прочитать через public route. После archive доступ
  закрыт, после restore только approved snapshot. Проверить no-store и отсутствие storage URL.
- Заголовки nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy,
  HTTPS/HSTS на реальном host; нет секретов/SQL/stack trace в UI.
- Canonical/OG указывают реальный SITE_URL; OG cover — только public proxy approved
  image. Search/login/private pages noindex. Robots разрешает public и закрывает private.
  Sitemap включает только публичные материалы; Preview не индексируется.
- Desktop/mobile smoke и Chromium/Firefox/WebKit; консоль без неожиданных ошибок.

Удалять можно только собственные согласованные QA fixtures, учитывая связанные reports,
revisions и Blob. Не выполнять глобальный delete/truncate или seed-reset. Допустимо
архивировать согласованную QA публикацию, явно записав оставшиеся данные/Blob в отчёт.
Тестовые credentials/cookies/скриншоты входа не коммитить.

## 8. Custom domain

Добавьте домен в Vercel, выполните показанные DNS instructions, дождитесь действующего
HTTPS. Одновременно измените BETTER_AUTH_URL и SITE_URL на один выбранный canonical
origin, затем redeploy. Настройте alias/redirect старого host на основной в Vercel.
Не расширяйте trustedOrigins до `*.vercel.app`. Host-only cookies старого домена
не переносятся автоматически: нужен повторный вход. Повторите auth/CSRF, robots,
sitemap, OG, private/public images и admin smoke после смены домена.

## 9. Rollback и восстановление

Application rollback в Vercel переключает deployment, **не БД и не Blob**. Старый
build может содержать старые env; проверьте совместимость schema/secrets и права
на rollback по фактическому тарифу. После rollback повторите smoke. Для нового
релиза/возврата auto-assignment следуйте текущему интерфейсу Vercel.

Neon recovery зависит от реального history window/plan/типа ветки. В текущей документации
instant restore описан для root branches; он заменяет состояние всех databases ветки,
а не сливает записи. Child branch нельзя считать имеющей такую же PITR возможность.
Перед действием определите момент сбоя read-only проверкой, остановите записи по
согласованному плану, сохраните текущее состояние и оцените потерю новых записей.
Первое восстановление проверяйте на изолированном target и репетируйте до launch.
После восстановления сверяйте schema/migrations, publication pointers, аккаунты и Blob links.
Не обещайте one-click database rollback и не удаляйте `_prisma_migrations` вручную.

Если выбранный тариф/окно недостаточны, организуйте зашифрованный `pg_dump` backup
в отдельном защищённом хранилище и проверку `pg_restore` в изолированной БД; credentials
через защищённую среду, не command-line URL. Периодичность/retention определяет владелец
по RPO/RTO и чувствительности данных. Database backup **не содержит Blob bytes**:
отдельно согласуйте их хранение/восстановление и не запускайте GC до проверки backup.
Никаких cron jobs, платных сервисов и реального restore этот этап автоматически не создаёт.

## 10. Эксплуатация и открытые вопросы

Периодически проверяйте Vercel runtime errors/latency, Neon connections/storage,
Blob quota/orphans, security advisories, очередь жалоб и admin issues. Не требуется
ежедневное ручное обслуживание. Уведомления платформ/alerts включайте по выбранному
плану; сторонний платный monitoring без согласования не устанавливается.
Не логировать request bodies, Authorization/Cookie, DATABASE_URL, user content,
raw auth/Prisma exceptions. Текущий auth logger пишет только общий failure marker.

CSP с nonce требует отдельного внедрения и проверки App Router/RSC/editor; её пока нет.
HSTS проверяется на Vercel HTTPS; preload/includeSubDomains без проверки доменов не добавлен.
На Vercel auth использует x-vercel-forwarded-for, сформированный платформой; при другом
reverse proxy нужна отдельная настройка доверия. Не принимать произвольный клиентский IP.

Narra хранит account info, articles, social interactions, notifications и view hashes.
Перед коммерческим запуском необходимы Privacy Policy, Terms и политика data retention
как организационная задача. Legal placeholders не добавлены. Email остаётся future.

## Pre-deployment checklist

- [ ] Review, commit и push выполнены владельцем; выбран правильный release SHA.
- [ ] Отдельная production Neon создана, target и TLS проверены.
- [ ] Backup plan/history window/restore rehearsal и RPO/RTO подтверждены.
- [ ] Private production Blob создан и подключён только к правильному environment.
- [ ] Vercel import/branch/root/Node 24/регион функций подтверждены.
- [ ] Production и Preview secrets/resources разделены, env preflight PASS.
- [ ] Все migrations applied; status/checksums PASS; categories seed выполнен.
- [ ] Typecheck/lint/unit/integration/browser/production build PASS.
- [ ] Реальные BETTER_AUTH_URL и SITE_URL совпадают; HTTPS работает.
- [ ] Deployment runtime и DB connectivity PASS.
- [ ] Owner ADMIN назначен явно; guest/USER/admin protection PASS.
- [ ] Robots/sitemap/canonical/OG/headers проверены на настоящем URL.
- [ ] Auth, public content, social/notifications/admin/analytics smoke PASS.
- [ ] Реальный private Blob E2E PASS, draft/pending images не раскрываются.
- [ ] QA fixtures очищены/согласованно архивированы; остатки задокументированы.
- [ ] Открытые ограничения классифицированы и приняты владельцем.

## Официальные источники

- [Next.js environment](https://nextjs.org/docs/app/guides/environment-variables),
  [headers](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers).
- [Prisma 7 configuration](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7),
  [Neon + Prisma](https://neon.com/docs/guides/prisma).
- [Vercel Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions),
  [regions](https://vercel.com/docs/functions/configuring-functions/region),
  [request headers](https://vercel.com/docs/headers/request-headers).
- [Private Blob / SDK / OIDC](https://vercel.com/docs/vercel-blob/using-blob-sdk).
- [Better Auth cookies](https://better-auth.com/docs/concepts/cookies),
  [options](https://better-auth.com/docs/reference/options).
- [Vercel rollback](https://vercel.com/docs/instant-rollback),
  [Neon restore](https://neon.com/docs/postgres/backup-restore/branch-restore),
  [history window](https://neon.com/docs/postgres/backup-restore/history-window).

