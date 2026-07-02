import { useState } from "react";
import { Layout } from "@/components/Layout";
import { conciergeRequests } from "@/lib/mockData";
import { Plane, Home, Palette, Scale, DollarSign, UtensilsCrossed, Map, Heart, Plus, X, CheckCircle, Clock, AlertTriangle, CircleDot, Search } from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  Aviation:  { icon: Plane,         color: "#00E5FF", bg: "rgba(0,229,255,0.08)", border: "rgba(0,229,255,0.2)" },
  Property:  { icon: Home,          color: "#FFB800", bg: "rgba(255,184,0,0.08)", border: "rgba(255,184,0,0.2)" },
  Art:       { icon: Palette,       color: "#A855F7", bg: "rgba(168,85,247,0.08)", border: "rgba(168,85,247,0.2)" },
  Legal:     { icon: Scale,         color: "#00A8FF", bg: "rgba(0,168,255,0.08)", border: "rgba(0,168,255,0.2)" },
  Finance:   { icon: DollarSign,    color: "#00FF94", bg: "rgba(0,255,148,0.08)", border: "rgba(0,255,148,0.2)" },
  Travel:    { icon: Map,           color: "#FF8C00", bg: "rgba(255,140,0,0.08)", border: "rgba(255,140,0,0.2)" },
  Medical:   { icon: Heart,         color: "#FF4D6D", bg: "rgba(255,77,109,0.08)", border: "rgba(255,77,109,0.2)" },
};
const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  "Open":        { color: "#00A8FF", bg: "rgba(0,168,255,0.08)", icon: CircleDot },
  "In Progress": { color: "#FFB800", bg: "rgba(255,184,0,0.08)", icon: Clock },
  "Pending":     { color: "#A855F7", bg: "rgba(168,85,247,0.08)", icon: Clock },
  "Completed":   { color: "#00FF94", bg: "rgba(0,255,148,0.08)", icon: CheckCircle },
};
const PRIORITY_COLORS: Record<string, string> = { Critical: "#FF4D6D", High: "#FFB800", Medium: "#00A8FF", Low: "rgba(150,170,210,0.4)" };
const CATEGORIES = Object.keys(CATEGORY_CONFIG);
const STATUSES = Object.keys(STATUS_CONFIG);
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export default function Concierge() {
  const [requests, setRequests] = useState(conciergeRequests);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", category: "Aviation", priority: "Medium", notes: "", assignee: "", dueDate: "" });

  const filtered = requests.filter(r => {
    const matchStatus = statusFilter === "All" || r.status === statusFilter;
    const matchCat = categoryFilter === "All" || r.category === categoryFilter;
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.notes.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchCat && matchSearch;
  });

  const addRequest = () => {
    if (!form.title) return;
    const newReq = {
      id: requests.length + 1,
      ...form,
      status: "Open",
      created: new Date().toISOString().split("T")[0],
      requestor: "Jeremiah Shrack",
    };
    setRequests([newReq, ...requests]);
    setForm({ title: "", category: "Aviation", priority: "Medium", notes: "", assignee: "", dueDate: "" });
    setShowForm(false);
  };

  const updateStatus = (id: number, status: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const openCount = requests.filter(r => r.status === "Open" || r.status === "In Progress").length;
  const criticalCount = requests.filter(r => r.priority === "Critical" && r.status !== "Completed").length;

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
              Concierge Request Board
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Family office task board — aviation, property, art, legal, finance, travel, medical</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.25)", color: "#00E5FF" }}
            data-testid="button-new-request">
            <Plus size={13} /> New Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open / Active", value: `${openCount}`, color: "#FFB800" },
          { label: "Critical", value: `${criticalCount}`, color: "#FF4D6D" },
          { label: "Completed", value: `${requests.filter(r=>r.status==="Completed").length}`, color: "#00FF94" },
          { label: "Total", value: `${requests.length}`, color: "#00A8FF" },
        ].map((c) => (
          <div key={c.label} className="metric-card" style={{ borderTop: `2px solid ${c.color}` }}
            data-testid={`card-concierge-${c.label.toLowerCase().replace(/\s+/g,"-")}`}>
            <p className="section-label mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="metric-card mb-6" style={{ border: "1px solid rgba(0,229,255,0.2)" }} data-testid="card-new-request-form">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm text-white">New Request</p>
            <button onClick={() => setShowForm(false)} style={{ color: "rgba(130,150,200,0.4)" }} data-testid="button-close-form"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Describe the request…" className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-request-title" />
            </div>
            {[
              { key: "category", label: "Category", options: CATEGORIES },
              { key: "priority", label: "Priority", options: PRIORITIES },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                <select value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full text-sm px-3 py-2 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                  data-testid={`select-${f.key}`}>
                  {f.options.map(o => <option key={o} value={o} style={{ background: "#0a0a1a" }}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}
                placeholder="e.g., DH (Family Office)" className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-assignee" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-due-date" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Additional context…" rows={2} className="w-full text-sm px-3 py-2 rounded-lg resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white" }}
                data-testid="input-request-notes" />
            </div>
          </div>
          <button onClick={addRequest} disabled={!form.title}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: form.title ? "rgba(0,229,255,0.1)" : "rgba(0,229,255,0.03)", border: "1px solid rgba(0,229,255,0.25)", color: form.title ? "#00E5FF" : "rgba(0,229,255,0.3)", cursor: form.title ? "pointer" : "not-allowed" }}
            data-testid="button-submit-request">
            Submit Request
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(130,150,200,0.4)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests…"
            className="w-full text-sm pl-8 pr-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
            data-testid="input-concierge-search" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...STATUSES].map(s => {
            const sc = s !== "All" ? STATUS_CONFIG[s] : null;
            return <button key={s} onClick={() => setStatusFilter(s)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: statusFilter === s ? (sc?.bg || "rgba(0,168,255,0.1)") : "rgba(255,255,255,0.03)", border: `1px solid ${statusFilter === s ? (sc?.color ? `${sc.color}44` : "rgba(0,168,255,0.25)") : "rgba(255,255,255,0.06)"}`, color: statusFilter === s ? (sc?.color || "#00A8FF") : "rgba(150,170,210,0.5)" }}
              data-testid={`filter-status-${s.toLowerCase().replace(/\s+/g,"-")}`}>{s}</button>;
          })}
          {["All", ...CATEGORIES].map(c => {
            const cc = c !== "All" ? CATEGORY_CONFIG[c] : null;
            return <button key={c} onClick={() => setCategoryFilter(c)}
              className="text-xs px-2 py-1 rounded-lg transition-all"
              style={{ background: categoryFilter === c ? (cc?.bg || "rgba(0,168,255,0.1)") : "rgba(255,255,255,0.02)", border: `1px solid ${categoryFilter === c ? (cc?.border || "rgba(0,168,255,0.25)") : "rgba(255,255,255,0.04)"}`, color: categoryFilter === c ? (cc?.color || "#00A8FF") : "rgba(150,170,210,0.4)" }}
              data-testid={`filter-cat-${c.toLowerCase()}`}>{c}</button>;
          })}
        </div>
      </div>

      <div className="space-y-2.5" data-testid="list-requests">
        {filtered.map(req => {
          const cc = CATEGORY_CONFIG[req.category] || CATEGORY_CONFIG.Property;
          const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.Open;
          const Icon = cc.icon;
          const StatusIcon = sc.icon;
          const priorityColor = PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.Low;
          const isCompleted = req.status === "Completed";
          return (
            <div key={req.id}
              className="metric-card transition-all"
              style={{ opacity: isCompleted ? 0.65 : 1, borderLeft: `3px solid ${isCompleted ? "rgba(0,255,148,0.3)" : priorityColor}`, cursor: "default" }}
              data-testid={`row-request-${req.id}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cc.bg, border: `1px solid ${cc.border}` }}>
                  <Icon size={13} style={{ color: cc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-bold text-sm ${isCompleted ? "line-through text-muted-foreground" : "text-white"}`}>{req.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{req.notes}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: priorityColor, background: `${priorityColor}10`, border: `1px solid ${priorityColor}25` }}>{req.priority}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: sc.bg, color: sc.color }}><StatusIcon size={8} />{req.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="font-semibold px-1.5 py-0.5 rounded" style={{ background: cc.bg, color: cc.color }}>{req.category}</span>
                    {req.assignee && <span>→ {req.assignee}</span>}
                    <span>Created {req.created}</span>
                    {req.dueDate && <span className="font-semibold" style={{ color: "#FFB800" }}>Due {req.dueDate}</span>}
                    <span>By {req.requestor}</span>
                    <div className="ml-auto flex gap-1">
                      {STATUSES.filter(s => s !== req.status).map(s => (
                        <button key={s} onClick={() => updateStatus(req.id, s)}
                          className="text-[9px] px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                          style={{ background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color, border: `1px solid ${STATUS_CONFIG[s].color}30` }}
                          data-testid={`set-status-${req.id}-${s.toLowerCase().replace(/\s+/g,"-")}`}>
                          → {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="metric-card flex items-center justify-center py-16" data-testid="empty-requests">
            <p className="text-xs text-muted-foreground">No requests match your filters</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
