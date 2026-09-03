# ProgFrog

A personal gym-progress tracker — log workouts set by set, follow your splits,
and watch strength trend over time. Built mobile-first and installable as a PWA,
with offline logging so a dead signal in the weights room never costs you a set.

## What it does

- **Workout logger** — start freestyle or from a template day; log weight × reps
  (or timed holds) per set, mark warm-up / drop / failure sets, superset and
  drop-set links, a built-in rest timer. Finished sessions are numbered in the
  order you trained them (`#41` in the corner), not titled per day.
- **Templates** — define your split once (Push / Pull / Legs, etc.) and start a
  session pre-filled from any day, or build a template day straight from a
  workout you already logged (as the exact exercises, or as open muscle-group
  slots you fill in each session).
- **Progress** — estimated 1-rep max, heaviest set and total volume per exercise
  or per muscle group, plus bodyweight tracking. The dashboard also grids working sets
  per muscle group across the last twelve training weeks, with a true weekly rate
  (sets ÷ the elapsed block, so a 6- or 8-day split still reads right) and a
  per-session figure.
- **Offline-first** — a service worker precaches the active workout; mutations
  queue in a localStorage outbox and replay on reconnect, with idempotency keys
  so a crash-replay never double-writes.
- **Installs like an app** — standalone display, maskable icons, iOS launch
  screens, app shortcuts, and haptics; Instagram-style swipe between tabs. Reduced-
  motion and increased-contrast preferences are honoured, targets meet WCAG 2.2.
- **Training assistant** (optional) — an in-app chat that can see your recent
  training; only shown when `ANTHROPIC_API_KEY` is set.

## Stack

| Concern     | Choice                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| Framework   | [Next.js 16](https://nextjs.org) (App Router, Turbopack)                                  |
| Language    | TypeScript (strict)                                                                       |
| Styling     | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com)                                      |
| Auth        | [Auth.js v5](https://authjs.dev) — email + password, Google / Facebook / X, JWT           |
| Database    | PostgreSQL ([Neon](https://neon.tech)) + [Prisma 7](https://www.prisma.io) (pg adapter)   |
| Charts      | [Recharts](https://recharts.org)                                                          |
| PWA         | Web manifest + hand-rolled service worker (`public/sw.js`) + iOS launch screens           |
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

### Sign-in

**Email + password** works out of the box. Verification and reset links go out
via [Resend](https://resend.com); set `RESEND_API_KEY`. If the key is unset — or
Resend rejects the send — the link is written to the server log (`[email:link]`)
so it's still recoverable.

`EMAIL_FROM` defaults to `ProgFrog <onboarding@resend.dev>`, Resend's shared
sender, which **only delivers to your own Resend-account address**. To email
other people you must verify a domain you own in Resend and point `EMAIL_FROM`
at an address on it (`noreply@yourdomain.com`) — you can't verify `*.vercel.app`.

`pnpm db:seed` creates a `demo@example.com` user.

**OAuth providers** are all optional and only appear once their `_ID` / `_SECRET`
pair is set (`AUTH_GOOGLE_*`, `AUTH_FACEBOOK_*`, `AUTH_TWITTER_*` — Auth.js reads
them by name).

For **each** provider, register **both** callback URLs on the provider's console
(they all accept a list — you don't pick one):

|                                    | dev                                                  | production                                                 |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| redirect / callback URL            | `http://localhost:3001/api/auth/callback/<provider>` | `https://progfrog.vercel.app/api/auth/callback/<provider>` |
| JS origin (where the console asks) | `http://localhost:3001`                              | `https://progfrog.vercel.app`                              |

`<provider>` is `google`, `facebook`, or `twitter`. Then paste the ID/secret into
`.env` (dev) and the Vercel project's env vars (prod).

- Google — <https://console.cloud.google.com/apis/credentials>
- Facebook — <https://developers.facebook.com/apps> (the `email` permission needs
  Meta App Review before non-testers can use it)
- X / Twitter — <https://developer.x.com> (OAuth 2.0; X returns **no** email, so
  those accounts have no address on file — `User.email` is nullable for this)

Same email across Google/Facebook resolves to one account
(`allowDangerousEmailAccountLinking`, safe because both verify email ownership).
A `JWTSessionError: no matching decryption secret` means a stale cookie from
another app on the same port or a changed `AUTH_SECRET` — clear site data. A
`redirect_uri_mismatch` means the URL above isn't registered for that provider.
In production also set `AUTH_URL` + `APP_URL` to the deployed origin.

## Scripts

| Script            | Does                                                |
| ----------------- | --------------------------------------------------- |
| `pnpm dev`        | Dev server on :3001                                 |
| `pnpm build`      | `prisma generate` + production build                |
| `pnpm start`      | Serve the production build                          |
| `pnpm typecheck`  | `next typegen` + `tsc --noEmit`                     |
| `pnpm lint`       | ESLint                                              |
| `pnpm format`     | Prettier write (`format:check` in CI)               |
| `pnpm test`       | Vitest once (`test:watch` for watch mode)           |
| `pnpm test:e2e`   | Playwright (builds + starts the app first)          |
| `pnpm db:migrate` | Create/apply a dev migration                        |
| `pnpm db:deploy`  | Apply migrations (CI/prod)                          |
| `pnpm db:seed`    | Run `prisma/seed.ts`                                |
| `pnpm db:studio`  | Prisma Studio                                       |
| `pnpm gen:icons`  | Rasterise the PWA icons from the source SVG         |
| `pnpm gen:splash` | Rasterise the iOS launch screens (`public/splash/`) |

## Layout

```
src/
  app/
    api/auth/[...nextauth]/route.ts  Auth.js route handlers
    api/chat/route.ts                training-assistant streaming endpoint
    dashboard/                       the app (protected — proxy + DAL)
      layout.tsx                     fetches every tab's data, renders the pager
      page.tsx  workouts/  progress/  templates/  exercises/   tab routes (panes)
      workouts/[id] (logger)  workouts/new  templates/[id] (editor)  settings/
    offline/                         service-worker fallback screen
    sign-in/  layout.tsx  manifest.ts  globals.css
  components/
    dashboard/                       tab pager + the five tab panes
    workout/                         logger, wheel field, rest timer, pickers
    ui/                              shadcn components (yours to edit)
    pwa/                             service-worker registration, install button
  lib/
    prisma.ts                        PrismaClient singleton (pg driver adapter)
    dal.ts                           Data Access Layer — auth checks live here
    offline-queue.ts                 localStorage mutation outbox + replay
    password.ts auth-tokens.ts email.ts oauth.ts rate-limit.ts   auth helpers
    haptics.ts  training.ts          domain helpers
    actions/                         server actions (workouts, templates, auth, …)
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
  splash/                            generated iOS launch screens
```

## Notes on the modern bits

- **Middleware is now `proxy.ts`** (Next.js 16 rename). It only does optimistic
  redirects; real authorization is re-checked in `src/lib/dal.ts`.
- **Prisma 7** has no query engine binary — it uses a driver adapter
  (`@prisma/adapter-pg`). The client generates into `src/generated/prisma`, and
  the datasource URL lives in `prisma.config.ts`, not `schema.prisma`.
- **Env vars** are validated on import of `src/env.ts` (also imported by
  `next.config.ts`). Set `SKIP_ENV_VALIDATION=1` to bypass (Docker build, some CI).
- **Tab pager** — `dashboard/layout.tsx` fetches every tab's data once and
  renders the five tabs as always-mounted panes inside
  `src/components/dashboard/tab-pager.tsx`. A swipe drags the strip 1:1 and
  snaps with `history.pushState` — no navigation, no re-render, scroll position
  kept per tab. Detail routes (`/workouts/[id]`, editors) fall through to
  `{children}`. Mutations call `revalidatePath("/dashboard", "layout")`.
- **Optimistic client state** — the logger, template editor, exercise manager
  and body view own their list state and apply edits locally first, then fire a
  server action. See `src/lib/offline-queue.ts` for the offline outbox.
- **Mobile & a11y** — a global reduced-motion / contrast safety net lives in
  `globals.css`; response security headers (CSP, HSTS, frame-ancestors) are set
  in `next.config.ts`.

## Deploy

- **Vercel**: import the repo, point at a Neon database, and set the env vars
  from `.env.example` — at minimum `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` +
  `APP_URL` (the deployed origin), plus any OAuth pairs / `RESEND_API_KEY` /
  `ANTHROPIC_API_KEY` you're using. Build command stays `pnpm build`; run
  `pnpm db:deploy` on schema changes (it is **not** run automatically on deploy).
- **Docker**: `docker build -t progfrog .` then run with `DATABASE_URL` +
  `AUTH_SECRET` injected.
