# DAMMAGE — Feature Todo List

## Core (MVP — Nothing works without these)

- [x] **Save detections to MongoDB** — POST `/api/detections` storing `userId`, `type`, `detections[]`, `width`, `height`, `imageUrl`, `createdAt`
- [x] **Image storage** — MinIO client in `lib/storage.ts`, upload via `/api/upload`, `imageUrl` stored in detection record
- [x] **Wire up `/history` page** — fetches real data from `/api/detections?limit=20`, paginated list with loading + empty states
- [x] **Wire up dashboard stats** — real `totalRoad` / `totalWaste` aggregations from `/api/detections`, recent activity feed

---

## High Value (Makes it demo-worthy)

- [x] **Detection detail page** — `/history/[id]` with image, bounding boxes redrawn on canvas, label list, confidence scores
- [x] **First-request loading state** — "Warming up models…" → "Analysing image…" with skeleton UI on both detection pages
- [x] **Empty states** — history page `EmptyState` component + dashboard "No recent activity yet" with call-to-action
- [ ] **Confidence filter** — slider or threshold input to hide low-confidence detections (e.g. `< 0.5`); waste page shows hardcoded text but is not functional
- [x] **Detection count badge** — "N detection(s) found" with per-label breakdown on both roads and waste pages

---

## Nice to Have (Polish + Extra)

- [ ] **Export as PDF** — generate a simple report from a detection: image + bounding boxes + label table
- [ ] **Shareable link** — public `/report/[id]` page (no auth required) for sharing a detection result
- [ ] **GPS/location tag** — real lat/lng input when submitting (currently hardcoded mock coords on waste page)
- [ ] **Admin view** — global detections across all users (role: `admin` in MongoDB users collection)
- [ ] **Map view on dashboard** — if location data exists, plot detection pins on a map (Leaflet or Mapbox)
- [ ] **Re-analyze button** — on history detail, re-run the same image through ML backend without re-uploading

---

## Tech Debt / Infra

- [x] **`/api/detections` route** — `POST` (save), `GET` (list by user), `GET /[id]` (single) — all with auth checks
- [ ] **MongoDB `detections` indexes** — explicit index creation on `userId`, `createdAt`, `type` (collection used but no indexes defined)
- [x] **MinIO client in `lib/storage.ts`** — upload helper with UUID-based keys, presigned URL support
- [x] **Middleware protection** — `/history`, `/roads`, `/waste` all redirect to `/login` if unauthenticated
