import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, FileCheck } from "lucide-react";
import { useReceiptOpen } from "./useReceiptOpen";
import { ReceiptPanel } from "./ReceiptPanel";

export interface ReceiptDrawerProps {
  className?: string;
}

export function ReceiptDrawer({ className }: ReceiptDrawerProps) {
  const { openReceiptId, closeReceipt } = useReceiptOpen();
  const isOpen = openReceiptId !== null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeReceipt();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeReceipt]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={closeReceipt}
          data-testid="receipt-drawer-backdrop"
        />
      )}

      {/* Slide-over panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] flex flex-col",
          "bg-white border-l border-slate-200 shadow-2xl",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className,
        )}
        data-testid="receipt-drawer-panel"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 shrink-0">
          <FileCheck className="w-4 h-4 text-[#00A8FF]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900">Claim Receipt</p>
            {openReceiptId && (
              <p className="text-[10px] font-mono text-zinc-500 truncate">{openReceiptId}</p>
            )}
          </div>
          <button
            onClick={closeReceipt}
            data-testid="button-close-receipt-drawer"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-zinc-500 hover:text-slate-700 hover:border-zinc-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {openReceiptId ? (
            <ReceiptPanel claimId={openReceiptId} />
          ) : null}
        </div>
      </div>
    </>
  );
}
