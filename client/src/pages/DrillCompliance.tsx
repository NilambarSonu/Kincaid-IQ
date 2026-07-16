import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import {
  Shield, ArrowLeft, CheckCircle2, AlertTriangle,
  XCircle, Clock, FileText, ExternalLink,
} from "lucide-react";

const COMPLIANCE_ITEMS = [
  { id: "ERISA-404", title: "ERISA §404 Fiduciary Duty",          status: "pass",    category: "Fiduciary",    due: "Ongoing",    detail: "Investment menu review completed Q4 2024." },
  { id: "ERISA-408b2", title: "ERISA §408(b)(2) Fee Disclosure",  status: "pass",    category: "Disclosure",   due: "Annual",     detail: "Broker compensation disclosed per regulatory requirement." },
  { id: "ACA-6055", title: "ACA §6055 Reporting",                  status: "pass",    category: "ACA",          due: "2025-01-31", detail: "1095-B/1094-B filed on time." },
  { id: "ACA-6056", title: "ACA §6056 Employer Mandate",           status: "pass",    category: "ACA",          due: "2025-01-31", detail: "Full-time equivalency threshold met and reported." },
  { id: "HIPAA-PL", title: "HIPAA Privacy & Security",             status: "pass",    category: "Privacy",      due: "Ongoing",    detail: "BAA in place with all covered vendors." },
  { id: "CAA-2021", title: "CAA 2021 Transparency Requirements",   status: "warn",    category: "Transparency", due: "2025-06-30", detail: "Machine-readable file update pending vendor coordination." },
  { id: "CAA-RxData", title: "CAA Rx Data Reporting",              status: "warn",    category: "Transparency", due: "2025-12-01", detail: "Interim reporting submitted; final due Dec 2025." },
  { id: "COBRA-GM", title: "COBRA General Notice",                 status: "pass",    category: "COBRA",        due: "Ongoing",    detail: "All qualifying events triggered timely notices." },
  { id: "DOL-5500", title: "Form 5500 Annual Filing",              status: "pass",    category: "Reporting",    due: "2025-07-31", detail: "Extension filed; final due July 31, 2025." },
  { id: "PCORI", title: "PCORI Fee Obligation",                    status: "pass",    category: "ACA",          due: "2025-07-31", detail: "Fee calculated and paid per IRS Form 720." },
  { id: "MHPAEA", title: "MHPAEA Parity Compliance",               status: "fail",    category: "Mental Health", due: "Immediate", detail: "Quantitative treatment limitation analysis incomplete — REQUIRES ACTION." },
  { id: "CAA-NQTLs", title: "CAA 2023 NQTLs Comparative Analysis", status: "fail",   category: "Mental Health", due: "Immediate",  detail: "Comparative analysis not yet documented. File before next audit." },
];

const ICON_MAP = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle };
const COLOR_MAP = { pass: "#00FF94", warn: "#FFB800", fail: "#FF4D6D" };

export default function DrillCompliance() {
  const [, navigate] = useLocation();
  const counts = { pass: 0, warn: 0, fail: 0 };
  COMPLIANCE_ITEMS.forEach(i => { counts[i.status as keyof typeof counts]++; });

  return (
    <Layout>
      <div className="min-h-screen bg-[var(--kiq-surface)] p-6 space-y-6">

        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/governance-war-room")}
            data-testid="btn-back-compliance"
            className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 hover:text-[var(--kiq-muted)] border border-[var(--kiq-hairline)]/40 rounded-lg px-2.5 py-1.5 flex-shrink-0 mt-1">
            <ArrowLeft className="w-3 h-3" />
            War Room
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#A855F7]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#A855F7]">Drill Surface · Compliance</span>
            </div>
            <h1 className="text-2xl font-black text-[var(--kiq-ink)]">Compliance Matrix</h1>
            <p className="text-xs text-zinc-500 mt-1">ERISA · ACA · HIPAA · CAA · COBRA · PCORI · MHPAEA</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Compliant",    value: counts.pass, color: "#00FF94" },
            { label: "Action Items", value: counts.warn, color: "#FFB800" },
            { label: "Critical",     value: counts.fail, color: "#FF4D6D" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-xl p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1">{label}</p>
              <p className="text-3xl font-black font-mono" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Critical items first */}
        {counts.fail > 0 && (
          <div className="bg-[#FF4D6D08] border border-[#FF4D6D30] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-[#FF4D6D]" />
              <span className="text-xs font-bold text-[#FF4D6D] uppercase tracking-widest">Immediate Action Required</span>
            </div>
            {COMPLIANCE_ITEMS.filter(i => i.status === "fail").map(item => (
              <div key={item.id} className="bg-[var(--kiq-canvas-soft)]/60 border border-[#FF4D6D30] rounded-xl p-4 mb-2">
                <div className="flex items-start gap-3">
                  <XCircle className="w-4 h-4 text-[#FF4D6D] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs font-bold text-[var(--kiq-ink)]">{item.title}</p>
                      <span className="text-[9px] font-mono text-zinc-600 bg-[var(--kiq-surface)]/60 rounded px-1.5 py-0.5">{item.id}</span>
                    </div>
                    <p className="text-xs text-[#FF4D6D]">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full matrix */}
        <div className="bg-[var(--kiq-surface)]/80 border border-[var(--kiq-hairline)]/50 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--kiq-hairline)]/40">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Full Compliance Register</span>
          </div>
          <div className="divide-y divide-zinc-900/50">
            {COMPLIANCE_ITEMS.map(item => {
              const Icon = ICON_MAP[item.status as keyof typeof ICON_MAP];
              const color = COLOR_MAP[item.status as keyof typeof COLOR_MAP];
              return (
                <div key={item.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--kiq-canvas-soft)]/20"
                  data-testid={`compliance-${item.id}`}>
                  <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-medium text-[var(--kiq-ink-soft)]">{item.title}</p>
                      <span className="text-[9px] font-mono text-zinc-700 bg-[var(--kiq-canvas-soft)]/60 rounded px-1 py-0.5">{item.id}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">{item.detail}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-[9px] font-mono text-zinc-600 bg-[var(--kiq-canvas-soft)]/50 rounded px-1.5 py-0.5">{item.category}</span>
                    <p className="text-[9px] font-mono text-zinc-600 mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5" />
                      {item.due}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </Layout>
  );
}
