import { useState } from "react";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import EmailReportModal from "@/components/EmailReportModal";
import { downloadPDF } from "@/lib/pdfReports";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Building, ChevronRight, BarChart3, Target, Zap, Share2, Phone, Mail, FileText
} from "lucide-react";

const NEON = { green: "#00FF94", gold: "#FFB800", red: "#FF4D6D", blue: "#00D4FF", indigo: "#6366F1", orange: "#FF6B1A" };
function scoreColor(s: number) { return s >= 80 ? NEON.green : s >= 65 ? NEON.gold : s >= 50 ? NEON.orange : NEON.red; }
function scoreLabel(s: number) { return s >= 80 ? "Strong" : s >= 65 ? "Fair" : s >= 50 ? "At Risk" : "Critical"; }

const INDUSTRIES = ["Manufacturing","Financial Services","Healthcare","Education","Retail","Technology","Non-Profit","Construction","Logistics","Government","Hospitality","Professional Services"];
const PLAN_TYPES  = ["Self-Funded (ASO)","Level-Funded","Fully-Insured","Reference-Based Pricing"];
const STATES = ["IN","IL","OH","MI","KY","TN","WI","MN","IA","MO"];

function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const r = size * 0.4; const circ = 2 * Math.PI * r; const c = scoreColor(score);
  const angle = (score / 100) * 180;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size / 2 + 20 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <path d={`M ${size * 0.1} ${size * 0.5} A ${r} ${r} 0 0 1 ${size * 0.9} ${size * 0.5}`} fill="none" stroke="#ffffff0a" strokeWidth={size * 0.07} strokeLinecap="round" />
        <path d={`M ${size * 0.1} ${size * 0.5} A ${r} ${r} 0 0 1 ${size * 0.9} ${size * 0.5}`} fill="none" stroke={c} strokeWidth={size * 0.07} strokeLinecap="round"
          strokeDasharray={`${(score / 100) * Math.PI * r} ${Math.PI * r}`} />
        <text x={size / 2} y={size * 0.46} textAnchor="middle" fill="white" fontSize={size * 0.22} fontWeight="800">{score}</text>
        <text x={size / 2} y={size * 0.58} textAnchor="middle" fill={c} fontSize={size * 0.1} fontWeight="700">{scoreLabel(score)}</text>
      </svg>
    </div>
  );
}

function DimensionBar({ dim }: { dim: any }) {
  const col = scoreColor(dim.score);
  const statusIcon = dim.status === "good" ? <CheckCircle size={13} className="text-green-400" /> : dim.status === "fair" ? <AlertTriangle size={13} className="text-amber-400" /> : <AlertTriangle size={13} className="text-red-400" />;
  return (
    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] transition-colors" data-testid={`dim-${dim.name.toLowerCase().replace(/\s+/g,"-")}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="text-white/80 text-sm font-medium">{dim.name}</span>
          <span className="text-xs text-white/30">({dim.weight}%)</span>
        </div>
        <span className="font-bold text-sm" style={{ color: col }}>{dim.score} / 100</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/[0.06] mb-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${dim.score}%`, background: col }} />
      </div>
      <p className="text-xs text-white/40 leading-relaxed">{dim.insight}</p>
      <p className="text-xs text-white/25 mt-1">Benchmark: {dim.benchmark}/100</p>
    </div>
  );
}

/* ─── SCORE RESULTS ─────────────────────────────────────────────────────────── */
function ScoreResults({ data, onReset }: { data: any; onReset: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-bold">{data.company_name}</h2>
          <p className="text-white/40 text-xs">{data.industry} · {data.employee_count} employees · {data.state}</p>
        </div>
        <button onClick={onReset} data-testid="score-reset" className="text-xs text-white/40 border border-white/15 rounded-lg px-3 py-1.5 hover:border-white/25 transition-colors">
          Score Another
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6 flex flex-col items-center gap-2">
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Overall Health Score</p>
          <ScoreGauge score={data.overall_score} size={160} />
          <div className="text-center mt-2">
            <p className="text-xs text-white/30">Annual spend est.</p>
            <p className="text-lg font-bold text-white">${(data.annual_spend_estimate/1000000).toFixed(1)}M</p>
          </div>
          <div className="w-full p-3 rounded-xl mt-1" style={{ background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.15)" }}>
            <p className="text-xs text-white/50 text-center">Savings Opportunity</p>
            <p className="text-xl font-bold text-center" style={{ color: NEON.green }}>${data.savings_opportunity.toLocaleString()}</p>
            <p className="text-xs text-white/30 text-center">annually with expert intervention</p>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-3">
          {data.dimensions.map((dim: any) => <DimensionBar key={dim.name} dim={dim} />)}
        </div>
      </div>

      {data.top_risks.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-red-400" />Top Risk Flags</h3>
          <div className="space-y-2">
            {data.top_risks.map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.04]" data-testid={`risk-${i}`}>
                <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-white/70">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(99,102,241,0.06))", border: "1px solid rgba(99,102,241,0.25)" }}>
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2"><Phone size={14} style={{ color: NEON.indigo }} />Next Steps with Kincaid RMC</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {data.next_steps.map((s: string, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: NEON.indigo + "25", color: NEON.indigo, border: `1px solid ${NEON.indigo}35` }}>{i+1}</div>
              <p className="text-sm text-white/70">{s}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button data-testid="schedule-meeting" className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:opacity-90" style={{ background: `linear-gradient(135deg,${NEON.indigo},#4f46e5)` }}>
            Schedule Benefits Diagnostic →
          </button>
          <button data-testid="share-score" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border border-white/15 text-white/60 hover:border-white/25 transition-all">
            <Share2 size={13} /> Share Report
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SCORE FORM ────────────────────────────────────────────────────────────── */
function ScoreForm({ onScore }: { onScore: (data: any) => void }) {
  const { toast } = useToast();
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);
  const [form, setForm] = useState({
    company_name: "", industry: "Manufacturing", employee_count: "", state: "IN", plan_type: "Self-Funded (ASO)",
    pmpm: "", generic_dispense_rate: "", in_network_rate: "",
    has_stop_loss: "", last_pbm_review: "", has_fiduciary_committee: "", last_plan_audit: "", caa_attestation_filed: "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const scoreMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/employer-health-score/score", body).then(r => r.json()),
    onSuccess: (data: any) => onScore(data),
    onError: () => toast({ title: "Score failed", description: "Please check your inputs and try again.", variant: "destructive" }),
  });
  const sampleQuery = useQuery<any>({ queryKey: ["/api/employer-health-score/sample"], enabled: false });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name || !form.employee_count) { toast({ title: "Missing required fields", variant: "destructive" }); return; }
    scoreMutation.mutate({
      ...form,
      employee_count: parseInt(form.employee_count) || 100,
      pmpm: form.pmpm ? parseFloat(form.pmpm) : null,
      generic_dispense_rate: form.generic_dispense_rate ? parseFloat(form.generic_dispense_rate) : null,
      in_network_rate: form.in_network_rate ? parseFloat(form.in_network_rate) : null,
      has_stop_loss: form.has_stop_loss === "yes" ? true : form.has_stop_loss === "no" ? false : null,
      has_fiduciary_committee: form.has_fiduciary_committee === "yes" ? true : form.has_fiduciary_committee === "no" ? false : null,
      caa_attestation_filed: form.caa_attestation_filed === "yes" ? true : form.caa_attestation_filed === "no" ? false : null,
    });
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs text-white/45 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
  const inputCls = "w-full bg-white/[0.06] border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500/50 placeholder:text-white/25";
  const selectCls = inputCls;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <FileUploadZone
        uploadedDoc={uploadedDoc ?? undefined}
        onDocumentReady={setUploadedDoc}
        onClear={() => setUploadedDoc(null)}
        label="Upload Census or Claims Data (Optional)"
        hint="Attach an employee census (XLSX/CSV) or claims extract to auto-enrich scoring inputs"
        accept=".csv,.xlsx,.txt,.pdf"
      />
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Building size={14} style={{ color: NEON.indigo }} />Company Information</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Company Name *"><input required placeholder="Acme Manufacturing Co." className={inputCls} value={form.company_name} onChange={e => set("company_name", e.target.value)} data-testid="input-company-name" /></Field>
          <Field label="Industry *"><select className={selectCls} value={form.industry} onChange={e => set("industry", e.target.value)} data-testid="select-industry">{INDUSTRIES.map(i => <option key={i} value={i} style={{ background: "#0a0f1e" }}>{i}</option>)}</select></Field>
          <Field label="Employee Count *"><input required type="number" placeholder="250" className={inputCls} value={form.employee_count} onChange={e => set("employee_count", e.target.value)} data-testid="input-employee-count" /></Field>
          <Field label="State"><select className={selectCls} value={form.state} onChange={e => set("state", e.target.value)} data-testid="select-state">{STATES.map(s => <option key={s} value={s} style={{ background: "#0a0f1e" }}>{s}</option>)}</select></Field>
          <Field label="Plan Type"><select className={selectCls} value={form.plan_type} onChange={e => set("plan_type", e.target.value)} data-testid="select-plan-type">{PLAN_TYPES.map(p => <option key={p} value={p} style={{ background: "#0a0f1e" }}>{p}</option>)}</select></Field>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2"><BarChart3 size={14} style={{ color: NEON.gold }} />Plan Data <span className="text-xs text-white/30 font-normal">(optional — improves accuracy)</span></h3>
        <p className="text-white/30 text-xs mb-4">Leave blank to use Indiana market averages for your employee count and industry.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Monthly PMPM Cost ($)"><input type="number" placeholder="862" className={inputCls} value={form.pmpm} onChange={e => set("pmpm", e.target.value)} data-testid="input-pmpm" /></Field>
          <Field label="Generic Dispense Rate (%)"><input type="number" placeholder="90" className={inputCls} value={form.generic_dispense_rate} onChange={e => set("generic_dispense_rate", e.target.value)} data-testid="input-generic-rate" /></Field>
          <Field label="In-Network Utilization (%)"><input type="number" placeholder="87" className={inputCls} value={form.in_network_rate} onChange={e => set("in_network_rate", e.target.value)} data-testid="input-inn-rate" /></Field>
        </div>
      </div>

      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Zap size={14} className="text-amber-400" />Quick Diagnostic Questions</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { key: "has_stop_loss",          label: "Does the plan have stop-loss coverage?" },
            { key: "has_fiduciary_committee", label: "Is there a fiduciary committee that meets quarterly?" },
            { key: "caa_attestation_filed",   label: "Was the CAA gag clause attestation filed this year?" },
          ].map(q => (
            <Field key={q.key} label={q.label}>
              <select className={selectCls} value={(form as any)[q.key]} onChange={e => set(q.key, e.target.value)} data-testid={`select-${q.key}`}>
                <option value="" style={{ background: "#0a0f1e" }}>— Select —</option>
                <option value="yes" style={{ background: "#0a0f1e" }}>Yes</option>
                <option value="no" style={{ background: "#0a0f1e" }}>No</option>
              </select>
            </Field>
          ))}
          {[
            { key: "last_pbm_review",   label: "Last PBM contract review", opts: ["0-1 year","1-2 years","2-3 years","3+ years","Never"] },
            { key: "last_plan_audit",   label: "Last compliance/plan audit",opts: ["0-1 year","1-2 years","2-3 years","3+ years","Never"] },
          ].map(q => (
            <Field key={q.key} label={q.label}>
              <select className={selectCls} value={(form as any)[q.key]} onChange={e => set(q.key, e.target.value)} data-testid={`select-${q.key}`}>
                <option value="" style={{ background: "#0a0f1e" }}>— Select —</option>
                {q.opts.map(o => <option key={o} value={o} style={{ background: "#0a0f1e" }}>{o}</option>)}
              </select>
            </Field>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={scoreMutation.isPending} data-testid="btn-score"
          className="flex-1 py-3 rounded-xl text-base font-bold text-white transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg,${NEON.indigo},#4f46e5)`, opacity: scoreMutation.isPending ? 0.6 : 1 }}>
          {scoreMutation.isPending ? "Calculating Score…" : "Generate Employer Health Score →"}
        </button>
        <button type="button" data-testid="btn-demo"
          onClick={() => sampleQuery.refetch().then(r => r.data && onScore(r.data))}
          className="px-5 py-3 rounded-xl text-sm border border-white/15 text-white/50 hover:border-white/25 transition-all">
          Load Demo
        </button>
      </div>
    </form>
  );
}

/* ─── ROOT ──────────────────────────────────────────────────────────────────── */
export default function EmployerHealthScore() {
  const [result, setResult] = useState<any>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const emailSummary: Record<string, string> = result ? {
    "Overall Score":      `${result.overall_score}/100 (${result.grade})`,
    "Plan Design":        `${result.categories.plan_design}/100`,
    "Cost Containment":   `${result.categories.cost_containment}/100`,
    "Employee Engagement":`${result.categories.employee_engagement}/100`,
    "Compliance":         `${result.categories.compliance}/100`,
  } : {};
  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#060b18 0%,#080d1e 50%,#060a16 100%)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(6,10,22,0.90)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(16,185,129,0.14)", boxShadow: "0 1px 24px rgba(16,185,129,0.06)", padding: "12px 24px 10px" }}>
          <div className="flex items-center gap-3">
            <Activity size={18} style={{ color: "#10B981" }} />
            <div>
              <h1 className="text-base font-bold text-white">Employer Health Score™</h1>
              <p className="text-white/35 text-xs">Benefits diagnostic scoring · Prospect outreach · Sales intelligence</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {result && (
                <button onClick={() => downloadPDF("employer-health-score", result ?? {})} data-testid="ehs-download-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", color: "#10B981" }}>
                  <FileText size={12} /> Download PDF
                </button>
              )}
              {result && (
                <button onClick={() => setEmailOpen(true)} data-testid="ehs-email-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}>
                  <Mail size={12} /> Email Report
                </button>
              )}
              {result && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <span className="text-xs text-white/50">Score:</span>
                  <span className="font-bold text-lg" style={{ color: scoreColor(result.overall_score) }}>{result.overall_score}</span>
                  <span className="text-xs font-bold" style={{ color: scoreColor(result.overall_score) }}>{result.grade}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-8 max-w-5xl">
          {result ? <ScoreResults data={result} onReset={() => setResult(null)} /> : <ScoreForm onScore={setResult} />}
        </div>
      </div>
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="employer-health-score"
        summaryData={emailSummary}
        reportData={result}
      />
    </Layout>
  );
}
