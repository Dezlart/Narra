# Narra

Платформа пользовательских статей с обязательной модерацией и публикацией
отдельных одобренных версий. Сейчас реализуется **PHASE 1 — Foundation**.
Полная спецификация: [PROJECT_SPEC.md](PROJECT_SPEC.md). Перед каждой новой
фазой сначала прочитайте этот файл.

## Что есть сейчас

- Next.js App Router, React, строгий TypeScript, Tailwind CSS 4.
- shadcn/ui (официальный CLI, Radix Nova, только Button), Lucide.
- Адаптивный интерфейс: обложка, демонстрационные карточки, переключение тем,
  блок «В фокусе», навигация, состояния загрузки, ошибки и 404.
- Prisma 7, PostgreSQL, единый ленивый серверный клиент, начальная SQL-миграция.
- Демоматериалы только в presentation layer. Нет API, авторизации, редактора,
  модерации или социальных функций. Демокарточки не открываются как статьи.

## Локальный запуск

Рекомендуется Node.js 24 LTS, npm 11. Используйте npm и существующий lockfile.
В package.json явно разрешены install scripts конкретных версий Prisma CLI,
Prisma engines и unrs-resolver для npm 11. Глобальные настройки npm не нужны.

```sh
npm ci
npm run dev
```

Откройте [localhost:3000](http://localhost:3000). Для просмотра интерфейса база
не требуется. Шрифты Golos Text и Lora поставляются локально из npm; обращения
к Google Fonts при сборке и просмотре не нужны.

## Подключение базы

Создайте `.env` по `.env.example`:

```powershell
Copy-Item .env.example .env
```

Заполните `DATABASE_URL` строкой подключения к **своей отдельной development
PostgreSQL базе**. Настоящие credentials и `.env` никогда не коммитятся.
Требуется стандартный URL с протоколом `postgresql://` или `postgres://`.
Приложение не зависит от конкретного облачного PostgreSQL provider.

```sh
npm run db:deploy
npm run db:status
npm run db:generate
```

`db:deploy` применяет подготовленную начальную миграцию. При дальнейших
изменениях схемы создавайте новую: `npm run db:migrate -- --name <name>`.
Эта команда может требовать права на создание shadow database. Не используйте
`db push` вместо миграций. Начальную миграцию следует применять к пустой базе
Narra, а не к существующей базе другого проекта.

Prisma 7 читает URL из `prisma.config.ts`, а приложение передаёт его адаптеру
`@prisma/adapter-pg`. Дополнительные URL и будущие secrets сейчас не нужны.
Без URL генерация, проверка схемы и сборка работают; реальный доступ к базе
через `getPrisma()` выдаёт серверную ошибку без вывода credentials.
Миграции не запускаются автоматически при сборке или старте приложения.

## Структура

```text
src/app/                   страницы, layout, глобальные стили, состояния
src/components/layout/     header и footer
src/components/home/       исключительно визуальное демо и его данные
src/components/ui/         минимальные компоненты shadcn/ui
src/features/              место для будущих бизнес-модулей; пока только README
src/lib/                   Prisma helper и cn
src/types/                 общие типы навигации
src/generated/prisma/      генерируемый клиент; исключён из Git
prisma/schema.prisma       начальные модели и enums
prisma/migrations/         версия схемы в SQL
```

Application/domain/data-access модули добавляются вместе с соответствующими
функциями. Пустые сервисы, API и abstractions заранее не создаются.

## Модель данных

`User`, `Article`, `ArticleRevision`, `Category`, `Tag`, `ArticleRevisionTag`.
В `User` есть стандартные поля Better Auth, включая `emailVerified`, но нет
самой auth-интеграции, Account, Session или Verification. Уникальный `username`
пока nullable, чтобы не препятствовать стандартному signup; заполнение и
нормализация будут определены в PHASE 2.

`Article.revisions` — все версии. `Article.publishedRevision` — текущая публичная.
Составной FK `(Article.id, publishedRevisionId) → (ArticleRevision.articleId, id)`
исключает чужую revision. Nullable pointer позволяет сначала создать Article,
затем revision, затем опубликовать её: цикл не мешает созданию черновика.
Обратная связь `publishedBy` представлена массивом в Prisma, но составной FK
и уникальный `Article.id` допускают только одну соответствующую публикацию.
`(articleId, version)` уникален; `content` — PostgreSQL JSONB.

Категория, теги, заголовок, обложка и текст принадлежат revision. Поэтому будущая
правка категории/тегов тоже не изменит публичный контент до approval.
Draft может ещё не иметь slug и категории. Обязательность полей при отправке
будет проверяться серверным сервисом в PHASE 3–4.

Статусы Article: `DRAFT`, `PUBLISHED`, `ARCHIVED`; статусы revision:
`DRAFT`, `PENDING`, `APPROVED`, `REJECTED`. Состояние модерации не дублируется
в Article: опубликованная статья остаётся `PUBLISHED`, пока новая версия ожидает
проверки. SQL CHECKs запрещают неположительную version, пустую причину rejection
и неполный набор полей публикации. Эти CHECKs хранятся в миграции: Prisma DSL
не описывает их. Сохраняйте их в следующих миграциях.

FK **не проверяет** статус `APPROVED`, роль или неизменяемость содержимого.
Эти правила, транзакционный approval и ограничения редактирования должны быть
реализованы в PHASE 3–4 до появления любых пользовательских mutations.
Авторизация всегда серверная; клиент не сможет задавать role/status/reviewer.
Удаление author/reviewer/category/tag ограничено FK; для удаления Article
сначала очистите public pointer (с переводом статуса), затем удалите Article
в одной транзакции. В интерфейсе удаления сейчас нет.

## Design system

Токены в `src/app/globals.css`: тёплый светлый фон, угольный текст,
терракотовый акцент, нейтральные границы, небольшие радиусы. Golos Text для UI,
Lora для редакционных заголовков. Контейнер 1232 px, будущая область чтения
736 px (`max-w-reading`), адаптивные отступы и spacing-шкала Tailwind.
Собственные SVG-иллюстрации декоративные и не зависят от внешних сервисов.
Поддерживаются keyboard focus, skip-link, reduced motion, семантическая
навигация и пустое состояние тем.

## Проверки

```sh
npm run typecheck
npm run lint
npm run build
npm run db:validate
```

`postinstall`, `typecheck` и `build` генерируют Prisma Client. Typecheck сначала
генерирует типы Next.js, поэтому работает на чистом checkout. ESLint вызывается
отдельно: Next.js build его не заменяет. Постоянная Vitest/Playwright
инфраструктура и тесты бизнес-сценариев запланированы на следующие фазы.

## Совместимость зависимостей

Выбран Prisma 7.10.0: `prisma@latest` на момент создания указывает на Prisma 8 RC
с другой архитектурой CLI. Next.js 16.3.6 и React 19.3.0 — stable.
TypeScript ограничен веткой 6.0, ESLint — 9: текущие транзитивные плагины
`eslint-config-next` не поддерживают TypeScript 7 / ESLint 10. ESLint 9 уже
помечен upstream как unsupported; обновите его, как только Next.js обновит
peer ranges своих плагинов. Проверки не отключены и peer conflicts не подавлены.

Для устранения обнаруженных npm audit advisories добавлены точечные overrides
только в Prisma CLI: `@prisma/config → deepmerge-ts 8.0.2` и
`prisma → mysql2 3.24.4`. Наш config содержит обычные объекты, без Map и
custom merge callbacks, затронутых изменениями deepmerge-ts 8. PostgreSQL
приложения использует `pg`, не MySQL. При обновлении Prisma пересмотрите overrides.

## Следующая фаза

Только после отдельной команды: Better Auth, генерация актуальных auth-моделей,
регистрация/вход/выход, сессии, onboarding профиля и серверные RBAC guards.
