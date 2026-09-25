# Narra — PHASE 3: Articles, Rich-Text Editor & Drafts

Дата: 25 сентября 2026. Реализована только PHASE 3. PHASE 4 не начата.
Загрузка в настоящий Vercel Blob требует настройки пользователем; ниже она
явно отделена от проверенных сценариев работы с PostgreSQL.

1. **Что реализовано.** Создание Article с первой DRAFT revision, собственный
   список статей, редактор, повторное открытие, autosave, ручное сохранение,
   категории, теги, удаление с подтверждением, отдельная новая версия уже
   опубликованного материала. Upload/read endpoints для private Blob и безопасный
   React renderer подготовлены. Mock backend, localStorage/JSON database нет.

2. **Файлы и Git.** Добавлен модуль `src/features/articles/`: `service.ts`,
   `queries.ts`, `actions.ts`, `schemas.ts`, `content.ts`, `errors.ts`, `http.ts`,
   `article-editor.tsx`, `tiptap-editor.tsx`, `use-autosave.ts`, `draft-buttons.tsx`,
   `image-upload.tsx`, `images.ts`, `image-processing.ts`, `rich-text.tsx`.
   Новые pages: `src/app/editor/new/page.tsx`, `src/app/editor/[id]/page.tsx`,
   `src/app/dashboard/articles/page.tsx`; image routes:
   `src/app/api/articles/[id]/images/route.ts` и `[imageId]/route.ts` внутри неё.
   Добавлены `prisma/seed.ts`, миграция, `tests/articles.test.ts`,
   `tests/articles.integration.test.ts` и этот отчёт. Обновлены schema/config,
   package/lockfile, `.env.example`, стили, навигация кабинета/header, auth returnTo,
   auth guards, Prisma helper, README, PROJECT_SPEC и AGENTS.
   Git существовал: `main`, HEAD `7087eb8` (PHASE 1); PHASE 2 была незакоммичена,
   об этом сообщено перед реализацией. Её изменения сохранены. Staging пуст,
   commit и push не выполнялись. `.env`, Prisma generated client, сборка и
   браузерные артефакты исключены из Git. Проверка на реальные env secrets прошла.

3. **Зависимости.** Tiptap 3.31.3: `@tiptap/core`, `@tiptap/react`, `@tiptap/pm`,
   `@tiptap/starter-kit`, `@tiptap/extension-image`; `@vercel/blob` 2.8.0;
   `sharp` 0.35.4 как прямая зависимость. Установка через npm без force/legacy
   peer обходов; проверка зависимостей без invalid peers. На установке npm audit
   сообщил 0 vulnerabilities. Next 16.3.6, React 19.3, Prisma 7.10,
   TypeScript 6.0 и рабочий ESLint 9 сохранены.

4. **Tiptap.** Client Component с `immediatelyRender: false`; StarterKit + Image.
   Paragraph, H1–H3, bold, italic, links, blockquote, оба списка, code block,
   images, undo/redo. Адаптивная панель, Golos Text/Lora и существующая палитра.
   Исправлены обнаруженные браузером проблемы первого mount EditorContent,
   сериализации null-prototype ProseMirror attrs через React Flight и допустимого
   поля Link.title в Tiptap 3. JSON нормализуется перед Server Action; серверная
   валидация при этом не обходится. При успешном основном браузерном прогоне
   ошибок JavaScript/hydration не было.

5. **Хранение и валидация.** Основной контент — JSONB в ArticleRevision.
   Whitelist структуры/узлов/атрибутов/marks, максимум 100 000 символов текста,
   400 000 UTF-8 bytes JSON, 10 000 узлов, глубина 24. Заголовок до 180,
   описание до 500 символов. Ссылки только http/https/mailto без credentials и
   управляющих символов; title до 300. Источники изображений только внутренние
   authenticated routes с дополнительной проверкой принадлежности в БД.
   `RichText` создаёт React elements без `dangerouslySetInnerHTML`.

6. **Autosave.** Debounce 1300 мс, последовательная очередь в каждой вкладке,
   snapshot запроса и только изменённые поля. При вводе во время запроса следующий
   snapshot сохраняется после подтверждения предыдущего. Индикатор «Сохранено»
   только после ответа сервера; при сбое текст остаётся в редакторе, доступны
   повторное сохранение и скачивание JSON-копии. Есть защита ухода со страницы;
   Back/Forward через Navigation API там, где браузер её поддерживает.

7. **Конкурентность.** `editVersion` проверяется при update и delete, увеличивается
   атомарно и не смешивается с номером revision. Блокировки Article FOR UPDATE и
   User FOR SHARE защищают операции и повторную проверку бана. Устаревший запрос
   не перезаписывает свежую запись. Вторая вкладка получает конфликт, сохраняет
   локальный текст и предлагает скачать копию перед загрузкой серверной версии.
   Автоматического слияния конфликтов нет.

8. **Article / ArticleRevision.** Атомарное создание Article + начальной revision,
   authorId только из requireAuth, стабильный уникальный `story-UUID` slug.
   Открытие/prefetch GET не создаёт записи. Только владелец редактирует DRAFT;
   PENDING/ARCHIVED блокируют изменения. Для опубликованной статьи отдельное POST
   действие копирует approved revision с категорией/тегами в новый DRAFT,
   сохраняя status Article, publishedRevisionId и прежний контент. Сам публичный
   pointer запрещено редактировать даже при некорректном legacy status revision.
   Единственный неопубликованный DRAFT удаляется вместе с Article; в остальных
   случаях удаляется только выбранный DRAFT. Исходный composite publication FK
   сохранён. Никакого пользовательского API публикации/модерации не добавлено.

9. **Prisma schema.** Добавлены `ArticleRevision.editVersion` (default 0),
   `ArticleImage` с articleId/pathname/createdAt и relation `Article.images`.
   В SQL добавлены CHECK editVersion >= 0 и partial UNIQUE «один DRAFT на Article».
   Изображения привязаны к Article, чтобы разные revisions могли их использовать.

10. **Миграции.** Новая `20260925180000_article_drafts` применена к уже подключённой
    development Neon. Она добавляет поле/таблицу/ограничения без удаления данных.
    `20260924140000_foundation` и `20260925120000_authentication` не изменены:
    контрольные суммы всех трёх локальных SQL совпали с `_prisma_migrations`.
    Исходные четыре CHECK и защита от foreign publishedRevision подтверждены
    интеграционным тестом; наличие нового partial index проверено в PostgreSQL.
    Reset, db push и подмена базы не выполнялись.

11. **Категории и теги.** Шесть базовых категорий из PostgreSQL, idempotent seed
    через upsert с пустым update; повторный запуск успешен. Названия тегов
    NFKC/lowercase/нормализованные пробелы, до 32 символов и 8 уникальных тегов.
    Slug кодирует нормализованное имя в hex без коллизий C++/C#. Join records
    относятся к revision; изменения draft не меняют published tags/category.

12. **Изображения.** Private Vercel Blob, server-side upload без выдачи токена.
    Origin/auth/ownership/status проверяются на сервере; body ограничен 3 MiB.
    Только JPEG/PNG/WebP; Sharp проверяет decoded format, до 20 MP, без SVG,
    анимации и повреждённых данных, удаляет metadata и выдаёт WebP до 2400 px.
    До 100 изображений на статью и 10 загрузок/резервирований в минуту. Чтение
    private object через owner-only endpoint с no-store. Замена/удаление draft
    не удаляет объекты, на которые может ссылаться другая revision. При ошибке
    upload очищается только уникальный объект этой операции. Реальный storage
    не подменялся mock; credentials отсутствуют, end-to-end upload не проверен.

13. **Environment.** Существующие DATABASE_URL, BETTER_AUTH_SECRET и BETTER_AUTH_URL
    сохранены. Для локальных изображений нужен `BLOB_READ_WRITE_TOKEN` private
    store. На Vercel возможен BLOB_STORE_ID + управляемый платформой OIDC token.
    В `.env.example` только пустые BLOB_READ_WRITE_TOKEN/BLOB_STORE_ID.
    Фактический `.env` не изменялся, credentials в документации/отчёте отсутствуют.

14. **Фактически выполненные тесты.** Финальный unit run: 53 passed; articles
    integration: 4 passed на настоящей Neon; auth regression: 2 passed.
    Проверены ownership/guest/ban, строгие поля, категории/теги, уникальные slug,
    гонка двух записей и stale delete, копирование published revision без её
    изменения, PENDING, composite FK, inconsistent public pointer, image ownership,
    Origin и отсутствие storage configuration. Auth regression включает
    регистрацию, вход/выход, профиль, серверные роли и заблокированные сессии.
    В браузере реально проверены создание, сохранение/повторное открытие из Neon,
    заголовок/описание/категория/теги; форматирование, включая H1–H3, списки,
    bold/italic, quote/code и безопасную ссылку; конфликт двух вкладок с сохранением
    локального текста и скачиванием копии; намеренный обрыв запроса, предупреждение
    при уходе, успешный ручной retry; cancel/confirm удаления и пустой список.
    Чужая статья возвращает 404 без текста; guest перенаправляется на login из
    /editor/new и /dashboard/articles. Адаптивность измерена на 320/390/768/1440
    px без горизонтального overflow; desktop/mobile screenshots просмотрены.
    Реальные JPEG/PNG/WebP декодируются в unit tests; ложный MIME/SVG/corruption/
    превышение размера отвергаются. Тестовые пользователи и статьи очищены,
    пользовательские аккаунты/контент не удалялись; ADMIN не назначался.

15. **Typecheck.** `npm run typecheck` — PASS после финального изменения кода;
    strict TypeScript сохранён, подавлений ошибок не добавлено.

16. **Lint.** `npm run lint` — PASS, 0 warnings при `--max-warnings=0`.

17. **Production build.** `npm run build` — PASS; браузерные проверки проведены
    на production server. Сборка не применяет миграции и не требует Blob token.

18. **Prisma validation/status.** `npm run db:validate` — PASS;
    `npm run db:status` — «Database schema is up to date», 3 migrations.
    Финальный повтор `npm run db:seed` успешен. При проверках новые соединения
    к Neon периодически завершались таймаутом: были неуспешные промежуточные
    прогоны, они не считаются PASS. VPN оставлен включённым по требованию владельца.
    Финальные успешные DB/браузерные прогоны использовали временный loopback
    туннель через существующий локальный VPN proxy к той же Neon, с проверкой
    TLS-сертификата удалённого сервера. Loopback участок локален; внешний трафик
    зашифрован. Тестовый адрес передавался только процессам проверки, `.env` и
    приложение не привязаны к прокси. Это обход для QA, не постоянное исправление
    нестабильного сетевого маршрута. Временные сервер/туннель после работы остановлены.

19. **Ограничения.** Реальная загрузка, чтение и отображение обложки/inline image
    из Vercel Blob ещё требуют credentials и повторной проверки. До настройки UI
    отключает файлы с понятным объяснением; текст работает. Нет автоматической
    очистки неиспользуемых Blob objects, импорта JSON backup и автоматического
    слияния конфликтов. Принудительное закрытие ОС/браузера может потерять
    несохранённые изменения. Устойчивость прямого доступа к Neon через текущий
    VPN не подтверждена: успешный QA не означает устранения сетевой проблемы.

20. **Действия владельца.** Настроить private Blob store и локальный token,
    перезапустить приложение и проверить обложку/inline upload, reopen и запрет
    чтения другим пользователем. Обеспечить устойчивый маршрут к Neon при
    включённом VPN, затем повторить `npm run db:status` и integration tests в
    обычном окружении. Просмотреть изменения PHASE 2 + PHASE 3 и решить вопрос
    с локальным commit; автоматического commit/push нет. Уже применённую миграцию
    повторять вручную не требуется; на другой development-базе использовать
    `npm run db:deploy`, затем `npm run db:seed`.

21. **Следующий этап.** PHASE 4 — отправка revision на модерацию, решения
    модератора и транзакционное переключение опубликованной версии согласно
    отдельному будущему заданию. Этот workflow не реализовывался. Работа
    останавливается на PHASE 3.
