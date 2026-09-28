# PHASE 7 — Personalized Feed & Notifications

28 сентября 2026. Реализована только PHASE 7. PHASE 8 не начиналась.
Начальное состояние Git: чистая ветка main, HEAD `bfb1f6e phase 6 ready`.
PHASE 1–6 зафиксированы. Изменения PHASE 7 оставлены в working tree для review;
commit, staging и push не выполняются. Новых пакетов нет; package-lock не изменён.

## 1. Реализовано

Персональная лента, persistent notifications шести типов, unread count,
колокольчик/preview, полная история, read/read all и безопасные переходы.
PostgreSQL — источник истины; нет mock backend, localStorage notifications,
email/realtime, analytics или полного admin dashboard.

## 2. Following feed

`/following` требует активную сессию. Один relation query выбирает Article
через author.followers.some(followerId=current user), без загрузки всех Follow
и без запроса на каждого автора. Переиспользуются public infrastructure и ArticleCard.
Есть пояснение, empty/loading/error states, ссылка на главную, private-page lifecycle.
Гость перенаправляется на login с разрешённым returnTo=/following.

## 3. Published revision

Общий publicArticleWhere требует PUBLISHED, publishedRevisionId/slug/publishedAt,
APPROVED publishedRevision и активного автора. Card select использует только эту
revision и не выбирает полный JSON. Новый DRAFT/PENDING/REJECTED сохраняет прежнюю
карточку. Approval переключает её на новую версию той же Article.

## 4. Pagination ленты

12 на страницу, publishedAt DESC/id DESC, take=13 и серверный skip.
Page нормализуется существующим publicPage и ограничен 1000. Client slice всех
статей отсутствует. Некорректный page становится 1, за концом списка — empty state.

## 5. Notification model

id, recipientId, optional actorId/articleId/revisionId/commentId, type,
обязательный eventKey, createdAt/readAt. Recipient Cascade; остальные relations
SetNull при удалении сущности: историческое событие сохраняется и деградирует
до нейтрального текста. Нет копий комментария, причины rejection или arbitrary URL.

## 6. Типы

Enum NotificationType: ARTICLE_APPROVED, ARTICLE_REJECTED, NEW_FOLLOWER,
ARTICLE_COMMENT, COMMENT_REPLY, FOLLOWED_AUTHOR_PUBLISHED.
Серверный модуль events не имеет публичного creation action/API.

## 7. ARTICLE_APPROVED

После успешного решения revision создаётся уведомление автору Article с
articleId/revisionId и moderator actor. Оно входит в ту же транзакцию.
Автор получает решение и для первой публикации, и для каждого approved update.

## 8. ARTICLE_REJECTED

Создаётся автору в transaction rejection. Причина остаётся в ArticleRevision;
уведомление ведёт к конкретной версии в собственную историю. Query выбирает title
reviewed revision только через article.authorId=current recipient.
Другим пользователям pending/rejected title и reason не выдаются.

## 9. NEW_FOLLOWER

Создаётся только при createMany.count=1. Повторный/concurrent follow, self-follow,
неуспешное действие не создают событие. Unfollow не удаляет историю. Новый follow
после unfollow — новое реальное событие с новым серверным UUID eventKey.

## 10. ARTICLE_COMMENT

Корневой комментарий уведомляет автора Article. Авторский self-comment не
уведомляет самого себя. Запись создаётся после создания Comment в той же
транзакции, ключ события основан на постоянном comment.id.

## 11. COMMENT_REPLY

Reply уведомляет только автора корневого комментария. Self-reply не уведомляет.
ARTICLE_COMMENT параллельно не создаётся, включая случай, когда автор корня —
автор статьи. Прежняя глубина replies/FK/trigger/rate limit сохранены.

## 12. FOLLOWED_AUTHOR_PUBLISHED

При первой публикации выполняется один параметризованный INSERT SELECT из
Follow с фильтрацией активных получателей/автора, ON CONFLICT DO NOTHING.
Все записи создаются в транзакции approval, followers не загружаются в память.
Состав получателей соответствует snapshot этого statement: завершённый до него
unfollow исключён; конкурентный ещё не завершённый unfollow может оставить событие.

## 13. Approved updates

First publication определяется прежним состоянием Article под её блокировкой:
publishedRevisionId и publishedAt отсутствуют. Для update это условие ложно.
Сохранённая первая дата публикации также предотвращает повторную рассылку после
очистки pointer административной процедурой. Автор получает новое решение,
подписчики — ни одного повторного publication notification.

## 14. Deduplication

UNIQUE(recipientId,eventKey). Review — review:revisionId; публикация —
publication:articleId; комментарий — comment:commentId; Follow — follow:UUID
на успешный переход. Прежние revision status и author/requestId защищают
исходные mutations. Повторное создание event использует skipDuplicates.
Новая реальная подписка и retry неизменившегося Follow различаются.

## 15. Transaction integration

events.ts получает Prisma.TransactionClient существующего workflow.
Ошибка создания notification откатывает business mutation, откат mutation
не оставляет уведомления. Bulk fanout также атомарный, без очереди/event bus.

Social User locks изменены с FOR UPDATE на FOR NO KEY UPDATE. Они продолжают
сериализовать actor writes, ban/role и comment rate checks, но совместимы с
FK KEY SHARE при записи Notification другому пользователю. Это важно для
взаимных комментариев/подписок. User → Article порядок сохранён; старые SQL
constraints и workflow не менялись. Проверено реальное параллельное комментирование.

## 16. Unread count

COUNT WHERE recipientId=current session user AND readAt IS NULL. Полная коллекция
не загружается. Header читает preview/count один раз; React cache только request-local.
На полной странице есть отдельный count для доступности read all. Shared Data Cache
персональных данных отсутствует; count не хранится отдельным mutable полем.

## 17. Bell

В Header активного пользователя, Lucide Bell, badge максимум 99+, accessible label
с полным count. Native details/summary поддерживает Enter/Space и Tab; Esc закрывает
и возвращает фокус, клик снаружи закрывает. Гость/banned bell не получают.

## 18. Preview

Последние пять уведомлений, createdAt DESC/id DESC. Иконка типа, безопасный текст,
дата, «Новое»/«Прочитано», действие read и переход к полной истории. Открытие
preview ничего не отмечает. Mobile panel ограничена viewport, имеет свой scroll.

## 19. Full page

`/dashboard/notifications`, только current recipient, по 20 записей с pagination,
noindex, loading/error/empty states и защитой приватных страниц при BFCache restore.
Навигация добавлена в dashboard и меню аккаунта. Уведомления переживают смену сессии.

## 20. Mark as read

Строгий input содержит только notificationId. requireAuth и свежая ban-проверка
под User lock; owned lookup и updateMany по recipientId, id, readAt=null.
Чужой/несуществующий ID даёт одинаковую ошибку. Повтор сохраняет прежний timestamp.
Server Action инвалидирует layout, а навигация использует свежий серверный href.
GET/prefetch не мутируют. При сетевой ошибке UI показывает сообщение и допускает retry.

## 21. Mark all

Один updateMany по recipientId=current AND readAt IS NULL. Чужие записи и уже
прочитанные timestamps не меняются. Новые события, конкурентно появившиеся после
этого statement, могут оставаться непрочитанными. Нет клиентского перечня IDs.

## 22. Deep links и privacy

Moderation — собственная история на нужной странице и anchor конкретной revision;
query revision поддерживает старые решения среди более новых версий.
Follower publication — текущая публичная статья; NEW_FOLLOWER — текущий доступный
профиль; comments/replies — #comments. Точная ветка иногда требует раскрытия replies.

Batch queries выбирают только public article titles, собственные reviewed titles
и ID доступных comments. Тексты комментариев вообще не выбираются. DTO не содержит
email, tokens, raw relations или private title другого автора. Hidden/deleted/banned
comment и недоступная публикация дают нейтральное описание без ссылки; read остаётся
доступным. После изменения visibility новая загрузка соблюдает её, уже доставленный
в браузер текст отозвать невозможно. Произвольный URL клиента нигде не принимается.

## 23. Prisma changes

Notification и enum, обратные User/Article/ArticleRevision/Comment relations.
Остальные модели и существующие constraints сохранены. Новых зависимостей нет.

## 24. Migration

`20260928160000_notifications`, получена offline Prisma schema diff и применена
к прежней development Neon через db:deploy. Только additive DDL; старые шесть SQL
не редактировались. Reset/db push/удаление пользовательских данных не выполнялись.

## 25. Indexes

UNIQUE(recipientId,eventKey), recipientId/createdAt DESC/id DESC для истории,
recipientId/readAt для unread. Индексы actorId/articleId/revisionId/commentId
обслуживают внешние ключи и SetNull при удалении связанной сущности.
Лишнего индекса только по type нет.

## 26. Unit tests

11 новых tests/notifications.test.ts: strict action input, safe returnTo,
guest denial, recipient-specific COUNT, server pagination/sorting, relation feed
и отсутствие full content, masked unavailable comments, public titles, banned
actors, ownership и согласованность revision/article, точный history href.
Общий npm test: 105 PASS (94 прежних + 11 новых).

## 27. Integration

tests/notifications.integration.test.ts: 7 DB scenarios и отдельный browser case.
Реальные Better Auth sessions и create/save/submit/approve/reject, concurrent follow,
unfollow/refollow, failed/self actions, первая публикация и approved update,
unfollowed/banned recipients, repeated bulk event, concurrent/retry comment,
self root/reply, отсутствие двойного reply event, hide/delete privacy,
чужой read/forged input, readAt idempotency, mark all isolation, banned sessions,
транзакционный rollback, уникальность event, взаимные concurrent comments,
pagination/tied timestamps, archive/ban, SetNull удалённого Comment.

Первый завершённый DB run: 7 PASS, browser явно skipped. Следующий production
browser run: 8 PASS. Финальный повтор с pagination и logout/relogin: 8 PASS,
142,69 секунды. Fixtures создаются под случайными example.test аккаунтами;
cleanup удаляет только данные текущего теста. Прерванный запуск без итогового
результата не считается успешной проверкой.

## 28. Browser

Chromium/Playwright, настоящий production server и development PostgreSQL.
Проверены login, follow/unfollow и empty/feed, unread badge, Enter/Escape/focus,
preview без read, full page, открытие notification/read state, read all/reload,
раздельные аккаунты, rejected revision/reason, guest redirects без приватных данных.
Лента, full page и preview: 1440/768/390/320, 12 responsive views без overflow,
skip-link, отсутствие page errors. Screenshots в игнорируемой .playwright-mcp;
desktop feed и mobile preview просмотрены визуально. В browser harness credentials
передаются stdin, не сохраняются в файлы или логи.
Финальный прогон также проверил Next/Back между двумя страницами Following,
empty state после unfollow и восстановление ленты после refollow; read state
сохранился после настоящего logout и повторного login через форму.

## 29. Typecheck

npm run typecheck — PASS. Strict TypeScript сохранён, any/ts-ignore не добавлены.

## 30. Lint

npm run lint — PASS, zero warnings. ESLint 9 сохранён; правила не отключались.

## 31. Production build

npm run build — PASS. Новые маршруты динамические; browser QA использовал эту
production-сборку. Новых network dependencies для build не добавлено.

## 32. Prisma validation/status

npm run db:validate — PASS. npm run db:status — PASS, 7 migrations, schema up to date.
Финально SHA-256 всех семи SQL совпали с _prisma_migrations; незавершённых или
rolled-back migration нет. Остатков PHASE 4–7 QA identities — 0; конфликтующих
DRAFT/PENDING revisions — 0.

## 33. Regression tests

Auth integration: 2 PASS; articles integration: 4 PASS; moderation integration:
5 PASS; public-content integration: 4 PASS. Social integration: 8 PASS, включая
production-browser regression likes/bookmarks/follows/comment/reply/delete/
moderator hide/restore, HTML/Flight privacy, keyboard и 16 responsive views.
Вместе с PHASE 7: 31 integration cases, включая два browser cases.

Registration/login/logout/session/profile/ban проверены auth integration;
drafts/autosave version conflicts/ownership/image access — articles integration;
submit/approve/reject/concurrency — moderation. Public queries покрывают taxonomy,
search/pagination/SEO/current snapshot. Отдельные UI Tiptap toolbar, autosave и
весь PHASE 4–5 browser harness заново не запускались; прежний QA не выдаётся за новый.

## 34. Ограничения

- Fanout синхронный в transaction с timeout 25 секунд: протестирован реальный
  workflow, но не нагрузка миллионов followers. Для такого масштаба нужна отдельная
  durable strategy; текущая ошибка откатывает публикацию целиком без потери события.
- Offset pages до 1000. Нет realtime/polling/email; другая вкладка обновляется
  запросом/навигацией. Нет backfill старых событий и automatic notification cleanup.
- Comments link ведёт к обсуждению; нужный ответ может находиться на другой странице.
- Private Blob credentials и SITE_URL по-прежнему не настроены; cloud image E2E,
  deployment и production domain indexing не заявляются проверенными.
- VPN оставлен включённым. QA использует прежний временный loopback TLS tunnel
  через локальный proxy к той же Neon, с проверкой удалённого сертификата.
  .env и application network config не изменены. Постоянный маршрут это не исправляет.
- Проверен Chromium с desktop/mobile viewport, без физических устройств и других
  browser engines. Проверка восстановления после реального restart deployment
  отдельно не выполнялась; источник состояния — постоянные строки PostgreSQL.

## 35. Ручные действия

Просмотреть working tree и решить вопрос commit. В текущей development БД
миграция уже применена; в другой development среде выполнить npm run db:deploy
и db:generate. Для обычного запуска обеспечить устойчивый маршрут к своей Neon
при включённом VPN. Настроить private Blob и реальные SITE_URL/BETTER_AUTH_URL
при подготовке deployment. Новых secrets для PHASE 7 не требуется.

## 36. PHASE 8

Следующий этап по PROJECT_SPEC: reports, administration, moderation management
и analytics в отдельно согласованном задании. Ничего из PHASE 8 не реализовано.

Архитектурные решения и источники SQL/Next.js API добавлены в PROJECT_SPEC.md,
маршруты/настройки/тестовые команды — в README.md. AGENTS отражает разрешённую PHASE 7.

Финальная проверка 181 Git-visible файла: реальные env secrets и private keys
не обнаружены. Staging пуст; diff --check проходит. .env, generated Prisma,
.next и .playwright-mcp игнорируются. Финальные typecheck/lint повторно PASS.
Временные production server и TLS tunnel остановлены; порты 3000/15432 свободны.
Commit и push не выполнялись.
