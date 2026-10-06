# Narra

Платформа авторских статей: редактор с автосохранением, обязательная модерация,
публикация одобренных версий, общение и персональная лента.

PHASE 1–9 зафиксированы. Подготовка PHASE 10 находится в рабочем дереве для review.
Публичный deployment пока не подтверждён. Полные результаты и ограничения:
[PHASE10_REPORT.md](PHASE10_REPORT.md). Спецификация: [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Возможности

- Регистрация, вход, профиль; роли USER / MODERATOR / ADMIN и блокировка аккаунтов.
- Tiptap JSON, черновики, автосохранение, конфликт двух вкладок, обложки и inline images.
- Отправка на модерацию, отклонение с причиной, одобрение, архивирование и восстановление.
- Лента, поиск, категории, теги, страницы статей и авторов.
- Лайки, закладки, комментарии/ответы, подписки, персональная лента и уведомления в БД.
- Жалобы, управление пользователями/категориями/публикациями, аналитика автора и платформы.
- Адаптивный интерфейс, клавиатурная навигация, доступные состояния ошибок/загрузки.

## Стек

Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Radix/shadcn UI,
Golos Text/Lora, Tiptap 3, Better Auth, Prisma 7 с adapter-pg, PostgreSQL (Neon),
private Vercel Blob и Sharp. Node.js **24.x**, npm и package-lock.json.
Точные версии закреплены lockfile; Vercel — целевая платформа размещения.
Vitest, Playwright и axe используются только при разработке/проверках.
Resend, realtime, очереди и внешняя BI не подключены.

## Архитектура

Модульный монолит: Server Components по умолчанию, Server Actions для изменений,
Route Handlers для auth и изображений. PostgreSQL — единственный источник данных;
демо-данные не заменяют backend.

```text
src/app/           публичные страницы, кабинет, администрация, API
src/features/      auth, users, articles, moderation, public-content,
                   social features, notifications, reports, analytics
src/lib/           Prisma singleton, env validation, auth/guards
prisma/            schema, 8 SQL migrations, category seed
scripts/           owner promotion, production preflight, fresh migration check
tests/             unit, DB integration, browser journeys
```

### Notable Architecture Decisions

- **Revision-based publishing.** Article имеет стабильный ID и указатель на approved
  revision. Новый DRAFT/PENDING не изменяет публичную статью. Частичные индексы,
  составные FK и транзакции защищают publication lifecycle.
- **Серверный RBAC.** Проверки в сервисах, свежие role/ban из БД, повторная проверка
  под блокировкой при изменении. Ban отзывает сессии. Последнего активного ADMIN
  нельзя удалить из управления; self-ban запрещён.
- **Социальные связи относятся к Article**, поэтому новая revision сохраняет реакции.
- **Уведомления сохраняются в транзакции события**, защищены от дублей, без polling/email.
- **Изображения остаются private.** Сервер проверяет владельца/модератора либо ссылки
  текущей опубликованной revision; Blob URL и token не передаются клиенту.
- **Просмотры без IP/fingerprint в ArticleView.** Суточный HMAC, scoped к статье,
  подписанная first-party cookie, отдельный ключ. Это не anti-fraud система.

## Локальный запуск

Нужны Node 24.x, npm, отдельная development PostgreSQL/Neon и доступ к сети.
VPN можно оставить включённым; при таймаутах проверяйте маршрут к своему endpoint.

```powershell
npm ci
Copy-Item .env.example .env
# Заполните .env собственными development-настройками.
npm run db:deploy
npm run db:seed
npm run dev
```

Откройте http://localhost:3000. BETTER_AUTH_URL должен быть этим точным origin.
Генерируйте два независимых секретных ключа (по одному запуску на ключ):

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Значения сохраняются только в локальном .env / secret manager, не в Git и не в чат.
`npm ci` автоматически генерирует Prisma Client; build также выполняет generation.
Сборка и проверка schema не требуют подключения к БД. Запуск сервера требует env.

## Environment

Все поля [.env.example](.env.example) намеренно пустые.

| Переменная | Назначение |
| --- | --- |
| DATABASE_URL | Runtime pooled PostgreSQL URL с TLS; собственный target для каждого окружения |
| DIRECT_URL | Прямой URL той же БД для Prisma CLI; необязателен локально, явный для production migration shell |
| BETTER_AUTH_SECRET | Секрет Better Auth, минимум 32 символа |
| BETTER_AUTH_URL | Точный origin; HTTP только для локального loopback, HTTPS для deployment |
| ANALYTICS_HASH_SECRET | Независимый HMAC key, минимум 32 символа; обязателен при production запуске |
| SITE_URL | Реальный production HTTPS origin для canonical/OG/robots/sitemap; равен auth origin |
| BLOB_READ_WRITE_TOKEN | Секрет private Blob для локальной/non-Vercel среды |
| BLOB_STORE_ID | Vercel store binding; работает с управляемым VERCEL_OIDC_TOKEN |

На Vercel предпочтителен managed OIDC; токен не копируют вручную.
NODE_ENV / VERCEL / VERCEL_ENV задаёт платформа. Preview имеет отдельные БД, store,
ключи и точный HTTPS auth origin; SITE_URL пуст. Preview принудительно noindex.
Без Blob локально текстовый редактор работает, загрузка файлов отключена.
Для deployment Blob обязателен. Никаких секретов в NEXT_PUBLIC_*.

## База данных и первый ADMIN

Prisma 7 CLI читает `DIRECT_URL || DATABASE_URL` из prisma.config.ts.
Приложение использует только DATABASE_URL через PrismaPg. Миграции не запускаются
в build/postinstall/start. На существующей БД выполняйте `npm run db:status`.
Новые migrations создаются только в development через `npm run db:migrate`.
Для применения существующих используйте `npm run db:deploy`; db push не используется.

Seed идемпотентно добавляет только отсутствующие базовые категории; не меняет
существующие записи, не создаёт пользователей, роли, статьи или фальшивую аналитику.
После самостоятельной регистрации владельца:

```sh
npm run admin:promote -- --email <email-своего-аккаунта> --confirm
```

Команда работает только с выбранной DATABASE_URL, не создаёт аккаунт и не имеет HTTP API.
Для production сначала проверьте окружение по [DEPLOYMENT.md](DEPLOYMENT.md).

## Проверки

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run db:validate
npm run db:status
npm audit --omit=dev
npm audit
npm run test:migrations:fresh -- --confirm-development
```

Последняя команда требует **development** БД и CREATE SCHEMA. Она создаёт уникальную
временную schema, применяет все migrations через Prisma CLI, проверяет status/checksums,
удаляет только эту schema. Не запускать с production credentials.

Полный regression на development БД, с `npm run start` в отдельном терминале:

```powershell
npx playwright install chromium firefox webkit
$env:NARRA_BROWSER_QA = (Resolve-Path tests/social.browser.mjs).Path
$env:NARRA_NOTIFICATION_BROWSER_QA = (Resolve-Path tests/notifications.browser.mjs).Path
$env:NARRA_ADMIN_BROWSER_QA = (Resolve-Path tests/administration.browser.mjs).Path
npx vitest run tests/auth.integration.test.ts tests/articles.integration.test.ts tests/moderation.integration.test.ts tests/public-content.integration.test.ts tests/social.integration.test.ts tests/notifications.integration.test.ts tests/administration.integration.test.ts tests/admin-protection.integration.test.ts --maxWorkers=1
npm run test:quality:integration
```

Quality suite: 29 экранов × 5 ширин, axe, Chromium/Firefox/WebKit, регистрация →
автосохранение/offline/conflict → reject/correct/approve → social → following/notifications.
Порты 3000 и 3002 должны быть свободны до запуска серверов. Fixtures случайные,
cleanup ограничен текущим запуском, credentials передаются через stdin. Логи/скриншоты
игнорируются Git. NARRA_QUALITY_MODE=audit/journey — диагностика; итоговый прогон без фильтра.
QA_BASE_URL и PLAYWRIGHT_MODULE/CHROMIUM_EXECUTABLE — необязательные test-only overrides,
не production env. NARRA_PUBLIC_BROWSER_QA — отдельный внешний public harness.

## Deployment

Vercel + **отдельная production Neon** + **private production Blob**.
Пошаговая настройка, регионы, migrations, секреты, smoke, rollback и recovery:
[DEPLOYMENT.md](DEPLOYMENT.md). `npm run env:check:production` проверяет формат env,
но не подтверждает доступ к облачным ресурсам. Standard Next.js integration,
Node runtime, без Edge и custom vercel.json. Репозиторий: Dezlart/Narra, main.
Commit/push выполняет владелец после review; публичный URL не выдуман.

## Security Notes

Auth origin/CSRF checks, HttpOnly/SameSite=Lax cookies, Secure для HTTPS, session cache
отключён. Точное доверенное origin без wildcard. На Vercel auth rate limiting читает
platform-managed x-vercel-forwarded-for. На другом host требуется доверенный reverse proxy.
Пользовательский контент валидируется; изображения проверяются/перекодируются Sharp
в WebP без metadata. Guarded routes no-store, optimizer не кэширует private images.
Есть nosniff, запрет iframe embedding, Referrer-Policy и Permissions-Policy.
CSP с nonce пока не внедрена; широкая unsafe-inline политика не выдаётся за защиту.

## Статус и ограничения

Реальные production ресурсы, Blob E2E и HTTPS production smoke ещё требуют подключения
и проверки. До этого Narra не объявляется полностью production-ready.
На 6 октября 2026 runtime audit: 0 уязвимостей; полный audit: 8 high по одной
[dev-only braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
без patched release. Force fix и несовместимые downgrades не применялись.
Выявленная 6 октября source-map-js advisory устранена совместимым patch 1.2.2.

Также не проверены физический Safari/iOS, screen readers, production-scale нагрузка.
В author editor возможен умеренный heading-order warning; public renderer нормализует
уровни без изменения JSON. При отмене запроса возможен Next stream cancellation warning.
Старые неиспользуемые Blob объекты не удаляются автоматически: нужна отдельная политика
retention/GC с учётом всех revisions. Email/realtime/advanced BI — будущие расширения.

Приложение хранит аккаунты, статьи, взаимодействия, уведомления и суточные view hashes.
Перед публичным коммерческим запуском владелец должен подготовить Privacy Policy,
Terms и правила хранения/удаления данных; юридические тексты-заглушки не добавлены.
