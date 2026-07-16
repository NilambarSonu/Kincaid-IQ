import { cn } from "@/lib/utils";
import { Shield, Database, FileText, Wifi, HardDrive, FlaskConical } from "lucide-react";

type ArtifactType = "claims_db" | "survey" | "contract" | "api_feed" | "manual" | "computed" | "pbm_feed" | "hris" | "nlp_scan";

interface EvidencePillProps {
  artifact: string;
  hash?: string;
  artifactType?: ArtifactType;
  verified?: boolean;
  className?: string;
}

const ICON_MAP: Record<ArtifactType, React.ComponentType<{ className?: string }>> = {
  claims_db: Database,
  survey:    FlaskConical,
  contract:  FileText,
  api_feed:  Wifi,
  manual:    HardDrive,
  computed:  Shield,
  pbm_feed:  Wifi,
  hris:      Database,
  nlp_scan:  FlaskConical,
};

function inferType(name: string): ArtifactType {
  const n = name.toLowerCase();
  if (n.includes("claim")) return "claims_db";
  if (n.includes("survey") || n.includes("nps")) return "survey";
  if (n.includes("contract")) return "contract";
  if (n.includes("feed") || n.includes("api")) return "api_feed";
  if (n.includes("pbm")) return "pbm_feed";
  if (n.includes("hris")) return "hris";
  if (n.includes("nlp")) return "nlp_scan";
  return "computed";
}

export function EvidencePill({ artifact, hash, artifactType, verified = false, className }: EvidencePillProps) {
  const type = artifactType || inferType(artifact);
  const Icon = ICON_MAP[type] || Shield;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono shadow-sm backdrop-blur-sm",
        verified
          ? "text-[#00FF94] border-[#00FF94]/30 bg-[#00FF94]/5"
          : "text-slate-500 border-slate-200/80 bg-white/60",
        className,
      )}
      data-testid="evidence-pill"
      title={hash ? `Hash: ${hash}` : undefined}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate max-w-[140px]">{artifact}</span>
      {hash && (
        <span className="opacity-40 font-mono text-[8px] tracking-wider">{hash.slice(0, 8)}</span>
      )}
    </span>
  );
}
