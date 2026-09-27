# NARRA — PHASE 5: Public Content & Discovery

Дата: 27 сентября 2026. Реализована только PHASE 5; PHASE 6 не начата.

Исходное состояние Git: существующий repository, ветка main, чистое рабочее
дерево, HEAD `3f9cb54 phase 4 ready`. PHASE 4 уже была зафиксирована пользователем.
Изменения PHASE 5 оставлены в working tree для review. Commit, staging и push
не выполняются. Новых зависимостей нет; package-lock.json не изменён.
Финальный аудит 128 Git-visible файлов: значения реальных env secrets и private
keys не найдены; staging пуст; git diff --check проходит. .env, generated Prisma,
build и browser artifacts игнорируются. Старые отчёты и миграции не изменены.
Временный production server и QA tunnel остановлены; порты 3000 и 15432 свободны.

## 1. Что реализовано

Публичный сервис чтения и поиска на настоящей PostgreSQL. Главная больше не
импортирует демонстрационные истории. Общий модуль `src/features/public-content`
содержит queries, фильтры, карточки/пагинацию, metadata, sitemap и image access.
Архитектура modular monolith и Server Components сохранена. Небольшой client
ContentImage отвечает только за состояние ошибки загрузки изображения.

## 2. Маршруты

Добавлены `/articles/[slug]`, `/categories`, `/categories/[slug]`, `/tags/[slug]`,
`/search`, `/api/public/articles/[articleId]/images/[imageId]`, `/sitemap.xml`,
`/robots.txt`. Обновлены `/` и существующий `/profile/[username]`.
Header содержит работающие Главная/Категории/Поиск и прежнее меню аккаунта.
Поиск доступен и в мобильном меню. Guest login/register сохранены.

## 3. Публичная лента

Данные из PostgreSQL через общий query service. На первой странице самая свежая
публикация выделена и исключена из следующей сетки, но входит в общий лимит 12.
Реальные категории, даты и авторы; нет выдуманных просмотров, лайков, популярности
или демонстрационных статей. Если публикаций нет, показывается empty state.
Golos Text, Lora, терракота и прежняя светлая дизайн-система сохранены.

## 4. ArticleCard

Переиспользуется лентой, профилем, поиском, каталогами и related section.
Обложка необязательна: без неё — явно графическая заглушка «История в словах».
Есть категория, title, excerpt, автор, дата и приблизительное время чтения.
Заголовок ведёт на статью, автор и категория — на свои страницы.
Карточки не выбирают полный Tiptap JSON, email, review metadata или storage path.
Время чтения сохранено в approved revision: 200 слов в минуту, минимум одна.

## 5. Страница статьи

Заголовок, excerpt, категория, автор/аватар-инициалы, дата, время чтения,
обложка, форматированный текст, кликабельные теги и повторный блок автора.
До трёх других опубликованных историй из текущей категории. Основной текст
ограничен 736 px; длинные ссылки переносятся, код прокручивается внутри pre.
Missing, никогда не опубликованная и архивированная Article дают одинаковый 404.
Лайков, комментариев, закладок и неработающих социальных кнопок нет.

## 6. Tiptap renderer

Используется общий `features/articles/rich-text.tsx` из PHASE 3–4. Он повторно
проверяет JSON существующим whitelist validator и создаёт React elements.
Paragraphs, H1–H3, bold/italic, safe links, цитаты, списки, code blocks и images
сохранены. HTML injection не применяется; произвольные атрибуты/опасные схемы
не проходят validation. Внешние ссылки имеют noopener/noreferrer/nofollow.
Публичный image mapper принимает только прежний внутренний формат image source.

## 7. Видимость publishedRevision

Единый `publicArticleWhere`: Article.status=PUBLISHED, ненулевые slug,
publishedAt/publishedRevisionId, publishedRevision.status=APPROVED и автор
не заблокирован. Последнее условие согласовано с прежней политикой профилей.
Title/excerpt/content/cover/category/tags выбираются только из этой связи.
Последняя revision не используется. DRAFT/PENDING/REJECTED update сохраняет
старую публикацию; approval атомарно переключает указатель. Public queries
ничего не записывают. Ограничения принадлежности revision статье сохранены.

## 8. Профили

Существующий безопасный профиль сохранён и дополнен пагинацией публикаций.
Отображаются имя, username, bio, инициалы и дата регистрации. Публичный select
не содержит email/auth/role. Пустой автор имеет нормальное пустое состояние;
несуществующий/заблокированный профиль — 404. Upload аватаров не добавлялся.

## 9. Категории и теги

Категории читаются из существующего справочника, включая описание и пустые темы.
Неизвестная категория — 404. Категория и теги каждой статьи фильтруются по
publishedRevision. Приватное изменение не переносит статью в другой каталог.
Поскольку теги создаются авторами, тег без текущих публичных публикаций скрыт
(404), чтобы не раскрывать даже названия из черновиков. Второй системы тегов нет.

## 10. Поиск

Серверный Prisma/PostgreSQL contains, insensitive: approved title/excerpt,
имя и username автора. Параметризованные запросы, без конкатенации SQL.
Trim/сжатие пробелов, максимум 120 символов. Пустой запрос предлагает ввод;
слишком длинный объясняет ошибку без поиска; отсутствие совпадений — empty state.
%, _ и backslash экранируются для буквального поиска, а не LIKE wildcard.
Алгоритм изолирован от страницы; отдельный движок/ML не добавлен.

## 11. Пагинация

По 12 записей + одна для hasNext непосредственно в DB query. Сортировка
publishedAt DESC, id DESC обеспечивает определённый порядок при одинаковой дате.
Есть Назад/Далее, текущая страница; search сохраняет q. Некорректные значения
дают страницу 1, большие валидные ограничены 1000. Beyond-end — пустая страница
с переходом назад. N+1 запросов по карточкам и загрузки всех статей нет.

## 12. Публичная выдача private Blob

Отдельный GET endpoint проверяет ArticleImage.articleId, общую публичную
видимость и точную ссылку в cover/content текущей опубликованной revision.
Затем сервер читает private object через Blob SDK и отдаёт WebP stream.
Storage pathname, URL и credentials не передаются клиенту. Upload/owner/moderator
routes сохраняют прежние правила. Без storage config разрешённая ссылка даёт
503, интерфейс показывает «Изображение временно недоступно».

## 13. Защита изображений

Одного существования ArticleImage недостаточно. Draft/pending/rejected-only,
чужой image ID и старый файл, исчезнувший из текущей публикации, получают 404.
Проверяются и обложка, и inline references. Ответы no-store/nosniff, без redirect
на storage. next/image unoptimized не кэширует защищённую выдачу; localPatterns
не допускает API в optimizer, в том числе ручной запрос к /_next/image.
Уже полученные читателем bytes невозможно отозвать; проверка относится к новым
запросам. Объекты не удаляются, поскольку прежние revisions могут их использовать.

## 14. SEO

Metadata API для главной, статьи, профиля, категории и тега. Article metadata
получает тот же approved snapshot, что и body. Внутренний поиск noindex/follow.
Опциональный серверный SITE_URL — реальный HTTPS origin без пути/credentials;
он не выдуман и не записан в настоящий .env. При наличии origin создаются
canonical/OG URLs. OG cover дополнительно требует настроенный Blob.
Без origin sitemap пуст и robots запрещает индексирование среды.
При конфигурации sitemap содержит только публичные статьи, категории, теги,
профили с публикациями и главную; приватные маршруты исключены.
Sitemap ограничен 10000 статьями, 10000 тегами, 10000 профилями, 200 категориями;
перед превышением этих лимитов нужен sharding.

## 15. Cache strategy

Request-time SSR через connection(), без межзапросного Data Cache. React cache
дедуплицирует чтение статьи для metadata/body только в одном запросе.
Новая загрузка после approval видит новую revision на всех поверхностях.
Moderation action дополнительно сбрасывает Router Cache инициатора через
revalidatePath('/', 'layout'). Уже открытая гостевая вкладка требует навигации
или refresh; live push не добавлен. Sitemap/robots/images динамические.

## 16. Prisma

Добавлено только ArticleRevision.readingMinutes Int default 1 и SQL CHECK >=1.
Поле сервер вычисляет при approval из validated snapshot в той же транзакции.
Это исключает передачу больших JSON в карточки и повторные вычисления на каждом
просмотре. Пользовательское сохранение не принимает это поле.
Новых таблиц, состояний или дополнительных индексов не потребовалось.

## 17. Миграции

Создана `20260926120000_public_reading`. Аддитивная миграция, с backfill только
производного значения существующих APPROVED revisions. JSONPath strict исключает
дубли при рекурсивном обходе. До применения выполнен dry run в транзакции с rollback
и проверкой вложенного text node. Миграция применена к прежней development Neon.
Старые четыре SQL-файла не редактировались. Reset/db push/destructive DDL не было.

## 18. Новые тесты

`tests/public-content.test.ts`: 16 случаев — page/query boundaries, reading time,
metadata/configured URLs, safe rendering/image mapping, реальные поля карточки.
`tests/public-content.integration.test.ts`: четыре сценария на development БД —
реальные signup/draft/submit/reject/correct/approve, сохранность public snapshot
при новом pending/rejection, обновление content/taxonomy/SEO/images после approval,
пагинация с одинаковыми датами, поиск по автору, LIKE/injection inputs, whitelist,
sitemap, archived/nonapproved pointer/ban, image ownership и references.
Image fixtures — только записи БД для проверки доступа, без fake Blob объектов.
Все fixture users/articles/tags/categories удаляются адресно после тестов.

## 19. Браузер

Production server + настоящий Chromium/Playwright. Гость проходит главную →
статью → профиль → категорию → тег → поиск. Пагинация профиля, категорий, тегов,
поиска и сохранение q; пустой/слишком длинный поиск, реальные HTTP 404, отсутствие
private title/email в HTML/Flight/metadata, noindex search, ненастроенные SEO URLs.
Проверяются старый snapshot при PENDING и новый после APPROVED, public image
authorization, ожидаемый 503 без Blob и запрет optimizer cache.
Главная, чтение, профиль, категория, поиск и тег проверяются на 1440/768/390/320 px,
мобильное меню, keyboard skip-link/search, длинные ссылки/код и поддержанные узлы.
Скриншоты в игнорируемой `.playwright-mcp/phase5-{home,article}-{width}.png`.
Облачная загрузка/выдача изображений этим прогоном не подтверждается.
Финальный полный повтор после добавления image fallback: 4 integration tests
PASS, включая оба браузерных этапа (pending/updated), 139,54 секунды. Скриншоты
desktop-home и mobile-article просмотрены визуально. Переполнения нет, недоступные
изображения показывают понятное сообщение; JavaScript page errors не обнаружены.
Во время частых переходов/prefetch Next.js записывал «The destination stream
closed early». Все проверенные ответы и UI-сценарии успешны; при отдельных полных
HTTP-загрузках главной/категорий/поиска сообщение не повторилось. Это наблюдение
сохранено в отчёте, серверный лог не объявляется полностью свободным от ошибок.

## 20. Typecheck

`npm run typecheck` — PASS после последнего изменения application code.
Строгий TypeScript сохранён, any/ts-ignore не добавлены.

## 21. Lint

`npm run lint` — PASS, zero warnings, правила не отключались. ESLint 9 сохранён.
Промежуточное a11y замечание к spread props Image исправлено явным alt prop.

## 22. Production build

`npm run build` — PASS. Публичные маршруты отмечены динамическими.
Браузер проверяет эту сборку через локальный production server.

## 23. Prisma validation/status

`npm run db:validate` — PASS. После deploy `npm run db:status` — PASS:
пять миграций, database schema is up to date.
Финально сверены SHA-256 всех пяти SQL с `_prisma_migrations`: совпадают.
Оставшихся PHASE 4–5 QA identities — 0; конфликтов DRAFT/PENDING — 0.

## 24. Регрессии PHASE 2–4

`npm test`: 84 PASS (68 прежних + 16 новых).
Auth integration: 2 PASS; articles integration: 4 PASS; moderation integration:
5 PASS. Проверяются registration/login/logout/session, profile settings/ownership,
roles/ban, draft create/save/version conflicts, image permissions, submit/approve/
reject/concurrent decisions/history, новая revision и сохранение старой публикации.
Дополнительно повторён настоящий production-browser workflow PHASE 4: вход автора
и модератора, USER/guest denial, задержанный in-flight autosave с последними правками,
отказ устаревшей вкладке, immutable pending editor, очередь/preview, approval,
обязательная причина rejection, история автора, исправленный DRAFT и повторное
approval с сохранением прежних snapshots/publishedAt. PASS, тестовые записи очищены.
Отдельные UI-сценарии регистрации, profile settings и logout на этой фазе заново
не проходились; они покрыты auth integration. Все промежуточные ошибки нового
тестового кода (Vitest suite API/Tag lookup) исправлены до финальных прогонов.

## 25. Ограничения

Реальных Blob credentials нет: успешная cloud upload/read E2E не заявляется.
Проверены серверные permissions, код stream response и честный 503/визуальный
fallback; настоящие cover/inline bytes следует проверить после настройки store.
SITE_URL не настроен; deploy/domain crawler integration не выполнялись.
Включённый VPN сохранён. QA использует временный loopback TLS tunnel через
существующий локальный proxy к той же Neon с проверкой удалённого сертификата.
.env и приложение к proxy не привязаны; это не исправление постоянной сети.
Поиск пока contains без FTS; глубокие offset pages и sitemap имеют явные пределы.
Физические мобильные устройства и другие браузерные движки не тестировались.

## 26. Ручные действия

Просмотреть working tree и самостоятельно решить вопрос commit. Для обычного
запуска обеспечить устойчивый маршрут к development PostgreSQL при своём VPN.
Настроить private Vercel Blob и проверить реальные cover/inline upload/read:
старое опубликованное изображение доступно, pending-only закрыто, после approval
права меняются. Когда известен production HTTPS origin, задать SITE_URL и отдельно
настроить BETTER_AUTH_URL. В другой среде применить npm run db:deploy;
в текущей development БД новая миграция уже применена.

## 27. Следующий этап

Только по отдельной команде PHASE 6: likes, bookmarks, comments, replies, follows.
Реализация этих функций, уведомлений, аналитики и следующей фазы не начиналась.
