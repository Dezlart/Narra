# Narra — PHASE 2: Authentication, Users & RBAC

Дата: 25 сентября 2026. PHASE 2 реализована. PHASE 3 не начата.

1. **Зависимости.** Добавлены better-auth 1.7.6, @better-auth/prisma-adapter
   1.7.6, zod 4.6.5; dev: vitest 5.0.1 и tsx 4.23.15. Lockfile сохранён.
   Версии ранее установленных пакетов не изменились. Next 16.3.6, React 19.3,
   Prisma 7.10, TypeScript 6.0.3 и ESLint 9.39.5 сохранены. Разрешён install
   script esbuild 0.28.2 для нового tooling. npm audit: 0 vulnerabilities;
   npm ls: без invalid peers. Force/legacy-peer-deps не использовались.

2. **Better Auth.** Серверная конфигурация `src/lib/auth/server.ts` отделена
   через server-only от React client. App Router handler:
   `src/app/api/auth/[...all]/route.ts`, Node.js runtime, GET/POST через
   toNextJsHandler. Prisma adapter использует транзакции. nextCookies — последний
   plugin. Интеграция сверена с официальными Next/Prisma adapter/hooks/session
   docs и установленными исходниками. Источники перечислены в PROJECT_SPEC.md.
   Origin/CSRF проверки явно включены и в production, и в Vitest.

3. **Prisma schema.** Существующий User, его поля, enum UserRole и связи с
   Article/ArticleRevision сохранены. Добавлены Session, Account, Verification,
   RateLimit с индексами и внешними ключами на User. ID/FK остаются строками.
   Username уже имел UNIQUE; новые регистрации требуют нормализованное значение,
   но поле в БД осталось nullable ради старых строк. Дублирующих пользователей,
   ролей или флагов блокировки нет.

4. **Миграции.** Создана и применена к подключённой пользователем development
   Neon миграция `20260925120000_authentication`. SQL получен штатным Prisma 7
   migrate diff между прежней и новой схемой, проверен до migrate deploy.
   Он только добавляет четыре таблицы, индексы и FK; не изменяет старые таблицы.
   `20260924140000_foundation` не изменена. Все четыре исходных SQL CHECKs
   подтверждены в pg_constraint. Reset, db push, удаление прежних данных и
   переустройство ArticleRevision не выполнялись.

5. **Регистрация.** `/register`: имя, username, email, пароль, подтверждение.
   Zod проверяет и нормализует имя/username/email; сервер повторно проверяет
   signup. Подтверждение проверяет форма. Username 3–30 символов из безопасного
   набора, пароль 12–128. Предзапрос username даёт понятную ошибку, окончательную
   уникальность username/email обеспечивает PostgreSQL. Конкурентные регистрации
   проверены. Better Auth хеширует пароль через scrypt; БД содержит hash,
   не исходный пароль. Whitelist и database hook принудительно задают USER,
   isBanned=false, emailVerified=false, image=null независимо от payload.

6. **Вход и выход.** `/login` использует настоящую DB session. Cookie HttpOnly,
   SameSite=Lax, Secure при HTTPS. Локально HTTP localhost: Secure=false ожидаемо.
   Срок сессии настроен на 7 дней, обновление — после суток; cookie cache выключен.
   Реально проверены вход, неправильный пароль, reload, logout и недействительность
   старого токена после logout. После выхода полная навигация сбрасывает Router
   Cache; восстановление private document из BFCache вызывает reload. Проверен
   browser Back после logout. UI returnTo ограничен whitelist; внешние callback
   Better Auth отвергает. Проверены оба способа защиты от open redirect.

7. **Профили и кабинет.** `/dashboard` показывает реальные собственные данные,
   ссылку на публичный профиль, настройки и выход. `/dashboard/settings` меняет
   name/username/bio; пустое bio хранится как null. Есть loading/disabled/error/
   success states. Server Action вызывает отдельный application service,
   затем инвалидирует старый/новый profile path и layout. Публичный select
   содержит только name, username, bio, image, createdAt; email и auth-данные
   не сериализуются. Аватар — инициалы. Неизвестный и заблокированный профиль
   возвращает HTTP 404. Публикации имеют честное пустое состояние, без статистики.

8. **Роли и блокировка.** Единственные источники истины — User.role и isBanned.
   `getCurrentSession`, `getCurrentUser`, `requireAuth`, `requireModerator`,
   `requireAdmin` находятся в `src/lib/auth/guards.ts`. Role/isBanned запрашиваются
   из PostgreSQL при каждом вызове, не берутся из client payload или cookie cache.
   Moderator guard разрешает MODERATOR/ADMIN, admin guard — только ADMIN.
   Бан закрывает private services/pages и создание новой сессии. Profile update
   повторно проверяет isBanned непосредственно в WHERE записи.

9. **Защита маршрутов и действий.** Обе private pages вызывают серверный guard,
   гостя перенаправляют на login с безопасным returnTo. Ownership проверяется
   внутри updateOwnProfile: ID берётся исключительно из проверенной сессии.
   Строгая Zod schema отклоняет role/isBanned/emailVerified/userId и любые лишние
   поля. `/api/auth/update-user` запрещён для обхода этого сервиса; изменение
   email/пароля и удаление аккаунта через встроенные endpoints закрыты на этой фазе.
   Proxy не используется как граница авторизации. Guards подготовлены для будущего
   `/admin`; сама административная панель не создавалась. Rate limiting в БД:
   signup/login 10/60 секунд, общий предел 100/60; HTTP 429 наблюдался при повторных
   прогонах. Логи приложения не включают auth payload или raw DB exceptions.

10. **Первый ADMIN.** Владелец сначала регистрирует свой обычный аккаунт, затем
    лично выполняет локальную команду:

    ```sh
    npm run admin:promote -- --email owner@example.com --confirm
    ```

    Email в примере нужно заменить своим. Скрипт требует точный email и confirm,
    проверяет существующий активный credential account, не создаёт пользователей.
    Публичного HTTP endpoint нет. Проверен отказ без аргументов; успешное назначение
    намеренно не выполнялось. Ни один реальный или тестовый аккаунт не получил ADMIN.

11. **Реальные проверки.** 25 unit tests и 2 интеграционных сценария Vitest — PASS.
    Интеграционные тесты используют настоящий Better Auth handler и development
    PostgreSQL; подменяется только маркер server-only для Node test runner.
    Проверены signup с role=ADMIN (итог USER), duplicate email/username, concurrent
    username signup, hash/Account/Session в БД, гостевой отказ, USER→MODERATOR→USER
    с немедленным изменением guard результата, отказ admin guard, чужой userId,
    mass assignment, обход через update-user, уникальность при profile update,
    публичный whitelist, неправильный пароль, Origin/CSRF, callback, бан после входа,
    запрет новых сессий забаненному пользователю, logout и отзыв текущей сессии.
    Положительная ветка ADMIN guard проверена unit-тестом без выдачи роли в БД.

    В Playwright реально проверены регистрация через форму, сохранение в БД,
    reload, редактирование трёх полей, публичный профиль гостем, duplicate errors,
    неверный пароль, безопасный возврат в settings, logout/Back, private redirects,
    tampered form с role=ADMIN, бан уже вошедшего пользователя и HTTP 404.
    Production server отдельно проверен через next start. Приватный response:
    `private, no-cache, no-store, max-age=0, must-revalidate`. Email/пароль
    тестового пользователя отсутствуют в HTML публичного профиля гостя.
    Главная/login/register/profile проверены на 320/390/768/1440 px без overflow;
    settings осмотрен на 390 px, dashboard на 1440 px, mobile account menu работает.
    В production-браузере нет неожиданных warning/error; ожидаемые 4xx создавались
    отрицательными тестами. Тестовые пользователи, их аккаунты и сессии удалены
    адресно после проверки; существующие пользовательские аккаунты не затрагивались.

12. **Typecheck.** `npm run typecheck` — PASS, strict TypeScript сохранён,
    без any/ts-ignore в ручной реализации.

13. **Lint.** `npm run lint` — PASS, 0 предупреждений, правила не отключены.
    ESLint 9 оставлен согласно требованию; совместимость с 10 повторно не исследовалась.

14. **Production build.** `npm run build` — PASS. Главная, auth, dashboard и
    profile рендерятся динамически из-за auth-aware Header; иконка статическая.
    Production UI проверен браузером. Временный сервер проверки остановлен;
    для обычной разработки запустите `npm run dev`.

15. **Prisma.** `npm run db:validate` — PASS. `prisma migrate status` —
    Database schema is up to date, две миграции. Дополнительно migrate diff
    от фактической БД к schema.prisma — No difference detected, exit 0.
    Наличие четырёх исходных CHECK constraints проверено отдельно, потому что
    Prisma DSL не описывает их.

16. **Environment.** DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL.
    Существующий DATABASE_URL в `.env` сохранён; криптографически случайный secret
    и localhost URL добавлены только при отсутствии. `.env.example` содержит
    пустые секретные значения. Проверка Git-visible файлов не обнаружила реальных
    значений DATABASE_URL/secret или private keys. `.env`, generated client,
    build/browser artifacts игнорируются. Staging пуст.

17. **Ручные шаги владельца.** В текущей рабочей копии environment и development
    миграции уже настроены. Запустить `npm run dev`, зарегистрировать собственный
    аккаунт и при необходимости выполнить команду пункта 10. Для свежего checkout:
    npm ci, создать/дополнить .env, db:deploy, db:status, npm run dev. Не копировать
    шаблон поверх существующего .env. Контрольная точка PHASE 1 `7087eb8` сохранена.
    PHASE 2 оставлена в рабочей копии; отдельный commit и push не выполнялись.

18. **Ограничения.** Нет email verification/recovery, OAuth, avatar uploads/URL
    editing, административного UI и статей. Эти функции вне PHASE 2. Реальное
    назначение ADMIN, истечение семи суток и обновление после суток не симулировались.
    TLS-драйвер pg сообщает о будущем изменении трактовки `sslmode=require`:
    текущая версия использует verify-full; исходная строка пользователя сохранена.
    При будущей настройке deployment следует явно выбрать TLS режим и доверенные
    proxy/IP headers, указать HTTPS BETTER_AUTH_URL. Проверки deployment/HTTPS
    в удалённом окружении не проводились; текущие проверки локальные с development БД.

19. **Архитектурные уточнения.** Modular monolith сохранён. Auth infrastructure,
    reusable guards, validation/UI и profile action/service разделены. Существующая
    модель ролей/банов предпочтена дополнительному admin plugin, чтобы не дублировать
    состояние. Username nullable только ради legacy; signup обязателен. Главная
    и её прежний loading перенесены в `(home)` без изменения содержимого/URL:
    глобальный loading иначе начинал streaming до profile lookup и давал HTTP 200
    для отсутствующего профиля. Уточнён общий footer и атрибут smooth scrolling.
    Более ранние заметки PHASE 1 в спецификации сохранены как исторические.

20. **Следующий шаг.** Только по отдельной команде: PHASE 3 — сервисы статей
    и версий, Tiptap, черновики, autosave, изображения и редактирование с ownership
    и guards этой фазы. Работа PHASE 3 не начиналась.
