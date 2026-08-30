# React & App Router refresher

A conceptual refresher on how modern React and the Next.js App Router work — for
returning developers. For project setup steps see [SETUP.md](SETUP.md); for OAuth
see [AUTH-SETUP.md](AUTH-SETUP.md).

---

## How React + the App Router work

If your memory is class components, `create-react-app`, `componentDidMount`, and
Redux: the core idea is unchanged, the machinery is simpler.

### The one mental model

> A component is a **function** that takes data (**props**) and returns markup
> (**JSX**). When its data changes, React re-runs the function and updates only
> the DOM that differs.

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}
```

- No classes — everything is a function.
- `{name}` drops a JS value into markup; `{}` means "back to JavaScript".
- Lists: `{items.map((i) => <li key={i.id}>{i.text}</li>)}` — `key` must be a
  stable unique id.
- Conditionals: `{isOpen && <Panel />}` or `{isOpen ? <A /> : <B />}`.

### State = "data that changes"

```tsx
"use client";
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0); // [value, setter]
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Call the setter → React re-runs the component → the DOM updates. You never touch
the DOM yourself.

| Hook                  | For                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `useState`            | local UI state (input value, toggle, active tab)                                                 |
| `useEffect`           | sync with something _outside_ React (subscriptions, `localStorage`). Not for data fetching here. |
| `useContext`          | read shared state without prop-drilling                                                          |
| custom hooks (`useX`) | reusable stateful logic — just functions whose names start with `use`                            |

### The new part: Server Components

In the App Router, components run **on the server by default**. A page is an
`async` function that can hit the database directly — no `useEffect`, no `/api`
route, no loading plumbing.

```tsx
// src/app/dashboard/page.tsx — runs on the server
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const tasks = await prisma.task.findMany(); // direct DB call
  return (
    <ul>
      {tasks.map((t) => (
        <li key={t.id}>{t.title}</li>
      ))}
    </ul>
  );
}
```

The server renders it to HTML and sends that down. DB credentials never reach the
browser.

### When you need the browser: `"use client"`

The moment you need `onClick`, `useState`, `useEffect`, or a browser API, put
`"use client"` at the top of that file. It then also runs in the browser and can
be interactive.

**Rule of thumb:** keep pages and layouts as server components; push
`"use client"` down to small interactive leaves (a button, a form, a menu).
Fetch data in the server parent, pass it as props to the client child.

In this base:

- server (no directive): `src/app/page.tsx`, `src/app/dashboard/page.tsx`, `src/components/site-header.tsx`
- `"use client"`: `theme-toggle.tsx`, `user-menu.tsx`, `sign-in-buttons.tsx`

### Changing data: Server Actions

To write (submit a form, create a row), write a `"use server"` function and hand
it to a `<form>`:

```tsx
// src/lib/actions/task.ts
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function createTask(formData: FormData) {
  await prisma.task.create({ data: { title: String(formData.get("title")) } });
  revalidatePath("/dashboard"); // mark the page's data stale so it refetches
}
```

```tsx
<form action={createTask}>
  <input name="title" />
  <button type="submit">Add</button>
</form>
```

No `fetch`, no API endpoint. `src/lib/actions/auth.ts` is this exact pattern.

### Routing = folders

```
src/app/
  page.tsx              →  /
  layout.tsx            →  wraps everything (html, providers)
  dashboard/
    page.tsx            →  /dashboard
    layout.tsx          →  wraps /dashboard/*
  sign-in/
    page.tsx            →  /sign-in
```

- `page.tsx` = a visitable route
- `layout.tsx` = shared shell around child routes (persists across navigation)
- navigate with `<Link href="/dashboard">` from `next/link`, not `<a>`

### Where state should live (in order of preference)

1. **URL** (`?tab=settings`) — shareable, survives refresh
2. **Server / database** — the source of truth for real data
3. **Local `useState`** — ephemeral UI only (is this dropdown open?)
4. **Context** — a few app-wide values many components read (theme, current user)

You almost certainly don't need Redux — that class of problem mostly went away
when data fetching moved to the server.

### Your loop when building a feature

1. Add a route folder + `page.tsx` (server component).
2. Fetch what it needs with `await prisma.…` right in the component.
3. Render JSX. Add UI with `npx shadcn@latest add <name> -o` if needed.
4. Button/form that changes data? Write a `"use server"` action, wire it to
   `<form action={…}>`.
5. Need client interactivity? Pull that bit into its own `"use client"` component.
6. `pnpm dev` hot-reloads — save and look.
