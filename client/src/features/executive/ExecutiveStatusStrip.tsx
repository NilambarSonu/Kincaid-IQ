import { cn } from "@/lib/utils";
import { ShieldCheck, TrendingUp, Zap, BarChart2, type LucideIcon } from "lucide-react";
import type { ExecutiveTilesResponse } from "./useExecutiveTiles";

export interface ExecutiveStatusStripProps {
  summary: ExecutiveTilesResponse["summary"];
  className?: string;
}

type StripItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  suffix?: string;
};

const STRIP_ITEMS: StripItem[] = [
  { key: "total",         label: "Total Tiles",   icon: BarChart2,   color: "#94a3b8" },
  { key: "allowed",       label: "Allowed",        icon: ShieldCheck, color: "#00FF94" },
  { key: "boardGrade",    label: "Board Grade",    icon: Zap,         color: "#FFB800" },
  { key: "avgConfidence", label: "Avg Confidence", icon: TrendingUp,  color: "#00A8FF", suffix: "%" },
];

export function ExecutiveStatusStrip({ summary, className }: ExecutiveStatusStripProps) {
  return (
    <div
      className={cn("flex items-center gap-0 rounded-xl overflow-hidden border border-slate-200", className)}
      data-testid="executive-status-strip"
    >
      {STRIP_ITEMS.map(({ key, label, icon: Icon, color, suffix }, i) => {
        const raw = summary[key as keyof typeof summary];
        const value = typeof raw === "number" && !Number.isInteger(raw)
          ? raw.toFixed(1)
          : raw;
        return (
          <div
            key={key}
            className={cn(
              "flex-1 flex items-center gap-2 px-4 py-3 bg-slate-50/60",
              i < STRIP_ITEMS.length - 1 && "border-r border-slate-200",
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
            <div>
              <p className="text-base font-bold font-mono tabular-nums leading-none" style={{ color }}>
                {value}{suffix ?? ""}
              </p>
              <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
