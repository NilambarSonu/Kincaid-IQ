import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Building2, Users, DollarSign, CheckCircle2, XCircle,
  AlertCircle, Copy, Trash2, ExternalLink, Search, Filter,
  RefreshCw, Loader2, UserCheck, StickyNote, ChevronDown,
  Globe, MapPin, Zap,
} from "lucide-react";

const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";

const STATUS_OPTIONS = ["new", "contacted", "replied", "converted", "archived"] as const;
type ContactStatus = typeof STATUS_OPTIONS[number];

type Contact = {
  id: number;
  ein: string | null;
  employer_name: string;
  plan_name: string | null;
  city: string | null;
  state: string | null;
  participants: number | null;
  welfare_premiums: number | null;
  domain: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  position: string | null;
  confidence: number | null;
  verification_result: string | null;
  verification_score: number | null;
  outreach_subject: string | null;
  outreach_body: string | null;
  status: ContactStatus;
  notes: string | null;
  discovered_at: string | null;
};

const STATUS_META: Record<ContactStatus, { label: string; color: string; bg: string; border: string }> = {
  new:       { label: "New",       color: "#60a5fa", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)"  },
  contacted: { label: "Contacted", color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  replied:   { label: "Replied",   color: "#a855f7", bg: "rgba(168,85,247,0.12)",  border: "rgba(168,85,247,0.3)"  },
  converted: { label: "Converted", color: "#10b981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  archived:  { label: "Archived",  color: "#64748b", bg: "#ffffff", border: "#cbd5e1" },
};

function VerBadge({ result }: { result: string | null }) {
  if (!result) return null;
  if (result === "deliverable") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 99, fontSize: 9, fontWeight: 800, background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
      <CheckCircle2 size={9} /> Deliverable
    </span>
  );
  if (result === "invalid") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 99, fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
      <XCircle size={9} /> Invalid
    </span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 99, fontSize: 9, fontWeight: 800, background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
      <AlertCircle size={9} /> {result}
    </span>
  );
}

export default function ContactsDatabase() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadContacts() {
    setLoading(true);
    try {
      const resp = await fetch("/api/contact-intel/contacts?limit=200");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setContacts(await resp.json());
      setLoaded(true);
    } catch (e: any) {
      toast({ title: "Failed to load contacts", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function updateStatus(id: number, status: ContactStatus) {
    setUpdatingId(id);
    try {
      const resp = await fetch(`/api/contact-intel/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally { setUpdatingId(null); }
  }

  async function saveNotes(id: number) {
    try {
      const resp = await fetch(`/api/contact-intel/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesDraft }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setContacts(prev => prev.map(c => c.id === id ? { ...c, notes: notesDraft } : c));
      setEditingNotes(null);
      toast({ title: "Notes saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  }

  async function deleteContact(id: number) {
    try {
      const resp = await fetch(`/api/contact-intel/contacts/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setContacts(prev => prev.filter(c => c.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast({ title: "Contact removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  function copyEmail(id: number, email: string) {
    navigator.clipboard.writeText(email);
    setCopiedEmail(id);
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  const filtered = contacts.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.employer_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.first_name || "").toLowerCase().includes(q) ||
      (c.last_name || "").toLowerCase().includes(q) ||
      (c.state || "").toLowerCase().includes(q) ||
      (c.position || "").toLowerCase().includes(q)
    );
  });

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = contacts.filter(c => c.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)", padding: "32px 32px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
              <UserCheck size={12} color={BB_CRIMSON} />
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid Health · Contacts Database</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0F172A", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              Contact Intelligence™ Database
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", margin: 0 }}>
              All discovered prospects saved from Contact Intelligence™ runs — track outreach status, view AI drafts, and manage your pipeline.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => navigate("/contact-intel")}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.3)", color: BB_CRIMSON, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <Zap size={13} /> Discover More
            </button>
            <button
              data-testid="btn-load-contacts"
              onClick={loadContacts}
              disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1525 100%)`, border: "none", color: "#0F172A", fontSize: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={13} />}
              {loaded ? "Refresh" : "Load Contacts"}
            </button>
          </div>
        </div>

        {!loaded && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 16, textAlign: "center" }}>
            <UserCheck size={52} color="#e2e8f0" />
            <div style={{ fontSize: 15, fontWeight: 700, color: "#475569" }}>No contacts loaded yet</div>
            <div style={{ fontSize: 12, color: "rgba(15,23,42,0.08)", maxWidth: 360 }}>
              Contacts are automatically saved when you run a discovery on the Contact Intelligence™ page. Click "Load Contacts" to view them here.
            </div>
            <button
              onClick={loadContacts}
              style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 12, background: `linear-gradient(135deg, ${BB_CRIMSON} 0%, #7a1525 100%)`, border: "none", color: "#0F172A", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >
              <RefreshCw size={14} /> Load Contacts
            </button>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
            <Loader2 size={28} color={BB_CRIMSON} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 14, color: "#475569" }}>Loading contacts…</span>
          </div>
        )}

        {loaded && !loading && (
          <>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total", value: contacts.length, color: "#0F172A" },
                ...STATUS_OPTIONS.map(s => ({ label: STATUS_META[s].label, value: counts[s], color: STATUS_META[s].color }))
              ].map(stat => (
                <div key={stat.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                <input
                  data-testid="contacts-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, company, email, state, title…"
                  style={{ width: "100%", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "9px 12px 9px 34px", color: "#0F172A", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 4, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 4 }}>
                {["all", ...STATUS_OPTIONS].map(s => {
                  const meta = s === "all" ? { label: "All", color: "#0F172A" } : STATUS_META[s as ContactStatus];
                  const isActive = statusFilter === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{ padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: isActive ? `1px solid ${meta.color}40` : "1px solid transparent", background: isActive ? `${meta.color}18` : "transparent", color: isActive ? meta.color : "#64748b" }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{filtered.length} contacts</span>
            </div>

            {contacts.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px", background: "#ffffff", border: "1px dashed #e2e8f0", borderRadius: 16 }}>
                <Mail size={36} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#64748b" }}>No contacts saved yet</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
                  Run a discovery on the Contact Intelligence™ page — the best contact is saved here automatically.
                </div>
                <button
                  onClick={() => navigate("/contact-intel")}
                  style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "rgba(155,28,46,0.15)", border: "1px solid rgba(155,28,46,0.3)", color: BB_CRIMSON, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <Zap size={13} /> Go to Contact Intelligence™
                </button>
              </div>
            )}

            {filtered.length === 0 && contacts.length > 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", fontSize: 13 }}>
                No contacts match your filters.
              </div>
            )}

            {/* Contact rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(c => {
                const sm = STATUS_META[c.status] || STATUS_META.new;
                const isExpanded = expandedId === c.id;
                const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <div key={c.id} data-testid={`contact-row-${c.id}`} style={{ background: "#ffffff", border: `1px solid ${isExpanded ? "rgba(155,28,46,0.3)" : "#e2e8f0"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.15s" }}>

                    {/* Main row */}
                    <div
                      style={{ display: "grid", gridTemplateColumns: "36px 1fr 220px 140px 120px 120px", gap: 12, alignItems: "center", padding: "14px 18px", cursor: "pointer" }}
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      {/* Avatar */}
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${BB_CRIMSON}, #7a1525)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#0F172A" }}>
                          {((c.first_name?.[0] || "") + (c.last_name?.[0] || "")) || c.email[0].toUpperCase()}
                        </span>
                      </div>

                      {/* Name + company */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>{fullName}</div>
                        <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.position ? `${c.position} · ` : ""}{c.employer_name}
                        </div>
                      </div>

                      {/* Email */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#60a5fa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.email}</div>
                        <div style={{ marginTop: 3 }}><VerBadge result={c.verification_result} /></div>
                      </div>

                      {/* Plan stats */}
                      <div>
                        <div style={{ fontSize: 11, color: "#334155", marginBottom: 2 }}>
                          {c.state ? <><MapPin size={10} style={{ verticalAlign: "middle", marginRight: 3 }} />{c.state}</> : "—"}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>
                          {c.participants ? `${c.participants.toLocaleString()} lives` : "—"}
                        </div>
                      </div>

                      {/* Status badge */}
                      <div onClick={e => e.stopPropagation()}>
                        <select
                          data-testid={`status-select-${c.id}`}
                          value={c.status}
                          onChange={e => updateStatus(c.id, e.target.value as ContactStatus)}
                          style={{ background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 8, color: sm.color, fontSize: 10, fontWeight: 800, padding: "4px 8px", cursor: "pointer", outline: "none", appearance: "none", paddingRight: 20, position: "relative" }}
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s} style={{ background: "#F8FAFC" }}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                        {updatingId === c.id && <Loader2 size={10} style={{ marginLeft: 6, animation: "spin 1s linear infinite", color: "#475569", verticalAlign: "middle" }} />}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }} onClick={e => e.stopPropagation()}>
                        <button
                          data-testid={`btn-copy-contact-email-${c.id}`}
                          title="Copy email"
                          onClick={() => copyEmail(c.id, c.email)}
                          style={{ padding: "6px 8px", borderRadius: 7, background: copiedEmail === c.id ? "rgba(16,185,129,0.15)" : "#f8fafc", border: copiedEmail === c.id ? "1px solid rgba(16,185,129,0.3)" : "1px solid #e2e8f0", color: copiedEmail === c.id ? "#10b981" : "#475569", cursor: "pointer" }}
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          data-testid={`btn-delete-contact-${c.id}`}
                          title="Delete"
                          onClick={() => deleteContact(c.id)}
                          style={{ padding: "6px 8px", borderRadius: 7, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", color: "rgba(239,68,68,0.6)", cursor: "pointer" }}
                        >
                          <Trash2 size={11} />
                        </button>
                        <div style={{ display: "flex", alignItems: "center", color: "#94a3b8", paddingLeft: 4 }}>
                          <ChevronDown size={14} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: "1px solid #f1f5f9", padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

                        {/* Company info */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>Plan Sponsor</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <InfoRow icon={<Building2 size={11} />} label="Employer" val={c.employer_name} />
                            <InfoRow icon={<Globe size={11} />} label="Domain" val={c.domain || "—"} />
                            <InfoRow icon={<MapPin size={11} />} label="Location" val={[c.city, c.state].filter(Boolean).join(", ") || "—"} />
                            <InfoRow icon={<Users size={11} />} label="Covered Lives" val={c.participants ? c.participants.toLocaleString() : "—"} />
                            <InfoRow icon={<DollarSign size={11} />} label="Welfare Premiums" val={c.welfare_premiums ? `$${(c.welfare_premiums / 1000).toFixed(0)}K` : "—"} />
                            {c.ein && <InfoRow icon={<span style={{ fontSize: 9 }}>EIN</span>} label="EIN" val={c.ein} />}
                          </div>
                        </div>

                        {/* Outreach draft */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>Outreach Draft</div>
                          {c.outreach_subject && (
                            <div style={{ fontSize: 11, fontStyle: "italic", color: "#334155", marginBottom: 8, padding: "6px 10px", background: "#ffffff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                              "{c.outreach_subject}"
                            </div>
                          )}
                          {c.outreach_body ? (
                            <div style={{ position: "relative" }}>
                              <pre style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "inherit", lineHeight: 1.6, maxHeight: 140, overflowY: "auto", padding: "10px 12px", background: "rgba(0,0,0,0.05)", borderRadius: 8, border: "1px solid #f1f5f9" }}>
                                {c.outreach_body}
                              </pre>
                              <button
                                onClick={() => { navigator.clipboard.writeText(c.outreach_body!); toast({ title: "Email body copied" }); }}
                                style={{ position: "absolute", top: 6, right: 6, padding: "3px 8px", borderRadius: 5, background: "#f1f5f9", border: "1px solid #cbd5e1", color: "#64748b", fontSize: 9, fontWeight: 700, cursor: "pointer" }}
                              >
                                <Copy size={9} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>No draft available</div>
                          )}
                        </div>

                        {/* Notes */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#64748b", marginBottom: 10 }}>Notes</div>
                          {editingNotes === c.id ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <textarea
                                value={notesDraft}
                                onChange={e => setNotesDraft(e.target.value)}
                                autoFocus
                                placeholder="Add notes about this prospect…"
                                style={{ width: "100%", minHeight: 100, background: "#f8fafc", border: "1px solid rgba(155,28,46,0.4)", borderRadius: 8, padding: "8px 10px", color: "#0F172A", fontSize: 12, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => saveNotes(c.id)} style={{ flex: 1, padding: "7px 12px", borderRadius: 8, background: BB_CRIMSON, border: "none", color: "#0F172A", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                                <button onClick={() => setEditingNotes(null)} style={{ padding: "7px 12px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#334155", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => { setEditingNotes(c.id); setNotesDraft(c.notes || ""); }}
                              style={{ minHeight: 80, padding: "8px 10px", background: "#ffffff", border: "1px dashed #e2e8f0", borderRadius: 8, cursor: "text", fontSize: 11, color: c.notes ? "rgba(255,255,255,0.55)" : "#94a3b8", lineHeight: 1.6 }}
                            >
                              {c.notes || "Click to add notes…"}
                            </div>
                          )}
                          <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 8 }}>
                            Discovered {c.discovered_at ? new Date(c.discovered_at).toLocaleDateString() : "—"}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Layout>
  );
}

function InfoRow({ icon, label, val }: { icon: any; label: string; val: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ color: "rgba(15,23,42,0.08)", display: "flex", alignItems: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 10, color: "#64748b", flexShrink: 0, minWidth: 80 }}>{label}</span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val}</span>
    </div>
  );
}
