"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";
import { AlertCircle } from "lucide-react";

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
  pothole: "#3b82f6", // Blue
  trash: "#a855f7",   // Purple
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

  return (
    <main className="min-h-screen bg-canvas text-foreground p-6 md:p-8 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <div className="text-[19px] font-light uppercase tracking-[1.9px] mb-2">Live overview</div>
            <h1 className="font-display text-[60px] md:text-[107px] font-black text-white leading-[0.8] tracking-[1.07px]">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-secondary">
              New Inspection
            </button>
            <button 
              onClick={loadData}
              className="btn-primary"
            >
              {loading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Refresh Data
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] px-4 py-3 rounded-[12px] mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* 5 KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <KpiCard
            title="Total Issues"
            value={kpis.total.toString()}
            sub="Live count"
            valueColor="text-[#60a5fa]"
          />
          <KpiCard
            title={<><span className="text-[#f87171]">Pending</span></>}
            value={kpis.pending.toString()}
            sub="In progress"
            valueColor="text-[#f87171]"
          />
          <KpiCard
            title={<><span className="text-[#4ade80]">Completed</span></>}
            value={kpis.completed.toString()}
            sub={`${kpis.completionRate.toFixed(1)}% rate`}
            valueColor="text-[#4ade80]"
          />
          <KpiCard
            title={<><span className="text-[#fbbf24]">Avg</span> Severity</>}
            value={kpis.avgSev.toFixed(1)}
            sub={`${kpis.critical} critical`}
            valueColor="text-[#fbbf24]"
          />
          <KpiCard
            title="Median Resolve"
            value={kpis.medianHrs === null ? "—" : `${kpis.medianHrs.toFixed(1)}`}
            sub="Since created"
            valueColor="text-white"
          />
        </div>

        {/* Main Chart */}
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">Issues Reported (14 Days)</h2>
            <select className="bg-transparent text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text border-none outline-none cursor-pointer hover:text-white focus:outline-none">
              <option>14 Days</option>
              <option>30 Days</option>
              <option>All Time</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPothole" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.pothole} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.pothole} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorTrash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.trash} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.trash} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="label" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={11} 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#18181b', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                  }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', paddingTop: '20px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="pothole" 
                  name="Pothole"
                  stroke={COLORS.pothole} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPothole)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.pothole }}
                />
                <Area 
                  type="monotone" 
                  dataKey="trash" 
                  name="Trash"
                  stroke={COLORS.trash} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTrash)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.trash }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </main>
  );
}

function KpiCard({ title, value, sub, valueColor }: { title: React.ReactNode, value: string, sub: string, valueColor: string }) {
  return (
    <div className="glass-panel p-5 flex flex-col justify-between h-[140px] hover:border-mint transition-colors">
      <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">
        {title}
      </div>
      <div>
        <div className={`font-display text-[48px] font-black tracking-tight ${valueColor} leading-none mb-2`}>
          {value}
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">
          {sub}
        </div>
      </div>
    </div>
  );
}
