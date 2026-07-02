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
  { id: "fiduciary", name: "Plan Fiduciary", price: "$299/mo", color: "border-blue-500/50 bg-blue-500/5" },
  { id: "broker", name: "Sales IQ Console", price: "$599/mo", color: "border-amber-500/50 bg-amber-500/5", badge: "Most Popular" },
  { id: "enterprise", name: "Enterprise", price: "$1,999/mo", color: "border-purple-500/50 bg-purple-500/5" },
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
    <div className="min-h-screen bg-[#020409] text-white flex">
      {/* Sidebar */}
      <div className="hidden lg:flex w-64 bg-white/2 border-r border-white/5 flex-col p-6">
        <div className="mb-8">
          <h2 className="font-bold text-white text-sm mb-1">Getting started</h2>
          <p className="text-white/40 text-xs">Complete setup in ~5 minutes</p>
        </div>
        <div className="space-y-2">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                s.id === step ? "bg-blue-500/10 border border-blue-500/30 text-white" :
                s.id < step ? "text-white/50 hover:text-white/70" : "text-white/25"
              }`}
              data-testid={`step-nav-${s.id}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                s.id < step ? "bg-green-500/20" : s.id === step ? "bg-blue-500/20" : "bg-white/5"
              }`}>
                {s.id < step ? <CheckCircle className="w-4 h-4 text-green-400" /> : <s.icon className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-sm font-medium">{s.title}</div>
                <div className="text-xs text-white/30">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-white/5 px-8 py-4">
          <Progress value={progress} className="h-1 bg-white/10" />
          <p className="text-white/30 text-xs mt-2">Step {step} of {STEPS.length}</p>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-lg">

            {/* Step 1 — Plan details */}
            {step === 1 && (
              <div className="space-y-6" data-testid="onboarding-step-1">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tell us about your health plan</h2>
                  <p className="text-white/40 text-sm">This helps us calibrate your benchmarks</p>
                </div>
                {orgData?.org && (
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <p className="text-blue-400 text-sm font-medium">{orgData.org.name}</p>
                    <p className="text-white/40 text-xs">{orgData.org.org_type} · {orgData.org.employees || "—"} employees</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Industry</Label>
                      <Input value={planDetails.industry} onChange={e => setPlanDetails(p => ({...p, industry: e.target.value}))} placeholder="Healthcare, Manufacturing..." className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-industry" />
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Annual Spend ($)</Label>
                      <Input value={planDetails.annual_spend} onChange={e => setPlanDetails(p => ({...p, annual_spend: e.target.value}))} placeholder="4,200,000" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-annual-spend" />
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">TPA / Claims Admin</Label>
                      <Input value={planDetails.tpa} onChange={e => setPlanDetails(p => ({...p, tpa: e.target.value}))} placeholder="Trustmark, Meritain..." className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-tpa" />
                    </div>
                    <div>
                      <Label className="text-white/60 text-xs mb-1 block">Carrier / Network</Label>
                      <Input value={planDetails.carrier} onChange={e => setPlanDetails(p => ({...p, carrier: e.target.value}))} placeholder="BlueCross, Cigna..." className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-carrier" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs mb-1 block">Plan renewal date</Label>
                    <Input type="date" value={planDetails.renewal_date} onChange={e => setPlanDetails(p => ({...p, renewal_date: e.target.value}))} className="bg-white/5 border-white/10 text-white" data-testid="input-renewal" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Upload data */}
            {step === 2 && (
              <div className="space-y-6" data-testid="onboarding-step-2">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Import your plan data</h2>
                  <p className="text-white/40 text-sm">You can skip this and add data later from the Vault</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Claims export (CSV/Excel)", desc: "12 months of paid claims data from your TPA", accept: ".csv,.xlsx" },
                    { label: "Form 5500 (PDF)", desc: "Your most recent DOL filing — or we can look it up", accept: ".pdf" },
                    { label: "Rx claims data", desc: "Pharmacy claims separate from medical, if available", accept: ".csv,.xlsx" },
                  ].map((item, i) => (
                    <label key={i} className="block p-4 rounded-xl border border-dashed border-white/15 hover:border-white/30 cursor-pointer transition-colors bg-white/2" data-testid={`upload-area-${i}`}>
                      <input type="file" accept={item.accept} className="hidden" />
                      <div className="flex items-center gap-3">
                        <Upload className="w-5 h-5 text-white/30" />
                        <div>
                          <p className="text-sm font-medium text-white/80">{item.label}</p>
                          <p className="text-xs text-white/30">{item.desc}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-white/25 text-xs">All uploads are encrypted at rest and in transit. We never share your data.</p>
              </div>
            )}

            {/* Step 3 — Invite team */}
            {step === 3 && (
              <div className="space-y-6" data-testid="onboarding-step-3">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Invite your team</h2>
                  <p className="text-white/40 text-sm">Add colleagues by email, one per line. You can do this later too.</p>
                </div>
                <div>
                  <Label className="text-white/60 text-xs mb-2 block">Email addresses (one per line)</Label>
                  <textarea
                    value={invites}
                    onChange={e => setInvites(e.target.value)}
                    placeholder={"colleague@company.com\nhr-director@company.com\ncfo@company.com"}
                    className="w-full h-36 p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 text-sm resize-none focus:outline-none focus:border-blue-500/50"
                    data-testid="input-invites"
                  />
                </div>
                <div className="p-4 rounded-xl bg-white/3 border border-white/8">
                  <p className="text-sm font-medium text-white/70 mb-2">Role permissions</p>
                  <div className="space-y-1 text-xs text-white/40">
                    <p><span className="text-white/60">Owner</span> — Full access, billing, settings</p>
                    <p><span className="text-white/60">Admin</span> — All analytics, manage members</p>
                    <p><span className="text-white/60">Analyst</span> — Read + export, no billing</p>
                    <p><span className="text-white/60">Viewer</span> — Read-only dashboards</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Choose plan */}
            {step === 4 && (
              <div className="space-y-6" data-testid="onboarding-step-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Choose your plan</h2>
                  <p className="text-white/40 text-sm">14-day free trial on all plans · Cancel anytime</p>
                </div>
                <div className="space-y-3">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlan === plan.id ? plan.color : "border-white/8 bg-white/2 hover:border-white/15"}`}
                      data-testid={`plan-option-${plan.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? "border-blue-400" : "border-white/20"}`}>
                            {selectedPlan === plan.id && <div className="w-2 h-2 rounded-full bg-blue-400" />}
                          </div>
                          <div>
                            <span className="font-medium text-white">{plan.name}</span>
                            {plan.badge && <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{plan.badge}</Badge>}
                          </div>
                        </div>
                        <span className="text-white/60 text-sm">{plan.price}</span>
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
                  <p className="text-white/50">Your workspace is ready. Let's explore your plan intelligence.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-left">
                  {[
                    { label: "Fiduciary Dashboard", path: "/saas/fiduciary", color: "bg-blue-500/10 border-blue-500/20" },
                    { label: "Provider Network", path: "/saas/network", color: "bg-cyan-500/10 border-cyan-500/20" },
                    { label: "Stop-Loss Intelligence", path: "/saas/stoploss", color: "bg-purple-500/10 border-purple-500/20" },
                    { label: "Sales IQ Console", path: "/saas/broker", color: "bg-amber-500/10 border-amber-500/20" },
                  ].map((item, i) => (
                    <button key={i} onClick={() => setLocation(item.path)} className={`p-3 rounded-xl border text-sm font-medium text-white/70 hover:text-white transition-colors ${item.color}`} data-testid={`launch-btn-${i}`}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white" onClick={() => setLocation("/saas/fiduciary")} data-testid="btn-launch">
                  Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Navigation */}
            {step < 5 && (
              <div className="flex items-center gap-3 mt-8">
                {step > 1 && (
                  <Button variant="outline" className="border-white/15 text-white/60 hover:bg-white/5 gap-2" onClick={() => setStep(s => s - 1)} data-testid="btn-prev">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                )}
                <Button
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white gap-2"
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
                  <button onClick={() => setStep(s => s + 1)} className="text-white/30 text-sm hover:text-white/50 whitespace-nowrap" data-testid="btn-skip">Skip</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
