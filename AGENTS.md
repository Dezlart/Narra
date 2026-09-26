# Narra development

Read PROJECT_SPEC.md before every development phase. It is the source of truth
for scope, architecture, security, business rules, and design direction.

PHASE 1–3 are complete. PHASE 4 (Moderation & Publishing) is authorized.
Do not start PHASE 5 or later without a separate user instruction. Preserve
existing migrations and article/revision publication constraints. Do not add public feeds/social features.

Use npm. Preserve strict TypeScript and Server Components by default. Demo
content belongs exclusively to the presentation layer; it is not a backend.
Never commit environment secrets. Use Prisma migrations, not db push.

After relevant changes run npm run typecheck, npm run lint, npm run build,
and npm run db:validate. Applying migrations requires a real development
DATABASE_URL. Do not invent credentials or use production credentials.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
