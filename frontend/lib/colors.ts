export function labelColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("pothole")) return "#f59e0b";
  if (l.includes("crack")) return "#3CFFD0";
  if (l.includes("wear") || l.includes("surface")) return "#a855f7";
  return "#ef4444";
}

const WASTE_COLORS: Record<string, string> = {
  garbage: "#FF0000",
  pile: "#FF0000",
  cardboard: "#FF8C00",
  bottle: "#FF8C00",
  plastic: "#FF8C00",
  metal: "#22c55e",
  organic: "#84cc16",
};

export function wasteColor(label: string): string {
  const l = label.toLowerCase();
  for (const [key, color] of Object.entries(WASTE_COLORS)) {
    if (l.includes(key)) return color;
  }
  return "#f59e0b";
}

const SEVERITY_STOPS: ReadonlyArray<readonly [number, string]> = [
  [0, "#15803d"], [5, "#16a34a"], [10, "#22c55e"], [15, "#4ade80"],
  [20, "#84cc16"], [25, "#a3e635"], [30, "#bef264"], [35, "#fde047"],
  [40, "#facc15"], [45, "#eab308"], [50, "#f59e0b"], [55, "#fb923c"],
  [60, "#f97316"], [65, "#ea580c"], [70, "#dc2626"], [75, "#ef4444"],
  [80, "#e11d48"], [85, "#be123c"], [90, "#f43f5e"], [95, "#ff0055"],
];

export function severityColor(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  let color = SEVERITY_STOPS[0][1];
  for (const [threshold, c] of SEVERITY_STOPS) {
    if (clamped >= threshold) color = c;
  }
  return color;
}
