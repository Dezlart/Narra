# Feature modules

PHASE 2 adds `auth` (validation, permissions and auth UI) and `users`
(profile validation, server action, application service and presentation).
Infrastructure and request guards live in `src/lib/auth`; Prisma in `src/lib/prisma`.
Keep application actions, validation, services, and database queries with their feature.
Presentation demo content lives in `src/components/home/demo-content.ts` and must
not be imported by services. PHASE 3 adds `articles`: draft services/queries,
strict content validation, Tiptap UI/autosave, private Blob images and a safe React renderer.
Every private mutation authorizes inside its service. Moderation and social features
remain outside the current phase.
