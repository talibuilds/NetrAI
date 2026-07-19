# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (localhost:3000, HMR enabled)
pnpm build        # Production build → /.next
pnpm start        # Serve production build
pnpm lint         # ESLint via next lint
```

> Package manager is **pnpm**. Use `pnpm`, not `npm`/`yarn`.

## Architecture

**Next.js 15 + React 19 App Router SPA** for AI-powered damage detection (road damage and waste classification).

### Stack
- **Next.js 15** with App Router, TypeScript, strict mode
- **Tailwind CSS v4** — CSS-based config (no `tailwind.config.ts`), CSS vars in `app/globals.css`
- **shadcn/ui** — component library in `components/ui/` (Button, Tabs, Badge, Alert, Card)
- **Fetch API** — communicates with backend at `http://127.0.0.1:8000`

### Key Files
- `app/layout.tsx` — root layout; sets `className="dark"` on `<html>` for dark mode
- `app/globals.css` — Tailwind v4 import + all shadcn CSS custom properties (oklch colors, `@theme inline` mapping)
- `app/page.tsx` — entire app logic as a `"use client"` component
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `components/ui/` — shadcn components; regenerate with `pnpm dlx shadcn@latest add <name>`
- `components.json` — shadcn config (style: default, baseColor: slate, Tailwind v4)

### Detection Flow
User uploads image → `FormData` POST to `/detect/road` or `/detect/waste` → response `{ width, height, detections[] }` → bounding boxes drawn onto a `<canvas>` absolutely positioned over the `<img>`. A `ResizeObserver` redraws boxes on layout resize. Switching tabs resets `result` but preserves the loaded image.

### Adding shadcn Components
```bash
pnpm dlx shadcn@latest add <component-name>
```
Components land in `components/ui/`. The `components.json` at root controls where files go and which aliases to use.
