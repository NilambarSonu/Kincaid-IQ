import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { ScrollText, FileCheck } from "lucide-react";
import { AuditLogPanel } from "@/features/audit";

export default function AuditLog() {
  const { data } = useQuery<{ receipts: unknown[]; count: number }>({
    queryKey: ["/api/receipts"],
  });

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] text-[var(--kiq-ink)] p-6 max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ScrollText className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-xl font-bold tracking-tight">Audit Log</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Chronological timeline of all decision receipts · immutable fiduciary record
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-600">
              <FileCheck className="w-3 h-3" />
              {data.count} receipt{data.count !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <AuditLogPanel showFilter limit={100} />
      </div>
    </Layout>
  );
}
