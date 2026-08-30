# New project setup

Step-by-step for spinning up a new app from this template. ~15 minutes.

Related docs: [AUTH-SETUP.md](AUTH-SETUP.md) (OAuth providers),
[GETTING-STARTED.md](GETTING-STARTED.md) (React / App Router refresher).

---

## A. Create the repo and database (browser)

1. **This repo → "Use this template" → Create a new repository.**
   Name it (e.g. `taskflow`), create it.
2. **[Neon](https://neon.tech) → New Project** (a new project, not a branch).
   Copy the connection string — looks like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`.

## B. Get it running locally (terminal)

3. Clone your new repo:

   ```bash
   git clone https://github.com/EL00SE/taskflow.git
   cd taskflow
   ```

4. Create the env file:

   ```bash
   cp .env.example .env
   ```

5. In `.env`, set `DATABASE_URL` to the Neon string from step 2.

6. Generate an auth secret and paste the printed line into `.env`, replacing the
   empty `AUTH_SECRET=""`:

   ```bash
   node -e "console.log('AUTH_SECRET=\"'+require('crypto').randomBytes(32).toString('base64')+'\"')"
   ```

   > Not `npx auth secret` — on this setup it resolves to the wrong package.

7. Give the project its own dev port (so browser cookies don't collide with your
   other local projects — a shared `localhost` port causes `JWTSessionError`).
   In `package.json`:

   ```json
   "dev": "next dev -p 3001",
   ```

   Pick a different number per project. `PORT` in `.env` does **not** work — Next
   chooses the port before reading `.env`.

8. Install:

   ```bash
   pnpm install
   ```

9. Create the database tables:

   ```bash
   pnpm db:migrate
   ```

   Name the migration `init` when prompted. _(If you're changing the data model,
   do section D first.)_

10. _(Optional)_ sample data — edit `prisma/seed.ts` to match your models first:

    ```bash
    pnpm db:seed
    ```

11. Run it:

    ```bash
    pnpm dev
    ```

    Open the URL it prints (e.g. `http://localhost:3001`).

## C. Final touches

12. **OAuth** (only if you need login) — follow [AUTH-SETUP.md](AUTH-SETUP.md).
    Quick path: add `http://localhost:3001/api/auth/callback/github` as a
    callback URL on your existing GitHub OAuth app and reuse its
    `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` in `.env`.

13. **Rebrand:**
    - `name` in `package.json`
    - `title` in `src/app/layout.tsx`
    - the `"app-base"` text in `src/components/site-header.tsx` and
      `src/app/page.tsx`
    - rewrite `README.md`

14. **Sanity check** — all three should pass on a fresh clone:

    ```bash
    pnpm typecheck && pnpm lint && pnpm test
    ```

15. **Commit:**

    ```bash
    git add -A
    git commit -m "Project setup"
    git push
    ```

---

## D. Reshaping the data model (Prisma)

Edit `prisma/schema.prisma`, then run a migration.

1. **Keep** the auth models: `User`, `Account`, `Session`, `VerificationToken` —
   Auth.js needs them.
2. **Replace** the example `Post` model with your domain. Example:

   ```prisma
   model User {
     // ...keep the existing fields...
     projects Project[]   // a relation field for each model owned by a user
   }

   model Project {
     id        String   @id @default(cuid())
     name      String
     ownerId   String
     owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
     tasks     Task[]
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@index([ownerId])
   }

   model Task {
     id        String     @id @default(cuid())
     title     String
     status    TaskStatus @default(TODO)
     projectId String
     project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
     createdAt DateTime   @default(now())

     @@index([projectId])
   }

   enum TaskStatus {
     TODO
     IN_PROGRESS
     DONE
   }
   ```

   Remove the old `Post` model and the `posts Post[]` line on `User`.

3. Apply:

   ```bash
   pnpm db:migrate
   ```

   Name it e.g. `add_projects_and_tasks`. This writes a migration folder (commit
   it), applies it to Neon, and regenerates the typed client.

4. Use it — full autocomplete:

   ```ts
   import { prisma } from "@/lib/prisma";

   const projects = await prisma.project.findMany({
     where: { ownerId: user.id },
     include: { tasks: true },
   });
   ```

### Blank slate instead

To drop the shipped `base` migration entirely (empty / throwaway DB only):

```bash
rm -r prisma/migrations
# edit schema.prisma
pnpm db:migrate      # creates one fresh initial migration
```

---

## Command reference

| Command                          | Use                                                         |
| -------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                       | dev server (hot reload)                                     |
| `pnpm build` / `pnpm start`      | production build / run                                      |
| `pnpm typecheck`                 | `tsc --noEmit`                                              |
| `pnpm lint` / `pnpm format`      | ESLint / Prettier                                           |
| `pnpm test`                      | Vitest unit tests                                           |
| `pnpm test:e2e`                  | Playwright end-to-end tests                                 |
| `pnpm db:migrate`                | schema change → migration file + apply (use normally)       |
| `pnpm db:push`                   | push schema straight to DB, no migration file (prototyping) |
| `pnpm db:seed`                   | run `prisma/seed.ts`                                        |
| `pnpm db:studio`                 | browse/edit rows in a GUI                                   |
| `pnpm exec prisma migrate reset` | wipe + replay migrations + reseed (dev only)                |

---

## Troubleshooting

| Symptom                                          | Cause / fix                                                                                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install` fails at `prisma generate`        | `.env` missing — run `cp .env.example .env` first                                                                                 |
| `JWTSessionError: no matching decryption secret` | stale cookie from another project on the same port — DevTools → Application → Clear site data, and set a unique dev port (step 7) |
| Sign-in doesn't reach `/dashboard`               | OAuth keys not set, or callback URL doesn't match your port — see [AUTH-SETUP.md](AUTH-SETUP.md)                                  |
| `pg` SSL warning on every DB command             | harmless; to silence, change `sslmode=require` → `sslmode=verify-full` in `DATABASE_URL`                                          |
| Port 3000 already in use                         | another dev server — `npx kill-port 3000`, or just use your own port from step 7                                                  |
