import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Layout } from "@/components/Layout";
import { generateShadyBrokerPDF } from "@/lib/pdfReports";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useLocation } from "wouter";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import {
  Radar, Target, FileSearch, Bell, BellRing, Plus, Trash2, ChevronRight,
  Loader2, CheckCircle2, AlertTriangle, X, Edit3, Save, DollarSign,
  Building2, Users, TrendingUp, BarChart2, Shield, Pill, Search,
  ArrowRight, Sparkles, Copy, Download, Upload, Eye, Clock, Zap, Brain,
  FileText, Star, AlertOctagon, ChevronDown, ChevronUp, RefreshCw,
  MapPin, ExternalLink, Swords,
} from "lucide-react";
import { InlineBattleCard } from "@/pages/BattleCards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { LayoutGrid, List as ListIcon } from "lucide-react";

// ── Palette ──────────────────────────────────────────────────────────────────
const GOLD   = "#FFB800";
const BLUE   = "#00D4FF";
const GREEN  = "#00FF94";
const RED    = "#FF4D6D";
const PURPLE = "#A855F7";
const ORANGE = "#FF6B1A";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Opportunity {
  id: number;
  employer_name: string;
  employer_ein: string | null;
  employer_state: string | null;
  employer_city: string | null;
  industry: string | null;
  participants: number | null;
  stage: string;
  estimated_value: number | null;
  close_date: string | null;
  owner: string | null;
  priority: string;
  rx_contract_id: string | null;
  notes: string | null;
  ai_talking_points: TalkingPoint[];
  ai_response_draft: string;
  known_competitor: string | null;
  created_at: string;
  updated_at: string;
}

interface TalkingPoint {
  headline: string;
  evidence: string;
  angle: string;
}

interface WatchEntry {
  id: number;
  ein: string;
  employer_name: string;
  employer_state: string | null;
  industry: string | null;
  last_seen_year: number | null;
  last_checked_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Alert {
  id: number;
  watch_id: number;
  ein: string;
  employer_name: string;
  filing_year: number;
  alert_type: string;
  status: string;
  highlights: Record<string, any>;
  created_at: string;
}

interface CheckNowResult {
  checked_at: string;
  count: number;
  up_to_date: boolean;
  new_filings: {
    ein: string;
    employer_name: string;
    filing_year: number;
    highlights: Record<string, any>;
  }[];
}

interface TalkingPointBundle {
  headline: string;
  evidence: string;
  angle: string;
}

interface IntelBundle {
  ein: string;
  available: boolean;
  benchmarking: {
    sponsor_name?: string;
    city?: string;
    state?: string;
    business_code?: string;
    industry?: string;
    participants?: number;
    total_income?: number;
    admin_fees?: number;
    broker_commissions?: number;
    welfare_premiums?: number;
    carrier?: string;
    latest_year?: number;
    has_health?: boolean;
    has_stop_loss?: boolean;
  };
  shady_broker: {
    broker_pct?: number;
    admin_pct?: number;
    broker_per_member?: number;
    flag?: boolean;
    overall_score?: number;
    rating?: string;
  };
  talking_points: TalkingPointBundle[];
}

interface RxContractSummary {
  id: string;
  pbm_name: string | null;
  contract_filename: string;
  status: string;
  overall_score: number | null;
  key_findings: any[];
  created_at: string;
}

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGES = [
  { key: "prospect",     label: "Prospect",     color: "#6B7280" },
  { key: "qualified",    label: "Qualified",    color: BLUE },
  { key: "proposal",     label: "Proposal",     color: PURPLE },
  { key: "negotiation",  label: "Negotiation",  color: ORANGE },
  { key: "won",          label: "Won",          color: GREEN },
  { key: "lost",         label: "Lost",         color: RED },
];

const PRIORITIES = [
  { key: "low",    label: "Low",    color: "#6B7280" },
  { key: "medium", label: "Medium", color: GOLD },
  { key: "high",   label: "High",   color: RED },
];

function stageCfg(s: string) {
  return STAGES.find(x => x.key === s) || STAGES[0];
}
function priorityCfg(p: string) {
  return PRIORITIES.find(x => x.key === p) || PRIORITIES[1];
}

function fmtMoney(n: number | null | undefined) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

// ── Known-competitor suggestions ───────────────────────────────────────────────
// Sources distinct competitor names already seen across the rep's data so the
// known-competitor inputs can autocomplete and stay consistently spelled (the
// battlecard aggregation groups by ilike match on the competitor name).
const COMPETITOR_DATALIST_ID = "known-competitor-suggestions";

function useCompetitorSuggestions(): string[] {
  const { data: opps = [] } = useQuery<Opportunity[]>({ queryKey: ["/api/rfp/opportunities"] });
  const { data: battlecards } = useQuery<{ competitors: { competitor: string }[] }>({
    queryKey: ["/api/rfp/battlecards"],
  });

  return useMemo(() => {
    const seen = new Map<string, string>(); // lowercase → original casing
    const add = (raw: string | null | undefined) => {
      const name = (raw || "").trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    };
    battlecards?.competitors?.forEach(c => add(c.competitor));
    opps.forEach(o => add(o.known_competitor));
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [opps, battlecards]);
}

function CompetitorDatalist({ options }: { options: string[] }) {
  if (options.length === 0) return null;
  return (
    <datalist id={COMPETITOR_DATALIST_ID} data-testid="datalist-known-competitor">
      {options.map(name => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
}

// ── Tab navigation ─────────────────────────────────────────────────────────────
type Tab = "pipeline" | "analyzer" | "intel" | "watchlist";

const TABS: { key: Tab; label: string; icon: typeof Radar }[] = [
  { key: "pipeline",  label: "Pipeline",      icon: Target },
  { key: "analyzer",  label: "RFP Analyzer",  icon: FileSearch },
  { key: "intel",     label: "Prospect Intel", icon: BarChart2 },
  { key: "watchlist", label: "Watchlist & Alerts", icon: BellRing },
];

// ── New opportunity form ───────────────────────────────────────────────────────
interface OppForm {
  employer_name: string;
  employer_ein: string;
  employer_state: string;
  employer_city: string;
  industry: string;
  participants: string;
  stage: string;
  estimated_value: string;
  close_date: string;
  owner: string;
  priority: string;
  rx_contract_id: string;
  notes: string;
  known_competitor: string;
}

const EMPTY_FORM: OppForm = {
  employer_name: "", employer_ein: "", employer_state: "", employer_city: "",
  industry: "", participants: "", stage: "prospect", estimated_value: "",
  close_date: "", owner: "", priority: "medium", rx_contract_id: "", notes: "",
  known_competitor: "",
};

function OppFormModal({
  onClose,
  onSaved,
  prefill,
}: {
  onClose: () => void;
  onSaved: () => void;
  prefill?: Partial<OppForm>;
}) {
  const [form, setForm] = useState<OppForm>({ ...EMPTY_FORM, ...prefill });
  const { toast } = useToast();
  const qc = useQueryClient();
  const competitorSuggestions = useCompetitorSuggestions();

  const mut = useMutation({
    mutationFn: async (data: OppForm) => {
      const res = await apiRequest("POST", "/api/rfp/opportunities", {
        ...data,
        participants: data.participants ? parseInt(data.participants) : null,
        estimated_value: data.estimated_value ? parseFloat(data.estimated_value) : null,
        rx_contract_id: data.rx_contract_id?.trim() || null,
        known_competitor: data.known_competitor?.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      toast({ title: "Opportunity created" });
      onSaved();
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-2xl rounded-2xl overflow-auto max-h-[90vh]"
        style={{ background: "#0a0c1e", border: `1px solid ${GOLD}30` }}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div>
            <h2 className="text-white font-bold text-lg">New Opportunity</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Track an RFP or prospect account through your pipeline</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Employer Name *</label>
              <Input data-testid="input-employer-name"
                value={form.employer_name} onChange={e => setForm(f => ({ ...f, employer_name: e.target.value }))}
                placeholder="Acme Manufacturing Co." className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">EIN</label>
              <Input data-testid="input-employer-ein"
                value={form.employer_ein} onChange={e => setForm(f => ({ ...f, employer_ein: e.target.value }))}
                placeholder="XX-XXXXXXX" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Industry</label>
              <Input data-testid="input-industry"
                value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="Manufacturing" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">State</label>
              <Input data-testid="input-state"
                value={form.employer_state} onChange={e => setForm(f => ({ ...f, employer_state: e.target.value }))}
                placeholder="IN" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">City</label>
              <Input data-testid="input-city"
                value={form.employer_city} onChange={e => setForm(f => ({ ...f, employer_city: e.target.value }))}
                placeholder="Indianapolis" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Participants</label>
              <Input data-testid="input-participants" type="number"
                value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
                placeholder="350" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Est. Annual Value ($)</label>
              <Input data-testid="input-value" type="number"
                value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))}
                placeholder="45000" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Stage</label>
              <select data-testid="select-stage"
                value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm">
                {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Priority</label>
              <select data-testid="select-priority"
                value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm">
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Close Date</label>
              <Input data-testid="input-close-date" type="date"
                value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Owner</label>
              <Input data-testid="input-owner"
                value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                placeholder="Jane Smith" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">
                Known Competitor
                <span className="text-zinc-600 ml-1 normal-case font-normal">(optional — surfaces their battlecard inline)</span>
              </label>
              <Input data-testid="input-form-known-competitor"
                list={COMPETITOR_DATALIST_ID}
                value={form.known_competitor} onChange={e => setForm(f => ({ ...f, known_competitor: e.target.value }))}
                placeholder="e.g. CVS Caremark, Express Scripts…"
                className="bg-zinc-900 border-zinc-700 text-white" />
              <CompetitorDatalist options={competitorSuggestions} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">
                Rx Defense Contract ID
                <span className="text-zinc-600 ml-1 normal-case font-normal">(optional — links Rx analysis to this opportunity)</span>
              </label>
              <Input data-testid="input-rx-contract-id"
                value={form.rx_contract_id} onChange={e => setForm(f => ({ ...f, rx_contract_id: e.target.value }))}
                placeholder="Paste contract ID from Rx Defense IQ™"
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Notes</label>
              <Textarea data-testid="input-notes"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Context, referral source, key contacts..." rows={3}
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button data-testid="btn-save-opp" disabled={!form.employer_name || mut.isPending}
              onClick={() => mut.mutate(form)}
              style={{ background: GOLD, color: "#0a0c1e" }} className="flex-1 font-bold gap-2">
              {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add to Pipeline
            </Button>
            <Button variant="outline" onClick={onClose} className="border-zinc-700 text-zinc-300">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Opportunity card ──────────────────────────────────────────────────────────
function OppCard({ opp, onSelect, onDelete }: { opp: Opportunity; onSelect: () => void; onDelete: () => void }) {
  const stage = stageCfg(opp.stage);
  const priority = priorityCfg(opp.priority);

  return (
    <div data-testid={`opp-card-${opp.id}`}
      onClick={onSelect}
      className="rounded-xl p-4 cursor-pointer transition-all"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${GOLD}30`; e.currentTarget.style.background = `${GOLD}05`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">{opp.employer_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {opp.employer_state && <span className="text-xs text-zinc-500 flex items-center gap-0.5"><MapPin className="w-3 h-3" />{opp.employer_state}</span>}
            {opp.industry && <span className="text-xs text-zinc-600">{opp.industry}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {opp.known_competitor && (
            <span data-testid={`badge-competitor-${opp.id}`}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 max-w-[140px]"
              style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.25)" }}>
              <Swords className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">vs {opp.known_competitor}</span>
            </span>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${priority.color}18`, color: priority.color, border: `1px solid ${priority.color}30` }}>
            {priority.label}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}30` }}>
            {stage.label}
          </span>
          <button data-testid={`btn-delete-opp-${opp.id}`}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="text-zinc-600 hover:text-red-400 p-0.5 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {opp.participants && (
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Users className="w-3 h-3" />{opp.participants.toLocaleString()}
            </span>
          )}
          {opp.estimated_value && (
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: GREEN }}>
              <DollarSign className="w-3 h-3" />{fmtMoney(opp.estimated_value)}
            </span>
          )}
        </div>
        {opp.ai_talking_points?.length > 0 && (
          <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: PURPLE }}>
            <Sparkles className="w-3 h-3" />{opp.ai_talking_points.length} pts
          </span>
        )}
      </div>
    </div>
  );
}

// ── Compact board card (kanban) ───────────────────────────────────────────────
function BoardCard({ opp, onSelect, dragging }: { opp: Opportunity; onSelect: () => void; dragging: boolean }) {
  const priority = priorityCfg(opp.priority);
  return (
    <div data-testid={`board-card-${opp.id}`}
      onClick={onSelect}
      className="rounded-lg p-3 cursor-pointer transition-colors"
      style={{
        background: dragging ? `${GOLD}10` : "rgba(255,255,255,0.03)",
        border: `1px solid ${dragging ? `${GOLD}40` : "rgba(255,255,255,0.08)"}`,
        boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.45)" : "none",
      }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-white font-bold text-[13px] leading-snug min-w-0 truncate">{opp.employer_name}</p>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: `${priority.color}18`, color: priority.color, border: `1px solid ${priority.color}30` }}>
          {priority.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-2">
        {opp.employer_state && <span className="text-[10px] text-zinc-500 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{opp.employer_state}</span>}
        {opp.industry && <span className="text-[10px] text-zinc-600 truncate">{opp.industry}</span>}
      </div>
      <div className="flex items-center justify-between">
        {opp.participants ? (
          <span className="text-[10px] text-zinc-500 flex items-center gap-1"><Users className="w-2.5 h-2.5" />{opp.participants.toLocaleString()}</span>
        ) : <span />}
        {opp.estimated_value ? (
          <span className="text-[10px] font-bold flex items-center gap-0.5" style={{ color: GREEN }}>
            <DollarSign className="w-2.5 h-2.5" />{fmtMoney(opp.estimated_value)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Kanban board view ─────────────────────────────────────────────────────────
function BoardView({ opps, onSelect, onDragEnd }: {
  opps: Opportunity[];
  onSelect: (o: Opportunity) => void;
  onDragEnd: (result: DropResult) => void;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2" data-testid="kanban-board">
        {STAGES.map(stage => {
          const colOpps = opps.filter(o => o.stage === stage.key);
          const colValue = colOpps.reduce((s, o) => s + (o.estimated_value || 0), 0);
          return (
            <Droppable droppableId={stage.key} key={stage.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  data-testid={`kanban-column-${stage.key}`}
                  className="flex-shrink-0 w-64 rounded-xl flex flex-col"
                  style={{
                    background: snapshot.isDraggingOver ? `${stage.color}0D` : "rgba(255,255,255,0.015)",
                    border: `1px solid ${snapshot.isDraggingOver ? `${stage.color}40` : "rgba(255,255,255,0.06)"}`,
                    transition: "background 0.15s, border-color 0.15s",
                  }}>
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                      <span className="text-xs font-bold" style={{ color: stage.color }}>{stage.label}</span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                      {colOpps.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[60vh]">
                    {colOpps.map((opp, idx) => (
                      <Draggable draggableId={String(opp.id)} index={idx} key={opp.id}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}>
                            <BoardCard opp={opp} dragging={dragSnapshot.isDragging} onSelect={() => onSelect(opp)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colOpps.length === 0 && !snapshot.isDraggingOver && (
                      <div className="text-center py-6 text-[10px] text-zinc-700">Drop deals here</div>
                    )}
                  </div>
                  {/* Footer total */}
                  <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-[10px] text-zinc-600 font-medium">{colOpps.length} deal{colOpps.length === 1 ? "" : "s"}</span>
                    <span className="text-[11px] font-bold" style={{ color: GREEN }} data-testid={`kanban-total-${stage.key}`}>{fmtMoney(colValue)}</span>
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}

// ── Opportunity detail panel ──────────────────────────────────────────────────
function OppDetail({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { sendTo } = useCompanyHandoff();
  const [editStage, setEditStage] = useState(opp.stage);
  const [editNotes, setEditNotes] = useState(opp.notes || "");
  const [editCompetitor, setEditCompetitor] = useState(opp.known_competitor || "");
  const competitorSuggestions = useCompetitorSuggestions();
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);

  const patchMut = useMutation({
    mutationFn: async (data: object) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${opp.id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] }); toast({ title: "Saved" }); },
  });

  const tpMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rfp/opportunities/${opp.id}/talking-points`, {});
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] }); toast({ title: "Talking points generated" }); },
    onError: () => toast({ title: "AI generation failed", variant: "destructive" }),
  });

  const draftMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rfp/opportunities/${opp.id}/draft-response`, {});
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] }); setShowDraft(true); toast({ title: "Response drafted" }); },
    onError: () => toast({ title: "Draft generation failed", variant: "destructive" }),
  });

  const stage = stageCfg(opp.stage);
  const priority = priorityCfg(opp.priority);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-xl max-h-[90vh] overflow-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: "#07091c", border: `1px solid ${GOLD}25` }}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <div className="flex-1">
            <h3 className="text-white font-bold text-base">{opp.employer_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {opp.employer_ein && <span className="text-xs text-zinc-600">EIN: {opp.employer_ein}</span>}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${stage.color}18`, color: stage.color, border: `1px solid ${stage.color}25` }}>
                {stage.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${priority.color}18`, color: priority.color, border: `1px solid ${priority.color}25` }}>
                {priority.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white ml-3"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Est. Value", val: fmtMoney(opp.estimated_value), color: GREEN, icon: DollarSign },
              { label: "Participants", val: opp.participants?.toLocaleString() || "—", color: BLUE, icon: Users },
              { label: "Close Date", val: opp.close_date || "—", color: GOLD, icon: Clock },
            ].map(item => (
              <div key={item.label} className="rounded-xl p-3 text-center"
                style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}>
                <item.icon className="w-4 h-4 mx-auto mb-1" style={{ color: item.color }} />
                <p className="text-xs font-bold" style={{ color: item.color }}>{item.val}</p>
                <p className="text-[10px] text-zinc-600">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Inline battlecard — surfaces competitor intelligence mid-pursuit */}
          <InlineBattleCard opportunityId={String(opp.id)} />

          {/* Stage selector */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Pipeline Stage</p>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map(s => (
                <button key={s.key} data-testid={`btn-stage-${s.key}`}
                  onClick={() => {
                    setEditStage(s.key);
                    patchMut.mutate({ stage: s.key });
                  }}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full transition-all"
                  style={{
                    background: editStage === s.key ? `${s.color}25` : "rgba(255,255,255,0.04)",
                    color: editStage === s.key ? s.color : "rgba(255,255,255,0.4)",
                    border: editStage === s.key ? `1px solid ${s.color}40` : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Talking points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">AI Talking Points</p>
              <div className="flex gap-2">
                {opp.employer_ein && (
                  <button data-testid="btn-view-intel"
                    onClick={() => { onClose(); navigate(`/rfp-intelligence`); }}
                    className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                    style={{ color: BLUE }}>
                    <ExternalLink className="w-3 h-3" /> Intel
                  </button>
                )}
                <button data-testid="btn-gen-talking-points"
                  disabled={tpMut.isPending}
                  onClick={() => tpMut.mutate()}
                  className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                  style={{ color: PURPLE }}>
                  {tpMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {opp.ai_talking_points?.length > 0 ? "Regenerate" : "Generate"}
                </button>
              </div>
            </div>
            {opp.ai_talking_points?.length > 0 ? (
              <div className="space-y-2">
                {opp.ai_talking_points.map((tp, i) => (
                  <div key={i} data-testid={`talking-point-${i}`}
                    className="rounded-lg p-3 space-y-1"
                    style={{ background: `${PURPLE}08`, border: `1px solid ${PURPLE}20` }}>
                    <p className="text-xs font-bold text-white">{tp.headline}</p>
                    <p className="text-[11px] font-semibold" style={{ color: BLUE }}>{tp.evidence}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{tp.angle}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg p-4 text-center" style={{ background: "rgba(168,85,247,0.05)", border: "1px dashed rgba(168,85,247,0.2)" }}>
                <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: PURPLE }} />
                <p className="text-xs text-zinc-500">Click Generate to create AI talking points from DOL data</p>
              </div>
            )}
          </div>

          {/* Draft response */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Competitive Response Draft</p>
              <button data-testid="btn-gen-draft"
                disabled={draftMut.isPending}
                onClick={() => draftMut.mutate()}
                className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                style={{ color: GOLD }}>
                {draftMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                {opp.ai_response_draft ? "Regenerate" : "Draft"}
              </button>
            </div>
            {opp.ai_response_draft ? (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}20` }}>
                <div className="flex items-center justify-between px-3 py-2"
                  style={{ background: `${GOLD}08`, borderBottom: `1px solid ${GOLD}15` }}>
                  <span className="text-[10px] font-bold" style={{ color: GOLD }}>AI-DRAFTED RESPONSE</span>
                  <div className="flex items-center gap-3">
                    <button data-testid="btn-copy-draft"
                      onClick={() => { navigator.clipboard.writeText(opp.ai_response_draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                      style={{ color: copied ? GREEN : GOLD }}>
                      <Copy className="w-3 h-3" /> {copied ? "Copied!" : "Copy"}
                    </button>
                    <button data-testid="btn-download-draft"
                      onClick={() => {
                        const blob = new Blob([opp.ai_response_draft], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${opp.employer_name.replace(/\s+/g, "_")}_competitive_response.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-[10px] font-semibold flex items-center gap-1 transition-colors"
                      style={{ color: BLUE }}>
                      <Download className="w-3 h-3" /> Download
                    </button>
                  </div>
                </div>
                {(showDraft || opp.ai_response_draft) && (
                  <div className="p-3">
                    <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{opp.ai_response_draft}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg p-4 text-center" style={{ background: `${GOLD}05`, border: "1px dashed rgba(255,184,0,0.2)" }}>
                <Brain className="w-5 h-5 mx-auto mb-2" style={{ color: GOLD }} />
                <p className="text-xs text-zinc-500">Generate an AI-drafted competitive response for this prospect</p>
              </div>
            )}
          </div>

          {/* Known Competitor — pre-decision tagging to surface battlecard inline */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-3 h-3" style={{ color: "#FF4D6D" }} />
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Known Competitor</p>
            </div>
            <div className="flex gap-2">
              <Input
                data-testid="input-known-competitor"
                list={COMPETITOR_DATALIST_ID}
                value={editCompetitor}
                onChange={e => setEditCompetitor(e.target.value)}
                placeholder="e.g. CVS Caremark, Express Scripts…"
                className="bg-zinc-900 border-zinc-700 text-white text-sm flex-1"
              />
              <CompetitorDatalist options={competitorSuggestions} />
              <button
                data-testid="btn-save-competitor"
                onClick={() => patchMut.mutate({ known_competitor: editCompetitor.trim() || null })}
                disabled={editCompetitor === (opp.known_competitor || "") || patchMut.isPending}
                className="text-[11px] font-semibold flex items-center gap-1 transition-colors px-3 py-1 rounded-lg"
                style={{ background: "rgba(255,77,109,0.12)", border: "1px solid rgba(255,77,109,0.25)", color: "#FF4D6D" }}>
                <Save className="w-3 h-3" /> Tag
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              Tagging a competitor surfaces their battlecard inline for your team.
            </p>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">Notes</p>
            <Textarea data-testid="textarea-opp-notes"
              value={editNotes} onChange={e => setEditNotes(e.target.value)}
              rows={3} placeholder="Add context, contacts, next steps..."
              className="bg-zinc-900 border-zinc-700 text-white text-sm resize-none" />
            <button data-testid="btn-save-notes"
              onClick={() => patchMut.mutate({ notes: editNotes })}
              disabled={editNotes === opp.notes || patchMut.isPending}
              className="mt-2 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              style={{ color: GREEN }}>
              <Save className="w-3 h-3" /> Save Notes
            </button>
          </div>

          {/* Won → Rx Defense handoff banner */}
          {editStage === "won" && (
            <div className="rounded-xl p-4 space-y-2.5"
              style={{ background: "linear-gradient(135deg, rgba(0,255,148,0.07) 0%, rgba(0,255,148,0.03) 100%)", border: `1px solid ${GREEN}35` }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
                <span className="text-xs font-black" style={{ color: GREEN }}>ACCOUNT WON</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${GREEN}18`, border: `1px solid ${GREEN}30`, color: GREEN }}>
                  NEXT STEP
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Start fiduciary Rx contract analysis for {opp.employer_name}. The account context will be pre-loaded in Rx Defense IQ™.
              </p>
              {opp.rx_contract_id && (
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: GREEN }}>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Rx Defense analysis linked — ID {opp.rx_contract_id.slice(0, 8)}…</span>
                  <button
                    data-testid="btn-view-linked-analysis"
                    onClick={() => { onClose(); navigate(`/rx-defense?contract=${opp.rx_contract_id}`); }}
                    className="underline font-semibold"
                    style={{ color: GREEN }}>
                    View
                  </button>
                </div>
              )}
              <button
                data-testid="btn-won-handoff-rx-defense"
                onClick={() => {
                  onClose();
                  sendTo(
                    "rx-defense",
                    opp.employer_ein ?? "",
                    opp.employer_name,
                    { opp_id: String(opp.id) },
                  );
                }}
                className="w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                style={{ background: GREEN, color: "#07091c" }}>
                <Pill className="w-3.5 h-3.5" />
                {opp.rx_contract_id ? "Open Rx Defense Analysis" : "Send to Rx Defense IQ™ →"}
              </button>
            </div>
          )}

          {/* Actions */}
          {opp.employer_ein && (
            <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <a href={`/benefits-benchmarking?ein=${opp.employer_ein}`}
                data-testid="btn-view-benchmarking"
                className="flex-1 text-center py-2 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: `${BLUE}12`, border: `1px solid ${BLUE}25`, color: BLUE }}>
                <BarChart2 className="w-3 h-3 inline mr-1" /> Benchmarking
              </a>
              <button
                data-testid="btn-open-rx-defense"
                onClick={() => {
                  onClose();
                  sendTo(
                    "rx-defense",
                    opp.employer_ein!,
                    opp.employer_name,
                    { opp_id: String(opp.id) },
                  );
                }}
                className="flex-1 text-center py-2 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: `${GREEN}12`, border: `1px solid ${GREEN}25`, color: GREEN }}>
                <Pill className="w-3 h-3 inline mr-1" /> Rx Defense
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline tab ───────────────────────────────────────────────────────────────
function PipelineTab({ prefillForm, clearPrefill, focusOppId }: { prefillForm?: Partial<OppForm>; clearPrefill?: () => void; focusOppId?: string }) {
  const { data: opps = [], isLoading } = useQuery<Opportunity[]>({ queryKey: ["/api/rfp/opportunities"] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(!!prefillForm);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [filterStage, setFilterStage] = useState("all");
  const [view, setView] = useState<"list" | "board">("list");
  const didFocus = useRef(false);

  // Auto-open detail panel when navigated here with an opp deep-link
  useEffect(() => {
    if (!focusOppId || isLoading || didFocus.current || opps.length === 0) return;
    const target = opps.find(o => String(o.id) === String(focusOppId));
    if (target) { setSelected(target); didFocus.current = true; }
  }, [opps, isLoading, focusOppId]);

  // Open form automatically when a prefill arrives (e.g. from Intel tab)
  if (prefillForm && !showForm) setShowForm(true);

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest("DELETE", `/api/rfp/opportunities/${id}`); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] }); toast({ title: "Opportunity deleted" }); },
  });

  const stageMut = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${id}`, { stage });
      return res.json();
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ["/api/rfp/opportunities"] });
      const prev = qc.getQueryData<Opportunity[]>(["/api/rfp/opportunities"]);
      qc.setQueryData<Opportunity[]>(["/api/rfp/opportunities"], (old = []) =>
        old.map(o => (o.id === id ? { ...o, stage } : o)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["/api/rfp/opportunities"], ctx.prev);
      toast({ title: "Couldn't move deal", variant: "destructive" });
    },
    onSettled: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] }); },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    stageMut.mutate({ id: Number(draggableId), stage: destination.droppableId });
  };

  const filtered = filterStage === "all" ? opps : opps.filter(o => o.stage === filterStage);
  const totalValue = opps.filter(o => o.stage !== "lost").reduce((s, o) => s + (o.estimated_value || 0), 0);
  const wonValue = opps.filter(o => o.stage === "won").reduce((s, o) => s + (o.estimated_value || 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Pipeline", val: fmtMoney(totalValue), color: GOLD, icon: TrendingUp },
          { label: "Won Revenue", val: fmtMoney(wonValue), color: GREEN, icon: CheckCircle2 },
          { label: "Active Opps", val: String(opps.filter(o => !["won","lost"].includes(o.stage)).length), color: BLUE, icon: Target },
          { label: "High Priority", val: String(opps.filter(o => o.priority === "high").length), color: RED, icon: AlertTriangle },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl p-4"
            style={{ background: `${kpi.color}08`, border: `1px solid ${kpi.color}20` }}>
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              <p className="text-xs text-zinc-500 font-medium">{kpi.label}</p>
            </div>
            <p className="text-xl font-black" style={{ color: kpi.color }}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {view === "list" && [{ key: "all", label: "All" }, ...STAGES].map(s => (
            <button key={s.key} data-testid={`filter-${s.key}`}
              onClick={() => setFilterStage(s.key)}
              className="text-[11px] font-bold px-3 py-1 rounded-full transition-all"
              style={{
                background: filterStage === s.key ? `${GOLD}20` : "rgba(255,255,255,0.04)",
                color: filterStage === s.key ? GOLD : "rgba(255,255,255,0.4)",
                border: filterStage === s.key ? `1px solid ${GOLD}30` : "1px solid rgba(255,255,255,0.07)",
              }}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <button data-testid="btn-view-list"
              onClick={() => setView("list")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all"
              style={{
                background: view === "list" ? `${GOLD}20` : "transparent",
                color: view === "list" ? GOLD : "rgba(255,255,255,0.4)",
              }}>
              <ListIcon className="w-3.5 h-3.5" /> List
            </button>
            <button data-testid="btn-view-board"
              onClick={() => setView("board")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-all"
              style={{
                background: view === "board" ? `${GOLD}20` : "transparent",
                color: view === "board" ? GOLD : "rgba(255,255,255,0.4)",
              }}>
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
          </div>
          <button data-testid="btn-new-opp"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ background: GOLD, color: "#0a0c1e" }}>
            <Plus className="w-4 h-4" /> New Opportunity
          </button>
        </div>
      </div>

      {/* Opportunity views */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading pipeline…
        </div>
      ) : opps.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
          <Target className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 font-semibold">No opportunities yet</p>
          <p className="text-xs text-zinc-600 mt-1">Click "New Opportunity" to add your first prospect</p>
        </div>
      ) : view === "board" ? (
        <BoardView opps={opps} onSelect={setSelected} onDragEnd={handleDragEnd} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
          <Target className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 font-semibold">No opportunities{filterStage !== "all" ? ` in ${filterStage}` : ""}</p>
          <p className="text-xs text-zinc-600 mt-1">Try a different stage filter or add a new prospect</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(opp => (
            <OppCard key={opp.id} opp={opp}
              onSelect={() => setSelected(opp)}
              onDelete={() => deleteMut.mutate(opp.id)} />
          ))}
        </div>
      )}

      {showForm && (
        <OppFormModal
          prefill={prefillForm}
          onClose={() => { setShowForm(false); clearPrefill?.(); }}
          onSaved={() => { setShowForm(false); clearPrefill?.(); }}
        />
      )}
      {selected && <OppDetail opp={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── RFP Analyzer tab ──────────────────────────────────────────────────────────
function AnalyzerTab() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: opps = [] } = useQuery<Opportunity[]>({ queryKey: ["/api/rfp/opportunities"] });
  const { data: contracts = [] } = useQuery<RxContractSummary[]>({
    queryKey: ["/api/rx-defense/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/rx-defense/contracts", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "reading" | "uploading" | "analyzing" | "done" | "error">("idle");
  const [activeContractId, setActiveContractId] = useState<string | null>(null);
  const [pbmName, setPbmName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [linkOppId, setLinkOppId] = useState<string>("");
  const [inlineDraft, setInlineDraft] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  async function generateInlineDraft() {
    if (!activeContractId) return;
    setDraftLoading(true);
    try {
      const res = await apiRequest("POST", "/api/rfp/quick-draft", {
        rx_contract_id: activeContractId,
        employer_name: employerName || pbmName || "This Employer",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Draft failed");
      setInlineDraft(data.draft);
    } catch {
      toast({ title: "Draft generation failed", variant: "destructive" });
    } finally {
      setDraftLoading(false);
    }
  }

  const activeContract = contracts.find(c => String(c.id) === String(activeContractId));
  const oppsWithContract = opps.filter(o => o.rx_contract_id);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [".pdf", ".txt", ".docx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      toast({ title: "Unsupported format — use PDF, DOCX, or TXT", variant: "destructive" });
      return;
    }

    setUploadProgress("reading");
    setUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      const uArr = new Uint8Array(bytes);
      let binary = "";
      for (let i = 0; i < uArr.byteLength; i++) binary += String.fromCharCode(uArr[i]);
      const base64 = btoa(binary);

      setUploadProgress("uploading");
      const res = await apiRequest("POST", "/api/rx-defense/upload", {
        filename: file.name,
        data_b64: base64,
        content_type: file.type,
        pbm_name: pbmName || null,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      const contractId = String(data.id);
      setActiveContractId(contractId);
      setUploadProgress("analyzing");

      // Poll for completion
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const pr = await fetch(`/api/rx-defense/contracts/${contractId}`, { credentials: "include" });
          const pd = await pr.json();
          if (pd.status === "complete" || pd.status === "error") {
            clearInterval(poll);
            qc.invalidateQueries({ queryKey: ["/api/rx-defense/contracts"] });
            setUploadProgress(pd.status === "complete" ? "done" : "error");
            if (pd.status === "complete") {
              toast({ title: `Analysis complete — score: ${pd.overall_score}/100` });
            } else {
              toast({ title: "Analysis encountered an error", variant: "destructive" });
            }
          }
        } catch { /* continue polling */ }
        if (attempts > 60) { clearInterval(poll); setUploadProgress("error"); }
      }, 3000);

    } catch (err: any) {
      toast({ title: err.message || "Upload failed", variant: "destructive" });
      setUploadProgress("error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function linkContractToOpp() {
    if (!activeContractId || !linkOppId) return;
    try {
      const res = await apiRequest("PATCH", `/api/rfp/opportunities/${linkOppId}`, {
        rx_contract_id: activeContractId,
      });
      if (!res.ok) throw new Error("Link failed");
      qc.invalidateQueries({ queryKey: ["/api/rfp/opportunities"] });
      toast({ title: "Contract linked to opportunity" });
    } catch {
      toast({ title: "Failed to link", variant: "destructive" });
    }
  }

  const scoreColor = (s: number | null) => {
    if (!s) return "#6B7280";
    if (s >= 80) return GREEN;
    if (s >= 60) return GOLD;
    return RED;
  };

  const statusLabels: Record<string, string> = {
    idle: "", reading: "Reading file…", uploading: "Uploading…",
    analyzing: "AI analyzing 65 provisions…", done: "Analysis complete", error: "Analysis failed",
  };

  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(16,185,129,0.02) 100%)", border: "1px solid rgba(16,185,129,0.2)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Pill className="w-5 h-5" style={{ color: "#10B981" }} />
          <h3 className="text-white font-bold">Rx Defense Contract Analyzer</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
            65 PROVISIONS · 13 TABS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Employer / Prospect Name</label>
            <Input data-testid="input-employer-name"
              value={employerName} onChange={e => setEmployerName(e.target.value)}
              placeholder="Acme Corp, City of Indianapolis…"
              className="bg-zinc-900 border-zinc-700 text-white" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">PBM Name (optional)</label>
            <Input data-testid="input-pbm-name"
              value={pbmName} onChange={e => setPbmName(e.target.value)}
              placeholder="CVS Caremark, Express Scripts…"
              className="bg-zinc-900 border-zinc-700 text-white" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Upload Contract (PDF / DOCX / TXT)</label>
            <label data-testid="btn-upload-contract"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-all w-full justify-center"
              style={{ background: uploading ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981" }}>
              {uploadProgress === "idle" || uploadProgress === "done" || uploadProgress === "error"
                ? <><Upload className="w-4 h-4" /> Choose file</>
                : <><Loader2 className="w-4 h-4 animate-spin" /> {statusLabels[uploadProgress]}</>}
              <input type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Status bar */}
        {uploadProgress !== "idle" && (
          <div className="rounded-xl p-3 flex items-center gap-3 mb-4"
            style={{ background: uploadProgress === "error" ? `${RED}08` : uploadProgress === "done" ? `${GREEN}08` : `${BLUE}08`, border: `1px solid ${uploadProgress === "error" ? RED : uploadProgress === "done" ? GREEN : BLUE}20` }}>
            {uploadProgress === "done" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: GREEN }} />
              : uploadProgress === "error" ? <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: RED }} />
              : <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: BLUE }} />}
            <span className="text-sm font-semibold" style={{ color: uploadProgress === "error" ? RED : uploadProgress === "done" ? GREEN : BLUE }}>
              {statusLabels[uploadProgress]}
            </span>
          </div>
        )}

        {/* Inline analysis results */}
        {activeContract && activeContract.status === "complete" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl p-4 text-center"
                style={{ background: `${scoreColor(activeContract.overall_score)}10`, border: `1px solid ${scoreColor(activeContract.overall_score)}25` }}>
                <p className="text-3xl font-black" style={{ color: scoreColor(activeContract.overall_score) }}>
                  {activeContract.overall_score ?? "—"}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">FIDUCIARY SCORE /100</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: `${RED}08`, border: `1px solid ${RED}18` }}>
                <p className="text-3xl font-black" style={{ color: RED }}>
                  {(activeContract.key_findings || []).filter((f: any) => f?.severity === "critical").length}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">CRITICAL ISSUES</p>
              </div>
              <div className="rounded-xl p-4 text-center" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}18` }}>
                <p className="text-3xl font-black" style={{ color: GOLD }}>
                  {(activeContract.key_findings || []).length}
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">TOTAL FLAGS</p>
              </div>
            </div>

            {/* Key findings inline */}
            {(activeContract.key_findings || []).length > 0 && (
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Top Findings</p>
                <div className="space-y-1.5">
                  {(activeContract.key_findings || []).slice(0, 5).map((f: any, i: number) => (
                    <div key={i} data-testid={`finding-${i}`}
                      className="flex items-start gap-2 p-2.5 rounded-lg"
                      style={{ background: f?.severity === "critical" ? `${RED}06` : `${GOLD}06`, border: `1px solid ${f?.severity === "critical" ? RED : GOLD}15` }}>
                      <AlertOctagon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: f?.severity === "critical" ? RED : GOLD }} />
                      <p className="text-xs text-zinc-300 leading-relaxed">{f?.text || f?.finding || JSON.stringify(f)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline competitive response draft */}
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" style={{ color: GOLD }} /> Competitive Response Draft
                </p>
                <button data-testid="btn-generate-inline-draft"
                  disabled={draftLoading}
                  onClick={generateInlineDraft}
                  className="text-[11px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25`, color: GOLD }}>
                  {draftLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {inlineDraft ? "Regenerate" : "Generate Draft"}
                </button>
              </div>
              {inlineDraft ? (
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}20` }}>
                  <div className="flex items-center justify-between px-3 py-2"
                    style={{ background: `${GOLD}08`, borderBottom: `1px solid ${GOLD}15` }}>
                    <span className="text-[10px] font-bold" style={{ color: GOLD }}>AI-DRAFTED RESPONSE — READY TO SEND</span>
                    <div className="flex items-center gap-3">
                      <button data-testid="btn-copy-inline-draft"
                        onClick={() => { navigator.clipboard.writeText(inlineDraft); setDraftCopied(true); setTimeout(() => setDraftCopied(false), 2000); }}
                        className="text-[10px] font-semibold flex items-center gap-1"
                        style={{ color: draftCopied ? GREEN : GOLD }}>
                        <Copy className="w-3 h-3" /> {draftCopied ? "Copied!" : "Copy"}
                      </button>
                      <button data-testid="btn-download-inline-draft"
                        onClick={() => {
                          const blob = new Blob([inlineDraft], { type: "text/plain" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${(employerName || "Prospect").replace(/\s+/g, "_")}_competitive_response.txt`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-[10px] font-semibold flex items-center gap-1"
                        style={{ color: BLUE }}>
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </div>
                  </div>
                  <div className="p-3 max-h-60 overflow-y-auto">
                    <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-line">{inlineDraft}</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-3 text-center" style={{ background: `${GOLD}04`, border: "1px dashed rgba(255,184,0,0.15)" }}>
                  <p className="text-[11px] text-zinc-500">Generate an AI-drafted pitch letter using the Rx Defense analysis findings above</p>
                </div>
              )}
            </div>

            {/* Link to opportunity + view full analysis */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select data-testid="select-link-opp"
                  value={linkOppId} onChange={e => setLinkOppId(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs">
                  <option value="">— Link to pipeline opportunity —</option>
                  {opps.map(o => <option key={o.id} value={String(o.id)}>{o.employer_name}</option>)}
                </select>
                <button data-testid="btn-link-contract"
                  disabled={!linkOppId} onClick={linkContractToOpp}
                  className="px-3 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                  style={{ background: linkOppId ? `${GREEN}15` : "rgba(255,255,255,0.04)", border: `1px solid ${linkOppId ? GREEN : "rgba(255,255,255,0.08)"}25`, color: linkOppId ? GREEN : "rgba(255,255,255,0.3)" }}>
                  Link
                </button>
              </div>
              <button data-testid="btn-view-full-analysis"
                onClick={() => navigate("/rx-defense")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#10B981" }}>
                <ExternalLink className="w-3 h-3" /> Full 13-Tab Report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Existing analyses */}
      <div>
        <h3 className="text-sm font-bold text-zinc-300 mb-3">All Rx Defense Analyses</h3>
        {contracts.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.08)" }}>
            <FileSearch className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
            <p className="text-sm text-zinc-500">No contracts analyzed yet</p>
            <p className="text-xs text-zinc-600 mt-1">Upload a PBM contract above to generate your first analysis</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map(c => (
              <div key={c.id} data-testid={`contract-row-${c.id}`}
                className="flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all"
                onClick={() => setActiveContractId(String(c.id))}
                style={{
                  background: activeContractId === String(c.id) ? `${GOLD}08` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${activeContractId === String(c.id) ? GOLD : "rgba(255,255,255,0.07)"}25`,
                }}>
                <div>
                  <p className="text-white font-semibold text-sm">{c.pbm_name || c.contract_filename || "Contract"}</p>
                  <p className="text-xs text-zinc-500">ID: {c.id} · {new Date(c.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  {c.overall_score !== null && (
                    <span className="text-sm font-black" style={{ color: scoreColor(c.overall_score) }}>
                      {c.overall_score}/100
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: c.status === "complete" ? `${GREEN}15` : c.status === "error" ? `${RED}15` : `${GOLD}15`, color: c.status === "complete" ? GREEN : c.status === "error" ? RED : GOLD, border: `1px solid ${c.status === "complete" ? GREEN : c.status === "error" ? RED : GOLD}25` }}>
                    {c.status}
                  </span>
                  {opps.find(o => String(o.rx_contract_id) === String(c.id)) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${PURPLE}15`, color: PURPLE, border: `1px solid ${PURPLE}25` }}>
                      Linked
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Prospect Intel tab ────────────────────────────────────────────────────────
function IntelTab({ onAddToPipeline }: { onAddToPipeline?: (prefill: Partial<OppForm>) => void }) {
  const [einInput, setEinInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [nameResults, setNameResults] = useState<any[]>([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [queriedEin, setQueriedEin] = useState<string | null>(null);

  async function searchByName(q: string) {
    if (q.length < 2) { setNameResults([]); return; }
    setNameSearching(true);
    try {
      const res = await fetch(`/api/shady-broker/search?q=${encodeURIComponent(q)}&limit=8`, { credentials: "include" });
      const data = await res.json();
      setNameResults(data.results || []);
    } catch { setNameResults([]); }
    finally { setNameSearching(false); }
  }

  function selectNameResult(r: any) {
    setEinInput(r.ein);
    setNameInput(r.sponsor || "");
    setNameResults([]);
    setQueriedEin(r.ein.replace(/[^0-9]/g, ""));
  }
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [watchPending, setWatchPending] = useState(false);

  const watchMut = useMutation({
    mutationFn: async (data: { ein: string; employer_name: string; employer_state?: string }) => {
      const res = await apiRequest("POST", "/api/rfp/watchlist", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/watchlist"] });
      toast({ title: "Added to watchlist — you'll be alerted on new filings" });
    },
    onError: (e: any) => {
      const msg = (e?.message || "").toLowerCase();
      toast({ title: msg.includes("409") || msg.includes("already") ? "Already on watchlist" : "Failed to add to watchlist", variant: "destructive" });
    },
  });

  const { data: intel, isLoading: intelLoading, error: intelError } = useQuery<IntelBundle>({
    queryKey: ["/api/rfp/intel", queriedEin],
    queryFn: async () => {
      const res = await fetch(`/api/rfp/intel/${queriedEin}`, { credentials: "include" });
      if (!res.ok) throw new Error("Lookup failed");
      return res.json();
    },
    enabled: !!queriedEin,
    retry: false,
  });

  function handleSearch() {
    const cleaned = einInput.replace(/[^0-9]/g, "");
    if (cleaned.length < 9) { toast({ title: "Enter a valid 9-digit EIN", variant: "destructive" }); return; }
    setQueriedEin(cleaned);
  }

  const bench = intel?.benchmarking || {};
  const sbi   = intel?.shady_broker   || {};
  const tps   = intel?.talking_points || [];

  const [narrative, setNarrative] = useState<any | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  async function generateNarrative() {
    if (!queriedEin) return;
    setNarrativeLoading(true);
    try {
      const res = await fetch(`/api/shady-broker/narrative/${queriedEin}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setNarrative(data);
    } catch {
      toast({ title: "Narrative generation failed", variant: "destructive" });
    } finally {
      setNarrativeLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Search — by name OR EIN */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h3 className="text-sm font-bold text-zinc-300 mb-3">Employer Intelligence Lookup</h3>

        {/* Name search with live dropdown */}
        <div className="relative mb-3">
          <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Search by Employer Name</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input data-testid="input-name-search"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); searchByName(e.target.value); }}
                placeholder="e.g. Tower Health, Walmart, Ford Motor…"
                className="bg-zinc-900 border-zinc-700 text-white w-full" />
              {nameSearching && (
                <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              )}
            </div>
          </div>
          {nameResults.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden"
              style={{ background: "#131629", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
              {nameResults.map((r: any, i: number) => (
                <button key={i} data-testid={`name-result-${i}`}
                  onClick={() => selectNameResult(r)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                  <p className="text-xs font-bold text-white">{r.sponsor}</p>
                  <p className="text-[10px] text-zinc-500">EIN {r.ein} · {r.city}, {r.state} · {(r.participants || 0).toLocaleString()} participants</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Direct EIN lookup */}
        <div>
          <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide mb-1 block">Or Look Up Directly by EIN</label>
          <div className="flex gap-3">
            <Input data-testid="input-ein-lookup"
              value={einInput} onChange={e => setEinInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Enter EIN (e.g. 23-1352204)"
              className="bg-zinc-900 border-zinc-700 text-white flex-1" />
            <Button data-testid="btn-lookup-ein"
              onClick={handleSearch} disabled={intelLoading}
              style={{ background: GOLD, color: "#0a0c1e" }} className="font-bold gap-2">
              {intelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Look Up
            </Button>
          </div>
        </div>
        <p className="text-xs text-zinc-600 mt-2">Searches 191,887 employer plans from DOL Form 5500 filings (2020–2024)</p>
      </div>

      {/* Results */}
      {intelLoading && (
        <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Querying DOL database…
        </div>
      )}

      {intelError && (
        <div className="rounded-xl p-5 text-center" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.2)" }}>
          <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: RED }} />
          <p className="text-sm text-white font-semibold">No data found for this EIN</p>
          <p className="text-xs text-zinc-500 mt-1">This EIN may not have Form 5500 filings in the database</p>
        </div>
      )}

      {intel && !intelLoading && (
        <div className="space-y-5">
          {/* Employer header */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,184,0,0.05)", border: `1px solid ${GOLD}25` }}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">{bench.sponsor_name || intel.ein}</h3>
                <div className="flex items-center gap-3 mt-1">
                  {bench.city && <span className="text-xs text-zinc-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{bench.city}, {bench.state}</span>}
                  <span className="text-xs text-zinc-600">EIN: {intel.ein}</span>
                  {bench.latest_year && <span className="text-xs text-zinc-600">Latest filing: {bench.latest_year}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button data-testid="btn-full-benchmarking"
                  onClick={() => navigate(`/benefits-benchmarking`)}
                  className="text-[11px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  style={{ background: `${BLUE}12`, border: `1px solid ${BLUE}25`, color: BLUE }}>
                  <BarChart2 className="w-3 h-3" /> Full Benchmarking
                </button>
                <button data-testid="btn-full-shady"
                  onClick={() => navigate(`/shady-broker-index`)}
                  className="text-[11px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  style={{ background: `${RED}12`, border: `1px solid ${RED}25`, color: RED }}>
                  <Shield className="w-3 h-3" /> Shady Broker
                </button>
              </div>
            </div>
          </div>

          {/* Benchmarking metrics */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">DOL Form 5500 — Plan Financials</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Plan Income", val: fmtMoney(bench.total_income), color: GOLD },
                { label: "Participants", val: (bench.participants || 0).toLocaleString(), color: BLUE },
                { label: "Broker Commissions", val: fmtMoney(bench.broker_commissions), color: sbi.flag ? RED : ORANGE },
                { label: "Admin Fees", val: fmtMoney(bench.admin_fees), color: ORANGE },
                { label: "Welfare Premiums", val: fmtMoney(bench.welfare_premiums), color: PURPLE },
                { label: "Carrier", val: bench.carrier || "Unknown", color: "#6B7280" },
                { label: "Has Stop-Loss", val: bench.has_stop_loss ? "Yes" : "No", color: bench.has_stop_loss ? GREEN : RED },
                { label: "Has Health Plan", val: bench.has_health ? "Yes" : "No", color: bench.has_health ? GREEN : "#6B7280" },
              ].map(m => (
                <div key={m.label} data-testid={`intel-metric-${m.label.replace(/\s/g, "-").toLowerCase()}`}
                  className="rounded-xl p-3"
                  style={{ background: `${m.color}08`, border: `1px solid ${m.color}18` }}>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className="text-sm font-bold" style={{ color: m.color }}>{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Shady Broker signals */}
          {Object.keys(sbi).length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3">Shady Broker Index™ — Key Signals</h4>
              <div className="space-y-2">
                {[
                  { label: "Broker Commission % of Plan Income", val: `${(sbi.broker_pct || 0).toFixed(1)}%`, threshold: 12.5, current: sbi.broker_pct || 0, format: "pct" },
                  { label: "Admin Fee % of Plan Income", val: `${(sbi.admin_pct || 0).toFixed(1)}%`, threshold: 9.4, current: sbi.admin_pct || 0, format: "pct" },
                  { label: "Broker $ per Member", val: `$${(sbi.broker_per_member || 0).toFixed(0)}`, threshold: 142, current: sbi.broker_per_member || 0, format: "dollar" },
                ].map(row => {
                  const flagged = row.current > row.threshold;
                  return (
                    <div key={row.label} data-testid={`sbi-metric-${row.label.replace(/\s/g, "-").toLowerCase()}`}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: flagged ? `${RED}08` : "rgba(255,255,255,0.025)", border: `1px solid ${flagged ? RED : "rgba(255,255,255,0.07)"}20` }}>
                      <span className="text-xs text-zinc-400">{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: flagged ? RED : GREEN }}>{row.val}</span>
                        {flagged && <AlertOctagon className="w-4 h-4" style={{ color: RED }} />}
                        {!flagged && <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {sbi.flag && (
                <div className="mt-3 rounded-xl p-4" style={{ background: `${RED}08`, border: `1px solid ${RED}25` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" style={{ color: RED }} />
                    <span className="text-sm font-bold" style={{ color: RED }}>High-Commission Flag</span>
                  </div>
                  <p className="text-xs text-zinc-400">This employer's current broker compensation exceeds DOL national benchmarks. This is your strongest opening angle — use it as fiduciary evidence in your pitch.</p>
                </div>
              )}
            </div>
          )}

          {/* AI Talking Points from intel bundle */}
          {tps.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" style={{ color: PURPLE }} />
                AI Talking Points — Evidence-Based
              </h4>
              <div className="space-y-2">
                {tps.map((tp: TalkingPointBundle, i: number) => (
                  <div key={i} data-testid={`intel-talking-point-${i}`}
                    className="rounded-xl p-3 space-y-1"
                    style={{ background: `${PURPLE}07`, border: `1px solid ${PURPLE}18` }}>
                    <p className="text-xs font-bold text-white">{tp.headline}</p>
                    <p className="text-[11px] font-semibold" style={{ color: BLUE }}>{tp.evidence}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{tp.angle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shady Broker Investigative Brief — direct collateral generation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" style={{ color: RED }} />
                Investigative Intel Brief
              </h4>
              <button data-testid="btn-generate-narrative"
                disabled={narrativeLoading}
                onClick={generateNarrative}
                className="text-[11px] font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all"
                style={{ background: narrative ? `${RED}12` : `${RED}12`, border: `1px solid ${RED}25`, color: RED }}>
                {narrativeLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                {narrative ? "Regenerate Brief" : "Generate Intel Brief"}
              </button>
            </div>
            {narrative ? (
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${RED}20` }}>
                <div className="px-4 py-2.5" style={{ background: `${RED}08`, borderBottom: `1px solid ${RED}15` }}>
                  <p className="text-xs font-bold" style={{ color: RED }}>SHADY BROKER INDEX™ — FORENSIC BRIEF</p>
                  {narrative.score && (
                    <p className="text-xs text-zinc-400 mt-0.5">SBI Score: <span style={{ color: narrative.score < 70 ? RED : GOLD }}>{narrative.score}/100</span></p>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  {narrative.narrative?.headline && (
                    <p className="text-sm font-bold text-white leading-snug">{narrative.narrative.headline}</p>
                  )}
                  {narrative.narrative?.why_this_scores_poorly && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{narrative.narrative.why_this_scores_poorly}</p>
                  )}
                  {narrative.narrative?.hidden_compensation_signals?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: ORANGE }}>Hidden Compensation Signals</p>
                      <ul className="space-y-1">
                        {narrative.narrative.hidden_compensation_signals.map((s: string, i: number) => (
                          <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                            <AlertOctagon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: ORANGE }} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {narrative.narrative?.cfo_questions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: BLUE }}>CFO Questions to Ask</p>
                      <ul className="space-y-1">
                        {narrative.narrative.cfo_questions.map((q: string, i: number) => (
                          <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: BLUE }} />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {narrative.narrative?.next_step && (
                    <div className="p-3 rounded-lg" style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}18` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: GREEN }}>Recommended Next Step</p>
                      <p className="text-xs text-zinc-300">{narrative.narrative.next_step}</p>
                    </div>
                  )}

                  {/* Collateral download — uses existing generateShadyBrokerPDF from pdfReports.ts */}
                  <button data-testid="btn-download-collateral"
                    onClick={() => {
                      try {
                        const pdfData = {
                          ein:         queriedEin,
                          sponsor:     narrative.sponsor || bench?.sponsor_name,
                          score:       narrative.score,
                          rating:      narrative.rating,
                          narrative:   narrative.narrative,
                          benchmarking: bench,
                          shady_broker: sbi,
                        };
                        const doc = generateShadyBrokerPDF(pdfData);
                        const date = new Date().toISOString().slice(0, 10);
                        doc.save(`Kincaid-SBI-EIN${queriedEin}-${date}.pdf`);
                      } catch (err) {
                        console.error("PDF generation error", err);
                        toast({ title: "PDF generation failed", variant: "destructive" });
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all"
                    style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}25`, color: BLUE }}>
                    <Download className="w-3.5 h-3.5" /> Download Forensic Brief PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-4 text-center" style={{ background: `${RED}04`, border: "1px dashed rgba(255,77,109,0.2)" }}>
                <Shield className="w-5 h-5 mx-auto mb-2" style={{ color: RED }} />
                <p className="text-xs text-zinc-500">Generate an AI forensic brief using the Shady Broker Index™ methodology — includes compensation signals, CFO questions, and ERISA risk flags</p>
              </div>
            )}
          </div>

          {/* Add to pipeline / watch CTAs */}
          <div className="flex gap-3 pt-2">
            <button data-testid="btn-add-intel-to-pipeline"
              onClick={() => {
                if (onAddToPipeline) {
                  onAddToPipeline({
                    employer_name: bench.sponsor_name || intel.ein,
                    employer_ein: intel.ein,
                    employer_state: bench.state || "",
                    employer_city: bench.city || "",
                    industry: bench.industry || "",
                    participants: bench.participants ? String(bench.participants) : "",
                  });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: GOLD, color: "#0a0c1e" }}>
              <Plus className="w-4 h-4" /> Add to Pipeline
            </button>
            <button data-testid="btn-watch-ein"
              disabled={watchMut.isPending}
              onClick={() => {
                watchMut.mutate({
                  ein: intel.ein,
                  employer_name: bench.sponsor_name || intel.ein,
                  employer_state: bench.state || undefined,
                });
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{ background: "rgba(0,212,255,0.1)", border: `1px solid ${BLUE}25`, color: BLUE }}>
              {watchMut.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : watchMut.isSuccess
                ? <CheckCircle2 className="w-4 h-4" />
                : <Bell className="w-4 h-4" />}
              {watchMut.isSuccess ? "Watching" : "Watch for New Filings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Watchlist tab ─────────────────────────────────────────────────────────────
function WatchlistTab({ focusEin }: { focusEin?: string }) {
  const { data: watches = [], isLoading: watchLoading } = useQuery<WatchEntry[]>({ queryKey: ["/api/rfp/watchlist"] });
  const { data: alerts = [], isLoading: alertLoading } = useQuery<Alert[]>({ queryKey: ["/api/rfp/alerts"] });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ein: "", employer_name: "", employer_state: "", notes: "" });
  const [checkResult, setCheckResult] = useState<CheckNowResult | null>(null);
  const [highlightedEin, setHighlightedEin] = useState<string | undefined>(focusEin);
  const focusRowRef = useRef<HTMLDivElement | null>(null);
  const didScrollRef = useRef(false);

  // Scroll to + briefly highlight the deep-linked watchlist row
  useEffect(() => {
    if (!focusEin || watchLoading || didScrollRef.current || watches.length === 0) return;
    const match = watches.find(w => w.ein === focusEin);
    if (!match) return;
    didScrollRef.current = true;
    setTimeout(() => {
      focusRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlightedEin(undefined), 3000);
    }, 200);
  }, [watches, watchLoading, focusEin]);

  const checkNowMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rfp/watchlist/check-now", {});
      return res.json() as Promise<CheckNowResult>;
    },
    onSuccess: (data) => {
      setCheckResult(data);
      qc.invalidateQueries({ queryKey: ["/api/rfp/watchlist"] });
      qc.invalidateQueries({ queryKey: ["/api/rfp/alerts"] });
      if (data.count > 0) {
        toast({ title: `${data.count} new filing${data.count === 1 ? "" : "s"} detected` });
      } else {
        toast({ title: "All up to date — no new filings" });
      }
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      toast({
        title: msg.includes("429") ? "Checked recently — try again in a few minutes" : "Check failed",
        variant: "destructive",
      });
    },
  });

  const addMut = useMutation({
    mutationFn: async (data: typeof addForm) => {
      const res = await apiRequest("POST", "/api/rfp/watchlist", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/rfp/watchlist"] });
      toast({ title: "Added to watchlist" });
      setShowAdd(false);
      setAddForm({ ein: "", employer_name: "", employer_state: "", notes: "" });
    },
    onError: (e: any) => toast({ title: e?.message?.includes("409") ? "Already on watchlist" : "Failed", variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest("DELETE", `/api/rfp/watchlist/${id}`); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/rfp/watchlist"] }); toast({ title: "Removed from watchlist" }); },
  });

  const newAlerts = alerts.filter(a => {
    const ts = new Date(a.created_at).getTime();
    return Date.now() - ts < 7 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-5">
      {/* Tab header with on-demand check */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-zinc-200">Watchlist & Alerts</h3>
          <p className="text-xs text-zinc-600 mt-0.5">
            Auto-checked nightly. Run a check now to verify watched employers immediately.
          </p>
        </div>
        <button data-testid="btn-check-now"
          onClick={() => checkNowMut.mutate()}
          disabled={checkNowMut.isPending || watches.length === 0}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
          {checkNowMut.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5" />}
          {checkNowMut.isPending ? "Checking…" : "Check Now"}
        </button>
      </div>

      {/* Check-now result banner */}
      {checkResult && (
        <div data-testid="check-now-result" className="rounded-xl p-4"
          style={checkResult.up_to_date
            ? { background: `${GREEN}08`, border: `1px solid ${GREEN}25` }
            : { background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {checkResult.up_to_date
                ? <CheckCircle2 className="w-4 h-4" style={{ color: GREEN }} />
                : <BellRing className="w-4 h-4" style={{ color: GOLD }} />}
              <p className="text-sm font-bold" style={{ color: checkResult.up_to_date ? GREEN : GOLD }}>
                {checkResult.up_to_date
                  ? "All up to date — no new filings"
                  : `${checkResult.count} new filing${checkResult.count === 1 ? "" : "s"} detected`}
              </p>
            </div>
            <button data-testid="btn-dismiss-check-result" onClick={() => setCheckResult(null)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {!checkResult.up_to_date && (
            <div className="space-y-2 mt-3">
              {checkResult.new_filings.map((f, i) => (
                <div key={`${f.ein}-${i}`} data-testid={`check-result-filing-${i}`}
                  className="flex items-center justify-between pl-6 text-xs">
                  <span className="text-zinc-300 font-semibold">{f.employer_name}</span>
                  <div className="flex items-center gap-3">
                    {f.highlights?.total_income ? (
                      <span className="text-zinc-500">Income: {fmtMoney(f.highlights.total_income)}</span>
                    ) : null}
                    <span className="font-bold px-1.5 py-0.5 rounded" style={{ background: `${GOLD}20`, color: GOLD }}>
                      {f.filing_year} Filing
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alert feed */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BellRing className="w-4 h-4" style={{ color: GOLD }} />
            <h3 className="text-sm font-bold text-zinc-300">Recent Alerts</h3>
            {newAlerts.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: `${RED}20`, color: RED, border: `1px solid ${RED}30` }}>
                {newAlerts.length} new
              </span>
            )}
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 8).map(alert => (
              <div key={alert.id} data-testid={`alert-${alert.id}`}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}18` }}>
                <div>
                  <div className="flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    <p className="text-sm font-bold text-white">{alert.employer_name}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${GOLD}20`, color: GOLD }}>
                      {alert.filing_year} Filing
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 pl-6">
                    {alert.highlights.total_income && (
                      <span className="text-xs text-zinc-500">Income: {fmtMoney(alert.highlights.total_income)}</span>
                    )}
                    {alert.highlights.broker_commissions && (
                      <span className="text-xs text-zinc-500">Broker: {fmtMoney(alert.highlights.broker_commissions)}</span>
                    )}
                    <span className="text-[10px] text-zinc-600">{new Date(alert.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: alert.status === "sent" ? `${GREEN}15` : `${GOLD}15`, color: alert.status === "sent" ? GREEN : GOLD, border: `1px solid ${alert.status === "sent" ? GREEN : GOLD}25` }}>
                  {alert.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watchlist */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-bold text-zinc-300">Watched Employers</h3>
            <span className="text-xs text-zinc-600">({watches.length})</span>
          </div>
          <button data-testid="btn-add-watch"
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: showAdd ? `${BLUE}20` : "rgba(255,255,255,0.05)", border: `1px solid ${showAdd ? BLUE : "rgba(255,255,255,0.1)"}30`, color: showAdd ? BLUE : "rgba(255,255,255,0.6)" }}>
            <Plus className="w-3.5 h-3.5" /> Add to Watchlist
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="rounded-xl p-4 mb-4" style={{ background: `${BLUE}06`, border: `1px solid ${BLUE}20` }}>
            <h4 className="text-xs font-bold text-zinc-400 mb-3 uppercase tracking-wide">Watch New Employer</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-600 mb-1 block">EIN *</label>
                <Input data-testid="input-watch-ein"
                  value={addForm.ein} onChange={e => setAddForm(f => ({ ...f, ein: e.target.value }))}
                  placeholder="XX-XXXXXXX" className="bg-zinc-900 border-zinc-700 text-white text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 mb-1 block">Employer Name *</label>
                <Input data-testid="input-watch-name"
                  value={addForm.employer_name} onChange={e => setAddForm(f => ({ ...f, employer_name: e.target.value }))}
                  placeholder="Acme Corp" className="bg-zinc-900 border-zinc-700 text-white text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 mb-1 block">State</label>
                <Input data-testid="input-watch-state"
                  value={addForm.employer_state} onChange={e => setAddForm(f => ({ ...f, employer_state: e.target.value }))}
                  placeholder="IN" className="bg-zinc-900 border-zinc-700 text-white text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-600 mb-1 block">Notes</label>
                <Input data-testid="input-watch-notes"
                  value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Renewal in Q3..." className="bg-zinc-900 border-zinc-700 text-white text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button data-testid="btn-confirm-add-watch"
                disabled={!addForm.ein || !addForm.employer_name || addMut.isPending}
                onClick={() => addMut.mutate(addForm)}
                style={{ background: BLUE, color: "#0a0c1e" }} className="font-bold text-sm gap-2">
                {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                Start Watching
              </Button>
              <Button variant="outline" onClick={() => setShowAdd(false)} className="border-zinc-700 text-zinc-400 text-sm">Cancel</Button>
            </div>
          </div>
        )}

        {watchLoading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading watchlist…
          </div>
        ) : watches.length === 0 ? (
          <div className="text-center py-12 rounded-2xl" style={{ border: "1px dashed rgba(255,255,255,0.07)" }}>
            <Bell className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
            <p className="text-sm text-zinc-500 font-semibold">No employers being watched</p>
            <p className="text-xs text-zinc-600 mt-1">Add employers to get alerted when they file new Form 5500s</p>
          </div>
        ) : (
          <div className="space-y-2">
            {watches.map(w => (
              <div key={w.id} data-testid={`watch-entry-${w.id}`}
                ref={w.ein === focusEin ? focusRowRef : undefined}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{
                  background: highlightedEin === w.ein ? `${GOLD}12` : "rgba(255,255,255,0.025)",
                  border: highlightedEin === w.ein ? `1px solid ${GOLD}50` : "1px solid rgba(255,255,255,0.07)",
                  transition: "border-color 0.3s, background 0.3s",
                }}>
                <div>
                  <p className="text-white font-semibold text-sm">{w.employer_name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-zinc-600">EIN: {w.ein}</span>
                    {w.employer_state && <span className="text-xs text-zinc-600">{w.employer_state}</span>}
                    {w.last_seen_year && (
                      <span className="text-[10px] font-semibold" style={{ color: BLUE }}>
                        Last filing: {w.last_seen_year}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {w.last_checked_at && (
                    <span className="text-[10px] text-zinc-600">
                      Checked {new Date(w.last_checked_at).toLocaleDateString()}
                    </span>
                  )}
                  <button data-testid={`btn-remove-watch-${w.id}`}
                    onClick={() => removeMut.mutate(w.id)}
                    className="text-zinc-600 hover:text-red-400 p-1 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="rounded-xl p-4" style={{ background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.15)" }}>
        <div className="flex items-start gap-3">
          <Bell className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: GREEN }} />
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: GREEN }}>Automated Nightly Monitoring</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Every night at 5 AM UTC, the platform checks all watched EINs against the latest DOL Form 5500 database.
              When a new filing is detected, an in-app alert is created and an email is sent to your account email
              (if SMTP is configured). New filings indicate renewal season, plan changes, and broker transitions — your best entry points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RfpIntelligenceOS() {
  // Support deep-linking from Command Center: /rfp-intelligence?tab=pipeline&opp=<id>&ein=<ein>
  const _qs = new URLSearchParams(window.location.search);
  const initialTab = (): Tab => {
    const p = _qs.get("tab");
    if (p === "watchlist" || p === "analyzer" || p === "intel" || p === "pipeline") return p;
    return "pipeline";
  };
  const focusOppId   = _qs.get("opp")  || undefined;
  const focusEin     = _qs.get("ein")  || undefined;

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [pipelinePrefill, setPipelinePrefill] = useState<Partial<OppForm> | undefined>();

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/rfp/alerts"],
    staleTime: 60_000,
  });
  const unreadAlerts = alerts.filter(a => a.status === "queued").length;

  function handleAddToPipeline(prefill: Partial<OppForm>) {
    setPipelinePrefill(prefill);
    setActiveTab("pipeline");
  }

  return (
    <Layout>
      <div className="min-h-screen p-6 space-y-6" style={{ background: "hsl(var(--background))" }}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
                <Radar className="w-5 h-5" style={{ color: GOLD }} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">RFP Intelligence OS</h1>
                <p className="text-sm text-zinc-500">Unified sales command center — pipeline, RFP analysis, prospect intel, watchlist</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadAlerts > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{ background: `${RED}15`, border: `1px solid ${RED}25`, color: RED }}>
                <BellRing className="w-3.5 h-3.5" />
                {unreadAlerts} alert{unreadAlerts > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <button key={tab.key} data-testid={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
                style={{
                  background: isActive ? `${GOLD}15` : "transparent",
                  color: isActive ? GOLD : "rgba(255,255,255,0.4)",
                  border: isActive ? `1px solid ${GOLD}25` : "1px solid transparent",
                }}>
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.key === "watchlist" && unreadAlerts > 0 && (
                  <span className="w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                    style={{ background: RED, color: "white" }}>
                    {unreadAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "pipeline" && (
            <PipelineTab
              prefillForm={pipelinePrefill}
              clearPrefill={() => setPipelinePrefill(undefined)}
              focusOppId={focusOppId}
            />
          )}
          {activeTab === "analyzer" && <AnalyzerTab />}
          {activeTab === "intel" && <IntelTab onAddToPipeline={handleAddToPipeline} />}
          {activeTab === "watchlist" && <WatchlistTab focusEin={focusEin} />}
        </div>
      </div>
    </Layout>
  );
}
