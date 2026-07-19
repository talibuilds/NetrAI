# DAMMAGE — Backend Notes

> Our playing space. Everything we know about the project from a backend perspective.

---

## What Is This Project

**DAMMAGE** is an AI-powered urban infrastructure inspection platform. Users upload photos and the system detects:
- **Road damage** — potholes, cracks, alligator cracks, patches
- **Waste / litter** — bottles, garbage piles, bins, packaging

Two types of users in mind: city inspectors, citizens, drone operators.

---

## Current Stack

### What Exists

| Piece | Detail |
|-------|--------|
| ML Backend | Python + FastAPI — `dammage-backend/` |
| Frontend | Next.js 15 App Router — `frontend/` |
| Auth | Auth.js v5 (email/password + Google OAuth) |
| Database | MongoDB via Docker — `dammage` db, port `27017` |
| Package manager | pnpm (frontend), uv (python backend) |

### Project Layout

```
hackthon_project/
  dammage-backend/     ← Python ML inference (hands off, AI team owns this)
  frontend/            ← Next.js app (our current home)
  docs/                ← this folder
  Makefile             ← dev commands
```

---

## ML Backend (hands off — AI team)

Runs at `http://127.0.0.1:8000`. We call it, we don't own it.

### Endpoints

```
GET  /                → health check
POST /detect/road     → multipart image → detections[]
POST /detect/waste    → multipart image → detections[]
```

### Detection Response Shape

```ts
{
  kind: "road" | "waste",
  width: number,
  height: number,
  detections: {
    label: string,
    confidence: number,    // 0.0–1.0
    box: { x1, y1, x2, y2 }  // pixels, original image size
  }[]
}
```

### Notes
- First request is slow (5–15s) — models lazy load into memory
- `detections` can be `[]` — not an error, just nothing found
- CORS fully open (`*`)

---

## Auth (done)

Auth.js v5 in the Next.js app. Two providers:

| Method | How it works |
|--------|-------------|
| Email + Password | `/api/auth/register` → bcrypt hash stored in MongoDB → Credentials provider |
| Google OAuth | Auth.js Google provider → MongoDBAdapter auto-creates user |

### Key files

```
frontend/
  auth.config.ts                        ← edge-safe config (Google only, no MongoDB)
  lib/auth.ts                           ← full config (MongoDB adapter + Credentials)
  lib/mongodb.ts                        ← MongoClient singleton
  middleware.ts                         ← route protection, uses auth.config.ts
  app/api/auth/[...nextauth]/route.ts   ← NextAuth handler
  app/api/auth/register/route.ts        ← POST /api/auth/register
  app/(auth)/login/page.tsx
  app/(auth)/register/page.tsx
```

### Session strategy
JWT — works for both providers. `session.user.id` is always set.

### MongoDB collections (auto-created by adapter)
- `users` — name, email, hashed password, image, createdAt
- `accounts` — OAuth account links (Google)
- `sessions` — (not used, we use JWT)
- `verificationTokens` — (reserved for email verification)

---

## MongoDB

```
Host:     127.0.0.1:27017
Database: dammage
```

### Useful make commands

```bash
make mongo-up       # start container
make mongo-reset    # clear all auth collections (fresh start)
make mongo-shell    # open mongosh on dammage db
make db-users       # list all users (password hidden)
make db-drop        # nuke entire database
```

---

## What We Need to Build (Web Backend)

The ML backend handles detection. We need a web backend layer that:

### Core features to figure out

- **Save detections** — when a user runs a detection, store the result (image ref, detections, type, timestamp) linked to their user ID
- **History** — query past detections per user
- **Dashboard stats** — total potholes detected, waste volume, per-user or global
- **Image storage** — where do uploaded images live? Options: local disk, S3/MinIO (already running in Docker), or don't store at all
- **Reports** — maybe export a detection as PDF or shareable link

### Open questions

1. Do we store the original uploaded image or just the detection metadata?
2. Is history per-user only, or is there a global/admin view?
3. Do we need roles? (admin vs regular user)
4. Real-time anything? (live feed on dashboard is currently fake data)

### Next MongoDB collections to design

```
detections
  _id
  userId        → ref to users._id
  type          → "road" | "waste"
  imageUrl      → where the image is stored (TBD)
  width, height → original image dimensions
  detections[]  → the raw array from ML backend
  createdAt

(maybe later)
reports
locations       → GPS coords if we ever add that
```

---

## Dev Commands

```bash
# from hackthon_project/ or frontend/
make dev            # mongo + frontend + backend in parallel
make frontend       # Next.js dev server only
make backend        # Python ML server only
make mongo-up       # ensure MongoDB is running
make mongo-reset    # wipe auth collections
```
