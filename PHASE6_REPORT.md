# PHASE 6 — Social Features

Дата: 28 сентября 2026. Development Neon, VPN оставлен включённым.
Начальное состояние: Git уже инициализирован, ветка `main`, HEAD `8fdf498`
(`phase 5 ready`), working tree чистый. Изменения этой фазы оставлены для review;
commit/push не выполнялись. PHASE 7 не начиналась.

## 1. Реализовано

Настоящие likes, bookmarks, plain-text comments, один уровень replies, follows
и базовая модерация комментариев. Все данные сохраняются в PostgreSQL через
существующую авторизацию. Demo backend и фиктивные счётчики не добавлялись.
Дизайн Golos Text/Lora, светлая тема и терракотовый акцент сохранены.

## 2. Prisma models

Добавлены `Like`, `Bookmark`, `Follow`, `Comment`; связи User/Article расширены.
Like и Bookmark: составной PK `(userId, articleId)`. Follow: PK
`(followerId, followingId)`. Comment: Article, author, parent, requestId, plain
content, created/updated/deleted/hidden timestamps, hiddenById. ArticleRevision
не получает социальных связей: реакции переживают смену publishedRevision.

## 3. Миграция

Создана и применена `20260927210000_social_features`: четыре новые таблицы,
индексы, FK, уникальные ограничения, CHECK против self-follow/self-parent,
ограничение content, trigger неизменяемости parent/article и одного уровня replies.
Composite FK `(articleId, parentId) → Comment(articleId, id)` запрещает чужую ветку.
SQL пяти прежних миграций не изменялся, reset/db push не использовались.
Миграция получена offline schema diff, рассмотрена и применена `db:deploy`
только к существующей development БД. Production credentials не использовались.

## 4. Likes

Явные likeArticle/unlikeArticle, actor только из сессии. Только Article,
доступная публично по общему правилу PHASE 5. Кнопка показывает состояние
текущего пользователя и реальный count; гость получает ссылку входа.

## 5. Защита от дублей Likes

PostgreSQL PK — окончательная гарантия уникальности. Создание использует
createMany/skipDuplicates; удаление deleteMany по actor/article. Повторное
создание или удаление не переключает состояние обратно. Проверены параллельные
запросы, прямое нарушение UNIQUE и невозможность удалить чужой like.

## 6. Bookmarks

Идемпотентные save/unsave, PK и actor-only доступ. Связь с Article сохраняется
после approval новой revision. Непубличная статья исключается из списка;
сама закладка остаётся и вернётся при восстановлении публичности.

## 7. Сохранённые статьи

`/dashboard/bookmarks`: только текущий активный пользователь, актуальный
publishedRevision, 12 карточек, createdAt DESC/articleId ASC, bounded pagination,
кнопки удаления и empty state. Переход добавлен в кабинет и меню аккаунта.
Гость перенаправляется к login с безопасным возвратом.

## 8. Comments

Trim, 1–2000 символов, обычный текст. HTML хранится как текст и экранируется React,
без dangerouslySetInnerHTML. Пустые/невидимые строки, NUL, слишком длинное сообщение
и поддельные author/role/status поля отклоняются. UUID requestId уникален у автора.
Корни выводятся по 10, новые первыми; всего максимум 1000 страниц.

## 9. Вложенность

Только корень → ответ. Ответ на ответ отклоняется; parent должен быть видимым,
неудалённым, от активного автора и той же Article. Parent/article immutable.
Ответы загружаются по кнопке по 5, старые первыми, без рекурсивной загрузки дерева.
Существующие ответы можно читать под скрытым или удалённым корнем.

## 10. Soft delete

Автор может удалить только собственный комментарий доступной статьи: deletedAt
ставится, content очищается. Строка и ответы остаются. Вместо текста placeholder;
ни автор, ни модератор не могут восстановить стёртое. Повторное удаление безопасно,
повтор старого requestId не создаёт сообщение заново. Запись продолжает участвовать
в ограничении частоты отправки.

## 11. Модерация комментариев

`/admin/comments`: MODERATOR/ADMIN, последние 20 сообщений, поиск по точному ID,
статусы, hide/restore с подтверждением. hiddenAt/hiddenById сохраняют последнее
скрытие. Привилегированный query может читать скрытый текст, включая недоступные
статьи. Публичный DTO перед сериализацией заменяет текст/автора на null; это
проверено для HTML/Flight и результатов queries. Блокировка автора также скрывает
его сообщения; restore не отменяет ban. Полный audit log не добавлен.

## 12. Follows

Явные follow/unfollow, реальные followers/following в профиле. Self-follow
запрещён сервисом и CHECK, собственная кнопка скрыта. Дубли запрещены PK.
Заблокированный target недоступен; существующие связи остаются, но не учитываются
в публичных счётчиках. Списки подписчиков и персональная лента не добавлены.

## 13. Публичные счётчики

Filtered Prisma _count: likes активных пользователей; comments без deletedAt,
hiddenAt и banned author (включая ответы); follows активных участников.
ArticleCard получает агрегаты в общей выборке, без отдельного query на карточку
и без загрузки коллекций для подсчёта. Просмотры не имитируются.

## 14. Защита социальных действий

Существующие Better Auth guards, свежие role/isBanned, строгий Zod, ownership
в сервисе, общая `publicArticleWhere`. Guest/ban не мутируют. Персональные
liked/saved/isFollowing читаются только для текущей сессии; общего Data Cache нет.
Client userId/authorId/role не принимаются. Server Actions сохраняют стандартную
Origin/CSRF защиту Next.js; raw Prisma errors превращаются в понятные сообщения.

## 15. Конкурентность и простая защита от спама

Транзакция блокирует actor User FOR UPDATE, повторно проверяет права, затем
Article FOR SHARE сохраняет public pointer до commit. Порядок User → Article
совместим с авторскими и moderator mutations. Follow блокирует обе User строки
в порядке id; параллельная взаимная подписка проверена.

Проверки комментариев сериализуются строкой автора в PostgreSQL: минимум 5 секунд
между сообщениями, до 10 за 60 секунд, одинаковый текст в той же ветке в этом окне
отклоняется. UUID requestId обеспечивает безопасный транспортный retry; изменённый
payload неудалённой записи с прежним UUID запрещён. Повтор удалённой записи
возвращает её ID, не восстанавливая текст. Redis/in-memory limiter не добавлены.

## 16. Обновление UI

После успешной Server Action `revalidatePath('/', 'layout')` обновляет серверное
дерево и Router Cache текущего браузера. Кнопки ждут подтверждения, disabled во
время запроса, используют aria-pressed; ошибки доступны через role=alert.
Новый корневой комментарий виден на первой странице, ответ загружается на нужной
странице ветки; удаление ответа обновляет её. Общего кеша персонального состояния
нет. Другим вкладкам требуется refresh/навигация; live push вне scope.

## 17. Маршруты и компоненты

Новые `/dashboard/bookmarks`, `/admin/comments`. Расширены article/profile,
ArticleCard, dashboard/header и whitelist returnTo. Feature modules:
likes/bookmarks/comments/follows/social; UI SocialButton, ArticleSocial,
ProfileFollow, Discussion, CommentThread/Composer, CommentModerationButton.
Pages остаются Server Components; локальная интерактивность вынесена в client UI.
Новую систему авторизации и зависимости не добавляли.

## 18. Новые тесты

`tests/social.test.ts`: 10 unit cases — strict inputs, длина/пустота/NUL,
pagination/nonce, redaction, безопасные ошибки и returnTo.
`tests/social.integration.test.ts`: 7 DB scenarios и опциональный browser scenario.
Покрыты реальные сессии, публикация через workflow, guest/ban/ownership/role,
concurrent duplicates, rate limits, parent/FK/trigger, soft delete, hide/restore,
privacy/counts, pagination и переключение publishedRevision.
Fixture ArticleCard PHASE 5 теперь проверяет реальные likes/comments.

## 19. Браузерные сценарии

Production Next server + Chromium/Playwright. Проверены like/unlike и reload,
save/reload/страница закладок/remove/empty state, follow/reload/unfollow/count,
plain-text XSS string, comment/reply/delete parent с сохранением reply, delete reply,
moderator hide/restore, guest чтение и safe login link, guest private-route denial.
HTML/RSC не содержит скрытого или стёртого текста. 16 responsive views:
article/bookmarks/profile/moderation на 1440/768/390/320, без horizontal overflow;
keyboard skip-link и отсутствие page errors. Скриншоты в `.playwright-mcp`, не в Git.
`tests/social.browser.mjs` принимает временные cookies через stdin, не пишет secrets.

## 20. Typecheck

`npm run typecheck` — PASS. Strict сохранён, any/ts-ignore не добавлены.

## 21. Lint

`npm run lint` — PASS, zero warnings. Правила не отключались, ESLint 9 сохранён.

## 22. Production build

`npm run build` — PASS. Новые страницы и персонализированные публичные страницы
динамические. Финальная сборка повторена после последней правки кода.

## 23. Prisma validation/status

`npm run db:validate` — PASS; `npm run db:status` — PASS, шесть миграций,
database schema is up to date. SHA-256 всех шести SQL сверены с
`_prisma_migrations`: совпадают. После regression QA оставшихся тестовых
PHASE 4–6 identities — 0, конфликтующих DRAFT/PENDING — 0.

## 24. Регрессии

Unit: 94 PASS. Auth integration: 2 PASS; articles integration: 4 PASS;
moderation integration: 5 PASS. PHASE 5 public integration: 4 PASS, включая
production-browser сценарии. Social integration вместе с browser: 8 PASS;
финальный повтор с усиленными privacy/rate-limit assertions — 8 PASS.
Итого интеграционные наборы: 23 PASS, включая включённый social browser scenario.

PHASE 5 browser: публичная навигация, snapshot SEO до/после approval,
пагинация каталогов/поиска, 404/privacy, image guard и честный storage-unavailable
без Blob, 24 responsive views, keyboard и безопасный rich text — PASS.

Дополнительно повторён production-browser workflow PHASE 4: registration,
author/moderator login, USER/guest denial, in-flight autosave + последние правки,
stale tab denial, immutable pending, approve/reject с обязательной причиной,
history, исправление и approval при сохранении старых snapshots/publishedAt — PASS.
Отдельные UI profile settings/logout заново не проходились; покрыты auth integration.

Первый social DB прогон выявил ошибку тестовой подготовки: созданный напрямую
foreign-comment fixture попадал под реальный rate limit следующего ответа.
Исправлено время только тестовых fixtures; приложение/лимиты не ослаблялись.
Все четыре каскадных падения этого прогона устранены повторным PASS.

## 25. Ограничения

- Защита от простого спама, не полноценная anti-abuse система. Нет CAPTCHA,
  глобального ограничения like/follow churn, редактирования комментариев,
  жалоб, полного moderation audit log или массовых действий.
- Offset pagination до 1000 страниц; для очень больших обсуждений понадобится
  cursor pagination. Placeholders занимают места даже при нулевом visible count.
- Уже доставленный в чужую вкладку текст нельзя отозвать без её обновления.
  Следующий запрос соблюдает hidden/deleted/ban; WebSocket/уведомления не добавлены.
- Реального Blob configuration по-прежнему нет; cloud upload/read E2E не заявляется.
  SITE_URL отсутствует; production deploy/domain indexing не проверялись.
- QA использует временный loopback tunnel через существующий локальный proxy
  к той же Neon. Удалённый TLS-сертификат проверяется; .env/код приложения не
  привязаны к proxy. Постоянную сетевую нестабильность это не исправляет.
- Проверен Chromium, без физических мобильных устройств и других browser engines.
- При быстрых переходах regression Playwright в логе Next.js встречается
  `The destination stream closed early`, как и в PHASE 5. Завершённые страницы
  и HTTP assertions проходят, page errors отсутствуют. Это сообщение об отменённом
  потоке отдельно не исправлялось; отсутствие всех серверных warnings не заявляется.

## 26. Ручные действия

Просмотреть working tree и самостоятельно решить вопрос commit. В текущей
development БД миграция уже применена; в другой development среде выполнить
`npm run db:deploy`. Для обычного запуска обеспечить устойчивый маршрут к Neon
при выбранном VPN. Для cloud images настроить private Blob и проверить реальный
upload/read, для deployment задать реальные SITE_URL/BETTER_AUTH_URL.
Новые secrets для социальных функций не требуются.

Финально: staging пуст, Git-visible secret scan — PASS, .env/generated/build/QA
artifacts игнорируются. Временные production QA server и TLS tunnel остановлены.

## 27. Следующий этап

По PROJECT_SPEC PHASE 7 — Personalization: Following feed и notifications.
Реализация возможна только после отдельной команды пользователя. Она не начата.
