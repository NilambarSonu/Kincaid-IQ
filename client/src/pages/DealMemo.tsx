import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Handshake, BrainCircuit, Loader2, Copy, Check, X } from "lucide-react";

const SECTORS = ["Technology", "Healthcare / Life Sciences", "Financial Services", "Consumer", "Energy / CleanTech", "Real Estate", "Infrastructure", "Media & Entertainment", "Industrial / Manufacturing", "Crypto / Web3", "Other"];
const STAGES = ["Seed / Pre-Seed", "Series A", "Series B", "Series C+", "Growth Equity", "LBO / Buyout", "Real Assets", "Private Credit", "Infrastructure", "Fund Investment", "Secondary"];

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="text-sm leading-relaxed space-y-1.5">
      {text.split("\n").map((line, i) => {
        if (line.match(/^#{1,3}\s/)) return <p key={i} className="font-bold text-[var(--kiq-ink)] mt-4 mb-1" style={{ color: "#FFB800", fontFamily: "var(--font-display)" }}>{line.replace(/^#{1,3}\s/, "")}</p>;
        if (line.match(/^\*\*.*\*\*:?$/)) return <p key={i} className="font-semibold text-[var(--kiq-ink)] mt-3 mb-0.5">{line.replace(/\*\*/g, "")}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 flex gap-2 text-muted-foreground"><span style={{ color: "rgba(255,184,0,0.5)" }}>·</span><span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[var(--kiq-ink)]">$1</strong>') }} /></p>;
        if (line.trim() === "---") return <div key={i} className="my-3 h-px" style={{ background: "#f1f5f9" }} />;
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-[var(--kiq-ink)]">$1</strong>') }} />;
      })}
    </div>
  );
}

export default function DealMemo() {
  const [form, setForm] = useState({ name: "", sector: "Technology", stage: "Series B", check_size: "", co_investors: "", valuation: "", notes: "" });
  const [memo, setMemo] = useState<{ text: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!form.name || !form.check_size) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deal-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate memo");
      setMemo({ text: data.memo, name: data.name });
    } catch (e: any) {
      setError(e.message || "Failed to generate memo");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (memo) { navigator.clipboard.writeText(memo.text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">AI Intelligence</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Deal Memo Generator
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Claude Opus writes a complete investment memo — thesis, market, risks, return expectations, and recommendation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="metric-card" style={{ border: "1px solid rgba(255,184,0,0.12)" }} data-testid="card-deal-form">
            <div className="flex items-center gap-2 mb-4">
              <Handshake size={14} style={{ color: "#FFB800" }} />
              <p className="font-bold text-sm text-[var(--kiq-ink)]">Deal Details</p>
            </div>
            <div className="space-y-3">
              {[
                { key: "name", label: "Company / Fund Name *", placeholder: "e.g., NeuroLink AI Inc.", type: "input" },
                { key: "check_size", label: "Proposed Check Size *", placeholder: "e.g., $25M", type: "input" },
                { key: "valuation", label: "Valuation / Entry Price", placeholder: "e.g., $400M post-money", type: "input" },
                { key: "co_investors", label: "Co-Investors", placeholder: "e.g., Sequoia, a16z", type: "input" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={(form as any)[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0F172A" }}
                    data-testid={`input-deal-${f.key}`}
                  />
                </div>
              ))}
              {[
                { key: "sector", label: "Sector", options: SECTORS },
                { key: "stage", label: "Stage / Deal Type", options: STAGES },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <select
                    value={(form as any)[f.key]}
                    onChange={(e) => update(f.key, e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0F172A" }}
                    data-testid={`select-deal-${f.key}`}
                  >
                    {f.options.map((o) => <option key={o} value={o} style={{ background: "#F8FAFC" }}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Additional Context</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Team background, key metrics, competitive dynamics, strategic rationale…"
                  rows={4}
                  className="w-full text-sm px-3 py-2 rounded-lg resize-none"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0F172A" }}
                  data-testid="input-deal-notes"
                />
              </div>
            </div>

            {error && <p className="text-xs mt-3" style={{ color: "#FF4D6D" }}>{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={!form.name || !form.check_size || loading}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{
                background: form.name && form.check_size ? "rgba(255,184,0,0.1)" : "rgba(255,184,0,0.03)",
                border: "1px solid rgba(255,184,0,0.25)",
                color: form.name && form.check_size ? "#FFB800" : "rgba(255,184,0,0.3)",
                cursor: form.name && form.check_size && !loading ? "pointer" : "not-allowed",
              }}
              data-testid="button-generate-memo"
            >
              {loading ? <><Loader2 size={13} className="animate-spin" /> Generating with Claude…</> : <><BrainCircuit size={13} /> Generate Investment Memo</>}
            </button>
          </div>
        </div>

        <div className="lg:col-span-3">
          {!memo && !loading && (
            <div className="metric-card flex flex-col items-center justify-center py-20"
              style={{ border: "1px dashed rgba(255,184,0,0.12)", height: "100%" }} data-testid="empty-memo">
              <Handshake size={32} style={{ color: "rgba(255,184,0,0.2)", marginBottom: 12 }} />
              <p className="text-sm text-muted-foreground">Fill out the deal details and generate a full investment memo</p>
              <p className="text-xs text-muted-foreground mt-1">Claude Opus — fiduciary-grade analysis</p>
            </div>
          )}
          {loading && (
            <div className="metric-card flex flex-col items-center justify-center py-20" data-testid="loading-memo">
              <Loader2 size={32} className="animate-spin mb-4" style={{ color: "#FFB800" }} />
              <p className="font-bold text-[var(--kiq-ink)] mb-1">Claude is writing your investment memo…</p>
              <p className="text-xs text-muted-foreground">Synthesizing market analysis, risk assessment, and portfolio fit</p>
            </div>
          )}
          {memo && (
            <div className="metric-card" style={{ border: "1px solid rgba(255,184,0,0.15)" }} data-testid="card-memo-result">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.2)" }}>
                    <Handshake size={13} style={{ color: "#FFB800" }} />
                  </div>
                  <div>
                    <p className="font-bold text-[var(--kiq-ink)] text-sm">{memo.name}</p>
                    <p className="text-[10px] text-muted-foreground">Claude Opus · Investment Memo</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                    style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: copied ? "#00FF94" : "rgba(150,170,210,0.6)" }}
                    data-testid="button-copy-memo">
                    {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                  </button>
                  <button onClick={() => setMemo(null)}
                    className="p-1.5 rounded-lg hover:opacity-70"
                    style={{ color: "rgba(150,170,210,0.4)" }}
                    data-testid="button-clear-memo">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <div className="pt-4 max-h-[600px] overflow-y-auto custom-scrollbar" style={{ borderTop: "1px solid #f1f5f9" }}>
                <MarkdownText text={memo.text} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
