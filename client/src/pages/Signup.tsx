import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Zap, ArrowRight, Eye, EyeOff } from "lucide-react";

const schema = z.object({
  username: z.string().min(3, "At least 3 characters").regex(/^[a-z0-9._-]+$/i, "Letters, numbers, dots and hyphens only"),
  email: z.string().email("Valid email required"),
  full_name: z.string().min(2, "Full name required"),
  password: z.string().min(8, "At least 8 characters"),
  org_name: z.string().min(2, "Organization name required"),
  org_type: z.string().min(1, "Select organization type"),
  employees: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPw, setShowPw] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const planId = params.get("plan") || "fiduciary";

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { org_type: "employer" } });

  const registerMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const r = await apiRequest("POST", "/api/auth/register", {
        username: data.username, email: data.email, full_name: data.full_name, password: data.password,
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || "Registration failed"); }
      return r.json();
    },
    onSuccess: async (authData, data) => {
      try {
        await apiRequest("POST", "/api/orgs", {
          name: data.org_name, org_type: data.org_type,
          employees: data.employees ? parseInt(data.employees) : null,
        });
      } catch (_) {}
      setLocation(`/onboarding?plan=${planId}`);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen bg-[var(--kiq-canvas-soft)] flex font-sans">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-100 to-slate-200/50 p-12 flex-col justify-between border-r border-[var(--kiq-hairline)] relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-red-100/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-blue-100/20 blur-3xl pointer-events-none" />

        <div className="overflow-hidden rounded-xl cursor-pointer shadow-glass border border-black/5 relative z-10" onClick={() => setLocation("/landing")} style={{ width: "fit-content" }}>
          <div className="px-6 py-4" style={{ height: 60, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.95)", fontWeight: 900, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>KINCAID HEALTH — FIDUCIARY INTELLIGENCE</span>
          </div>
        </div>
        <div className="relative z-10">
          <h2 className="text-4xl font-extrabold text-[var(--kiq-ink)] mb-6 font-display leading-tight">Healthcare plan intelligence, finally built right.</h2>
          <div className="space-y-4">
            {[
              "Instant ERISA compliance scoring across 10+ requirements",
              "Benchmark your plan cost vs. 2.4M Form 5500 peers",
              "Stop-loss optimization with catastrophic claim prediction",
              "Provider network adequacy with in-network leakage quantification",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-[var(--kiq-muted)] text-sm">
                <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[var(--kiq-subtle)] text-xs relative z-10">SOC 2 Type II · HIPAA Compliant · ERISA §408(b)(2) Ready</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--kiq-canvas-soft)]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-[var(--kiq-ink)] mb-2 font-display">Create your account</h1>
            <p className="text-[var(--kiq-muted)] text-sm">14-day free trial · No credit card required</p>
          </div>

          <div className="glass-3d bg-[var(--kiq-surface)] p-7 rounded-2xl shadow-glass border border-[var(--kiq-hairline)]/50">
            <form onSubmit={form.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Full name</Label>
                  <Input {...form.register("full_name")} placeholder="Jeremiah Shrack" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-full-name" />
                  {form.formState.errors.full_name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.full_name.message}</p>}
                </div>
                <div>
                  <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Username</Label>
                  <Input {...form.register("username")} placeholder="j.shrack" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-username" />
                  {form.formState.errors.username && <p className="text-red-500 text-xs mt-1">{form.formState.errors.username.message}</p>}
                </div>
                <div>
                  <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Email</Label>
                  <Input {...form.register("email")} type="email" placeholder="you@company.com" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-email" />
                  {form.formState.errors.email && <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>}
                </div>
              </div>

              <div className="relative">
                <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Password</Label>
                <div className="relative">
                  <Input {...form.register("password")} type={showPw ? "text" : "password"} placeholder="8+ characters" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 pr-10 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--kiq-subtle)] hover:text-[var(--kiq-muted)]">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.formState.errors.password && <p className="text-red-500 text-xs mt-1">{form.formState.errors.password.message}</p>}
              </div>

              <div className="border-t border-[var(--kiq-hairline)]/60 pt-4">
                <p className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-3">Organization</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Organization name</Label>
                    <Input {...form.register("org_name")} placeholder="Acme Corp Benefits" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-org-name" />
                    {form.formState.errors.org_name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.org_name.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Type</Label>
                      <Select onValueChange={(v) => form.setValue("org_type", v)} defaultValue="employer">
                        <SelectTrigger className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] rounded-xl focus:ring-red-500 focus:border-red-500" data-testid="select-org-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--kiq-surface)] border-[var(--kiq-hairline)]">
                          <SelectItem value="employer">Employer</SelectItem>
                          <SelectItem value="broker">Benefits Broker</SelectItem>
                          <SelectItem value="consultant">Consultant</SelectItem>
                          <SelectItem value="tpa">TPA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[var(--kiq-muted)] text-xs font-semibold uppercase tracking-wider mb-1 block">Employees (est.)</Label>
                      <Input {...form.register("employees")} type="number" placeholder="450" className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink)] placeholder:text-[var(--kiq-subtle)]/50 rounded-xl focus-visible:ring-1 focus-visible:ring-red-500 focus-visible:border-red-500" data-testid="input-employees" />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 mt-4 py-6 rounded-xl font-semibold shadow-lg shadow-red-500/10 cursor-pointer border-none" disabled={registerMutation.isPending} data-testid="btn-signup-submit">
                {registerMutation.isPending ? "Creating account..." : <><span>Create account</span><ArrowRight className="w-4 h-4" /></>}
              </Button>
            </form>

            <p className="text-center text-[var(--kiq-muted)] text-sm mt-6">
              Already have an account?{" "}
              <button onClick={() => setLocation("/auth")} className="text-red-600 hover:text-red-700 font-semibold" data-testid="link-signin">Sign in</button>
            </p>
            <p className="text-center text-[var(--kiq-subtle)] text-xs mt-3">
              By creating an account you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
