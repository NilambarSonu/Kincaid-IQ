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
    <div className="min-h-screen bg-[#020409] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-900/40 to-[#020409] p-12 flex-col justify-between border-r border-white/5">
        <div className="overflow-hidden rounded-xl cursor-pointer" onClick={() => setLocation("/landing")} style={{ border: "1px solid rgba(0,43,92,0.50)", boxShadow: "0 4px 20px rgba(0,43,92,0.25)" }}>
          <div className="w-full" style={{ height: 70, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>KINCAID IQ — FIDUCIARY INTELLIGENCE</span>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white mb-4">Healthcare plan intelligence, finally built right.</h2>
          <div className="space-y-4">
            {[
              "Instant ERISA compliance scoring across 10+ requirements",
              "Benchmark your plan cost vs. 2.4M Form 5500 peers",
              "Stop-loss optimization with catastrophic claim prediction",
              "Provider network adequacy with in-network leakage quantification",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 text-white/60 text-sm">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/20 text-sm">SOC 2 Type II · HIPAA Compliant · ERISA §408(b)(2) Ready</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
            <p className="text-white/40 text-sm">14-day free trial · No credit card required</p>
          </div>

          <form onSubmit={form.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-white/60 text-xs mb-1 block">Full name</Label>
                <Input {...form.register("full_name")} placeholder="Jeremiah Shrack" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-full-name" />
                {form.formState.errors.full_name && <p className="text-red-400 text-xs mt-1">{form.formState.errors.full_name.message}</p>}
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1 block">Username</Label>
                <Input {...form.register("username")} placeholder="j.shrack" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-username" />
                {form.formState.errors.username && <p className="text-red-400 text-xs mt-1">{form.formState.errors.username.message}</p>}
              </div>
              <div>
                <Label className="text-white/60 text-xs mb-1 block">Email</Label>
                <Input {...form.register("email")} type="email" placeholder="you@company.com" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-email" />
                {form.formState.errors.email && <p className="text-red-400 text-xs mt-1">{form.formState.errors.email.message}</p>}
              </div>
            </div>

            <div className="relative">
              <Label className="text-white/60 text-xs mb-1 block">Password</Label>
              <div className="relative">
                <Input {...form.register("password")} type={showPw ? "text" : "password"} placeholder="8+ characters" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pr-10" data-testid="input-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && <p className="text-red-400 text-xs mt-1">{form.formState.errors.password.message}</p>}
            </div>

            <div className="border-t border-white/5 pt-4">
              <p className="text-white/40 text-xs mb-3 uppercase tracking-wider">Organization</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-white/60 text-xs mb-1 block">Organization name</Label>
                  <Input {...form.register("org_name")} placeholder="Acme Corp Benefits" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-org-name" />
                  {form.formState.errors.org_name && <p className="text-red-400 text-xs mt-1">{form.formState.errors.org_name.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/60 text-xs mb-1 block">Type</Label>
                    <Select onValueChange={(v) => form.setValue("org_type", v)} defaultValue="employer">
                      <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-org-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employer">Employer</SelectItem>
                        <SelectItem value="broker">Benefits Broker</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="tpa">TPA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/60 text-xs mb-1 block">Employees (est.)</Label>
                    <Input {...form.register("employees")} type="number" placeholder="450" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" data-testid="input-employees" />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2 mt-2" disabled={registerMutation.isPending} data-testid="btn-signup-submit">
              {registerMutation.isPending ? "Creating account..." : <><span>Create account</span><ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-center text-white/30 text-sm mt-6">
            Already have an account?{" "}
            <button onClick={() => setLocation("/login")} className="text-blue-400 hover:text-blue-300" data-testid="link-signin">Sign in</button>
          </p>
          <p className="text-center text-white/20 text-xs mt-3">
            By creating an account you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
