import { Layout } from "@/components/Layout";
import { ShieldCheck } from "lucide-react";
import { ClaimsVerifier } from "@/features/claims";

export default function ClaimVerification() {
  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-5xl mx-auto">
        <div className="flex items-start gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-[#00FF94]" />
              <h1 className="text-xl font-bold tracking-tight">Claim Verification</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Browse, filter, and update verification status of all fiduciary claims
            </p>
          </div>
        </div>
        <ClaimsVerifier showStats showVerifyActions />
      </div>
    </Layout>
  );
}
