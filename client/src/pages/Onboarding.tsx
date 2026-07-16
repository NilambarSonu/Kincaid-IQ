import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CheckCircle, Upload, Users, CreditCard, Rocket, Building2, ArrowRight, ArrowLeft } from "lucide-react";

const STEPS = [
  { id: 1, title: "Plan details", icon: Building2, desc: "Tell us about your health plan" },
  { id: 2, title: "Upload data", icon: Upload, desc: "Import your claims and Form 5500" },
  { id: 3, title: "Invite team", icon: Users, desc: "Add colleagues and set roles" },
  { id: 4, title: "Choose plan", icon: CreditCard, desc: "Select your subscription tier" },
  { id: 5, title: "Launch", icon: Rocket, desc: "You're ready to go" },
];

const PLANS = [
  { id: "fiduciary", name: "Plan Fiduciary", price: "$299/mo", color: "border-[rgba(83,58,253,0.5)] bg-[rgba(83,58,253,0.08)]" },
  { id: "broker", name: "Sales IQ Console", price: "$599/mo", color: "border-[rgba(255,86,0,0.42)] bg-[rgba(255,86,0,0.08)]", badge: "Most Popular" },
  { id: "enterprise", name: "Enterprise", price: "$1,999/mo", color: "border-[rgba(28,30,84,0.34)] bg-[rgba(28,30,84,0.06)]" },
];

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState("fiduciary");
  const [planDetails, setPlanDetails] = useState({ industry: "", annual_spend: "", tpa: "", carrier: "", renewal_date: "" });
  const [invites, setInvites] = useState("");
  const params = new URLSearchParams(window.location.search);

  const { data: orgData } = useQuery<{ org: any; role: string }>({ queryKey: ["/api/orgs/me"] });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await apiRequest("POST", "/api/billing/checkout", { plan_id: planId });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else setStep(5);
    },
  });

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="kiq-public-shell flex min-h-screen text-[color:var(--kiq-ink)]">
      <div className="kiq-shell-ambient" aria-hidden="true" />
      {/* Sidebar */}
      <div className="kiq-public-card relative z-10 hidden w-72 flex-col rounded-none border-y-0 border-l-0 p-6 lg:flex">
        <div className="mb-8">
          <div className="kiq-public-wordmark mb-5">Kincaid Health</div>
          <h2 className="mb-1 text-sm font-bold text-[color:var(--kiq-ink)]">Getting started</h2>
          <p className="text-xs text-[color:var(--kiq-muted)]">Complete setup in ~5 minutes</p>
        </div>
        <div className="space-y-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-[var(--kiq-radius-md)] text-left transition-all ${
                s.id === step ? "border border-[rgba(83,58,253,0.18)] bg-[rgba(83,58,253,0.08)] text-[color:var(--kiq-primary-deep)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]" :
                s.id < step ? "text-[color:var(--kiq-muted)] hover:bg-[var(--kiq-surface)]/60 hover:text-[color:var(--kiq-ink)]" : "text-[color:var(--kiq-subtle)]"
              }`}
              data-testid={`step-nav-${s.id}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                s.id < step ? "bg-green-500/10 text-green-600" : s.id === step ? "bg-[rgba(83,58,253,0.12)] text-[color:var(--kiq-primary-deep)]" : "bg-[var(--kiq-surface)]/60"
              }`}>
                {s.id < step ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-[color:var(--kiq-muted)]">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="relative z-10 flex flex-1 flex-col">
        <div className="border-b border-[rgba(13,37,61,0.08)] bg-[var(--kiq-surface)]/42 px-8 py-4 backdrop-blur-xl">
          <Progress value={progress} className="h-1 bg-[var(--kiq-surface)]/70" />
          <p className="mt-2 text-xs font-semibold text-[color:var(--kiq-muted)]">Step {step} of {STEPS.length}</p>
        </div>

        <div className="flex flex-1 items-center justify-center p-8">
          <div className="kiq-public-card w-full max-w-xl p-8">

            {/* Step 1 — Plan details */}
            {step === 1 && (
              <div className="space-y-6" data-testid="onboarding-step-1">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tell us about your health plan</h2>
                  <p className="text-[color:var(--kiq-muted)] text-sm">This helps us calibrate your benchmarks</p>
                </div>
                {orgData?.org && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <p className="text-blue-400 text-sm font-medium">{orgData.org.name}</p>
                    <p className="text-[var(--kiq-ink)]/40 text-xs">{orgData.org.org_type} · {orgData.org.employees || "—"} employees</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">Industry</Label>
                      <Input value={planDetails.industry} onChange={e => setPlanDetails(p => ({...p, industry: e.target.value}))} placeholder="Healthcare, Manufacturing..." className="" data-testid="input-industry" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">Annual Spend ($)</Label>
                      <Input value={planDetails.annual_spend} onChange={e => setPlanDetails(p => ({...p, annual_spend: e.target.value}))} placeholder="4,200,000" className="" data-testid="input-annual-spend" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">TPA / Claims Admin</Label>
                      <Input value={planDetails.tpa} onChange={e => setPlanDetails(p => ({...p, tpa: e.target.value}))} placeholder="Trustmark, Meritain..." className="" data-testid="input-tpa" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">Carrier / Network</Label>
                      <Input value={planDetails.carrier} onChange={e => setPlanDetails(p => ({...p, carrier: e.target.value}))} placeholder="BlueCross, Cigna..." className="" data-testid="input-carrier" />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">Plan renewal date</Label>
                    <Input type="date" value={planDetails.renewal_date} onChange={e => setPlanDetails(p => ({...p, renewal_date: e.target.value}))} className="bg-[var(--kiq-surface)]/5 border-white/10 text-[var(--kiq-ink)]" data-testid="input-renewal" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Upload data */}
            {step === 2 && (
              <div className="space-y-6" data-testid="onboarding-step-2">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Import your plan data</h2>
                  <p className="text-[color:var(--kiq-muted)] text-sm">You can skip this and add data later from the Vault</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Claims export (CSV/Excel)", desc: "12 months of paid claims data from your TPA", accept: ".csv,.xlsx" },
                    { label: "Form 5500 (PDF)", desc: "Your most recent DOL filing — or we can look it up", accept: ".pdf" },
                    { label: "Rx claims data", desc: "Pharmacy claims separate from medical, if available", accept: ".csv,.xlsx" },
                  ].map((item, i) => (
                    <label key={i} className="block cursor-pointer rounded-[var(--kiq-radius-md)] border border-dashed border-[rgba(13,37,61,0.14)] bg-[var(--kiq-surface)]/62 p-4 transition-all hover:border-[rgba(83,58,253,0.3)] hover:bg-[var(--kiq-surface)]/82" data-testid={`upload-area-${i}`}>
                      <input type="file" accept={item.accept} className="hidden" />
                      <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-[color:var(--kiq-muted)]" />
                        <div>
                          <p className="text-sm font-medium text-[color:var(--kiq-ink)]">{item.label}</p>
                          <p className="text-xs text-[color:var(--kiq-muted)]">{item.desc}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-[color:var(--kiq-subtle)] text-xs">All uploads are encrypted at rest and in transit. We never share your data.</p>
              </div>
            )}

            {/* Step 3 — Invite team */}
            {step === 3 && (
              <div className="space-y-6" data-testid="onboarding-step-3">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Invite your team</h2>
                  <p className="text-[color:var(--kiq-muted)] text-sm">Add colleagues by email, one per line. You can do this later too.</p>
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--kiq-subtle)]">Email addresses (one per line)</Label>
                  <textarea
                    value={invites}
                    onChange={e => setInvites(e.target.value)}
                    placeholder={"colleague@company.com\nhr-director@company.com\ncfo@company.com"}
                    className="h-36 w-full resize-none rounded-[var(--kiq-radius-md)] border border-[rgba(13,37,61,0.1)] bg-[var(--kiq-surface)]/78 p-4 text-sm text-[color:var(--kiq-ink)] outline-none placeholder:text-[color:var(--kiq-subtle)] focus:border-[color:var(--kiq-primary)] focus:ring-2 focus:ring-ring/35"
                    data-testid="input-invites"
                  />
                </div>
                <div className="rounded-[var(--kiq-radius-md)] border border-[rgba(13,37,61,0.08)] bg-[var(--kiq-surface)]/62 p-4">
                  <p className="text-sm font-medium text-[color:var(--kiq-ink)] mb-2">Role permissions</p>
                  <div className="space-y-1 text-xs text-[var(--kiq-ink)]/40">
                    <p><span className="text-[color:var(--kiq-muted)]">Owner</span> — Full access, billing, settings</p>
                    <p><span className="text-[color:var(--kiq-muted)]">Admin</span> — All analytics, manage members</p>
                    <p><span className="text-[color:var(--kiq-muted)]">Analyst</span> — Read + export, no billing</p>
                    <p><span className="text-[color:var(--kiq-muted)]">Viewer</span> — Read-only dashboards</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Choose plan */}
            {step === 4 && (
              <div className="space-y-6" data-testid="onboarding-step-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Choose your plan</h2>
                  <p className="text-[color:var(--kiq-muted)] text-sm">14-day free trial on all plans · Cancel anytime</p>
                </div>
                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlan === plan.id ? plan.color : "border-[rgba(13,37,61,0.08)] bg-[var(--kiq-surface)]/62 hover:border-[rgba(83,58,253,0.22)]"}`}
                      data-testid={`plan-option-${plan.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? "border-blue-400" : "border-[rgba(13,37,61,0.18)]"}`}>
                            {selectedPlan === plan.id && <div className="w-2 h-2 rounded-full bg-[color:var(--kiq-primary)]" />}
                          </div>
                          <div>
                            <span className="font-medium text-[var(--kiq-ink)]">{plan.name}</span>
                            {plan.badge && <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{plan.badge}</Badge>}
                          </div>
                        </div>
                        <span className="text-[color:var(--kiq-muted)] text-sm">{plan.price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Launch */}
            {step === 5 && (
              <div className="text-center space-y-6" data-testid="onboarding-step-5">
                <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">You're all set!</h2>
                  <p className="text-[color:var(--kiq-muted)]">Your workspace is ready. Let's explore your plan intelligence.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  {[
                    { label: "Fiduciary Dashboard", path: "/saas/fiduciary", color: "bg-blue-500/10 border-blue-500/20" },
                    { label: "Provider Network", path: "/saas/network", color: "bg-cyan-500/10 border-cyan-500/20" },
                    { label: "Stop-Loss Intelligence", path: "/saas/stoploss", color: "bg-purple-500/10 border-purple-500/20" },
                    { label: "Sales IQ Console", path: "/saas/broker", color: "bg-amber-500/10 border-amber-500/20" },
                  ].map((item, i) => (
                    <button key={i} onClick={() => setLocation(item.path)} className={`p-3 rounded-xl border text-sm font-medium text-[color:var(--kiq-ink)] hover:text-[var(--kiq-ink)] transition-colors ${item.color}`} data-testid={`launch-btn-${i}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <Button className="w-full" onClick={() => setLocation("/saas/fiduciary")} data-testid="btn-launch">
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Navigation */}
            {step < 5 && (
              <div className="flex items-center gap-3 mt-8">
                {step > 1 && (
                  <Button variant="outline" className="gap-2" onClick={() => setStep(s => s - 1)} data-testid="btn-prev">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                )}
                <Button
                  className="flex-1 gap-2"
                  onClick={() => {
                    if (step === 4) checkoutMutation.mutate(selectedPlan);
                    else setStep(s => s + 1);
                  }}
                  disabled={checkoutMutation.isPending}
                  data-testid="btn-next"
                >
                  {step === 4 ? (checkoutMutation.isPending ? "Redirecting..." : "Start trial") : "Continue"}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                {step !== 4 && (
                  <button onClick={() => setStep(s => s + 1)} className="text-[color:var(--kiq-muted)] text-sm hover:text-[color:var(--kiq-muted)] whitespace-nowrap" data-testid="btn-skip">Skip</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

