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
const BB_CRIMSON = "var(--kiq-primary)";
const BB_NAVY = "var(--kiq-navy)";

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
      className="kiq-public-card w-full p-8 text-left"
    >
      {/* B&B top accent bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 4, background: `linear-gradient(90deg, ${BB_NAVY} 0%, ${BB_CRIMSON} 100%)` }}
      />

      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-6 mt-1">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-50 border border-red-200"
            >
              <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center">
                <span className="text-[8px] font-black text-[var(--kiq-ink)]">KIQ</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[var(--kiq-ink)] font-extrabold text-xl leading-tight font-display">{product.name}</h3>
                <span
                  className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 uppercase tracking-wider"
                >
                  REQUIRED · STEP 1
                </span>
                {isActive && (
                  <span
                    className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-250 text-emerald-700"
                  >
                    ACTIVE
                  </span>
                )}
              </div>
              <p className="text-[var(--kiq-muted)] text-xs mt-1 font-medium">{product.description}</p>
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {product.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[var(--kiq-muted)]">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Price + CTA */}
        <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
          <div className="text-left sm:text-right">
            <div className="text-4xl font-extrabold text-slate-950 font-display">{product.price_display}</div>
            <div className="text-[var(--kiq-subtle)] text-sm font-semibold">/ {product.interval}</div>
          </div>
          <button
            data-testid={`btn-subscribe-${product.id}`}
            onClick={onSubscribe}
            disabled={pending || isActive}
            className="px-8 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border-none shadow-md shadow-red-500/10"
            style={{
              background: isActive
                ? "rgba(155,28,46,0.06)"
                : "linear-gradient(135deg, var(--kiq-primary) 0%, var(--kiq-primary-deep) 100%)",
              color: isActive ? "var(--kiq-primary-deep)" : "#fff",
              cursor: isActive ? "default" : "pointer",
              minWidth: 160,
              justifyContent: "center",
              border: isActive ? "1px solid rgba(155,28,46,0.15)" : "none",
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
          <p className="text-[10px] text-left sm:text-right font-medium text-[var(--kiq-subtle)]">Unlocks all add-on modules below</p>
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
      className="kiq-public-card flex flex-col p-7 text-left transition-all"
      style={{
        opacity: locked ? 0.7 : 1,
        border: isActive ? `2px solid ${c}` : `1px solid rgba(0,0,0,0.06)`,
        boxShadow: isActive ? `0 8px 30px ${c}15` : "0 4px 20px rgba(0,0,0,0.02)",
      }}
    >
      {/* Color accent strip at top */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{
          height: 3,
          background: locked
            ? `linear-gradient(90deg, transparent 10%, ${c}40 50%, transparent 90%)`
            : `linear-gradient(90deg, transparent 0%, ${c}90 50%, transparent 100%)`,
        }}
      />

      {product.badge && (
        <div
          className="absolute top-0 right-0 text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl text-[var(--kiq-ink)]"
          style={{ background: locked ? `${c}77` : c }}
        >
          <Star className="inline w-2.5 h-2.5 mr-1" />
          {product.badge}
        </div>
      )}

      {isActive && (
        <div
          className="absolute top-3 left-3 text-[9px] font-bold px-2.5 py-1 rounded-full tracking-wide bg-emerald-50 border border-emerald-200 text-emerald-700"
        >
          ✓ ACTIVE
        </div>
      )}

      {locked && (
        <div
          className="absolute top-3 right-3 flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full tracking-wide bg-amber-50 border border-amber-200 text-amber-700"
        >
          <Lock className="w-2.5 h-2.5" /> Requires Base
        </div>
      )}

      <div className="flex items-start gap-3 mb-4 mt-1" style={{ marginTop: isActive ? 22 : 6 }}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: locked ? `${c}08` : `${c}12`,
            border: `1.5px solid ${locked ? c + "30" : c + "50"}`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color: locked ? `${c}77` : c }} />
        </div>
        <div>
          <h3 className="font-bold text-sm leading-tight text-[var(--kiq-ink-soft)] font-display">
            {product.name}
          </h3>
          <p className="text-xs mt-1 leading-snug text-[var(--kiq-muted)] font-medium">
            {product.description}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <span className="text-2xl font-black font-display" style={{ color: locked ? "rgba(0,0,0,0.06)" : c }}>
          {product.price_display}
        </span>
        <span className="text-xs ml-1 text-[var(--kiq-subtle)] font-medium">
          / {product.interval} add-on
        </span>
      </div>

      <ul className="space-y-2 mb-5 flex-1 border-t border-slate-100 pt-4">
        {product.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--kiq-muted)]">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: locked ? `${c}55` : c }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        data-testid={`btn-subscribe-${product.id}`}
        onClick={onSubscribe}
        disabled={pending || isActive || locked}
        className="w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border"
        style={{
          background: isActive
            ? `${c}08`
            : locked
            ? "rgba(0,0,0,0.02)"
            : c,
          color: isActive ? c : locked ? "rgba(0,0,0,0.05)" : "#fff",
          border: `1px solid ${isActive ? c + "40" : locked ? "rgba(0,0,0,0.08)" : "transparent"}`,
          boxShadow: !isActive && !locked ? `0 4px 12px ${c}30` : "none",
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
      className="kiq-public-card w-full p-8 text-left"
    >
      {/* B&B top accent bar */}
      <div
        className="absolute top-0 left-0 right-0"
        style={{ height: 4, background: `linear-gradient(90deg, ${BB_CRIMSON} 0%, ${BB_NAVY} 100%)` }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mt-1">
        <div className="flex-1">
          <div
            className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-0.5 rounded-full mb-3 bg-red-50 border border-red-200 text-red-700"
          >
            <Receipt className="w-2.5 h-2.5 text-red-600" /> PAY PER REPORT — NO SUBSCRIPTION NEEDED
          </div>
          <h3 className="text-[var(--kiq-ink)] font-extrabold text-xl mb-2 font-display">PBM Contract Clarity 360™</h3>
          <p className="text-[var(--kiq-muted)] text-sm leading-relaxed max-w-lg font-medium">{report.description}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 flex-shrink-0">
          <div>
            <span className="text-4xl font-extrabold text-slate-950 font-display">{report.price_display}</span>
            <span className="text-[var(--kiq-subtle)] text-sm ml-1 font-semibold">per report</span>
          </div>
          <button
            data-testid="btn-pay-rx-defense"
            onClick={onPay}
            disabled={pending}
            className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer border-none shadow-lg shadow-red-500/10 text-white bg-red-655"
            style={{
              background: "linear-gradient(135deg, var(--kiq-primary) 0%, var(--kiq-primary-deep) 100%)",
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
    <div className="kiq-public-shell pb-16">
      <div className="kiq-public-container px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 animate-kincaid-slide-up">
          <div className="overflow-hidden rounded-2xl mb-7 mx-auto max-w-3xl border border-black/5 shadow-glass">
            <div className="w-full" style={{ height: 110, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="font-display" style={{ color: "#0f172a", fontWeight: 900, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>KINCAID HEALTH — FIDUCIARY INTELLIGENCE PLATFORM</span>
            </div>
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 bg-red-50 border border-red-200 text-red-700"
          >
            <Zap className="w-3.5 h-3.5 text-red-600" /> Sales IQ Console — Nationwide Rollout
          </div>
          <h1 className="kiq-public-title mb-3 text-4xl">Solution Value & Pricing</h1>
          <p className="kiq-public-lead mx-auto max-w-2xl text-base">
            Start with the <span className="font-bold text-red-600">$79/mo base</span> — required to access the platform.
            Then bolt on only the modules your clients need.
          </p>
        </div>

        {/* Active subscriptions banner */}
        {activeProductIds.size > 0 && (
          <div
            className="mb-8 rounded-xl px-5 py-4 flex items-center gap-3 bg-red-50/50 border border-red-200/50 animate-kincaid-slide-up"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-bold text-[var(--kiq-ink-soft)]">
                {activeProductIds.size} active subscription{activeProductIds.size > 1 ? "s" : ""}
              </p>
              <p className="text-[var(--kiq-muted)] text-xs font-semibold">
                {(myModulesData?.subscriptions ?? []).map((s) => s.product_name).join(" · ")}
              </p>
            </div>
            <button
              onClick={() => navigate("/billing")}
              className="ml-auto text-xs font-semibold underline text-red-700 hover:text-red-900 border-none bg-transparent cursor-pointer"
            >
              Manage →
            </button>
          </div>
        )}

        {/* ── STEP 1: Base subscription ── */}
        <div className="mb-4 animate-kincaid-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 bg-red-600 text-white"
            >
              1
            </div>
            <span className="text-[var(--kiq-ink)] font-extrabold text-xs tracking-wider uppercase font-display">Foundation — Required</span>
            <div className="flex-1 h-px bg-slate-200" />
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
        <div className="flex items-center justify-center py-6 gap-3 animate-kincaid-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="flex-1 h-px bg-slate-200" />
          <div
            className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full bg-[var(--kiq-canvas-parchment)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)]"
          >
            <Plus className="w-3 h-3 text-[var(--kiq-muted)]" /> Then add what you need
          </div>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* ── STEP 2: Add-on modules ── */}
        <div className="mb-10 animate-kincaid-slide-up" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-colors"
              style={{
                background: hasBase ? BB_NAVY : "rgba(0,0,0,0.06)",
                color: hasBase ? "#fff" : "rgba(0,0,0,0.05)",
                border: `1px solid ${hasBase ? "transparent" : "rgba(0,0,0,0.08)"}`,
              }}
            >
              2
            </div>
            <span className="font-extrabold text-xs tracking-wider uppercase font-display" style={{ color: hasBase ? "hsl(var(--kincaid-navy))" : "rgba(0,0,0,0.06)" }}>
              Add-on Modules — Optional
            </span>
            {!hasBase && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700"
              >
                <Lock className="w-2.5 h-2.5" /> Requires Base Subscription
              </span>
            )}
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
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

        {/* ── PBM Contract Clarity 360: pay-per-report ── */}
        {rxReport && (
          <div className="mb-8 animate-kincaid-slide-up" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 bg-red-50 border border-red-200 text-red-700"
              >
                ✦
              </div>
              <span className="text-[var(--kiq-ink)] font-extrabold text-xs tracking-wider uppercase font-display">Pay-Per-Report</span>
              <div className="flex-1 h-px bg-slate-200" />
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
        <p className="text-center text-[var(--kiq-subtle)] text-xs mt-10 font-semibold">
          All subscriptions billed monthly. Cancel anytime from your billing portal.<br />
          Questions? Contact <span className="text-[var(--kiq-muted)] font-bold">sales@kincaidiq.com</span>
        </p>
      </div>
    </div>
  );
}
