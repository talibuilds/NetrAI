"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  Source,
  type MapRef,
  type LayerProps,
} from "react-map-gl/maplibre";
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
} from "geojson";
import { nearestPointOnLine } from "@turf/nearest-point-on-line";
import { lineSliceAlong } from "@turf/line-slice-along";
import { length as turfLength } from "@turf/length";
import { point as turfPoint } from "@turf/helpers";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------- Types ----------

interface MongoIssue {
  _id: string;
  issue_type: string;
  severity: number;
  location: { type: "Point"; coordinates: [number, number] };
  timestamp: string;
  image?: string | null;
}

type RoadFeature = Feature<LineString, Record<string, unknown>>;
type RoadCollection = FeatureCollection<LineString, Record<string, unknown>>;

interface SegmentProperties {
  _id: string;
  color: string;
  opacity: number;
}
type ColoredSegment = Feature<LineString, SegmentProperties>;

type NeighborhoodFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;
type NeighborhoodCollection = FeatureCollection<
  Polygon | MultiPolygon,
  Record<string, unknown>
>;

interface NeighborhoodBucket {
  id: string;
  name: string;
  sum: number;
  count: number;
  feature: NeighborhoodFeature;
}
type NeighborhoodStore = Record<string, NeighborhoodBucket>;

interface ActiveNeighborhoodProps {
  id: string;
  name: string;
  avg: number;
  count: number;
  color: string;
}

interface BackendReport {
  id: string;
  image: string | null;
  coordinates: [number, number];
  time: string;
  severity_score: number;
  type: "trash" | "pothole";
}

// ---------- Constants ----------

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

const BENGALURU_CENTER = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 12,
} as const;

const ROADS_GEOJSON_URL = "/bengaluru_roads.geojson";
const NEIGHBORHOODS_GEOJSON_URL = "/bengaluru_neighborhoods.geojson";

const MAX_SNAP_METERS = 25;
const TOTAL_SEGMENT_METERS = 200;
const SUB_CHUNKS = 20;
const BBOX_DELTA_DEG = 0.02;

// ---------- Severity color scale ----------

const SEVERITY_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#15803d"], [5, "#16a34a"], [10, "#22c55e"], [15, "#4ade80"],
  [20, "#84cc16"], [25, "#a3e635"], [30, "#bef264"], [35, "#fde047"],
  [40, "#facc15"], [45, "#eab308"], [50, "#f59e0b"], [55, "#fb923c"],
  [60, "#f97316"], [65, "#ea580c"], [70, "#dc2626"], [75, "#ef4444"],
  [80, "#e11d48"], [85, "#be123c"], [90, "#f43f5e"], [95, "#ff0055"],
];

function severityColor(severity: number): string {
  const clamped = Math.max(0, Math.min(100, severity));
  let color = SEVERITY_STOPS[0]?.[1] ?? "#15803d";
  for (const stop of SEVERITY_STOPS) {
    if (clamped >= stop[0]) color = stop[1];
  }
  return color;
}

// ---------- Helpers ----------

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function issueTypeFor(type: "trash" | "pothole"): string {
  return type === "pothole" ? "Pothole" : "Garbage";
}

// ---------- Snap + slice ----------

interface SnapResult {
  segments: ColoredSegment[];
  snappedCoords: [number, number];
}

function snapAndSlice(
  lng: number,
  lat: number,
  roads: RoadCollection,
  issueId: string,
  color: string,
): SnapResult | null {
  const issuePt = turfPoint([lng, lat]);
  const minLng = lng - BBOX_DELTA_DEG;
  const maxLng = lng + BBOX_DELTA_DEG;
  const minLat = lat - BBOX_DELTA_DEG;
  const maxLat = lat + BBOX_DELTA_DEG;

  let bestDist = Infinity;
  let bestRoad: RoadFeature | null = null;
  let bestSnap: ReturnType<typeof nearestPointOnLine> | null = null;

  for (const road of roads.features) {
    if (!road.geometry || road.geometry.type !== "LineString") continue;
    const coords = road.geometry.coordinates;
    if (coords.length === 0) continue;

    let rMinLng = Infinity, rMaxLng = -Infinity, rMinLat = Infinity, rMaxLat = -Infinity;
    for (const c of coords) {
      const x = c[0], y = c[1];
      if (typeof x !== "number" || typeof y !== "number") continue;
      if (x < rMinLng) rMinLng = x;
      if (x > rMaxLng) rMaxLng = x;
      if (y < rMinLat) rMinLat = y;
      if (y > rMaxLat) rMaxLat = y;
    }
    if (rMaxLng < minLng || rMinLng > maxLng || rMaxLat < minLat || rMinLat > maxLat) continue;

    const snap = nearestPointOnLine(road as RoadFeature, issuePt);
    const distKm =
      (snap.properties?.pointDistance as number | undefined) ??
      (snap.properties?.dist as number | undefined) ??
      Infinity;
    const distMeters = distKm * 1000;
    if (distMeters < bestDist) {
      bestDist = distMeters;
      bestRoad = road as RoadFeature;
      bestSnap = snap;
    }
  }

  if (!bestRoad || !bestSnap || bestDist > MAX_SNAP_METERS) return null;

  const snapLocKmAlong =
    (bestSnap.properties?.totalDistance as number | undefined) ??
    (bestSnap.properties?.location as number | undefined) ??
    0;
  const snapLocM = snapLocKmAlong * 1000;

  const totalRoadLenM = turfLength(bestRoad, { units: "kilometers" }) * 1000;
  const startM = Math.max(0, snapLocM - TOTAL_SEGMENT_METERS / 2);
  const endM = Math.min(totalRoadLenM, snapLocM + TOTAL_SEGMENT_METERS / 2);
  if (endM - startM < 1) return null;

  const startKm = startM / 1000;
  const endKm = endM / 1000;
  const snapLocKm = snapLocM / 1000;
  const chunkLenKm = (endKm - startKm) / SUB_CHUNKS;
  const maxDistFromEpicenterKm = TOTAL_SEGMENT_METERS / 2 / 1000;

  const segments: ColoredSegment[] = [];
  for (let i = 0; i < SUB_CHUNKS; i += 1) {
    const cStart = startKm + chunkLenKm * i;
    const cEnd = startKm + chunkLenKm * (i + 1);
    const cMid = (cStart + cEnd) / 2;

    const distFromEpicenterKm = Math.abs(cMid - snapLocKm);
    const t = Math.max(0, 1 - distFromEpicenterKm / maxDistFromEpicenterKm);
    const opacity = 0.05 + t * 0.95;

    let chunk: Feature<LineString>;
    try {
      chunk = lineSliceAlong(bestRoad, cStart, cEnd, { units: "kilometers" });
    } catch {
      continue;
    }

    segments.push({
      type: "Feature",
      geometry: chunk.geometry,
      properties: { _id: `${issueId}-${i}`, color, opacity },
    });
  }

  const snapLng = bestSnap.geometry.coordinates[0];
  const snapLat = bestSnap.geometry.coordinates[1];
  return {
    segments,
    snappedCoords: [
      typeof snapLng === "number" ? snapLng : lng,
      typeof snapLat === "number" ? snapLat : lat,
    ],
  };
}

// ---------- Map layers ----------

const roadLineLayer: LayerProps = {
  id: "road-lines",
  type: "line",
  source: "roads",
  paint: { "line-color": "#6b7280", "line-opacity": 0.35, "line-width": 1 },
};

const neighborhoodBaseLayer: LayerProps = {
  id: "neighborhood-base",
  type: "line",
  source: "neighborhoods",
  paint: { "line-color": "#9ca3af", "line-opacity": 0.4, "line-width": 0.6 },
};

const neighborhoodFillLayer: LayerProps = {
  id: "neighborhood-fill",
  type: "fill",
  source: "active-neighborhoods",
  paint: {
    "fill-color": ["get", "color"],
    "fill-opacity": [
      "interpolate", ["linear"], ["get", "avg"], 0, 0.15, 100, 0.45,
    ],
  },
};

const neighborhoodActiveOutlineLayer: LayerProps = {
  id: "neighborhood-active-outline",
  type: "line",
  source: "active-neighborhoods",
  paint: {
    "line-color": ["get", "color"],
    "line-opacity": 0.7,
    "line-width": 1.2,
  },
};

const affectedSegmentsLayer: LayerProps = {
  id: "affected-segments",
  type: "line",
  source: "affected",
  layout: { "line-cap": "round", "line-join": "round" },
  paint: {
    "line-color": ["get", "color"],
    "line-opacity": ["get", "opacity"],
    "line-width": [
      "interpolate", ["exponential", 2], ["zoom"],
      10, 0.3, 14, 2, 16, 5, 19, 15,
    ],
  },
};

// ---------- Component ----------

export default function ImpactMap() {
  const mapRef = useRef<MapRef | null>(null);
  const [issues, setIssues] = useState<MongoIssue[]>([]);
  const [coloredSegments, setColoredSegments] = useState<ColoredSegment[]>([]);
  const [neighborhoodStore, setNeighborhoodStore] = useState<NeighborhoodStore>({});
  const [neighborhoodsData, setNeighborhoodsData] = useState<NeighborhoodCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [roadsData, setRoadsData] = useState<RoadCollection | null>(null);
  const [roadsError, setRoadsError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // Load roads once
  useEffect(() => {
    let cancelled = false;
    fetch(ROADS_GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: RoadCollection) => {
        if (!cancelled) setRoadsData(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRoadsError(err instanceof Error ? err.message : "Failed to load road network");
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Load neighborhoods once
  useEffect(() => {
    let cancelled = false;
    fetch(NEIGHBORHOODS_GEOJSON_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((raw: FeatureCollection) => {
        if (cancelled) return;
        const polygons: NeighborhoodFeature[] = [];
        for (const f of raw.features) {
          if (!f.geometry) continue;
          if (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon") {
            polygons.push(f as NeighborhoodFeature);
          }
        }
        setNeighborhoodsData({ type: "FeatureCollection", features: polygons });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Ingest backend reports: for each new report, snap + append segment + update neighborhood
  const ingestReports = useCallback(
    (reports: BackendReport[]) => {
      if (!roadsData) return;
      const newIssues: MongoIssue[] = [];
      const newSegments: ColoredSegment[] = [];
      const nhUpdates: Array<{ key: string; name: string; feature: NeighborhoodFeature; severity: number }> = [];

      for (const r of reports) {
        if (processedIdsRef.current.has(r.id)) continue;
        if (!Array.isArray(r.coordinates) || r.coordinates.length !== 2) continue;

        const [lng, lat] = r.coordinates;
        const sev = r.severity_score ?? 0;
        const color = severityColor(sev);
        const snap = snapAndSlice(lng, lat, roadsData, r.id, color);

        // Only keep reports that snap to a Bengaluru road — others are out of scope.
        if (!snap) {
          processedIdsRef.current.add(r.id);
          continue;
        }

        const finalCoords: [number, number] = snap.snappedCoords;

        newIssues.push({
          _id: r.id,
          issue_type: issueTypeFor(r.type),
          severity: Math.round(sev),
          location: { type: "Point", coordinates: finalCoords },
          timestamp: r.time,
          image: r.image,
        });

        newSegments.push(...snap.segments);

        if (neighborhoodsData) {
          const pt = turfPoint(finalCoords) as Feature<Point, Record<string, unknown>>;
          for (const feature of neighborhoodsData.features) {
            if (!booleanPointInPolygon(pt, feature)) continue;
            const props = feature.properties ?? {};
            const rawId = (props["@id"] as string | undefined) ?? "";
            const rawName = (props["name"] as string | undefined) ?? "Unknown";
            const key = rawId || rawName;
            if (!key) break;
            nhUpdates.push({ key, name: rawName, feature, severity: Math.round(sev) });
            break;
          }
        }

        processedIdsRef.current.add(r.id);
      }

      if (newIssues.length > 0) {
        setIssues((prev) => [...prev, ...newIssues]);
      }
      if (newSegments.length > 0) {
        setColoredSegments((prev) => [...prev, ...newSegments]);
      }
      if (nhUpdates.length > 0) {
        setNeighborhoodStore((prev) => {
          const next = { ...prev };
          for (const u of nhUpdates) {
            const existing = next[u.key] ?? { id: u.key, name: u.name, sum: 0, count: 0, feature: u.feature };
            next[u.key] = {
              ...existing,
              feature: u.feature,
              sum: existing.sum + u.severity,
              count: existing.count + 1,
            };
          }
          return next;
        });
      }
    },
    [roadsData, neighborhoodsData],
  );

  // Poll backend /reports every 5s
  useEffect(() => {
    if (!roadsData) return; // wait until roads are loaded
    let cancelled = false;

    const load = () => {
      fetch(`${API}/reports?limit=500`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json() as Promise<BackendReport[]>;
        })
        .then((data) => {
          if (cancelled) return;
          setFetchError(null);
          ingestReports(data);
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setFetchError(err instanceof Error ? err.message : "Failed to load reports");
          }
        });
    };

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [roadsData, ingestReports]);

  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => b.severity - a.severity),
    [issues],
  );

  const segmentsGeoJson = useMemo<FeatureCollection<LineString, SegmentProperties>>(
    () => ({ type: "FeatureCollection", features: coloredSegments }),
    [coloredSegments],
  );

  const activeNeighborhoodsGeoJson = useMemo<
    FeatureCollection<Polygon | MultiPolygon, ActiveNeighborhoodProps>
  >(() => {
    const features: Feature<Polygon | MultiPolygon, ActiveNeighborhoodProps>[] = [];
    for (const bucket of Object.values(neighborhoodStore)) {
      if (bucket.count === 0) continue;
      const avg = bucket.sum / bucket.count;
      features.push({
        type: "Feature",
        geometry: bucket.feature.geometry,
        properties: {
          id: bucket.id,
          name: bucket.name,
          avg,
          count: bucket.count,
          color: severityColor(avg),
        },
      });
    }
    return { type: "FeatureCollection", features };
  }, [neighborhoodStore]);

  const flyToPoint = (coords: [number, number]): void => {
    mapRef.current?.flyTo({
      center: coords,
      zoom: 16,
      speed: 1.2,
      curve: 1.6,
      essential: true,
    });
  };

  const handleCardClick = (issue: MongoIssue): void => {
    setSelectedId(issue._id);
    flyToPoint(issue.location.coordinates);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900 text-gray-100">
      {/* Left Panel */}
      <aside className="flex h-full w-[30%] min-w-[360px] flex-col border-r border-gray-800 bg-gray-950/90">
        <header className="border-b border-gray-800 px-5 py-4">
          <h1 className="text-lg font-semibold tracking-wide text-white">
            Civic Command Center
          </h1>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">
            Bengaluru · {sortedIssues.length} detections · live 5s
          </p>
          {roadsError && (
            <p className="mt-2 text-[11px] text-[#ff0055]">
              Roads failed to load: {roadsError}
            </p>
          )}
          {!roadsData && !roadsError && (
            <p className="mt-2 text-[11px] text-gray-500">Loading road network…</p>
          )}
          {fetchError && (
            <p className="mt-2 text-[11px] text-[#ff0055]">
              Feed: {fetchError}
            </p>
          )}
        </header>

        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
            Priority Queue
          </h2>
          <span className="text-[10px] text-gray-500">severity ↓</span>
        </div>

        <div className="priority-scroll flex-1 overflow-y-auto px-3 py-3">
          {sortedIssues.length === 0 ? (
            <div className="px-2 py-6 text-sm text-gray-500">
              {roadsData ? "No detections from server yet." : "Waiting for road network…"}
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedIssues.map((issue) => {
                const color = severityColor(issue.severity);
                const isSelected = issue._id === selectedId;
                return (
                  <li key={issue._id}>
                    <button
                      type="button"
                      onClick={() => handleCardClick(issue)}
                      className={[
                        "w-full rounded-md bg-gray-900/90 px-3 py-3 text-left transition",
                        "hover:bg-gray-800/90 focus:outline-none focus:ring-1 focus:ring-gray-600",
                        isSelected ? "ring-1 ring-gray-500 bg-gray-800/90" : "",
                      ].join(" ")}
                      style={{ borderLeft: `4px solid ${color}` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {issue.issue_type}
                        </span>
                        <span
                          className="rounded px-2 py-0.5 text-xs font-bold text-black"
                          style={{ backgroundColor: color }}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTimeAgo(issue.timestamp)}</span>
                        <span className="font-mono text-[10px] text-gray-500">
                          lat {issue.location.coordinates[1].toFixed(4)} · lng{" "}
                          {issue.location.coordinates[0].toFixed(4)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Right Panel: Map */}
      <section className="relative h-full w-[70%] flex-1">
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: BENGALURU_CENTER.longitude,
            latitude: BENGALURU_CENTER.latitude,
            zoom: BENGALURU_CENTER.zoom,
          }}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          style={{ width: "100%", height: "100%" }}
          attributionControl={false}
        >
          <Source id="roads" type="geojson" data={ROADS_GEOJSON_URL}>
            <Layer {...roadLineLayer} />
          </Source>

          {neighborhoodsData && (
            <Source id="neighborhoods" type="geojson" data={neighborhoodsData}>
              <Layer {...neighborhoodBaseLayer} />
            </Source>
          )}

          <Source id="active-neighborhoods" type="geojson" data={activeNeighborhoodsGeoJson}>
            <Layer {...neighborhoodFillLayer} />
            <Layer {...neighborhoodActiveOutlineLayer} />
          </Source>

          <Source id="affected" type="geojson" data={segmentsGeoJson}>
            <Layer {...affectedSegmentsLayer} />
          </Source>
        </Map>
      </section>
    </div>
  );
}
