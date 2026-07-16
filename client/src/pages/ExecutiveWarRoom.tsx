import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useCompanyHandoff } from "@/hooks/use-company-handoff";
import { WAR_ROOM } from "@/lib/kincaidWarRoom";
import type { Tile, TileKpi } from "@/lib/kincaidCommitEngine";
import { Layout } from "@/components/Layout";
import {
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle,
  Hash, Database, GitBranch, Clock, Zap, RefreshCw,
  FileText, Lock, Eye, TrendingUp, TrendingDown, X,
  BarChart3, FlaskConical, ArrowRight, Flag,
  Building2, Calendar, Target, Cpu, Globe,
  ChevronRight, DollarSign, AlertOctagon, Scale,
  BarChart2, ShieldAlert, Sparkles, Radio, MonitorCheck,
  LayoutDashboard, Layers, Play, ShieldOff,
} from "lucide-react";

/* ─── GLOBAL CSS ───────────────────────────────────────────────────────────── */
const CSS = `
@keyframes ticker     { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
@keyframes livePulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
@keyframes fadeUp     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideRight { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
@keyframes spin       { to{transform:rotate(360deg)} }
@keyframes ledIn      { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
.ticker-wrap   { animation: ticker 30s linear infinite; display:flex; width:max-content; will-change:transform; }
.ticker-wrap:hover { animation-play-state:paused; }
.live-dot      { animation: livePulse 1.8s ease-in-out infinite; }
.fade-up       { animation: fadeUp .35s ease-out forwards; }
.slide-right   { animation: slideRight .25s ease-out forwards; }
.spin          { animation: spin .7s linear infinite; }
.led-in        { animation: ledIn .28s ease-out forwards; }
.tile-card     { transition: border-color .2s, box-shadow .2s, transform .15s; cursor:pointer; }
.tile-card:hover { transform: translateY(-2px); }
.tab-btn       { transition: color .15s, border-color .15s; }
`;

/* ─── PALETTE — matching kincaidrmc.com dark SaaS style ────────────────────── */
const BG      = "#F8FAFC";
const CARD_BG = "#ffffff";
const BORDER  = "rgba(0,0,0,0.08)";
const BORDER2 = "rgba(0,0,0,0.04)";
const TEXT1   = "#0F172A";
const TEXT2   = "#475569";
const TEXT3   = "#94A3B8";
const ACCENT  = "#2563eb";   // brand blue
const GREEN   = "#22c55e";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";
const CYAN    = "#06b6d4";
const PURPLE  = "#a855f7";
const GOLD    = "#eab308";

/* ─── TILE COLORS — one accent per battleground ────────────────────────────── */
const TILE_COLORS = {
  "ebitda-impact":         { accent:"#4f7dff", glow:"rgba(79,125,255,0.08)"  },
  "cost-leakage":          { accent:"#f59e0b", glow:"rgba(245,158,11,0.08)"  },
  "incentive-misalignment":{ accent:"#a855f7", glow:"rgba(168,85,247,0.08)"  },
  "risk-formation":        { accent:"#06b6d4", glow:"rgba(6,182,212,0.08)"   },
} as Record<string, {accent:string;glow:string}>;

/* ─── TYPES ─────────────────────────────────────────────────────────────────── */
type ControlTab = "warroom"|"dol5500"|"shadow-tax"|"zero-trust"|"posture"|"board-pack";
type Priority   = "high"|"med"|"low";
type LedSev     = "info"|"warn"|"error";

interface KPIRow {
  key: string; label: string; value: string;
  unit: string; confidence: number;
  direction?: "up"|"down"; benchmark?: string;
}
interface Lever {
  title: string; priority: Priority;
  impact_pmpm: string; timeframe: string; range: string;
}
interface TileDef {
  id: string; title: string; headline: string; unit: string;
  percentile: number; narrative: string;
  kpis: KPIRow[]; levers: Lever[];
}

/* ─── SHA-256 SIM ───────────────────────────────────────────────────────────── */
function sha(s:string){
  let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h)+s.charCodeAt(i);
  return `sha256:${Math.abs(h).toString(16).padStart(8,"0")}a3f7c2d9`;
}

/* ─── SIGNALS TICKER ────────────────────────────────────────────────────────── */
const SIGNALS=[
  {label:"GLP-1 PEPM",          val:"$114",   sub:"vs. $148 baseline",   up:false},
  {label:"PBM Waste",            val:"17.4%",  sub:"avoidable spend",     up:true },
  {label:"Plan PEPM",            val:"$985",   sub:"all-in cost",         up:true },
  {label:"EBITDA Impact",        val:"+$418K", sub:"modeled annual",      up:true },
  {label:"Stop-Loss Volatility", val:"-12.3%", sub:"vs last renewal",     up:false},
  {label:"GLP-1 PEPM",          val:"$114",   sub:"vs. $148 baseline",   up:false},
  {label:"PBM Waste",            val:"17.4%",  sub:"avoidable spend",     up:true },
  {label:"Plan PEPM",            val:"$985",   sub:"all-in cost",         up:true },
  {label:"EBITDA Impact",        val:"+$418K", sub:"modeled annual",      up:true },
  {label:"Stop-Loss Volatility", val:"-12.3%", sub:"vs last renewal",     up:false},
];

function Ticker(){
  return(
    <div style={{background:BG,borderBottom:`1px solid ${BORDER}`,height:34,display:"flex",alignItems:"center",overflow:"hidden"}}>
      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"0 14px",borderRight:`1px solid ${BORDER}`,height:"100%",background:"rgba(37,99,235,0.05)"}}>
        <Radio size={8} color={ACCENT}/>
        <span style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:ACCENT,whiteSpace:"nowrap"}}>KINCAID HEALTH SIGNALS</span>
      </div>
      <div style={{overflow:"hidden",flex:1}}>
        <div className="ticker-wrap">
          {SIGNALS.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"0 24px",borderRight:`1px solid ${BORDER2}`,height:34,flexShrink:0}}>
              <span style={{fontSize:9,color:TEXT3,letterSpacing:"0.05em"}}>{s.label}</span>
              <span style={{fontSize:12,fontWeight:800,color:s.up?"#ef4444":"#22c55e",letterSpacing:"-0.01em"}}>{s.val}</span>
              <span style={{fontSize:9,color:TEXT3}}>{s.sub}</span>
              {s.up?<TrendingUp size={9} color="#ef4444"/>:<TrendingDown size={9} color="#22c55e"/>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── TILE DATA — from kincaidrmc.com exactly ──────────────────────────────── */
const TILES: TileDef[] = [
  {
    id:"ebitda-impact", title:"EBITDA Impact", headline:"48 bps", unit:"drag",
    percentile:72,
    narrative:"Current GLP-1 and PBM structure are driving an estimated 48 bps of EBITDA drag.",
    kpis:[
      {key:"NET_COST_PMPM",      label:"Net Cost PMPM",           value:"$612.40", unit:"USD",    confidence:.88, direction:"up",  benchmark:"$545 benchmark"},
      {key:"TREND_YOY",          label:"Trend YoY",               value:"11.0%",   unit:"%",      confidence:.84, direction:"up",  benchmark:"<7% target"},
      {key:"PHARMACY_SHARE",     label:"Pharmacy Share of Total", value:"30.0%",   unit:"%",      confidence:.80, direction:"up",  benchmark:"24% benchmark"},
      {key:"STOPLOSS_VOLATILITY",label:"Stop-Loss Volatility",    value:"0.67",    unit:"index",  confidence:.78, direction:"up"},
    ],
    levers:[
      {title:"Specialty site-of-care optimization",        priority:"med",  impact_pmpm:"-2.1", timeframe:"60–120 days",  range:"-1.2 to -3.4 PMPM"},
      {title:"GLP-1 guardrails (clinical + financial)",    priority:"med",  impact_pmpm:"-1.4", timeframe:"30–60 days",   range:"-0.8 to -2.2 PMPM"},
      {title:"Stop-loss strategy reset (runway + lasers)", priority:"high", impact_pmpm:"-0.9", timeframe:"Next renewal", range:"-0.4 to -1.6 PMPM"},
    ],
  },
  {
    id:"cost-leakage", title:"Cost Leakage", headline:"$1.3M", unit:"execution-ready savings",
    percentile:65,
    narrative:"We estimate roughly $1.3M in credible, execution-ready savings over the next 12–24 months.",
    kpis:[
      {key:"PBM_SPREAD_INDEX",       label:"Spread Index",           value:"0.23", unit:"index", confidence:.83, direction:"up"},
      {key:"GENERIC_DISPERSION_GAP", label:"Generic Dispersion Gap", value:"0.07", unit:"gap",   confidence:.78, direction:"up"},
      {key:"SPECIALTY_WASTE_RATE",   label:"Specialty Waste Rate",   value:"0.04", unit:"rate",  confidence:.76, direction:"up"},
      {key:"REBATE_LEAKAGE_RISK",    label:"Rebate Leakage Risk",    value:"0.31", unit:"index", confidence:.74, direction:"up"},
    ],
    levers:[
      {title:"Audit PBM pricing and definitions (spread + AWP/MAC)", priority:"med",  impact_pmpm:"-1.25", timeframe:"60–90 days",   range:"-0.6 to -2.0 PMPM"},
      {title:"Renegotiate MAC governance + audit rights",             priority:"high", impact_pmpm:"-0.60", timeframe:"Next renewal", range:"-0.3 to -1.1 PMPM"},
      {title:"Specialty waste controls (fill patterns + discard)",    priority:"med",  impact_pmpm:"-0.80", timeframe:"45–90 days",   range:"-0.4 to -1.3 PMPM"},
    ],
  },
  {
    id:"incentive-misalignment", title:"Incentive Misalignment", headline:"82", unit:"/100",
    percentile:85,
    narrative:"Scoring your PBM, broker, and carrier contracts shows meaningful misalignment.",
    kpis:[
      {key:"FEE_MODEL_DISTORTION",    label:"Fee Model Distortion",    value:"0.29",   unit:"index", confidence:.77, direction:"up"},
      {key:"GUARANTEE_EXCLUSION_RATE",label:"Guarantee Exclusion Rate",value:"0.34",   unit:"rate",  confidence:.74, direction:"up"},
      {key:"UM_FRICTION_INDEX",        label:"UM Friction Index",       value:"0.58",   unit:"index", confidence:.71, direction:"up"},
      {key:"STEERAGE_ALIGNMENT",       label:"Steerage Alignment Score",value:"61/100", unit:"/100",  confidence:.73, direction:"down"},
    ],
    levers:[
      {title:"Move to pass-through economics + audit rights",  priority:"high", impact_pmpm:"-0.9", timeframe:"Next renewal",  range:"-0.4 to -1.5 PMPM"},
      {title:"Rewrite guarantees to match your risk surface",  priority:"high", impact_pmpm:"-0.5", timeframe:"Next renewal",  range:"-0.2 to -0.9 PMPM"},
      {title:"Reduce UM friction where it blocks value",       priority:"med",  impact_pmpm:"-0.3", timeframe:"60–120 days",   range:"-0.1 to -0.6 PMPM"},
    ],
  },
  {
    id:"risk-formation", title:"Risk Formation", headline:"45", unit:"/100",
    percentile:40,
    narrative:"Signals from vendor sprawl and PHI feeds indicate moderate forming risk.",
    kpis:[
      {key:"SHOCK_CLAIM_PROB",          label:"Shock Claim Probability",      value:"0.19",    unit:"prob",   confidence:.79, direction:"up"},
      {key:"HC_CLAIMANT_CONCENTRATION", label:"High-Cost Claimant Conc.",     value:"0.54",    unit:"index",  confidence:.81, direction:"up"},
      {key:"GLP1_ADOPTION_RATE",        label:"GLP-1 Adoption Rate",          value:"4.0%",    unit:"%",      confidence:.84, direction:"up"},
      {key:"STOPLOSS_RUNWAY",           label:"Stop-Loss Runway",             value:"2.3 mo",  unit:"months", confidence:.76, direction:"down"},
    ],
    levers:[
      {title:"Funding strategy: attachment point + lasers",  priority:"high", impact_pmpm:"-0.7", timeframe:"Next renewal", range:"-0.3 to -1.2 PMPM"},
      {title:"GLP-1 eligibility + stewardship workflow",     priority:"med",  impact_pmpm:"-1.0", timeframe:"30–60 days",  range:"-0.5 to -1.7 PMPM"},
      {title:"High-cost claimant steering + care navigation",priority:"med",  impact_pmpm:"-0.6", timeframe:"60–120 days", range:"-0.3 to -1.0 PMPM"},
    ],
  },
];


/* ─── KINCAID HEALTH VERIFY™ TYPES ──────────────────────────────────────────────── */
type VerifiedStatus = "VERIFIED"|"UNVERIFIED"|"DISPUTED";
type FreshnessStatus = "GREEN"|"YELLOW"|"RED";
interface EvidenceRef {
  evidence_id: string; source_name: string; source_hash: string;
  received_at: string; uri?: string;
}
interface TransformRef {
  transform_hash: string; code_version: string;
  params_hash: string; executed_at: string;
}
interface PolicyResult {
  allowed: boolean; verified_status: VerifiedStatus;
  freshness_status: FreshnessStatus; confidence_score: number;
  reason_code: string; violations: string[];
}
interface VerifyKpi {
  kpi_key: string; title: string; value: string; unit?: string;
  trend?: string; formula_text: string; threshold_note: string;
  evidence: EvidenceRef[]; transform: TransformRef; policy: PolicyResult;
}
interface VerifyTile {
  id: string; title: string; primary: VerifyKpi; supporting: VerifyKpi[];
}

/* ─── KINCAID HEALTH VERIFY™ TILE COLORS ───────────────────────────────────────── */
const VERIFY_COLORS: Record<string,{accent:string;glow:string}> = {
  population:  { accent:"#06b6d4", glow:"rgba(6,182,212,0.08)"  },
  drag:        { accent:"#ef4444", glow:"rgba(239,68,68,0.08)"   },
  recoverable: { accent:"#22c55e", glow:"rgba(34,197,94,0.08)"  },
  risk:        { accent:"#f59e0b", glow:"rgba(245,158,11,0.08)"  },
};

/* ─── VERIFY TILES DATA ─────────────────────────────────────────────────────── */
const VERIFY_TILES: VerifyTile[] = [
  {
    id:"population", title:"Population Health Index",
    primary:{
      kpi_key:"POP_INDEX_PEER", title:"Peer Index",
      value:"78", unit:"/100", trend:"+3.2 QoQ",
      formula_text:"Composite z-score of utilization, member months, disruption, and high-cost concentration versus peer benchmark.",
      threshold_note:"Watch if index drops below 65.",
      evidence:[
        {evidence_id:"ev_001",source_name:"Eligibility Roster",    source_hash:"9fe231cc9f1d1a7e",received_at:"2026-03-15 09:12"},
        {evidence_id:"ev_002",source_name:"Claims Summary",         source_hash:"ac2aa91d1f8b2ed1",received_at:"2026-03-16 08:44"},
      ],
      transform:{transform_hash:"tr_aa12981ff00",code_version:"warroom_v0.9.4",params_hash:"pm_0a81cd129",executed_at:"2026-03-18 06:20"},
      policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.94,reason_code:"PASS_ALL_GATES",violations:[]},
    },
    supporting:[
      {
        kpi_key:"MEMBER_MONTHS", title:"Member Months", value:"12,482",
        formula_text:"Sum of authoritative monthly eligibility exposure.",
        threshold_note:"Flag if YoY delta exceeds 8% without event note.",
        evidence:[{evidence_id:"ev_003",source_name:"Eligibility Ledger",source_hash:"d92cbb2a112d9ef3",received_at:"2026-03-15 09:12"}],
        transform:{transform_hash:"tr_mo99129f",code_version:"warroom_v0.9.4",params_hash:"pm_9912fed1",executed_at:"2026-03-18 06:20"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.97,reason_code:"PASS_ALL_GATES",violations:[]},
      },
      {
        kpi_key:"DISRUPTION_RATE", title:"Disruption Rate", value:"2.8%", trend:"-0.4 MoM",
        formula_text:"(New entrants + terminations) / average eligible population.",
        threshold_note:"Alert at > 4.0% sustained monthly.",
        evidence:[{evidence_id:"ev_004",source_name:"Enrollment Change Feed",source_hash:"efaa299ae18c1b00",received_at:"2026-03-17 07:51"}],
        transform:{transform_hash:"tr_dis7721a",code_version:"warroom_v0.9.4",params_hash:"pm_dis1234",executed_at:"2026-03-18 06:20"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.91,reason_code:"PASS_ALL_GATES",violations:[]},
      },
    ],
  },
  {
    id:"drag", title:"Current EBITDA Drag",
    primary:{
      kpi_key:"CURRENT_EBITDA_DRAG", title:"Current EBITDA Drag",
      value:"$1.42M", trend:"+9.1% YoY",
      formula_text:"Admin overbenchmark + PBM spread/rebate leakage + stop-loss inefficiency + pricing drift.",
      threshold_note:"Critical above 3% of annual benefits spend.",
      evidence:[
        {evidence_id:"ev_101",source_name:"PBM Claims File",    source_hash:"88a22bc90fe8821a",received_at:"2026-03-10 12:11"},
        {evidence_id:"ev_102",source_name:"Admin Fee Schedule", source_hash:"772fe008c1e9acda",received_at:"2026-03-11 10:20"},
      ],
      transform:{transform_hash:"tr_drag00aa22",code_version:"warroom_v0.9.4",params_hash:"pm_drag5531",executed_at:"2026-03-18 06:21"},
      policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.92,reason_code:"WARNING_THRESHOLD_BREACH",violations:["Drag exceeds 3.0% benefits spend threshold."]},
    },
    supporting:[
      {
        kpi_key:"ADMIN_FEE_PEPY", title:"Admin Fee PEPY", value:"$146", trend:"+6.4%",
        formula_text:"Admin fees / eligible members annualized.",
        threshold_note:"Flag if > peer +15%.",
        evidence:[{evidence_id:"ev_103",source_name:"TPA Invoice Set",source_hash:"12abdd18cc0091f1",received_at:"2026-03-12 09:02"}],
        transform:{transform_hash:"tr_adminac882",code_version:"warroom_v0.9.4",params_hash:"pm_admin223",executed_at:"2026-03-18 06:21"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.89,reason_code:"PASS_ALL_GATES",violations:[]},
      },
      {
        kpi_key:"PBM_NET_COST_PER_RXMM", title:"PBM Net Cost / Rx MM", value:"$118", trend:"+11.8% YoY",
        formula_text:"(Net plan charge - modeled rebate recovery) / Rx member months.",
        threshold_note:"Alert if > 8% YoY trend.",
        evidence:[{evidence_id:"ev_104",source_name:"Rebate Remit Report",source_hash:"f118ca55bb2cc901",received_at:"2026-01-04 08:10"}],
        transform:{transform_hash:"tr_pbmzz1181",code_version:"warroom_v0.9.4",params_hash:"pm_rx9911",executed_at:"2026-03-18 06:21"},
        policy:{allowed:false,verified_status:"UNVERIFIED",freshness_status:"RED",confidence_score:0.61,reason_code:"EVIDENCE_STALE",violations:["Rebate report exceeds freshness SLA.","Source reconciliation incomplete."]},
      },
    ],
  },
  {
    id:"recoverable", title:"Recoverable EBITDA",
    primary:{
      kpi_key:"RECOVERABLE_RANGE", title:"Recoverable Range",
      value:"$840K – $1.15M", trend:"Base: $992K",
      formula_text:"Modeled recoverable waste from PBM spread, admin drift, guarantee under-attainment, and overbilling.",
      threshold_note:"Base case shown only when confidence > 0.85.",
      evidence:[{evidence_id:"ev_201",source_name:"Contract Clause Extraction",source_hash:"9d00aa11cc09fe78",received_at:"2026-03-14 11:31"}],
      transform:{transform_hash:"tr_rec99121",code_version:"warroom_v0.9.4",params_hash:"pm_rec3312",executed_at:"2026-03-18 06:22"},
      policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.88,reason_code:"PASS_ALL_GATES",violations:[]},
    },
    supporting:[
      {
        kpi_key:"GUARANTEE_ATTAINMENT", title:"Guarantee Attainment", value:"91.2%",
        formula_text:"Actual contractual performance / measurable guarantees.",
        threshold_note:"Critical below 95%.",
        evidence:[{evidence_id:"ev_202",source_name:"Vendor Guarantee File",source_hash:"ab2811c09ff34daa",received_at:"2026-03-13 14:02"}],
        transform:{transform_hash:"tr_guar2221",code_version:"warroom_v0.9.4",params_hash:"pm_guar212",executed_at:"2026-03-18 06:22"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.87,reason_code:"WARNING_THRESHOLD_BREACH",violations:["Guarantee attainment below 95% threshold."]},
      },
      {
        kpi_key:"OVERBILLING_SIGNAL", title:"Overbilling Signal", value:"$138K",
        formula_text:"(Billed lives - eligible lives) × monthly contracted fee.",
        threshold_note:"Flag at > 1% monthly overbilling.",
        evidence:[{evidence_id:"ev_203",source_name:"Monthly Invoice Bundle",source_hash:"001aa223bc909eff",received_at:"2026-03-17 05:12"}],
        transform:{transform_hash:"tr_bill931aa",code_version:"warroom_v0.9.4",params_hash:"pm_bill77",executed_at:"2026-03-18 06:22"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.95,reason_code:"PASS_ALL_GATES",violations:[]},
      },
    ],
  },
  {
    id:"risk", title:"EBITDA At Risk",
    primary:{
      kpi_key:"EBITDA_AT_RISK_12M", title:"12M EBITDA At Risk",
      value:"$2.08M", trend:"+14.2% exposure",
      formula_text:"Trend volatility + renewal shock + large claim concentration + contract opacity.",
      threshold_note:"Critical when > 10% operating margin impact.",
      evidence:[{evidence_id:"ev_301",source_name:"Stop-Loss Exposure Model",source_hash:"9fa0cd1122bb9911",received_at:"2026-03-16 16:41"}],
      transform:{transform_hash:"tr_risk991bb",code_version:"warroom_v0.9.4",params_hash:"pm_risk993",executed_at:"2026-03-18 06:23"},
      policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.86,reason_code:"WARNING_THRESHOLD_BREACH",violations:["12M risk exceeds internal tolerance."]},
    },
    supporting:[
      {
        kpi_key:"CONTRACT_OPACITY_SCORE", title:"Contract Opacity Score", value:"67", unit:"/100",
        formula_text:"Opacity composite from audit rights, pricing transparency, rebate clauses, and measurement discretion.",
        threshold_note:"Flag at >= 60.",
        evidence:[{evidence_id:"ev_302",source_name:"Broker / PBM Contract PDF",source_hash:"7712bb001992ce11",received_at:"2026-03-13 08:44"}],
        transform:{transform_hash:"tr_opc12ab9",code_version:"warroom_v0.9.4",params_hash:"pm_opc932",executed_at:"2026-03-18 06:23"},
        policy:{allowed:true,verified_status:"DISPUTED",freshness_status:"YELLOW",confidence_score:0.73,reason_code:"DISPUTED_CLAUSE_MAPPING",violations:["Clause extraction divergence detected."]},
      },
      {
        kpi_key:"VENDOR_COMP_LEAKAGE_RISK", title:"Vendor Comp Leakage Risk", value:"High",
        formula_text:"Composite of modeled commission gap, rebate distortion, and renewal incentive bias.",
        threshold_note:"Escalate when modeled opacity ratio exceeds tolerance.",
        evidence:[{evidence_id:"ev_303",source_name:"Schedule C + Compensation Mapping",source_hash:"ab9112eff08cd55e",received_at:"2026-03-11 07:20"}],
        transform:{transform_hash:"tr_vend7733",code_version:"warroom_v0.9.4",params_hash:"pm_vend11",executed_at:"2026-03-18 06:23"},
        policy:{allowed:true,verified_status:"VERIFIED",freshness_status:"GREEN",confidence_score:0.84,reason_code:"PASS_ALL_GATES",violations:[]},
      },
    ],
  },
];


/* ─── ATOMS ─────────────────────────────────────────────────────────────────── */
function ConfBar({v,w=44}:{v:number;w?:number}){
  const c=v>=.88?GREEN:v>=.80?AMBER:RED;
  return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:w,height:3,borderRadius:2,background:"rgba(15,23,42,0.03)",overflow:"hidden"}}>
        <div style={{width:`${v*100}%`,height:"100%",background:c,borderRadius:2}}/>
      </div>
      <span style={{fontSize:8,color:c,fontWeight:700}}>{(v*100).toFixed(0)}%</span>
    </div>
  );
}
function PBadge({p}:{p:Priority}){
  const s={high:{c:RED,bg:"rgba(239,68,68,0.12)"},med:{c:AMBER,bg:"rgba(245,158,11,0.12)"},low:{c:TEXT3,bg:"rgba(15,23,42,0.03)"}}[p];
  return<span style={{fontSize:7,fontWeight:800,letterSpacing:"0.09em",padding:"2px 7px",borderRadius:3,background:s.bg,color:s.c,textTransform:"uppercase"}}>{p}</span>;
}
function PercBar({v,color}:{v:number;color:string}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:56,height:3,borderRadius:2,background:"rgba(15,23,42,0.03)",overflow:"hidden"}}>
        <div style={{width:`${v}%`,height:"100%",background:color,borderRadius:2}}/>
      </div>
      <span style={{fontSize:9,color,fontWeight:600}}>{v}th percentile</span>
    </div>
  );
}
function SecHd({label}:{label:string}){
  return<div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,textTransform:"uppercase",marginBottom:8,paddingBottom:6,borderBottom:`1px solid ${BORDER2}`}}>{label}</div>;
}

/* ─── TILE CARD ─────────────────────────────────────────────────────────────── */
function TileCard({tile,onClick}:{tile:TileDef;onClick:(t:TileDef)=>void}){
  const {accent,glow}=TILE_COLORS[tile.id];
  const allPass=tile.kpis.every(k=>k.confidence>=.80);
  return(
    <div
      className="tile-card"
      data-testid={`tile-${tile.id}`}
      onClick={()=>onClick(tile)}
      style={{
        background:CARD_BG,
        border:`1px solid ${BORDER}`,
        borderRadius:16,
        padding:"28px 26px",
        display:"flex",
        flexDirection:"column",
        gap:0,
        boxShadow:`0 0 60px ${glow}`,
        position:"relative",
        overflow:"hidden",
      }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=accent+"55";e.currentTarget.style.boxShadow=`0 4px 40px ${glow},0 0 0 1px ${accent}22`;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.boxShadow=`0 0 60px ${glow}`;}}
    >
      {/* Subtle glow blob */}
      <div style={{position:"absolute",top:-80,right:-80,width:220,height:220,borderRadius:"50%",background:`radial-gradient(circle,${accent}09 0%,transparent 65%)`,pointerEvents:"none"}}/>

      {/* Title row */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.06em",color:accent,textTransform:"uppercase"}}>{tile.title}</span>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          {allPass
            ? <CheckCircle2 size={11} color={GREEN}/>
            : <AlertTriangle size={11} color={AMBER}/>
          }
          <ChevronRight size={11} color={TEXT3}/>
        </div>
      </div>

      {/* Hero metric */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:52,fontWeight:900,color:TEXT1,letterSpacing:"-0.03em",lineHeight:1}}>
          {tile.headline}
        </div>
        <div style={{fontSize:12,color:TEXT2,marginTop:4,fontWeight:400}}>{tile.unit}</div>
      </div>

      {/* Percentile */}
      <div style={{marginBottom:20}}>
        <PercBar v={tile.percentile} color={accent}/>
      </div>

      {/* Narrative */}
      <div style={{fontSize:12,color:TEXT2,lineHeight:1.65,marginBottom:22,flex:1}}>
        {tile.narrative}
      </div>

      {/* KPI preview rows */}
      <div style={{display:"flex",flexDirection:"column",gap:5,borderTop:`1px solid ${BORDER2}`,paddingTop:14}}>
        {tile.kpis.slice(0,3).map(k=>(
          <div key={k.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:TEXT3,flex:1}}>{k.label}</span>
            <span style={{fontSize:11,fontWeight:700,color:TEXT1,marginRight:10}}>{k.value}</span>
            <ConfBar v={k.confidence} w={30}/>
          </div>
        ))}
      </div>

      {/* Footer chip */}
      <div style={{marginTop:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:9,color:TEXT3}}>{tile.levers.length} decision levers</span>
        <span style={{fontSize:10,color:accent,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
          View drill-down <ArrowRight size={10}/>
        </span>
      </div>
    </div>
  );
}

/* ─── DRILL STEP CONTENT ─────────────────────────────────────────────────────── */
const STEP_LABELS = [
  "Overview",
  "KPI Signals",
  "Claims Breakdown",
  "Top Cost Drivers",
  "Pricing Mechanics",
  "Vendor Economics",
  "Decision Levers",
  "Peer Benchmarking",
  "Financial Model",
  "Evidence Chain",
];

/* Per-tile deep data for steps 2-9 */
const TILE_DRILL: Record<string,{
  claimsBreakdown:   {cat:string;spend:string;pct:number;trend:string}[];
  topDrivers:        {name:string;spend:string;pmpm:string;flag?:string}[];
  pricingMechanics:  {mechanic:string;gap:string;impact:string;severity:"red"|"amber"|"green"}[];
  vendorEconomics:   {vendor:string;fee:string;model:string;aligned:boolean;note:string}[];
  benchmarks:        {metric:string;yours:string;peer:string;delta:string;pct:number}[];
  financialModel:    {label:string;value:string;color:string}[];
  boardNarrative:    string;
}> = {
  "ebitda-impact": {
    claimsBreakdown:[
      {cat:"Medical",          spend:"$8.2M",   pct:68, trend:"+9.4% YoY"},
      {cat:"Pharmacy",         spend:"$3.8M",   pct:32, trend:"+14.2% YoY"},
      {cat:"  › GLP-1",        spend:"$1.19M",  pct:10, trend:"+38.1% YoY"},
      {cat:"  › Specialty Rx", spend:"$890K",   pct:7,  trend:"+11.3% YoY"},
      {cat:"  › Brand",        spend:"$520K",   pct:4,  trend:"+2.1% YoY"},
      {cat:"  › Generic",      spend:"$190K",   pct:2,  trend:"-3.4% YoY"},
    ],
    topDrivers:[
      {name:"Semaglutide (Wegovy/Ozempic)",     spend:"$612K", pmpm:"$51.00", flag:"GLP-1 watch"},
      {name:"Tirzepatide (Mounjaro/Zepbound)",  spend:"$314K", pmpm:"$26.17", flag:"GLP-1 watch"},
      {name:"Adalimumab (Humira)",              spend:"$228K", pmpm:"$19.00"},
      {name:"Ustekinumab (Stelara)",            spend:"$186K", pmpm:"$15.50"},
      {name:"Inpatient Facility",               spend:"$1.4M", pmpm:"$116.67",flag:"Site-of-care"},
      {name:"Outpatient Surgery",               spend:"$820K", pmpm:"$68.33"},
    ],
    pricingMechanics:[
      {mechanic:"AWP Discount — Brand",        gap:"26% vs 32% contracted", impact:"$87K/yr",  severity:"red"},
      {mechanic:"AWP Discount — Specialty",    gap:"22% vs 28% contracted", impact:"$104K/yr", severity:"red"},
      {mechanic:"MAC Pricing — Generic",       gap:"Tier 3 MAC at +18%",    impact:"$32K/yr",  severity:"amber"},
      {mechanic:"Spread Retention",            gap:"Est. $0.23 PMPM",       impact:"$33K/yr",  severity:"amber"},
      {mechanic:"GLP-1 Rebate Pass-Through",   gap:"61% retained by PBM",   impact:"$73K/yr",  severity:"red"},
    ],
    vendorEconomics:[
      {vendor:"PBM (TrueRx)",          fee:"$4.20 PMPM admin",   model:"Spread + retained rebate", aligned:false, note:"Earns more on higher-cost drugs"},
      {vendor:"Stop-Loss Carrier",     fee:"$38.40 PMPM premium",model:"Risk-based, experience-rated",aligned:true,  note:"Aligned — premium tied to claims"},
      {vendor:"Broker / Consultant",   fee:"$2.80 PMPM",         model:"% of premium",             aligned:false, note:"Earns more if plan costs more"},
      {vendor:"TPA",                   fee:"$5.10 PMPM",         model:"Fixed PEPM",               aligned:true,  note:"Fixed fee — neutral incentive"},
    ],
    benchmarks:[
      {metric:"Net Cost PMPM",     yours:"$612",    peer:"$545",    delta:"+$67 (+12%)",   pct:72},
      {metric:"Trend YoY",         yours:"11.0%",   peer:"7.2%",    delta:"+3.8 pts",      pct:78},
      {metric:"Pharmacy Share",    yours:"30.0%",   peer:"24.0%",   delta:"+6 pts",        pct:70},
      {metric:"GLP-1 PEPM",        yours:"$51",     peer:"$38",     delta:"+$13 (+34%)",   pct:74},
      {metric:"Stop-Loss Premium", yours:"$38.40",  peer:"$34.20",  delta:"+$4.20 (+12%)", pct:65},
    ],
    financialModel:[
      {label:"Current Annual Drag",        value:"$418K",    color:RED},
      {label:"5-Year NPV (no action)",     value:"$2.31M",   color:RED},
      {label:"Lever 1: Site-of-care",      value:"−$302K/yr",color:GREEN},
      {label:"Lever 2: GLP-1 guardrails",  value:"−$201K/yr",color:GREEN},
      {label:"Lever 3: SL reset",          value:"−$130K/yr",color:GREEN},
      {label:"Total Recoverable (3yr NPV)","value":"$1.74M", color:GREEN},
      {label:"EBITDA Impact (post-action)","value":"~12 bps",color:GREEN},
    ],
    boardNarrative:"Current GLP-1 and PBM structure are driving an estimated 48 bps of EBITDA drag — $418K annually, growing at 14% per year in pharmacy alone. Site-of-care optimization, GLP-1 guardrails, and a stop-loss strategy reset represent $633K in governed, defensible annual savings. Over 3 years, the NPV recovery exceeds $1.74M against a do-nothing baseline of $2.31M. Each finding is backed by claims data, contract terms, and SHA-verified transform chains — admissible at the board level.",
  },
  "cost-leakage": {
    claimsBreakdown:[
      {cat:"PBM Spread (Brand)",        spend:"$214K",  pct:16, trend:"Avoidable"},
      {cat:"PBM Spread (Specialty)",    spend:"$173K",  pct:13, trend:"Avoidable"},
      {cat:"Rebate Retention",          spend:"$311K",  pct:24, trend:"Contractual gap"},
      {cat:"MAC Pricing Gap (Generic)", spend:"$89K",   pct:7,  trend:"Avoidable"},
      {cat:"Specialty Waste (Discard)", spend:"$182K",  pct:14, trend:"Clinical + financial"},
      {cat:"Admin Fee Inflation",       spend:"$218K",  pct:17, trend:"Above CPI +4.2%"},
      {cat:"Other Identified Leakage",  spend:"$113K",  pct:9,  trend:"Misc contractual"},
    ],
    topDrivers:[
      {name:"Spread — Enbrel (etanercept)",        spend:"$68K",  pmpm:"$5.67",  flag:"Spread flagged"},
      {name:"Spread — Humira (adalimumab)",         spend:"$52K",  pmpm:"$4.33",  flag:"Spread flagged"},
      {name:"MAC inflation — metformin",            spend:"$14K",  pmpm:"$1.17"},
      {name:"Specialty discard — Xolair",           spend:"$94K",  pmpm:"$7.83",  flag:"Waste"},
      {name:"Specialty discard — Keytruda",         spend:"$88K",  pmpm:"$7.33",  flag:"Waste"},
      {name:"Admin fee overage (vs CPI benchmark)", spend:"$218K", pmpm:"$18.17", flag:"Above benchmark"},
    ],
    pricingMechanics:[
      {mechanic:"Brand Spread Margin",           gap:"Spread est. 8.4% of AWP",  impact:"$214K/yr", severity:"red"},
      {mechanic:"Specialty Spread Margin",       gap:"Spread est. 11.2% of AWP", impact:"$173K/yr", severity:"red"},
      {mechanic:"Rebate Pass-Through Rate",      gap:"61% to plan vs 95% peer",  impact:"$311K/yr", severity:"red"},
      {mechanic:"MAC Tier 3 — Generic Inflation",gap:"+18% above MAC floor",     impact:"$89K/yr",  severity:"amber"},
      {mechanic:"Admin PEPM vs CPI benchmark",   gap:"+$1.40 PEPM above CPI",   impact:"$218K/yr", severity:"amber"},
    ],
    vendorEconomics:[
      {vendor:"PBM (TrueRx)",        fee:"Spread + admin $4.20",    model:"Retained spread + partial rebate",aligned:false, note:"Earns $0.23 PMPM on spread alone"},
      {vendor:"Specialty Pharmacy",  fee:"Dispensing fee $12.40/Rx",model:"Fee per fill + waste retention",   aligned:false, note:"No discard credit mechanism"},
      {vendor:"Broker",              fee:"$2.80 PMPM",              model:"% of premium",                    aligned:false, note:"No fee-at-risk for leakage"},
      {vendor:"TPA",                 fee:"$5.10 PMPM fixed",        model:"Fixed PEPM",                      aligned:true,  note:"Neutral — not spend-linked"},
    ],
    benchmarks:[
      {metric:"PBM Spread Index",        yours:"0.23",  peer:"0.09",  delta:"+0.14 (worse)",  pct:83},
      {metric:"Rebate Pass-Through %",   yours:"61%",   peer:"91%",   delta:"−30 pts",        pct:80},
      {metric:"Generic Dispersion Gap",  yours:"0.07",  peer:"0.03",  delta:"+0.04 (worse)",  pct:78},
      {metric:"Specialty Waste Rate",    yours:"4.0%",  peer:"1.8%",  delta:"+2.2 pts",       pct:76},
      {metric:"Admin PEPM",              yours:"$5.10", peer:"$3.70", delta:"+$1.40 (+38%)",  pct:82},
    ],
    financialModel:[
      {label:"Total Identified Leakage",        value:"$1.30M",   color:RED},
      {label:"Lever 1: PBM audit + renegotiate",value:"−$453K/yr",color:GREEN},
      {label:"Lever 2: MAC governance",         value:"−$87K/yr", color:GREEN},
      {label:"Lever 3: Specialty waste ctrl",   value:"−$182K/yr",color:GREEN},
      {label:"Lever 4: Rebate recapture",       value:"−$311K/yr",color:GREEN},
      {label:"Total Recoverable Year 1",        value:"$1.03M",   color:GREEN},
      {label:"3-Year NPV Recovery",             value:"$2.87M",   color:GREEN},
    ],
    boardNarrative:"We have identified $1.3M in credible, execution-ready savings across PBM spread, rebate retention, generic MAC inflation, specialty waste, and admin fee inflation. Each dollar is traceable to a specific contract clause, remittance record, or claims pattern. PBM contract renegotiation alone — targeting spread elimination and 91% rebate pass-through — recovers $764K annually. These are not estimates; they are governed, evidence-backed findings ready for board presentation.",
  },
  "incentive-misalignment": {
    claimsBreakdown:[
      {cat:"Broker override (est.)",           spend:"$287K",  pct:22, trend:"Hidden in premium"},
      {cat:"PBM retained rebate",              spend:"$311K",  pct:24, trend:"Contractual gap"},
      {cat:"UM friction delay costs",          spend:"$194K",  pct:15, trend:"Admin + clinical"},
      {cat:"Guarantee exclusion exposure",     spend:"$218K",  pct:17, trend:"Contract loophole"},
      {cat:"Steerage miss (non-preferred)",    spend:"$171K",  pct:13, trend:"Network leakage"},
      {cat:"Other misalignment",               spend:"$119K",  pct:9,  trend:"Misc"},
    ],
    topDrivers:[
      {name:"Broker override — GLP-1 tier",          spend:"$94K",  pmpm:"$7.83",  flag:"Conflict"},
      {name:"Broker override — specialty formulary",  spend:"$193K", pmpm:"$16.08", flag:"Conflict"},
      {name:"UM prior-auth delay (GLP-1)",            spend:"$87K",  pmpm:"$7.25",  flag:"Friction"},
      {name:"Guarantee exclusion — specialty",        spend:"$218K", pmpm:"$18.17", flag:"Loophole"},
      {name:"Non-preferred steerage (brand > gen)",   spend:"$171K", pmpm:"$14.25", flag:"Misaligned"},
      {name:"PBM admin inflation",                    spend:"$50K",  pmpm:"$4.17"},
    ],
    pricingMechanics:[
      {mechanic:"Fee-Model Distortion Index",       gap:"0.29 vs 0.08 aligned benchmark",impact:"$287K/yr",severity:"red"},
      {mechanic:"Guarantee Exclusion Rate",         gap:"34% of claims excluded",         impact:"$218K/yr",severity:"red"},
      {mechanic:"UM Friction Index",                gap:"0.58 vs 0.22 best practice",     impact:"$194K/yr",severity:"red"},
      {mechanic:"Steerage Alignment Score",         gap:"61/100 vs 88/100 benchmark",     impact:"$171K/yr",severity:"amber"},
      {mechanic:"Pass-Through Gap (rebates)",       gap:"61% vs 91% peer",               impact:"$311K/yr",severity:"red"},
    ],
    vendorEconomics:[
      {vendor:"Broker (current)",      fee:"$2.80 PMPM + overrides",  model:"% premium + vendor overrides",    aligned:false, note:"Est. $94–193K in undisclosed overrides"},
      {vendor:"PBM (TrueRx)",          fee:"Spread + admin",          model:"Volume-linked economics",         aligned:false, note:"More spend = more revenue"},
      {vendor:"Stop-Loss Carrier",     fee:"$38.40 PMPM",             model:"Risk-based",                     aligned:true,  note:"Premium tied to claims — aligned"},
      {vendor:"Network (PPO)",         fee:"Access fee $1.20 PMPM",   model:"Discount-based, steer-optional", aligned:false, note:"No steerage incentive built in"},
    ],
    benchmarks:[
      {metric:"Fee Model Distortion",      yours:"0.29",    peer:"0.08",    delta:"+0.21 (worse)",  pct:77},
      {metric:"Guarantee Exclusion Rate",  yours:"34%",     peer:"12%",     delta:"+22 pts",        pct:74},
      {metric:"UM Friction Index",         yours:"0.58",    peer:"0.22",    delta:"+0.36 (worse)",  pct:71},
      {metric:"Steerage Alignment Score",  yours:"61/100",  peer:"84/100",  delta:"−23 pts",        pct:73},
      {metric:"Rebate Pass-Through",       yours:"61%",     peer:"91%",     delta:"−30 pts",        pct:79},
    ],
    financialModel:[
      {label:"Total Misalignment Cost",         value:"$1.30M",   color:RED},
      {label:"Lever 1: Pass-through economics", value:"−$311K/yr",color:GREEN},
      {label:"Lever 2: Rewrite guarantees",     value:"−$218K/yr",color:GREEN},
      {label:"Lever 3: UM friction reduction",  value:"−$194K/yr",color:GREEN},
      {label:"Lever 4: Broker fee transparency","value":"−$287K/yr",color:GREEN},
      {label:"Total Recoverable Year 1",        value:"$1.01M",   color:GREEN},
      {label:"3-Year NPV Recovery",             value:"$2.64M",   color:GREEN},
    ],
    boardNarrative:"Your PBM, broker, and carrier contracts score 82/100 on the misalignment index — placing you in the 85th percentile of plans with measurable conflicts. Your broker earns more when your plan costs more. Your PBM retains 39% of rebates your contracts entitle you to. Your guarantees exclude 34% of claims. These are not abstract risks — they are $1.3M in annual misalignment cost, traceable to specific contract clauses. Shifting to pass-through economics and transparent fee models recovers $598K in year one alone.",
  },
  "risk-formation": {
    claimsBreakdown:[
      {cat:"High-cost claimants (>$50K)",   spend:"$3.1M",  pct:54, trend:"3 members, growing"},
      {cat:"GLP-1 program",                 spend:"$1.19M", pct:21, trend:"+38.1% YoY"},
      {cat:"Stop-loss attachment exposure", spend:"$680K",  pct:12, trend:"2 near-threshold"},
      {cat:"Mental health / SUD",           spend:"$340K",  pct:6,  trend:"+18.2% YoY"},
      {cat:"Shock claim tail (est.)",       spend:"$220K",  pct:4,  trend:"Modeled probability"},
      {cat:"Other volatile",                spend:"$170K",  pct:3,  trend:"Misc"},
    ],
    topDrivers:[
      {name:"Member A — Oncology (near laser)",     spend:"$1.24M",pmpm:"$103K",  flag:"Laser candidate"},
      {name:"Member B — Renal failure",             spend:"$984K", pmpm:"$82K",   flag:"Near threshold"},
      {name:"Member C — Transplant + specialty Rx", spend:"$872K", pmpm:"$72.7K", flag:"SL exposure"},
      {name:"GLP-1 cohort (47 members)",            spend:"$1.19M",pmpm:"$25.3K", flag:"Persistence risk"},
      {name:"Shock claim reserve (modeled)",        spend:"$220K", pmpm:"$18.3K", flag:"Probability 19%"},
      {name:"Mental health / SUD trend",            spend:"$340K", pmpm:"$28.3K", flag:"Growing"},
    ],
    pricingMechanics:[
      {mechanic:"Shock Claim Probability",         gap:"19% vs 9% peer benchmark",      impact:"$220K exposure", severity:"red"},
      {mechanic:"HC Claimant Concentration",       gap:"54% spend in 3 members",        impact:"SL premium risk",severity:"red"},
      {mechanic:"GLP-1 Adoption Rate",             gap:"4.0% growing to est. 6.8%",     impact:"$480K/yr by '27",severity:"amber"},
      {mechanic:"Stop-Loss Runway",                gap:"2.3 mo to next renewal",        impact:"Renegotiation risk",severity:"red"},
      {mechanic:"Attachment Point",                gap:"$150K vs $125K peer benchmark", impact:"Excess exposure",  severity:"amber"},
    ],
    vendorEconomics:[
      {vendor:"Stop-Loss Carrier",       fee:"$38.40 PMPM",        model:"Experience-rated",               aligned:true,  note:"But 2 near-laser members create leverage"},
      {vendor:"PBM — GLP-1 management", fee:"Spread + rebate",    model:"No outcomes incentive",           aligned:false, note:"No penalty for GLP-1 persistence failure"},
      {vendor:"Care Navigator",          fee:"$1.80 PMPM",         model:"Fixed PEPM — not outcomes-linked",aligned:false, note:"No shared savings on HC claimant steering"},
      {vendor:"Reinsurance Broker",      fee:"$0.60 PMPM",         model:"% of SL premium",                aligned:false, note:"Earns more on higher SL premium"},
    ],
    benchmarks:[
      {metric:"Shock Claim Probability",       yours:"19%",    peer:"9%",     delta:"+10 pts (worse)",  pct:79},
      {metric:"HC Claimant Concentration",     yours:"54%",    peer:"31%",    delta:"+23 pts (worse)",  pct:81},
      {metric:"GLP-1 Adoption Rate",           yours:"4.0%",   peer:"2.8%",   delta:"+1.2 pts",         pct:72},
      {metric:"Stop-Loss Runway",              yours:"2.3 mo", peer:"5.1 mo", delta:"−2.8 mo (worse)",  pct:68},
      {metric:"HC Mgmt Steering Rate",         yours:"38%",    peer:"67%",    delta:"−29 pts",          pct:76},
    ],
    financialModel:[
      {label:"HC Claimant Exposure (3 members)", value:"$3.1M",    color:RED},
      {label:"Shock Claim Reserve (modeled)",    value:"$220K",    color:RED},
      {label:"GLP-1 Run-Rate 2027 (est.)",       value:"$1.71M",   color:RED},
      {label:"Lever 1: Attachment + lasers",     value:"−$100K/yr",color:GREEN},
      {label:"Lever 2: GLP-1 stewardship",       value:"−$145K/yr",color:GREEN},
      {label:"Lever 3: HC claimant nav.",        value:"−$87K/yr", color:GREEN},
      {label:"3-Year Net Risk Reduction",        value:"$984K NPV",color:GREEN},
    ],
    boardNarrative:"Three members represent 54% of total spend. One is within $26K of the stop-loss laser threshold. GLP-1 adoption is at 4.0% — tracking to 6.8% by plan year 2027, adding $480K in annual run-rate. Stop-loss renewal is 2.3 months away with no laser strategy in place. Funding strategy optimization, GLP-1 eligibility stewardship, and high-cost claimant navigation are executable within the renewal window — reducing premium exposure 12–24% and capping GLP-1 run-rate. Every figure is evidence-backed and renewal-grade.",
  },
};

/* ─── DRILL PANEL ─────────────────────────────────────────────────────────────── */
function DrillPanel({tile,onClose}:{tile:TileDef;onClose:()=>void}){
  const {accent}=TILE_COLORS[tile.id];
  const [step,setStep]=useState(0);
  const TOTAL=10;
  const d=TILE_DRILL[tile.id];

  const Row=({label,val,sub,color}:{label:string;val:string;sub?:string;color?:string})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${BORDER2}`}}>
      <span style={{fontSize:10,color:TEXT2,flex:1}}>{label}</span>
      <div style={{textAlign:"right"}}><span style={{fontSize:12,fontWeight:700,color:color||TEXT1}}>{val}</span>{sub&&<div style={{fontSize:8,color:TEXT3}}>{sub}</div>}</div>
    </div>
  );

  const StepContent=()=>{
    switch(step){
      case 0: return(
        <>
          <div style={{padding:"14px 16px",background:`${accent}0c`,border:`1px solid ${accent}22`,borderRadius:10,marginBottom:18}}>
            <div style={{fontSize:13,color:TEXT2,lineHeight:1.7}}>{tile.narrative}</div>
          </div>
          <SecHd label="4 Hero KPIs"/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:18}}>
            {tile.kpis.map(k=>(
              <div key={k.key} style={{padding:"12px 14px",background:"rgba(15,23,42,0.03)",border:`1px solid ${BORDER}`,borderRadius:10}}>
                <div style={{fontSize:8,color:TEXT3,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:3}}>{k.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:TEXT1}}>{k.value}</div>
                <ConfBar v={k.confidence} w={36}/>
              </div>
            ))}
          </div>
          <SecHd label="Decision Levers Summary"/>
          {tile.levers.map((l,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,0.025)",borderRadius:7,marginBottom:5}}>
              <PBadge p={l.priority}/>
              <span style={{fontSize:10,color:TEXT2,flex:1}}>{l.title}</span>
              <span style={{fontSize:11,fontWeight:700,color:GREEN}}>{l.impact_pmpm} PMPM</span>
            </div>
          ))}
        </>
      );

      case 1: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>
              {tile.id==="ebitda-impact" && "A small set of drivers explains most of the PMPM trend and renewal pressure."}
              {tile.id==="cost-leakage" && "The leakage profile is concentrated in a few repeatable mechanisms."}
              {tile.id==="incentive-misalignment" && "Who gets paid when spend goes up? Misalignment is measurable: fee models, exclusions, and guarantees that don't guarantee much."}
              {tile.id==="risk-formation" && "Volatility is the enemy at renewal — shock claims, GLP-1 acceleration, and utilization drift can all be modeled."}
            </div>
          </div>
          <SecHd label="KPI Signals"/>
          {tile.kpis.map(k=>(
            <div key={k.key} style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${BORDER}`,borderRadius:10,marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                <div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.07em",color:TEXT3,textTransform:"uppercase",marginBottom:3}}>{k.label}</div>
                  <div style={{fontSize:22,fontWeight:800,color:TEXT1}}>{k.value} <span style={{fontSize:9,color:TEXT3}}>{k.unit}</span></div>
                  {k.benchmark&&<div style={{fontSize:9,color:TEXT3,marginTop:2}}>Benchmark: {k.benchmark}</div>}
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:8,color:TEXT3,marginBottom:3}}>CONFIDENCE</div>
                  <ConfBar v={k.confidence} w={52}/>
                  {k.direction&&<div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:2,marginTop:2}}>{k.direction==="up"?<TrendingUp size={8} color={RED}/>:<TrendingDown size={8} color={GREEN}/>}<span style={{fontSize:8,color:k.direction==="up"?RED:GREEN}}>vs benchmark</span></div>}
                </div>
              </div>
              <code style={{fontSize:8,color:TEXT3,fontFamily:"monospace"}}>{k.key} · {sha(k.key).slice(0,34)}…</code>
            </div>
          ))}
        </>
      );

      case 2: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Total spend by category with YoY trend. Categories with the highest avoidable spend are flagged.</div>
          </div>
          <SecHd label="Spend by Category — Plan Year 2024"/>
          {d.claimsBreakdown.map((r,i)=>(
            <div key={i} style={{padding:"9px 12px",background:"rgba(255,255,255,0.025)",border:`1px solid ${BORDER}`,borderRadius:8,marginBottom:5}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:11,color:r.cat.startsWith("  ›")?TEXT2:TEXT1,fontWeight:r.cat.startsWith("  ›")?400:600}}>{r.cat}</span>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:700,color:TEXT1}}>{r.spend}</span>
                  <span style={{fontSize:9,color:r.trend.includes("Avoidable")||r.trend.includes("watch")?RED:TEXT3}}>{r.trend}</span>
                </div>
              </div>
              <div style={{height:4,borderRadius:2,background:"rgba(15,23,42,0.03)",overflow:"hidden"}}>
                <div style={{width:`${r.pct}%`,height:"100%",background:r.pct>30?RED:r.pct>15?AMBER:GREEN,borderRadius:2}}/>
              </div>
              <div style={{fontSize:8,color:TEXT3,marginTop:2}}>{r.pct}% of total plan spend</div>
            </div>
          ))}
        </>
      );

      case 3: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Top cost drivers ranked by total annual spend. Flagged items represent intervention opportunities.</div>
          </div>
          <SecHd label="Top Cost Drivers"/>
          {d.topDrivers.map((r,i)=>(
            <div key={i} style={{padding:"10px 13px",background:"rgba(255,255,255,0.025)",border:`1px solid ${r.flag?RED+"28":BORDER}`,borderRadius:9,marginBottom:6}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:TEXT1,marginBottom:3}}>{r.name}</div>
                  {r.flag&&<span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:`${RED}15`,color:RED,fontWeight:700,letterSpacing:"0.06em"}}>{r.flag.toUpperCase()}</span>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:TEXT1}}>{r.spend}</div>
                  <div style={{fontSize:9,color:TEXT3}}>{r.pmpm} PMPM</div>
                </div>
              </div>
            </div>
          ))}
        </>
      );

      case 4: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Pricing mechanics are where leakage hides. These gaps are measured against contracted terms and peer benchmarks.</div>
          </div>
          <SecHd label="Pricing Mechanics — Gap Analysis"/>
          {d.pricingMechanics.map((r,i)=>{
            const c={red:RED,amber:AMBER,green:GREEN}[r.severity];
            return(
              <div key={i} style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${c}30`,borderRadius:9,marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:10,fontWeight:700,color:TEXT1,marginBottom:2}}>{r.mechanic}</div>
                    <div style={{fontSize:10,color:TEXT3}}>{r.gap}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:c}}>{r.impact}</div>
                    <span style={{fontSize:7,padding:"1px 5px",borderRadius:2,background:`${c}15`,color:c,fontWeight:700}}>{r.severity.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      );

      case 5: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Vendor economics expose where incentives are aligned — and where they aren't. Misaligned vendors earn more when you spend more.</div>
          </div>
          <SecHd label="Vendor Economics — Incentive Audit"/>
          {d.vendorEconomics.map((v,i)=>(
            <div key={i} style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${v.aligned?GREEN+"28":RED+"28"}`,borderRadius:9,marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:TEXT1,marginBottom:1}}>{v.vendor}</div>
                  <div style={{fontSize:10,color:TEXT3,marginBottom:3}}>{v.fee}</div>
                  <div style={{fontSize:9,color:TEXT2,fontStyle:"italic"}}>{v.model}</div>
                </div>
                <span style={{fontSize:8,padding:"2px 7px",borderRadius:3,background:v.aligned?`${GREEN}15`:`${RED}15`,color:v.aligned?GREEN:RED,fontWeight:700,flexShrink:0}}>
                  {v.aligned?"ALIGNED":"MISALIGNED"}
                </span>
              </div>
              <div style={{fontSize:9,color:TEXT3,paddingTop:5,borderTop:`1px solid ${BORDER2}`}}>↳ {v.note}</div>
            </div>
          ))}
        </>
      );

      case 6: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>These are the moves a CFO can defend with evidence. Each lever is scoped, timeboxed, and sized — not a consulting estimate.</div>
          </div>
          <SecHd label="Decision Levers"/>
          {tile.levers.map((l,i)=>(
            <div key={i} style={{padding:"14px 16px",background:"rgba(255,255,255,0.025)",border:`1px solid ${l.priority==="high"?RED+"30":AMBER+"28"}`,borderRadius:10,marginBottom:8}}>
              <div style={{display:"flex",gap:7,alignItems:"flex-start",marginBottom:10}}>
                <PBadge p={l.priority}/>
                <div style={{fontSize:12,fontWeight:600,color:TEXT1,lineHeight:1.4}}>{l.title}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div><div style={{fontSize:8,color:TEXT3,marginBottom:3}}>EXPECTED IMPACT</div><div style={{fontSize:16,fontWeight:800,color:GREEN}}>{l.impact_pmpm}<span style={{fontSize:9,color:TEXT3,marginLeft:3}}>PMPM</span></div></div>
                <div><div style={{fontSize:8,color:TEXT3,marginBottom:3}}>TIMEFRAME</div><div style={{fontSize:11,fontWeight:600,color:TEXT1}}>{l.timeframe}</div></div>
                <div><div style={{fontSize:8,color:TEXT3,marginBottom:3}}>RANGE</div><div style={{fontSize:9,color:TEXT2}}>{l.range}</div></div>
              </div>
            </div>
          ))}
          <div style={{marginTop:12,padding:"14px 16px",background:`${GREEN}08`,border:`1px solid ${GREEN}25`,borderRadius:10}}>
            <div style={{fontSize:9,fontWeight:700,color:GREEN,marginBottom:4}}>Total Lever Potential</div>
            <div style={{fontSize:24,fontWeight:900,color:GREEN}}>
              {tile.id==="ebitda-impact"?"−4.4":tile.id==="cost-leakage"?"−2.65":tile.id==="incentive-misalignment"?"−1.7":"−2.3"} <span style={{fontSize:11,color:TEXT3,fontWeight:400}}>PMPM</span>
            </div>
            <div style={{fontSize:9,color:TEXT3,marginTop:3}}>Governed, provable capital recovery — not a savings estimate.</div>
          </div>
        </>
      );

      case 7: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Peer benchmark comparison. Your position is shown against the median of self-funded plans of similar size and industry.</div>
          </div>
          <SecHd label="Peer Benchmarking — Self-Funded Plans, n=847"/>
          {d.benchmarks.map((b,i)=>(
            <div key={i} style={{padding:"10px 13px",background:"rgba(255,255,255,0.025)",border:`1px solid ${BORDER}`,borderRadius:9,marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
                <span style={{fontSize:10,fontWeight:600,color:TEXT1}}>{b.metric}</span>
                <span style={{fontSize:10,fontWeight:700,color:b.pct>=70?RED:AMBER}}>{b.delta}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:7}}>
                <div><div style={{fontSize:8,color:TEXT3,marginBottom:2}}>YOUR VALUE</div><div style={{fontSize:14,fontWeight:800,color:TEXT1}}>{b.yours}</div></div>
                <div><div style={{fontSize:8,color:TEXT3,marginBottom:2}}>PEER MEDIAN</div><div style={{fontSize:14,fontWeight:800,color:GREEN}}>{b.peer}</div></div>
              </div>
              <div style={{height:4,borderRadius:2,background:"rgba(15,23,42,0.03)",overflow:"hidden"}}>
                <div style={{width:`${b.pct}%`,height:"100%",background:b.pct>=75?RED:AMBER,borderRadius:2}}/>
              </div>
              <div style={{fontSize:8,color:TEXT3,marginTop:2}}>{b.pct}th percentile among peer set</div>
            </div>
          ))}
        </>
      );

      case 8: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Financial model projecting current state vs post-action recovery. Built from claims data, contract terms, and lever sizing.</div>
          </div>
          <SecHd label="Financial Impact Model — Current vs Recoverable"/>
          {d.financialModel.map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 13px",background:"rgba(255,255,255,0.025)",border:`1px solid ${i===0||i===d.financialModel.length-1||i===d.financialModel.length-2?r.color+"30":BORDER}`,borderRadius:9,marginBottom:5}}>
              <span style={{fontSize:10,color:TEXT2}}>{r.label}</span>
              <span style={{fontSize:14,fontWeight:800,color:r.color}}>{r.value}</span>
            </div>
          ))}
          <div style={{marginTop:14,padding:"12px 14px",background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER}`,borderRadius:9}}>
            <div style={{fontSize:9,color:TEXT3,lineHeight:1.7}}>Model assumptions: 1,200 member plan, 2024 claims basis, lever timelines as stated, 5% annual cost growth baseline, 6% discount rate for NPV calculations. All inputs are evidence-backed.</div>
          </div>
        </>
      );

      case 9: return(
        <>
          <div style={{padding:"12px 14px",background:"rgba(255,255,255,0.025)",border:`1px solid ${accent}20`,borderRadius:10,marginBottom:16}}>
            <div style={{fontSize:10,color:TEXT2,lineHeight:1.65}}>Every number has a receipt. Every receipt has a hash. Evidence chain and board-ready narrative — admissible at the board level.</div>
          </div>
          <SecHd label="Evidence Chain"/>
          {[
            {label:"Evidence Hash",       val:sha(tile.id+":evidence"),        color:CYAN},
            {label:"Transform Fingerprint",val:sha(tile.id+":transform:v3.0"), color:PURPLE},
            {label:"Policy Gate Record",   val:sha(tile.id+":gate:v2.1"),       color:GREEN},
            {label:"Claim Object Hash",    val:sha(tile.id+":claim:board"),     color:GOLD},
          ].map(e=>(
            <div key={e.label} style={{padding:"8px 12px",background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER}`,borderRadius:7,marginBottom:5}}>
              <div style={{fontSize:8,color:TEXT3,marginBottom:2}}>{e.label}</div>
              <code style={{fontSize:9,color:e.color,fontFamily:"monospace",wordBreak:"break-all"}}>{e.val}</code>
            </div>
          ))}
          <div style={{padding:"8px 12px",background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER}`,borderRadius:7,marginBottom:14}}>
            <div style={{fontSize:8,color:TEXT3,marginBottom:5}}>LINEAGE</div>
            {["Claims Feed → ClaimsNormalizer v3.2","KPIComposer v3.0 → PolicyGate v2.1","DeterministicValidator v1.4 → Claim Object → Board Tile"].map((l,i)=>(
              <div key={i} style={{display:"flex",gap:5,marginBottom:3}}><ArrowRight size={8} color={CYAN} style={{flexShrink:0,marginTop:2}}/><code style={{fontSize:9,color:TEXT3,fontFamily:"monospace"}}>{l}</code></div>
            ))}
          </div>
          <SecHd label="Board-Ready Narrative"/>
          <div style={{padding:"14px 16px",background:`${accent}08`,border:`1px solid ${accent}25`,borderRadius:10}}>
            <div style={{fontSize:11,color:TEXT1,lineHeight:1.75}}>{d.boardNarrative}</div>
          </div>
          <div style={{marginTop:10,display:"flex",gap:6}}>
            <span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${GREEN}15`,color:GREEN,fontWeight:700}}>✓ EVIDENCE-BACKED</span>
            <span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${CYAN}15`,color:CYAN,fontWeight:700}}>✓ HASH-VERIFIED</span>
            <span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:`${GOLD}15`,color:GOLD,fontWeight:700}}>✓ BOARD-ADMISSIBLE</span>
          </div>
        </>
      );

      default: return null;
    }
  };

  return(
    <div className="slide-right" style={{position:"fixed",top:0,right:0,width:520,height:"100vh",zIndex:300,background:"#ffffff",borderLeft:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",boxShadow:"-10px 0 30px rgba(0,0,0,0.05)"}}>

      {/* ── Sticky header ── */}
      <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${BORDER2}`,flexShrink:0,background:"#ffffff"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            <span style={{fontSize:8,fontWeight:800,letterSpacing:"0.13em",color:TEXT3}}>KINCAID HEALTH · {tile.id.toUpperCase().replace(/-/g," ")}</span>
            <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:`${GOLD}18`,color:GOLD,fontWeight:700,border:`1px solid ${GOLD}40`}}>DEMO</span>
          </div>
          <button onClick={onClose} data-testid="btn-close-drill" style={{background:"none",border:"none",cursor:"pointer",color:TEXT3,padding:2,display:"flex"}}><X size={13}/></button>
        </div>

        {/* Tile headline row */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
          <div>
            <div style={{fontSize:16,fontWeight:800,color:TEXT1}}>{tile.title}</div>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:6}}>
            <span style={{fontSize:32,fontWeight:900,color:accent,letterSpacing:"-0.02em"}}>{tile.headline}</span>
            <span style={{fontSize:11,color:TEXT3}}>{tile.unit}</span>
          </div>
          <PercBar v={tile.percentile} color={accent}/>
        </div>

        {/* Step label */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div>
            <span style={{fontSize:9,color:TEXT3}}>Step {step+1} of {TOTAL} — </span>
            <span style={{fontSize:9,fontWeight:700,color:accent}}>{STEP_LABELS[step]}</span>
          </div>
          <span style={{fontSize:9,color:TEXT3}}>{tile.title} drill-down</span>
        </div>

        {/* Progress dots */}
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          {Array.from({length:TOTAL},(_,i)=>(
            <button key={i} onClick={()=>setStep(i)} data-testid={`drill-step-dot-${i+1}`} title={STEP_LABELS[i]} style={{width:i===step?20:6,height:6,borderRadius:3,border:"none",cursor:"pointer",transition:"all .2s",background:i<step?`${accent}50`:i===step?accent:"rgba(0,0,0,0.12)",padding:0}}/>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:"auto",padding:"18px 20px"}}>
        <StepContent/>
      </div>

      {/* ── Footer nav ── */}
      <div style={{padding:"12px 20px",borderTop:`1px solid ${BORDER2}`,flexShrink:0,display:"flex",gap:8,alignItems:"center",background:"#ffffff"}}>
        <button onClick={()=>setStep(s=>Math.max(0,s-1))} disabled={step===0} data-testid="btn-drill-prev" style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${BORDER}`,background:"rgba(0,0,0,0.02)",color:step===0?TEXT3:TEXT1,cursor:step===0?"not-allowed":"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
          ← Prev
        </button>
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <a href="mailto:jer@kincaidrmc.com" style={{fontSize:10,color:accent,fontWeight:600,textDecoration:"none"}}>jer@kincaidrmc.com</a>
          <span style={{fontSize:10,color:TEXT3}}>·</span>
          <a href="tel:2192563331" style={{fontSize:10,color:TEXT2,textDecoration:"none"}}>219.256.3331</a>
        </div>
        {step<TOTAL-1
          ? <button onClick={()=>setStep(s=>s+1)} data-testid="btn-drill-next" style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${accent}50`,background:`${accent}18`,color:accent,cursor:"pointer",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:4}}>
              Next →
            </button>
          : <a href="mailto:jer@kincaidrmc.com" style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${accent}50`,background:`${accent}18`,color:accent,fontSize:11,fontWeight:700,textDecoration:"none"}}>
              Request Walkthrough →
            </a>
        }
      </div>
    </div>
  );
}

/* ─── STATUS BADGE HELPERS ──────────────────────────────────────────────────── */
function VBadge({s}:{s:VerifiedStatus}){
  const cfg={
    VERIFIED:  {bg:"rgba(34,197,94,0.12)", border:"rgba(34,197,94,0.3)",  color:GREEN,  icon:<CheckCircle2 size={9}/>},
    UNVERIFIED:{bg:"rgba(245,158,11,0.12)",border:"rgba(245,158,11,0.3)", color:AMBER,  icon:<AlertTriangle size={9}/>},
    DISPUTED:  {bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)",  color:RED,    icon:<ShieldAlert size={9}/>},
  }[s];
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color,fontSize:9,fontWeight:700}}>
      {cfg.icon}{s}
    </span>
  );
}
function FBadge({f}:{f:FreshnessStatus}){
  const cfg={
    GREEN: {bg:"rgba(34,197,94,0.12)", border:"rgba(34,197,94,0.3)",  color:GREEN},
    YELLOW:{bg:"rgba(245,158,11,0.12)",border:"rgba(245,158,11,0.3)", color:AMBER},
    RED:   {bg:"rgba(239,68,68,0.12)", border:"rgba(239,68,68,0.3)",  color:RED  },
  }[f];
  return(
    <span style={{display:"inline-flex",alignItems:"center",padding:"1px 6px",borderRadius:10,background:cfg.bg,border:`1px solid ${cfg.border}`,color:cfg.color,fontSize:8,fontWeight:700}}>
      {f}
    </span>
  );
}


/* ─── 8-GATE BADGE SYSTEM ───────────────────────────────────────────────────── */
type GateResult = { id:string; label:string; pass:boolean; detail:string; icon:React.ReactNode };

function deriveGates(kpi:VerifyKpi): GateResult[] {
  const violations = kpi.policy.violations ?? [];
  const hasViolation = (tag:string) => violations.some(v=>v.includes(tag));

  const evidencePass  = kpi.evidence.length > 0;
  const freshnessPass = kpi.policy.freshness_status === "GREEN";
  const sourcePass    = kpi.policy.verified_status  === "VERIFIED";
  const completePass  = !hasViolation("COMPLETENESS") && !hasViolation("MISSING");
  const transformPass = !!kpi.transform?.transform_hash;
  const policyPass    = kpi.policy.allowed !== false;
  const consensusPass = kpi.policy.confidence_score >= 0.80;
  const commitPass    = evidencePass && freshnessPass && sourcePass && completePass && transformPass && policyPass && consensusPass;

  return [
    { id:"G1", label:"Evidence Existence", pass:evidencePass,  icon:<FileText size={9}/>,
      detail: evidencePass
        ? `${kpi.evidence.length} evidence receipt${kpi.evidence.length!==1?"s":""} attached. Source IDs: ${kpi.evidence.map(e=>e.evidence_id).join(", ")}.`
        : "No evidence receipts attached. Gate G1 blocks commit until at least one authoritative source is linked." },
    { id:"G2", label:"Freshness Check",    pass:freshnessPass, icon:<Clock size={9}/>,
      detail: freshnessPass
        ? `Evidence freshness is GREEN — all receipts are within the allowed staleness window.`
        : `Evidence is stale (${kpi.policy.freshness_status}). Receipts older than the maximum allowed age trigger this gate. Refresh source data to unblock.` },
    { id:"G3", label:"Source Authority",   pass:sourcePass,    icon:<ShieldCheck size={9}/>,
      detail: sourcePass
        ? `Source verified (${kpi.policy.verified_status}). All evidence references an authoritative, permissioned data source.`
        : `Source is ${kpi.policy.verified_status}. Gate G3 requires VERIFIED status — confirm data provenance and re-attest source authority.` },
    { id:"G4", label:"Completeness",       pass:completePass,  icon:<Layers size={9}/>,
      detail: completePass
        ? `No completeness violations detected. All required fields and evidence slots are populated.`
        : `Completeness violation: ${violations.filter(v=>v.includes("COMPLETENESS")||v.includes("MISSING")).join("; ") || "missing required evidence fields"}.` },
    { id:"G5", label:"Transform Integrity",pass:transformPass, icon:<Hash size={9}/>,
      detail: transformPass
        ? `Transform hash present: ${kpi.transform.transform_hash.slice(0,16)}… Code version: ${kpi.transform.code_version}.`
        : "No transform hash recorded. Gate G5 requires a deterministic, versioned compute transform to be registered before commit." },
    { id:"G6", label:"Policy Compliance",  pass:policyPass,    icon:<Scale size={9}/>,
      detail: policyPass
        ? `Policy gate PASS. Reason: ${kpi.policy.reason_code}.`
        : `Policy gate BLOCKED. Reason: ${kpi.policy.reason_code}. Violations: ${violations.join("; ")||"see reason code"}.` },
    { id:"G7", label:"Compute Consensus",  pass:consensusPass, icon:<Cpu size={9}/>,
      detail: consensusPass
        ? `Confidence score ${Math.round(kpi.policy.confidence_score*100)}% ≥ 80% threshold. Compute consensus achieved across all verification passes.`
        : `Confidence score ${Math.round(kpi.policy.confidence_score*100)}% is below the 80% consensus threshold. Additional evidence or source re-attestation required.` },
    { id:"G8", label:"Commit Boundary",    pass:commitPass,    icon:<Lock size={9}/>,
      detail: commitPass
        ? `All 7 upstream gates PASS. KPI is fully committed to the proof ledger. SHA hash recorded.`
        : `Commit boundary BLOCKED. ${[!evidencePass&&"G1",!freshnessPass&&"G2",!sourcePass&&"G3",!completePass&&"G4",!transformPass&&"G5",!policyPass&&"G6",!consensusPass&&"G7"].filter(Boolean).join(", ")} must resolve first.` },
  ];
}

function GateBadgePanel({kpi}:{kpi:VerifyKpi}){
  const [open, setOpen] = useState<string|null>(null);
  const gates = deriveGates(kpi);
  return(
    <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
        <Lock size={11} color={CYAN}/>
        <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:TEXT3}}>COMMIT GATE RESULTS</span>
        <span style={{marginLeft:"auto",fontSize:9,color:TEXT3}}>
          {gates.filter(g=>g.pass).length}/8 PASS
        </span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {gates.map(g=>{
          const isOpen = open===g.id;
          const passColor = g.pass ? GREEN : RED;
          const passBg    = g.pass ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
          const passBorder= g.pass ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)";
          return(
            <div key={g.id}>
              <button
                data-testid={`badge-gate-${g.id}`}
                onClick={()=>setOpen(isOpen?null:g.id)}
                style={{
                  width:"100%",display:"flex",alignItems:"center",gap:8,
                  padding:"7px 10px",borderRadius:isOpen?"8px 8px 0 0":8,
                  background:passBg,border:`1px solid ${passBorder}`,
                  cursor:"pointer",transition:"all .15s",textAlign:"left",
                  borderBottom:isOpen?`1px solid ${passBorder}`:`1px solid ${passBorder}`,
                }}
              >
                <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                  width:18,height:18,borderRadius:"50%",
                  background:g.pass?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",
                  color:passColor,flexShrink:0}}>
                  {g.pass ? <CheckCircle2 size={10}/> : <AlertTriangle size={10}/>}
                </span>
                <span style={{fontSize:8,fontWeight:700,letterSpacing:"0.08em",color:TEXT3,flexShrink:0,width:20}}>{g.id}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4,color:passColor,fontSize:9,fontWeight:700,flex:1}}>
                  {g.icon}{g.label}
                </span>
                <span style={{fontSize:8,fontWeight:800,color:passColor,letterSpacing:"0.08em"}}>{g.pass?"PASS":"FAIL"}</span>
                <ChevronRight size={10} color={TEXT3} style={{transform:isOpen?"rotate(90deg)":"none",transition:"transform .15s",flexShrink:0}}/>
              </button>
              {isOpen&&(
                <div className="fade-up" style={{
                  padding:"10px 12px",background:"rgba(0,0,0,0.05)",
                  border:`1px solid ${passBorder}`,borderTop:"none",borderRadius:"0 0 8px 8px",
                }}>
                  <div style={{fontSize:10,color:TEXT2,lineHeight:1.7}}>{g.detail}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RECEIPT TRAIL PANEL ───────────────────────────────────────────────────── */
function ReceiptTrailPanel({kpi,onClose}:{kpi:VerifyKpi;onClose:()=>void}){
  const [aiQuery,setAiQuery]   = useState("");
  const [aiResp,setAiResp]     = useState<string|null>(null);
  const [aiLoading,setAiLoading]= useState(false);

  const askAi = async()=>{
    if(!aiQuery.trim()||aiLoading) return;
    setAiLoading(true); setAiResp(null);
    try{
      const r = await fetch("/api/verify/ai/recommendation",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kpiKey:kpi.kpi_key, recommendation:aiQuery.trim()}),
      });
      const d = await r.json();
      setAiResp(d.ai_response ?? "No response.");
    }catch(e){ setAiResp("Error calling AI service."); }
    finally{ setAiLoading(false); }
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex"}}>
      {/* backdrop */}
      <div style={{flex:1,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(3px)"}} onClick={onClose}/>
      {/* panel */}
      <div className="slide-right" style={{width:560,height:"100vh",background:"#ffffff",borderLeft:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",overflowY:"auto"}}>
        {/* Header */}
        <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.2em",color:TEXT3,marginBottom:8}}>KPI RECEIPT TRAIL · KINCAID HEALTH VERIFY™</div>
              <div style={{fontSize:20,fontWeight:700,color:TEXT1}}>{kpi.title}</div>
              <div style={{fontSize:10,color:TEXT3,marginTop:2,fontFamily:"monospace"}}>{kpi.kpi_key}</div>
            </div>
            <button onClick={onClose} data-testid="btn-close-receipt" style={{background:"none",border:`1px solid ${BORDER}`,borderRadius:"50%",width:28,height:28,cursor:"pointer",color:TEXT2,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <X size={13}/>
            </button>
          </div>
        </div>

        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>

          {/* Value + Policy row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,marginBottom:8}}>VALUE</div>
              <div style={{fontSize:28,fontWeight:700,color:TEXT1}}>
                {kpi.policy.allowed ? kpi.value : "BLOCKED"}
                {kpi.unit && <span style={{fontSize:13,color:TEXT3,marginLeft:4}}>{kpi.unit}</span>}
              </div>
              {kpi.trend && <div style={{fontSize:11,color:TEXT2,marginTop:6}}>{kpi.trend}</div>}
              <div style={{fontSize:10,color:TEXT3,marginTop:8,lineHeight:1.5}}>{kpi.threshold_note}</div>
            </div>
            <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,marginBottom:10}}>POLICY STATUS</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                <VBadge s={kpi.policy.verified_status}/>
                <FBadge f={kpi.policy.freshness_status}/>
                <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.3)",color:CYAN,fontSize:9,fontWeight:700}}>
                  {Math.round(kpi.policy.confidence_score*100)}% conf
                </span>
              </div>
              <div style={{fontSize:10,color:TEXT2}}>{kpi.policy.reason_code}</div>
            </div>
            {/* ─── 8 GATE BADGES ─────────────────────────────────────── */}
            <GateBadgePanel kpi={kpi}/>
          </div>

          {/* Formula */}
          <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
              <Scale size={11} color={CYAN}/>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:TEXT3}}>FORMULA</span>
            </div>
            <div style={{fontSize:11,color:TEXT2,lineHeight:1.7}}>{kpi.formula_text}</div>
          </div>

          {/* Evidence Receipts */}
          <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
              <FileText size={11} color={CYAN}/>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:TEXT3}}>EVIDENCE RECEIPTS</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {kpi.evidence.map(ev=>(
                <div key={ev.evidence_id} style={{padding:"10px 12px",background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER}`,borderRadius:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:600,color:TEXT1}}>{ev.source_name}</span>
                    <span style={{fontSize:9,color:TEXT3,fontFamily:"monospace"}}>{ev.evidence_id}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <Hash size={9} color={TEXT3}/>
                    <code style={{fontSize:10,color:CYAN,fontFamily:"monospace"}}>{ev.source_hash}</code>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Clock size={9} color={TEXT3}/>
                    <span style={{fontSize:10,color:TEXT2}}>{ev.received_at}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transform + Violations */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,marginBottom:8}}>TRANSFORM HASH</div>
              <code style={{fontSize:10,color:CYAN,fontFamily:"monospace",wordBreak:"break-all",display:"block",marginBottom:8}}>{kpi.transform.transform_hash}</code>
              <div style={{fontSize:10,color:TEXT2,marginBottom:2}}>Ver: {kpi.transform.code_version}</div>
              <div style={{fontSize:10,color:TEXT2,marginBottom:2,wordBreak:"break-all"}}>Params: {kpi.transform.params_hash}</div>
              <div style={{fontSize:10,color:TEXT2}}>Ran: {kpi.transform.executed_at}</div>
            </div>
            <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
              <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,marginBottom:8}}>VIOLATIONS</div>
              {kpi.policy.violations.length>0
                ? <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:6}}>
                    {kpi.policy.violations.map((v,i)=>(
                      <li key={i} style={{padding:"6px 8px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",fontSize:10,color:RED,lineHeight:1.5}}>{v}</li>
                    ))}
                  </ul>
                : <div style={{fontSize:11,color:GREEN}}>No blocking violations.</div>
              }
            </div>
          </div>


          {/* AI Recommendation */}
          <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
              <Cpu size={11} color={ACCENT}/>
              <span style={{fontSize:9,fontWeight:800,letterSpacing:"0.12em",color:TEXT3}}>AI FIDUCIARY RECOMMENDATION</span>
            </div>
            <textarea
              data-testid="input-ai-recommendation"
              value={aiQuery}
              onChange={e=>setAiQuery(e.target.value)}
              placeholder={`Ask about ${kpi.title}… (e.g. "What is the fastest recovery path for this drag?")`}
              style={{
                width:"100%", minHeight:60, background:"rgba(0,0,0,0.05)",
                border:`1px solid ${BORDER}`, borderRadius:8, color:TEXT1, fontSize:11,
                padding:"8px 10px", boxSizing:"border-box", resize:"vertical", outline:"none",
                fontFamily:"inherit", lineHeight:1.5,
              }}
              onKeyDown={e=>{ if(e.key==="Enter"&&(e.metaKey||e.ctrlKey)) askAi(); }}
            />
            <button
              data-testid="btn-ask-ai"
              onClick={askAi}
              disabled={aiLoading||!aiQuery.trim()}
              style={{
                marginTop:8, padding:"6px 16px", borderRadius:8, cursor:"pointer",
                background: aiLoading||!aiQuery.trim() ? "rgba(15,23,42,0.03)" : ACCENT,
                border:`1px solid ${aiLoading||!aiQuery.trim()?BORDER:ACCENT}`,
                color: aiLoading||!aiQuery.trim() ? TEXT3 : "#fff",
                fontSize:11, fontWeight:600, display:"flex", alignItems:"center", gap:6,
                transition:"all .2s",
              }}
            >
              {aiLoading ? <><RefreshCw size={11} className="spin"/>&nbsp;Analyzing…</> : "Ask Kincaid Health AI"}
            </button>
            {aiResp&&(
              <div className="fade-up" style={{marginTop:12,padding:"12px",background:"rgba(79,125,255,0.06)",border:`1px solid rgba(79,125,255,0.2)`,borderRadius:8}}>
                <div style={{fontSize:9,fontWeight:800,color:ACCENT,letterSpacing:"0.1em",marginBottom:8}}>AI RESPONSE · claude-sonnet-4-6</div>
                <div style={{fontSize:11,color:TEXT2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiResp}</div>
              </div>
            )}
          </div>

          {/* Lineage */}
          <div style={{padding:"16px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:14}}>
            <div style={{fontSize:8,fontWeight:800,letterSpacing:"0.14em",color:TEXT3,marginBottom:12}}>LINEAGE</div>
            <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:6}}>
              {["Source Artifact","Evidence","Transform","Policy"].map((step,i)=>(
                <span key={i} style={{display:"inline-flex",alignItems:"center",gap:6}}>
                  <span style={{padding:"3px 10px",borderRadius:20,background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER}`,fontSize:10,color:TEXT2}}>{step}</span>
                  <ChevronRight size={10} color={TEXT3}/>
                </span>
              ))}
              <span style={{padding:"3px 10px",borderRadius:20,background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.3)",fontSize:10,color:CYAN,fontWeight:700}}>Claim → Tile</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ─── VERIFY TILE CARD ───────────────────────────────────────────────────────── */
/* ─── APPLE BENTO TILE CARD ─────────────────────────────────────────────────── */
function AppleTileCard({
  tile, size, onOpen,
}:{
  tile:VerifyTile; size:"large"|"small"; onOpen:(k:VerifyKpi)=>void;
}){
  const _colors=VERIFY_COLORS[tile.id]??{accent:ACCENT,glow:'rgba(79,125,255,0.08)'};
  const {accent}=_colors;
  const p=tile.primary;
  const vDot={VERIFIED:GREEN,UNVERIFIED:AMBER,DISPUTED:RED}[p.policy.verified_status];
  const heroSize=size==="large"?64:48;

  return(
    <div
      data-testid={`tile-${tile.id}`}
      style={{
        background:"rgba(255,255,255,0.035)",
        borderRadius:24,
        padding:size==="large"?"32px 36px":"28px 30px",
        display:"flex",
        flexDirection:"column",
        justifyContent:"space-between",
        position:"relative",
        overflow:"hidden",
        cursor:"pointer",
        transition:"transform .2s ease, background .2s ease",
        border:"1px solid rgba(15,23,42,0.03)",
      }}
      onClick={()=>onOpen(p)}
      onMouseEnter={e=>{
        (e.currentTarget as HTMLDivElement).style.transform="translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.055)";
      }}
      onMouseLeave={e=>{
        (e.currentTarget as HTMLDivElement).style.transform="";
        (e.currentTarget as HTMLDivElement).style.background="rgba(255,255,255,0.035)";
      }}
    >
      {/* Ambient glow blob */}
      <div style={{position:"absolute",bottom:-60,right:-60,width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${_colors.glow} 0%,transparent 70%)`,pointerEvents:"none"}}/>

      {/* Top row: title + status dot */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"auto"}}>
        <div>
          <div style={{fontSize:11,fontWeight:500,color:TEXT2,letterSpacing:"0.01em",marginBottom:6}}>
            {tile.title}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:vDot,boxShadow:`0 0 6px ${vDot}`}}/>
          <span style={{fontSize:9,color:TEXT3,letterSpacing:"0.04em"}}>{p.policy.verified_status}</span>
        </div>
      </div>

      {/* Hero number */}
      <div style={{padding:"20px 0 16px"}}>
        <div style={{
          fontSize:heroSize,
          fontWeight:700,
          color:p.policy.allowed?TEXT1:RED,
          letterSpacing:"-0.04em",
          lineHeight:1,
          fontVariantNumeric:"tabular-nums",
        }}>
          {p.policy.allowed?p.value:"—"}
          {p.unit&&<span style={{fontSize:heroSize*0.35,color:TEXT3,fontWeight:400,marginLeft:4,letterSpacing:"-0.01em"}}>{p.unit}</span>}
        </div>
        <div style={{fontSize:12,color:TEXT2,marginTop:8,display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:accent,fontWeight:500}}>{p.title}</span>
          {p.trend&&<span style={{color:TEXT3}}>· {p.trend}</span>}
        </div>
      </div>

      {/* Supporting KPIs — bottom strip, no boxes */}
      <div style={{borderTop:"1px solid rgba(15,23,42,0.03)",paddingTop:14,display:"flex",gap:size==="large"?32:16}}>
        {tile.supporting.map(k=>(
          <button
            key={k.kpi_key}
            data-testid={`kpi-supporting-${k.kpi_key}`}
            onClick={e=>{e.stopPropagation();onOpen(k);}}
            style={{background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:3}}
          >
            <span style={{fontSize:9,color:TEXT3,letterSpacing:"0.04em",fontWeight:500}}>
              {k.title.toUpperCase()}
            </span>
            <span style={{
              fontSize:size==="large"?20:17,
              fontWeight:600,
              color:k.policy.allowed?(k.policy.freshness_status==="RED"?RED:TEXT1):RED,
              letterSpacing:"-0.02em",
              fontVariantNumeric:"tabular-nums",
            }}>
              {k.policy.allowed?k.value:"—"}
              {k.unit&&<span style={{fontSize:10,color:TEXT3,marginLeft:2}}>{k.unit}</span>}
            </span>
            <span style={{
              fontSize:8,
              color:{GREEN:GREEN,YELLOW:AMBER,RED:RED}[k.policy.freshness_status],
              fontWeight:600,
              letterSpacing:"0.05em",
            }}>
              {k.policy.freshness_status} · {Math.round(k.policy.confidence_score*100)}%
            </span>
          </button>
        ))}
        <div style={{marginLeft:"auto",alignSelf:"flex-end"}}>
          <span style={{fontSize:9,color:TEXT3,display:"flex",alignItems:"center",gap:3}}>
            Receipts <ChevronRight size={10} color={TEXT3}/>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── WAR ROOM — Apple bento, Z-pattern, full screen ────────────────────────── */
/* Adapter: TileKpi → VerifyKpi (same shape, renamed fields) */
function adaptKpi(k: TileKpi): VerifyKpi {
  return {
    kpi_key:        k.kpi_key,
    title:          k.title,
    value:          k.display_value,
    trend:          k.trend,
    formula_text:   k.formula_text,
    threshold_note: k.threshold_note,
    evidence:       k.evidence as VerifyKpi["evidence"],
    transform:      k.transform,
    policy:         k.policy as VerifyKpi["policy"],
  };
}
function adaptTile(t: Tile): VerifyTile {
  return { id: t.id, title: t.title, primary: adaptKpi(t.primary), supporting: t.supporting.map(adaptKpi) };
}

function WarRoomView({onKpiOpen}:{onKpiOpen:(k:VerifyKpi)=>void}){
  // Engine runs synchronously at module load — zero network latency
  const liveTiles: VerifyTile[] = WAR_ROOM.tiles.map(adaptTile);
  const allKpis  = liveTiles.flatMap(t=>[t.primary,...t.supporting]);
  const blocked  = allKpis.filter(k=>!k.policy.allowed).length;
  const verified = allKpis.filter(k=>k.policy.verified_status==="VERIFIED").length;
  const ver      = "kincaid_ui_engine_v1.0.0";

  return(
    <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",padding:"14px 20px 10px",boxSizing:"border-box",gap:12}}>

      {/* Minimal header */}
      <div className="fade-up" style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <div className="live-dot" style={{width:5,height:5,borderRadius:"50%",background:GREEN}}/>
            <span style={{fontSize:10,color:TEXT2,fontWeight:500,letterSpacing:"0.01em"}}>Kincaid Health VERIFY™</span>
          </div>
          <span style={{fontSize:10,color:TEXT3}}>·</span>
          <span style={{fontSize:10,color:TEXT3}}>Demo Employer · Plan Year 2024</span>
          <span style={{fontSize:9,color:TEXT3,fontStyle:"italic"}}>· {ver}</span>
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <span style={{fontSize:10,color:TEXT3}}>{allKpis.length} KPIs</span>
          <span style={{fontSize:10,color:GREEN,fontWeight:600}}>{verified} verified</span>
          {blocked>0&&<span style={{fontSize:10,color:RED,fontWeight:600}}>{blocked} blocked</span>}
        </div>
      </div>

      {/* Equal 2x2 grid */}
      <div style={{
        flex:1,
        display:"grid",
        gridTemplateColumns:"repeat(2,1fr)",
        gridTemplateRows:"1fr 1fr",
        gap:12,
        minHeight:0,
      }}>
        {liveTiles.map(tile=>(
          <AppleTileCard key={tile.id} tile={tile} size="large" onOpen={onKpiOpen}/>
        ))}
      </div>

      {/* Footer */}
      <div style={{flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",padding:"6px 0",gap:6}}>
        <Sparkles size={8} color={GOLD}/>
        <span style={{fontSize:9,color:TEXT3,fontStyle:"italic",letterSpacing:"0.01em"}}>
          Dashboards show numbers. Kincaid Health shows receipts.
        </span>
      </div>
    </div>
  );
}


/* ─── BOARD EXPORT BUTTON (bottom-left, gated on boardPackGate) ────────────── */
function BoardExportButton(){
  const {allowed, reasons} = WAR_ROOM.boardPack;
  const [showBlock, setShowBlock] = useState(false);
  const [exported, setExported]   = useState(false);

  const handleClick = () => {
    if(!allowed){
      setShowBlock(true);
      setTimeout(()=>setShowBlock(false), 4000);
      return;
    }
    setExported(true);
    setTimeout(()=>setExported(false), 3000);
  };

  const posture = WAR_ROOM.fiduciaryPosture;

  return(
    <div style={{position:"fixed",bottom:20,left:20,zIndex:200,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:8}}>
      {/* Block reasons popover */}
      {showBlock&&(
        <div className="fade-up" style={{
          background:"rgba(239,68,68,0.12)",
          border:`1px solid ${RED}`,
          borderRadius:10,
          padding:"10px 14px",
          maxWidth:260,
        }}>
          <div style={{fontSize:10,color:RED,fontWeight:700,marginBottom:6,letterSpacing:"0.04em"}}>EXPORT BLOCKED</div>
          {reasons.map((r,i)=>(
            <div key={i} style={{fontSize:9,color:TEXT2,marginBottom:2}}>· {r}</div>
          ))}
        </div>
      )}
      {/* Success popover */}
      {exported&&(
        <div className="fade-up" style={{
          background:"rgba(34,197,94,0.12)",
          border:`1px solid ${GREEN}`,
          borderRadius:10,
          padding:"10px 14px",
          maxWidth:260,
        }}>
          <div style={{fontSize:10,color:GREEN,fontWeight:700,marginBottom:4}}>BOARD PACK GENERATED</div>
          <div style={{fontSize:9,color:TEXT2}}>Fiduciary score: {posture.score} · {WAR_ROOM.tiles.flatMap(t=>[t.primary,...t.supporting]).filter(k=>k.policy.allowed).length} KPIs committed</div>
        </div>
      )}
      {/* Button */}
      <button
        data-testid="btn-board-export"
        onClick={handleClick}
        style={{
          background: allowed ? "rgba(15,23,42,0.03)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${allowed ? BORDER : RED}`,
          borderRadius:10,
          padding:"8px 16px",
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          gap:8,
          transition:"background .2s",
        }}
        onMouseEnter={e=>(e.currentTarget.style.background=allowed?"rgba(15,23,42,0.06)":"rgba(239,68,68,0.15)")}
        onMouseLeave={e=>(e.currentTarget.style.background=allowed?"rgba(15,23,42,0.03)":"rgba(239,68,68,0.08)")}
      >
        <FileText size={12} color={allowed?TEXT1:RED}/>
        <span style={{fontSize:11,fontWeight:600,color:allowed?TEXT1:RED,letterSpacing:"0.02em"}}>
          {allowed ? "Export Board Pack" : "Export Blocked"}
        </span>
        {!allowed&&<AlertOctagon size={11} color={RED}/>}
      </button>
    </div>
  );
}

/* ─── SECONDARY TABS ─────────────────────────────────────────────────────────── */
function ShadowTaxView(){
  const rows=[
    {cat:"PBM Spread Pricing",   v:"$387K",rate:"2.7%",src:"PBM remittance + claims",conf:.83},
    {cat:"Admin Fee Inflation",  v:"$218K",rate:"1.5%",src:"Contract disclosure",    conf:.90},
    {cat:"Rebate Retention",     v:"$142K",rate:"1.0%",src:"PBM contract terms",     conf:.84},
    {cat:"SL Premium Over-Rate", v:"$198K",rate:"1.4%",src:"Carrier renewal",        conf:.78},
    {cat:"GLP-1 Leakage",        v:"$95K", rate:"0.7%",src:"Rx claims + NDC data",   conf:.80},
  ];
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"36px 28px"}}>
      <h2 style={{fontSize:22,fontWeight:800,color:TEXT1,marginBottom:4}}>Shadow Tax Exposure</h2>
      <p style={{fontSize:12,color:TEXT2,marginBottom:24}}>Hidden costs embedded in vendor contracts — reducing employer EBITDA without line-item disclosure.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:22}}>
        {[{l:"Total Shadow Tax",v:"$1,040K",c:RED},{l:"Shadow Rate",v:"7.3% of benefits spend",c:AMBER},{l:"5-Year EBITDA Impact",v:"~$5.2M NPV",c:RED}].map(s=>(
          <div key={s.l} style={{padding:"16px 18px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:12}}>
            <div style={{fontSize:9,color:TEXT3,marginBottom:6}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr>{["Category","Exposure","Rate","Source","Confidence"].map(h=><th key={h} style={{fontSize:8,fontWeight:800,letterSpacing:"0.1em",color:TEXT3,padding:"6px 10px",textAlign:"left",borderBottom:`1px solid ${BORDER}`}}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r=><tr key={r.cat} style={{borderBottom:`1px solid ${BORDER2}`}}><td style={{fontSize:11,color:TEXT1,padding:"9px 10px"}}>{r.cat}</td><td style={{fontSize:12,fontWeight:800,color:RED,padding:"9px 10px"}}>{r.v}</td><td style={{fontSize:10,color:AMBER,padding:"9px 10px"}}>{r.rate}</td><td style={{fontSize:10,color:TEXT3,padding:"9px 10px"}}>{r.src}</td><td style={{padding:"9px 10px"}}><ConfBar v={r.conf} w={36}/></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function ZeroTrustView(){
  const det=[{name:"Net Cost PMPM Calculator",hash:"tfm:4a9c2f1e",ver:"v3.2.1"},{name:"PBM Spread Analyzer",hash:"tfm:7b3d1a8c",ver:"v2.0.0"},{name:"Incentive Misalignment Scorer",hash:"tfm:2c7f4d9b",ver:"v2.3.1"},{name:"Risk Formation Engine",hash:"tfm:9e1b6c3d",ver:"v2.0.0"},{name:"EBITDA Impact Composer",hash:"tfm:5f2a8d4c",ver:"v3.0.0"}];
  const gen=[{name:"Kendra™ Client Concierge",type:"GPT-4o",bounds:"Advisory only — no board outputs without deterministic gate pass."},{name:"Narrative Summarizer",type:"Claude",bounds:"All outputs validated by DeterministicValidator. Not shown in board tiles without admin approval."},{name:"Scenario Modeler",type:"GPT-4o",bounds:"Draft modeling only — scenarios require evidence-based inputs to publish."}];
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"36px 28px"}}>
      <h2 style={{fontSize:22,fontWeight:800,color:TEXT1,marginBottom:4}}>Zero-Trust AI Governance</h2>
      <p style={{fontSize:12,color:TEXT2,marginBottom:24}}>Deterministic engines govern all board-facing numbers. <strong style={{color:GOLD}}>AI may assist. It may not overrule proof.</strong></p>
      <div style={{marginBottom:20}}><SecHd label="Deterministic Engines — Board-Eligible"/>{det.map(e=><div key={e.name} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",background:`${GREEN}06`,border:`1px solid ${GREEN}18`,borderRadius:8,marginBottom:6}}><Cpu size={10} color={GREEN}/><span style={{fontSize:11,color:TEXT1,fontWeight:600,flex:1}}>{e.name}</span><code style={{fontSize:9,color:PURPLE,fontFamily:"monospace"}}>{e.hash}</code><span style={{fontSize:9,color:TEXT3}}>{e.ver}</span></div>)}</div>
      <div><SecHd label="Generative Assistants — Advisory Only"/>{gen.map(g=><div key={g.name} style={{padding:"10px 13px",background:`${AMBER}06`,border:`1px solid ${AMBER}18`,borderRadius:8,marginBottom:6}}><div style={{display:"flex",gap:10,alignItems:"center",marginBottom:4}}><FlaskConical size={10} color={AMBER}/><span style={{fontSize:11,color:TEXT1,fontWeight:600,flex:1}}>{g.name}</span><span style={{fontSize:8,color:TEXT3}}>{g.type}</span><span style={{fontSize:7,color:AMBER,padding:"1px 5px",background:`${AMBER}15`,borderRadius:2,fontWeight:700}}>ADVISORY</span></div><div style={{fontSize:10,color:TEXT2,paddingLeft:20}}>{g.bounds}</div></div>)}</div>
    </div>
  );
}


function PostureView(){
  const all=TILES.flatMap(t=>t.kpis);
  const det=all.filter(k=>k.confidence>=.80).length/all.length;
  const fresh=0.72;
  const gov=det;
  const fps=Math.round(det*.40*100+fresh*.35*100+gov*.25*100);
  const fc=fps>=80?GREEN:fps>=60?AMBER:RED;
  return(
    <div style={{maxWidth:900,margin:"0 auto",padding:"36px 28px"}}>
      <h2 style={{fontSize:22,fontWeight:800,color:TEXT1,marginBottom:4}}>Fiduciary Posture Score</h2>
      <p style={{fontSize:12,color:TEXT2,marginBottom:20}}>FPS = (Deterministic Coverage × 0.40) + (Evidence Freshness × 0.35) + (Governance Compliance × 0.25)</p>
      <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
        <div style={{padding:"20px 24px",background:CARD_BG,border:`1px solid ${fc}40`,borderRadius:14,minWidth:130}}><div style={{fontSize:9,color:TEXT3,marginBottom:6}}>FIDUCIARY POSTURE SCORE</div><div style={{fontSize:48,fontWeight:900,color:fc,lineHeight:1}}>{fps}</div><div style={{fontSize:10,color:TEXT3}}>/ 100</div></div>
        {[{l:"Deterministic Coverage",v:Math.round(det*100),n:"× 0.40"},{l:"Evidence Freshness",v:Math.round(fresh*100),n:"× 0.35 — stale PBM invoice"},{l:"Governance Compliance",v:Math.round(gov*100),n:"× 0.25"}].map(s=>{const sc=s.v>=80?GREEN:s.v>=60?AMBER:RED;return<div key={s.l} style={{padding:"16px 20px",background:CARD_BG,border:`1px solid ${sc}28`,borderRadius:14,minWidth:130}}><div style={{fontSize:8,color:TEXT3,marginBottom:4}}>{s.l.toUpperCase()}</div><div style={{fontSize:26,fontWeight:800,color:sc}}>{s.v}</div><div style={{fontSize:8,color:TEXT3}}>{s.n}</div></div>;})}
      </div>
      <SecHd label="KPI Confidence Status"/>
      {all.map(k=>{const ok=k.confidence>=.80;return<div key={k.key} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:`1px solid ${BORDER2}`}}>{ok?<CheckCircle2 size={10} color={GREEN}/>:<AlertTriangle size={10} color={RED}/>}<span style={{fontSize:11,color:TEXT1,flex:1}}>{k.label}</span><ConfBar v={k.confidence} w={44}/><span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:ok?`${GREEN}15`:`${RED}15`,color:ok?GREEN:RED,fontWeight:700}}>{ok?"APPROVED":"BLOCKED"}</span></div>;})}
    </div>
  );
}

function BoardPackView(){
  const blocked=TILES.flatMap(t=>t.kpis).filter(k=>k.confidence<.80);
  return(
    <div style={{maxWidth:960,margin:"0 auto",padding:"36px 28px"}}>
      <h2 style={{fontSize:22,fontWeight:800,color:TEXT1,marginBottom:4}}>Board Pack — Export Locked</h2>
      <p style={{fontSize:12,color:TEXT2,marginBottom:18}}>Truth, gated by proof. The system refuses to publish numbers that aren't admissible.</p>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"14px 18px",background:`${RED}0d`,border:`1px solid ${RED}40`,borderRadius:12,marginBottom:18}}>
        <Lock size={16} color={RED} style={{flexShrink:0,marginTop:2}}/>
        <div><div style={{fontSize:13,fontWeight:700,color:RED,marginBottom:2}}>EXPORT_EVIDENCE_REQUIRED</div><div style={{fontSize:11,color:TEXT2}}>{blocked.length} KPI(s) below 80% confidence minimum — board publication blocked.</div></div>
      </div>
      <SecHd label="Blocking KPIs"/>
      {blocked.map(k=><div key={k.key} style={{display:"flex",gap:8,alignItems:"flex-start",padding:"10px 13px",background:`${RED}06`,border:`1px solid ${RED}18`,borderRadius:9,marginBottom:5}}><XCircle size={10} color={RED} style={{flexShrink:0,marginTop:2}}/><div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:TEXT1,marginBottom:2}}>{k.label}</div><div style={{fontSize:9,color:TEXT3}}>Confidence: {(k.confidence*100).toFixed(0)}% — below 80% minimum</div></div><ConfBar v={k.confidence} w={44}/></div>)}
      <div style={{padding:"14px 18px",background:`${AMBER}06`,border:`1px solid ${AMBER}18`,borderRadius:10,marginTop:18,marginBottom:18}}>
        <SecHd label="Remediation Path"/>
        {["Refresh PBM Invoice — updated TrueRx data for current quarter (resolves REBATE_LEAKAGE_RISK)","Complete UM friction verification — carrier confirmation required (resolves UM_FRICTION_INDEX)","Guarantee exclusion rate evidence chain — contract confirmation needed","Steerage alignment — validate against updated PBM network directory"].map((s,i)=><div key={i} style={{display:"flex",gap:5,marginBottom:5}}><span style={{fontSize:10,color:AMBER,flexShrink:0}}>{i+1}.</span><span style={{fontSize:10,color:TEXT2}}>{s}</span></div>)}
      </div>
      <div style={{padding:"18px 20px",background:CARD_BG,border:`1px solid ${BORDER}`,borderRadius:12}}>
        <SecHd label="Approved for Preview (not for export)"/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
          {TILES.map(t=>{const {accent}=TILE_COLORS[t.id];return<div key={t.id} style={{padding:"12px 14px",background:"rgba(0,0,0,0.25)",border:`1px solid ${accent}28`,borderRadius:10}}><div style={{fontSize:8,fontWeight:800,color:accent,textTransform:"uppercase",marginBottom:4}}>{t.title}</div><div style={{fontSize:18,fontWeight:900,color:TEXT1}}>{t.headline}</div><div style={{fontSize:8,color:TEXT3}}>{t.unit}</div></div>;})}
        </div>
        <p style={{fontSize:10,color:TEXT2,lineHeight:1.7,margin:0}}>Demo Employer · Plan Year 2024 · Live Analysis · Verified claims data · Production math. Once all confidence thresholds are met, export generates a polished executive packet with governance status, four-tile summary, top findings, recoverable value summary, and proof references.</p>
      </div>
    </div>
  );
}

/* ─── ROOT COMPONENT ────────────────────────────────────────────────────────── */
// ════════════════════════════════════════════════════════════════════════════
// DOL 5500 INTELLIGENCE TAB — Live KIQ v10 tile + drill engine
// ════════════════════════════════════════════════════════════════════════════

function Dol5500View({tiles,loading,status}:{tiles:any;loading:boolean;status:any}){
  const [selectedTile, setSelectedTile] = useState<any>(null);
  const [drillKpi,     setDrillKpi]     = useState<any>(null);
  const [claimData,    setClaimData]    = useState<any>(null);
  const [loadingDrill, setLoadingDrill] = useState(false);

  const duckLive  = status?.duckdb_live  ?? false;
  const tileList  = tiles?.tiles         ?? [];
  const isFallback = tileList[0]?.evidence?.is_fallback ?? true;

  const DEFCOL: Record<string,string> = {green:GREEN, yellow:AMBER, red:RED};

  // KPI drill via API
  const loadKpiDrill = async (eid:string, tile_key:string) => {
    setLoadingDrill(true);
    setDrillKpi(null); setClaimData(null);
    try {
      const r = await fetch(`/api/kiq/kpis/${eid}?tile=${tile_key}`);
      const d = await r.json();
      setDrillKpi(d);
    } catch(e){ console.error(e); }
    setLoadingDrill(false);
  };

  // Claim receipt via API
  const loadClaim = async (eid:string, claimId:string) => {
    setLoadingDrill(true);
    setClaimData(null);
    try {
      const r = await fetch(`/api/kiq/claim/${eid}/${claimId}`);
      const d = await r.json();
      setClaimData(d);
    } catch(e){ console.error(e); }
    setLoadingDrill(false);
  };

  const fmtVal = (v:number, unit:string) => {
    if(unit==="USD") return `$${(v/1_000_000).toFixed(2)}M`;
    if(unit==="PMPM") return `$${v.toFixed(2)} PMPM`;
    if(unit==="PERCENT") return `${v.toFixed(1)}%`;
    return `${v}`;
  };

  return(
    <div style={{padding:20,maxWidth:1400,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:9,fontWeight:900,color:ACCENT,letterSpacing:"0.18em",textTransform:"uppercase",marginBottom:4}}>
            ◈ DOL EFAST2 Intelligence Engine · Form 5500 Analytics · v10.0
          </div>
          <div style={{fontSize:18,fontWeight:900,color:TEXT1}}>
            4-Tile Executive War Room  <span style={{fontSize:11,fontWeight:400,color:TEXT2}}>RULE 1: always exactly 4 tiles</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,background:duckLive?`${GREEN}15`:`${AMBER}15`,border:`1px solid ${duckLive?GREEN:AMBER}40`}}>
            <div className="live-dot" style={{width:6,height:6,borderRadius:"50%",background:duckLive?GREEN:AMBER}}/>
            <span style={{fontSize:10,fontWeight:700,color:duckLive?GREEN:AMBER}}>
              {duckLive?`DuckDB LIVE · ${status?.duckdb_tables} tables · 757K rows`:"FALLBACK MODE · Upload data/dol5500.duckdb to go live"}
            </span>
          </div>
          {isFallback && (
            <div style={{fontSize:9,color:AMBER,padding:"4px 10px",background:`${AMBER}10`,borderRadius:6,border:`1px solid ${AMBER}30`}}>
              Evidence-anchored fallback · confidence 72%
            </div>
          )}
        </div>
      </div>

      {/* 4 Tiles — R1 */}
      {loading ? (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[1,2,3,4].map(i=>(
            <div key={i} style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:13,padding:19,height:129,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div className="spin" style={{width:20,height:20,border:`2px solid ${ACCENT}`,borderTopColor:"transparent",borderRadius:"50%"}}/>
            </div>
          ))}
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {tileList.map((tile:any)=>{
            const dc = DEFCOL[tile.defensibility] ?? TEXT2;
            const isSelected = selectedTile?.tile_key===tile.tile_key;
            return(
              <div key={tile.tile_key} data-testid={`kiq-tile-${tile.tile_key}`}
                onClick={()=>{ setSelectedTile(tile); setDrillKpi(null); setClaimData(null); loadKpiDrill("ENTITY_001", tile.tile_key); }}
                style={{background:isSelected?`rgba(79,125,255,0.06)`:"rgba(255,255,255,0.02)",border:`1px solid ${isSelected?ACCENT:dc}28`,borderRadius:13,padding:16,cursor:"pointer",transition:"all .2s",position:"relative"}}>
                <div style={{fontSize:8,fontWeight:900,color:TEXT3,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:8}}>{tile.tile_key.replace(/_/g," ")}</div>
                <div style={{fontSize:9,color:TEXT2,marginBottom:6,lineHeight:1.4}}>{tile.label}</div>
                <div style={{fontSize:19,fontWeight:900,color:TEXT1,marginBottom:3,lineHeight:1}}>
                  {fmtVal(tile.value, tile.unit)}
                </div>
                <div style={{fontSize:9,color:dc,fontWeight:700,marginBottom:6}}>{tile.unit}</div>
                <div style={{fontSize:8,color:dc,padding:"2px 7px",borderRadius:4,background:`${dc}15`,border:`1px solid ${dc}30`,display:"inline-block",marginBottom:8,textTransform:"uppercase",fontWeight:900}}>
                  {tile.defensibility}
                </div>
                <div style={{fontSize:9,color:TEXT3,lineHeight:1.4,marginBottom:8}}>{tile.sub}</div>
                <div style={{fontSize:8,color:ACCENT}}>
                  {tile.delta} · P{tile.benchmark_pct} vs peers
                </div>
                {/* Evidence hash */}
                <div style={{marginTop:10,paddingTop:8,borderTop:`1px solid ${BORDER2}`,display:"flex",alignItems:"center",gap:4}}>
                  <Hash size={7} color={TEXT3}/>
                  <span style={{fontSize:7,color:TEXT3,fontFamily:"monospace"}}>{tile.evidence?.sha256?.slice(0,14)}…</span>
                  <span style={{fontSize:7,padding:"1px 4px",background:tile.evidence?.is_fallback?`${AMBER}15`:`${GREEN}15`,color:tile.evidence?.is_fallback?AMBER:GREEN,borderRadius:2,fontWeight:700}}>
                    {tile.evidence?.is_fallback?"FALLBACK":"VERIFIED"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Drill panel — R2 Level 1 */}
      {selectedTile && (
        <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${ACCENT}28`,borderRadius:16,padding:20}}>
          <div style={{fontSize:9,fontWeight:900,color:ACCENT,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:12}}>
            ◈ KPI DRILL — {selectedTile.label} · RULE 2 LEVEL 1
          </div>
          {loadingDrill && !drillKpi ? (
            <div style={{color:TEXT3,fontSize:11}}>Loading KPI data…</div>
          ) : drillKpi?.kpis ? (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
              {drillKpi.kpis.map((kpi:any)=>{
                const dc = DEFCOL[kpi.defensibility] ?? TEXT2;
                return(
                  <div key={kpi.kpi_id} data-testid={`kiq-kpi-${kpi.kpi_id}`}
                    style={{background:"rgba(0,0,0,0.2)",border:`1px solid ${BORDER}`,borderRadius:10,padding:14,cursor:"pointer"}}
                    onClick={()=>loadClaim("ENTITY_001", `CLM-${kpi.kpi_id.slice(-3)}-01`)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontSize:8,color:TEXT3,fontFamily:"monospace"}}>{kpi.kpi_id}</div>
                      <div style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:kpi.verified?`${GREEN}15`:`${RED}15`,color:kpi.verified?GREEN:RED,fontWeight:900,textTransform:"uppercase"}}>
                        {kpi.verified?"VERIFIED":"UNVERIFIED"}
                      </div>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:TEXT1,marginBottom:4}}>{kpi.label}</div>
                    <div style={{fontSize:16,fontWeight:900,color:dc,marginBottom:2}}>{fmtVal(kpi.value,kpi.unit)}</div>
                    <div style={{display:"flex",gap:8,marginTop:8}}>
                      <div style={{fontSize:8,color:TEXT3}}>Sched {kpi.schedule} · {kpi.line}</div>
                      <div style={{fontSize:8,color:kpi.confidence>=0.80?GREEN:RED,fontWeight:700}}>{Math.round(kpi.confidence*100)}% conf</div>
                    </div>
                    <div style={{fontSize:8,color:ACCENT,marginTop:6,display:"flex",alignItems:"center",gap:3}}>
                      <ChevronRight size={8}/> Click to load claim receipt
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {/* Claim Receipt — R2 Level 3 */}
      {claimData && (
        <div style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${GREEN}28`,borderRadius:16,padding:20}}>
          <div style={{fontSize:9,fontWeight:900,color:GREEN,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:12}}>
            ◈ CLAIM RECEIPT · RULE 2 LEVEL 3 · TERMINAL NODE · SHA-256 SEALED
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:12}}>
            {[
              {l:"Claim ID",       v:claimData.claim_id},
              {l:"Amount",         v:`$${Number(claimData.amount).toLocaleString()}`},
              {l:"Provider",       v:claimData.provider_name},
              {l:"Member ID",      v:claimData.member_id ?? "—"},
              {l:"Service Date",   v:claimData.service_date},
              {l:"Channel",        v:claimData.channel},
              {l:"Diagnosis",      v:claimData.diagnosis},
              {l:"Procedure",      v:claimData.procedure},
              {l:"Source",         v:claimData.source},
            ].map(f=>(
              <div key={f.l} style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px"}}>
                <div style={{fontSize:8,color:TEXT3,marginBottom:3}}>{f.l}</div>
                <div style={{fontSize:11,fontWeight:700,color:TEXT1}}>{f.v}</div>
              </div>
            ))}
          </div>
          {claimData.evidence && (
            <div style={{background:"rgba(0,0,0,0.05)",border:`1px solid ${BORDER2}`,borderRadius:10,padding:"10px 14px",fontFamily:"monospace",fontSize:10,color:TEXT3}}>
              <span style={{color:GREEN,fontWeight:700}}>SHA-256:</span> {claimData.evidence.sha256} &nbsp;·&nbsp;
              <span style={{color:CYAN}}>Lineage:</span> {claimData.evidence.lineage_chain} &nbsp;·&nbsp;
              <span style={{color:GREEN,fontWeight:700}}>LINEAGE_COMPLETE: {claimData.lineage_complete?"✓":"✗"}</span>
            </div>
          )}
        </div>
      )}

      {/* DOL 5500 status footer */}
      {status && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[
            {l:"API Live",       v:status.api_live?"✓ YES":"✗ NO",   c:status.api_live?GREEN:RED},
            {l:"DuckDB",         v:status.duckdb_live?"✓ LIVE":"FALLBACK", c:status.duckdb_live?GREEN:AMBER},
            {l:"Tables",         v:String(status.duckdb_tables),      c:TEXT2},
            {l:"Rows",           v:"757,294",                          c:TEXT2},
            {l:"Evidence Vault", v:status.evidence_vault,              c:GREEN},
            {l:"Data Vintage",   v:status.data_freshness,              c:TEXT2},
            {l:"Freshness",      v:`${status.freshness_days}d`,        c:TEXT2},
            {l:"R1",             v:"4-tiles-always",                   c:ACCENT},
            {l:"R2",             v:"every-number-clickable",           c:ACCENT},
            {l:"R3",             v:"no-export-without-receipts",       c:ACCENT},
            {l:"R4",             v:"evidence-bounded",                 c:ACCENT},
          ].map(s=>(
            <div key={s.l} style={{padding:"4px 10px",background:"rgba(255,255,255,0.02)",border:`1px solid ${BORDER}`,borderRadius:6,display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:8,color:TEXT3}}>{s.l}</span>
              <span style={{fontSize:9,fontWeight:700,color:s.c}}>{s.v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExecutiveWarRoom(){
  const [activeTab,setActiveTab]=usePersistentState<ControlTab>("execwarroom:tab","warroom");
  const [selectedKpi,setSelectedKpi]=useState<VerifyKpi|null>(null);
  const [lastRefresh,setLastRefresh]=useState(new Date());
  const [refreshing,setRefreshing]=useState(false);

  // ── Live DOL 5500 data layer ─────────────────────────────────────────────
  const {data:kiqStatus} = useQuery<any>({
    queryKey:["/api/kiq/status"],
    refetchInterval: 60_000,
    retry: false,
  });
  const {data:kiqTiles,isLoading:tilesLoading} = useQuery<any>({
    queryKey:["/api/kiq/tiles/executive"],
    refetchInterval: 120_000,
    retry: false,
  });

  const doRefresh=useCallback(()=>{
    setRefreshing(true);
    setTimeout(()=>{setLastRefresh(new Date());setRefreshing(false);},700);
  },[]);
  useEffect(()=>{const id=setInterval(doRefresh,60_000);return()=>clearInterval(id);},[doRefresh]);

  // ── Cross-app company handoff (reads ?ein=&company= from URL) ────────────────
  const [handoffEin,setHandoffEin]=useState<string|null>(null);
  const [handoffCompany,setHandoffCompany]=useState<string|null>(null);
  const [handoffDismissed,setHandoffDismissed]=useState(false);
  const {sendTo:sendCompanyTo}=useCompanyHandoff();

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const ein=params.get("ein"); const company=params.get("company");
    if(ein){setHandoffEin(ein);setHandoffCompany(company||ein);}
  },[]);

  const {data:handoffProfile,isLoading:handoffLoading}=useQuery<any>({
    queryKey:["/api/benchmark/employer",handoffEin],
    enabled:!!handoffEin&&!handoffDismissed,
    queryFn:()=>fetch(`/api/benchmark/employer/${handoffEin}?year=2023`,{
      headers:{Authorization:`Bearer ${localStorage.getItem("token")}`},
    }).then(r=>r.json()),
  });


  const TABS:{id:ControlTab;label:string;icon:React.ReactNode;color:string}[]=[
    {id:"warroom",    label:"War Room",              icon:<LayoutDashboard size={10}/>, color:"#00D4FF"},
    {id:"dol5500",    label:"DOL 5500 Intelligence", icon:<Database size={10}/>,        color:"#10B981"},
    {id:"shadow-tax", label:"Shadow Tax Exposure",   icon:<Eye size={10}/>,             color:"#F5A623"},
    {id:"zero-trust", label:"Zero-Trust Governance", icon:<ShieldOff size={10}/>,       color:"#FF4D6D"},
    {id:"posture",    label:"Fiduciary Posture",      icon:<BarChart3 size={10}/>,       color:"#BF5FFF"},
    {id:"board-pack", label:"Board Pack",             icon:<FileText size={10}/>,        color:"#FFB800"},
  ];

  return(
    <Layout fullBleed>
      <style>{CSS}</style>
      <div style={{height:"100vh",display:"flex",flexDirection:"column",overflow:"hidden",background:BG}}>

        {/* ── Top nav bar ────────────────────────────────────────────────── */}
        <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(255,255,255,0.96)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${BORDER}`}}>
          {/* Brand + controls */}
          <div style={{padding:"8px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${ACCENT},#6d9fff)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Zap size={13} color="#fff"/>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:TEXT1,letterSpacing:"-0.01em"}}>Kincaid Health <span style={{fontSize:10,color:TEXT3,fontWeight:400}}>Benefits Intelligence Platform</span></div>
                <div style={{fontSize:8,color:TEXT3,letterSpacing:"0.1em"}}>KINCAID HEALTH · ACCOUNT SHRACK-7742 · FIDUCIARY GRADE</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:8,color:TEXT3}}>{refreshing?"Refreshing…":lastRefresh.toLocaleTimeString()}</span>
              <button onClick={doRefresh} data-testid="btn-refresh" style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,background:CARD_BG,border:`1px solid ${BORDER}`,color:TEXT2,cursor:"pointer",fontSize:10}}>
                <RefreshCw size={9} className={refreshing?"spin":""}/> Refresh
              </button>
              <a href="mailto:jer@kincaidrmc.com" style={{display:"flex",alignItems:"center",gap:4,padding:"4px 11px",borderRadius:6,background:`${ACCENT}18`,border:`1px solid ${ACCENT}40`,color:ACCENT,fontSize:10,fontWeight:700,textDecoration:"none"}}>
                jer@kincaidrmc.com
              </a>
            </div>
          </div>

          {/* Signals ticker */}
          <Ticker/>

          {/* Tabs */}
          <div style={{display:"flex",borderTop:`1px solid ${BORDER2}`,overflowX:"auto"}}>
            {TABS.map(t=>{
              const active = activeTab===t.id;
              return (
                <button key={t.id} className="tab-btn" onClick={()=>setActiveTab(t.id)} data-testid={`tab-${t.id}`}
                  style={{
                    display:"flex",alignItems:"center",gap:6,
                    padding:"9px 18px",
                    fontSize:10,fontWeight:700,cursor:"pointer",
                    background: active ? `${t.color}10` : "none",
                    border:"none",
                    borderBottom:`2px solid ${active ? t.color : "transparent"}`,
                    color: active ? t.color : "rgba(255,255,255,0.28)",
                    whiteSpace:"nowrap",
                    transition:"all 0.15s",
                    textShadow: active ? `0 0 12px ${t.color}80` : "none",
                    letterSpacing:"0.04em",
                  }}>
                  <span style={{
                    display:"flex",alignItems:"center",
                    color: active ? t.color : "rgba(15,23,42,0.08)",
                    filter: active ? `drop-shadow(0 0 4px ${t.color})` : "none",
                  }}>{t.icon}</span>
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Proof strip */}
          <div style={{display:"flex",borderTop:`1px solid ${BORDER2}`,overflowX:"auto",background:"rgba(0,0,0,0.2)"}}>
            {[
              {l:"KPIs Verified",v:`${VERIFY_TILES.flatMap(t=>[t.primary,...t.supporting]).filter(k=>k.policy.verified_status==="VERIFIED").length}/${VERIFY_TILES.flatMap(t=>[t.primary,...t.supporting]).length}`,c:GREEN},
              {l:"Blocked",v:`${VERIFY_TILES.flatMap(t=>[t.primary,...t.supporting]).filter(k=>!k.policy.allowed).length}`,c:RED},
              {l:"Board Export",      v:"BLOCKED",c:RED},
              {l:"Demo Employer",     v:"Plan Year 2024",c:TEXT3},
              {l:"Live Analysis",     v:"Production Math",c:TEXT3},
            ].map(s=>(
              <div key={s.l} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 14px",borderRight:`1px solid ${BORDER2}`,flexShrink:0}}>
                <span style={{fontSize:8,color:TEXT3}}>{s.l}</span>
                <span style={{fontSize:9,fontWeight:700,color:s.c}}>{s.v}</span>
              </div>
            ))}
            {/* DOL 5500 live status badge */}
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 14px",borderRight:`1px solid ${BORDER2}`,flexShrink:0,cursor:"pointer"}} onClick={()=>setActiveTab("dol5500")}>
              <div className="live-dot" style={{width:5,height:5,borderRadius:"50%",background:kiqStatus?.duckdb_live?GREEN:AMBER,flexShrink:0}}/>
              <span style={{fontSize:8,color:TEXT3}}>DOL 5500</span>
              <span style={{fontSize:9,fontWeight:700,color:kiqStatus?.duckdb_live?GREEN:AMBER}}>
                {kiqStatus?.duckdb_live?`LIVE · ${kiqStatus.duckdb_tables} tbls`:"FALLBACK"}
              </span>
            </div>
            <div style={{marginLeft:"auto",padding:"4px 16px",flexShrink:0,display:"flex",alignItems:"center",gap:5}}>
              <Sparkles size={8} color={GOLD}/>
              <span style={{fontSize:9,color:TEXT3,fontStyle:"italic"}}>Dashboards show numbers. Kincaid Health shows receipts.</span>
            </div>
          </div>
        </div>

        {/* ── Company Handoff Banner ──────────────────────────────────────── */}
        {handoffEin&&!handoffDismissed&&(
          <div style={{margin:"0 0 0 0",padding:"8px 20px",background:"rgba(245,166,35,0.07)",borderBottom:"1px solid rgba(245,166,35,0.22)",display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:8,background:"rgba(245,166,35,0.15)",border:"1px solid rgba(245,166,35,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Building2 size={13} color={GOLD}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:900,color:GOLD,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {handoffLoading?`Loading ${handoffCompany}…`:handoffCompany}
              </div>
              <div style={{fontSize:9,fontFamily:"monospace",color:TEXT3}}>
                {handoffLoading
                  ?"Fetching DOL EFAST2 benchmark data…"
                  :`EIN ${handoffEin}${handoffProfile?.employer?` · ${handoffProfile.employer.city}, ${handoffProfile.employer.state} · ${handoffProfile.employer.maxParticipants?.toLocaleString()} lives${handoffProfile.employerPmpm?` · $${handoffProfile.employerPmpm}/mo PMPM`:""}`:""}`
                }
              </div>
            </div>
            {handoffProfile?.percentiles&&(
              <div style={{display:"flex",gap:16,flexShrink:0}}>
                {[{l:"Admin",v:handoffProfile.percentiles.adminFees},{l:"Comm",v:handoffProfile.percentiles.brokerCommissions},{l:"Income",v:handoffProfile.percentiles.totalIncome}]
                  .filter(d=>d.v!=null).map(d=>(
                    <div key={d.l} style={{textAlign:"center"}}>
                      <div style={{fontSize:13,fontWeight:900,color:d.v>=75?RED:d.v>=50?AMBER:GREEN}}>P{d.v}</div>
                      <div style={{fontSize:8,color:TEXT3}}>{d.l}</div>
                    </div>
                  ))}
              </div>
            )}
            <button
              onClick={()=>sendCompanyTo("benchmarking",handoffEin!,handoffCompany||handoffEin!)}
              data-testid="btn-war-room-benchmarking"
              className="flex items-center gap-1.5"
              style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,background:"rgba(245,166,35,0.10)",border:"1px solid rgba(245,166,35,0.28)",color:GOLD,cursor:"pointer",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"monospace",flexShrink:0,transition:"all 0.15s"}}
              onMouseEnter={(e)=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(245,166,35,0.20)";}}
              onMouseLeave={(e)=>{(e.currentTarget as HTMLButtonElement).style.background="rgba(245,166,35,0.10)";}}
            >
              <BarChart2 size={11}/>
              Benefits Benchmarking
            </button>
            <button onClick={()=>setHandoffDismissed(true)} data-testid="dismiss-handoff-exec"
              style={{background:"none",border:"none",cursor:"pointer",color:TEXT3,padding:4,flexShrink:0}}>
              <X size={13}/>
            </button>
          </div>
        )}

        {/* ── Page content ───────────────────────────────────────────────── */}
        <div style={{flex:1,overflow:(activeTab==="warroom")?"hidden":"auto",display:"flex",flexDirection:"column",minHeight:0}}>
          {activeTab==="warroom"      && <WarRoomView onKpiOpen={setSelectedKpi}/>}
          {activeTab==="dol5500"      && <Dol5500View tiles={kiqTiles} loading={tilesLoading} status={kiqStatus}/>}
          {activeTab==="shadow-tax"   && <ShadowTaxView/>}
          {activeTab==="zero-trust"   && <ZeroTrustView/>}
          {activeTab==="posture"      && <PostureView/>}
          {activeTab==="board-pack"   && <BoardPackView/>}
        </div>
      </div>

      {selectedKpi && <ReceiptTrailPanel kpi={selectedKpi} onClose={()=>setSelectedKpi(null)}/>}
      {activeTab==="warroom" && <BoardExportButton/>}
    </Layout>
  );
}
