import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle, CreditCard, ArrowUpRight, AlertCircle, Clock,
  Zap, Shield, BarChart3, Star, Lock, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

const BG = "#F8FAFC";
const BORDER = "#e2e8f0";

const PLANS = [
  {
    id: "fiduciary",
    name: "Plan Fiduciary",
    price: 297,
    tagline: "For self-funded plan sponsors",
    color: "#4f7dff",
    icon: Shield,
    highlight: false,
    modules: [
      "Executive War Room (full KPIs)",
      "PBM Contract Clarity 360™ — PBM Contract AI",
      "CAA 2026 Compliance Dashboard",
      "DOL 5500 Intelligence Engine",
      "Board Pack Export",
      "Stewardship Builder",
      "Proof Ledger + SHA-256 Receipts",
      "2 team seats",
    ],
  },
  {
    id: "broker",
    name: "Sales IQ Console",
    price: 997,
    tagline: "For benefits brokers & consultants",
    color: "#f59e0b",
    icon: BarChart3,
    highlight: true,
    badge: "Most Popular",
    modules: [
      "Everything in Plan Fiduciary",
      "Actuarial Engine IQ™",
      "Indiana Prospecting Engine",
      "Stop-Loss Intelligence Engine",
      "Network Disruption Report",
      "Claims Recovery Engine",
      "Shadow Tax Exposure Module",
      "Zero-Trust Governance",
      "CFO War Room",
      "Unlimited client roster",
      "10 team seats · White-label reports",
    ],
  },
  {
    id: "enterprise",
    name: "Fiduciary Command",
    price: 2497,
    tagline: "Full platform for TPAs & large groups",
    color: "#22c55e",
    icon: Zap,
    highlight: false,
    badge: "All-Access",
    modules: [
      "Everything in Sales IQ Console",
      "God Mode Admin Panel",
      "SBI Forensic Engine",
      "CEI Engine + GLP-1 Stress Test",
      "Full Audit Trail + Security Posture",
      "Unlimited seats",
      "API access (REST + webhooks)",
      "Dedicated Customer Success Manager",
      "SOC 2 documentation",
      "Custom integrations on request",
    ],
  },
];

const COMPARISON_ROWS = [
  { label: "Executive War Room",        fiduciary: true,  broker: true,  enterprise: true  },
  { label: "PBM Contract Clarity 360™ — PBM AI",      fiduciary: true,  broker: true,  enterprise: true  },
  { label: "CAA 2026 Compliance",       fiduciary: true,  broker: true,  enterprise: true  },
  { label: "DOL 5500 Intelligence",     fiduciary: true,  broker: true,  enterprise: true  },
  { label: "Board Pack Export",         fiduciary: true,  broker: true,  enterprise: true  },
  { label: "Proof Ledger",              fiduciary: true,  broker: true,  enterprise: true  },
  { label: "Actuarial Engine IQ™",      fiduciary: false, broker: true,  enterprise: true  },
  { label: "Indiana Prospecting Engine",fiduciary: false, broker: true,  enterprise: true  },
  { label: "Stop-Loss Intelligence",    fiduciary: false, broker: true,  enterprise: true  },
  { label: "Claims Recovery Engine",    fiduciary: false, broker: true,  enterprise: true  },
  { label: "Network Disruption Report", fiduciary: false, broker: true,  enterprise: true  },
  { label: "Shadow Tax / Zero-Trust",   fiduciary: false, broker: true,  enterprise: true  },
  { label: "God Mode + SBI Forensic",  fiduciary: false, broker: false, enterprise: true  },
  { label: "CEI + GLP-1 Stress Test",  fiduciary: false, broker: false, enterprise: true  },
  { label: "Full Audit Trail",          fiduciary: false, broker: false, enterprise: true  },
  { label: "API Access",                fiduciary: false, broker: false, enterprise: true  },
  { label: "Team seats",                fiduciary: "2",   broker: "10",  enterprise: "∞"   },
  { label: "Client roster",             fiduciary: "1",   broker: "∞",   enterprise: "∞"   },
  { label: "White-label reports",       fiduciary: false, broker: true,  enterprise: true  },
  { label: "Dedicated CSM",             fiduciary: false, broker: false, enterprise: true  },
];

const FAQS = [
  { q: "Is there a free trial?", a: "Yes — every paid plan starts with a 14-day free trial. No credit card charge until the trial ends. Cancel anytime." },
  { q: "Can I change plans later?", a: "Yes. Upgrades take effect immediately and are prorated. Downgrades apply at the next billing cycle." },
  { q: "What counts as a 'team seat'?", a: "A seat is any user who logs into the platform. Admin accounts don't count against the seat limit." },
  { q: "Is my data secure?", a: "Yes. All data is encrypted in transit and at rest. Every KPI is backed by a SHA-256 evidence receipt. Enterprise plans include SOC 2 documentation." },
  { q: "What's included in white-label reports?", a: "Board packs and stewardship reports can be exported with your firm's branding — logo, colors, and contact information — for delivery to plan sponsors." },
];

function Check({ val, color }: { val: boolean | string; color: string }) {
  if (val === false) return <span className="text-[var(--kiq-ink)]/15 text-sm">—</span>;
  if (typeof val === "string") return <span className="text-xs font-semibold" style={{ color }}>{val}</span>;
  return <CheckCircle className="w-4 h-4 mx-auto" style={{ color }} />;
}

export default function Billing() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const successParam = params.get("success");
  const canceledParam = params.get("canceled");
  const [showComparison, setShowComparison] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: sub, isLoading } = useQuery<any>({ queryKey: ["/api/billing/subscription"] });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await apiRequest("POST", "/api/billing/checkout", { plan_id: planId });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/billing/portal");
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const statusColor =
    sub?.status === "active"   ? { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/25"  } :
    sub?.status === "trialing" ? { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/25"   } :
    sub?.status === "past_due" ? { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/25"    } :
                                 { text: "text-[var(--kiq-ink)]/40",   bg: "bg-[var(--kiq-surface)]/5",        border: "border-white/10"      };

  const currentPlan = sub?.plan;

  return (
    <div
      className="min-h-screen p-6 md:p-10"
      style={{ background: BG }}
      data-testid="billing-page"
    >
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="w-5 h-5 text-[var(--kiq-ink)]/40" />
            <span className="text-xs text-[var(--kiq-ink)]/30 uppercase tracking-widest font-medium">Billing</span>
          </div>
          <h1 className="text-3xl font-bold text-[var(--kiq-ink)]">Plans & Pricing</h1>
          <p className="text-[var(--kiq-ink)]/40 mt-1 text-sm">Fiduciary-grade healthcare intelligence. Cancel or change plans anytime.</p>
        </div>

        {/* Success / Canceled banners */}
        {successParam && (
          <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center gap-3" data-testid="banner-success">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-400 font-medium text-sm">Subscription activated!</p>
              <p className="text-green-400/60 text-xs">Your plan is now live. Welcome to Kincaid Health VERIFY™.</p>
            </div>
          </div>
        )}
        {canceledParam && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3" data-testid="banner-canceled">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-400 text-sm">Checkout was canceled. No charges were made.</p>
          </div>
        )}

        {/* Current plan status */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}` }}
          data-testid="current-plan-card"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--kiq-ink)]">Current Subscription</h2>
            <Badge className={`capitalize border text-xs ${statusColor.text} ${statusColor.bg} ${statusColor.border}`} data-testid="subscription-status">
              {isLoading ? "Loading…" : (sub?.status || "No subscription")}
            </Badge>
          </div>

          {isLoading ? (
            <div className="h-14 rounded-xl bg-[var(--kiq-surface)]/5 animate-pulse" />
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Zap className="w-4.5 h-4.5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-[var(--kiq-ink)] text-sm capitalize">
                    {currentPlan === "trial" ? "Free Trial" : currentPlan || "No active plan"}
                  </p>
                  {sub?.trial_ends_at && (
                    <p className="text-[var(--kiq-ink)]/40 text-xs flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Trial ends {new Date(sub.trial_ends_at).toLocaleDateString()}
                    </p>
                  )}
                  {sub?.subscription?.current_period_end && (
                    <p className="text-[var(--kiq-ink)]/40 text-xs mt-0.5">
                      Renews {new Date(sub.subscription.current_period_end * 1000).toLocaleDateString()}
                    </p>
                  )}
                  {!currentPlan && (
                    <p className="text-[var(--kiq-ink)]/30 text-xs mt-0.5">Select a plan below to get started</p>
                  )}
                </div>
              </div>
              {sub?.org?.name && currentPlan && currentPlan !== "trial" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-[var(--kiq-ink)]/60 hover:bg-[var(--kiq-surface)]/5 gap-1.5 text-xs"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  data-testid="btn-manage-billing"
                >
                  <ExternalLink className="w-3 h-3" />
                  Manage billing
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div>
          <p className="text-[var(--kiq-ink)]/30 text-xs uppercase tracking-widest font-medium mb-5">Choose your plan — 14-day free trial on all paid plans</p>
          <div className="grid md:grid-cols-3 gap-5">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const Icon = plan.icon;
              const isEnterprise = plan.id === "enterprise";
              return (
                <div
                  key={plan.id}
                  className="rounded-2xl p-6 flex flex-col transition-all duration-200 relative"
                  style={{
                    background: plan.highlight ? `${plan.color}08` : "rgba(255,255,255,0.025)",
                    border: `1px solid ${isCurrent ? plan.color + "50" : plan.highlight ? plan.color + "30" : BORDER}`,
                    boxShadow: plan.highlight ? `0 0 40px ${plan.color}10` : "none",
                  }}
                  data-testid={`plan-card-${plan.id}`}
                >
                  {plan.badge && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: plan.color, color: "#F8FAFC" }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${plan.color}18`, border: `1px solid ${plan.color}30` }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--kiq-ink)] text-sm">{plan.name}</p>
                      <p className="text-[var(--kiq-ink)]/35 text-xs">{plan.tagline}</p>
                    </div>
                  </div>

                  <div className="mb-5">
                    {isEnterprise ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-[var(--kiq-ink)]">Custom</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold text-[var(--kiq-ink)]">${plan.price.toLocaleString()}</span>
                        <span className="text-[var(--kiq-ink)]/35 text-sm">/mo</span>
                      </div>
                    )}
                  </div>

                  <ul className="space-y-1.5 mb-6 flex-1">
                    {plan.modules.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-[var(--kiq-ink)]/55">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button
                      className="w-full text-xs"
                      style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}30` }}
                      disabled
                      data-testid={`btn-current-${plan.id}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      Current plan
                    </Button>
                  ) : isEnterprise ? (
                    <Button
                      className="w-full text-xs font-semibold gap-2"
                      style={{ background: `${plan.color}18`, color: plan.color, border: `1px solid ${plan.color}30` }}
                      onClick={() => window.location.href = "mailto:sales@kincaidrmc.com?subject=Fiduciary%20Command%20Inquiry"}
                      data-testid="btn-contact-sales"
                    >
                      Contact sales
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  ) : (
                    <Button
                      className="w-full text-xs font-semibold gap-2"
                      style={plan.highlight ? { background: plan.color, color: "#F8FAFC" } : { background: `${plan.color}18`, color: plan.color, border: `1px solid ${plan.color}30` }}
                      disabled={checkoutMutation.isPending}
                      onClick={() => checkoutMutation.mutate(plan.id)}
                      data-testid={`btn-select-${plan.id}`}
                    >
                      Start 14-day trial
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature comparison toggle */}
        <div>
          <button
            className="flex items-center gap-2 text-[var(--kiq-ink)]/50 hover:text-[var(--kiq-ink)]/80 text-sm transition-colors w-full py-3 border-t border-white/8"
            onClick={() => setShowComparison(!showComparison)}
            data-testid="btn-toggle-comparison"
          >
            {showComparison ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showComparison ? "Hide" : "Show"} full feature comparison
          </button>

          {showComparison && (
            <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#ffffff", borderBottom: `1px solid ${BORDER}` }}>
                    <th className="text-left px-5 py-3 text-[var(--kiq-ink)]/40 font-medium text-xs w-2/5">Feature</th>
                    <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: "#4f7dff" }}>Fiduciary<br /><span className="text-[var(--kiq-ink)]/30">$297/mo</span></th>
                    <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: "#f59e0b" }}>Sales IQ<br /><span className="text-[var(--kiq-ink)]/30">$997/mo</span></th>
                    <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: "#22c55e" }}>Command<br /><span className="text-[var(--kiq-ink)]/30">$2,497/mo</span></th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr
                      key={i}
                      className="border-t"
                      style={{ borderColor: BORDER, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}
                    >
                      <td className="px-5 py-2.5 text-[var(--kiq-ink)]/60 text-xs">{row.label}</td>
                      <td className="text-center px-3 py-2.5"><Check val={row.fiduciary} color="#4f7dff" /></td>
                      <td className="text-center px-3 py-2.5"><Check val={row.broker} color="#f59e0b" /></td>
                      <td className="text-center px-3 py-2.5"><Check val={row.enterprise} color="#22c55e" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FAQ */}
        <div>
          <h3 className="text-[var(--kiq-ink)] font-semibold mb-4">Frequently asked questions</h3>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${BORDER}` }}
                data-testid={`faq-${i}`}
              >
                <button
                  className="w-full text-left px-5 py-4 flex items-center justify-between text-[var(--kiq-ink)]/80 hover:text-[var(--kiq-ink)] text-sm font-medium transition-colors"
                  style={{ background: openFaq === i ? "#ffffff" : "#ffffff" }}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-[var(--kiq-ink)]/30 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-[var(--kiq-ink)]/30 flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-[var(--kiq-ink)]/50 text-sm leading-relaxed" style={{ background: "#ffffff" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div
          className="p-4 rounded-xl flex items-start gap-3"
          style={{ background: "#ffffff", border: `1px solid ${BORDER}` }}
        >
          <Lock className="w-4 h-4 text-[var(--kiq-ink)]/25 flex-shrink-0 mt-0.5" />
          <p className="text-[var(--kiq-ink)]/30 text-xs leading-relaxed">
            All plans include a 14-day free trial — no charge until the trial ends. Payments are processed securely via Stripe.
            Annual pricing available on request. To activate live billing, a <code className="text-[var(--kiq-ink)]/40">STRIPE_SECRET_KEY</code> and{" "}
            <code className="text-[var(--kiq-ink)]/40">STRIPE_WEBHOOK_SECRET</code> must be configured in the environment.
          </p>
        </div>
      </div>
    </div>
  );
}
