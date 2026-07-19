"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { AlertCircle, RefreshCw, TrendingUp, ShieldCheck, Clock, Activity } from "lucide-react";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

type BackendStatus = "pending" | "acknowledged" | "in_progress" | "resolved" | "rejected";
type ReportType = "trash" | "pothole";

interface Report {
  id: string;
  coordinates: [number, number];
  time: string;
  severity_score: number;
  type: ReportType;
  status: BackendStatus;
  status_updated_at: string | null;
  report_count: number;
  created_at: string | null;
  resolved: boolean;
  resolved_at: string | null;
}

const COLORS = {
  pothole: "#3CFFD0",
  trash: "#f59e0b",
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
  low: "#3b82f6",
  pending: "#ef4444",
  process: "#f59e0b",
  completed: "#22c55e",
  rejected: "#6b7280",
};

function toDisplayStatus(s: BackendStatus): "pending" | "process" | "completed" | "rejected" {
  if (s === "resolved") return "completed";
  if (s === "in_progress") return "process";
  if (s === "rejected") return "rejected";
  return "pending";
}

function severityBucket(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signatureRef = useRef("");

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/reports?limit=500&include_resolved=true`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<Report[]>;
      })
      .then((data) => {
        const sig = data.map((d) => `${d.id}:${d.status}:${d.severity_score}`).join("|");
        if (sig !== signatureRef.current) {
          signatureRef.current = sig;
          setReports(data);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 10000);
    return () => clearInterval(id);
  }, [loadData]);

  const kpis = useMemo(() => {
    const total = reports.length;
    const completed = reports.filter((r) => toDisplayStatus(r.status) === "completed").length;
    const pending = reports.filter((r) => toDisplayStatus(r.status) === "pending").length;
    const inProgress = reports.filter((r) => toDisplayStatus(r.status) === "process").length;
    const avgSev = total ? reports.reduce((s, r) => s + r.severity_score, 0) / total : 0;
    const completionRate = total ? (completed / total) * 100 : 0;
    const critical = reports.filter((r) => severityBucket(r.severity_score) === "critical").length;
    const resolutionTimes = reports
      .filter((r) => r.resolved_at && (r.created_at || r.time))
      .map((r) => {
        const start = new Date(r.created_at ?? r.time).getTime();
        const end = new Date(r.resolved_at!).getTime();
        return (end - start) / 1000 / 3600;
      })
      .filter((h) => h >= 0 && Number.isFinite(h));
    const medianHrs =
      resolutionTimes.length === 0
        ? null
        : [...resolutionTimes].sort((a, b) => a - b)[Math.floor(resolutionTimes.length / 2)];
    return { total, completed, pending, inProgress, avgSev, completionRate, critical, medianHrs };
  }, [reports]);

  const timelineData = useMemo(() => {
    const byDay = new Map<string, { day: string; pothole: number; trash: number }>();
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { day: key, pothole: 0, trash: 0 });
    }
    for (const r of reports) {
      const key = dayKey(r.time);
      const row = byDay.get(key);
      if (row) row[r.type]++;
    }
    return Array.from(byDay.values()).map((row) => ({
      ...row,
      label: dayLabel.format(new Date(row.day)),
    }));
  }, [reports]);

  const typeData = useMemo(() => {
    const pothole = reports.filter((r) => r.type === "pothole").length;
    const trash = reports.filter((r) => r.type === "trash").length;
    return [
      { name: "Pothole", value: pothole, color: COLORS.pothole },
      { name: "Trash", value: trash, color: COLORS.trash },
    ];
  }, [reports]);

  const severityData = useMemo(() => {
    const buckets: Record<"critical" | "high" | "medium" | "low", number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const r of reports) buckets[severityBucket(r.severity_score)]++;
    return [
      { name: "Critical", value: buckets.critical, color: COLORS.critical },
      { name: "High", value: buckets.high, color: COLORS.high },
      { name: "Medium", value: buckets.medium, color: COLORS.medium },
      { name: "Low", value: buckets.low, color: COLORS.low },
    ];
  }, [reports]);

  const statusData = useMemo(() => {
    const counts: Record<"pending" | "process" | "completed" | "rejected", number> = {
      pending: 0,
      process: 0,
      completed: 0,
      rejected: 0,
    };
    for (const r of reports) counts[toDisplayStatus(r.status)]++;
    return [
      { name: "Pending", value: counts.pending, color: COLORS.pending },
      { name: "Process", value: counts.process, color: COLORS.process },
      { name: "Completed", value: counts.completed, color: COLORS.completed },
      { name: "Rejected", value: counts.rejected, color: COLORS.rejected },
    ];
  }, [reports]);

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="font-display text-[48px] md:text-[56px] font-black text-foreground uppercase leading-none tracking-tight mb-2">
              Dashboard
            </h1>
            <div className="text-[12px] text-secondary-text tracking-[0.5px]">
              {kpis.total.toLocaleString()} total issues · live sync every 10s
            </div>
          </div>
          <button
            onClick={loadData}
            className="border border-image-frame text-secondary-text text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2.5 rounded-[24px] hover:border-mint hover:text-mint-fg transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive text-[12px] px-4 py-3 rounded-[12px] mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Kpi
            icon={<Activity className="h-4 w-4" />}
            label="Total Issues"
            value={kpis.total.toString()}
            accent="text-foreground"
          />
          <Kpi
            icon={<AlertCircle className="h-4 w-4" />}
            label="Pending"
            value={kpis.pending.toString()}
            sub={`${kpis.inProgress} in process`}
            accent="text-[#ef4444]"
          />
          <Kpi
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Completed"
            value={kpis.completed.toString()}
            sub={`${kpis.completionRate.toFixed(1)}% rate`}
            accent="text-[#22c55e]"
          />
          <Kpi
            icon={<TrendingUp className="h-4 w-4" />}
            label="Avg Severity"
            value={kpis.avgSev.toFixed(1)}
            sub={`${kpis.critical} critical`}
            accent="text-[#f59e0b]"
          />
          <Kpi
            icon={<Clock className="h-4 w-4" />}
            label="Median Resolve"
            value={kpis.medianHrs === null ? "—" : `${kpis.medianHrs.toFixed(1)}h`}
            sub="since created"
            accent="text-[#a855f7]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Issues Reported (14 days)" className="lg:col-span-3">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPoth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.pothole} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={COLORS.pothole} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gTrash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.trash} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={COLORS.trash} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#e5e7eb" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="pothole" stroke={COLORS.pothole} fill="url(#gPoth)" strokeWidth={2} name="Pothole" />
                <Area type="monotone" dataKey="trash" stroke={COLORS.trash} fill="url(#gTrash)" strokeWidth={2} name="Trash" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Type Split">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={typeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  stroke="none"
                  paddingAngle={2}
                  label={(entry) => `${entry.name} ${entry.value}`}
                >
                  {typeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Severity Buckets">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={severityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} />
                <YAxis stroke="#6b7280" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Status Distribution">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="#6b7280" fontSize={10} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={80} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </main>
  );
}

const tooltipStyle = {
  background: "#0a0a0a",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12,
};

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="bg-surface-slate border border-image-frame rounded-[16px] p-4">
      <div className="flex items-center gap-2 text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-2">
        <span className={accent}>{icon}</span>
        {label}
      </div>
      <div className={`text-[24px] font-bold font-mono ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-secondary-text/60 mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-surface-slate border border-image-frame rounded-[20px] p-5 ${className}`}>
      <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">
        {title}
      </div>
      {children}
    </div>
  );
}
