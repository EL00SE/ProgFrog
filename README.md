# app-base

A batteries-included Next.js starter to fork whenever you begin a new project.

> New project from this template? **[SETUP.md](SETUP.md)** — the step-by-step.
> Also: **[AUTH-SETUP.md](AUTH-SETUP.md)** (OAuth) ·
> **[GETTING-STARTED.md](GETTING-STARTED.md)** (React / App Router refresher).

## Stack

| Concern     | Choice                                                      |
| ----------- | ----------------------------------------------------------- |
| Framework   | [Next.js 16](https://nextjs.org) (App Router, Turbopack)    |
| Language    | TypeScript (strict)                                         |
| Styling     | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com)        |
| Auth        | [Auth.js v5](https://authjs.dev) — GitHub + Google, JWT     |
| Database    | PostgreSQL + [Prisma 7](https://www.prisma.io) (pg adapter) |
| Env safety  | [@t3-oss/env-nextjs](https://env.t3.gg) + Zod               |
| Forms       | React Hook Form + Zod                                       |
| Unit tests  | Vitest + Testing Library                                    |
| E2E tests   | Playwright                                                  |
| Lint/format | ESLint + Prettier, Husky + lint-staged pre-commit           |
| CI          | GitHub Actions                                              |
| Container   | Multi-stage Dockerfile (standalone) + docker-compose DB     |

## Quick start

```bash
pnpm install
cp .env.example .env          # then fill in AUTH_SECRET + OAuth keys
docker compose up -d db       # local Postgres on :5432
pnpm db:migrate               # create the schema
pnpm db:seed                  # optional sample data
pnpm dev
```

App runs at http://localhost:3000. Adminer (DB UI) at http://localhost:8080 once `docker compose up -d` is running.

### Generate an auth secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste it into `.env` as `AUTH_SECRET`.

### OAuth credentials

Full walkthrough for both providers: **[AUTH-SETUP.md](AUTH-SETUP.md)**.

- **GitHub**: https://github.com/settings/developers → callback `http://localhost:3000/api/auth/callback/github`
- **Google**: https://console.cloud.google.com/apis/credentials → callback `http://localhost:3000/api/auth/callback/google`

Sign-in with a provider only works once its `AUTH_*_ID` / `AUTH_*_SECRET` pair is set; the app boots fine without them.

## Scripts

| Script            | Does                                       |
| ----------------- | ------------------------------------------ |
| `pnpm dev`        | Dev server                                 |
| `pnpm build`      | `prisma generate` + production build       |
| `pnpm start`      | Serve the production build                 |
| `pnpm typecheck`  | `next typegen` + `tsc --noEmit`            |
| `pnpm lint`       | ESLint                                     |
| `pnpm format`     | Prettier write (`format:check` in CI)      |
| `pnpm test`       | Vitest once (`test:watch` for watch mode)  |
| `pnpm test:e2e`   | Playwright (builds + starts the app first) |
| `pnpm db:migrate` | Create/apply a dev migration               |
| `pnpm db:deploy`  | Apply migrations (CI/prod)                 |
| `pnpm db:seed`    | Run `prisma/seed.ts`                       |
| `pnpm db:studio`  | Prisma Studio                              |

## Layout

```
src/
  app/
    api/auth/[...nextauth]/route.ts  Auth.js route handlers
    dashboard/                       protected area (proxy + DAL)
    sign-in/                         OAuth sign-in page
    layout.tsx  page.tsx  globals.css
  components/
    ui/                             shadcn components (yours to edit)
    site-header.tsx  theme-*.tsx  user-menu.tsx
  lib/
    prisma.ts                       PrismaClient singleton (pg driver adapter)
    dal.ts                          Data Access Layer — auth checks live here
    actions/auth.ts                 sign-in / sign-out server actions
    utils.ts
  auth.ts  auth.config.ts           Auth.js config (split: edge-safe + full)
  proxy.ts                          Next 16 "proxy" (was middleware)
  env.ts                            validated environment variables
  generated/prisma/                 generated client (gitignored)
prisma/
  schema.prisma  seed.ts
prisma.config.ts                    Prisma 7 config (schema path, datasource URL)
```

## Notes on the modern bits

- **Middleware is now `proxy.ts`** (Next.js 16 rename). It only does optimistic
  redirects; real authorization is re-checked in `src/lib/dal.ts`.
- **Prisma 7** has no query engine binary — it uses a driver adapter
  (`@prisma/adapter-pg`). The client generates into `src/generated/prisma`.
- **Env vars** are validated on import of `src/env.ts` (also imported by
  `next.config.ts`). Set `SKIP_ENV_VALIDATION=1` to bypass (Docker build, some CI).

## Deploy

- **Vercel**: import the repo, set env vars, add a Postgres (Neon/Vercel Postgres). Build command stays `pnpm build`; add `pnpm db:deploy` as needed.
- **Docker**: `docker build -t app-base .` then run with `DATABASE_URL` + `AUTH_SECRET` injected.

## Trim it down

Not every project needs all of this. Safe to remove: `Post` model + seed, the
`dashboard` route, one OAuth provider, Docker files, or the Playwright setup.
