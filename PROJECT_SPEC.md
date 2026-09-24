# Narra

> Текущий этап: PHASE 1 — Foundation. Последующие фазы требуют отдельной команды.
> Перед началом каждой новой фазы читать этот файл целиком. Решения реализации
> ниже уточняют концептуальные модели исходной спецификации, не расширяя scope.

## Принятые решения PHASE 1 (24 сентября 2026)

- Модульный монолит Next.js App Router; Server Components по умолчанию.
  Клиентская интерактивность только у переключателя демонстрационных тем и
  error boundary. Application/services/data-access появятся по мере реализации
  бизнес-функций. `features/README.md` фиксирует эту границу.
- Next.js 16.3.6, React 19.3.0, Tailwind 4.3.3. TypeScript 6.0.3 и ESLint 9.39.5
  выбраны по поддерживаемым peer ranges плагинов `eslint-config-next`: они пока
  несовместимы с TypeScript 7 и ESLint 10. ESLint 9 уже помечен unsupported;
  обновить после совместимого обновления плагинов Next.js. Не отключать проверки.
- shadcn/ui настроен официальным CLI 4.21.0, preset Radix Nova; добавлен только
  Button. Размеры адаптированы для Narra. Tailwind 4 использует CSS-first tokens,
  PostCSS plugin и пустое поле tailwind.config в components.json.
- Prisma ORM **7.10.0**, стабильная ветка: текущий `prisma@latest` — **8 RC** с
  другим CLI. Для Foundation использовать одинаковые версии Prisma CLI,
  `@prisma/client` и `@prisma/adapter-pg`, не устанавливать Prisma 8 RC.
- Datasource provider остаётся `postgresql` в schema.prisma; DATABASE_URL
  находится в `prisma.config.ts`, как требует Prisma 7. Клиент генерируется
  генератором `prisma-client` в `src/generated/prisma` и получает `PrismaPg`.
  `getPrisma()` — ленивый server-only singleton с globalThis-cache в development.
  Нет вымышленных credentials и fallback URL. UI/build/validate/generate
  не требуют работающей БД. Для запросов и migrations нужен DATABASE_URL.
- User сохраняет обязательные Better Auth поля id/name/email/emailVerified/
  image/createdAt/updatedAt. Уникальный username пока nullable: его заполнение
  и нормализацию определить при onboarding в PHASE 2. Роли и isBanned имеют
  безопасные defaults. Auth-модели и сама интеграция сейчас отсутствуют.
- Article содержит стабильную идентичность, author, slug, publication status,
  timestamps и publishedRevisionId. Slug nullable для нового черновика.
  ArticleStatus: DRAFT/PUBLISHED/ARCHIVED. PENDING и REJECTED существуют только
  у ArticleRevision, чтобы не скрывать текущую публикацию при проверке правок.
- ArticleRevision хранит весь изменяемый публичный контент, включая **category
  и tags**. CategoryId nullable в draft. Join table — ArticleRevisionTag,
  ключ `(revisionId, tagId)`. Это уточнение исходной концептуальной модели
  Article.categoryId/Article.tags предотвращает обход модерации через метаданные.
- Именованные связи: ArticleAuthor, ArticleRevisions, PublishedRevision,
  RevisionReviewer. Публикация использует составной FK
  `(Article.id, publishedRevisionId) → (ArticleRevision.articleId, id)`.
  Он запрещает указатель на чужую revision. Обратное publishedBy — массив
  в Prisma; фактически максимум одна Article благодаря PK Article.id.
  Уникальные `(articleId, version)` и `(articleId, id)` обеспечивают версии
  и составной FK соответственно. Nullable pointer снимает проблему начальной
  циклической вставки. SQL сначала создаёт таблицы, затем добавляет FK.
- Первая миграция генерируется через `prisma migrate diff --from-empty` без БД.
  В ней дополнительно находятся CHECK constraints для положительной version,
  непустой rejectionReason при REJECTED, обязательных pointer/slug/publishedAt
  при PUBLISHED и отсутствия public pointer у DRAFT. Prisma DSL не описывает
  эти CHECKs: сохранять их в будущих миграциях. FK не доказывает APPROVED или
  наличие permissions: эти проверки, immutable approved revisions и атомарная
  замена pointer будут реализованы серверными сервисами PHASE 3–4.
- Delete policy: ArticleRevisions и revision tags каскадные; удаление автора,
  reviewer, категории и тега ограничено. При явном удалении Article сначала
  очистить published pointer и изменить статус, затем удалить сущность
  в транзакции. Сейчас mutations и функции удаления отсутствуют.
- UI: тёплый фон #faf9f6, текст #232722, терракота #b8492e; Golos Text и Lora
  поставляются локально. Контейнер 1232px, область чтения 736px, малые радиусы,
  responsive spacing, доступный focus, reduced motion. Иллюстрации — собственные
  SVG. Демоданные находятся только в components/home/demo-content.ts; это
  визуальный образец, не публичная лента PHASE 5 и не mock backend.
- npm audit потребовал точечных overrides в dev tooling Prisma:
  `@prisma/config → deepmerge-ts 8.0.2`, `prisma → mysql2 3.24.4`.
  Config использует plain objects, не Map/custom merge callbacks, затронутые
  breaking changes deepmerge-ts 8. Проверять overrides при обновлении Prisma.
  npm install-script approvals ограничены конкретными версиями Prisma engines,
  Prisma CLI и unrs-resolver; глобальные настройки npm не изменены.

Официальные источники, проверенные для PHASE 1:

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui для Next.js](https://ui.shadcn.com/docs/installation/next)
- [Prisma release status](https://www.prisma.io/docs/orm/release-status)
- [Better Auth Prisma adapter](https://better-auth.com/docs/adapters/prisma)
- [Better Auth User schema](https://better-auth.com/docs/concepts/database)

---

Narra — full-stack платформа публикации пользовательских статей.

Основная идея:

пользователи регистрируются, создают статьи, сохраняют черновики и отправляют материалы на обязательную модерацию.

После одобрения статьи становятся публичными.

Платформа также должна поддерживать социальные функции, персональную ленту, уведомления, аналитику автора и административную панель.

## Основная функциональность конечной версии

* регистрация;
* авторизация;
* пользовательские профили;
* роли;
* создание статей;
* rich-text редактор;
* черновики;
* autosave;
* изображения;
* обязательная модерация;
* revision-based публикация;
* категории;
* теги;
* публичная лента;
* поиск;
* комментарии;
* лайки;
* закладки;
* подписки на авторов;
* персональная лента;
* уведомления;
* жалобы;
* статистика авторов;
* административная панель.

---

# Technology stack

Используем:

* TypeScript
* Next.js
* App Router
* React
* Tailwind CSS
* shadcn/ui
* Lucide Icons
* PostgreSQL
* Prisma ORM
* Better Auth
* Tiptap
* Zod
* Vercel Blob
* Resend
* Vitest
* Playwright
* Vercel

Используй актуальные stable-версии библиотек.

Перед добавлением крупных зависимостей проверяй актуальную официальную документацию и совместимость библиотек.

Особенно внимательно проверяй совместимость:

* Next.js;
* Prisma;
* Better Auth;
* Prisma adapter Better Auth;
* Tiptap;
* Vercel Blob.

Не используй устаревшие API только потому, что они встречаются в старых примерах или статьях.

Не фиксируй произвольные старые версии без причины.

Если существующий repository уже использует package manager, продолжай использовать его.

Если package manager ещё не выбран, используй npm.

---

# Architecture

Используем архитектуру:

**modular monolith**

Отдельный Fastify, Express или другой backend создавать НЕ нужно.

Backend-функциональность реализуется внутри Next.js.

Архитектурно разделяй приложение на:

1. Presentation Layer
2. Application Layer
3. Domain / Services Layer
4. Data Access
5. Infrastructure

## Presentation

Next.js pages/layouts
React components
Tailwind
shadcn/ui

## Application

Server Actions
Route Handlers

## Domain / Services

Бизнес-правила приложения.

Например:

* отправка статьи на модерацию;
* одобрение revision;
* проверка permissions;
* подписка на автора;
* создание notification.

## Data Access

Prisma + PostgreSQL.

## Infrastructure

Better Auth
Vercel Blob
Resend
external integrations.

---

# Server Components

Используй Server Components по умолчанию.

`"use client"` используй только там, где действительно необходимы:

* browser APIs;
* React state;
* event handlers;
* interactive UI;
* Tiptap;
* клиентские формы, где это оправдано.

Не превращай всё приложение в Client Components.

---

# Business logic

Сложная бизнес-логика не должна находиться непосредственно внутри React-компонентов или огромных `page.tsx`.

Например, не должно быть компонентов на сотни строк, содержащих одновременно:

* Prisma queries;
* authorization;
* moderation logic;
* notification creation;
* rendering UI.

Выноси такую функциональность в соответствующие feature/services modules.

---

# Project structure

Используй структуру примерно такого типа:

```text
src/
├── app/
├── components/
├── features/
├── lib/
├── types/
└── generated/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

tests/
```

Не создавай десятки пустых директорий заранее.

Создавай подпапки только тогда, когда они реально начинают использоваться.

Планируемые feature modules:

```text
features/
├── auth/
├── articles/
├── moderation/
├── comments/
├── likes/
├── bookmarks/
├── follows/
├── notifications/
├── analytics/
├── reports/
└── admin/
```

Когда feature небольшой, структура должна оставаться простой.

Например:

```text
features/
└── likes/
    ├── actions.ts
    └── service.ts
```

Когда feature разрастается, можно добавить:

```text
components/
actions/
queries/
schemas/
services/
```

Не создавай enterprise abstractions ради самих abstractions.

Главная цель:

понятный и поддерживаемый код, в котором другой разработчик сможет быстро разобраться.

---

# Naming

Используй понятные названия функций.

Предпочитай:

```text
submitArticleForModeration
approveArticleRevision
getPublishedArticleBySlug
createNotification
followUser
```

вместо:

```text
handleData
processItem
updateStuff
doAction
```

Код должен быть понятен без постоянного изучения внутренней реализации каждой функции.

---

# Users

Конечная модель предусматривает роли:

```text
USER
MODERATOR
ADMIN
```

Пользователь должен поддерживать как минимум:

```text
id
name
username
email
image
bio
role
isBanned
createdAt
updatedAt
```

`username` уникален.

Авторизация будет реализована через Better Auth в PHASE 2.

Не реализовывай Better Auth сейчас.

При проектировании Prisma schema учитывай, что Better Auth позднее добавит свои необходимые модели:

* Account;
* Session;
* Verification;
* и другие сущности, которые требуются актуальной версией Better Auth.

Не придумывай несовместимую auth schema заранее.

---

# Article architecture

Критически важное архитектурное решение Narra:

НЕ хранить опубликованную статью как одну постоянно перезаписываемую запись.

Использовать:

```text
Article
ArticleRevision
```

`Article` представляет публикацию как сущность.

`ArticleRevision` представляет конкретную версию содержимого статьи.

Пример:

```text
Article
│
├── Revision 1 → APPROVED ← сейчас показывается читателям
│
├── Revision 2 → REJECTED
│
└── Revision 3 → PENDING
```

Пока Revision 3 проходит модерацию, публично продолжает отображаться Revision 1.

После approval новая revision становится опубликованной версией.

Article должен иметь ссылку на опубликованную revision через:

```text
publishedRevisionId
```

или архитектурно эквивалентное решение.

Отношения Prisma должны быть спроектированы корректно и не создавать проблем с циклическими relations.

---

# Article

Концептуально Article должен поддерживать:

```text
id
authorId
categoryId
slug
status
publishedRevisionId
createdAt
updatedAt
publishedAt
```

Допускается адаптация структуры, если она улучшает целостность модели.

---

# ArticleRevision

Концептуально ArticleRevision должен поддерживать:

```text
id
articleId

title
excerpt
content
coverImage

version
status

rejectionReason

submittedAt
reviewedAt
reviewedById

createdAt
updatedAt
```

Контент Tiptap предпочтительно хранить как JSON.

Не хранить непроверенный пользовательский HTML как основной источник данных.

---

# Article statuses

Продумай ясную state machine.

Например:

```text
DRAFT
PENDING
PUBLISHED
REJECTED
ARCHIVED
```

для Article, если такие состояния действительно нужны.

Для ArticleRevision:

```text
DRAFT
PENDING
APPROVED
REJECTED
```

или близкая корректная архитектура.

Главное правило:

обычный USER никогда не может сам установить:

```text
APPROVED
PUBLISHED
```

Одобрение выполняет:

```text
MODERATOR
ADMIN
```

---

# Moderation workflow

Narra использует обязательную модерацию.

Типичный workflow:

```text
DRAFT
   ↓
PENDING
   ↓
APPROVED
```

или:

```text
DRAFT
   ↓
PENDING
   ↓
REJECTED
   ↓
редактирование
   ↓
PENDING
```

При rejection обязательно должен существовать:

```text
rejectionReason
```

Если пользователь редактирует уже опубликованную статью:

1. текущая approved revision остаётся публичной;
2. создаётся новая revision;
3. новая revision отправляется на модерацию;
4. только после approval она заменяет текущую публичную revision.

Это важное security/business правило.

---

# Categories and tags

Конечная версия поддерживает:

```text
Category
Tag
```

Article имеет одну основную Category.

Article может иметь несколько Tags.

Category должна иметь как минимум:

```text
name
slug
```

При необходимости:

```text
description
```

Администратор позднее сможет управлять категориями.

---

# Social features

В конечной версии предусмотрены:

```text
Comment
Like
Bookmark
Follow
Notification
Report
ArticleView
```

Для действий, которые пользователь может выполнить только один раз, использовать database-level constraints.

Например:

```text
Like:
unique(userId, articleId)

Bookmark:
unique(userId, articleId)

Follow:
unique(followerId, followingId)
```

Пользователь не может подписаться сам на себя.

---

# Comments

Конечная версия должна поддерживать:

* создание комментария;
* ответы;
* удаление своего комментария;
* moderation delete/hide;
* timestamps.

Для комментариев с ответами предпочтительно использовать soft-delete вместо разрушения всей цепочки.

---

# Notifications

Планируемые типы уведомлений:

```text
ARTICLE_APPROVED
ARTICLE_REJECTED
NEW_FOLLOWER
ARTICLE_COMMENT
COMMENT_REPLY
FOLLOWED_AUTHOR_PUBLISHED
```

Notifications должны храниться в PostgreSQL.

Поддерживать:

```text
recipient
actor
type
related article/comment
createdAt
readAt
```

WebSocket для первой версии не требуется.

---

# Personalized feed

Маршрут:

```text
/following
```

Показывает опубликованные статьи авторов, на которых подписан текущий пользователь.

Логика:

```text
get followed authors
→
get their published articles
→
ORDER BY publishedAt DESC
```

Не добавлять ML recommendations.

---

# Search

Создай отдельный search service.

Первая рабочая реализация позже может искать по:

* названию;
* excerpt;
* author name;
* author username.

UI не должен зависеть от конкретного поискового алгоритма.

В будущем реализацию можно заменить на PostgreSQL Full Text Search без переписывания интерфейса.

---

# Article views

Конечная версия должна считать просмотры статей.

Не увеличивай view count бесконечно при каждом refresh одного пользователя.

Используй разумную временную дедупликацию.

Не сохраняй raw IP без необходимости.

Если используется hash visitor/session identifier, он должен использоваться только для ограниченной anti-refresh логики, а не для постоянного скрытого tracking.

---

# Author analytics

Dashboard автора должен показывать:

```text
total views
total likes
total comments
followers
```

Также таблицу опубликованных статей:

```text
Article
Views
Likes
Comments
```

Не создавать сложную BI-систему.

---

# Reports

Авторизованный пользователь в конечной версии может пожаловаться минимум на:

```text
ARTICLE
COMMENT
```

Report должен хранить:

```text
reporter
target
reason
description
status
createdAt
resolvedAt
resolvedBy
```

---

# Admin

Административная панель:

```text
/admin
```

Доступ:

```text
MODERATOR
ADMIN
```

Permissions всегда проверяются на сервере.

Нельзя считать доступ защищённым только потому, что UI скрывает ссылку.

Планируемые разделы:

```text
Dashboard
Moderation
Articles
Users
Comments
Reports
Categories
```

ADMIN имеет полный доступ.

MODERATOR имеет ограниченный доступ к moderation-функциям.

---

# Public routes

Планируемые маршруты:

```text
/

/articles/[slug]

/categories/[slug]

/search

/following

/profile/[username]

/login
/register

/dashboard
/dashboard/articles
/dashboard/bookmarks
/dashboard/following
/dashboard/notifications
/dashboard/settings

/editor/new
/editor/[id]

/admin
```

---

# Design direction

Название продукта:

**Narra**

Не копировать дизайн vc.ru.

Дизайн должен сочетать:

```text
modern technology media
+
editorial reading experience
```

Главная страница более насыщенная:

* header;
* categories;
* featured publication;
* feed;
* popular content;
* interesting authors.

Страница статьи более спокойная и ориентированная на чтение.

На desktop ширина основного текста статьи должна быть примерно:

```text
700–760px
```

Design principles:

```text
clean
modern
editorial
strong typography
clear hierarchy
responsive
good whitespace
```

Избегать:

* чрезмерного glassmorphism;
* бессмысленных gradients;
* визуального ощущения AI-generated landing page;
* большого количества одинаковых rounded cards;
* лишних декоративных элементов.

Создать единый design system:

* typography;
* spacing;
* border radius;
* buttons;
* inputs;
* cards;
* colors;
* loading states;
* empty states;
* error states.

UI должен выглядеть как настоящий современный продукт, а не как шаблонная demo-page.

---

# Editor

В PHASE 3 будет реализован Tiptap editor.

Он должен поддерживать:

* paragraph;
* H1/H2/H3;
* bold;
* italic;
* links;
* blockquote;
* unordered list;
* ordered list;
* code block;
* images;
* undo/redo.

Также:

```text
title
excerpt
category
tags
cover
content
```

Autosave:

```text
user typing
↓
debounce
↓
save draft
```

Показывать:

```text
Saving...
Saved
Save error
```

Основной draft хранится в PostgreSQL.

Не использовать localStorage как основной storage статьи.

---

# Images

Для изображений использовать:

```text
Vercel Blob
```

или актуальную рекомендованную Vercel интеграцию, если API изменился.

Будущие типы:

* avatar;
* article cover;
* images inside article.

Проверять на сервере:

* MIME;
* size;
* allowed formats.

Не доверять только client-side validation.

Не хранить uploads в локальной файловой системе Vercel deployment.

---

# Security

На всех этапах учитывать:

* server-side authorization;
* Zod validation;
* safe Prisma queries;
* safe user-content rendering;
* safe uploads;
* role checks;
* ownership checks.

Не использовать:

```text
dangerouslySetInnerHTML
```

для непроверенного пользовательского HTML.

Не логировать:

* passwords;
* auth tokens;
* session tokens;
* DB credentials;
* API secrets.

Не коммитить `.env`.

Создать:

```text
.env.example
```

---

# Error handling

В конечной версии должны быть:

* loading states;
* skeletons;
* empty states;
* not-found;
* user-friendly errors;
* form validation messages.

Не показывать пользователю raw stack traces.

Использовать возможности Next.js:

```text
error.tsx
loading.tsx
not-found.tsx
```

там, где это оправдано.

---

# Database

Использовать PostgreSQL через:

```text
DATABASE_URL
```

Архитектура не должна быть намертво привязана к одному PostgreSQL provider.

Для production deployment:

```text
Vercel
+
cloud PostgreSQL
+
Vercel Blob
+
Resend
```

Использовать Prisma migrations.

Не использовать:

```text
prisma db push
```

как постоянную замену миграциям production-проекта.

Добавлять indexes там, где они действительно нужны.

Например:

```text
slug
username
email
status
publishedAt
authorId
categoryId
notification recipient
```

Не создавать бессмысленные индексы.

---

# Testing

Позднее использовать:

```text
Vitest
Playwright
```

Основные бизнес-сценарии для тестирования:

1. registration/login;
2. create article;
3. save draft;
4. submit moderation;
5. moderator approve;
6. article becomes public;
7. user likes article;
8. user bookmarks article;
9. user comments;
10. user follows author;
11. article appears in Following feed;
12. published article edit creates new revision;
13. old revision stays public until approval.

---

# Critical acceptance scenario

Конечная версия Narra считается функциональной только если реально работает сценарий:

```text
USER registers
↓
USER creates article
↓
draft stored in PostgreSQL
↓
USER submits article
↓
revision becomes PENDING
↓
USER cannot publish it himself
↓
MODERATOR sees it
↓
MODERATOR approves revision
↓
article becomes publicly available
↓
another USER opens it
↓
likes
↓
bookmarks
↓
comments
↓
follows author
↓
article appears in Following feed
```

После изменения опубликованной статьи:

```text
new revision created
↓
old approved revision remains public
↓
new revision goes to moderation
↓
moderator approves
↓
new revision becomes published
```

Никакие ключевые этапы этого flow не должны быть mock implementations.

---

# Performance

Не заниматься premature optimization.

Но:

* избегать очевидных N+1 queries;
* использовать pagination для длинных списков;
* не загружать сотни статей сразу;
* использовать Next.js caching/revalidation осознанно;
* правильно обновлять данные после mutations.

---

# Maintainability

Проект должен быть удобен для дальнейшей поддержки другим разработчиком.

Поэтому:

* понятная структура;
* понятные названия;
* разделение responsibilities;
* не дублировать бизнес-логику;
* не создавать giant components;
* не размазывать Prisma queries хаотично по UI;
* писать код, который можно менять локально без переписывания всего приложения.

Например, замена в будущем:

```text
Vercel Blob → S3
```

не должна требовать переписывания компонентов страниц.

А замена data-access implementation не должна требовать полного переписывания UI.

---

# Development phases

Проект разрабатывается последовательно.

## PHASE 1

Foundation:

* Next.js;
* App Router;
* TypeScript;
* Tailwind;
* shadcn/ui;
* Lucide Icons;
* project structure;
* base design system;
* Prisma;
* PostgreSQL configuration;
* initial data model foundation;
* environment configuration;
* base responsive application layout.

## PHASE 2

Authentication:

* Better Auth;
* registration;
* login;
* logout;
* sessions;
* profiles;
* RBAC;
* USER/MODERATOR/ADMIN;
* server-side auth guards.

## PHASE 3

Articles:

* Article;
* ArticleRevision;
* Tiptap editor;
* drafts;
* autosave;
* images;
* editing.

## PHASE 4

Moderation:

* submit;
* pending queue;
* approve;
* reject;
* rejection reason;
* revision publishing workflow.

## PHASE 5

Public content:

* homepage feed;
* article pages;
* profiles;
* categories;
* tags;
* search.

## PHASE 6

Social features:

* likes;
* bookmarks;
* comments;
* replies;
* follows.

## PHASE 7

Personalization:

* Following feed;
* notifications.

## PHASE 8

Administration:

* reports;
* admin dashboard;
* users;
* moderation management;
* analytics.

## PHASE 9

Quality:

* Vitest;
* Playwright;
* responsive polish;
* accessibility;
* loading states;
* errors;
* empty states.

## PHASE 10

Production preparation:

* final QA;
* README;
* environment documentation;
* deployment instructions;
* Vercel preparation.

---

# CURRENT TASK

Сейчас работаем **ТОЛЬКО НАД PHASE 1**.

НЕ начинай:

* Better Auth;
* регистрацию;
* login;
* sessions;
* полноценные profiles;
* article editor;
* Tiptap;
* moderation;
* likes;
* comments;
* bookmarks;
* follows;
* notifications;
* reports;
* admin functionality.

Но учитывай будущие фазы при проектировании foundation.

---

# PHASE 1 — конкретные задачи

## Next.js foundation

Настрой или проверь:

* Next.js;
* App Router;
* TypeScript;
* Tailwind CSS.

Используй современную рекомендуемую структуру Next.js.

---

# shadcn/ui

Настрой shadcn/ui корректным официальным способом для текущей версии Next.js/Tailwind.

Не добавляй десятки компонентов заранее.

Установи только минимально необходимые компоненты для текущего foundation UI.

---

# Icons

Добавь Lucide Icons.

---

# Project structure

Создай необходимые директории:

```text
src/app
src/components
src/features
src/lib
src/types
```

Дополнительные директории создавай только если они действительно нужны.

Не создавай десятки пустых папок.

---

# Narra base UI

Создай базовый application shell Narra.

Минимально:

* header;
* logo/text logo Narra;
* navigation;
* main content container;
* responsive layout;
* base footer, если он вписывается в дизайн.

Создай первоначальную главную страницу для проверки design system.

Пока допускаются локальные demo-data исключительно для визуального отображения карточек публикаций.

Это НЕ mock backend.

Не создавай fake API.

Demo data должны быть отделены от будущей бизнес-логики и легко удаляться после появления базы.

---

# Narra visual direction

Главная страница должна уже задавать будущий стиль проекта:

modern tech media + editorial.

Можно создать:

* header;
* category navigation;
* featured story;
* несколько demo article cards;
* popular section.

Не пытайся реализовать весь конечный интерфейс.

Главная задача PHASE 1 — foundation и design language.

---

# Design system

Настрой базовые tokens/styles для:

* typography;
* container widths;
* spacing;
* radius;
* borders;
* foreground/background;
* muted text;
* buttons;
* cards.

Интерфейс должен хорошо выглядеть:

* desktop;
* tablet;
* mobile.

Не добавляй excessive gradients или glassmorphism.

---

# Prisma

Добавь Prisma актуальным рекомендованным способом.

Настрой PostgreSQL datasource через:

```text
DATABASE_URL
```

Создай:

```text
.env.example
```

Не записывай реальные credentials.

Убедись, что:

```text
.env
```

не попадёт в Git.

---

# Initial Prisma schema

На PHASE 1 создай foundation схемы базы данных с учётом будущего проекта.

Минимально рассмотрим:

```text
User
Article
ArticleRevision
Category
Tag
```

и необходимые enums.

Можно также заложить join table для Article/Tag, если это соответствует выбранной Prisma-модели.

Не обязательно создавать ВСЕ будущие модели:

```text
Comment
Like
Bookmark
Follow
Notification
Report
ArticleView
```

если они пока не нужны.

Но не принимай решения, которые усложнят их нормальное добавление позже.

---

# Article ↔ ArticleRevision relation

Очень внимательно спроектируй отношения:

```text
Article
ArticleRevision
publishedRevision
```

Нужно избежать неоднозначных Prisma relations.

У Article должен существовать способ определить текущую публичную revision.

При этом revision принадлежит Article.

Если `publishedRevisionId` optional на ранних стадиях жизни статьи — это нормально.

Проверь relation names и foreign keys.

---

# User model

Создай базовую User-модель с учётом будущего Better Auth.

Но НЕ придумывай несовместимые auth модели.

Перед созданием User schema проверь актуальные требования Better Auth Prisma adapter, чтобы не пришлось полностью переделывать User в PHASE 2.

Если Better Auth требует определённые стандартные поля пользователя, учти их уже сейчас.

---

# Prisma enums

Добавь минимально необходимые enums для:

* UserRole;
* ArticleStatus;
* ArticleRevisionStatus.

Не создавай enums, которые пока не нужны.

---

# Database provider independence

Работа с PostgreSQL должна идти через:

```text
DATABASE_URL
```

Не привязывай application code жёстко к:

* Neon;
* Supabase;
* Prisma Postgres;
* Railway;
* конкретному provider.

Позднее мы выберем production PostgreSQL provider отдельно.

---

# Prisma client

Организуй единый Prisma client helper.

Не создавай новый PrismaClient при каждом запросе.

Учитывай Next.js development hot reload.

Используй актуальный рекомендованный Prisma pattern.

---

# Environment

Создай `.env.example`.

Минимально сейчас:

```text
DATABASE_URL=
```

Если текущая версия Prisma требует дополнительные database URLs или configuration, используй актуальный официальный подход и объясни это в отчёте.

Не добавляй будущие secrets без необходимости.

---

# README

Если README отсутствует или представляет стандартный create-next-app template, обнови его минимально.

Укажи:

* проект называется Narra;
* назначение;
* текущий stack;
* local development;
* environment setup;
* current development phase.

Не нужно сейчас писать финальную production-документацию — она будет расширяться дальше.

---

# Documentation

После завершения PHASE 1 убедись, что:

```text
PROJECT_SPEC.md
```

содержит текущую спецификацию.

Если в ходе реализации пришлось изменить какое-либо архитектурное решение из-за актуального API библиотеки:

1. используй корректную современную реализацию;
2. обнови соответствующий раздел `PROJECT_SPEC.md`;
3. объясни изменение в итоговом отчёте.

---

# Code quality

Не используй `any`, если нормальный тип можно определить.

Не подавляй ошибки через:

```text
@ts-ignore
eslint-disable
```

без действительно веской причины.

Не отключай TypeScript strictness ради удобства.

Не создавай fake backend.

Не создавай JSON database.

Не создавай functionality последующих phases.

Не переусложняй foundation.

---

# Verification

После завершения PHASE 1 выполни доступные проверки.

Минимально:

```text
typecheck
lint
production build
```

Если package scripts называются иначе — используй реальные scripts проекта.

Проверь Prisma schema.

Если DATABASE_URL и PostgreSQL instance доступны — проверь database connection и migration.

Если DATABASE_URL отсутствует:

* не придумывай credentials;
* не подключай случайную внешнюю базу;
* не блокируй остальную работу;
* сообщи, какую команду нужно выполнить после предоставления DATABASE_URL.

Не используй production credentials.

---

# Git

Не делай destructive Git operations.

Не удаляй пользовательские изменения.

Не выполняй force reset.

Не коммить secrets.

Можно подготовить изменения, но не делай push без отдельной команды пользователя.

---

# FINAL REPORT

После завершения PHASE 1 дай структурированный отчёт:

1. Какое состояние repository было изначально.
2. Что было создано.
3. Какие файлы были изменены.
4. Какие зависимости добавлены.
5. Как организована структура проекта.
6. Как устроен initial design system.
7. Как выглядит initial Prisma schema.
8. Как реализованы Article и ArticleRevision relations.
9. Какие environment variables нужны.
10. Какие проверки были выполнены.
11. Результат typecheck.
12. Результат lint.
13. Результат production build.
14. Результат Prisma validation.
15. Что не удалось проверить из-за отсутствия credentials.
16. Какие действия требуются от меня вручную.
17. Какие архитектурные решения пришлось скорректировать относительно PROJECT_SPEC.md и почему.
18. Кратко опиши, что будет следующим шагом PHASE 2.

После отчёта ОСТАНОВИСЬ.

**Не начинай PHASE 2 без моей отдельной команды.**
