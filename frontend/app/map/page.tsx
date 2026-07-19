"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MapPin,
  Search,
  Maximize2,
  Minimize2,
  Crosshair,
  Trash2,
  Construction,
  ArrowUpDown,
  X,
} from "lucide-react";
import type { Pin } from "@/components/DetectionMap";
import { severityColor } from "@/lib/colors";

const DetectionMap = dynamic(() => import("@/components/DetectionMap"), {
  ssr: false,
});

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

interface BackendReport {
  image: string | null;
  coordinates: [number, number];
  time: string;
  severity_score: number;
  type: "trash" | "pothole";
}

type TimeFilter = "all" | "24h" | "7d";
type TypeFilter = "all" | "trash" | "pothole";
type SortBy = "severity" | "time" | "distance";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const shortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function MapPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [minSev, setMinSev] = useState(0);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("severity");
  const [toast, setToast] = useState<string | null>(null);
  const [focusPin, setFocusPin] = useState<Pin | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const signatureRef = useRef<string>("");

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    const qs = typeFilter === "all" ? "" : `&type=${typeFilter}`;
    fetch(`${API}/reports?limit=500${qs}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<BackendReport[]>;
      })
      .then((data) => {
        const mapped: Pin[] = data
          .filter((d) => Array.isArray(d.coordinates) && d.coordinates.length === 2)
          .map((d) => ({
            lat: d.coordinates[1],
            lng: d.coordinates[0],
            type: d.type,
            severity: d.severity_score ?? 0,
            image: d.image ? `${d.image}?v=${encodeURIComponent(d.time)}` : d.image,
            time: d.time,
          }));
        const sig = mapped
          .map((p) => `${p.lat},${p.lng},${p.type},${p.severity},${p.time}`)
          .join("|");
        if (sig !== signatureRef.current) {
          signatureRef.current = sig;
          setPins(mapped);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load reports");
        if (signatureRef.current !== "") {
          signatureRef.current = "";
          setPins([]);
        }
      })
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 5000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const filteredPins = useMemo(() => {
    const now = Date.now();
    const cutoff =
      timeFilter === "24h" ? now - 24 * 3600 * 1000 : timeFilter === "7d" ? now - 7 * 24 * 3600 * 1000 : 0;
    const q = search.trim().toLowerCase();
    return pins.filter((p) => {
      if (p.severity < minSev) return false;
      if (cutoff && new Date(p.time).getTime() < cutoff) return false;
      if (q) {
        const hay = `${p.type} ${shortFmt.format(new Date(p.time))} sev${p.severity.toFixed(0)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pins, minSev, timeFilter, search]);

  const sortedPins = useMemo(() => {
    const copy = [...filteredPins];
    if (sortBy === "severity") copy.sort((a, b) => b.severity - a.severity);
    else if (sortBy === "time") copy.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    else if (sortBy === "distance" && userLoc) {
      copy.sort((a, b) => haversineKm(userLoc, a) - haversineKm(userLoc, b));
    }
    return copy;
  }, [filteredPins, sortBy, userLoc]);

  // Resolve action moved to admin-only tracker at /admin — popup is read-only here.

  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setToast("Geolocation not supported");
      setTimeout(() => setToast(null), 2500);
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        setFocusPin({ lat: loc.lat, lng: loc.lng, type: "trash", severity: 0, image: null, time: new Date().toISOString() });
        setLocBusy(false);
      },
      () => {
        setLocBusy(false);
        setToast("Could not get location");
        setTimeout(() => setToast(null), 2500);
      },
    );
  };

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setTimeFilter("all");
    setMinSev(0);
  };

  const trashCount = filteredPins.filter((p) => p.type === "trash").length;
  const potholeCount = filteredPins.filter((p) => p.type === "pothole").length;
  const avgSev = filteredPins.length
    ? filteredPins.reduce((s, p) => s + p.severity, 0) / filteredPins.length
    : 0;
  const highCount = filteredPins.filter((p) => p.severity >= 60).length;

  return (
    <main className={fullscreen ? "fixed inset-0 z-[100] bg-canvas" : "pt-[72px] min-h-screen bg-canvas"}>
      <div className={fullscreen ? "h-full w-full flex flex-col" : "max-w-[1300px] mx-auto px-6 py-12"}>
        {!fullscreen && (
          <>
            <div className="flex items-baseline gap-3 mb-10">
              <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
                Severity Map
              </span>
              <span className="text-secondary-text/30">/</span>
              <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg">
                Live Reports
              </span>
            </div>

            <div className="flex items-baseline justify-between mb-6 flex-wrap gap-4">
              <h1 className="font-display text-[48px] md:text-[64px] font-black text-foreground uppercase leading-none tracking-tight">
                Map
              </h1>
              <Link
                href="/scan"
                className="bg-mint text-black text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors flex items-center gap-2"
              >
                <MapPin className="h-3.5 w-3.5" />
                New Scan
              </Link>
            </div>

            {error && (
              <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 text-destructive text-[12px] px-4 py-3 rounded-[12px] mb-6">
                <span>{error}</span>
                <button
                  onClick={loadData}
                  className="text-[11px] font-bold uppercase tracking-[1.1px] ml-4 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Showing" value={filteredPins.length.toString()} sub={`of ${pins.length}`} />
              <StatCard label="Potholes" value={potholeCount.toString()} accent="mint" />
              <StatCard label="Trash" value={trashCount.toString()} accent="amber" />
              <StatCard label="High Severity" value={highCount.toString()} sub={`avg ${avgSev.toFixed(1)}`} accent="red" />
            </div>
          </>
        )}

        {/* Controls bar */}
        <div
          className={`bg-surface-slate border border-image-frame ${
            fullscreen ? "rounded-none" : "rounded-[20px]"
          } p-4 flex flex-wrap items-center gap-3 ${fullscreen ? "" : "mb-4"}`}
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 text-secondary-text absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search type, date, severity…"
              className="w-full bg-canvas border border-image-frame rounded-[12px] pl-9 pr-8 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-text hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex gap-1">
            {(["all", "pothole", "trash"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-[20px] transition-colors ${
                  typeFilter === f
                    ? "bg-mint text-black"
                    : "border border-image-frame text-secondary-text hover:border-mint hover:text-mint-fg"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {(["all", "24h", "7d"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-[20px] transition-colors ${
                  timeFilter === t
                    ? "bg-ultraviolet text-white"
                    : "border border-image-frame text-secondary-text hover:border-ultraviolet hover:text-foreground"
                }`}
              >
                {t === "all" ? "all time" : t}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 min-w-[180px]">
            <span className="text-[10px] uppercase tracking-[1.1px] text-secondary-text whitespace-nowrap">
              Min sev
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={minSev}
              onChange={(e) => setMinSev(Number(e.target.value))}
              className="flex-1 accent-[#3CFFD0]"
            />
            <span className="text-[11px] text-mint-fg font-mono w-7 text-right">{minSev}</span>
          </div>

          <button
            onClick={handleMyLocation}
            disabled={locBusy}
            title="My location"
            className="text-[11px] font-bold uppercase tracking-[0.15em] border border-image-frame text-secondary-text px-3 py-2 rounded-[20px] hover:border-mint hover:text-mint-fg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Crosshair className="h-3.5 w-3.5" />
            {locBusy ? "…" : "Me"}
          </button>

          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="text-[11px] font-bold uppercase tracking-[0.15em] border border-image-frame text-secondary-text px-3 py-2 rounded-[20px] hover:border-mint hover:text-mint-fg transition-colors flex items-center gap-2"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? "Exit" : "Full"}
          </button>

          {(search || typeFilter !== "all" || timeFilter !== "all" || minSev > 0) && (
            <button
              onClick={clearFilters}
              className="text-[10px] uppercase tracking-[1.1px] text-secondary-text hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Main split: map + sidebar */}
        <div
          className={
            fullscreen
              ? "flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] overflow-hidden"
              : "grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4"
          }
        >
          <div
            className={`relative bg-surface-slate border border-image-frame overflow-hidden ${
              fullscreen ? "rounded-none" : "rounded-[20px]"
            }`}
            style={fullscreen ? undefined : { height: 560 }}
          >
            <DetectionMap
              pins={filteredPins}
              focusPin={focusPin}
              userLocation={userLoc}
            />

            {loading && pins.length === 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-canvas/90 border border-image-frame text-[11px] text-secondary-text uppercase tracking-[1.5px] px-4 py-2 rounded-[24px] animate-pulse">
                Loading reports…
              </div>
            )}

            {!loading && pins.length === 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] bg-canvas/90 border border-image-frame rounded-[24px] px-4 py-2 flex items-center gap-3">
                <MapPin className="h-4 w-4 text-secondary-text/60" />
                <span className="text-[11px] text-foreground uppercase tracking-[1.5px]">
                  No reports yet
                </span>
                <Link
                  href="/scan"
                  className="text-[11px] font-bold uppercase tracking-[0.15em] text-black bg-mint px-3 py-1 rounded-[20px] hover:bg-foreground hover:text-canvas transition-colors"
                >
                  Scan
                </Link>
              </div>
            )}

            <div className="absolute top-3 right-3 z-[500] bg-canvas/80 border border-image-frame text-[10px] text-mint-fg uppercase tracking-[1.1px] px-3 py-1 rounded-[20px] flex items-center gap-1.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full bg-mint ${loading ? "animate-pulse" : ""}`} />
              Live · 5s
            </div>
          </div>

          {/* Next to move sidebar */}
          <aside
            className={`bg-surface-slate border border-image-frame flex flex-col ${
              fullscreen ? "rounded-none border-l-0 h-full" : "rounded-[20px]"
            }`}
            style={fullscreen ? undefined : { maxHeight: 560 }}
          >
            <div className="px-4 py-3 border-b border-image-frame flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-foreground">
                  Next to move
                </div>
                <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">
                  {sortedPins.length} prioritised
                </div>
              </div>
              <button
                onClick={() => {
                  const next: SortBy =
                    sortBy === "severity" ? "time" : sortBy === "time" ? (userLoc ? "distance" : "severity") : "severity";
                  setSortBy(next);
                }}
                title="Cycle sort"
                className="text-[10px] font-bold uppercase tracking-[0.15em] border border-image-frame text-secondary-text px-2 py-1 rounded-[16px] hover:border-mint hover:text-mint-fg flex items-center gap-1"
              >
                <ArrowUpDown className="h-3 w-3" />
                {sortBy}
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {sortedPins.length === 0 ? (
                <div className="p-6 text-center text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                  No pins match the current filters.
                </div>
              ) : (
                <ul>
                  {sortedPins.map((pin, i) => {
                    const color = severityColor(pin.severity);
                    const dist = userLoc ? haversineKm(userLoc, pin) : null;
                    const isActive =
                      focusPin?.lat === pin.lat && focusPin.lng === pin.lng && focusPin.type === pin.type;
                    return (
                      <li key={`${pin.lat}-${pin.lng}-${pin.type}-${i}`}>
                        <button
                          onClick={() => setFocusPin({ ...pin })}
                          className={`w-full text-left px-4 py-3 border-b border-image-frame hover:bg-surface-bright transition-colors flex gap-3 ${
                            isActive ? "bg-surface-bright" : ""
                          }`}
                        >
                          <div
                            className="w-1 shrink-0 rounded-full"
                            style={{ background: color, minHeight: 40 }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {pin.type === "pothole" ? (
                                <Construction className="h-3 w-3 text-mint-fg shrink-0" />
                              ) : (
                                <Trash2 className="h-3 w-3 text-[#f59e0b] shrink-0" />
                              )}
                              <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-foreground">
                                {pin.type}
                              </span>
                              <span
                                className="ml-auto text-[10px] font-bold uppercase tracking-[1.1px] px-1.5 py-0.5 rounded-sm"
                                style={{ color, border: `1px solid ${color}` }}
                              >
                                {pin.severity.toFixed(0)}
                              </span>
                            </div>
                            <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] truncate">
                              {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                              {dist !== null && <span className="ml-2 text-mint-fg">· {dist.toFixed(2)} km</span>}
                            </div>
                            <div className="text-[10px] text-secondary-text/60 mt-0.5">
                              {timeFmt.format(new Date(pin.time))}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {!fullscreen && (
          <div className="flex flex-wrap gap-6 mt-4 text-[11px] text-secondary-text uppercase tracking-[1.1px]">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-[#22c55e]" />
              Low &lt; 30
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-[#f59e0b]" />
              Mid 30-60
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-[#ef4444]" />
              High &gt; 60
            </div>
            <div className="ml-auto text-secondary-text/50">
              Circle size scales with severity · click pin for popup · click list item to fly to location
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-foreground text-canvas text-[12px] font-bold uppercase tracking-[0.15em] px-5 py-3 rounded-[24px] shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "mint" | "amber" | "red";
}) {
  const accentColor =
    accent === "mint" ? "text-mint-fg" : accent === "amber" ? "text-[#f59e0b]" : accent === "red" ? "text-[#ef4444]" : "text-foreground";
  return (
    <div className="bg-surface-slate border border-image-frame rounded-[16px] p-4">
      <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-1">
        {label}
      </div>
      <div className={`text-[24px] font-bold font-mono ${accentColor}`}>{value}</div>
      {sub && <div className="text-[10px] text-secondary-text/60 mt-0.5">{sub}</div>}
    </div>
  );
}
