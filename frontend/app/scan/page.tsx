"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Upload, AlertCircle, CheckCircle2, MapPin, Cpu, Trash2, Construction } from "lucide-react";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

interface WasteStats {
  total_detections: number;
  total_coverage_pct: number;
  class_counts: Record<string, number>;
  category_counts: Record<string, number>;
}

interface ReportResponse {
  cleaned: boolean;
  removed_entries?: number;
  inserted?: string[];
  width: number;
  height: number;
  waste_detections?: number;
  road_detections?: number;
  waste_severity?: number;
  road_severity?: number;
  waste_stats?: WasteStats;
  image_url?: string | null;
  annotated_url?: string | null;
  processing_time_ms: number;
}

interface Picked {
  id: number;
  file: File;
  url: string;
}

export default function ScanPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  const [picked, setPicked] = useState<Picked | null>(null);
  const [result, setResult] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const pickIdRef = useRef(0);
  const pickedRef = useRef<Picked | null>(null);
  pickedRef.current = picked;

  useEffect(() => {
    return () => {
      if (pickedRef.current) URL.revokeObjectURL(pickedRef.current.url);
    };
  }, []);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported in this browser.");
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocLoading(false);
        setError("Could not get location. Enter manually or try again.");
      },
    );
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const f = input.files?.[0];
    input.value = "";
    if (!f) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(f.type)) {
      setError("Only JPG, PNG, and WEBP images are supported.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    const url = URL.createObjectURL(f);
    pickIdRef.current += 1;
    const id = pickIdRef.current;
    const prev = pickedRef.current;
    if (prev) URL.revokeObjectURL(prev.url);
    const next: Picked = { id, file: f, url };
    pickedRef.current = next;
    console.log("[scan] pick", { id, name: f.name, size: f.size, prevId: prev?.id ?? null });
    setPicked(next);
    setResult(null);
    setError(null);
  };

  const onSubmit = async () => {
    const current = pickedRef.current;
    if (!current) return;
    if (!location) {
      setError("Location is required. Click 'Use My Location' or enter lat/lng manually.");
      return;
    }
    const submissionId = current.id;
    const fileToSend = current.file;
    console.log("[scan] submit", { id: submissionId, name: fileToSend.name });

    setLoading(true);
    setWarmingUp(true);
    setError(null);
    setResult(null);
    const warmTimer = setTimeout(() => setWarmingUp(false), 3000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180_000); // 3 minutes timeout

    try {
      const fd = new FormData();
      fd.append("file", fileToSend, fileToSend.name);
      fd.append("lat", String(location.lat));
      fd.append("lng", String(location.lng));
      fd.append("email", email);

      const res = await fetch(`${API}/report`, {
        method: "POST",
        body: fd,
        signal: controller.signal,
        credentials: "omit",
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const raw = (await res.json()) as ReportResponse;
      console.log("[scan] response", {
        submissionId,
        currentId: pickIdRef.current,
        annotated: raw.annotated_url,
      });
      if (submissionId !== pickIdRef.current) {
        console.warn("[scan] stale response discarded", submissionId, "!==", pickIdRef.current);
        return;
      }
      const bust = Date.now();
      const data: ReportResponse = {
        ...raw,
        annotated_url: raw.annotated_url ? `${raw.annotated_url}?v=${bust}` : raw.annotated_url,
        image_url: raw.image_url ? `${raw.image_url}?v=${bust}` : raw.image_url,
      };
      setResult(data);
    } catch (err) {
      if (submissionId !== pickIdRef.current) return;
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Try a smaller image or try again.");
      } else {
        setError(err instanceof Error ? err.message : "Scan failed");
      }
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(warmTimer);
      setWarmingUp(false);
      setLoading(false);
    }
  };

  const resetScan = () => {
    pickIdRef.current += 1;
    const prev = pickedRef.current;
    if (prev) URL.revokeObjectURL(prev.url);
    pickedRef.current = null;
    setPicked(null);
    setResult(null);
    setError(null);
  };

  const file = picked?.file ?? null;
  const displayImage = result?.annotated_url ?? result?.image_url ?? picked?.url ?? null;
  const wasteCount = result?.waste_detections ?? 0;
  const roadCount = result?.road_detections ?? 0;
  const wasteSev = result?.waste_severity ?? 0;
  const roadSev = result?.road_severity ?? 0;

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="font-display text-[32px] md:text-[42px] font-black text-foreground uppercase leading-none tracking-tight">
              Scan
            </h1>
            <div className="text-[10px] text-secondary-text uppercase tracking-[1.5px] mt-1 font-bold">
              One image · road + waste in parallel
            </div>
          </div>
          {file && !result && !loading && location && (
              <button
              onClick={onSubmit}
              className="btn-primary"
            >
              <Cpu className="h-4 w-4" />
              Run Detection
            </button>
          )}
          {loading && (
            <div className="text-[11px] text-mint-fg uppercase tracking-[1.5px] animate-pulse flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5" />
              {warmingUp ? "Warming up models…" : "Analysing image…"}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/50 text-destructive text-[13px] px-4 py-3 rounded-[12px] mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="flex flex-col gap-4">
            {result?.cleaned && (
              <div className="flex items-center gap-2 bg-mint/10 border border-mint text-mint-fg text-[13px] px-4 py-3 rounded-[12px]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Area cleaned — removed {result.removed_entries ?? 0} entr
                {(result.removed_entries ?? 0) === 1 ? "y" : "ies"} within 500 m.
              </div>
            )}

            {result && !result.cleaned && (
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                {roadCount > 0 && (
                  <span className="flex items-center gap-1.5 bg-destructive/20 border border-destructive/30 text-destructive font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-[20px] shadow-[0_0_10px_rgba(255,0,0,0.1)]">
                    <Construction className="h-3.5 w-3.5" />
                    {roadCount} pothole{roadCount !== 1 ? "s" : ""} · sev {roadSev.toFixed(1)}
                  </span>
                )}
                {wasteCount > 0 && (
                  <span className="flex items-center gap-1.5 bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-[20px] shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                    <Trash2 className="h-3.5 w-3.5" />
                    {wasteCount} waste · sev {wasteSev.toFixed(1)}
                  </span>
                )}
                <span className="text-secondary-text uppercase tracking-[1.1px] ml-2">
                  {result.processing_time_ms.toFixed(0)} ms
                </span>
              </div>
            )}

            {picked && (
              <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] font-mono truncate">
                #{picked.id} · {picked.file.name} · {(picked.file.size / 1024).toFixed(0)} KB
              </div>
            )}

            <div className="relative glass-panel rounded-[20px] overflow-hidden min-h-[300px] flex items-center justify-center p-2">
              {displayImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`${picked?.id ?? 0}-${result ? "res" : "prev"}`}
                    src={displayImage}
                    alt="Scan"
                    className="block w-full h-auto max-h-[500px] object-contain rounded-xl"
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-mint/5 pointer-events-none z-10 flex flex-col justify-end overflow-hidden">
                      <div className="absolute w-full h-0.5 bg-mint shadow-[0_0_15px_rgba(14,165,233,1)] animate-scanner z-20"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-mint/20 animate-pulse"></div>
                    </div>
                  )}
                </>
              ) : (
                <label className="flex flex-col items-center gap-4 cursor-pointer p-12 text-center w-full h-full justify-center transition-colors hover:bg-white/5 rounded-xl">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-mint/50 flex items-center justify-center shadow-[0_0_15px_rgba(14,165,233,0.1)]">
                    <Upload className="h-6 w-6 text-mint" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-mint-fg uppercase tracking-[1.5px] mb-1">
                      Upload a scan
                    </div>
                    <div className="text-[11px] text-secondary-text font-mono">
                      JPG, PNG, WEBP · Max 10 MB
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="btn-secondary cursor-pointer">
                <Upload className="h-4 w-4" />
                {file ? "Replace Image" : "Upload Image"}
                <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
              </label>
              {file && !result && !loading && (
                <button
                  onClick={onSubmit}
                  disabled={!location}
                  className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  title={location ? "Run detection" : "Set location first"}
                >
                  <Cpu className="h-4 w-4" />
                  Run Detection
                </button>
              )}
              {file && !result && !loading && !location && (
                <span className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                  Location required →
                </span>
              )}
              {loading && (
                <span className="text-[11px] text-mint-fg uppercase tracking-[1.5px] animate-pulse flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5" />
                  {warmingUp ? "Warming up…" : "Analysing…"}
                </span>
              )}
              {result && (
                <>
                  <button
                    onClick={resetScan}
                    className="btn-secondary"
                  >
                    New Scan
                  </button>
                  <Link
                    href="/map"
                    className="btn-primary"
                  >
                    <MapPin className="h-4 w-4" />
                    View on Map
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="glass-panel rounded-[20px] p-5">
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg mb-4">
                Location <span className="text-destructive">*</span>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  className="w-full text-[11px] font-bold uppercase tracking-[0.12em] bg-surface-high/10 border border-image-frame px-4 py-3 rounded-[12px] hover:border-mint hover:text-mint-fg hover:bg-mint/5 transition-all disabled:opacity-50"
                >
                  {locLoading ? "Getting location…" : location ? "Update Location" : "Use My Location"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={location?.lat ?? ""}
                    onChange={(e) =>
                      setLocation((prev) => ({
                        lat: parseFloat(e.target.value) || 0,
                        lng: prev?.lng ?? 0,
                      }))
                    }
                    className="bg-canvas border border-image-frame rounded-[8px] px-3 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={location?.lng ?? ""}
                    onChange={(e) =>
                      setLocation((prev) => ({
                        lat: prev?.lat ?? 0,
                        lng: parseFloat(e.target.value) || 0,
                      }))
                    }
                    className="bg-canvas border border-image-frame rounded-[8px] px-3 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint"
                  />
                </div>
                {location && (
                  <div className="text-[11px] text-mint-fg font-mono">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-[20px] p-5">
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg mb-4">
                Reporter
              </div>
              <div className="text-[13px] text-foreground font-mono break-all bg-surface-high/10 p-3 rounded-lg border border-image-frame">
                {email || (
                  <span className="text-secondary-text italic">Anonymous</span>
                )}
              </div>
            </div>

            {result?.waste_stats && result.waste_stats.total_detections > 0 && (
              <div className="glass-panel rounded-[20px] p-5">
                <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-4">
                  Waste Breakdown
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-secondary-text uppercase tracking-[1.1px]">Coverage</span>
                    <span className="text-foreground font-mono">
                      {result.waste_stats.total_coverage_pct.toFixed(2)}%
                    </span>
                  </div>
                  {Object.entries(result.waste_stats.category_counts).map(([cat, n]) => (
                    <div key={cat} className="flex justify-between text-[11px]">
                      <span className="text-secondary-text uppercase tracking-[1.1px]">{cat}</span>
                      <span className="text-foreground font-mono">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
