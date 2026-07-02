import { Lock, ArrowUpRight, Zap, Shield, BarChart3, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useSubscription, PLAN_REQUIRED } from "@/lib/useSubscription";

const PLAN_BENEFITS: Record<string, string[]> = {
  fiduciary: [
    "Rx Defense™ — PBM Contract AI",
    "DOL 5500 Intelligence Engine",
    "CAA 2026 Compliance Dashboard",
    "Board Pack Export",
    "Stewardship Builder",
  ],
  broker: [
    "Actuarial Engine IQ™",
    "Tennessee Prospecting Engine",
    "Stop-Loss Intelligence Engine",
    "Network Disruption Report",
    "Claims Recovery Engine",
  ],
  enterprise: [
    "God Mode Admin Panel",
    "SBI Forensic Engine",
    "CEI Engine + GLP-1 Stress Test",
    "Full Audit Trail",
    "Dedicated CSM + SOC 2",
  ],
};

const PLAN_COLORS: Record<string, string> = {
  fiduciary: "#4f7dff",
  broker: "#f59e0b",
  enterprise: "#22c55e",
};

const PLAN_ICONS: Record<string, typeof Zap> = {
  fiduciary: Shield,
  broker: BarChart3,
  enterprise: Zap,
};

interface UpgradeGateProps {
  module: string;
  children: React.ReactNode;
  mode?: "overlay" | "replace";
}

export function UpgradeGate({ module, children, mode = "replace" }: UpgradeGateProps) {
  const { canAccess, isLoading } = useSubscription();
  const [, navigate] = useLocation();

  if (isLoading) return <>{children}</>;
  if (canAccess(module)) return <>{children}</>;

  const req = PLAN_REQUIRED[module];
  const planId = req?.plan || "broker";
  const planLabel = req?.label || "Sales IQ Console";
  const planPrice = req?.price || 997;
  const color = PLAN_COLORS[planId] || "#4f7dff";
  const benefits = PLAN_BENEFITS[planId] || [];
  const Icon = PLAN_ICONS[planId] || Zap;

  const lockScreen = (
    <div
      className="flex flex-col items-center justify-center min-h-[480px] w-full rounded-2xl text-center px-6 py-12 relative overflow-hidden"
      style={{ background: "rgba(7,9,28,0.97)", border: `1px solid ${color}22` }}
      data-testid={`upgrade-gate-${module}`}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${color}14 0%, transparent 70%)`,
        }}
      />

      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 relative z-10"
        style={{ background: `${color}18`, border: `1px solid ${color}33` }}
      >
        <Lock className="w-7 h-7" style={{ color }} />
      </div>

      <div className="relative z-10 max-w-md">
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
        >
          <Icon className="w-3 h-3" />
          {planLabel}
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">
          Unlock this module
        </h2>
        <p className="text-white/50 text-sm mb-6 leading-relaxed">
          This feature is available on the <span className="font-semibold" style={{ color }}>{planLabel}</span> plan
          at <span className="font-semibold text-white">${planPrice}/mo</span>. Includes a 14-day free trial.
        </p>

        <div className="grid grid-cols-1 gap-1.5 mb-8 text-left">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-white/60">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
              {b}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            className="gap-2 font-semibold text-sm px-6"
            style={{ background: color, color: "#07091c" }}
            onClick={() => navigate("/billing")}
            data-testid={`btn-upgrade-${module}`}
          >
            Upgrade to {planLabel}
            <ArrowUpRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            className="border-white/15 text-white/50 hover:text-white hover:border-white/30 text-sm"
            onClick={() => navigate("/billing")}
            data-testid={`btn-view-pricing-${module}`}
          >
            View all plans
          </Button>
        </div>
      </div>
    </div>
  );

  if (mode === "overlay") {
    return (
      <div className="relative">
        <div className="opacity-10 pointer-events-none select-none blur-[2px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center p-6">
          {lockScreen}
        </div>
      </div>
    );
  }

  return lockScreen;
}
