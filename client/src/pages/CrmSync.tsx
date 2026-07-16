import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, Send, Users,
  Building2, DollarSign, ArrowRight, AlertCircle, Zap,
  BarChart3, Database, Link2, Plus, ChevronDown, ChevronUp,
  ExternalLink, UserCheck,
} from "lucide-react";

const BB_CRIMSON = "#9B1C2E";
const BB_NAVY = "#002B5C";
const HS_ORANGE = "#ff7a59";
const SF_BLUE = "#00a1e0";

type CrmStatus = {
  hubspot: { configured: boolean; detail: string };
  salesforce: { configured: boolean; detail: string };
};

type HsContact = {
  id: string; email: string; first_name: string; last_name: string;
  company: string; job_title: string; state: string; created: string;
};

type HsDeal = {
  id: string; name: string; amount: string | null; stage: string;
  close_date: string; created: string;
};

type SfLead = {
  id: string; email: string; first_name: string; last_name: string;
  company: string; title: string; state: string; employees: number | null;
  status: string; created: string;
};

type DiscoveredContact = {
  id: number; employer_name: string; email: string; first_name: string | null;
  last_name: string | null; position: string | null; state: string | null;
  participants: number | null; welfare_premiums: number | null; status: string;
};

const STAGE_LABELS: Record<string, string> = {
  appointmentscheduled: "Appointment Scheduled",
  qualifiedtobuy: "Qualified to Buy",
  presentationscheduled: "Presentation Scheduled",
  decisionmakerboughtin: "Decision Maker Bought In",
  contractsent: "Contract Sent",
  closedwon: "Closed Won",
  closedlost: "Closed Lost",
};

export default function CrmSync() {
  const { toast } = useToast();
  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [hsContacts, setHsContacts] = useState<HsContact[]>([]);
  const [hsDeals, setHsDeals] = useState<HsDeal[]>([]);
  const [sfLeads, setSfLeads] = useState<SfLead[]>([]);
  const [discoveredContacts, setDiscoveredContacts] = useState<DiscoveredContact[]>([]);

  const [hsContactsLoading, setHsContactsLoading] = useState(false);
  const [hsDealsLoading, setHsDealsLoading] = useState(false);
  const [sfLeadsLoading, setSfLeadsLoading] = useState(false);
  const [discLoading, setDiscLoading] = useState(false);

  const [pushingContactId, setPushingContactId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"hubspot" | "salesforce">("hubspot");
  const [showPushPanel, setShowPushPanel] = useState(false);

  const [dealForm, setDealForm] = useState({ deal_name: "", amount: "", stage: "appointmentscheduled" });
  const [creatingDeal, setCreatingDeal] = useState(false);

  useEffect(() => { loadStatus(); loadDiscovered(); }, []);

  async function loadStatus() {
    setStatusLoading(true);
    try {
      const resp = await fetch("/api/crm/status");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStatus(await resp.json());
    } catch (e: any) {
      toast({ title: "Failed to load CRM status", description: e.message, variant: "destructive" });
    } finally { setStatusLoading(false); }
  }

  async function loadDiscovered() {
    setDiscLoading(true);
    try {
      const resp = await fetch("/api/contact-intel/contacts?limit=50");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setDiscoveredContacts(await resp.json());
    } catch { } finally { setDiscLoading(false); }
  }

  async function loadHsContacts() {
    setHsContactsLoading(true);
    try {
      const resp = await fetch("/api/crm/hubspot/contacts?limit=20");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setHsContacts(data.contacts || []);
    } catch (e: any) {
      toast({ title: "HubSpot contacts failed", description: e.message, variant: "destructive" });
    } finally { setHsContactsLoading(false); }
  }

  async function loadHsDeals() {
    setHsDealsLoading(true);
    try {
      const resp = await fetch("/api/crm/hubspot/deals?limit=20");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setHsDeals(data.deals || []);
    } catch (e: any) {
      toast({ title: "HubSpot deals failed", description: e.message, variant: "destructive" });
    } finally { setHsDealsLoading(false); }
  }

  async function loadSfLeads() {
    setSfLeadsLoading(true);
    try {
      const resp = await fetch("/api/crm/salesforce/leads?limit=20");
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setSfLeads(data.leads || []);
    } catch (e: any) {
      toast({ title: "Salesforce leads failed", description: e.message, variant: "destructive" });
    } finally { setSfLeadsLoading(false); }
  }

  async function pushToHubSpot(contact: DiscoveredContact) {
    setPushingContactId(contact.id);
    try {
      const resp = await fetch("/api/crm/hubspot/push-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contact.id,
          email: contact.email,
          first_name: contact.first_name || "",
          last_name: contact.last_name || "",
          company: contact.employer_name,
          job_title: contact.position || "",
          state: contact.state || "",
          participants: contact.participants,
          welfare_premiums: contact.welfare_premiums,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      toast({ title: `HubSpot: ${data.action === "created" ? "Contact created" : "Contact updated"}`, description: contact.email });
      setDiscoveredContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: "contacted" } : c));
    } catch (e: any) {
      toast({ title: "HubSpot push failed", description: e.message, variant: "destructive" });
    } finally { setPushingContactId(null); }
  }

  async function pushToSalesforce(contact: DiscoveredContact) {
    setPushingContactId(contact.id);
    try {
      const resp = await fetch("/api/crm/salesforce/push-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contact.id,
          email: contact.email,
          first_name: contact.first_name || "",
          last_name: contact.last_name || "Unknown",
          company: contact.employer_name,
          title: contact.position || "",
          state: contact.state || "",
          participants: contact.participants,
          welfare_premiums: contact.welfare_premiums,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      toast({ title: `Salesforce: Lead ${data.action}`, description: contact.email });
      setDiscoveredContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: "contacted" } : c));
    } catch (e: any) {
      toast({ title: "Salesforce push failed", description: e.message, variant: "destructive" });
    } finally { setPushingContactId(null); }
  }

  async function createDeal() {
    if (!dealForm.deal_name.trim()) return;
    setCreatingDeal(true);
    try {
      const resp = await fetch("/api/crm/hubspot/push-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_name: dealForm.deal_name,
          amount: dealForm.amount ? parseFloat(dealForm.amount) : null,
          stage: dealForm.stage,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      toast({ title: "Deal created in HubSpot", description: dealForm.deal_name });
      setDealForm({ deal_name: "", amount: "", stage: "appointmentscheduled" });
      setShowPushPanel(false);
      loadHsDeals();
    } catch (e: any) {
      toast({ title: "Deal creation failed", description: e.message, variant: "destructive" });
    } finally { setCreatingDeal(false); }
  }

  const StatusBadge = ({ configured, detail }: { configured: boolean; detail: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: configured ? "rgba(16,185,129,0.08)" : "#ffffff", border: `1px solid ${configured ? "rgba(16,185,129,0.25)" : "#e2e8f0"}` }}>
      {configured ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#64748b" />}
      <span style={{ fontSize: 11, color: configured ? "#10b981" : "#64748b", fontWeight: 600 }}>{detail}</span>
    </div>
  );

  return (
    <Layout>
      <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#F8FAFC 0%,#FFFFFF 50%,#F8FAFC 100%)", padding: "32px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(155,28,46,0.12)", border: "1px solid rgba(155,28,46,0.35)", borderRadius: 100, padding: "5px 16px", marginBottom: 16 }}>
            <Link2 size={12} color={BB_CRIMSON} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: BB_CRIMSON }}>Kincaid Health · CRM Sync</span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0F172A", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
            CRM Integration Hub
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.40)", margin: 0 }}>
            Push Contact Intelligence™ prospects directly into HubSpot and Salesforce — one click to sync, auto-updates local status.
          </p>
        </div>

        {/* Connection status cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          {/* HubSpot card */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,122,89,0.2)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `rgba(255,122,89,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: HS_ORANGE }}>HS</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>HubSpot CRM</div>
                <div style={{ fontSize: 11, color: "#475569" }}>OAuth via Replit Connectors</div>
              </div>
              {statusLoading ? <Loader2 size={14} color="#64748b" style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} /> :
                status && <div style={{ marginLeft: "auto" }}><StatusBadge configured={status.hubspot.configured} detail={status.hubspot.detail} /></div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setActiveTab("hubspot"); loadHsContacts(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(255,122,89,0.1)", border: "1px solid rgba(255,122,89,0.2)", color: HS_ORANGE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                <Users size={11} style={{ display: "inline", marginRight: 5 }} />Contacts
              </button>
              <button
                onClick={() => { setActiveTab("hubspot"); loadHsDeals(); }}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(255,122,89,0.1)", border: "1px solid rgba(255,122,89,0.2)", color: HS_ORANGE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                <BarChart3 size={11} style={{ display: "inline", marginRight: 5 }} />Deals
              </button>
              <button
                onClick={() => setShowPushPanel(v => !v)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(255,122,89,0.15)", border: "1px solid rgba(255,122,89,0.35)", color: HS_ORANGE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                <Plus size={11} style={{ display: "inline", marginRight: 5 }} />New Deal
              </button>
            </div>
          </div>

          {/* Salesforce card */}
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(0,161,224,0.2)", borderRadius: 16, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `rgba(0,161,224,0.12)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: SF_BLUE }}>SF</span>
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Salesforce</div>
                <div style={{ fontSize: 11, color: "#475569" }}>Username + Password + Security Token</div>
              </div>
              {statusLoading ? <Loader2 size={14} color="#64748b" style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} /> :
                status && <div style={{ marginLeft: "auto" }}><StatusBadge configured={status.salesforce.configured} detail={status.salesforce.detail} /></div>}
            </div>
            {status && !status.salesforce.configured ? (
              <div style={{ padding: "12px 14px", background: "rgba(0,161,224,0.06)", border: "1px solid rgba(0,161,224,0.15)", borderRadius: 10, fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                To connect Salesforce, add these secrets in your project settings:
                <br /><code style={{ color: SF_BLUE }}>SALESFORCE_USERNAME</code>, <code style={{ color: SF_BLUE }}>SALESFORCE_PASSWORD</code>,{" "}
                <code style={{ color: SF_BLUE }}>SALESFORCE_SECURITY_TOKEN</code>
                <br /><span style={{ color: "#64748b", fontSize: 10 }}>Optional: SALESFORCE_DOMAIN (default: login)</span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setActiveTab("salesforce"); loadSfLeads(); }}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, background: "rgba(0,161,224,0.1)", border: "1px solid rgba(0,161,224,0.2)", color: SF_BLUE, fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  <Users size={11} style={{ display: "inline", marginRight: 5 }} />View Leads
                </button>
              </div>
            )}
          </div>
        </div>

        {/* New Deal panel */}
        {showPushPanel && (
          <div style={{ background: "rgba(255,122,89,0.05)", border: "1px solid rgba(255,122,89,0.2)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: HS_ORANGE, marginBottom: 14 }}>Create HubSpot Deal</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 200px 120px", gap: 10, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 5 }}>Deal Name *</label>
                <input
                  value={dealForm.deal_name}
                  onChange={e => setDealForm(f => ({ ...f, deal_name: e.target.value }))}
                  placeholder="e.g. Horizon Bancorp — Benefits Audit"
                  style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", color: "#0F172A", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 5 }}>Amount ($)</label>
                <input
                  value={dealForm.amount}
                  onChange={e => setDealForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 145000"
                  type="number"
                  style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", color: "#0F172A", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#475569", display: "block", marginBottom: 5 }}>Deal Stage</label>
                <select
                  value={dealForm.stage}
                  onChange={e => setDealForm(f => ({ ...f, stage: e.target.value }))}
                  style={{ width: "100%", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", color: "#0F172A", fontSize: 12, outline: "none", boxSizing: "border-box" }}
                >
                  {Object.entries(STAGE_LABELS).map(([v, l]) => (
                    <option key={v} value={v} style={{ background: "#F8FAFC" }}>{l}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={createDeal}
                disabled={creatingDeal || !dealForm.deal_name.trim()}
                style={{ padding: "9px 0", borderRadius: 8, background: `linear-gradient(135deg, ${HS_ORANGE}, #cc5a3a)`, border: "none", color: "#0F172A", fontSize: 12, fontWeight: 700, cursor: creatingDeal ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: (!dealForm.deal_name.trim() || creatingDeal) ? 0.6 : 1 }}
              >
                {creatingDeal ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={12} />} Create
              </button>
            </div>
          </div>
        )}

        {/* Push contacts from database */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                <UserCheck size={15} style={{ display: "inline", marginRight: 8, color: "#a78bfa" }} />
                Push Contacts to CRM
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Contacts from Contact Intelligence™ — push individual records to HubSpot or Salesforce
              </div>
            </div>
            <button onClick={loadDiscovered} style={{ padding: "7px 14px", borderRadius: 8, background: "#ffffff", border: "1px solid #e2e8f0", color: "#334155", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <RefreshCw size={11} /> Refresh
            </button>
          </div>

          {discLoading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={24} color="#94a3b8" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}

          {!discLoading && discoveredContacts.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(15,23,42,0.08)", fontSize: 12 }}>
              No discovered contacts yet. Run a discovery on the Contact Intelligence™ page first.
            </div>
          )}

          {!discLoading && discoveredContacts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Column header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 100px 80px 200px", gap: 12, padding: "0 8px 8px", borderBottom: "1px solid #f1f5f9" }}>
                {["Contact", "Company", "Lives", "Status", "Push to CRM"].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(15,23,42,0.08)" }}>{h}</div>
                ))}
              </div>
              {discoveredContacts.map(c => {
                const pushing = pushingContactId === c.id;
                return (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 180px 100px 80px 200px", gap: 12, alignItems: "center", padding: "10px 8px", borderRadius: 10, background: "#ffffff", border: "1px solid #f8fafc" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
                        {[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}
                      </div>
                      <div style={{ fontSize: 10, color: "#60a5fa" }}>{c.email}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.employer_name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{c.participants ? c.participants.toLocaleString() : "—"}</div>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 99, background: c.status === "contacted" ? "rgba(16,185,129,0.12)" : "#f1f5f9", color: c.status === "contacted" ? "#10b981" : "#64748b", border: `1px solid ${c.status === "contacted" ? "rgba(16,185,129,0.25)" : "#e2e8f0"}` }}>
                        {c.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        data-testid={`btn-push-hubspot-${c.id}`}
                        onClick={() => pushToHubSpot(c)}
                        disabled={pushing}
                        title="Push to HubSpot"
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "rgba(255,122,89,0.1)", border: "1px solid rgba(255,122,89,0.25)", color: HS_ORANGE, fontSize: 10, fontWeight: 700, cursor: pushing ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                      >
                        {pushing ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={10} />} HubSpot
                      </button>
                      <button
                        data-testid={`btn-push-sf-${c.id}`}
                        onClick={() => pushToSalesforce(c)}
                        disabled={pushing || (status !== null && !status.salesforce.configured)}
                        title={status && !status.salesforce.configured ? "Salesforce not configured" : "Push to Salesforce"}
                        style={{ flex: 1, padding: "6px 8px", borderRadius: 8, background: "rgba(0,161,224,0.08)", border: "1px solid rgba(0,161,224,0.2)", color: status && !status.salesforce.configured ? "#94a3b8" : SF_BLUE, fontSize: 10, fontWeight: 700, cursor: (pushing || (status !== null && !status.salesforce.configured)) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, opacity: (status !== null && !status.salesforce.configured) ? 0.45 : 1 }}
                      >
                        {pushing ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={10} />} Salesforce
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CRM data tabs */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #e2e8f0", borderRadius: 16, overflow: "hidden" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
            {[
              { key: "hubspot", label: "HubSpot", color: HS_ORANGE },
              { key: "salesforce", label: "Salesforce", color: SF_BLUE },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{ padding: "14px 24px", fontSize: 12, fontWeight: 700, background: "transparent", border: "none", cursor: "pointer", borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : "2px solid transparent", color: activeTab === tab.key ? tab.color : "#64748b", marginBottom: -1 }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* HubSpot tab */}
          {activeTab === "hubspot" && (
            <div style={{ padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Contacts */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: HS_ORANGE }}>
                      <Users size={13} style={{ display: "inline", marginRight: 7 }} />Contacts ({hsContacts.length})
                    </div>
                    <button onClick={loadHsContacts} disabled={hsContactsLoading} style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(255,122,89,0.08)", border: "1px solid rgba(255,122,89,0.2)", color: HS_ORANGE, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {hsContactsLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={10} />} Load
                    </button>
                  </div>
                  {hsContacts.length === 0 && !hsContactsLoading && (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 11 }}>Click "Load" to fetch HubSpot contacts</div>
                  )}
                  {hsContactsLoading && <div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} color={HS_ORANGE} style={{ animation: "spin 1s linear infinite" }} /></div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {hsContacts.map(c => (
                      <div key={c.id} style={{ padding: "10px 12px", background: "rgba(255,122,89,0.04)", border: "1px solid rgba(255,122,89,0.12)", borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</div>
                        <div style={{ fontSize: 10, color: HS_ORANGE }}>{c.email}</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{c.company} {c.state && `· ${c.state}`}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deals */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: HS_ORANGE }}>
                      <BarChart3 size={13} style={{ display: "inline", marginRight: 7 }} />Deals ({hsDeals.length})
                    </div>
                    <button onClick={loadHsDeals} disabled={hsDealsLoading} style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(255,122,89,0.08)", border: "1px solid rgba(255,122,89,0.2)", color: HS_ORANGE, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {hsDealsLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={10} />} Load
                    </button>
                  </div>
                  {hsDeals.length === 0 && !hsDealsLoading && (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 11 }}>Click "Load" to fetch HubSpot deals</div>
                  )}
                  {hsDealsLoading && <div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} color={HS_ORANGE} style={{ animation: "spin 1s linear infinite" }} /></div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {hsDeals.map(d => (
                      <div key={d.id} style={{ padding: "10px 12px", background: "rgba(255,122,89,0.04)", border: "1px solid rgba(255,122,89,0.12)", borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{d.name}</div>
                        <div style={{ fontSize: 10, color: HS_ORANGE }}>{STAGE_LABELS[d.stage] || d.stage}</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                          {d.amount ? `$${parseFloat(d.amount).toLocaleString()}` : "No amount"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Salesforce tab */}
          {activeTab === "salesforce" && (
            <div style={{ padding: 24 }}>
              {status && !status.salesforce.configured ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <AlertCircle size={40} color="rgba(0,161,224,0.3)" style={{ margin: "0 auto 16px" }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#475569", marginBottom: 8 }}>Salesforce Not Connected</div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.08)", maxWidth: 420, margin: "0 auto", lineHeight: 1.7 }}>
                    Add these secrets in your Replit project settings to connect Salesforce:<br />
                    <code style={{ color: SF_BLUE, background: "rgba(0,161,224,0.08)", padding: "2px 6px", borderRadius: 4 }}>SALESFORCE_USERNAME</code>{" · "}
                    <code style={{ color: SF_BLUE, background: "rgba(0,161,224,0.08)", padding: "2px 6px", borderRadius: 4 }}>SALESFORCE_PASSWORD</code>{" · "}
                    <code style={{ color: SF_BLUE, background: "rgba(0,161,224,0.08)", padding: "2px 6px", borderRadius: 4 }}>SALESFORCE_SECURITY_TOKEN</code>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: SF_BLUE }}>
                      <Users size={13} style={{ display: "inline", marginRight: 7 }} />Leads ({sfLeads.length})
                    </div>
                    <button onClick={loadSfLeads} disabled={sfLeadsLoading} style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(0,161,224,0.08)", border: "1px solid rgba(0,161,224,0.2)", color: SF_BLUE, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      {sfLeadsLoading ? <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={10} />} Load
                    </button>
                  </div>
                  {sfLeads.length === 0 && !sfLeadsLoading && (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: 11 }}>Click "Load" to fetch Salesforce leads</div>
                  )}
                  {sfLeadsLoading && <div style={{ textAlign: "center", padding: 30 }}><Loader2 size={20} color={SF_BLUE} style={{ animation: "spin 1s linear infinite" }} /></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {sfLeads.map(l => (
                      <div key={l.id} style={{ padding: "10px 12px", background: "rgba(0,161,224,0.04)", border: "1px solid rgba(0,161,224,0.12)", borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{[l.first_name, l.last_name].filter(Boolean).join(" ") || "—"}</div>
                        <div style={{ fontSize: 10, color: SF_BLUE }}>{l.email}</div>
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{l.company} {l.employees ? `· ${l.employees.toLocaleString()} emp` : ""}</div>
                        <div style={{ fontSize: 9, color: "rgba(15,23,42,0.08)", marginTop: 2 }}>{l.status}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </Layout>
  );
}
