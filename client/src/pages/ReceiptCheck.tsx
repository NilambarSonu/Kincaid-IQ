import { Layout } from "@/components/Layout";
import { FileSearch } from "lucide-react";
import { ReceiptLookup } from "@/features/receipts";

export default function ReceiptCheck() {
  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] text-[var(--kiq-ink)] p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSearch className="w-5 h-5 text-[#A855F7]" />
              <h1 className="text-xl font-bold tracking-tight">Receipt Check</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Look up any decision receipt by ID · view full metadata and claim linkage
            </p>
          </div>
        </div>
        <ReceiptLookup showRecentList recentLimit={30} />
      </div>
    </Layout>
  );
}
