"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp, MapPin, Construction, TriangleAlert } from "lucide-react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

interface PrioritizedAsset {
  asset_id: string;
  name: string;
  current_health: number;
  predicted_health_t30: number;
  priority_score: number;
  geometry?: { type: string; coordinates: [number, number] };
}

type SortField = "priority_score" | "current_health" | "predicted_health_t30" | "name";
type SortOrder = "asc" | "desc";

export default function PriorityPage() {
  const { user } = useUser();
  const [assets, setAssets] = useState<PrioritizedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("priority_score");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetch(`${API}/priority?limit=200`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<PrioritizedAsset[]>;
      })
      .then((data) => {
        setAssets(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load priority list"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortedAssets = useMemo(() => {
    const copy = [...assets];
    copy.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = Number(valA);
      valB = Number(valB);
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
    return copy;
  }, [assets, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "name" ? "asc" : "desc");
    }
  };

  const getRiskLevel = (score: number) => {
    if (score > 70) return { label: "Healthy", color: "text-[#22c55e]", bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/30" };
    if (score > 40) return { label: "Medium", color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/30" };
    return { label: "Critical", color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/30" };
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <div className="w-4 h-4 opacity-0 group-hover:opacity-30 transition-opacity"><ChevronDown /></div>;
    return sortOrder === "asc" ? <ChevronUp className="w-4 h-4 text-mint-fg" /> : <ChevronDown className="w-4 h-4 text-mint-fg" />;
  };

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[48px] md:text-[56px] font-black text-foreground uppercase leading-none tracking-tight mb-2">
              Priority List
            </h1>
            <div className="text-[12px] text-secondary-text tracking-[0.5px]">
              Municipal asset ranking based on AI predictions, traffic, and demographics.
            </div>
          </div>
          <button
            onClick={loadData}
            className="border border-white/10 bg-white/5 hover:bg-white/10 text-secondary-text text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full backdrop-blur-md hover:text-white hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-[12px] px-4 py-3 rounded-[12px] mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="bg-surface-slate border border-image-frame rounded-[24px] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-image-frame bg-black/40">
                  <th className="p-4 pl-6 font-bold text-[10px] uppercase tracking-[1.5px] text-secondary-text">
                    <button onClick={() => toggleSort("name")} className="flex items-center gap-2 group hover:text-white transition-colors">
                      Location / Asset Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-[1.5px] text-secondary-text">
                    <button onClick={() => toggleSort("current_health")} className="flex items-center gap-2 group hover:text-white transition-colors">
                      Current Health <SortIcon field="current_health" />
                    </button>
                  </th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-[1.5px] text-secondary-text">
                    <button onClick={() => toggleSort("predicted_health_t30")} className="flex items-center gap-2 group hover:text-white transition-colors">
                      30-Day Forecast <SortIcon field="predicted_health_t30" />
                    </button>
                  </th>
                  <th className="p-4 font-bold text-[10px] uppercase tracking-[1.5px] text-secondary-text">
                    Risk Level
                  </th>
                  <th className="p-4 pr-6 font-bold text-[10px] uppercase tracking-[1.5px] text-secondary-text text-right">
                    <button onClick={() => toggleSort("priority_score")} className="flex items-center justify-end gap-2 group hover:text-white transition-colors w-full">
                      Priority Score <SortIcon field="priority_score" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-image-frame/50">
                {loading && assets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-[12px] text-secondary-text uppercase tracking-[1.5px] animate-pulse">
                      Calculating Priorities...
                    </td>
                  </tr>
                ) : sortedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-[13px] text-secondary-text">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  sortedAssets.map((asset, i) => {
                    const diff = asset.current_health - asset.predicted_health_t30;
                    const risk = getRiskLevel(asset.predicted_health_t30);
                    
                    return (
                      <tr key={asset.asset_id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-ultraviolet/20 flex items-center justify-center text-ultraviolet font-bold text-[12px]">
                              #{i + 1}
                            </div>
                            <div>
                              <div className="text-[14px] font-bold text-foreground flex items-center gap-2">
                                {asset.name}
                              </div>
                              <div className="text-[10px] text-secondary-text font-mono mt-1 opacity-70">
                                {asset.asset_id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="text-[20px] font-mono font-bold text-foreground">
                            {asset.current_health.toFixed(1)}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className={`text-[20px] font-mono font-bold ${diff > 5 ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>
                              {asset.predicted_health_t30.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-secondary-text font-medium flex items-center gap-1">
                              <TriangleAlert className="w-3 h-3 text-destructive" />
                              -{diff.toFixed(1)} expected
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[1.5px] border ${risk.border} ${risk.bg} ${risk.color}`}>
                            {risk.label}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="text-[24px] font-black font-mono text-mint-fg drop-shadow-[0_0_10px_rgba(14,165,233,0.3)]">
                            {asset.priority_score.toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
