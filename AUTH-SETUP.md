# OAuth setup (GitHub + Google)

The base already has **all the code** for GitHub and Google sign-in — providers,
env-var wiring, the `/sign-in` page, route protection, and account linking. You
only need to create OAuth apps and paste their keys into `.env`. Nothing to
commit; `.env` is gitignored, so this is per-project.

The app boots and runs fine with **no** keys — sign-in with a provider just
doesn't work until its pair is set.

> Replace `3000` below with your project's dev port if you changed the `dev`
> script (see `GETTING-STARTED.md` step 7).

---

## 1. GitHub (≈3 min)

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**
   (or **Register a new application**).
2. Fill in:
   | Field                                     | Value                                            |
   | ----------------------------------------- | ------------------------------------------------ |
   | Application name                          | anything (e.g. your project name)                |
   | Homepage URL                              | `http://localhost:3000`                          |
   | Authorization callback URL / Redirect URI | `http://localhost:3000/api/auth/callback/github` |
   - Leave "Enable Device Flow" unchecked.
3. **Register application.**
4. On the next page:
   - copy the **Client ID**
   - click **Generate a new client secret**, copy it
5. Put both in `.env`:
   ```bash
   AUTH_GITHUB_ID="Ov23li..."
   AUTH_GITHUB_SECRET="..."
   ```

---

## 2. Google (≈10 min — the console is fiddlier)

1. Go to <https://console.cloud.google.com> and create a project (or select one).

2. **APIs & Services → OAuth consent screen** (may appear as
   **Google Auth Platform → Branding**):
   - User type: **External** → Create
   - App name, **User support email**, **Developer contact email** → Save
   - **Audience** (or **Test users**): add your own Google email.
     While the app is in **Testing** mode, only listed test users can sign in —
     that's fine for development.
   - Scopes: the defaults (`openid`, `.../auth/userinfo.email`,
     `.../auth/userinfo.profile`) are all that's needed — don't add more.

3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:

   | Field                         | Value                                            |
   | ----------------------------- | ------------------------------------------------ |
   | Application type              | **Web application**                              |
   | Name                          | anything                                         |
   | Authorized JavaScript origins | `http://localhost:3000`                          |
   | Authorized redirect URIs      | `http://localhost:3000/api/auth/callback/google` |

   Click **Create**.

4. Copy the **Client ID** (`....apps.googleusercontent.com`) and the
   **Client secret** (`GOCSPX-...`).

5. Put both in `.env`:
   ```bash
   AUTH_GOOGLE_ID="....apps.googleusercontent.com"
   AUTH_GOOGLE_SECRET="GOCSPX-..."
   ```

---

## 3. Apply and test

1. Restart the dev server (env changes are not hot-reloaded):
   ```bash
   pnpm dev
   ```
2. Open `/sign-in`, click **Continue with GitHub** or **Continue with Google**.
3. You should land on `/dashboard`.

`AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` / `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
are picked up automatically by Auth.js from their names — no code changes.

---

## Gotchas

### "Same email, different provider" → already handled

If you sign up with GitHub and later use Google (or vice versa) with the same
email, Auth.js would normally throw `OAuthAccountNotLinked`. The base enables
`allowDangerousEmailAccountLinking` for both providers in `src/auth.config.ts`,
so the same email = one account either way. This is safe **only** because GitHub
and Google both verify email ownership — don't set that flag on a provider that
doesn't.

### `JWTSessionError: no matching decryption secret`

A stale session cookie from another project on the same `localhost` port, or a
changed `AUTH_SECRET`. Fix: DevTools → **Application → Clear site data**, or use
an incognito window. Prevent it by giving each project its own dev port.

### Callback URL must match exactly

`http` vs `https`, port number, and trailing path all matter. If you run on
`:3001`, the callback URL in the provider settings must be
`http://localhost:3001/api/auth/callback/<provider>`. You can add multiple
callback URLs to one OAuth app (e.g. `:3000` and `:3001`).

### Google: test users only

Until you **Publish** the OAuth consent screen, only emails listed as test users
can sign in. Publishing to "Production" for basic scopes (`email`, `profile`,
`openid`) does **not** require Google's verification review.

---

## Going to production

- Add your real domain's callback URL to each OAuth app
  (`https://yourapp.com/api/auth/callback/github`, etc.).
- Prefer a **dedicated OAuth app per deployed environment** (prod, staging) with
  their own secrets, rather than reusing the localhost app.
- Set `AUTH_SECRET` and all `AUTH_*` vars in your host's environment settings
  (Vercel project → Settings → Environment Variables), not in a committed file.
- Set `AUTH_URL` (or `NEXTAUTH_URL`) to the deployed origin if Auth.js can't
  infer it.
- Publish the Google consent screen.

---

## Changing which providers are offered

Edit `src/auth.config.ts`:

```ts
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// ...
providers: [
  GitHub({ allowDangerousEmailAccountLinking: true }),
  // drop Google by removing it here, or add others:
  // Resend, Nodemailer (email magic links), Credentials (username/password), ...
],
```

Then update the buttons in `src/app/sign-in/sign-in-buttons.tsx` to match, and
the provider list in `src/env.ts` if you add new `AUTH_*` vars.
