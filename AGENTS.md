# Narra development

Read PROJECT_SPEC.md before every development phase. It is the source of truth
for scope, architecture, security, business rules, and design direction.

Only PHASE 1 is authorized. Do not start PHASE 2 or later without a separate
user instruction. Do not install auth/editor/social integrations ahead of time.

Use npm. Preserve strict TypeScript and Server Components by default. Demo
content belongs exclusively to the presentation layer; it is not a backend.
Never commit environment secrets. Use Prisma migrations, not db push.

After relevant changes run npm run typecheck, npm run lint, npm run build,
and npm run db:validate. Applying migrations requires a real development
DATABASE_URL. Do not invent credentials or use production credentials.
