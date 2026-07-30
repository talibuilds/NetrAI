"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Download, Search, AlertCircle, Circle, ChevronDown, RefreshCw, ShieldCheck, Check } from "lucide-react";
import { ReportDetailModal } from "@/components/ReportDetailModal";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

type BackendStatus = "pending" | "acknowledged" | "in_progress" | "resolved" | "rejected";
type DisplayStatus = "pending" | "process" | "completed";
type ReportType = "trash" | "pothole";

interface AdminReport {
  id: string;
  image: string | null;
  coordinates: [number, number];
  time: string;
  severity_score: number;
  type: ReportType;
  status: BackendStatus;
  status_updated_at: string | null;
  status_updated_by: string | null;
  report_count: number;
  created_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
}



function toDisplay(s: BackendStatus): DisplayStatus {
  if (s === "resolved") return "completed";
  if (s === "in_progress") return "process";
  return "pending";
}

function toBackend(d: DisplayStatus): BackendStatus {
  if (d === "completed") return "resolved";
  if (d === "process") return "in_progress";
  return "pending";
}

type SeverityBucket = "critical" | "high" | "medium" | "low";

function severityBucket(score: number): SeverityBucket {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

const SEVERITY_STYLE: Record<SeverityBucket, { text: string; bg: string; border: string }> = {
  critical: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/50" },
  high:     { text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/50" },
  medium:   { text: "text-[#eab308]", bg: "bg-[#eab308]/10", border: "border-[#eab308]/50" },
  low:      { text: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/50" },
};

const DISPLAY_STATUS_STYLE: Record<DisplayStatus, { label: string; text: string; bg: string; border: string }> = {
  pending:   { label: "PENDING",   text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/50" },
  process:   { label: "PROCESS",   text: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/50" },
  completed: { label: "COMPLETED", text: "text-[#22c55e]", bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/50" },
};

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  const d = Math.floor(sec / 86400);
  return `${d} day${d !== 1 ? "s" : ""} ago`;
}

function shortId(id: string): string {
  return id.slice(-6).toUpperCase();
}

function issueLabel(type: ReportType): string {
  return type === "pothole" ? "Pothole" : "Trash Pile";
}

type Filter =
  | { kind: "all" }
  | { kind: "severity"; value: SeverityBucket }
  | { kind: "status"; value: DisplayStatus }
  | { kind: "type"; value: ReportType };

export default function IssueTrackerPage() {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((d: { admin: boolean }) => {
        if (!cancelled) {
          setIsAdmin(Boolean(d.admin));
          setAdminChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAdminChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"severity" | "time" | "reports">("severity");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const signatureRef = useRef("");

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") close();
    });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close as EventListener);
    };
  }, [openMenu]);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/reports?limit=500&include_resolved=true`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<AdminReport[]>;
      })
      .then((data) => {
        const sig = data.map((d) => `${d.id}:${d.status}:${d.report_count}`).join("|");
        if (sig !== signatureRef.current) {
          signatureRef.current = sig;
          setReports(data);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load reports");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 5000);
    return () => clearInterval(id);
  }, [loadData]);



  const counts = useMemo(() => {
    const byDisplay: Record<DisplayStatus, number> = { pending: 0, process: 0, completed: 0 };
    for (const r of reports) byDisplay[toDisplay(r.status)]++;
    return {
      all: reports.length,
      critical: reports.filter((r) => severityBucket(r.severity_score) === "critical").length,
      high: reports.filter((r) => severityBucket(r.severity_score) === "high").length,
      medium: reports.filter((r) => severityBucket(r.severity_score) === "medium").length,
      low: reports.filter((r) => severityBucket(r.severity_score) === "low").length,
      pending: byDisplay.pending,
      process: byDisplay.process,
      completed: byDisplay.completed,
      pothole: reports.filter((r) => r.type === "pothole").length,
      trash: reports.filter((r) => r.type === "trash").length,
    };
  }, [reports]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const disp = toDisplay(r.status);
      if (filter.kind === "severity" && severityBucket(r.severity_score) !== filter.value) return false;
      if (filter.kind === "status" && disp !== filter.value) return false;
      if (filter.kind === "type" && r.type !== filter.value) return false;
      if (q) {
        const hay = `${r.type} ${shortId(r.id)} ${disp} ${r.coordinates.join(",")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, filter, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === "severity") copy.sort((a, b) => b.severity_score - a.severity_score);
    else if (sortBy === "time") copy.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    else copy.sort((a, b) => b.report_count - a.report_count);
    return copy;
  }, [filtered, sortBy]);

  async function changeStatus(reportId: string, next: DisplayStatus) {
    if (!isAdmin) return;
    setPendingAction(`${reportId}:${next}`);
    try {
      const res = await fetch(`/api/admin/reports/${encodeURIComponent(reportId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: toBackend(next) }),
      });
      if (res.status === 403) throw new Error("Admin access required");
      if (!res.ok) throw new Error(`${res.status}`);
      signatureRef.current = "";
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPendingAction(null);
    }
  }

  function exportCsv() {
    const header = [
      "id", "type", "severity_score", "severity_bucket", "status",
      "lat", "lng", "report_count", "time", "status_updated_at", "status_updated_by",
    ];
    const rows = sorted.map((r) => [
      r.id, r.type, r.severity_score.toFixed(1), severityBucket(r.severity_score), toDisplay(r.status),
      r.coordinates[1], r.coordinates[0], r.report_count, r.time,
      r.status_updated_at ?? "", r.status_updated_by ?? "",
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dammage-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chips: Array<{ label: string; count: number; filter: Filter }> = [
    { label: "All", count: counts.all, filter: { kind: "all" } },
    { label: "Critical", count: counts.critical, filter: { kind: "severity", value: "critical" } },
    { label: "High", count: counts.high, filter: { kind: "severity", value: "high" } },
    { label: "Pending", count: counts.pending, filter: { kind: "status", value: "pending" } },
    { label: "Process", count: counts.process, filter: { kind: "status", value: "process" } },
    { label: "Completed", count: counts.completed, filter: { kind: "status", value: "completed" } },
    { label: "Potholes", count: counts.pothole, filter: { kind: "type", value: "pothole" } },
    { label: "Trash", count: counts.trash, filter: { kind: "type", value: "trash" } },
  ];

  function isActive(a: Filter, b: Filter): boolean {
    if (a.kind === "all" && b.kind === "all") return true;
    if (a.kind !== b.kind) return false;
    if (a.kind === "severity" && b.kind === "severity") return a.value === b.value;
    if (a.kind === "status" && b.kind === "status") return a.value === b.value;
    if (a.kind === "type" && b.kind === "type") return a.value === b.value;
    return false;
  }

  const typeData = [
    { name: "Potholes", value: counts.pothole, fill: "#ef4444" },
    { name: "Trash", value: counts.trash, fill: "#f59e0b" },
  ];

  const severityData = [
    { name: "Critical", value: counts.critical, fill: "#ef4444" },
    { name: "High", value: counts.high, fill: "#f59e0b" },
    { name: "Medium", value: counts.medium, fill: "#eab308" },
    { name: "Low", value: counts.low, fill: "#3b82f6" },
  ];

  return (
    <main className="min-h-screen bg-canvas">
      <div className="max-w-[1400px] mx-auto px-6 py-8 pt-[72px]">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[48px] md:text-[56px] font-black text-foreground uppercase leading-none tracking-tight mb-2">
              Admin Dashboard
            </h1>
            <div className="text-[12px] text-secondary-text tracking-[0.5px] flex items-center gap-2">
              {counts.all.toLocaleString()} issues · {counts.critical} critical · live sync every 5s
              {isAdmin && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[1.5px] text-[#22c55e] border border-[#22c55e]/50 bg-[#22c55e]/10 px-2 py-0.5 rounded-[6px] shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              title="Refresh"
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={exportCsv}
              className="btn-primary"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-2">Total Issues</div>
            <div className="text-[36px] font-black text-foreground">{counts.all}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b-4 border-b-[#ef4444]">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#ef4444] mb-2">Critical</div>
            <div className="text-[36px] font-black text-foreground">{counts.critical}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b-4 border-b-[#f59e0b]">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#f59e0b] mb-2">In Progress</div>
            <div className="text-[36px] font-black text-foreground">{counts.process}</div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-b-4 border-b-[#22c55e]">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-[#22c55e] mb-2">Resolved</div>
            <div className="text-[36px] font-black text-foreground">{counts.completed}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 h-[250px]">
          <div className="glass-panel p-5 rounded-2xl flex flex-col">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">Issues by Type</div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData}>
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: "#64748b"}} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px'}} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-panel p-5 rounded-2xl flex flex-col">
            <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">Severity Distribution</div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={60} paddingAngle={5}>
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-[12px] px-4 py-3 rounded-[12px] mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}


            {adminChecked && !isAdmin && (
          <div className="flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 text-[#93c5fd] text-[12px] px-4 py-2.5 rounded-[12px] mb-4">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Read-only view. Status updates require an admin account.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-6 bg-surface-high/10 p-2 rounded-2xl border border-image-frame">
          <div className="flex gap-1 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            {chips.map((chip) => {
              const active = isActive(filter, chip.filter);
              return (
                <button
                  key={chip.label}
                  onClick={() => setFilter(chip.filter)}
                  className={`text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[14px] transition-all whitespace-nowrap ${
                    active
                      ? "bg-mint text-black shadow-[0_0_10px_rgba(14,165,233,0.3)]"
                      : "text-secondary-text hover:bg-surface-high/30 hover:text-white"
                  }`}
                >
                  {chip.label} ({chip.count})
                </button>
              );
            })}
          </div>

          <div className="relative ml-auto min-w-[220px]">
            <Search className="h-3.5 w-3.5 text-mint-fg absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues…"
              className="w-full bg-black/40 border border-image-frame rounded-[14px] pl-9 pr-3 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint transition-colors"
            />
          </div>

          <button
            onClick={() =>
              setSortBy((s) => (s === "severity" ? "time" : s === "time" ? "reports" : "severity"))
            }
            className="text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[14px] bg-black/40 border border-image-frame text-secondary-text hover:border-mint hover:text-mint-fg transition-colors flex items-center gap-2"
          >
            Sort: {sortBy}
          </button>
        </div>

        <div className="glass-panel rounded-2xl overflow-visible">
          <div className="grid grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_0.6fr_1.1fr_0.7fr] gap-2 px-5 py-3 border-b border-image-frame text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text bg-canvas/50">
            <div>Issue</div>
            <div>Location</div>
            <div>Severity</div>
            <div>Priority Score</div>
            <div>Reports</div>
            <div>Status</div>
            <div>Reported</div>
          </div>

          {sorted.length === 0 && !loading && (
            <div className="p-12 text-center text-[13px] text-secondary-text">
              No issues match the current filter.
            </div>
          )}

          {loading && sorted.length === 0 && (
            <div className="p-12 text-center text-[12px] text-secondary-text uppercase tracking-[1.5px] animate-pulse">
              Loading issues…
            </div>
          )}

          <ul>
            {sorted.map((r) => {
              const sevBucket = severityBucket(r.severity_score);
              const sevStyle = SEVERITY_STYLE[sevBucket];
              const disp = toDisplay(r.status);
              const statusStyle = DISPLAY_STATUS_STYLE[disp];
              return (
                <li
                  key={r.id}
                  onClick={() => setSelectedReportId(r.id)}
                  className="grid grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_0.6fr_1.1fr_0.7fr] gap-2 px-5 py-3 border-b border-image-frame/50 last:border-0 items-center hover:bg-canvas/40 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {r.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`${r.image}?v=${encodeURIComponent(r.status_updated_at ?? r.time)}`}
                        alt=""
                        className="w-9 h-9 rounded-[8px] object-cover bg-canvas border border-image-frame shrink-0"
                      />
                    ) : (
                      <div className={`w-9 h-9 rounded-[8px] ${sevStyle.bg} border ${sevStyle.border} flex items-center justify-center shrink-0`}>
                        <Circle className={`h-3.5 w-3.5 ${sevStyle.text}`} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-foreground truncate">
                        {issueLabel(r.type)}
                      </div>
                      <div className="text-[10px] text-secondary-text/70 uppercase tracking-[1.1px] font-mono">
                        ID: DM-{shortId(r.id)}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="text-[12px] text-foreground font-mono truncate">
                      {r.coordinates[1].toFixed(5)}, {r.coordinates[0].toFixed(5)}
                    </div>
                    <div className="text-[10px] text-secondary-text/70 uppercase tracking-[1.1px]">
                      {r.type === "pothole" ? "Road surface" : "Waste site"}
                    </div>
                  </div>

                  <div>
                    <span className={`inline-block text-[10px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-[6px] ${sevStyle.text} ${sevStyle.bg} border ${sevStyle.border}`}>
                      {sevBucket}
                    </span>
                  </div>

                  <div>
                    <div className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-[12px] font-bold ${sevStyle.text} ${sevStyle.bg} border ${sevStyle.border}`}>
                      {Math.round(r.severity_score)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-secondary-text">
                    <span className="text-[#a855f7]">❖</span>
                    <span className="font-mono text-foreground">{r.report_count}</span>
                  </div>

                  <div>
                    {isAdmin ? (
                      <StatusDropdown
                        reportId={r.id}
                        current={disp}
                        open={openMenu === r.id}
                        pending={pendingAction}
                        onToggle={(open) => setOpenMenu(open ? r.id : null)}
                        onChange={changeStatus}
                      />
                    ) : (
                      <span className={`inline-block text-[10px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-[6px] ${statusStyle.text} ${statusStyle.bg} border ${statusStyle.border}`}>
                        {statusStyle.label}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-secondary-text">{relTime(r.time)}</div>
                </li>
              );
            })}
          </ul>
        </div>

        {selectedReportId && (
          <ReportDetailModal 
            reportId={selectedReportId} 
            onClose={() => setSelectedReportId(null)} 
          />
        )}
      </div>
    </main>
  );
}

function StatusDropdown({
  reportId,
  current,
  open,
  pending,
  onToggle,
  onChange,
}: {
  reportId: string;
  current: DisplayStatus;
  open: boolean;
  pending: string | null;
  onToggle: (open: boolean) => void;
  onChange: (id: string, next: DisplayStatus) => void;
}) {
  const style = DISPLAY_STATUS_STYLE[current];
  const options: DisplayStatus[] = ["pending", "process", "completed"];
  const isBusy = pending?.startsWith(`${reportId}:`) ?? false;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => onToggle(!open)}
        disabled={isBusy}
        className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.5px] px-2.5 py-1 rounded-[6px] ${style.text} ${style.bg} border ${style.border} hover:brightness-125 transition disabled:opacity-60`}
        title="Change status"
      >
        {isBusy ? "…" : style.label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[150px] bg-canvas border border-image-frame rounded-[10px] shadow-lg overflow-hidden">
          {options.map((o) => {
            const s = DISPLAY_STATUS_STYLE[o];
            const isCurrent = o === current;
            return (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onToggle(false);
                  if (!isCurrent) onChange(reportId, o);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-[1.5px] hover:bg-surface-slate transition ${
                  isCurrent ? "opacity-50 cursor-default" : ""
                } ${s.text}`}
              >
                <span>{s.label}</span>
                {isCurrent && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
