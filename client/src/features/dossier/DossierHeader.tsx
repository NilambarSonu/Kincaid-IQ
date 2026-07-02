import { cn } from "@/lib/utils";
import { FolderOpen, Clock, Zap, ShieldCheck, ShieldX } from "lucide-react";

interface DossierHeaderProps {
  subject: string;
  subjectType: string;
  boardGrade: boolean;
  claimsCount: number;
  riskFlagsCount: number;
  generatedAt: string;
  className?: string;
}

export function DossierHeader({
  subject, subjectType, boardGrade, claimsCount, riskFlagsCount, generatedAt, className,
}: DossierHeaderProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4",
        boardGrade ? "border-[#A855F7]/30 bg-[#A855F7]/5" : "border-zinc-800 bg-zinc-900/60",
      )}
      data-testid="dossier-header"
    >
      <div className="flex items-start gap-3 justify-between flex-wrap">
        <div className="flex items-start gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0",
            boardGrade ? "border-[#A855F7]/30 bg-[#A855F7]/10" : "border-zinc-700 bg-zinc-800",
          )}>
            <FolderOpen className={cn("w-4 h-4", boardGrade ? "text-[#A855F7]" : "text-zinc-400")} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h2 className="text-sm font-bold text-zinc-100">{subject}</h2>
              <span className={cn(
                "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase",
                boardGrade
                  ? "text-[#A855F7] border-[#A855F7]/30 bg-[#A855F7]/10"
                  : "text-zinc-500 border-zinc-700 bg-zinc-800",
              )}>
                {subjectType}
              </span>
              {boardGrade ? (
                <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-[#FFB800] border border-[#FFB800]/30 bg-[#FFB800]/10 rounded px-1.5 py-0.5">
                  <Zap className="w-2.5 h-2.5" />BOARD GRADE
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 border border-zinc-800 rounded px-1.5 py-0.5">
                  <ShieldX className="w-2.5 h-2.5" />NOT BOARD GRADE
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-zinc-600">
              {claimsCount} governed claim{claimsCount !== 1 ? "s" : ""}
              {riskFlagsCount > 0 && (
                <span className="text-[#FFB800]"> · {riskFlagsCount} risk flag{riskFlagsCount !== 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-600">
          <Clock className="w-2.5 h-2.5" />
          Generated: {new Date(generatedAt).toLocaleString(undefined, { hour12: false })}
        </div>
      </div>
    </div>
  );
}
