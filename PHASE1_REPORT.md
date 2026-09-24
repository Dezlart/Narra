# Narra — отчёт PHASE 1

Дата: 24 сентября 2026. Реализована только Foundation. PHASE 2 не начата.

1. **Исходное состояние.** Рабочая папка была пустой; package.json, исходников,
   конфигураций, lockfile и Git-репозитория не было. Установлены Node.js 24.20.0
   и npm 11.19.0. DATABASE_URL отсутствовал.
2. **Что создано.** Next.js App Router foundation, строгий TypeScript, Tailwind,
   shadcn/ui, дизайн-система, адаптивная демонстрационная главная, Prisma schema,
   SQL-миграция, server-only client helper, environment template, документация.
   Создан локальный Git main без commits и push.
3. **Файлы.** Все файлы новые. Корень: PROJECT_SPEC.md, README.md, AGENTS.md,
   PHASE1_REPORT.md, package.json, package-lock.json, .env.example, .gitignore,
   .nvmrc, components.json, tsconfig.json, next.config.ts, postcss.config.mjs,
   eslint.config.mjs, prisma.config.ts. Prisma: schema.prisma, migration_lock.toml,
   migrations/20260924140000_foundation/migration.sql. App: layout, page, globals,
   loading, error, not-found, icon.svg. Components: site-header, site-footer,
   featured-story, story-preview, story-card, spotlight, editorial-art,
   demo-content, ui/button. Также features/README.md, lib/prisma.ts,
   lib/utils.ts и types/navigation.ts.
4. **Зависимости.** Next.js 16.3.6, React/React DOM 19.3.0, TypeScript 6.0.3,
   Tailwind/PostCSS 4.3.3, shadcn CLI 4.21.0, Lucide 1.48.0,
   Prisma/client/adapter-pg 7.10.0, pg 8.23.0, dotenv 18.0.3,
   ESLint 9.39.5 и eslint-config-next 16.3.6. UI: radix-ui, cn,
   class-variance-authority, clsx, tailwind-merge, tw-animate-css.
   Локальные шрифты: @fontsource-variable/golos-text и lora 5.3.0.
   Также server-only и необходимые @types. Точные версии всех транзитивных
   пакетов зафиксированы в package-lock.json. Better Auth, Tiptap, Blob,
   Resend и функциональность будущих фаз не добавлялись.
5. **Структура.** src/app — presentation и маршруты; components — UI;
   features — документированная граница будущих бизнес-модулей;
   lib — infrastructure helpers; types — общие UI-типы; generated — Prisma
   Client, исключённый из Git. Нет пустых feature modules и fake API.
6. **Design system.** Светлый тёплый фон, терракота, графитовый текст,
   Golos Text + Lora, небольшие радиусы, контейнер 1232 px и token ширины
   чтения 736 px. Desktop/tablet/mobile, keyboard focus, skip-link,
   reduced motion, загрузка, ошибка, 404 и пустое состояние.
   Демоданные отделены от backend; изображения — собственные SVG.
7. **Prisma schema.** User, Article, ArticleRevision, Category, Tag,
   ArticleRevisionTag. UserRole USER/MODERATOR/ADMIN; ArticleStatus
   DRAFT/PUBLISHED/ARCHIVED; ArticleRevisionStatus DRAFT/PENDING/APPROVED/REJECTED.
   User содержит стандартные поля Better Auth. Контент — JSONB.
8. **Связи версий.** ArticleRevisions связывает все версии со статьёй;
   PublishedRevision использует FK `(id, publishedRevisionId) → (articleId, id)`.
   Нельзя назначить revision другой статьи. Pointer nullable при создании.
   Уникальны номера версий внутри статьи и пары revision/tag. Категория и теги
   принадлежат revision для будущей обязательной модерации. SQL CHECKs
   ограничивают version, rejectionReason и поля публикации. Проверка APPROVED,
   ownership, roles и неизменяемости одобренных версий остаётся задачей
   серверных сервисов следующих фаз; текущих mutations нет.
9. **Environment.** Только DATABASE_URL. URL вынесен в prisma.config.ts согласно
   Prisma 7. Дополнительный DIRECT_URL не требуется. .env, локальные env-файлы,
   generated client, node_modules и результаты браузерной проверки игнорируются Git.
10. **Проверки.** Генерация Prisma Client, schema validation, typecheck, lint,
    production build, npm dependency tree, npm audit; браузерный smoke-check
    production-сервера. В браузере проверены 1440/768/390/320 px, локальные шрифты,
    переключение тем, empty/reset, мобильное меню, якоря, клавиатурный skip-link
    и HTTP 404 с возвратом на главную. Переполнения по горизонтали нет.
11. **Typecheck.** PASS. Strict mode сохранён. Без any, ts-ignore и подавления
    ESLint в написанном вручную коде. Генерируемый код библиотек не редактировался.
12. **Lint.** PASS, 0 ошибок и предупреждений, `--max-warnings=0`.
13. **Production build.** PASS. Главная и not-found пререндерятся статически.
    Сборка работает без DATABASE_URL и скачивания Google Fonts.
14. **Prisma validation.** PASS. Начальная SQL-миграция сгенерирована офлайн
    штатным migrate diff; foreign keys просмотрены. Это не проверка применения
    к живой базе. В процессе CLI validation после overrides тоже прошла.
15. **Ограничения проверки.** Без DATABASE_URL не выполнялись подключение к
    PostgreSQL, применение миграции, запросы через PrismaPg и runtime-проверки
    database constraints. Auth и другие будущие сценарии ещё не реализованы.
    На главной нет ошибок/предупреждений консоли; при проверке намеренно
    несуществующего URL зарегистрирован ожидаемый HTTP 404.
16. **Ручные действия.** Для UI: npm ci и npm run dev. Для базы: скопировать
    .env.example в .env, заполнить URL своей development-базы, затем выполнить
    npm run db:deploy, npm run db:status, npm run db:generate.
    Не использовать production credentials или чужую существующую базу.
17. **Архитектурные уточнения.** Зафиксированы в начале PROJECT_SPEC.md:
    Prisma 7 вместо latest, который указывает на 8 RC; driver adapter и новый
    config; nullable username/slug на этапе onboarding/draft; category/tags
    перенесены в revision; состояния moderation не дублируются в Article;
    составной FK защищает принадлежность опубликованной версии. TypeScript 6.0
    и ESLint 9 выбраны из-за peer ranges плагинов Next.js. ESLint 9 уже имеет
    upstream deprecation: обновить после совместимого обновления плагинов.
    Точечные overrides deepmerge-ts 8.0.2 и mysql2 3.24.4 устраняют advisories
    Prisma CLI; npm audit: 0 уязвимостей. Нет invalid peer dependencies.
18. **Следующий шаг, PHASE 2.** По отдельной команде: Better Auth, генерация
    актуальных Account/Session/Verification моделей, миграция, регистрация,
    login/logout, сессии, профили и серверные RBAC guards.

Официальные источники решений доступны в PROJECT_SPEC.md. Полная установка
и ограничения описаны в README.md. На момент первоначального отчёта commits
и push не выполнялись; последующая техническая фиксация описана ниже.

## Финальная техническая фиксация PHASE 1 — 24–25 сентября 2026

Git уже был инициализирован: ветка `main`, без commits. Повторный `git init`
не требовался. Логика приложения, package.json и lockfile при этой фиксации
не изменялись. Дополнен этот отчёт и убраны лишние пустые строки в конце
четырёх файлов app, найденные проверкой `git diff --cached --check`.

### Повторная проверка ESLint 10

Проверены реальные версии и peerDependencies из установленного дерева и
package-lock.json, а не только разрешение ESLint в верхнеуровневом config.

| Пакет | Версия | Совместимость с ESLint 10 по peerDependencies |
| --- | --- | --- |
| Next.js | 16.3.6 | Сам Next.js не задаёт peer dependency на ESLint; lint запускается отдельно |
| eslint-config-next | 16.3.6 | Допускает: `eslint >=9.0.0`, но включает ограничивающие плагины ниже |
| eslint-plugin-react | 7.37.5 | Не допускает: `^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8 \|\| ^9.7` |
| eslint-plugin-import | 2.32.0 | Не допускает: `^2 \|\| ^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7.2.0 \|\| ^8 \|\| ^9` |
| eslint-plugin-jsx-a11y | 6.10.2 | Не допускает: `^3 \|\| ^4 \|\| ^5 \|\| ^6 \|\| ^7 \|\| ^8 \|\| ^9` |
| eslint-plugin-react-hooks | 7.1.1 | Допускает `^10.0.0` |
| typescript-eslint, @typescript-eslint/parser, @typescript-eslint/eslint-plugin | 8.70.1 | Допускают `^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`; TypeScript `>=4.8.4 <6.1.0` |

TypeScript 6.0.3 входит в поддерживаемый диапазон. Полная связка с ESLint 10
не поддерживается из-за трёх JSX/import плагинов. Поэтому сохранён ESLint
9.39.5. Обновление с конфликтующими peers не выполнялось; `--force`,
`--legacy-peer-deps`, overrides для ESLint и отключение правил не применялись.
Upstream deprecation ESLint 9 остаётся известным ограничением; переходить
на 10 следует после совместимого обновления всех используемых плагинов.

Дополнительные официальные источники:
[typescript-eslint: поддерживаемые версии](https://typescript-eslint.io/users/dependency-versions/),
[eslint-plugin-react: конфликт с ESLint 10](https://github.com/jsx-eslint/eslint-plugin-react/issues/3984).

### Повторные проверки и границы

- `npm run typecheck` — PASS, exit code 0.
- `npm run lint` — PASS, exit code 0, без ошибок и предупреждений.
- `npm run build` — PASS, exit code 0, production build на Turbopack.
- `npm run db:validate` — PASS, exit code 0.
- `npm ls` для Next.js/ESLint/TypeScript tooling — PASS, invalid peers нет.
- `.gitignore` проверен: `.env*` (кроме пустого `.env.example`), Prisma Client,
  `.next`, node_modules, browser artifacts, logs и tsbuildinfo исключены.
- DATABASE_URL отсутствует в окружении; из env-файлов есть только пустой
  шаблон `.env.example`. Подключение к БД и применение миграций не выполнялись.
- Перед локальной фиксацией staging проверен по списку путей и содержимому:
  credentials, ключи, tokens и временные/build artifacts не обнаружены.

Локальная фиксация PHASE 1: `chore: complete Narra phase 1 foundation`.
Commit включает этот отчёт; его идентификатор доступен через `git log -1`.
Push не выполняется. PHASE 2 не начата.

Пользователю остаётся указать DATABASE_URL своей development PostgreSQL-базы
в `.env`, выполнить `npm run db:deploy` и `npm run db:status`, затем дать
отдельную команду на PHASE 2.
