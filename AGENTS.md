<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

- Package manager: **pnpm**. Node 22+.
- **Auth.js v5** with JWT sessions. Config is split: `src/auth.config.ts` is
  edge-safe (no DB), `src/auth.ts` adds the Prisma adapter. The proxy imports
  only `auth.config.ts`.
- **Middleware is `src/proxy.ts`** (Next 16 rename). Keep it to optimistic
  redirects — do real auth checks in `src/lib/dal.ts` (`requireSession`,
  `getCurrentUser`), which is also where per-request DB access is centralized.
- **Prisma 7**: driver-adapter only (`@prisma/adapter-pg`), client generated to
  `src/generated/prisma` (gitignored — run `pnpm db:generate`). Datasource URL
  lives in `prisma.config.ts`, not `schema.prisma`. Import the client via
  `@/generated/prisma/client`; import `prisma` from `@/lib/prisma`.
- **Env vars**: add to `src/env.ts` (server/client blocks + `runtimeEnv`). Never
  read `process.env` directly in app code.
- **UI**: shadcn/ui components under `src/components/ui` are owned code — edit
  them. Add more with `npx shadcn@latest add <name> -o`. Icons: `lucide-react`
  (no brand icons — see `src/components/brand-icons.tsx`).
- Before committing, `pnpm typecheck && pnpm lint && pnpm test` must pass;
  `pnpm format` keeps Prettier happy (enforced by the pre-commit hook).
