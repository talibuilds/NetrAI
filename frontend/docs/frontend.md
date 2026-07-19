# DAMMAGE — Frontend Notes

---

## Stack

| Piece | Detail |
|-------|--------|
| Framework | Next.js 15, App Router, React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 — CSS-based config, no `tailwind.config.ts` |
| Components | shadcn/ui in `components/ui/` |
| Auth | Auth.js v5 (`next-auth@beta`) |
| Fonts | Epilogue (display/headers) + Space Grotesk (body) |
| Package manager | pnpm |

---

## File Structure

```
frontend/
  app/
    (auth)/
      login/page.tsx        ← login page
      register/page.tsx     ← register page
    api/
      auth/
        [...nextauth]/route.ts   ← NextAuth handler
        register/route.ts        ← POST register endpoint
    globals.css             ← Tailwind v4 + all CSS custom properties
    layout.tsx              ← root layout, SessionProvider, Nav
    page.tsx                ← dashboard (currently static)
    roads/page.tsx          ← road detection page
    waste/page.tsx          ← waste detection page
    history/page.tsx        ← history page (currently static)
  components/
    nav.tsx                 ← top nav, session-aware (avatar/sign out)
    theme-provider.tsx
    theme-toggle.tsx
    ui/                     ← shadcn components
  lib/
    auth.ts                 ← full Auth.js config (MongoDB adapter + providers)
    mongodb.ts              ← MongoClient singleton
    utils.ts                ← cn() helper
  auth.config.ts            ← edge-safe auth config (middleware only)
  middleware.ts             ← route protection
  docs/                     ← this folder
```

---

## Theme / Design

Dark mode by default. Design language is bold editorial (inspired by The Verge).

### Key CSS tokens (defined in `globals.css`)

```css
--canvas          /* page background */
--mint            /* primary accent — #3cffd0 */
--surface-slate   /* card/panel background */
--image-frame     /* border color */
--secondary-text  /* muted text */
--font-display    /* Epilogue — used for big headings */
--font-sans       /* Space Grotesk — body text */
```

### Typography patterns

```tsx
// Big display heading
className="font-display text-[72px] font-black italic uppercase"

// Section label / eyebrow
className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text"

// Body
className="text-[14px] text-secondary-text leading-relaxed"
```

### Adding shadcn components

```bash
pnpm dlx shadcn@latest add <component-name>
```

---

## Auth Flow

```
Register → POST /api/auth/register → bcrypt → MongoDB
Login    → signIn("credentials")   → authorize() → JWT session
Google   → signIn("google")        → MongoDBAdapter → JWT session
```

Session available client-side via `useSession()`, server-side via `auth()`.

Nav auto-shows avatar + sign-out when logged in, "Sign In" button when not.

Auth pages (`/login`, `/register`) hide the Nav.

---

## Detection Flow (existing)

```
User uploads image
  → FormData POST to /detect/road or /detect/waste (Python ML backend at :8000)
  → Response: { width, height, detections[] }
  → Canvas drawn absolutely over <img>, ResizeObserver redraws on resize
```

Detection results are currently NOT saved — that's what we build next.

---

## Commands

```bash
pnpm dev      # dev server at localhost:3000
pnpm build    # production build
pnpm lint     # eslint
pnpm tsc --noEmit  # type check only
```
