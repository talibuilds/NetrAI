import { useEffect, useState } from "react";
import { X, Activity, TrendingDown, Clock, MapPin, Construction, Trash2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

interface ReportDetail {
  report: {
    id: string;
    image: string | null;
    coordinates: [number, number];
    time: string;
    severity_score: number;
    type: string;
    status: string;
    report_count: number;
    resolved: boolean;
  };
  asset_id: string;
  current_health: number;
  health_history: Array<{ date: string; score: number }>;
  prediction?: {
    future_health: number;
    risk_level: string;
    predicted_repair_date: string;
  };
}

export function ReportDetailModal({
  reportId,
  onClose,
}: {
  reportId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/reports/${encodeURIComponent(reportId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load details");
        return res.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!reportId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-surface-slate border border-image-frame rounded-[24px] shadow-2xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-12 text-center text-[12px] text-secondary-text uppercase tracking-[1.5px] animate-pulse">
            Loading Report Data...
          </div>
        ) : error || !data ? (
          <div className="p-12 text-center text-[12px] text-destructive uppercase tracking-[1.5px]">
            {error || "Report not found"}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row">
            {/* Left Col - Image & Basic Info */}
            <div className="w-full md:w-[45%] bg-canvas/30 p-6 border-r border-image-frame">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-foreground">
                  {data.report.type === "pothole" ? <Construction className="w-4 h-4 text-mint-fg" /> : <Trash2 className="w-4 h-4 text-[#f59e0b]" />}
                  {data.report.type}
                </div>
                <div className="text-[10px] text-secondary-text font-mono">
                  ID: {data.report.id.slice(-6).toUpperCase()}
                </div>
              </div>
              
              {data.report.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={data.report.image} 
                  alt="Detection" 
                  className="w-full h-auto aspect-square object-cover rounded-[16px] border border-image-frame shadow-md mb-4"
                />
              ) : (
                <div className="w-full aspect-square bg-canvas border border-image-frame rounded-[16px] flex items-center justify-center mb-4">
                  <span className="text-secondary-text text-[11px] uppercase tracking-[1.1px]">No Image</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center bg-canvas/50 p-3 rounded-[12px] border border-image-frame/50">
                  <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">Severity</span>
                  <span className="text-[16px] font-bold font-mono text-foreground">{data.report.severity_score.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center bg-canvas/50 p-3 rounded-[12px] border border-image-frame/50">
                  <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">Status</span>
                  <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-foreground">{data.report.status}</span>
                </div>
                <div className="flex justify-between items-center bg-canvas/50 p-3 rounded-[12px] border border-image-frame/50">
                  <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">Coordinates</span>
                  <span className="text-[11px] font-mono text-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {data.report.coordinates[1].toFixed(5)}, {data.report.coordinates[0].toFixed(5)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Col - ML Predictions & Health */}
            <div className="w-full md:w-[55%] p-6 relative">
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-secondary-text hover:text-foreground bg-canvas/50 hover:bg-canvas rounded-full p-1.5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <h3 className="text-[14px] font-bold uppercase tracking-[1.5px] text-foreground mb-6 flex items-center gap-2">
                <Activity className="w-4 h-4 text-mint-fg" />
                Asset Health Forecast
              </h3>

              <div className="flex items-end gap-3 mb-8">
                <div className="flex-1">
                  <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-1">Current Health</div>
                  <div className="text-[48px] font-black font-mono leading-none text-foreground">
                    {data.current_health.toFixed(1)}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-1">30-Day Forecast</div>
                  <div className="text-[32px] font-bold font-mono leading-none text-[#ef4444] flex items-center gap-2">
                    {data.prediction?.future_health.toFixed(1) ?? "--"}
                    <TrendingDown className="w-5 h-5 opacity-70" />
                  </div>
                </div>
              </div>

              {data.prediction && (
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-canvas border border-image-frame rounded-[16px] p-4">
                    <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-1">Risk Level</div>
                    <div className={`text-[14px] font-bold uppercase tracking-[1.5px] ${
                      data.prediction.risk_level === 'Critical' ? 'text-[#ef4444]' : 
                      data.prediction.risk_level === 'Medium' ? 'text-[#f59e0b]' : 'text-[#22c55e]'
                    }`}>
                      {data.prediction.risk_level}
                    </div>
                  </div>
                  <div className="bg-canvas border border-image-frame rounded-[16px] p-4">
                    <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px] mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Critical Failure
                    </div>
                    <div className="text-[14px] font-bold text-foreground">
                      {data.prediction.predicted_repair_date}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-3">
                  Health History
                </h4>
                <div className="bg-canvas border border-image-frame rounded-[16px] p-4 flex gap-1 h-[80px] items-end justify-between">
                  {data.health_history.map((h, i) => (
                    <div 
                      key={i} 
                      className="w-full max-w-[12px] bg-mint-fg/80 hover:bg-mint-fg rounded-t-[4px] transition-all relative group"
                      style={{ height: `${Math.max(5, h.score)}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-nowrap">
                        {h.score.toFixed(1)}
                      </div>
                    </div>
                  ))}
                  {data.health_history.length === 0 && (
                    <div className="w-full text-center text-[10px] text-secondary-text self-center">No history available</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
