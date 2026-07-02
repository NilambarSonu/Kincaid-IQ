import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  BarChart3, Pill, Shield, Network, FileText, CheckCircle2,
  Loader2, Zap, ArrowRight, Star, Receipt, Lock, Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const BASE_PRODUCT_ID = "broker-iq";
const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  price_display: string;
  interval: string;
  modules: string[];
  features: string[];
  color: string;
  badge: string | null;
  icon: string;
}

interface RxDefenseReport {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  price_display: string;
  mode: string;
  color: string;
}

interface ProductsResponse {
  products: Product[];
  rx_defense_report: RxDefenseReport;
}

interface ActiveSub {
  id: string;
  product_id: string;
  product_name: string;
  modules: string[];
  status: string;
  current_period_end: string | null;
}

const ICON_MAP: Record<string, typeof BarChart3> = {
  BarChart3, Pill, Shield, Network, FileText, Zap,
};

function BaseCard({
  product,
  isActive,
  onSubscribe,
  pending,
}: {
  product: Product;
  isActive: boolean;
  onSubscribe: () => void;
  pending: boolean;
}) {
  const Icon = ICON_MAP[product.icon] || Zap;

  return (
    <div
      data-testid={`pricing-card-${product.id}`}
      className="rounded-2xl w-full overflow-hidden"
      style={{
        background: isActive
          ? "linear-gradient(135deg, rgba(155,28,46,0.32) 0%, rgba(0,43,92,0.45) 45%, rgba(10,22,70,0.82) 100%)"
          : "linear-gradient(135deg, rgba(155,28,46,0.20) 0%, rgba(0,43,92,0.32) 45%, rgba(10,22,70,0.84) 100%)",
        border: isActive ? "1.5px solid rgba(155,28,46,0.75)" : "1.5px solid rgba(155,28,46,0.52)",
        boxShadow: isActive
          ? "0 0 60px rgba(155,28,46,0.28), 0 0 24px rgba(0,43,92,0.40), inset 0 1px 0 rgba(255,255,255,0.06)"
          : "0 0 40px rgba(155,28,46,0.16), 0 0 16px rgba(0,43,92,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
        padding: "32px 36px",
        position: "relative",
      }}
    >
      {/* B&B top accent bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${BB_NAVY} 0%, ${BB_CRIMSON} 40%, #c53255 50%, ${BB_CRIMSON} 60%, ${BB_NAVY} 100%)` }}
      />

      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-6 mt-1">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(155,28,46,0.28)", border: "1.5px solid rgba(155,28,46,0.60)", boxShadow: "0 0 14px rgba(155,28,46,0.30)" }}
            >
              <div className="w-6 h-6 rounded" style={{ background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>KIQ</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-black text-lg leading-tight">{product.name}</h3>
                <span
                  className="text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(155,28,46,0.20)", color: BB_CRIMSON, border: "1px solid rgba(155,28,46,0.40)", letterSpacing: "0.1em" }}
                >
                  REQUIRED · STEP 1
                </span>
                {isActive && (
                  <span
                    className="text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(155,28,46,0.15)", color: "#e06070", border: "1px solid rgba(155,28,46,0.30)" }}
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-zinc-400 text-xs mt-0.5">{product.description}</p>
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {product.features.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#e06070" }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Price + CTA */}
        <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-4xl font-black text-white">{product.price_display}</div>
            <div className="text-zinc-500 text-sm">/ {product.interval}</div>
          </div>
          <button
            data-testid={`btn-subscribe-${product.id}`}
            onClick={onSubscribe}
            disabled={pending || isActive}
            className="px-8 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 transition-all"
            style={{
              background: isActive
                ? "rgba(155,28,46,0.12)"
                : `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1524 100%)`,
              color: isActive ? "rgba(255,255,255,0.35)" : "#fff",
              cursor: isActive ? "default" : "pointer",
              minWidth: 160,
              justifyContent: "center",
              border: isActive ? "1px solid rgba(155,28,46,0.25)" : "none",
              boxShadow: isActive ? "none" : "0 4px 16px rgba(155,28,46,0.35)",
            }}
          >
            {pending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
            ) : isActive ? (
              "Active ✓"
            ) : (
              <>Get Started <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
          <p className="text-[10px] text-right" style={{ color: "rgba(155,28,46,0.55)" }}>Unlocks all add-on modules below</p>
        </div>
      </div>
    </div>
  );
}

function AddOnCard({
  product,
  isActive,
  hasBase,
  onSubscribe,
  pending,
}: {
  product: Product;
  isActive: boolean;
  hasBase: boolean;
  onSubscribe: () => void;
  pending: boolean;
}) {
  const Icon = ICON_MAP[product.icon] || Zap;
  const locked = !hasBase && !isActive;
  const c = product.color;

  return (
    <div
      data-testid={`pricing-card-${product.id}`}
      className="rounded-2xl flex flex-col transition-all"
      style={{
        background: locked
          ? `linear-gradient(145deg, ${c}28 0%, rgba(22,38,90,0.72) 70%)`
          : isActive
          ? `linear-gradient(145deg, ${c}60 0%, ${c}38 45%, rgba(18,34,85,0.68) 100%)`
          : `linear-gradient(145deg, ${c}48 0%, ${c}28 45%, rgba(18,34,85,0.70) 100%)`,
        border: `1.5px solid ${locked ? c + "40" : isActive ? c + "90" : c + "70"}`,
        boxShadow: locked
          ? `0 0 12px ${c}15`
          : isActive
          ? `0 0 48px ${c}50, inset 0 1px 0 ${c}30`
          : `0 0 32px ${c}38, inset 0 1px 0 ${c}22`,
        padding: "24px 22px",
        position: "relative",
        overflow: "hidden",
        opacity: locked ? 0.65 : 1,
      }}
    >
      {/* Color accent strip at top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: locked ? 2 : 3,
          background: locked
            ? `linear-gradient(90deg, transparent 10%, ${c}55 50%, transparent 90%)`
            : `linear-gradient(90deg, transparent 0%, ${c}bb 25%, ${c} 50%, ${c}bb 75%, transparent 100%)`,
        }}
      />

      {product.badge && (
        <div
          className="absolute top-0 right-0 text-[10px] font-black px-3 py-1 rounded-bl-xl rounded-tr-xl"
          style={{ background: locked ? `${c}44` : c, color: locked ? "rgba(255,255,255,0.5)" : "#fff" }}
        >
          <Star className="inline w-2.5 h-2.5 mr-1" />
          {product.badge}
        </div>
      )}

      {isActive && (
        <div
          className="absolute top-3 left-3 text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide"
          style={{ background: "linear-gradient(135deg,#16A34A,#22C55E)", color: "#fff", boxShadow: "0 2px 10px rgba(34,197,94,0.55)" }}
        >
          ✓ ACTIVE
        </div>
      )}

      {locked && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 text-[9px] font-black px-2.5 py-1 rounded-full tracking-wide"
          style={{ background: "linear-gradient(135deg,#B45309,#F59E0B)", color: "#fff", boxShadow: "0 2px 10px rgba(245,158,11,0.45)" }}
        >
          <Lock className="w-2.5 h-2.5" /> Requires Base
        </div>
      )}

      <div className="flex items-start gap-3 mb-4 mt-1" style={{ marginTop: isActive ? 22 : 6 }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: locked ? `${c}20` : `${c}35`,
            border: `1.5px solid ${locked ? c + "40" : c + "70"}`,
            boxShadow: locked ? "none" : `0 0 16px ${c}35`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: locked ? `${c}77` : c }} />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-tight" style={{ color: locked ? "rgba(255,255,255,0.55)" : "#fff" }}>
            {product.name}
          </h3>
          <p className="text-xs mt-0.5 leading-snug" style={{ color: locked ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.55)" }}>
            {product.description}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-2xl font-black" style={{ color: locked ? "rgba(255,255,255,0.40)" : c }}>
          {product.price_display}
        </span>
        <span className="text-xs ml-1" style={{ color: locked ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.45)" }}>
          / {product.interval} add-on
        </span>
      </div>

      <ul className="space-y-1.5 mb-5 flex-1">
        {product.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: locked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.68)" }}>
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: locked ? `${c}55` : c }} />
            {f}
          </li>
        ))}
      </ul>

      <button
        data-testid={`btn-subscribe-${product.id}`}
        onClick={onSubscribe}
        disabled={pending || isActive || locked}
        className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
        style={{
          background: isActive
            ? `${c}28`
            : locked
            ? `${c}18`
            : `linear-gradient(135deg, ${c} 0%, ${c}dd 100%)`,
          color: isActive ? c : locked ? `${c}66` : "#fff",
          cursor: isActive || locked ? "default" : "pointer",
          border: `1.5px solid ${isActive ? c + "60" : locked ? c + "30" : "transparent"}`,
          boxShadow: !isActive && !locked ? `0 3px 18px ${c}55` : "none",
        }}
      >
        {pending ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
        ) : isActive ? (
          <>Active ✓</>
        ) : locked ? (
          <><Lock className="w-3 h-3" /> Get Base First</>
        ) : (
          <><Plus className="w-3 h-3" /> Add Module <ArrowRight className="w-3 h-3" /></>
        )}
      </button>
    </div>
  );
}

function RxDefenseCard({
  report,
  onPay,
  pending,
}: {
  report: RxDefenseReport;
  onPay: () => void;
  pending: boolean;
}) {
  return (
    <div
      data-testid="pricing-card-rx-defense-report"
      className="rounded-2xl w-full overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(155,28,46,0.26) 0%, rgba(0,43,92,0.40) 50%, rgba(10,22,70,0.82) 100%)",
        border: "1.5px solid rgba(155,28,46,0.55)",
        boxShadow: "0 0 48px rgba(155,28,46,0.24), 0 0 18px rgba(0,43,92,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
        padding: "28px 32px",
        position: "relative",
      }}
    >
      {/* B&B top accent bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${BB_CRIMSON} 0%, #c53255 30%, ${BB_NAVY} 60%, ${BB_CRIMSON} 100%)` }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 mt-1">
        <div className="flex-1">
          <div
            className="inline-flex items-center gap-1.5 text-[9px] font-black px-2 py-0.5 rounded-full mb-3"
            style={{ background: "rgba(155,28,46,0.18)", color: BB_CRIMSON, border: "1px solid rgba(155,28,46,0.35)" }}
          >
            <Receipt className="w-2.5 h-2.5" /> PAY PER REPORT — NO SUBSCRIPTION NEEDED
          </div>
          <h3 className="text-white font-black text-xl mb-1">Rx Defense IQ™</h3>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">{report.description}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
          <div>
            <span className="text-4xl font-black text-white">{report.price_display}</span>
            <span className="text-zinc-500 text-sm ml-1">per report</span>
          </div>
          <button
            data-testid="btn-pay-rx-defense"
            onClick={onPay}
            disabled={pending}
            className="px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            style={{
              background: `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1524 100%)`,
              color: "#fff",
              boxShadow: "0 4px 16px rgba(155,28,46,0.35)",
            }}
          >
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <>Pay $999 &amp; Analyze <ArrowRight className="w-3.5 h-3.5" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pricing() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: productsData } = useQuery<ProductsResponse>({
    queryKey: ["/api/billing/products"],
  });

  const { data: myModulesData } = useQuery<{ subscriptions: ActiveSub[] }>({
    queryKey: ["/api/billing/my-modules"],
  });

  const activeProductIds = new Set(
    (myModulesData?.subscriptions ?? []).map((s) => s.product_id)
  );
  const hasBase = activeProductIds.has(BASE_PRODUCT_ID);

  const checkoutMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await apiRequest("POST", "/api/billing/module-checkout", { product_id: productId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else toast({ title: "Demo mode", description: data.message || "Stripe not configured.", variant: "destructive" });
      setPendingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      setPendingId(null);
    },
  });

  const rxDefenseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/rx-defense-checkout", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else toast({ title: "Demo mode", description: data.message || "Stripe not configured.", variant: "destructive" });
      setPendingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
      setPendingId(null);
    },
  });

  const handleSubscribe = (productId: string) => {
    setPendingId(productId);
    checkoutMutation.mutate(productId);
  };

  const allProducts = productsData?.products ?? [];
  const baseProduct = allProducts.find((p) => p.id === BASE_PRODUCT_ID);
  const addOns = allProducts.filter((p) => p.id !== BASE_PRODUCT_ID);
  const rxReport = productsData?.rx_defense_report;

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="overflow-hidden rounded-2xl mb-7 mx-auto max-w-3xl" style={{ border: "1px solid rgba(0,43,92,0.50)", boxShadow: "0 8px 40px rgba(0,43,92,0.30)" }}>
          <div className="w-full" style={{ height: 110, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>KINCAID IQ — FIDUCIARY INTELLIGENCE PLATFORM</span>
          </div>
        </div>
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{ background: "rgba(0,43,92,0.30)", color: "#7aA8e0", border: "1px solid rgba(0,43,92,0.60)" }}
        >
          <Zap className="w-3 h-3" /> Sales IQ Console — Nationwide Rollout
        </div>
        <h1 className="text-4xl font-black text-white mb-3">Build Your Intelligence Stack</h1>
        <p className="text-zinc-400 text-base max-w-2xl mx-auto">
          Start with the <span className="font-semibold" style={{ color: "#e06070" }}>$79/mo base</span> — required to access the platform.
          Then bolt on only the modules your clients need.
        </p>
      </div>

      {/* Active subscriptions banner */}
      {activeProductIds.size > 0 && (
        <div
          className="mb-8 rounded-xl px-5 py-4 flex items-center gap-3"
          style={{ background: "rgba(0,43,92,0.20)", border: "1px solid rgba(0,43,92,0.50)" }}
        >
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#7aA8e0" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "#a8c8f0" }}>
              {activeProductIds.size} active subscription{activeProductIds.size > 1 ? "s" : ""}
            </p>
            <p className="text-zinc-400 text-xs">
              {(myModulesData?.subscriptions ?? []).map((s) => s.product_name).join(" · ")}
            </p>
          </div>
          <button
            onClick={() => navigate("/billing")}
            className="ml-auto text-xs font-semibold underline"
            style={{ color: "#7aA8e0" }}
          >
            Manage →
          </button>
        </div>
      )}

      {/* ── STEP 1: Base subscription ── */}
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
            style={{ background: BB_CRIMSON, color: "#fff" }}
          >
            1
          </div>
          <span className="text-white font-black text-sm tracking-wide uppercase">Foundation — Required</span>
          <div className="flex-1 h-px" style={{ background: "rgba(155,28,46,0.25)" }} />
        </div>
        {baseProduct && (
          <BaseCard
            product={baseProduct}
            isActive={activeProductIds.has(baseProduct.id)}
            onSubscribe={() => handleSubscribe(baseProduct.id)}
            pending={pendingId === baseProduct.id && checkoutMutation.isPending}
          />
        )}
      </div>

      {/* Connector arrow */}
      <div className="flex items-center justify-center py-4 gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(0,43,92,0.30)" }} />
        <div
          className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ background: "rgba(0,43,92,0.20)", border: "1px solid rgba(0,43,92,0.45)", color: "#7aA8e0" }}
        >
          <Plus className="w-3 h-3" /> Then add what you need
        </div>
        <div className="flex-1 h-px" style={{ background: "rgba(0,43,92,0.30)" }} />
      </div>

      {/* ── STEP 2: Add-on modules ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
            style={{
              background: hasBase ? BB_NAVY : "rgba(0,43,92,0.20)",
              color: hasBase ? "#fff" : "rgba(100,150,200,0.5)",
              border: `1px solid ${hasBase ? BB_NAVY : "rgba(0,43,92,0.30)"}`,
            }}
          >
            2
          </div>
          <span className="font-black text-sm tracking-wide uppercase" style={{ color: hasBase ? "#fff" : "rgba(100,150,200,0.45)" }}>
            Add-on Modules — Optional
          </span>
          {!hasBase && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(0,43,92,0.15)", color: "rgba(100,150,200,0.5)", border: "1px solid rgba(0,43,92,0.25)" }}
            >
              <Lock className="w-2.5 h-2.5" /> Requires Base Subscription
            </span>
          )}
          <div className="flex-1 h-px" style={{ background: "rgba(0,43,92,0.20)" }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
          {addOns.map((p) => (
            <AddOnCard
              key={p.id}
              product={p}
              isActive={activeProductIds.has(p.id)}
              hasBase={hasBase}
              onSubscribe={() => handleSubscribe(p.id)}
              pending={pendingId === p.id && checkoutMutation.isPending}
            />
          ))}
        </div>
      </div>

      {/* ── Rx Defense: pay-per-report ── */}
      {rxReport && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
              style={{ background: "rgba(155,28,46,0.22)", color: BB_CRIMSON, border: `1px solid rgba(155,28,46,0.40)` }}
            >
              ✦
            </div>
            <span className="text-white font-black text-sm tracking-wide uppercase">Pay-Per-Report</span>
            <div className="flex-1 h-px" style={{ background: "rgba(155,28,46,0.20)" }} />
          </div>
          <RxDefenseCard
            report={rxReport}
            onPay={() => {
              setPendingId("rx-defense-report");
              rxDefenseMutation.mutate();
            }}
            pending={pendingId === "rx-defense-report" && rxDefenseMutation.isPending}
          />
        </div>
      )}

      {/* Footer */}
      <p className="text-center text-zinc-600 text-xs mt-6">
        All subscriptions billed monthly. Cancel anytime from your billing portal.
        Questions? Contact <span className="text-zinc-500">sales@kincaidiq.com</span>
      </p>
    </div>
  );
}
