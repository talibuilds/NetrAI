# DAMMAGE — Maintenance Backlog

Small, self-contained fixes for the maintenance team. No new features — just hardening, polish, and correctness.

---

## 🔴 Critical (Security / Production Blockers)

- [ ] **Hardcoded ML API URL** — `http://127.0.0.1:8000` is hardcoded in `roads/page.tsx`, `waste/page.tsx`, and `history/[id]/page.tsx`. Move to `NEXT_PUBLIC_ML_API` env var with fallback.
- [ ] **Hardcoded MinIO endpoint** — `lib/storage.ts` hardcodes `127.0.0.1:9000`, `useSSL: false`, and returns `http://` URLs. Move to env vars (`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`). Mixed content will break HTTPS deployments.
- [ ] **Upload route: no file type validation** — `api/upload/route.ts` accepts any file. Add MIME type check (allow only `image/jpeg`, `image/png`, `image/webp`).
- [ ] **Upload route: no file size limit** — add max size check (e.g. 50MB) before piping to MinIO.
- [ ] **Detections POST: no input validation** — `api/detections/route.ts` doesn't validate `type`, `width`, `height`, or array length. Add Zod schema. Max 1000 detections per request.
- [ ] **Registration leaks email enumeration** — `api/auth/register/route.ts` returns `"Email already registered"`. Change to generic `"Registration failed"` to prevent user enumeration.
- [ ] **Missing `.env.example`** — no file documents required env vars. Create one at project root with all keys and placeholder values.

---

## 🟠 High (UX Breaking / Bugs)

- [ ] **Unconnected buttons in nav** — Bell and Settings buttons in `components/nav.tsx` have no `onClick` handlers. Remove them or implement handlers.
- [ ] **Zoom/pan buttons not functional** — `roads/page.tsx` renders ZoomIn, ZoomOut, Maximize2 buttons with no handlers. Remove until implemented.
- [ ] **No mobile navigation** — nav links are hidden on small screens (`md:` breakpoint) with no hamburger/drawer fallback. Mobile users can't navigate.
- [ ] **No error boundary** — unhandled render errors show a blank page. Create `app/error.tsx`.
- [ ] **No 404 page** — invalid routes fall through with no feedback. Create `app/not-found.tsx`.
- [ ] **No user feedback on detection save** — after ML returns results, the POST to `/api/detections` is fire-and-forget. Show a toast on success/failure.
- [ ] **Confidence threshold inconsistency** — waste page shows "> 70%" text but the threshold default is `0.5` (50%). Fix the label to match the actual value.
- [ ] **No password confirmation field on register** — single password field; typos lock users out. Add "Confirm Password" with client-side match validation.

---

## 🟡 Medium (Code Quality / Missing Handling)

- [ ] **`console.error` in production code** — remove or replace with proper error tracking in: `roads/page.tsx` (line ~97), `waste/page.tsx` (line ~116), `history/[id]/page.tsx` (line ~162).
- [ ] **No error state on dashboard** — `app/page.tsx` silently shows empty data on API failure. Add error banner with retry.
- [ ] **No error state on history page** — `history/page.tsx` silently shows empty on API failure. Add error card.
- [ ] **Missing `location` field in detections POST interface** — frontend sends `location` but the TypeScript interface in `api/detections/route.ts` doesn't include it. Add `location?: { lat: number; lng: number }`.
- [ ] **No fetch timeouts** — all `fetch()` calls have no timeout. A hung API freezes the UI. Wrap calls with `AbortController` (30s timeout).
- [ ] **AbortController cleanup on navigation** — `history/[id]/page.tsx` starts re-analysis fetches with no cleanup on unmount. Add cancel on `useEffect` cleanup.
- [ ] **Clipboard copy: no error handling** — `navigator.clipboard.writeText()` can fail (permissions). Add `.catch()` to show fallback or error message.
- [ ] **Duplicate color mapping functions** — `labelColor()` / `wasteColor()` are duplicated across pages. Extract to `lib/colors.ts`.
- [ ] **Rate limit detections POST** — no limit per user. Add basic rate limiting (e.g. 10 saves/min per user).
- [ ] **Rate limit registration** — `api/auth/register/route.ts` has no rate limit. Add (e.g. 5/hour per IP).
- [ ] **Password strength validation on register** — only checks `length >= 8`. Add requirement for at least one number or special character.
- [ ] **File type validation client-side** — `accept="image/*"` is too permissive. Validate MIME type in `onChange` handler on both detection pages before uploading.
- [ ] **File size validation client-side** — add max size check (e.g. 10MB) in `onChange` handler on both detection pages before uploading.

---

## 🟢 Low (Accessibility / Polish)

- [ ] **Missing `aria-label` on nav icon buttons** — Bell and Settings in `nav.tsx` have no accessible labels. Add `aria-label`.
- [ ] **Missing `aria-label` on avatar** — nav avatar fallback has no screen-reader context. Add `aria-label={user.name}`.
- [ ] **Missing meta tags** — `app/layout.tsx` has minimal metadata. Add `description`, `og:image`, and `viewport`.
- [ ] **JWT session maxAge not set** — `lib/auth.ts` uses JWT but no explicit `maxAge`. Add `session: { maxAge: 86400 }` (24h).
- [ ] **Login error messages too generic** — all failures return "Invalid email or password" including network errors. Differentiate network vs auth errors.
- [ ] **Lat/lng input has no range validation** — location inputs on detection pages accept any number. Add `min`/`max` constraints (lat: -90–90, lng: -180–180).
- [ ] **No reusable skeleton component** — each page defines its own skeleton. Extract to `components/ui/skeleton-loader.tsx`.
