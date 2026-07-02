import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Mic, MicOff, Square, Plus, Search, Clock, CheckCircle2, FileText,
  BrainCircuit, ChevronRight, Trash2, Download, Play, Pause,
  TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target,
  Users, CalendarDays, Timer, Zap, Shield, Activity, DollarSign,
  MessageSquare, BookOpen, ListChecks, FileSearch, Edit3, Check, X,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const GOLD   = "#F5A623";
const RED    = "#FF4D6D";
const GREEN  = "#10B981";
const BLUE   = "#00D4FF";
const PURPLE = "#BF5FFF";
const AMBER  = "#FFB800";
const BORDER = "rgba(255,255,255,0.07)";

// ─── Types ────────────────────────────────────────────────────────────────────
type MeetingStatus = "draft" | "complete" | "analyzing" | "analyzed";
type SentimentType = "bullish" | "neutral" | "cautious" | "bearish" | "concerned";

interface ActionItem {
  item: string;
  assignee: "Advisor" | "Client" | "Both";
  priority: "high" | "medium" | "low";
  due: string;
}

interface PortfolioSignal {
  signal: string;
  type: "risk" | "opportunity" | "rebalance" | "liquidity" | "tax";
  urgency: "immediate" | "near-term" | "long-term";
}

interface AiAnalysis {
  sentiment: SentimentType;
  sentiment_reason: string;
  kiq_score: number;
  key_topics: string[];
  action_items: ActionItem[];
  portfolio_signals: PortfolioSignal[];
  follow_up_recommendations: string[];
  fiduciary_summary: string;
}

interface Meeting {
  id: number;
  title: string;
  client_name: string;
  meeting_type: string;
  date: string;
  duration_mins: number | null;
  status: MeetingStatus;
  transcript: string | null;
  ai_analysis: AiAnalysis | null;
  created_at: string;
  updated_at: string;
}

// ─── Helper utils ─────────────────────────────────────────────────────────────
function sentimentColor(s: SentimentType): string {
  return { bullish: GREEN, neutral: BLUE, cautious: AMBER, bearish: RED, concerned: RED }[s] ?? BLUE;
}

function signalTypeColor(t: string): string {
  return { risk: RED, opportunity: GREEN, rebalance: BLUE, liquidity: AMBER, tax: PURPLE }[t] ?? BLUE;
}

function priorityColor(p: string): string {
  return { high: RED, medium: AMBER, low: GREEN }[p] ?? BLUE;
}

function meetingTypeLabel(t: string): string {
  return { advisory: "Advisory", quarterly: "Quarterly Review", planning: "Planning", onboarding: "Onboarding", review: "Performance Review" }[t] ?? t;
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return d;
  }
}

function statusBadge(s: MeetingStatus) {
  const cfg: Record<MeetingStatus, { label: string; color: string }> = {
    draft:     { label: "Draft",     color: "rgba(255,255,255,0.3)" },
    complete:  { label: "Complete",  color: BLUE },
    analyzing: { label: "Analyzing…", color: AMBER },
    analyzed:  { label: "Analyzed",  color: GREEN },
  };
  const { label, color } = cfg[s] ?? { label: s, color: BORDER };
  return (
    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}12`, border: `1px solid ${color}30` }}>
      {label}
    </span>
  );
}

// ─── New Meeting Dialog ────────────────────────────────────────────────────────
function NewMeetingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Meeting) => void }) {
  const [form, setForm] = useState({ title: "", client_name: "", meeting_type: "advisory", date: new Date().toISOString().slice(0, 10) });
  const { toast } = useToast();
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiRequest("POST", "/api/meetings", body),
    onSuccess: async (res: any) => {
      const meeting = await res.json();
      await qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting created", description: `Session for ${meeting.client_name} is ready.` });
      onCreated(meeting);
    },
    onError: () => toast({ title: "Error", description: "Could not create meeting.", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="rounded-2xl w-full max-w-md p-7 relative" style={{ background: "#0d0d0d", border: `1px solid ${GOLD}30` }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-5">
          <Mic className="w-5 h-5" style={{ color: GOLD }} />
          <h2 className="text-lg font-black text-white">New Meeting Session</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1 block">Session Title</label>
            <input
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
              placeholder="Q2 Portfolio Review"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              data-testid="input-meeting-title"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1 block">Client Name</label>
            <input
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
              placeholder="James Hargrove III"
              value={form.client_name}
              onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              data-testid="input-client-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1 block">Meeting Type</label>
              <select
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
                value={form.meeting_type}
                onChange={e => setForm(f => ({ ...f, meeting_type: e.target.value }))}
                data-testid="select-meeting-type">
                <option value="advisory">Advisory</option>
                <option value="quarterly">Quarterly Review</option>
                <option value="planning">Planning</option>
                <option value="onboarding">Onboarding</option>
                <option value="review">Performance Review</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1 block">Date</label>
              <input
                type="date"
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                data-testid="input-meeting-date"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors text-zinc-400 hover:text-white"
            style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate(form)}
            disabled={!form.title || !form.client_name || createMutation.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all"
            style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40`, color: GOLD, opacity: (!form.title || !form.client_name) ? 0.4 : 1 }}
            data-testid="button-create-meeting">
            {createMutation.isPending ? "Creating…" : "Create Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Recording Simulator ──────────────────────────────────────────────────────
function RecordingBar({ onStop }: { onStop: (secs: number) => void }) {
  const [secs, setSecs] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    ref.current = setInterval(() => {
      if (!paused) setSecs(s => s + 1);
    }, 1000);
    return () => clearInterval(ref.current);
  }, [paused]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-4 px-5 py-3 rounded-xl" style={{ background: `${RED}10`, border: `1px solid ${RED}30` }}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: RED }} />
        <span className="text-sm font-black" style={{ color: RED }}>REC</span>
      </div>
      <span className="text-base font-mono font-black text-white tabular-nums">{fmt(secs)}</span>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={() => setPaused(p => !p)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.6)" }}
          data-testid="button-pause-recording">
          {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>
        <button onClick={() => { clearInterval(ref.current); onStop(secs); }}
          className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
          style={{ background: `${RED}14`, border: `1px solid ${RED}40`, color: RED }}
          data-testid="button-stop-recording">
          <Square className="w-3 h-3 fill-current" /> Stop
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MeetingIntelligence() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [activeTab, setActiveTab] = useState<"transcript" | "analysis" | "actions" | "fiduciary">("transcript");
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [draftTranscript, setDraftTranscript] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const selected = meetings.find(m => m.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setDraftTranscript(selected.transcript ?? "");
    }
  }, [selectedId, selected?.transcript]);

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, any> }) =>
      apiRequest("PATCH", `/api/meetings/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/meetings"] }),
  });

  const analyzeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/meetings/${id}/analyze`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      setActiveTab("analysis");
      toast({ title: "Analysis complete", description: "KIQ™ has analyzed the meeting transcript." });
    },
    onError: () => toast({ title: "Analysis failed", description: "Check that the transcript has content.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/meetings/${id}`),
    onSuccess: () => {
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Meeting deleted" });
    },
  });

  function handleStopRecording(secs: number) {
    setRecording(false);
    if (selected) {
      updateMutation.mutate({ id: selected.id, body: { duration_mins: Math.ceil(secs / 60), status: "complete" } });
    }
    toast({ title: `Recording saved (${Math.ceil(secs / 60)} min)`, description: "Add your transcript notes below." });
  }

  function saveTranscript() {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, body: { transcript: draftTranscript, status: "complete" } });
    setEditingTranscript(false);
    toast({ title: "Transcript saved" });
  }

  const filtered = meetings.filter(m =>
    m.client_name.toLowerCase().includes(search.toLowerCase()) ||
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: "transcript", label: "Transcript", icon: FileText },
    { id: "analysis",   label: "AI Analysis", icon: BrainCircuit },
    { id: "actions",    label: "Action Items", icon: ListChecks },
    { id: "fiduciary",  label: "Fiduciary Summary", icon: Shield },
  ] as const;

  return (
    <Layout>
      <div className="h-full flex flex-col min-h-screen" style={{ background: "#000" }}>

        {/* ── Header ── */}
        <div className="relative overflow-hidden px-8 py-7"
          style={{ background: "linear-gradient(135deg, #000 0%, #06080f 50%, #000 100%)", borderBottom: `1px solid ${GOLD}18` }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(245,166,35,0.05) 0%, transparent 65%)" }} />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Mic className="w-5 h-5" style={{ color: GOLD }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-600">Kincaid IQ · Client Intelligence</span>
              </div>
              <h1 className="text-3xl font-black text-white leading-tight tracking-tight mb-0.5">
                Meeting Intelligence™
                <span className="text-xl font-light ml-3" style={{ color: GOLD }}>— White Label</span>
              </h1>
              <p className="text-zinc-500 text-sm">Capture, transcribe, and analyze every client conversation with fiduciary-grade AI</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <p className="text-xl font-black" style={{ color: GOLD }}>{meetings.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Sessions</p>
              </div>
              <div className="text-center px-4 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                <p className="text-xl font-black" style={{ color: GREEN }}>{meetings.filter(m => m.status === "analyzed").length}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Analyzed</p>
              </div>
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all hover:brightness-110"
                style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}40`, color: GOLD }}
                data-testid="button-new-meeting">
                <Plus className="w-4 h-4" /> New Session
              </button>
            </div>
          </div>
        </div>

        {/* ── Body: 2-panel layout ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: session list ── */}
          <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden"
            style={{ borderRight: `1px solid ${BORDER}` }}>
            <div className="p-4 flex-shrink-0" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                <Search className="w-3.5 h-3.5 text-zinc-600" />
                <input
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 outline-none"
                  placeholder="Search sessions…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-meetings"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-5 h-5 text-zinc-600 animate-spin" />
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <Mic className="w-8 h-8 text-zinc-700 mb-3" />
                  <p className="text-sm font-bold text-zinc-600">No sessions yet</p>
                  <p className="text-xs text-zinc-700 mt-1">Start by creating a new session above</p>
                </div>
              )}
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedId(m.id); setActiveTab("transcript"); setEditingTranscript(false); }}
                  className="w-full text-left px-4 py-3.5 transition-all"
                  style={{
                    background: selectedId === m.id ? "rgba(245,166,35,0.05)" : "transparent",
                    borderBottom: `1px solid ${BORDER}`,
                    borderLeft: selectedId === m.id ? `2px solid ${GOLD}` : "2px solid transparent",
                  }}
                  data-testid={`meeting-list-item-${m.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-white leading-tight">{m.title}</p>
                    {statusBadge(m.status)}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Users className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] text-zinc-500">{m.client_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3 text-zinc-700" />
                      <span className="text-[10px] text-zinc-600">{formatDate(m.date)}</span>
                    </div>
                    {m.duration_mins && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-700" />
                        <span className="text-[10px] text-zinc-600">{m.duration_mins}m</span>
                      </div>
                    )}
                    {m.ai_analysis && (
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" style={{ color: GREEN }} />
                        <span className="text-[10px] font-bold" style={{ color: GREEN }}>{m.ai_analysis.kiq_score}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: meeting detail ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center" style={{ background: "#000" }}>
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
                    <MessageSquare className="w-7 h-7" style={{ color: GOLD }} />
                  </div>
                  <p className="text-lg font-black text-white mb-2">Select a Meeting Session</p>
                  <p className="text-sm text-zinc-600">Choose a session from the list, or create a new one to begin capturing client intelligence.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Detail header */}
                <div className="px-7 py-5 flex-shrink-0"
                  style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)" }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                          style={{ color: BLUE, background: `${BLUE}10`, border: `1px solid ${BLUE}25` }}>
                          {meetingTypeLabel(selected.meeting_type)}
                        </span>
                        {statusBadge(selected.status)}
                      </div>
                      <h2 className="text-xl font-black text-white leading-tight">{selected.title}</h2>
                      <div className="flex items-center gap-4 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-sm text-zinc-400">{selected.client_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-zinc-600" />
                          <span className="text-sm text-zinc-400">{formatDate(selected.date)}</span>
                        </div>
                        {selected.duration_mins && (
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-zinc-600" />
                            <span className="text-sm text-zinc-400">{selected.duration_mins} min</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!recording && (
                        <button
                          onClick={() => setRecording(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                          style={{ background: `${RED}10`, border: `1px solid ${RED}30`, color: RED }}
                          data-testid="button-start-recording">
                          <Mic className="w-3.5 h-3.5" /> Record
                        </button>
                      )}
                      <button
                        onClick={() => { if (confirm("Delete this meeting session?")) deleteMutation.mutate(selected.id); }}
                        className="p-2 rounded-xl text-zinc-600 hover:text-red-400 transition-colors"
                        style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                        data-testid="button-delete-meeting">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {recording && (
                    <div className="mt-4">
                      <RecordingBar onStop={handleStopRecording} />
                    </div>
                  )}
                </div>

                {/* Tab bar */}
                <div className="flex items-center gap-0 flex-shrink-0 px-7"
                  style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.01)" }}>
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold transition-all border-b-2"
                      style={{
                        color: activeTab === tab.id ? GOLD : "rgba(255,255,255,0.35)",
                        borderBottomColor: activeTab === tab.id ? GOLD : "transparent",
                      }}
                      data-testid={`tab-${tab.id}`}>
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {tab.id === "actions" && selected.ai_analysis?.action_items?.length ? (
                        <span className="ml-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: `${RED}15`, color: RED }}>
                          {selected.ai_analysis.action_items.length}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto p-7">

                  {/* TRANSCRIPT TAB */}
                  {activeTab === "transcript" && (
                    <div className="space-y-5 max-w-3xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Meeting Transcript</p>
                          <p className="text-xs text-zinc-600 mt-0.5">Paste notes, type directly, or dictate during recording</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!editingTranscript ? (
                            <button onClick={() => setEditingTranscript(true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.6)" }}
                              data-testid="button-edit-transcript">
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          ) : (
                            <>
                              <button onClick={() => { setEditingTranscript(false); setDraftTranscript(selected.transcript ?? ""); }}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-zinc-500 hover:text-zinc-300"
                                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}>
                                Cancel
                              </button>
                              <button onClick={saveTranscript}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all"
                                style={{ background: `${GREEN}14`, border: `1px solid ${GREEN}40`, color: GREEN }}
                                data-testid="button-save-transcript">
                                <Check className="w-3 h-3" /> Save
                              </button>
                            </>
                          )}
                          {selected.transcript && selected.status !== "analyzed" && (
                            <button
                              onClick={() => analyzeMutation.mutate(selected.id)}
                              disabled={analyzeMutation.isPending || selected.status === "analyzing"}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all"
                              style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}40`, color: GOLD, opacity: analyzeMutation.isPending ? 0.6 : 1 }}
                              data-testid="button-analyze-kiq">
                              <BrainCircuit className="w-3.5 h-3.5" />
                              {analyzeMutation.isPending || selected.status === "analyzing" ? "Analyzing…" : "Analyze with KIQ™"}
                            </button>
                          )}
                          {selected.status === "analyzed" && (
                            <button
                              onClick={() => analyzeMutation.mutate(selected.id)}
                              disabled={analyzeMutation.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                              style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}30`, color: BLUE }}
                              data-testid="button-reanalyze">
                              <RefreshCw className="w-3 h-3" /> Re-analyze
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        readOnly={!editingTranscript}
                        value={editingTranscript ? draftTranscript : (selected.transcript ?? "")}
                        onChange={e => setDraftTranscript(e.target.value)}
                        placeholder="Paste or type the meeting transcript here…

Example:
Advisor: Good morning, Mr. Hargrove. Let's review your Q2 portfolio performance...
Client: I was hoping to discuss rebalancing toward more fixed income...
Advisor: That's a great point. Given the current rate environment, we recommend..."
                        className="w-full h-80 text-sm text-zinc-300 placeholder-zinc-700 outline-none leading-relaxed resize-none rounded-xl px-5 py-4 transition-all"
                        style={{
                          background: editingTranscript ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${editingTranscript ? GOLD + "40" : BORDER}`,
                          fontFamily: "ui-monospace, monospace",
                          fontSize: "12px",
                        }}
                        data-testid="textarea-transcript"
                      />

                      {!selected.transcript && !editingTranscript && (
                        <div className="flex items-center gap-3 p-4 rounded-xl"
                          style={{ background: `${BLUE}07`, border: `1px solid ${BLUE}18` }}>
                          <Lightbulb className="w-4 h-4 flex-shrink-0" style={{ color: BLUE }} />
                          <p className="text-xs text-zinc-500">
                            Click <strong className="text-zinc-400">Edit</strong> to add the transcript, then use <strong className="text-zinc-400">Analyze with KIQ™</strong> to extract insights, action items, and generate a fiduciary summary automatically.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI ANALYSIS TAB */}
                  {activeTab === "analysis" && (
                    <div className="space-y-6 max-w-3xl">
                      {!selected.ai_analysis ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                            style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
                            <BrainCircuit className="w-6 h-6" style={{ color: GOLD }} />
                          </div>
                          <p className="text-base font-black text-white mb-2">No Analysis Yet</p>
                          <p className="text-sm text-zinc-600 max-w-xs">Add a transcript and click "Analyze with KIQ™" to generate AI-powered meeting intelligence.</p>
                          <button
                            onClick={() => setActiveTab("transcript")}
                            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                            style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}40`, color: GOLD }}>
                            <FileText className="w-4 h-4" /> Go to Transcript
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* KIQ Score + Sentiment row */}
                          <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-2xl p-5 col-span-1"
                              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${GOLD}25` }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">KIQ Score</p>
                              <div className="flex items-end gap-2">
                                <span className="text-4xl font-black" style={{ color: GOLD }}>{selected.ai_analysis.kiq_score}</span>
                                <span className="text-sm text-zinc-500 mb-1">/100</span>
                              </div>
                              <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${selected.ai_analysis.kiq_score}%`, background: GOLD }} />
                              </div>
                              <p className="text-[10px] text-zinc-600 mt-1.5">Meeting Effectiveness</p>
                            </div>
                            <div className="rounded-2xl p-5 col-span-2"
                              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${sentimentColor(selected.ai_analysis.sentiment)}25` }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">Client Sentiment</p>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-black capitalize" style={{ color: sentimentColor(selected.ai_analysis.sentiment) }}>
                                  {selected.ai_analysis.sentiment}
                                </span>
                                {selected.ai_analysis.sentiment === "bullish" && <TrendingUp className="w-5 h-5" style={{ color: GREEN }} />}
                                {selected.ai_analysis.sentiment === "bearish" && <TrendingDown className="w-5 h-5" style={{ color: RED }} />}
                                {(selected.ai_analysis.sentiment === "concerned" || selected.ai_analysis.sentiment === "bearish") && <AlertTriangle className="w-4 h-4" style={{ color: RED }} />}
                              </div>
                              <p className="text-sm text-zinc-400">{selected.ai_analysis.sentiment_reason}</p>
                            </div>
                          </div>

                          {/* Key Topics */}
                          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Key Topics Discussed</p>
                            <div className="flex flex-wrap gap-2">
                              {selected.ai_analysis.key_topics.map((t, i) => (
                                <span key={i} className="text-xs font-bold px-3 py-1.5 rounded-lg"
                                  style={{ background: `${BLUE}10`, border: `1px solid ${BLUE}25`, color: BLUE }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Portfolio Signals */}
                          {selected.ai_analysis.portfolio_signals.length > 0 && (
                            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-3">Portfolio Signals</p>
                              <div className="space-y-2">
                                {selected.ai_analysis.portfolio_signals.map((s, i) => (
                                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                                    style={{ background: `${signalTypeColor(s.type)}08`, border: `1px solid ${signalTypeColor(s.type)}20` }}>
                                    <Activity className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: signalTypeColor(s.type) }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white">{s.signal}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{ color: signalTypeColor(s.type), background: `${signalTypeColor(s.type)}15` }}>
                                        {s.type}
                                      </span>
                                      <span className="text-[9px] text-zinc-600">{s.urgency}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Follow-up Recommendations */}
                          {selected.ai_analysis.follow_up_recommendations.length > 0 && (
                            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                              <div className="flex items-center gap-2 mb-3">
                                <Lightbulb className="w-3.5 h-3.5" style={{ color: AMBER }} />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Follow-up Recommendations</p>
                              </div>
                              <div className="space-y-2">
                                {selected.ai_analysis.follow_up_recommendations.map((r, i) => (
                                  <div key={i} className="flex items-start gap-2.5">
                                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: AMBER }} />
                                    <p className="text-sm text-zinc-300">{r}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ACTION ITEMS TAB */}
                  {activeTab === "actions" && (
                    <div className="space-y-4 max-w-3xl">
                      {!selected.ai_analysis?.action_items?.length ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ListChecks className="w-10 h-10 text-zinc-700 mb-3" />
                          <p className="text-base font-black text-white mb-1">No Action Items</p>
                          <p className="text-sm text-zinc-600">Run the KIQ™ analysis to automatically extract action items from the transcript.</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                            {selected.ai_analysis.action_items.length} Action Items Extracted
                          </p>
                          <div className="space-y-2">
                            {selected.ai_analysis.action_items.map((a, i) => (
                              <div key={i} className="flex items-start gap-4 px-5 py-4 rounded-2xl"
                                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: `${priorityColor(a.priority)}14`, border: `1px solid ${priorityColor(a.priority)}30` }}>
                                  <span className="text-[9px] font-black" style={{ color: priorityColor(a.priority) }}>
                                    {i + 1}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-white">{a.item}</p>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <div className="flex items-center gap-1">
                                      <Users className="w-3 h-3 text-zinc-600" />
                                      <span className="text-[10px] text-zinc-500">{a.assignee}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-zinc-600" />
                                      <span className="text-[10px] text-zinc-500">{a.due}</span>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[9px] font-black uppercase px-2 py-1 rounded-lg flex-shrink-0"
                                  style={{ color: priorityColor(a.priority), background: `${priorityColor(a.priority)}12`, border: `1px solid ${priorityColor(a.priority)}25` }}>
                                  {a.priority}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* FIDUCIARY SUMMARY TAB */}
                  {activeTab === "fiduciary" && (
                    <div className="space-y-5 max-w-3xl">
                      {!selected.ai_analysis?.fiduciary_summary ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <Shield className="w-10 h-10 text-zinc-700 mb-3" />
                          <p className="text-base font-black text-white mb-1">No Fiduciary Summary</p>
                          <p className="text-sm text-zinc-600">Run KIQ™ analysis to auto-generate a compliance-ready fiduciary summary.</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Fiduciary Meeting Summary</p>
                              <p className="text-xs text-zinc-700 mt-0.5">AI-generated · Compliance-ready · {formatDate(selected.date)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded"
                                style={{ color: GREEN, background: `${GREEN}10`, border: `1px solid ${GREEN}25` }}>
                                ✓ Fiduciary Grade
                              </span>
                              <button
                                onClick={() => {
                                  const blob = new Blob([
                                    `KINCAID IQ™ — FIDUCIARY MEETING SUMMARY\n\n` +
                                    `Client: ${selected.client_name}\nDate: ${formatDate(selected.date)}\nType: ${meetingTypeLabel(selected.meeting_type)}\n` +
                                    (selected.duration_mins ? `Duration: ${selected.duration_mins} minutes\n` : "") +
                                    `\n─────────────────────────────────────────\n\n` +
                                    selected.ai_analysis!.fiduciary_summary
                                  ], { type: "text/plain" });
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${selected.client_name.replace(/\s+/g, "_")}_${selected.date}_fiduciary_summary.txt`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,0.5)" }}
                                data-testid="button-download-summary">
                                <Download className="w-3 h-3" /> Export
                              </button>
                            </div>
                          </div>
                          <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${GREEN}18` }}>
                            <div className="flex items-center gap-2 mb-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
                              <Shield className="w-4 h-4" style={{ color: GREEN }} />
                              <div>
                                <p className="text-sm font-black text-white">{selected.title}</p>
                                <p className="text-[10px] text-zinc-600">{selected.client_name} · {formatDate(selected.date)}</p>
                              </div>
                            </div>
                            <div className="prose prose-invert max-w-none">
                              {selected.ai_analysis.fiduciary_summary.split("\n").filter(Boolean).map((para, i) => (
                                <p key={i} className="text-sm text-zinc-300 leading-relaxed mb-4 last:mb-0">{para}</p>
                              ))}
                            </div>
                          </div>
                          {selected.ai_analysis.kiq_score && (
                            <div className="flex items-center gap-3 p-4 rounded-xl"
                              style={{ background: `${GOLD}07`, border: `1px solid ${GOLD}15` }}>
                              <Zap className="w-4 h-4 flex-shrink-0" style={{ color: GOLD }} />
                              <p className="text-xs text-zinc-500">
                                KIQ Score: <strong className="font-black" style={{ color: GOLD }}>{selected.ai_analysis.kiq_score}/100</strong> · Client Sentiment: <strong className="font-bold capitalize" style={{ color: sentimentColor(selected.ai_analysis.sentiment) }}>{selected.ai_analysis.sentiment}</strong>
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNew && (
        <NewMeetingModal
          onClose={() => setShowNew(false)}
          onCreated={(m) => { setShowNew(false); setSelectedId(m.id); }}
        />
      )}
    </Layout>
  );
}
