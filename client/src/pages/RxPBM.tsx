import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Pill, Search, Shield, FileText, BookOpen, Users, Building2,
  CheckCircle2, ArrowRight, BarChart3, Database, Zap, DollarSign,
  Activity, Download, Star, Eye, Clipboard, AlertTriangle, XCircle,
  TrendingDown, Calculator, Newspaper, ChevronRight, ExternalLink,
  Tag, Lock, RotateCcw, Info, ClipboardList, ListChecks,
  CircleAlert, BadgeCheck, Layers, ScanSearch, Scale, Lightbulb,
  X, ChevronDown, ChevronUp, Printer, FileOutput, SlidersHorizontal
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/Layout";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "pricing" | "directory" | "formulary" | "modeler" | "rfp" | "articles" | "analysis";
type Risk = "low" | "medium" | "high";
type Tier = "T1" | "T2" | "T3" | "T4" | "T5" | "SP" | "NC" | "PA" | "ST";
type PbmModel = "traditional" | "regional" | "transparent";

// ─── Drug Pricing Data (CMS NADAC reference, AWP RedBook, Q1 2026) ────────────
const DRUGS = [
  // GLP-1 / Obesity
  { name: "Ozempic", generic: "semaglutide 1mg/0.75ml pen", awp: 1028.54, wac: 924.82, nadac: 899.20, class: "GLP-1 Agonist", spread: 14.4 },
  { name: "Wegovy",  generic: "semaglutide 2.4mg/1.34ml pen", awp: 1659.42, wac: 1492.93, nadac: 1449.10, class: "GLP-1 Agonist", spread: 14.5 },
  { name: "Mounjaro", generic: "tirzepatide 10mg/0.5ml pen", awp: 1130.00, wac: 1016.00, nadac: 988.00, class: "GLP-1/GIP Agonist", spread: 12.6 },
  { name: "Zepbound", generic: "tirzepatide 10mg/0.5ml pen (obesity)", awp: 1130.00, wac: 1016.00, nadac: 984.00, class: "GLP-1/GIP Agonist", spread: 13.0 },
  { name: "Trulicity", generic: "dulaglutide 1.5mg/0.5ml pen", awp: 1012.00, wac: 910.00, nadac: 842.00, class: "GLP-1 Agonist", spread: 20.2 },
  { name: "Victoza", generic: "liraglutide 1.2mg/0.2ml pen", awp: 1018.24, wac: 916.00, nadac: 798.00, class: "GLP-1 Agonist", spread: 21.6 },
  { name: "Rybelsus", generic: "semaglutide 14mg tablet", awp: 1022.00, wac: 919.00, nadac: 868.00, class: "GLP-1 Agonist (oral)", spread: 15.1 },
  // Biologics / Immunology
  { name: "Humira", generic: "adalimumab 40mg/0.8ml pen", awp: 8224.77, wac: 7402.29, nadac: 6940.00, class: "TNF Inhibitor", spread: 18.5 },
  { name: "Enbrel", generic: "etanercept 50mg/1ml pen", awp: 7238.60, wac: 6509.00, nadac: 6100.00, class: "TNF Inhibitor", spread: 18.7 },
  { name: "Skyrizi", generic: "risankizumab 150mg/1ml pen", awp: 22418.00, wac: 20175.00, nadac: 19400.00, class: "IL-23 Inhibitor", spread: 15.5 },
  { name: "Dupixent", generic: "dupilumab 300mg/2ml pen", awp: 4680.00, wac: 4210.00, nadac: 3960.00, class: "IL-4/IL-13 Inhibitor", spread: 18.2 },
  { name: "Stelara", generic: "ustekinumab 90mg/1ml syringe", awp: 22768.00, wac: 20490.00, nadac: 19800.00, class: "IL-12/23 Inhibitor", spread: 13.7 },
  { name: "Rinvoq", generic: "upadacitinib 15mg tablet", awp: 6182.00, wac: 5562.00, nadac: 5100.00, class: "JAK Inhibitor", spread: 17.5 },
  { name: "Tremfya", generic: "guselkumab 100mg/1ml syringe", awp: 14628.00, wac: 13164.00, nadac: 12400.00, class: "IL-23 Inhibitor", spread: 15.2 },
  // Oncology
  { name: "Keytruda", generic: "pembrolizumab 100mg/4ml vial", awp: 11282.00, wac: 10150.00, nadac: 9800.00, class: "PD-1 Inhibitor", spread: 15.1 },
  { name: "Revlimid", generic: "lenalidomide 25mg capsule", awp: 20898.00, wac: 18808.00, nadac: 17400.00, class: "Immunomodulator / Oncology", spread: 16.7 },
  { name: "Ibrance", generic: "palbociclib 125mg capsule", awp: 14842.00, wac: 13356.00, nadac: 12200.00, class: "CDK4/6 Inhibitor", spread: 17.8 },
  // Cardiovascular
  { name: "Eliquis", generic: "apixaban 5mg tablet (60ct)", awp: 694.63, wac: 625.00, nadac: 552.80, class: "Anticoagulant", spread: 20.5 },
  { name: "Xarelto", generic: "rivaroxaban 20mg tablet (30ct)", awp: 651.00, wac: 586.00, nadac: 511.00, class: "Anticoagulant", spread: 27.4 },
  { name: "Repatha", generic: "evolocumab 140mg/1ml pen", awp: 748.00, wac: 672.00, nadac: 591.00, class: "PCSK9 Inhibitor", spread: 26.6 },
  { name: "Entresto", generic: "sacubitril/valsartan 49/51mg tab (60ct)", awp: 848.00, wac: 762.00, nadac: 668.00, class: "ARNI / Heart Failure", spread: 21.2 },
  { name: "Jardiance", generic: "empagliflozin 10mg tablet (30ct)", awp: 673.40, wac: 605.00, nadac: 548.90, class: "SGLT2 Inhibitor", spread: 22.6 },
  { name: "Farxiga", generic: "dapagliflozin 10mg tablet (30ct)", awp: 642.00, wac: 578.00, nadac: 521.00, class: "SGLT2 Inhibitor", spread: 18.8 },
  { name: "Brilinta", generic: "ticagrelor 90mg tablet (60ct)", awp: 568.00, wac: 511.00, nadac: 436.00, class: "P2Y12 Inhibitor", spread: 23.2 },
  { name: "Pradaxa", generic: "dabigatran 150mg capsule (60ct)", awp: 607.00, wac: 546.00, nadac: 468.00, class: "Anticoagulant", spread: 22.9 },
  // Diabetes / Metabolic
  { name: "Lantus SoloStar", generic: "insulin glargine 100U/ml pen (5pk)", awp: 604.00, wac: 542.00, nadac: 186.00, class: "Long-Acting Insulin", spread: 69.2 },
  { name: "Tresiba FlexTouch", generic: "insulin degludec 200U/ml pen (3pk)", awp: 654.00, wac: 588.00, nadac: 198.00, class: "Long-Acting Insulin", spread: 69.7 },
  { name: "Januvia", generic: "sitagliptin 100mg tablet (30ct)", awp: 589.00, wac: 529.00, nadac: 447.00, class: "DPP-4 Inhibitor", spread: 24.1 },
  // Respiratory
  { name: "Dupixent (Asthma)", generic: "dupilumab 300mg/2ml pen (asthma)", awp: 4680.00, wac: 4210.00, nadac: 3960.00, class: "IL-4/IL-13 Inhibitor", spread: 18.2 },
  { name: "Trikafta", generic: "elexacaftor/tezacaftor/ivacaftor 200/100/150mg", awp: 29400.00, wac: 26460.00, nadac: 25800.00, class: "CFTR Modulator", spread: 12.2 },
  { name: "Fasenra", generic: "benralizumab 30mg/1ml pen", awp: 5892.00, wac: 5302.00, nadac: 4980.00, class: "Anti-IL-5Rα / Asthma", spread: 15.5 },
  // Neurology / Rare
  { name: "Aimovig", generic: "erenumab 70mg/1ml pen", awp: 900.00, wac: 810.00, nadac: 718.00, class: "CGRP Inhibitor / Migraine", spread: 20.2 },
  { name: "Ajovy", generic: "fremanezumab 225mg/1.5ml syringe", awp: 812.00, wac: 730.00, nadac: 648.00, class: "CGRP Inhibitor / Migraine", spread: 20.2 },
  { name: "Tecfidera", generic: "dimethyl fumarate 240mg capsule (60ct)", awp: 9104.00, wac: 8192.00, nadac: 7640.00, class: "Multiple Sclerosis", spread: 16.1 },
  { name: "Ocrevus", generic: "ocrelizumab 300mg/10ml vial (2pk)", awp: 23200.00, wac: 20880.00, nadac: 19200.00, class: "Anti-CD20 / MS", spread: 17.2 },
  // Mental Health
  { name: "Vraylar", generic: "cariprazine 1.5mg capsule (30ct)", awp: 1012.00, wac: 910.00, nadac: 784.00, class: "Atypical Antipsychotic", spread: 22.5 },
  { name: "Abilify Maintena", generic: "aripiprazole 400mg vial (IM)", awp: 1892.00, wac: 1702.00, nadac: 1542.00, class: "Atypical Antipsychotic", spread: 18.5 },
  // Bone / Osteoporosis
  { name: "Prolia", generic: "denosumab 60mg/1ml syringe", awp: 1984.00, wac: 1784.00, nadac: 1620.00, class: "RANK Ligand Inhibitor", spread: 18.3 },
  { name: "Evenity", generic: "romosozumab 105mg/1.17ml syringe (2pk)", awp: 2416.00, wac: 2174.00, nadac: 1980.00, class: "Sclerostin Inhibitor", spread: 18.0 },
];

// ─── PBM Directory (24 PBMs) ─────────────────────────────────────────────────
const PBMS = [
  { name: "CVS Caremark",              owner: "CVS Health",          model: "Spread",        pass: "No",      rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: true,  market: "33%",  risk: "high" as Risk },
  { name: "Express Scripts (ESI)",     owner: "Cigna / Evernorth",   model: "Spread",        pass: "No",      rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: true,  market: "26%",  risk: "high" as Risk },
  { name: "OptumRx",                   owner: "UnitedHealth Group",  model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Moderate", spread: true,  ownedRx: true,  market: "21%",  risk: "high" as Risk },
  { name: "Aetna Rx (CVS)",            owner: "CVS / Aetna",         model: "Spread",        pass: "No",      rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: true,  market: "3%",   risk: "high" as Risk },
  { name: "Anthem IngenioRx",          owner: "Elevance Health",     model: "Hybrid",        pass: "Partial", rebate: "Most",     audit: "Moderate", spread: true,  ownedRx: false, market: "2%",   risk: "medium" as Risk },
  { name: "TRICARE (ESI)",             owner: "Cigna / US Gov't",    model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Moderate", spread: false, ownedRx: true,  market: "1%",   risk: "medium" as Risk },
  { name: "Humana Pharmacy Solutions", owner: "Humana",              model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Moderate", spread: true,  ownedRx: true,  market: "2%",   risk: "medium" as Risk },
  { name: "Molina Pharmacy Services",  owner: "Molina Healthcare",   model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: false, market: "1%",   risk: "medium" as Risk },
  { name: "Magellan Rx",               owner: "Centene Corp",        model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: false, market: "2%",   risk: "medium" as Risk },
  { name: "Envolve Pharmacy",          owner: "Centene Corp",        model: "Hybrid",        pass: "Partial", rebate: "Partial",  audit: "Limited",  spread: true,  ownedRx: false, market: "1%",   risk: "medium" as Risk },
  { name: "Prime Therapeutics",        owner: "BCBS Plans",          model: "Hybrid",        pass: "Partial", rebate: "Most",     audit: "Moderate", spread: false, ownedRx: false, market: "3%",   risk: "medium" as Risk },
  { name: "WellDyne",                  owner: "Independent",         model: "Hybrid",        pass: "Partial", rebate: "Most",     audit: "Strong",   spread: false, ownedRx: false, market: "1%",   risk: "medium" as Risk },
  { name: "Benecard Services",         owner: "Independent",         model: "Hybrid",        pass: "Partial", rebate: "Most",     audit: "Moderate", spread: false, ownedRx: false, market: "<1%",  risk: "medium" as Risk },
  { name: "ProAct",                    owner: "Independent",         model: "Hybrid",        pass: "Partial", rebate: "Most",     audit: "Strong",   spread: false, ownedRx: false, market: "<1%",  risk: "medium" as Risk },
  { name: "MedImpact",                 owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Strong",   spread: false, ownedRx: false, market: "4%",   risk: "low" as Risk },
  { name: "Navitus Health Solutions",  owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "3%",   risk: "low" as Risk },
  { name: "Capital Rx",                owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "1%",   risk: "low" as Risk },
  { name: "InfiniPBM (Sav-Rx)",        owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Strong",   spread: false, ownedRx: false, market: "1%",   risk: "low" as Risk },
  { name: "Abarca Health",             owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
  { name: "RxBenefits",               owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
  { name: "Clear Rx",                  owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
  { name: "Rightway",                  owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
  { name: "Pharmacy Dev. Services (PDS)", owner: "Independent",      model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
  { name: "Sapphire Rx",               owner: "Independent",         model: "Pass-Through",  pass: "Yes",     rebate: "Full",     audit: "Full",     spread: false, ownedRx: false, market: "<1%",  risk: "low" as Risk },
];

// ─── Formulary data: drug tiers across 5 PBMs ────────────────────────────────
type FormularyTier = { tier: string; copay: string; pa: boolean; st: boolean };
type FormularyEntry = {
  drug: string; generic: string; class: string;
  cvs: FormularyTier; esi: FormularyTier; optum: FormularyTier; medimpact: FormularyTier; navitus: FormularyTier;
};

const TIERS: Record<string, { label: string; color: string; bg: string }> = {
  "T1": { label: "Tier 1", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  "T2": { label: "Tier 2", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  "T3": { label: "Tier 3", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  "T4": { label: "Tier 4", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
  "T5": { label: "Tier 5", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  "SP": { label: "Specialty", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
  "NC": { label: "Not Covered", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const t = (tier: string, copay: string, pa = false, st = false): FormularyTier => ({ tier, copay, pa, st });

const FORMULARY: FormularyEntry[] = [
  { drug: "Ozempic", generic: "semaglutide (T2DM)", class: "GLP-1 Agonist",
    cvs: t("T3","$90 after ded",true,true), esi: t("T3","$80 after ded",true,true), optum: t("T3","$75 after ded",true,true), medimpact: t("T3","$85 after ded",true,false), navitus: t("T2","$50 after ded",true,false) },
  { drug: "Wegovy", generic: "semaglutide (obesity)", class: "GLP-1 Agonist",
    cvs: t("NC","Full cost",true,false), esi: t("NC","Full cost",true,false), optum: t("SP","20% coinsurance",true,true), medimpact: t("NC","Full cost",true,false), navitus: t("SP","15% coinsurance",true,false) },
  { drug: "Mounjaro", generic: "tirzepatide (T2DM)", class: "GLP-1/GIP Agonist",
    cvs: t("T3","$90 after ded",true,true), esi: t("T3","$85 after ded",true,true), optum: t("T3","$80 after ded",true,false), medimpact: t("T3","$80 after ded",true,false), navitus: t("T2","$55 after ded",true,false) },
  { drug: "Humira", generic: "adalimumab", class: "TNF Inhibitor",
    cvs: t("SP","30% up to $150",true,true), esi: t("SP","25% up to $150",true,true), optum: t("SP","25% up to $125",true,false), medimpact: t("SP","20% up to $100",true,false), navitus: t("SP","20% up to $100",true,false) },
  { drug: "Dupixent", generic: "dupilumab", class: "IL-4/IL-13 Inhibitor",
    cvs: t("SP","30% up to $200",true,true), esi: t("SP","25% up to $175",true,true), optum: t("SP","25% up to $175",true,false), medimpact: t("SP","20% up to $150",true,false), navitus: t("SP","20% up to $150",true,false) },
  { drug: "Eliquis", generic: "apixaban", class: "Anticoagulant",
    cvs: t("T2","$47",false,false), esi: t("T2","$42",false,false), optum: t("T2","$45",false,false), medimpact: t("T2","$40",false,false), navitus: t("T2","$35",false,false) },
  { drug: "Xarelto", generic: "rivaroxaban", class: "Anticoagulant",
    cvs: t("T3","$80 after ded",false,true), esi: t("T2","$47",false,false), optum: t("T2","$45",false,false), medimpact: t("T2","$40",false,false), navitus: t("T2","$38",false,false) },
  { drug: "Jardiance", generic: "empagliflozin", class: "SGLT2 Inhibitor",
    cvs: t("T2","$47",false,false), esi: t("T2","$45",false,false), optum: t("T2","$42",false,false), medimpact: t("T2","$40",false,false), navitus: t("T2","$35",false,false) },
  { drug: "Keytruda", generic: "pembrolizumab", class: "PD-1 Inhibitor",
    cvs: t("SP","20% coinsurance",true,false), esi: t("SP","20% coinsurance",true,false), optum: t("SP","20% coinsurance",true,false), medimpact: t("SP","15% coinsurance",true,false), navitus: t("SP","15% coinsurance",true,false) },
  { drug: "Lantus", generic: "insulin glargine", class: "Long-Acting Insulin",
    cvs: t("T2","$35",false,false), esi: t("T2","$35",false,false), optum: t("T2","$35",false,false), medimpact: t("T1","$25",false,false), navitus: t("T1","$20",false,false) },
  { drug: "Repatha", generic: "evolocumab", class: "PCSK9 Inhibitor",
    cvs: t("SP","25% up to $100",true,true), esi: t("SP","25% up to $100",true,true), optum: t("SP","20% up to $100",true,true), medimpact: t("SP","20% up to $75",true,false), navitus: t("SP","20% up to $75",true,false) },
  { drug: "Entresto", generic: "sacubitril/valsartan", class: "ARNI / Heart Failure",
    cvs: t("T3","$80 after ded",false,true), esi: t("T3","$75 after ded",false,false), optum: t("T3","$70 after ded",false,false), medimpact: t("T2","$55",false,false), navitus: t("T2","$50",false,false) },
  { drug: "Aimovig", generic: "erenumab", class: "CGRP Inhibitor",
    cvs: t("SP","25% up to $100",true,true), esi: t("SP","20% up to $100",true,true), optum: t("SP","20% up to $100",true,false), medimpact: t("SP","20% up to $75",true,false), navitus: t("SP","15% up to $75",true,false) },
  { drug: "Rinvoq", generic: "upadacitinib", class: "JAK Inhibitor",
    cvs: t("SP","30% up to $150",true,true), esi: t("SP","25% up to $150",true,true), optum: t("SP","25% up to $125",true,true), medimpact: t("SP","20% up to $100",true,false), navitus: t("SP","20% up to $100",true,false) },
  { drug: "Skyrizi", generic: "risankizumab", class: "IL-23 Inhibitor",
    cvs: t("SP","30% up to $200",true,true), esi: t("SP","25% up to $200",true,true), optum: t("SP","25% up to $175",true,true), medimpact: t("SP","20% up to $150",true,false), navitus: t("SP","20% up to $150",true,false) },
];

// ─── RFP Question Bank ────────────────────────────────────────────────────────
const RFP = [
  { cat: "Fiduciary & Transparency", color: "#10b981", icon: Shield, qs: [
    "Will you serve as a named fiduciary to the plan under ERISA Section 3(21) or 3(38)?",
    "Do you accept ERISA fiduciary liability in writing for formulary and pricing decisions?",
    "Do you disclose all compensation, fees, and revenue streams from manufacturers and pharmacies?",
    "Are you required to disclose all direct and indirect compensation under CAA 2026 Section 204?",
    "Will you confirm in writing that all pricing is pass-through with no spread retained?",
  ]},
  { cat: "Drug Pricing & Spread", color: "#f59e0b", icon: DollarSign, qs: [
    "What is your definition of 'ingredient cost' and how is it determined for each drug?",
    "Do you retain any spread between what you pay pharmacies and what you charge the plan?",
    "Will you disclose MAC (Maximum Allowable Cost) list prices and update frequency?",
    "How do you calculate and pass through specialty drug discounts?",
    "Will you provide a 30-day historical comparison of AWP vs. actual acquisition cost?",
  ]},
  { cat: "Rebates & Manufacturer Revenue", color: "#8b5cf6", icon: BarChart3, qs: [
    "What is your total manufacturer revenue (rebates + admin fees) per drug per script?",
    "Will 100% of manufacturer rebates be passed to the plan at point-of-sale?",
    "Do you receive performance fees, administrative fees, or data fees from manufacturers?",
    "Are rebates guaranteed or estimated? How are retroactive adjustments handled?",
    "Will you disclose all GPO (Group Purchasing Organization) relationships and fees?",
  ]},
  { cat: "Audit Rights & Data Access", color: "#3b82f6", icon: Eye, qs: [
    "Does the plan own all claims data, including NDC, drug name, price paid, and dispensing pharmacy?",
    "Can the plan share data with consultants, auditors, and competing PBMs without restriction?",
    "Are audit rights unrestricted, including extrapolation of findings across the full book?",
    "What is the lookback period for audit disputes? Is there a cure period for identified overcharges?",
    "Will you provide raw claims data in machine-readable format within 30 days of request?",
  ]},
  { cat: "Pharmacy Network & Steering", color: "#ef4444", icon: Building2, qs: [
    "Do you own or have a financial interest in any pharmacies in the proposed network?",
    "Will you disclose any preferred pharmacy arrangements or steering incentives?",
    "Is the plan permitted to carve out specialty drugs to any pharmacy or vendor of its choice?",
    "Are there any provisions that prevent the plan from switching specialty pharmacies?",
    "What is your policy on 'clean exit' if the plan terminates — will data be returned within 30 days?",
  ]},
];

// ─── Articles ─────────────────────────────────────────────────────────────────
const ARTICLES = [
  { title: "Employee Prescription Cost Complaints: How to Lower Out-of-Pocket Costs Without Raising Plan Spend",
    summary: "Employee complaints about high Rx copays are rising. Here's how to lower out-of-pocket costs for your workforce without increasing total plan spend — copay tiers, copay assistance, and formulary design choices that shift the burden back to the PBM.",
    category: "Cost Control", date: "Apr 2, 2026", readMin: 7 },
  { title: "The Big Three PBMs Control 80% of the Market: How That Concentration Drives Drug Pricing for Employers",
    summary: "CVS Caremark, Express Scripts, and OptumRx control 80% of US pharmacy benefits. Here's how that market power shapes drug pricing and employer costs — with specific examples of how concentration translates to markups.",
    category: "Market", date: "Apr 1, 2026", readMin: 9 },
  { title: "What Your PBM Quarterly Report Actually Tells You vs. What It Hides",
    summary: "Your PBM's quarterly report leaves more questions than answers. Learn which numbers matter, which ones are missing, and how to uncover the real pharmacy spend — including where spread and rebate retention are obscured.",
    category: "Employer Guide", date: "Mar 31, 2026", readMin: 8 },
  { title: "How the Big Three PBMs Shape Drug Prices: What 80% Market Control Really Means",
    summary: "80% of prescriptions go through CVS Caremark, Express Scripts, or OptumRx. That market share shapes drug prices for every employer. Here's how — with numbers showing the real-world impact on plan costs.",
    category: "Market", date: "Mar 30, 2026", readMin: 10 },
  { title: "Managing Specialty Drug Spend: Site-of-Care Steering, Prior Auth, and Step Therapy Done Right",
    summary: "How to slash specialty drug spend by $200K+ for a 1,000-life plan: site-of-care redirection, prior authorization design, and step therapy protocols with the right contract controls and language.",
    category: "Cost Control", date: "Mar 26, 2026", readMin: 11 },
  { title: "Independent PBMs and Transparent Alternatives: Who They Are and How They Compare to the Big Three",
    summary: "Independent PBMs promise transparent pricing, but how do they stack up against CVS Caremark, Express Scripts, and OptumRx in practice? A hard-numbers breakdown of pass-through rates, rebate sharing, and audit rights.",
    category: "Market", date: "Mar 25, 2026", readMin: 8 },
  { title: "Pharmacy Benefit Design for Mid-Market Employers: Copay Tiers, Coinsurance, and Cost-Sharing Strategies That Work",
    summary: "How mid-market employers (200–5,000 lives) can use copay tiers, coinsurance, and smarter cost-sharing design to manage pharmacy spend without alienating employees or triggering adverse selection.",
    category: "Cost Control", date: "Mar 24, 2026", readMin: 9 },
  { title: "The GLP-1 Crisis for Plan Sponsors: Managing Semaglutide and Tirzepatide Costs Without Cutting Access",
    summary: "GLP-1 drugs like semaglutide and tirzepatide are blowing up pharmacy spend — $15,000+ per member per year. Here's how plan sponsors can manage cost without triggering backlash or adverse health outcomes.",
    category: "Specialty", date: "Mar 23, 2026", readMin: 10 },
  { title: "Switching PBMs Without Disrupting Employee Prescriptions: A Practical Transition Checklist",
    summary: "Switch PBMs with minimal employee disruption — contract terms, data migration, formulary continuity, and tactical steps for a smooth pharmacy benefit transition. Avoid hidden costs and operational chaos.",
    category: "Employer Guide", date: "Mar 19, 2026", readMin: 7 },
  { title: "Generic Drug Pricing Games: When Your PBM Charges Brand Prices for Pennies-Per-Pill Generics",
    summary: "PBMs routinely mark up generic drugs — charging employers $28 for a medication that costs $4.50. Here's how MAC pricing games work, who profits, what the contract language looks like, and how to stop it.",
    category: "Pricing", date: "Mar 18, 2026", readMin: 9 },
  { title: "Insulin Pricing and the $35 Cap: What It Means for Your Plan and Your Members",
    summary: "The Inflation Reduction Act's $35 insulin cap applies to Medicare — not commercial plans. Here's what self-funded employers can do contractually to bring insulin costs down for their members.",
    category: "Pricing", date: "Mar 14, 2026", readMin: 6 },
  { title: "PBM Audit Rights: What Employers Should Demand and What Most Contracts Silently Deny",
    summary: "Most PBM contracts limit or eliminate the plan's right to audit. Here's what a fiduciary-grade audit clause should say — and how to identify the provisions that make real audits impossible.",
    category: "Contract", date: "Mar 10, 2026", readMin: 8 },
];

// ─── Color helpers ────────────────────────────────────────────────────────────
const riskC = (r: Risk) => r === "high" ? "#ef4444" : r === "medium" ? "#f59e0b" : "#10b981";
const riskBg = (r: Risk) => r === "high" ? "rgba(239,68,68,0.1)" : r === "medium" ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)";
const ptC = (v: string) =>
  v === "Yes" || v === "Full" || v === "Strong" ? "#10b981" :
  v === "Partial" || v === "Most" || v === "Moderate" ? "#f59e0b" : "#ef4444";
const fmt$ = (n: number) => n >= 10000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;
const catColor: Record<string, string> = {
  "Cost Control": "#10b981", "Market": "#3b82f6", "Employer Guide": "#f59e0b",
  "Specialty": "#8b5cf6", "Pricing": "#ef4444", "Contract": "#f97316",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function TierBadge({ tier, copay, pa, st }: FormularyTier) {
  const cfg = TIERS[tier] ?? TIERS["T3"];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-bold px-2 py-0.5 rounded text-center"
        style={{ color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
      <span className="text-[10px] text-zinc-500 text-center leading-tight">{copay}</span>
      {(pa || st) && (
        <div className="flex gap-1 justify-center mt-0.5">
          {pa && <span className="text-[9px] bg-[var(--kiq-surface)] text-zinc-400 px-1 rounded">PA</span>}
          {st && <span className="text-[9px] bg-[var(--kiq-surface)] text-zinc-400 px-1 rounded">ST</span>}
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Banner ────────────────────────────────────────────────────────
const ONBOARDING_PHASES = [
  { num: 1, tab: "pricing" as Tab,    label: "Drug Pricing",   desc: "Review AWP vs. NADAC spread for your key drugs" },
  { num: 2, tab: "directory" as Tab,  label: "PBM Directory",  desc: "Evaluate your PBM's risk rating and model type" },
  { num: 3, tab: "modeler" as Tab,    label: "Cost Modeler",   desc: "Estimate potential savings from switching models" },
  { num: 4, tab: "formulary" as Tab,  label: "Formulary",      desc: "Compare tier placements across 5 PBMs" },
  { num: 5, tab: "rfp" as Tab,        label: "RFP Bank",       desc: "Select procurement questions for your next RFP" },
  { num: 6, tab: "analysis" as Tab,   label: "Analysis Guide", desc: "Follow the 6-phase audit methodology" },
];

function OnboardingBanner({ onDismiss, onTabSwitch }: { onDismiss: () => void; onTabSwitch: (t: Tab) => void }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex-shrink-0 border-b border-emerald-500/20"
      style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(52,211,153,0.03) 100%)" }}>
      <div className="flex items-start gap-3 px-5 py-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-emerald-300">Start Here — 6-Phase PBM Audit Framework</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
              style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
              Quick Start
            </span>
            <button data-testid="btn-onboarding-toggle"
              onClick={() => setExpanded(e => !e)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors ml-1">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          {expanded && (
            <div className="flex flex-wrap gap-2 mt-2">
              {ONBOARDING_PHASES.map(phase => (
                <button key={phase.num} data-testid={`btn-onboarding-phase-${phase.num}`}
                  onClick={() => onTabSwitch(phase.tab)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all group"
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,0.3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}>
                  <span className="w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0"
                    style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                    {phase.num}
                  </span>
                  <div>
                    <div className="text-[10px] font-bold text-[var(--kiq-muted)] leading-tight">{phase.label}</div>
                    <div className="text-[9px] text-zinc-600 leading-tight hidden sm:block">{phase.desc}</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-emerald-500 transition-colors ml-1" />
                </button>
              ))}
            </div>
          )}
        </div>
        <button data-testid="btn-onboarding-dismiss"
          onClick={onDismiss}
          className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 mt-0.5 p-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Summary Dashboard Bar ────────────────────────────────────────────────────
function SummaryBar({
  modelerResult, lives, highRiskCount, onTabSwitch
}: {
  modelerResult: null | { spreadSavings: number; rebateSavings: number; total: number; perLife: number };
  lives: string;
  highRiskCount: number;
  onTabSwitch: (t: Tab) => void;
}) {
  const hasSavings = modelerResult !== null;

  return (
    <div className="flex-shrink-0 border-b border-[var(--kiq-hairline)]/60"
      style={{ background: "rgba(255,255,255,0.01)" }}>
      <div className="flex items-center gap-0 px-4 py-2 overflow-x-auto scrollbar-none divide-x divide-zinc-800/60">
        {/* Total Savings */}
        <div className="flex items-center gap-2.5 px-4 first:pl-0">
          <Calculator className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Est. Savings</div>
            <div className="text-sm font-black text-emerald-400" data-testid="summary-total-savings">
              {hasSavings ? `$${modelerResult!.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
        </div>

        {/* Savings per life */}
        <div className="flex items-center gap-2.5 px-4">
          <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Per Life</div>
            <div className="text-sm font-black text-blue-400" data-testid="summary-per-life">
              {hasSavings && parseInt(lives) > 0 ? `$${modelerResult!.perLife.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
            </div>
          </div>
        </div>

        {/* High Risk PBMs */}
        <div className="flex items-center gap-2.5 px-4">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">High-Risk PBMs</div>
            <div className="text-sm font-black text-red-400" data-testid="summary-high-risk-pbms">{highRiskCount}</div>
          </div>
        </div>

        {/* Recommended next action */}
        <div className="flex items-center gap-2.5 px-4 flex-1 min-w-0">
          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-600">Recommended Next Step</div>
            <button data-testid="btn-summary-next-action"
              className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors truncate text-left"
              onClick={() => onTabSwitch(hasSavings ? "rfp" : "modeler")}>
              {hasSavings
                ? `Review RFP Bank → ${modelerResult!.total > 100000 ? "Strong case for switch" : "Consider contract amendments"}`
                : "Run Cost Modeler to estimate your savings →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tool tabs ────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: typeof Pill; desc: string }[] = [
  { id: "pricing",   label: "Drug Pricing",    icon: DollarSign,    desc: `${DRUGS.length} drugs · AWP/WAC/NADAC` },
  { id: "directory", label: "PBM Directory",   icon: Database,      desc: "24 PBMs compared" },
  { id: "formulary", label: "Formulary",       icon: Tag,           desc: "Tier lookup across PBMs" },
  { id: "modeler",   label: "Cost Modeler",    icon: Calculator,    desc: "Savings variance tool" },
  { id: "rfp",       label: "RFP Bank",        icon: BookOpen,      desc: "25 procurement questions" },
  { id: "articles",  label: "Articles",        icon: Newspaper,     desc: `${ARTICLES.length} analyses` },
  { id: "analysis",  label: "Analysis",         icon: ClipboardList, desc: "6-phase PBM analysis guide" },
];

// ─── Export Report Modal ──────────────────────────────────────────────────────
function ExportReportModal({
  modelerResult, lives, annualSpend, pbmModel, genericRate,
  selectedRfpQuestions, onClose
}: {
  modelerResult: null | { spreadSavings: number; rebateSavings: number; total: number; perLife: number };
  lives: string;
  annualSpend: string;
  pbmModel: PbmModel;
  genericRate: number;
  selectedRfpQuestions: Set<string>;
  onClose: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  // Guard parseInt against NaN
  const livesNum = parseInt(lives);
  const spendNum = parseInt(annualSpend);
  const livesDisplay = !isNaN(livesNum) && livesNum > 0 ? livesNum.toLocaleString() : "Not set";
  const spendDisplay = !isNaN(spendNum) && spendNum > 0 ? `$${spendNum.toLocaleString()}` : "Not set";

  // ESC key closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const highRiskPbms = PBMS.filter(p => p.risk === "high");
  const mediumRiskPbms = PBMS.filter(p => p.risk === "medium");
  const lowRiskPbms = PBMS.filter(p => p.risk === "low");

  const selectedQsList = RFP.flatMap(cat =>
    cat.qs
      .filter(q => selectedRfpQuestions.has(q))
      .map(q => ({ cat: cat.cat, q }))
  );

  const modelLabels: Record<PbmModel, string> = {
    traditional: "Traditional / Big 3 (Spread + Rebate Retention)",
    regional: "Regional / Hybrid (Partial Pass-Through)",
    transparent: "Transparent Pass-Through (No Spread)",
  };

  return (
    <>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #rxpbm-print-area, #rxpbm-print-area * { visibility: visible !important; }
          #rxpbm-print-area { position: fixed; left: 0; top: 0; width: 100%; z-index: 99999; background: white !important; color: black !important; padding: 32px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Backdrop — click outside to close */}
      <div className="fixed inset-0 z-50 flex items-center justify-center no-print"
        style={{ background: "rgba(0,0,0,0.75)" }}
        onClick={onClose}>
        <div className="relative bg-[var(--kiq-surface)] border border-[var(--kiq-hairline)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
          onClick={e => e.stopPropagation()}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--kiq-hairline)]">
            <div className="flex items-center gap-2">
              <FileOutput className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-black text-[var(--kiq-ink)]">Export Summary Report</span>
            </div>
            <div className="flex items-center gap-2">
              <Button data-testid="btn-print-report" size="sm" onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Print / Save PDF
              </Button>
              <button data-testid="btn-close-export" onClick={onClose}
                className="text-zinc-500 hover:text-[var(--kiq-muted)] transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-5">
            <div id="rxpbm-print-area" ref={printRef}
              style={{ background: "white", color: "#111", fontFamily: "system-ui, sans-serif", padding: 0 }}
              className="rounded-xl overflow-hidden border border-[var(--kiq-hairline)] print:border-none print:rounded-none">

              {/* Report header */}
              <div style={{ background: "#F8FAFC", color: "#0F172A", padding: "24px 28px" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#6ee7b7", marginBottom: 6 }}>
                  Kincaid Health · RxPBM Intelligence
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, marginBottom: 4 }}>PBM Audit Summary Report</h1>
                <p style={{ fontSize: 11, color: "#a7f3d0", margin: 0 }}>Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>

              {/* Modeler results */}
              <div style={{ padding: "20px 28px", borderBottom: "1px solid #e5e7eb" }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "#111" }}>Cost Variance Analysis</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#059669", marginBottom: 4 }}>Plan Configuration</div>
                    <div style={{ fontSize: 12, color: "#374151" }}><strong>Covered Lives:</strong> {livesDisplay}</div>
                    <div style={{ fontSize: 12, color: "#374151" }}><strong>Annual Drug Spend:</strong> {spendDisplay}</div>
                    <div style={{ fontSize: 12, color: "#374151" }}><strong>Current PBM Model:</strong> {modelLabels[pbmModel]}</div>
                    <div style={{ fontSize: 12, color: "#374151" }}><strong>Generic Dispensing Rate:</strong> {genericRate}%</div>
                  </div>
                  {modelerResult ? (
                    <div style={{ background: "#ecfdf5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "12px 16px" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#059669", marginBottom: 4 }}>Estimated Savings (Switch to Pass-Through)</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#065f46" }}>${modelerResult.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                      <div style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>Spread Savings: ${modelerResult.spreadSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                      <div style={{ fontSize: 11, color: "#374151" }}>Rebate Recovery: ${modelerResult.rebateSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                      <div style={{ fontSize: 11, color: "#374151" }}>Per Covered Life: ${modelerResult.perLife.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
                    </div>
                  ) : (
                    <div style={{ background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px" }}>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>No modeler results yet. Run the Cost Modeler to generate savings estimates.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* PBM Risk Ratings */}
              <div style={{ padding: "20px 28px", borderBottom: "1px solid #e5e7eb" }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: "#111" }}>PBM Risk Summary ({PBMS.length} PBMs Reviewed)</h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#dc2626" }}>{highRiskPbms.length}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#991b1b", textTransform: "uppercase" }}>High Risk</div>
                  </div>
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706" }}>{mediumRiskPbms.length}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>Medium Risk</div>
                  </div>
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>{lowRiskPbms.length}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#065f46", textTransform: "uppercase" }}>Low Risk</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", marginBottom: 4, textTransform: "uppercase" }}>High-Risk PBMs:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {highRiskPbms.map(p => (
                      <span key={p.name} style={{ fontSize: 11, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 4, padding: "2px 8px", fontWeight: 600 }}>
                        {p.name} ({p.model})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selected RFP Questions */}
              <div style={{ padding: "20px 28px" }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: "#111" }}>Selected RFP Questions</h2>
                <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12 }}>
                  {selectedQsList.length > 0
                    ? `${selectedQsList.length} question${selectedQsList.length !== 1 ? "s" : ""} selected for your PBM procurement process.`
                    : "No RFP questions selected. Use the RFP Bank tab to select questions."}
                </p>
                {selectedQsList.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {selectedQsList.map(({ cat, q }, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", minWidth: 20 }}>{i + 1}.</span>
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>{cat}</div>
                          <div style={{ fontSize: 12, color: "#111" }}>{q}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 16, padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 6 }}>
                  <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>
                    This report is generated by Kincaid Health RxPBM Intelligence. Estimates are based on industry-average spread rates and FTC interim reports. Not legal or financial advice. Consult qualified ERISA counsel before taking action.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RxPBM() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("pricing");

  // Onboarding state — persisted in localStorage
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem("rxpbm_onboarding_dismissed") !== "true"; } catch { return true; }
  });

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    try { localStorage.setItem("rxpbm_onboarding_dismissed", "true"); } catch {}
  };

  // Export modal state
  const [showExport, setShowExport] = useState(false);

  // Drug Pricing state
  const [drugSearch, setDrugSearch] = useState("");
  const [drugClass, setDrugClass] = useState("All");

  // PBM Directory state
  const [pbmRiskFilter, setPbmRiskFilter] = useState<"all" | "low" | "medium" | "high">("all");
  const [pbmModelFilter, setPbmModelFilter] = useState<"all" | "Spread" | "Hybrid" | "Pass-Through">("all");
  const [pbmSearch, setPbmSearch] = useState("");

  // Formulary state
  const [formularySearch, setFormularySearch] = useState("");

  // RFP state
  const [rfpCatFilter, setRfpCatFilter] = useState<"All" | string>("All");
  const [selectedRfpQuestions, setSelectedRfpQuestions] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  // Articles state
  const [articleCat, setArticleCat] = useState("All");

  // Cost modeler state
  const [lives, setLives] = useState("500");
  const [annualSpend, setAnnualSpend] = useState("1500000");
  const [pbmModel, setPbmModel] = useState<PbmModel>("traditional");
  const [genericRate, setGenericRate] = useState(85);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelerResult, setModelerResult] = useState<null | {
    spreadSavings: number; rebateSavings: number; total: number; perLife: number;
  }>(null);

  // Live-preview modeler (updates as user types)
  const liveResult = useMemo(() => {
    const l = parseInt(lives) || 0;
    const s = parseInt(annualSpend) || 0;
    if (!l || !s) return null;
    const spreadRate = pbmModel === "traditional" ? 0.09 : pbmModel === "regional" ? 0.04 : 0;
    const rebateLeakage = pbmModel === "traditional" ? 0.025 : pbmModel === "regional" ? 0.012 : 0;
    const genericBonus = (genericRate - 80) * 0.001 * s;
    const spreadSavings = s * spreadRate;
    const rebateSavings = s * rebateLeakage + genericBonus;
    return { spreadSavings, rebateSavings, total: spreadSavings + rebateSavings, perLife: l > 0 ? (spreadSavings + rebateSavings) / l : 0 };
  }, [lives, annualSpend, pbmModel, genericRate]);

  // Derived data
  const drugClasses = useMemo(() => ["All", ...Array.from(new Set(DRUGS.map(d => d.class)))], []);
  const filteredDrugs = useMemo(() =>
    DRUGS.filter(d =>
      (drugClass === "All" || d.class === drugClass) &&
      (drugSearch === "" || d.name.toLowerCase().includes(drugSearch.toLowerCase()) ||
       d.generic.toLowerCase().includes(drugSearch.toLowerCase()))
    ), [drugSearch, drugClass]);

  const filteredPbms = useMemo(() =>
    PBMS.filter(p =>
      (pbmRiskFilter === "all" || p.risk === pbmRiskFilter) &&
      (pbmModelFilter === "all" || p.model === pbmModelFilter) &&
      (pbmSearch === "" || p.name.toLowerCase().includes(pbmSearch.toLowerCase()) ||
       p.owner.toLowerCase().includes(pbmSearch.toLowerCase()))
    ), [pbmRiskFilter, pbmModelFilter, pbmSearch]);

  const highRiskCount = useMemo(() => PBMS.filter(p => p.risk === "high").length, []);

  const filteredFormulary = useMemo(() =>
    FORMULARY.filter(f =>
      formularySearch === "" ||
      f.drug.toLowerCase().includes(formularySearch.toLowerCase()) ||
      f.class.toLowerCase().includes(formularySearch.toLowerCase())
    ), [formularySearch]);

  const filteredArticles = useMemo(() =>
    ARTICLES.filter(a => articleCat === "All" || a.category === articleCat), [articleCat]);

  const articleCats = ["All", ...Array.from(new Set(ARTICLES.map(a => a.category)))];

  // RFP filtering
  const filteredRfp = useMemo(() =>
    rfpCatFilter === "All" ? RFP : RFP.filter(c => c.cat === rfpCatFilter),
    [rfpCatFilter]);

  // Cost modeler calculation (manual trigger version, kept for button)
  const calculateSavings = () => {
    if (liveResult) setModelerResult(liveResult);
  };

  // Sync live result into modelerResult whenever it changes
  useEffect(() => {
    setModelerResult(liveResult);
  }, [liveResult]);

  const copyQuestion = (q: string) => {
    navigator.clipboard.writeText(q);
    setCopied(q);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleRfpQuestion = (q: string) => {
    setSelectedRfpQuestions(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q); else next.add(q);
      return next;
    });
  };

  const downloadRfp = () => {
    const lines = RFP.flatMap(c => [`\n## ${c.cat}`, ...c.qs.map((q, i) => `${i + 1}. ${q}`)]);
    const blob = new Blob([`PBM RFP Question Bank — Kincaid Health / RxPBM\n${lines.join("\n")}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "PBM_RFP_Questions.txt"; a.click();
  };

  return (
    <Layout fullBleed>
      <div className="h-full flex flex-col bg-[var(--kiq-surface)] text-[var(--kiq-ink)] overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-[var(--kiq-hairline)] bg-[var(--kiq-surface)]" style={{ boxShadow: "0 1px 0 #ffffff" }}>
          <div className="flex items-center gap-3 px-5 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-black text-[var(--kiq-ink)] leading-tight">RxPBM Intelligence</p>
                <p className="text-[9px] text-zinc-600 leading-none uppercase tracking-widest">Drug Pricing · PBM Analytics · Contract Intelligence</p>
              </div>
            </div>

            <div className="h-5 w-px bg-[var(--kiq-surface)] mx-1" />

            {/* Tabs */}
            <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-none">
              {TABS.map(tab => (
                <button key={tab.id} data-testid={`tab-rxpbm-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "text-zinc-500 hover:text-[var(--kiq-muted)] hover:bg-[var(--kiq-surface)]/60"}`}
                >
                  <tab.icon className="w-3 h-3 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Export Report button */}
            <button data-testid="btn-export-report"
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
              style={{ color: "#a78bfa", background: "rgba(139,92,246,0.08)", borderColor: "rgba(139,92,246,0.25)" }}>
              <FileOutput className="w-3 h-3" /> Export Report
            </button>

            <button
              data-testid="btn-rx-defense-link"
              onClick={() => navigate("/rx-defense")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ml-1"
              style={{ color: "#10b981", background: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.25)" }}
            >
              <Zap className="w-3 h-3" /> Contract Analyzer
            </button>
          </div>
        </div>

        {/* ── Onboarding Banner ────────────────────────────────────────────── */}
        {showOnboarding && (
          <OnboardingBanner onDismiss={dismissOnboarding} onTabSwitch={setActiveTab} />
        )}

        {/* ── Summary Dashboard Bar ────────────────────────────────────────── */}
        <SummaryBar
          modelerResult={modelerResult}
          lives={lives}
          highRiskCount={highRiskCount}
          onTabSwitch={setActiveTab}
        />

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ══ DRUG PRICING ══════════════════════════════════════════════════ */}
          {activeTab === "pricing" && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
                <div className="flex-1">
                  <h2 className="text-base font-black text-[var(--kiq-ink)]">Drug Pricing Intelligence</h2>
                  <p className="text-xs text-zinc-500">CMS NADAC · AWP RedBook · Manufacturer WAC — {DRUGS.length} specialty & high-cost drugs · Q1 2026</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <Input data-testid="input-drug-search" placeholder="Search drug…" value={drugSearch}
                      onChange={e => setDrugSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] placeholder:text-zinc-600 w-48" />
                  </div>
                  <select data-testid="select-drug-class" value={drugClass} onChange={e => setDrugClass(e.target.value)}
                    className="h-8 text-xs bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)] rounded-lg px-2 max-w-[180px]">
                    {drugClasses.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { v: `${DRUGS.length}`, l: "Drugs tracked", c: "text-emerald-400" },
                  { v: "CMS NADAC", l: "Primary benchmark", c: "text-blue-400" },
                  { v: "12–70%", l: "AWP-to-NADAC spread range", c: "text-amber-400" },
                  { v: "Q1 2026", l: "Data reference period", c: "text-zinc-400" },
                ].map(s => (
                  <div key={s.l} className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-lg p-3 text-center">
                    <div className={`text-lg font-black ${s.c}`}>{s.v}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{s.l}</div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--kiq-hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--kiq-canvas-soft)]/80 border-b border-[var(--kiq-hairline)]">
                    <tr>{["Drug Name", "Dosage / Form", "Class", "AWP (30-day)", "WAC", "NADAC (CMS)", "Spread"].map(h =>
                      <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrugs.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-canvas-soft)]/50 transition-colors" data-testid={`row-drug-${i}`}>
                        <td className="py-2.5 px-3 font-bold text-xs text-[var(--kiq-ink-soft)]">{d.name}</td>
                        <td className="py-2.5 px-3 text-[10px] text-zinc-500 max-w-[180px]">{d.generic}</td>
                        <td className="py-2.5 px-3"><span className="text-[10px] text-zinc-400 bg-[var(--kiq-surface)] px-2 py-0.5 rounded">{d.class}</span></td>
                        <td className="py-2.5 px-3 font-mono text-xs text-[var(--kiq-muted)]">{fmt$(d.awp)}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-zinc-500">{fmt$(d.wac)}</td>
                        <td className="py-2.5 px-3 font-mono text-xs font-bold text-emerald-400">{fmt$(d.nadac)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${d.spread > 25 ? "bg-red-500/15 text-red-400" : d.spread > 18 ? "bg-amber-500/15 text-amber-400" : "bg-[var(--kiq-surface)] text-zinc-400"}`}>
                            {d.spread.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredDrugs.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-zinc-600 text-sm">No drugs match</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-xs text-zinc-500">
                <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                <span>Spread = (AWP − NADAC) / AWP × 100. Red &gt;25% indicates high PBM overcharge risk. Source: CMS NADAC database (weekly updates), manufacturer WAC filings, Q1 2026. AWP from RedBook. Not legal or financial advice.</span>
              </div>
            </div>
          )}

          {/* ══ PBM DIRECTORY ═════════════════════════════════════════════════ */}
          {activeTab === "directory" && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-black text-[var(--kiq-ink)]">PBM Directory</h2>
                  <p className="text-xs text-zinc-500">24 PBMs compared on fiduciary transparency. Sources: Drug Channels Institute 2025, FTC Interim Staff Reports, SEC filings.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <Input data-testid="input-pbm-search" placeholder="Search PBMs…" value={pbmSearch}
                      onChange={e => setPbmSearch(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] placeholder:text-zinc-600 w-44" />
                  </div>
                  {/* Risk rating filter */}
                  <select data-testid="select-pbm-risk"
                    value={pbmRiskFilter}
                    onChange={e => setPbmRiskFilter(e.target.value as typeof pbmRiskFilter)}
                    className="h-8 text-xs bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)] rounded-lg px-2">
                    <option value="all">All Risk Levels</option>
                    <option value="high">High Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="low">Low Risk</option>
                  </select>
                  {/* Model type filter */}
                  <select data-testid="select-pbm-model"
                    value={pbmModelFilter}
                    onChange={e => setPbmModelFilter(e.target.value as typeof pbmModelFilter)}
                    className="h-8 text-xs bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)] rounded-lg px-2">
                    <option value="all">All Models</option>
                    <option value="Spread">Spread</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="Pass-Through">Pass-Through</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--kiq-hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--kiq-canvas-soft)]/80 border-b border-[var(--kiq-hairline)]">
                    <tr>{["PBM", "Parent / Owner", "Model", "Pass-Through", "100% Rebates", "Audit Rights", "Spread", "Owned Rx", "Market", "Risk"].map(h =>
                      <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPbms.map((p, i) => (
                      <tr key={i} className="border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-canvas-soft)]/50 transition-colors" data-testid={`row-pbm-${i}`}>
                        <td className="py-2.5 px-3 font-bold text-xs text-[var(--kiq-ink-soft)] whitespace-nowrap">{p.name}</td>
                        <td className="py-2.5 px-3 text-[10px] text-zinc-500">{p.owner}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.model === "Spread" ? "bg-red-500/10 text-red-400" : p.model === "Pass-Through" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{p.model}</span>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-semibold" style={{ color: ptC(p.pass) }}>{p.pass}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold" style={{ color: ptC(p.rebate) }}>{p.rebate}</td>
                        <td className="py-2.5 px-3 text-xs font-semibold" style={{ color: ptC(p.audit) }}>{p.audit}</td>
                        <td className="py-2.5 px-3 text-center">{p.spread ? <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />}</td>
                        <td className="py-2.5 px-3 text-center">{p.ownedRx ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto" />}</td>
                        <td className="py-2.5 px-3 font-mono text-xs text-zinc-400">{p.market}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
                            style={{ color: riskC(p.risk), background: riskBg(p.risk) }}>{p.risk}</span>
                        </td>
                      </tr>
                    ))}
                    {filteredPbms.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-zinc-600 text-sm">No PBMs match</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Spread column: ✓ = no spread retained</span>
                <span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-400" /> Owned Rx: ⚠ = PBM owns specialty pharmacies (steering risk)</span>
                <span>Sources: Drug Channels Institute 2025, FTC Interim Staff Reports on PBMs (2022–2024), company SEC filings.</span>
              </div>
            </div>
          )}

          {/* ══ FORMULARY ═════════════════════════════════════════════════════ */}
          {activeTab === "formulary" && (
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-black text-[var(--kiq-ink)]">Formulary Coverage Checker</h2>
                  <p className="text-xs text-zinc-500">See which PBMs cover a drug, tier placement, prior auth requirements, and estimated copays.</p>
                </div>
                <div className="relative w-56">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <Input data-testid="input-formulary-search" placeholder="Search drug or class…" value={formularySearch}
                    onChange={e => setFormularySearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] placeholder:text-zinc-600" />
                </div>
              </div>

              {/* Tier legend */}
              <div className="flex flex-wrap gap-2 p-3 bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-lg">
                <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-wider mr-1">Tiers:</span>
                {Object.entries(TIERS).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: v.color, background: v.bg }}>{v.label}</span>
                ))}
                <span className="text-[10px] text-zinc-500 ml-2">PA = Prior Auth required · ST = Step Therapy required</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--kiq-hairline)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--kiq-canvas-soft)]/80 border-b border-[var(--kiq-hairline)]">
                    <tr>
                      <th className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Drug</th>
                      <th className="text-left py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Class</th>
                      {["CVS Caremark", "Express Scripts", "OptumRx", "MedImpact", "Navitus"].map(pbm =>
                        <th key={pbm} className="py-2.5 px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">{pbm}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFormulary.map((f, i) => (
                      <tr key={i} className="border-b border-[var(--kiq-hairline)]/60 hover:bg-[var(--kiq-canvas-soft)]/50 transition-colors" data-testid={`row-formulary-${i}`}>
                        <td className="py-3 px-3">
                          <div className="font-bold text-xs text-[var(--kiq-ink-soft)]">{f.drug}</div>
                          <div className="text-[10px] text-zinc-600">{f.generic}</div>
                        </td>
                        <td className="py-3 px-3"><span className="text-[10px] text-zinc-400 bg-[var(--kiq-surface)] px-1.5 py-0.5 rounded">{f.class}</span></td>
                        {[f.cvs, f.esi, f.optum, f.medimpact, f.navitus].map((tier, j) => (
                          <td key={j} className="py-3 px-3"><TierBadge {...tier} /></td>
                        ))}
                      </tr>
                    ))}
                    {filteredFormulary.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-zinc-600 text-sm">No drugs match</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                A drug on Tier 1 at one PBM may be Tier 3 at another — a difference of hundreds of dollars per month for the same medication. Tier placement is often driven by rebate deals, not clinical evidence.
              </div>
            </div>
          )}

          {/* ══ COST MODELER ══════════════════════════════════════════════════ */}
          {activeTab === "modeler" && (
            <div className="p-5 max-w-3xl">
              <h2 className="text-base font-black text-[var(--kiq-ink)] mb-1">Cost Variance Modeler</h2>
              <p className="text-xs text-zinc-500 mb-5">Estimate savings from switching PBM models based on your plan size and drug spend. Results update as you type.</p>

              {/* Primary inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="text-xs text-zinc-400 font-semibold block mb-1.5">Covered Lives</label>
                  <Input data-testid="input-lives" type="number" value={lives} onChange={e => setLives(e.target.value)}
                    className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] text-sm" placeholder="e.g. 500" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-semibold block mb-1.5">Annual Drug Spend ($)</label>
                  <Input data-testid="input-spend" type="number" value={annualSpend} onChange={e => setAnnualSpend(e.target.value)}
                    className="bg-[var(--kiq-canvas-soft)] border-[var(--kiq-hairline)] text-[var(--kiq-ink-soft)] text-sm" placeholder="e.g. 1500000" />
                </div>
              </div>

              {/* Live preview result */}
              {liveResult && (
                <div className="mb-5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-4 flex-wrap">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex gap-4 flex-wrap text-sm">
                    <span><span className="text-zinc-500 text-xs">Est. Savings:</span> <span className="font-black text-emerald-400">${liveResult.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
                    <span><span className="text-zinc-500 text-xs">Per Life:</span> <span className="font-black text-blue-400">${liveResult.perLife.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
                    <span><span className="text-zinc-500 text-xs">Spread Savings:</span> <span className="font-black text-violet-400">${liveResult.spreadSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span></span>
                  </div>
                  <span className="text-[10px] text-emerald-500/60 ml-auto">Live preview</span>
                </div>
              )}

              {/* Advanced options toggle */}
              <button data-testid="btn-advanced-toggle"
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-[var(--kiq-ink-soft)] transition-colors mb-4 group">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Advanced options
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showAdvanced && (
                <div className="space-y-5 mb-5 p-4 rounded-xl border border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)]/40">
                  <div>
                    <label className="text-xs text-zinc-400 font-semibold block mb-2">Current PBM Model</label>
                    <div className="grid grid-cols-3 gap-3">
                      {([
                        { v: "traditional" as PbmModel, label: "Traditional (Big 3)", desc: "CVS, ESI, OptumRx — spread + rebate retention" },
                        { v: "regional" as PbmModel, label: "Regional / Hybrid", desc: "Mid-tier PBMs with partial pass-through" },
                        { v: "transparent" as PbmModel, label: "Transparent Pass-Through", desc: "Full ingredient cost + rebate pass, no spread" },
                      ] as const).map(opt => (
                        <button key={opt.v} data-testid={`btn-model-${opt.v}`} onClick={() => setPbmModel(opt.v)}
                          className={`text-left p-3 rounded-xl border transition-all text-xs ${pbmModel === opt.v ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200" : "border-[var(--kiq-hairline)] bg-[var(--kiq-canvas-soft)] text-zinc-400 hover:border-zinc-600"}`}>
                          <div className="font-bold mb-1">{opt.label}</div>
                          <div className="text-zinc-500 text-[10px] leading-relaxed">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 font-semibold block mb-2">Generic Dispensing Rate: <span className="text-emerald-400">{genericRate}%</span></label>
                    <input type="range" min={75} max={95} step={1} value={genericRate} onChange={e => setGenericRate(+e.target.value)}
                      data-testid="slider-generic-rate"
                      className="w-full h-1.5 bg-[var(--kiq-surface)] rounded-full appearance-none cursor-pointer accent-emerald-500" />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1"><span>75%</span><span>Industry avg: 85%</span><span>95%</span></div>
                  </div>
                </div>
              )}

              <Button data-testid="btn-calculate" onClick={calculateSavings}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold mb-6 w-full sm:w-auto px-8">
                <Calculator className="w-4 h-4 mr-2" /> Calculate Variance
              </Button>

              {modelerResult && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Spread Savings", v: `$${modelerResult.spreadSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, c: "text-emerald-400", sub: "Eliminating PBM ingredient spread" },
                      { label: "Rebate Recovery", v: `$${modelerResult.rebateSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, c: "text-blue-400", sub: "Full manufacturer rebate pass-through" },
                      { label: "Total Variance", v: `$${modelerResult.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, c: "text-amber-400", sub: "Combined estimated savings" },
                      { label: "Per Covered Life", v: `$${modelerResult.perLife.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, c: "text-violet-400", sub: "Annual cost reduction per member" },
                    ].map(s => (
                      <div key={s.label} className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-4 text-center" data-testid={`result-${s.label.replace(/\s/g,"-").toLowerCase()}`}>
                        <div className={`text-xl font-black ${s.c}`}>{s.v}</div>
                        <div className="text-xs font-semibold text-[var(--kiq-muted)] mt-1">{s.label}</div>
                        <div className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{s.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-xs text-zinc-500">
                    <Info className="w-3.5 h-3.5 inline mr-1.5 text-zinc-600" />
                    Estimates based on industry-average spread rates (9% traditional, 4% regional, 0% transparent) and rebate leakage assumptions from FTC interim reports. Actual variance depends on your specific formulary, drug mix, and contract terms. For informational purposes only — not financial advice.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ RFP BANK ══════════════════════════════════════════════════════ */}
          {activeTab === "rfp" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-black text-[var(--kiq-ink)]">PBM RFP Question Bank</h2>
                  <p className="text-xs text-zinc-500">
                    25 fiduciary-aligned procurement questions across 5 categories. Select questions to include in your export report.
                    {selectedRfpQuestions.size > 0 && (
                      <span className="ml-2 text-emerald-400 font-semibold">{selectedRfpQuestions.size} selected</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Category filter dropdown */}
                  <select data-testid="select-rfp-category"
                    value={rfpCatFilter}
                    onChange={e => setRfpCatFilter(e.target.value)}
                    className="h-8 text-xs bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] text-[var(--kiq-muted)] rounded-lg px-2">
                    <option value="All">All Categories</option>
                    {RFP.map(c => <option key={c.cat} value={c.cat}>{c.cat}</option>)}
                  </select>
                  <Button variant="outline" size="sm" data-testid="btn-download-rfp" onClick={downloadRfp}
                    className="border-[var(--kiq-hairline)] text-[var(--kiq-muted)] hover:bg-[var(--kiq-surface)] text-xs">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Download All
                  </Button>
                </div>
              </div>

              {filteredRfp.map(cat => (
                <div key={cat.cat}>
                  <div className="flex items-center gap-2 mb-2">
                    <cat.icon className="w-3.5 h-3.5 shrink-0" style={{ color: cat.color }} />
                    <span className="text-xs font-black uppercase tracking-wider" style={{ color: cat.color }}>{cat.cat}</span>
                  </div>
                  <div className="space-y-2">
                    {cat.qs.map((q, i) => {
                      const isSelected = selectedRfpQuestions.has(q);
                      return (
                        <div key={q} data-testid={`question-rfp-${cat.cat}-${i}`}
                          className="w-full text-left rounded-lg px-4 py-3 transition-all flex items-start gap-3"
                          style={{
                            background: isSelected ? `${cat.color}10` : "rgba(24,24,27,1)",
                            border: `1px solid ${isSelected ? cat.color + "40" : "rgba(63,63,70,1)"}`,
                          }}>
                          {/* Checkbox */}
                          <button data-testid={`checkbox-rfp-${cat.cat}-${i}`}
                            onClick={() => toggleRfpQuestion(q)}
                            className="shrink-0 mt-0.5 w-4 h-4 rounded border transition-all flex items-center justify-center"
                            style={{
                              background: isSelected ? cat.color : "transparent",
                              borderColor: isSelected ? cat.color : "rgba(113,113,122,1)",
                            }}>
                            {isSelected && <CheckCircle2 className="w-3 h-3 text-[var(--kiq-ink)]" />}
                          </button>
                          <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0"
                            style={{ background: `${cat.color}20`, color: cat.color }}>{i + 1}</span>
                          <span className="text-sm text-[var(--kiq-muted)] leading-relaxed flex-1">{q}</span>
                          <button data-testid={`btn-copy-rfp-${cat.cat}-${i}`}
                            onClick={() => copyQuestion(q)}
                            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1 shrink-0 mt-0.5">
                            {copied === q ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />Copied</> : <><Clipboard className="w-3.5 h-3.5" />Copy</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ ARTICLES ══════════════════════════════════════════════════════ */}
          {activeTab === "articles" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-base font-black text-[var(--kiq-ink)]">PBM Intelligence Articles</h2>
                  <p className="text-xs text-zinc-500">Analysis of PBM pricing, contract strategies, and pharmacy benefit optimization for self-funded employers.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {articleCats.map(c => (
                    <button key={c} data-testid={`filter-article-${c}`} onClick={() => setArticleCat(c)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${articleCat === c ? "text-[var(--kiq-ink)]" : "bg-[var(--kiq-canvas-soft)] text-zinc-500 hover:text-[var(--kiq-muted)] border border-[var(--kiq-hairline)]"}`}
                      style={articleCat === c && c !== "All" ? { background: `${catColor[c]}20`, border: `1px solid ${catColor[c]}50`, color: catColor[c] } : articleCat === c ? { background: "#e2e8f0", border: "1px solid #cbd5e1", color: "#0F172A" } : {}}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredArticles.map((a, i) => (
                  <div key={i} data-testid={`card-article-${i}`}
                    className="bg-[var(--kiq-canvas-soft)] border border-[var(--kiq-hairline)] rounded-xl p-5 hover:border-[var(--kiq-hairline)] transition-all group flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
                        style={{ color: catColor[a.category] ?? "#6b7280", background: `${catColor[a.category] ?? "#6b7280"}20` }}>{a.category}</span>
                      <span className="text-[10px] text-zinc-600">{a.date}</span>
                      <span className="text-[10px] text-zinc-700 ml-auto">{a.readMin} min read</span>
                    </div>
                    <h3 className="text-sm font-bold text-[var(--kiq-ink-soft)] leading-snug mb-2 group-hover:text-[var(--kiq-ink)] transition-colors flex-1">{a.title}</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{a.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ PBM ANALYSIS GUIDE ════════════════════════════════════════════ */}
          {activeTab === "analysis" && <PbmAnalysisGuide onTabSwitch={setActiveTab} />}

        </div>
      </div>

      {/* ── Export Report Modal ───────────────────────────────────────────── */}
      {showExport && (
        <ExportReportModal
          modelerResult={modelerResult}
          lives={lives}
          annualSpend={annualSpend}
          pbmModel={pbmModel}
          genericRate={genericRate}
          selectedRfpQuestions={selectedRfpQuestions}
          onClose={() => setShowExport(false)}
        />
      )}
    </Layout>
  );
}

// ─── PBM Analysis Guide ───────────────────────────────────────────────────────
const PHASES = [
  {
    num: 1, icon: ScanSearch, color: "#4f7dff", label: "Gather the Data",
    tagline: "You can't analyze what you don't have. Start by demanding these documents.",
    steps: [
      "Request a full 24-month claims extract in machine-readable format (CSV/Excel). Must include: NDC, brand/generic flag, drug name, days supply, quantity, paid amount, patient responsibility, pharmacy NPI.",
      "Pull your current PBM contract + all amendments. Identify the 'ingredient cost' definition — this is where spread is hidden.",
      "Request the MAC (Maximum Allowable Cost) list and its update frequency. If they won't share it, that is a red flag.",
      "Get your current formulary in writing with tier placements, PA requirements, and step therapy protocols.",
      "Request a rebate reconciliation report — total rebates earned vs. passed through, by drug, for the last 12 months.",
    ],
    flags: [
      "PBM refuses to provide claims data in machine-readable format",
      "Ingredient cost defined as 'AWP minus discount' rather than actual acquisition cost",
      "MAC list is 'proprietary' or not disclosed",
      "Rebate report shows 'estimated' rather than 'actual' amounts",
    ],
    metric: { label: "Minimum data window", val: "24 months of claims" },
  },
  {
    num: 2, icon: DollarSign, color: "#f59e0b", label: "Audit Drug Pricing",
    tagline: "Compare what the PBM billed you against what drugs actually cost at the pharmacy.",
    steps: [
      "For every brand claim, compare 'paid to pharmacy' against CMS NADAC. NADAC represents actual acquisition cost for most retail pharmacies.",
      "Calculate spread per claim: Spread = (Billed to Plan) − (NADAC cost). Total across all claims to find aggregate spread captured.",
      "Run a generic MAC audit: identify 20 high-volume generics and compare your paid cost vs. GoodRx/Mark Cuban CostPlus pricing. Any spread > 50% is a fiduciary concern.",
      "Check specialty drug pricing: compare your paid cost against the WAC listed by the manufacturer. Specialty spread routinely runs 15–30%.",
      "Identify any 'clawback' provisions: if the patient's copay exceeds the drug cost, does the PBM keep the difference?",
    ],
    flags: [
      "Generic claims consistently priced 3–10× above NADAC or GoodRx",
      "Specialty drug prices above WAC — possible double-dip on rebates",
      "PBM collects patient copay 'clawbacks' — plan pays nothing but PBM profits",
      "AWP discount guarantees look good but actual paid is far above NADAC",
    ],
    metric: { label: "Industry avg generic spread", val: "~$4–12 per claim overcharge" },
  },
  {
    num: 3, icon: BarChart3, color: "#8b5cf6", label: "Evaluate Rebates",
    tagline: "Rebates are the biggest hidden profit center for PBMs. Most of it never reaches your plan.",
    steps: [
      "Calculate your effective rebate pass-through rate: (Rebates received by plan) ÷ (Total manufacturer rebates earned). Anything below 85% is a concern; many Big 3 contracts run 60–70%.",
      "Identify which drugs generate rebates and whether they are on preferred tiers because of clinical evidence or because of rebate deals.",
      "Ask for a complete list of manufacturer administrative fees, data licensing fees, and 'GPO access fees' paid to the PBM. These are rebates by another name.",
      "Review rebate guarantees vs. actuals in the reconciliation report. If guaranteed rebates consistently exceed actuals, the plan is subsidizing the PBM's shortfalls.",
      "Check: are rebates paid at point-of-sale (instant) or quarterly after the fact? Point-of-sale rebates dramatically improve plan cash flow.",
    ],
    flags: [
      "Rebate pass-through rate below 85%",
      "PBM receiving 'admin fees' or 'data fees' from drug manufacturers",
      "High-rebate drugs placed on preferred tier despite cheaper clinical alternatives",
      "Rebates paid quarterly with 6–12 month lag — significant float benefit for PBM",
      "GPO (Group Purchasing Organization) relationships not disclosed",
    ],
    metric: { label: "Typical rebate leakage (Big 3)", val: "2–4% of total drug spend" },
  },
  {
    num: 4, icon: FileText, color: "#ef4444", label: "Review the Contract",
    tagline: "Most employer-unfriendly provisions are buried in definitions and amendments — not the headline terms.",
    steps: [
      "Find the definition of 'ingredient cost.' If it says 'AWP minus X%' rather than 'actual acquisition cost' or 'NADAC,' you are likely paying spread.",
      "Locate the audit rights clause. Confirm: (1) unrestricted right to audit, (2) lookback period ≥ 3 years, (3) right to extrapolate findings, (4) no mandatory arbitration for overcharges.",
      "Identify any 'most favored nation' clauses that prevent you from sharing claims data with competitors or consultants.",
      "Check for 'gag clauses' — provisions that prevent pharmacists from telling patients about cheaper alternatives.",
      "Review the termination clause: can you exit cleanly? Are data and claims returned within 30 days of termination? Is there a termination fee that makes switching cost-prohibitive?",
    ],
    flags: [
      "Ingredient cost defined using AWP rather than actual acquisition",
      "Audit lookback < 36 months or extrapolation prohibited",
      "Data sharing restrictions with consultants or competitors",
      "Termination fee > $50K or data return window > 60 days",
      "Mandatory arbitration for overcharge disputes (limits recovery)",
    ],
    metric: { label: "Key contract red flag", val: "Spread pricing in ingredient cost definition" },
  },
  {
    num: 5, icon: Scale, color: "#10b981", label: "Benchmark the Market",
    tagline: "Your PBM's pricing only looks reasonable until you see what you could pay elsewhere.",
    steps: [
      "Request pricing proposals from 2–3 transparent/pass-through PBMs (MedImpact, Navitus, Capital Rx) using your actual claims data.",
      "Compare guaranteed net cost per claim (including rebates) across incumbent and alternatives. Focus on specialty and high-spend drugs.",
      "Evaluate administrative PMPM fees separately from drug costs — transparent PBMs charge explicit admin fees rather than hiding margin in spread.",
      "Review network adequacy: does the alternative PBM have the same retail and specialty pharmacies your members use?",
      "Calculate the full cost of switching: transition fees, implementation costs, member disruption, formulary changes — offset against projected savings.",
    ],
    flags: [
      "Incumbent PBM refuses to provide a 'best and final' offer when presented with competitive quotes",
      "Comparison reveals incumbent is charging 12–20% more than transparent alternatives on equivalent drug mix",
      "Network comparison shows significant gaps in retail or specialty pharmacy coverage",
      "Benchmark reveals rebate pass-through rate of <75% vs. 95–100% at alternatives",
    ],
    metric: { label: "Typical savings from switching to pass-through", val: "8–15% of total Rx spend" },
  },
  {
    num: 6, icon: Lightbulb, color: "#f97316", label: "Score and Act",
    tagline: "Translate the analysis into a risk rating and a concrete action plan for the plan sponsor.",
    steps: [
      "Score the PBM on five dimensions: (1) Pricing transparency, (2) Rebate pass-through rate, (3) Audit rights, (4) Conflict of interest (owned Rx/specialty), (5) Contract flexibility. Rate each 1–5.",
      "Identify 'quick wins' — contract amendments that can be negotiated without a full RFP. Examples: adding audit rights, requiring rebate reconciliation, removing clawback provisions.",
      "If spread pricing is confirmed, calculate the dollar value and prepare a written demand for credit or contract renegotiation.",
      "If switching is indicated, issue an RFP to 3–5 PBMs using the Kincaid Health RFP Question Bank. Require responses on all 25 fiduciary questions.",
      "Document findings in a fiduciary file. ERISA requires plan sponsors to demonstrate prudent oversight of pharmacy benefits — your analysis is both a tool and a compliance record.",
    ],
    flags: [
      "Total score < 15 of 25 — strong case for RFP or immediate contract amendment",
      "Confirmed spread > $50K annually — formal demand letter warranted",
      "Fiduciary documentation gap — plan has no written record of PBM oversight",
      "PBM refuses to negotiate audit rights — consider market exit",
    ],
    metric: { label: "ERISA prudence standard", val: "Written review required for plan fiduciaries" },
  },
];

const SCORECARD = [
  { dim: "Pricing Transparency", q: "Does your PBM price on NADAC/actual cost, not AWP spread?" },
  { dim: "Rebate Pass-Through", q: "Do you receive ≥ 90% of all manufacturer rebates?" },
  { dim: "Audit Rights", q: "Can you audit claims with no restrictions, extrapolate, 36-month lookback?" },
  { dim: "Conflict of Interest", q: "Does your PBM have zero ownership in pharmacies in your network?" },
  { dim: "Contract Flexibility", q: "Can you exit the contract within 90 days with full data return at no fee?" },
];

function PbmAnalysisGuide({ onTabSwitch }: { onTabSwitch: (t: Tab) => void }) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const [scores, setScores] = useState<Record<number, number>>({});

  const totalScore = Object.values(scores).reduce((s, v) => s + v, 0);
  const maxScore = SCORECARD.length * 5;
  const scoreLabel = totalScore >= 20 ? { t: "Low Risk", c: "#10b981" } : totalScore >= 13 ? { t: "Moderate Risk", c: "#f59e0b" } : { t: "High Risk — Act Now", c: "#ef4444" };

  return (
    <div className="p-5 space-y-6 max-w-4xl">

      {/* Header */}
      <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg,rgba(79,125,255,0.08),rgba(16,185,129,0.04))", border: "1px solid #e2e8f0" }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(79,125,255,0.12)", border: "1px solid rgba(79,125,255,0.25)" }}>
            <ClipboardList className="w-6 h-6" style={{ color: "#4f7dff" }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black tracking-widest uppercase mb-1" style={{ color: "rgba(79,125,255,0.8)" }}>Kincaid Health · Methodology</p>
            <h2 className="text-xl font-black text-[var(--kiq-ink)] mb-2">How to Conduct a PBM Analysis</h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
              A 6-phase fiduciary-grade framework for self-funded employers. Follow these steps to uncover spread pricing, rebate leakage, and contract risks — and build a documented prudence record under ERISA.
            </p>
          </div>
          <div className="hidden lg:flex flex-col items-end gap-1 text-right shrink-0">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Analysis tools</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {(["pricing","directory","modeler","rfp"] as Tab[]).map(tab => (
                <button key={tab} onClick={() => onTabSwitch(tab)}
                  className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                  style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(15,23,42,0.06)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#475569"; e.currentTarget.style.background = "#f8fafc"; }}>
                  {tab === "pricing" ? "Drug Pricing" : tab === "directory" ? "PBM Directory" : tab === "modeler" ? "Cost Modeler" : "RFP Bank"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Phase steps */}
      <div className="space-y-3">
        {PHASES.map((phase, idx) => {
          const open = expanded === idx;
          return (
            <div key={idx} className="rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${open ? phase.color + "35" : "#f1f5f9"}`, background: open ? `${phase.color}06` : "#ffffff" }}>
              <button data-testid={`phase-toggle-${idx}`} className="w-full flex items-center gap-4 px-5 py-4 text-left transition-all"
                onClick={() => setExpanded(open ? null : idx)}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${phase.color}15`, border: `1px solid ${phase.color}30` }}>
                  <phase.icon className="w-4 h-4" style={{ color: phase.color }} />
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-[10px] font-black font-mono w-12 shrink-0" style={{ color: phase.color }}>Phase {phase.num}</span>
                  <span className="text-sm font-black text-[var(--kiq-ink)]">{phase.label}</span>
                  <span className="text-xs text-zinc-500 hidden sm:block truncate">{phase.tagline}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: `${phase.color}12`, color: phase.color, border: `1px solid ${phase.color}25` }}>
                    {phase.metric.val}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-600 transition-transform" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
                </div>
              </button>

              {open && (
                <div className="px-5 pb-5 space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed italic border-l-2 pl-3" style={{ borderColor: phase.color + "60" }}>{phase.tagline}</p>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black tracking-widest uppercase text-zinc-600">Analysis Steps</p>
                      {phase.steps.map((step, si) => (
                        <div key={si} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid #f8fafc" }}>
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5" style={{ background: `${phase.color}18`, color: phase.color }}>{si + 1}</span>
                          <p className="text-xs text-zinc-400 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <p className="text-[9px] font-black tracking-widest uppercase text-zinc-600">Red Flags to Catch</p>
                      {phase.flags.map((flag, fi) => (
                        <div key={fi} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                          <CircleAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-300/70 leading-relaxed">{flag}</p>
                        </div>
                      ))}

                      <div className="flex items-center gap-2 p-3 rounded-lg mt-1" style={{ background: `${phase.color}08`, border: `1px solid ${phase.color}20` }}>
                        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: phase.color }} />
                        <p className="text-[10px] text-zinc-400 leading-snug">
                          <span className="font-bold" style={{ color: phase.color }}>Use the other tabs</span> — Drug Pricing shows NADAC vs AWP; PBM Directory shows rebate/audit ratings; RFP Bank gives you the contract questions.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Scorecard */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ background: "#ffffff", borderBottom: "1px solid #f1f5f9" }}>
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-black text-[var(--kiq-ink)]">Quick PBM Risk Scorecard</span>
          </div>
          {Object.keys(scores).length === SCORECARD.length && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono" style={{ color: scoreLabel.c }}>{totalScore} / {maxScore}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded" style={{ background: `${scoreLabel.c}18`, color: scoreLabel.c, border: `1px solid ${scoreLabel.c}30` }}>{scoreLabel.t}</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-zinc-500">Rate your current PBM on each dimension. 1 = Failing · 5 = Best-in-class.</p>
          {SCORECARD.map((row, i) => (
            <div key={i} data-testid={`scorecard-row-${i}`} className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--kiq-muted)] leading-tight">{row.dim}</p>
                <p className="text-[10px] text-zinc-600 leading-tight mt-0.5">{row.q}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} data-testid={`score-${i}-${n}`}
                    onClick={() => setScores(prev => ({ ...prev, [i]: n }))}
                    className="w-8 h-8 rounded-lg text-xs font-black transition-all"
                    style={{
                      background: scores[i] === n ? (n <= 2 ? "rgba(239,68,68,0.3)" : n === 3 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)") : "#ffffff",
                      color: scores[i] === n ? (n <= 2 ? "#ef4444" : n === 3 ? "#f59e0b" : "#10b981") : "#64748b",
                      border: `1px solid ${scores[i] === n ? (n <= 2 ? "rgba(239,68,68,0.4)" : n === 3 ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)") : "#e2e8f0"}`,
                    }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(scores).length === SCORECARD.length && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: `${scoreLabel.c}08`, border: `1px solid ${scoreLabel.c}25` }}>
              <div className="flex items-center gap-2 mb-2">
                {totalScore >= 20 ? <BadgeCheck className="w-4 h-4" style={{ color: scoreLabel.c }} /> : <CircleAlert className="w-4 h-4" style={{ color: scoreLabel.c }} />}
                <span className="text-sm font-black" style={{ color: scoreLabel.c }}>{scoreLabel.t} — Score: {totalScore} / {maxScore}</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {totalScore >= 20
                  ? "Your PBM appears to be performing in a transparent, fiduciary-aligned manner. Continue annual reviews and ensure audit rights are exercised."
                  : totalScore >= 13
                  ? "Moderate risk identified. Review the phases above where you scored low and consider contract amendments before your next renewal."
                  : "High risk — your plan may be experiencing significant spread, rebate leakage, or audit gaps. Initiate a formal RFP process and consult legal counsel about fiduciary obligations."}
              </p>
              <button onClick={() => onTabSwitch("rfp")} className="mt-2 flex items-center gap-1.5 text-xs font-bold transition-colors" style={{ color: scoreLabel.c }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                <ChevronRight className="w-3.5 h-3.5" /> Open the RFP Question Bank
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: "#ffffff", border: "1px solid #f8fafc" }}>
        <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-zinc-600 leading-relaxed">
          This methodology is based on FTC Interim Staff Reports on PBMs (2022–2024), DOL guidance on ERISA plan fiduciary obligations, Drug Channels Institute 2025 research, and CAA 2026 transparency requirements. It is educational in nature and does not constitute legal, financial, or actuarial advice. Plan sponsors should consult qualified ERISA counsel before taking action.
        </p>
      </div>

    </div>
  );
}