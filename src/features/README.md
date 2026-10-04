# Feature modules

PHASE 2 adds `auth` (validation, permissions and auth UI) and `users`
(profile validation, server action, application service and presentation).
Infrastructure and request guards live in `src/lib/auth`; Prisma in `src/lib/prisma`.
Keep application actions, validation, services, and database queries with their feature.
Unused PHASE 1 presentation demos were removed in PHASE 9. PHASE 3 adds `articles`: draft services/queries,
strict content validation, Tiptap UI/autosave, private Blob images and a safe React renderer.
Every private mutation authorizes inside its service. PHASE 4 adds `moderation`:
submission/review services, publication validation, bounded queue queries,
read-only preview and snapshot-scoped private images. PHASE 5 adds `public-content`:
shared public visibility/query rules, bounded catalogues/search, server-rendered
cards, SEO/sitemap and snapshot-scoped public access to private Blob objects.
The shared article renderer validates the original JSON on every render.
PHASE 6–8 add social, notifications, reports, administration and analytics modules.
Shared client controls live in components/ui; public report UI must not import
administrative forms. Publication, ownership and moderation remain server concerns.
