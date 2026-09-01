# ProgFrog

A personal gym-progress tracker — log workouts set by set, follow your splits,
and watch strength trend over time. Built mobile-first and installable as a PWA,
with offline logging so a dead signal in the weights room never costs you a set.

## What it does

- **Workout logger** — start freestyle or from a template day; log weight × reps
  (or timed holds) per set, mark warm-up / drop / failure sets, superset and
  drop-set links, a built-in rest timer.
- **Templates** — define your split once (Push / Pull / Legs, etc.) and start a
  session pre-filled from any day.
- **Progress** — estimated 1-rep max, heaviest set and total volume per exercise
  or muscle role, plus bodyweight tracking.
- **Offline-first** — a service worker precaches the active workout; mutations
  queue in a localStorage outbox and replay on reconnect, with idempotency keys
  so a crash-replay never double-writes.
- **Training assistant** (optional) — an in-app chat that can see your recent
  training; only shown when `ANTHROPIC_API_KEY` is set.

## Stack

| Concern     | Choice                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| Framework   | [Next.js 16](https://nextjs.org) (App Router, Turbopack)                                  |
| Language    | TypeScript (strict)                                                                       |
| Styling     | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com)                                      |
| Auth        | [Auth.js v5](https://authjs.dev) — GitHub + Google, JWT                                   |
| Database    | PostgreSQL ([Neon](https://neon.tech)) + [Prisma 7](https://www.prisma.io) (pg adapter)   |
| Charts      | [Recharts](https://recharts.org)                                                          |
| PWA         | Web manifest + hand-rolled service worker (`public/sw.js`)                                |
| Assistant   | [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) (streaming) |
| Env safety  | [@t3-oss/env-nextjs](https://env.t3.gg) + Zod                                             |
| Unit tests  | Vitest + Testing Library                                                                  |
| E2E tests   | Playwright                                                                                |
| Lint/format | ESLint + Prettier, Husky + lint-staged pre-commit                                         |
| CI          | GitHub Actions                                                                            |

## Quick start

```bash
pnpm install
cp .env.example .env          # fill in DATABASE_URL + AUTH_SECRET (OAuth keys optional)
pnpm db:deploy                # apply migrations
pnpm db:seed                  # demo user + sample workouts
pnpm dev
```

App runs at http://localhost:3001.

A local Postgres via `docker compose up -d db` works too, but the project
targets Neon in dev and prod.

### Generate an auth secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste it into `.env` as `AUTH_SECRET`.

### OAuth credentials

Sign-in is GitHub + Google only (no email/password). The app boots without keys
— provider sign-in just won't work until a pair is set. `pnpm db:seed` creates a
`demo@example.com` user with a sample training history.

Create an OAuth app with each provider and put the ID/secret pairs in `.env`
(`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
— Auth.js picks them up by name). Callback URLs, for the `:3001` dev port:

- GitHub — <https://github.com/settings/developers> → `http://localhost:3001/api/auth/callback/github`
- Google — <https://console.cloud.google.com/apis/credentials> → `http://localhost:3001/api/auth/callback/google`
  (add your own email as a test user while the consent screen is in Testing mode)

Same email across both providers resolves to one account
(`allowDangerousEmailAccountLinking` in `src/auth.config.ts` — safe here only
because both providers verify email ownership). A `JWTSessionError: no matching
decryption secret` means a stale cookie from another app on the same port or a
changed `AUTH_SECRET` — clear site data or use a private window. For production,
add the deployed-domain callback URLs and set every `AUTH_*` var in the host's
environment.

## Scripts

| Script            | Does                                        |
| ----------------- | ------------------------------------------- |
| `pnpm dev`        | Dev server on :3001                         |
| `pnpm build`      | `prisma generate` + production build        |
| `pnpm start`      | Serve the production build                  |
| `pnpm typecheck`  | `next typegen` + `tsc --noEmit`             |
| `pnpm lint`       | ESLint                                      |
| `pnpm format`     | Prettier write (`format:check` in CI)       |
| `pnpm test`       | Vitest once (`test:watch` for watch mode)   |
| `pnpm test:e2e`   | Playwright (builds + starts the app first)  |
| `pnpm db:migrate` | Create/apply a dev migration                |
| `pnpm db:deploy`  | Apply migrations (CI/prod)                  |
| `pnpm db:seed`    | Run `prisma/seed.ts`                        |
| `pnpm db:studio`  | Prisma Studio                               |
| `pnpm gen:icons`  | Rasterise the PWA icons from the source SVG |

## Layout

```
src/
  app/
    api/auth/[...nextauth]/route.ts  Auth.js route handlers
    api/chat/route.ts                training-assistant streaming endpoint
    dashboard/                       the app (protected — proxy + DAL)
      page.tsx                       scoreboard: streak, all-time, this week
      workouts/                      history, [id] logger, new (start picker)
      templates/                     split editor
      progress/                      1RM / volume / bodyweight charts
      exercises/  settings/
    offline/                         service-worker fallback screen
    sign-in/  layout.tsx  manifest.ts  globals.css
  components/
    workout/                         logger, wheel field, rest timer, pickers
    ui/                              shadcn components (yours to edit)
    pwa/                             service-worker registration, install button
  lib/
    prisma.ts                        PrismaClient singleton (pg driver adapter)
    dal.ts                           Data Access Layer — auth checks live here
    offline-queue.ts                 localStorage mutation outbox + replay
    haptics.ts  training.ts          domain helpers
    actions/                         server actions (workouts, templates, …)
    queries/                         read models
  auth.ts  auth.config.ts            Auth.js config (split: edge-safe + full)
  proxy.ts                           Next 16 "proxy" (was middleware)
  env.ts                             validated environment variables
  generated/prisma/                  generated client (gitignored)
prisma/
  schema.prisma  seed.ts  migrations/
prisma.config.ts                     Prisma 7 config (schema path, datasource URL)
public/
  sw.js                              service worker (precache + offline nav)
```

## Notes on the modern bits

- **Middleware is now `proxy.ts`** (Next.js 16 rename). It only does optimistic
  redirects; real authorization is re-checked in `src/lib/dal.ts`.
- **Prisma 7** has no query engine binary — it uses a driver adapter
  (`@prisma/adapter-pg`). The client generates into `src/generated/prisma`, and
  the datasource URL lives in `prisma.config.ts`, not `schema.prisma`.
- **Env vars** are validated on import of `src/env.ts` (also imported by
  `next.config.ts`). Set `SKIP_ENV_VALIDATION=1` to bypass (Docker build, some CI).
- **Optimistic client state** — the logger, template editor, exercise manager
  and body view own their list state and apply edits locally first, then fire a
  server action; server actions revalidate the narrowest path. See
  `src/lib/offline-queue.ts` for the offline outbox.

## Deploy

- **Vercel**: import the repo, set env vars (`DATABASE_URL`, `AUTH_SECRET`,
  OAuth pairs, optional `ANTHROPIC_API_KEY`), point at a Neon database. Build
  command stays `pnpm build`; run `pnpm db:deploy` on schema changes.
- **Docker**: `docker build -t progfrog .` then run with `DATABASE_URL` +
  `AUTH_SECRET` injected.
