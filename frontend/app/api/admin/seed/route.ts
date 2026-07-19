import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiPolygon,
  Polygon,
} from "geojson";
import { requireAdmin } from "@/lib/admin";
import clientPromise from "@/lib/mongodb";

type RoadFeature = Feature<LineString, Record<string, unknown>>;
type NeighborhoodFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

const PER_HOOD_CAP = 30;

type MongoBool = boolean | null;

interface SeedDoc {
  _id: string;
  email: string;
  location: { type: "Point"; coordinates: [number, number] };
  image: string | null;
  image_original: string | null;
  time: Date;
  created_at: Date;
  status: "pending" | "in_progress" | "resolved";
  status_updated_at: Date | null;
  status_updated_by: string | null;
  type: "trash" | "pothole";
  severity_score: number;
  environmental_impact?: number;
  detections: [];
  stats?: { total_detections: number; total_coverage_pct: number; class_counts: Record<string, number>; category_counts: Record<string, number> };
  resolved: MongoBool;
  resolved_at: Date | null;
  resolved_by: string | null;
  report_count: number;
  neighborhood?: string;
  source: "seed";
}

function polygonBbox(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const rings =
    geom.type === "Polygon"
      ? geom.coordinates
      : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (typeof lng !== "number" || typeof lat !== "number") continue;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickType(): "pothole" | "trash" {
  return Math.random() < 0.55 ? "pothole" : "trash";
}

function pickStatus(): "pending" | "in_progress" | "resolved" {
  const r = Math.random();
  if (r < 0.6) return "pending";
  if (r < 0.85) return "in_progress";
  return "resolved";
}

function loadRoads(): FeatureCollection<LineString, Record<string, unknown>> {
  const p = path.join(process.cwd(), "public", "bengaluru_roads.geojson");
  return JSON.parse(readFileSync(p, "utf-8")) as FeatureCollection<LineString, Record<string, unknown>>;
}

function loadNeighborhoods(): NeighborhoodFeature[] {
  const p = path.join(process.cwd(), "public", "bengaluru_neighborhoods.geojson");
  const raw = JSON.parse(readFileSync(p, "utf-8")) as FeatureCollection;
  const out: NeighborhoodFeature[] = [];
  for (const f of raw.features) {
    if (!f.geometry) continue;
    if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
      out.push(f as NeighborhoodFeature);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const reset = url.searchParams.get("reset") !== "false";

  const t0 = Date.now();
  let roads: FeatureCollection<LineString, Record<string, unknown>>;
  let hoods: NeighborhoodFeature[];
  try {
    roads = loadRoads();
    hoods = loadNeighborhoods();
  } catch (e) {
    return NextResponse.json({ error: `Failed to read geojson: ${(e as Error).message}` }, { status: 500 });
  }

  const hoodIndex = hoods.map((feature) => {
    const props = feature.properties ?? {};
    const name = (props["name"] as string | undefined) ?? "Unknown";
    const rawId = (props["@id"] as string | undefined) ?? name;
    return { feature, name, id: rawId, bbox: polygonBbox(feature.geometry) };
  });

  // Bucket road midpoints into first-matching neighborhood by bbox
  const buckets = new Map<string, { name: string; midpoints: [number, number][] }>();

  for (const road of roads.features) {
    if (!road.geometry || road.geometry.type !== "LineString") continue;
    const coords = road.geometry.coordinates;
    if (coords.length < 2) continue;
    const midIdx = Math.floor(coords.length / 2);
    const pt = coords[midIdx];
    if (!pt || typeof pt[0] !== "number" || typeof pt[1] !== "number") continue;
    const [lng, lat] = pt;

    for (const hood of hoodIndex) {
      const [minLng, minLat, maxLng, maxLat] = hood.bbox;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      const bucket = buckets.get(hood.id) ?? { name: hood.name, midpoints: [] };
      bucket.midpoints.push([lng, lat]);
      buckets.set(hood.id, bucket);
      break;
    }
  }

  // Sample ≥50% per bucket (capped at PER_HOOD_CAP) and build docs
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 3600 * 1000;
  const docs: SeedDoc[] = [];

  for (const [hoodId, bucket] of buckets) {
    const N = bucket.midpoints.length;
    if (N === 0) continue;
    const half = Math.ceil(N / 2);
    const sampleCount = Math.min(half, PER_HOOD_CAP);
    const shuffled = [...bucket.midpoints].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, sampleCount);

    for (const [lng, lat] of picked) {
      const type = pickType();
      const status = pickStatus();
      const severity = Math.round(randRange(type === "pothole" ? 20 : 15, 92));
      const createdAt = new Date(now - Math.random() * thirtyDaysMs);
      const timeIso = new Date(createdAt.getTime() + Math.random() * 3600 * 1000);
      const resolved = status === "resolved";
      const roundedLng = Number(lng.toFixed(5));
      const roundedLat = Number(lat.toFixed(5));
      const _id = `${roundedLng},${roundedLat}:${type}`;
      docs.push({
        _id,
        email: "seed@dammage.dev",
        location: { type: "Point", coordinates: [roundedLng, roundedLat] },
        image: null,
        image_original: null,
        time: timeIso,
        created_at: createdAt,
        status,
        status_updated_at: status === "pending" ? null : new Date(createdAt.getTime() + Math.random() * 12 * 3600 * 1000),
        status_updated_by: status === "pending" ? null : "seed-admin",
        type,
        severity_score: severity,
        environmental_impact: type === "trash" ? Math.round(randRange(20, 90)) : undefined,
        detections: [],
        resolved,
        resolved_at: resolved ? new Date(createdAt.getTime() + Math.random() * 24 * 3600 * 1000) : null,
        resolved_by: resolved ? "seed-admin" : null,
        report_count: 1 + Math.floor(Math.random() * 4),
        neighborhood: bucket.name,
        source: "seed",
      });
    }
  }

  const client = await clientPromise;
  const db = client.db("dammage");
  const col = db.collection<SeedDoc>("reports");

  let removed = 0;
  if (reset) {
    const res = await col.deleteMany({ source: "seed" });
    removed = res.deletedCount ?? 0;
  }

  let inserted = 0;
  if (docs.length > 0) {
    try {
      const res = await col.insertMany(docs, { ordered: false });
      inserted = res.insertedCount ?? 0;
    } catch (e) {
      const err = e as { result?: { nInserted?: number }; message?: string };
      inserted = err.result?.nInserted ?? 0;
    }
  }

  return NextResponse.json({
    ok: true,
    admin: gate.email,
    neighborhoods: buckets.size,
    candidateRoads: Array.from(buckets.values()).reduce((s, b) => s + b.midpoints.length, 0),
    sampled: docs.length,
    inserted,
    removedPrevious: removed,
    elapsedMs: Date.now() - t0,
  });
}

export const runtime = "nodejs";
export const maxDuration = 300;
