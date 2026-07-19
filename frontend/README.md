# DAMMAGE

**AI-powered urban infrastructure inspection platform.**

Upload a photo. Detect road damage or waste in seconds. Log it, share it, export it.

Built for city inspectors, field operators, and drone teams who need fast, accurate, and shareable damage reports.

---

## What It Does

DAMMAGE combines computer vision with a clean inspection workflow:

1. Upload an image from any device
2. Run AI detection for road damage or waste/litter
3. See annotated results with bounding boxes and confidence scores
4. Save the scan, track history, export PDF reports, and share public links

---

## Features

### Road Damage Detection

Upload a road photo and the AI identifies damage types — potholes, cracks, alligator cracking, patches — and draws labeled bounding boxes directly on the image.

- Drag-and-drop or file picker (JPG, PNG, WEBP up to 10 MB)
- Live confidence threshold slider (0–100%) filters detections in real time
- Bounding boxes redrawn dynamically on viewport resize via ResizeObserver
- Detection count badge with per-label breakdown (e.g. "2 potholes · 1 crack")
- Optional GPS tagging — manual lat/lng input or browser geolocation
- "Warming up models..." indicator for cold-start delay (first request 5–15s)
- Results auto-saved to your account after every scan

### Waste & Litter Detection

Same upload flow, trained specifically for urban waste — garbage bags, bottles, bins, packaging, organic waste.

- Per-type color coding (red = garbage, orange = plastic/cardboard, green = metal, lime = organic)
- Inventory panel listing all detected waste types and counts
- Confidence threshold slider with live canvas filter
- Export Log button for inventory records
- Location tagging for field mapping

### Inspection History

Every scan you run is saved and browsable in a vertical timeline.

- Timeline layout with timestamps and type badges (Road / Waste)
- Top detected labels shown on each card at a glance
- Skeleton loading states and empty state with call-to-action
- Click any scan to open the full detail view

### Scan Detail View

Full report for any past scan — image, annotations, metadata, and actions.

- Annotated image with bounding boxes redrawn from saved detection data
- All detections listed with label, confidence %, and coordinates
- Scan metadata: type, date, image dimensions, detection count, GPS coordinates
- **Re-analyze** — re-runs the saved image through the ML model and creates a new record
- **Export PDF** — generates a formatted PDF report with the annotated image and detection table
- **Share** — copies a public link to the scan (no login required to view)

### PDF Export

One click from the scan detail view generates a downloadable report.

- Captures the annotated image with all visible bounding boxes
- Includes a detection table: label, confidence, box coordinates
- Header with scan type, date, and scan ID
- Footer with generation timestamp
- Filename format: `dammage-{type}-{scan-id}.pdf`

### Public Share Links

Every scan has a public URL (`/report/[id]`) that anyone can view — no account needed.

- Same annotated image and detection table as the authenticated view
- "Powered by DAMMAGE" footer with link back to the app
- Safe: user identity is never exposed on public reports

### Live Dashboard

The home screen shows a real-time snapshot of your inspection activity.

- Total road detections and waste detections (last 72 hours)
- Interactive map (Leaflet / OpenStreetMap) plotting all geolocated scans — road detections in mint, waste in amber
- Live feed of your 5 most recent scans with type, label summary, and timestamp
- Retry on API failure; skeleton loading states

### Admin View

System-wide inspection oversight for administrators.

- Aggregate stats: total detections, road scans, waste scans, unique users
- Full detections table across all users with email, type, count, date, and view link
- 403 access denied page for non-admin users

### Authentication

Two ways to sign in, both creating the same account type.

- **Google OAuth** — one-click sign in via Google
- **Email + Password** — register with name, email, and password (bcrypt-hashed, stored in MongoDB)
- Password confirmation on register; min 8 characters
- JWT sessions — no server-side session storage required
- All detection pages, history, and admin are protected behind auth

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, App Router, React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 — CSS-based config, dark mode by default |
| Components | shadcn/ui |
| Auth | Auth.js v5 (Next-Auth) — Google OAuth + Credentials |
| Database | MongoDB — users, detections |
| Storage | MinIO (S3-compatible) — uploaded images |
| ML Backend | Python + FastAPI — road and waste detection models |
| PDF Export | jsPDF + html2canvas |
| Maps | Leaflet + OpenStreetMap |
| Package manager | pnpm |

---

## ML Endpoints

The ML backend runs at `http://127.0.0.1:8000` and exposes:

```
GET  /                → health check
POST /detect/road     → multipart image → detections[]
POST /detect/waste    → multipart image → detections[]
```

Detection response shape:

```ts
{
  kind: "road" | "waste",
  width: number,
  height: number,
  detections: {
    label: string,
    confidence: number,   // 0.0–1.0
    box: { x1, y1, x2, y2 }  // pixels, original image size
  }[]
}
```

> First request is slow (5–15s) — models lazy-load into memory on first call.

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/detections` | Required | Save a detection result |
| GET | `/api/detections` | Required | List user's detections |
| GET | `/api/detections/[id]` | Required | Get single detection |
| POST | `/api/upload` | Required | Upload image to MinIO |
| GET | `/api/report/[id]` | Public | Public report view |
| GET | `/api/admin/detections` | Admin only | All detections across users |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for MongoDB + MinIO)
- Python ML backend running at `:8000`

### Setup

```bash
# Install dependencies
pnpm install

# Copy env template and fill in values
cp .env.example .env.local

# Start MongoDB + MinIO via Docker
make mongo-up

# Start the dev server
pnpm dev
```

App runs at `http://localhost:3000`.

### Environment Variables

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dammage
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_GOOGLE_ID=                 # Google Cloud Console
AUTH_GOOGLE_SECRET=             # Google Cloud Console
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_ML_API=http://127.0.0.1:8000
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=password123
MINIO_BUCKET=dammage
```

### Commands

```bash
pnpm dev        # Dev server with HMR at localhost:3000
pnpm build      # Production build
pnpm start      # Serve production build
pnpm lint       # ESLint

make mongo-up       # Start MongoDB container
make mongo-reset    # Wipe auth collections (fresh start)
make mongo-shell    # Open mongosh on dammage db
make dev            # Start everything in parallel
```

---

## Project Structure

```
frontend/
  app/
    (auth)/             ← Login + register pages (nav hidden)
    admin/              ← Admin dashboard
    api/                ← All API routes
      auth/             ← NextAuth handler + register endpoint
      detections/       ← CRUD for detection records
      upload/           ← Image upload to MinIO
      report/           ← Public report endpoint
    history/
      [id]/             ← Scan detail view
    roads/              ← Road detection page
    waste/              ← Waste detection page
    report/[id]/        ← Public share page
    page.tsx            ← Dashboard
    layout.tsx          ← Root layout with SessionProvider
  components/
    nav.tsx             ← Global navigation
    DetectionMap.tsx    ← Leaflet map component
    ui/                 ← shadcn components
  lib/
    auth.ts             ← Auth.js full config
    mongodb.ts          ← MongoClient singleton
    storage.ts          ← MinIO upload helpers
    colors.ts           ← Detection label color mapping
  middleware.ts         ← Route protection
```

---

## Design

Dark mode by default. Editorial design language — bold display typography, high contrast, minimal chrome.

Key design tokens (defined in `app/globals.css`):

```
--canvas          page background
--mint            primary accent (#3cffd0)
--surface-slate   card/panel background
--secondary-text  muted text
--font-display    Epilogue — display headings
--font-sans       Space Grotesk — body text
```
