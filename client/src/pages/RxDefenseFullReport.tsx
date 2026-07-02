import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import EmailReportModal from "@/components/EmailReportModal";
import {
  Download, Printer, CheckCircle2, XCircle, AlertTriangle,
  TrendingDown, DollarSign, ChevronRight, FileText, Shield,
  Zap, Target, Lock, BarChart2, ArrowUpRight, Minus, Mail
} from "lucide-react";

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
type Rating = "excellent" | "good" | "fair" | "concern" | "red_flag";

interface Issue { text: string; found: boolean; quote: string | null; gap: string | null }
interface Negotiation { gap_summary: string; model_language: string; talking_point: string }
interface ProvisionScore {
  id: number; name: string; score: number; rating: Rating; quick_look: string;
  issues: Issue[]; negotiation: Negotiation;
}
interface KeyFinding { severity: "critical" | "warning" | "positive"; text: string }
interface Contract {
  id: string; pbm_name: string | null; contract_filename: string;
  overall_score: number | null; rating: Rating | null;
  provision_scores: ProvisionScore[]; key_findings: KeyFinding[];
  created_at: string;
}

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */

const NEON = {
  green:  "#059669", blue: "#2563eb", gold: "#d97706",
  red:    "#dc2626", purple: "#7c3aed", orange: "#ea580c",
};

const RATING_CFG: Record<Rating, { label: string; color: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", color: "#059669", bg: "rgba(5,150,105,0.09)",   border: "rgba(5,150,105,0.30)" },
  good:      { label: "Good",      color: "#047857", bg: "rgba(4,120,87,0.09)",    border: "rgba(4,120,87,0.30)" },
  fair:      { label: "Fair",      color: "#d97706", bg: "rgba(217,119,6,0.10)",   border: "rgba(217,119,6,0.32)" },
  concern:   { label: "Concern",   color: "#c2410c", bg: "rgba(194,65,12,0.09)",   border: "rgba(194,65,12,0.30)" },
  red_flag:  { label: "Red Flag",  color: "#dc2626", bg: "rgba(220,38,38,0.08)",   border: "rgba(220,38,38,0.28)" },
};

/* Savings potential per provision if fully renegotiated (annual, USD) */
const PROVISION_SAVINGS: Record<number, { low: number; high: number; basis: string; context: string; importance: string }> = {
  1: { low: 25000,  high: 200000,  basis: "Legal exposure mitigation and ERISA fiduciary compliance",
       context: "Without explicit fiduciary acceptance, the PBM can legally act in its own economic interest — routing volume to owned pharmacies, retaining undisclosed revenue, and making formulary decisions for profit. Plans facing regulatory audit under CAA 2026 without this clause carry significant legal exposure.",
       importance: "ERISA §404 creates personal liability for plan fiduciaries who fail to monitor the PBM. A contractual fiduciary commitment shifts this burden and creates a private right of action." },
  2: { low: 150000, high: 1500000, basis: "Spread pricing elimination and MAC pricing transparency",
       context: "Spread pricing is the practice of billing the plan more than the PBM pays the pharmacy, pocketing the difference. For a plan with $3M in annual drug spend, spread pricing commonly adds 5–15% in hidden margin — $150K to $450K per year — with no clinical benefit.",
       importance: "The Consolidated Appropriations Act (CAA 2022 §204) requires pass-through pricing for Medicaid managed care. ERISA fiduciaries in self-funded plans face similar expectations. Spread pricing in a negotiated contract is a primary driver of inflated pharmacy spend." },
  3: { low: 75000,  high: 800000,  basis: "Full manufacturer revenue pass-through including pooled rebates",
       context: "Most PBMs retain a portion of manufacturer rebates in 'pooled' arrangements — averaging the rebate across all clients rather than passing through each client's earned amount. For a mid-size plan, the gap between pooled and actual rebates can be $75K–$300K/year. Admin fees, grants, data fees, and other manufacturer payments are rarely disclosed or remitted.",
       importance: "The DOL Field Assistance Bulletin 2021-02 confirmed that failing to capture all manufacturer revenue is a breach of fiduciary duty. Rebates are often 20–40% of gross drug cost on brand medications." },
  4: { low: 10000,  high: 100000,  basis: "Data commercialization prevention and real-time access value",
       context: "PBMs routinely sell de-identified claims data to pharmaceutical companies, hedge funds, and health analytics firms. A self-funded plan's data has commercial value estimated at $15–$50 per member per year. Preventing PBM monetization preserves this value for the plan.",
       importance: "Real-time data access enables fraud detection, specialty drug management, and clinical intervention — generating additional savings through early identification of high-cost claimants." },
  5: { low: 40000,  high: 500000,  basis: "Retroactive audit recovery and extrapolation rights",
       context: "Industry data shows that PBM audits with full extrapolation rights recover an average of $45–$180 per member per audit cycle. For a 500-life plan, a proper 36-month audit with extrapolation could recover $22,500–$90,000 in overcharges. Without extrapolation, systemic overcharges across thousands of claims are unrecoverable.",
       importance: "Audit rights are only valuable if the scope, lookback period, methodology, and enforceability are all contractually defined. A limited audit clause without extrapolation provides false security." },
  6: { low: 30000,  high: 300000,  basis: "Specialty pharmacy steering prevention and network neutrality",
       context: "PBMs that own specialty pharmacies earn additional margin when they direct members to their own dispensing operations. Specialty drugs represent ~50% of drug spend for many plans. Even a 5% differential in specialty drug cost on $1M of specialty spend = $50,000 per year in excess cost.",
       importance: "Specialty pharmacy is the fastest-growing segment of pharmacy spend. Contractual neutrality requirements and independent oversight are essential to prevent PBM conflict of interest in this space." },
  7: { low: 50000,  high: 500000,  basis: "Specialty carve-out and competitive vendor flexibility",
       context: "Plans that can carve out specialty drugs to independent dispensers typically save 10–25% on specialty spend. Without contractual carve-out rights, the PBM can contractually block the plan from using lower-cost alternatives. For a plan with $500K in specialty spend, this represents $50K–$125K per year.",
       importance: "The ability to benchmark and carve out is the single most powerful leverage tool in PBM negotiations. Contracts that restrict this right permanently disadvantage the plan." },
  8: { low: 75000,  high: 800000,  basis: "Formulary optimization and lowest net cost mandatory fulfillment",
       context: "When PBMs are not obligated to dispense the lowest net cost option at point of sale, they may dispense brand drugs with high rebates while collecting plan cost-sharing based on higher AWP prices — generating revenue while costing the plan more. Formulary optimization and biosimilar substitution can reduce brand drug spend by 8–20%.",
       importance: "Clinical integrity means formulary decisions are made on evidence-based criteria, not economic incentives. Without this contractual commitment, PBMs can legally favor high-margin drugs." },
  9: { low: 15000,  high: 200000,  basis: "Termination penalty avoidance and clean exit rights",
       context: "Long notice periods (90–180 days) and termination fees lock plans into unfavorable arrangements, preventing timely corrective action after identifying overcharges or underperformance. Plans that cannot exit quickly pay an estimated $1,200–$4,500 per member per year in excess costs during the lock-in period.",
       importance: "A clean exit clause is the enforcement mechanism for all other contract provisions. Without it, the plan has no practical remedy for PBM noncompliance during the contract term." },
  10: { low: 20000, high: 200000,  basis: "Administrative fee reduction and performance guarantee recovery",
       context: "Administrative fees vary enormously — from $1.50 to $8.00 PMPM for identical services. Without fee benchmarking rights and performance guarantees, plans cannot verify market competitiveness. SLA-backed performance guarantees with financial penalties create alignment between PBM compensation and plan outcomes.",
       importance: "Performance guarantees without financial consequences are marketing — not enforceable obligations. Guarantees should be backed by at-risk dollars equal to 5–10% of total PBM compensation." },
  11: { low: 30000, high: 300000, basis: "Step therapy override rights and evidence-based protocol enforcement",
       context: "PBMs profit when plans use high-rebate brand drugs. Step therapy and prior authorization are the primary tools for directing utilization toward those drugs. Without independent clinical oversight and plan override authority, step therapy protocols legally serve PBM economic interests — not plan clinical interests. A plan that cannot override an inappropriate step therapy requirement is locked into the PBM's preferred drug — and its preferred margin.",
       importance: "CAA 2026 requires meaningful access standards for step therapy appeals. Plans that cannot override medically inappropriate step therapy requirements are exposed to benefits denial litigation and regulatory enforcement." },
  12: { low: 50000, high: 500000, basis: "Mail order arbitrage elimination and specialty drug steering prevention",
       context: "Mail order pharmacy is the PBM's most profitable dispensing channel. PBMs that own mail order facilities (CVS Mail, OptumRx Home Delivery, Express Scripts Mail Pharmacy) capture the full dispensing margin when members use mandatory mail order programs. The excess cost vs. competitive mail order benchmarks averages 8–18% per fill. For a plan with significant mail order volume, mandatory mail routing to PBM-owned facilities costs $50K–$200K per year in excess dispensing fees alone.",
       importance: "Mail order mandates are contractual lock-in mechanisms. Plans cannot benefit from competitive pricing from independent mail pharmacies without contractual freedom of dispensing choice." },
  13: { low: 25000, high: 250000, basis: "GDR guarantee enforcement and performance reconciliation recovery",
       context: "Generic dispensing rate (GDR) guarantees are the most commonly breached PBM performance commitment. A PBM that guarantees 85% GDR but delivers 82% across a plan's claims creates measurable excess cost — each 1% GDR miss represents approximately $8–$18 PMPM in brand drug overpayment. Without financial penalties and independent verification, the PBM has no economic incentive to meet its stated GDR targets.",
       importance: "Annual performance reconciliation with retroactive financial adjustments is the mechanism that makes all performance guarantees enforceable. Without it, guarantees are aspirational benchmarks — not contractual obligations." },
};

const PROVISION_CONTEXT = {
  1: "CAA 2026 §3101 requires PBM transparency and fiduciary alignment for group health plans. A fiduciary loyalty commitment is the foundational protection for all other contract provisions.",
  2: "Spread pricing was banned in Medicaid by CMS in 2020. Self-funded ERISA plans must contractually prohibit it. Pass-through pricing means the plan pays exactly what the pharmacy is paid — no more.",
  3: "Manufacturer rebates are paid to PBMs as a percentage of drug list price (WAC). 100% pass-through contracts eliminate PBM incentives to favor high-list-price drugs. All forms of manufacturer revenue — not just rebates — must be captured.",
  4: "Claims data is among the most valuable assets of a self-funded plan. Ownership, access, portability, and restrictions on commercial use are distinct rights that must each be explicitly negotiated.",
  5: "Audit rights are the enforcement mechanism for all financial provisions. An audit clause without retroactive lookback, extrapolation rights, and enforceability is effectively worthless.",
  6: "PBMs that own specialty pharmacies — including Optum Rx (OptumRx Specialty), Express Scripts (Accredo), and CVS Caremark (Specialty Operations) — have documented conflicts of interest in specialty drug dispensing.",
  7: "Carve-out rights preserve plan optionality. Without them, the PBM contractually locks the plan into a single vendor for specialty drugs — preventing competition and benchmarking.",
  8: "The 'lowest net cost' standard — net of rebates and all other manufacturer payments — is the gold standard for formulary management. It ensures clinical decisions are made on evidence, not economics.",
  9: "Termination rights determine whether all other contract protections are real or theoretical. A plan that cannot exit cannot enforce its rights. Termination notice, data return, and exit penalty clauses must be plan-favorable.",
  10: "Administrative fees should be itemized, benchmarked, and subject to performance guarantees with at-risk dollars. PMPM fees, claim fees, specialty fees, and clinical program fees all require transparency.",
  11: "Step therapy and prior authorization protocols should reflect independent clinical evidence — not manufacturer rebate economics. Plans must retain override authority and a defined appeal timeline to prevent medically inappropriate denials and protect member access.",
  12: "Mail order and specialty drug dispensing are the two highest-margin segments for PBM-owned pharmacy operations. Contractual freedom of dispensing choice and anti-steering protections are essential to prevent the PBM from capturing excess margin on the plan's highest-cost drugs.",
  13: "Performance guarantees are only as strong as the financial penalty backing them. GDR guarantees, formulary compliance rates, claims accuracy, and SLA metrics must each be backed by at-risk dollars, independently verifiable data, and retroactive reconciliation with no self-cure loopholes.",
};

/* ─── DEEP DIVE: per-provision exploitation & fix detail ──────────────────── */
const PROVISION_DEEP_DIVE: Record<number, {
  what_pbm_does: string[];
  red_flag_language: string[];
  dollar_mechanism: string;
  fix_required: string;
}> = {
  1: {
    what_pbm_does: [
      "Without a fiduciary loyalty clause, the PBM's contractual obligation is to itself — not the plan. This means every formulary decision, network design choice, and vendor routing decision can legally be made to maximize the PBM's own economic interest, even when a cheaper option exists for the plan.",
      "PBMs exploit this absence by routing volume to their own owned pharmacies, retaining undisclosed manufacturer payments, favoring brand drugs with high rebate revenue over cheaper generics that would cost the plan less, and blocking plan access to claims data needed to discover these practices.",
      "When the DOL or a plan participant's attorney asks 'how did you protect the plan's economic interest?', the absence of a fiduciary clause means the plan fiduciary has no contractual answer — creating personal liability for the HR Director, CFO, and any named plan administrator.",
    ],
    red_flag_language: [
      '"PBM acts as an independent contractor and not as a fiduciary of the Plan"',
      '"Nothing in this Agreement shall create a fiduciary relationship between PBM and Plan"',
      '"PBM provides services in its capacity as a vendor, not as a fiduciary"',
    ],
    dollar_mechanism: "Fiduciary misalignment allows the PBM to legally capture an estimated 3–8% of total drug spend in undisclosed revenue. For a $3M drug spend plan, this represents $90,000–$240,000 per year in value diverted from the plan to the PBM — all contractually permissible without a fiduciary clause.",
    fix_required: 'Add: "PBM acknowledges it is acting as a functional fiduciary of the Plan within the meaning of ERISA §3(21) with respect to all formulary management, network design, and pricing decisions. PBM shall at all times act in the sole interest of Plan participants and beneficiaries and shall not place its own economic interests above those of the Plan."',
  },
  2: {
    what_pbm_does: [
      "Spread pricing is the most straightforward form of PBM profit extraction. The PBM reimburses the pharmacy $4.80 for a generic metformin, then bills the plan $8.20 for the same fill — pocketing the $3.40 'spread' as undisclosed margin. Multiply this across thousands of generic fills per year, and the total hidden cost is staggering.",
      "PBMs use Maximum Allowable Cost (MAC) lists as the mechanism for spread pricing. The PBM sets MAC prices paid to pharmacies at one level and bills the plan at a higher level. The MAC list itself is proprietary and not shared with the plan, making it impossible to detect without contractual transparency rights.",
      "In 2020, CMS banned spread pricing in Medicaid managed care, citing documented overcharges averaging 9.1% of generic drug cost. Self-funded ERISA plans have no such federal protection — the only protection is contractual, through explicit pass-through pricing requirements.",
    ],
    red_flag_language: [
      '"PBM pricing is based on its MAC list, which is proprietary and subject to change"',
      '"Plan shall pay PBM the amounts set forth in the pricing schedule attached hereto"',
      '"PBM\'s ingredient cost reimbursement rates are confidential information"',
    ],
    dollar_mechanism: "For a plan with 500 members and $3M in annual drug spend, generic drugs typically represent 35–40% of spend but 88% of fill volume. At an average spread of $3–8 per generic fill and 15,000 generic fills/year, annual spread pricing cost ranges from $45,000 to $120,000. This is invisible without contractual pass-through pricing and MAC transparency requirements.",
    fix_required: 'Add: "PBM shall implement pass-through pricing for all pharmacy claims. The amount billed to the Plan for each claim shall not exceed the amount paid by PBM to the dispensing pharmacy for that claim. PBM shall provide Plan with access to the MAC list and pharmacy reimbursement rates upon request. Any retention of the difference between amounts billed to Plan and amounts paid to pharmacies constitutes a prohibited transaction under ERISA §406."',
  },
  3: {
    what_pbm_does: [
      "Manufacturer rebates are not just one pool of money — they are a complex ecosystem of payments including per-unit rebates, market share bonuses, performance bonuses, administrative fees, data fees, and 'educational grants.' PBMs negotiate all of these in their own name, collect them from manufacturers, and the contract language that determines what passes through to the plan is almost always favorable to the PBM.",
      "The most common exploitation technique is 'pooled rebate' arrangements, where the PBM averages rebates across its entire book of business rather than allocating the actual rebates earned by this plan's members. A plan with a high concentration of Humira or Ozempic users may have earned $300,000 in actual manufacturer rebates but receive only $180,000 under a pooled arrangement — with no visibility into the gap.",
      "Beyond rebates, PBMs receive manufacturer payments they categorize as 'administrative fees,' 'data license fees,' 'pharmacy services fees,' and 'clinical programs support.' These are never rebates under the contract language — so a 100% rebate pass-through clause doesn't capture them. The total undisclosed manufacturer revenue flowing to PBMs is estimated at 15–40% of brand drug list price.",
    ],
    red_flag_language: [
      '"Rebates" means the amounts received by PBM from manufacturers pursuant to formulary positioning agreements, net of PBM\'s administrative costs',
      '"PBM shall pass through a portion of manufacturer rebates consistent with PBM\'s pooled rebate methodology"',
      '"PBM retains administrative fees, data fees, and other non-rebate manufacturer payments as compensation for services"',
    ],
    dollar_mechanism: "Specialty and brand drugs average 30–50% of drug spend for a mid-size plan. Manufacturer rebates on these drugs average 18–35% of list price (WAC). A plan with $1.5M in brand/specialty drug spend generating 25% in manufacturer rebates = $375,000 in manufacturer payments. A pooled arrangement that captures only 65% of earned rebates leaves $131,250/year on the table. Non-rebate manufacturer payments add another estimated $40,000–$80,000 in unrecaptured revenue.",
    fix_required: 'Add: "PBM shall pass through 100% of all Manufacturer Revenue earned in connection with the Plan\'s claims to the Plan, not later than 90 days after the close of each calendar quarter. Manufacturer Revenue means all cash, credits, and other forms of compensation received by PBM from any pharmaceutical manufacturer in connection with Plan claims, including without limitation: (i) base rebates, (ii) market share bonuses, (iii) performance bonuses, (iv) administrative fees, (v) data license fees, (vi) educational grants, and (vii) any other amounts, regardless of how characterized by the manufacturer or PBM."',
  },
  4: {
    what_pbm_does: [
      "Your plan's claims data is one of the most commercially valuable assets you own. Every prescription filled by a plan member contains diagnosis codes, drug names, dosages, prescribers, and patient identifiers — data that pharmaceutical manufacturers, hedge funds, data brokers, and academic institutions pay significant sums to access. Without contractual restrictions, the PBM owns or controls this data and sells it commercially.",
      "PBMs typically insert language stating that de-identified data is their proprietary asset and can be used for 'PBM's business purposes.' This language permits the PBM to sell your members' drug utilization patterns to the manufacturers of the drugs they're taking — creating a deeply problematic conflict where the PBM profits from data generated by the plan's own members.",
      "Beyond commercialization, lack of data access prevents the plan from conducting independent audits, benchmarking drug costs, identifying high-risk members for care management, or switching PBMs at contract end. PBMs routinely delay, restrict, or charge for data access to create switching costs and reduce plan oversight.",
    ],
    red_flag_language: [
      '"De-identified claims data is proprietary to PBM and may be used for PBM\'s business purposes"',
      '"Plan data will be provided in PBM\'s standard format upon written request within 30 business days"',
      '"PBM shall provide plan performance reports as mutually agreed upon by the parties"',
    ],
    dollar_mechanism: "Commercial value of pharmaceutical claims data is estimated at $15–$50 per member per year for de-identified datasets, and significantly more for linked or longitudinal data. For a 500-member plan, this represents $7,500–$25,000/year in value that the PBM captures from your members' data. Beyond direct commercialization, data access restrictions cost plans an estimated $8–$25 per member in avoidable high-cost drug spend that targeted interventions would have prevented.",
    fix_required: 'Add: "All claims data, including identifiable and de-identified data, generated in connection with Plan is and remains the exclusive property of Plan. PBM shall not sell, license, share, or otherwise transfer Plan data to any third party without Plan\'s prior written consent. PBM shall provide Plan with access to all claims data in machine-readable format within 5 business days of request, at no additional charge. Upon contract termination, PBM shall deliver a complete claims history file to Plan\'s designee within 30 days."',
  },
  5: {
    what_pbm_does: [
      "Most PBM contracts contain audit rights clauses that look protective but are specifically designed to prevent meaningful recovery. Typical restrictions include: limiting audits to a 12-month lookback period (when systematic errors compound over 36+ months), prohibiting statistical extrapolation (meaning each overcharged claim must be individually documented), requiring 90+ days notice (giving the PBM time to prepare defenses), and capping recoveries at nominal amounts.",
      "The most damaging restriction is the prohibition on extrapolation. If an audit discovers that the PBM consistently overcharged by $4.20 per claim for metformin across 15,000 fills, the plan should be able to recover the overcharge across all 15,000 fills ($63,000). Without extrapolation rights, the plan can only recover the exact amount for each claim individually documented — a process so expensive and time-consuming that most overcharges go unrecovered.",
      "PBMs also insert audit scope limitations that exclude the most valuable areas for recovery: MAC list pricing, manufacturer payments, proprietary pricing schedules, and specialty drug reimbursement are commonly excluded from audit scope, precisely because these are the areas with the greatest discrepancies.",
    ],
    red_flag_language: [
      '"Audits shall be limited to a 12-month period preceding the audit request"',
      '"Statistical sampling and extrapolation methodologies are not permitted"',
      '"Plan must provide 90 days prior written notice before conducting any audit"',
      '"Audit scope shall not include PBM\'s proprietary pricing methodologies or MAC schedules"',
    ],
    dollar_mechanism: "Industry data shows that PBM audits with full extrapolation rights recover an average of $45–$180 per member per audit cycle. For a 500-member plan, a fully-scoped 36-month audit with extrapolation could recover $22,500–$90,000 in overpayments that without extrapolation would require claim-by-claim documentation costing more than the recovery. The 12-month lookback vs. 36-month lookback restriction alone eliminates two-thirds of potential recovery.",
    fix_required: 'Add: "Plan shall have the right to audit PBM\'s books, records, and systems related to Plan\'s account at any time, with 15 days prior written notice. Audits shall cover a 36-month lookback period. Plan\'s auditor may use statistical sampling with extrapolation to quantify systemic discrepancies. Any overpayments identified shall be refunded to Plan within 30 days, with interest at 8% per annum from the date of overpayment. Audit costs shall be borne by PBM if the audit reveals discrepancies exceeding $10,000."',
  },
  6: {
    what_pbm_does: [
      "The three largest PBMs — CVS Caremark, OptumRx, and Express Scripts — each own specialty pharmacy operations (CVS Specialty, OptumRx Specialty, Accredo). When a member needs a specialty drug, the PBM has a direct financial incentive to dispense through its own pharmacy rather than an independent pharmacy that may be cheaper. The PBM controls the specialty formulary, the prior authorization process, and the mandatory specialty pharmacy designations in the plan design — all of which it can use to steer volume to its own operation.",
      "The excess cost of owned-specialty vs. independent-specialty dispensing averages 8–15% per claim. But the real danger is in pricing opacity: when the PBM is both the price-setter and the dispenser, there is no market check on specialty drug cost. The PBM can set specialty prices at whatever level maximizes its margin, and the plan has no ability to compare or negotiate.",
      "Beyond pricing, owned specialty pharmacies create conflict of interest in clinical management. The PBM's specialty pharmacy has an incentive to maximize refills, minimize therapeutic alternatives, and resist biosimilar substitution — all of which increase the plan's drug spend while increasing the PBM's revenue.",
    ],
    red_flag_language: [
      '"Specialty drugs must be dispensed by PBM\'s designated specialty pharmacy or an approved specialty pharmacy network"',
      '"Members may use any specialty pharmacy in PBM\'s specialty network, subject to applicable cost-sharing"',
      '"PBM\'s specialty pharmacy is the preferred dispenser for specialty medications"',
    ],
    dollar_mechanism: "Specialty drugs represent approximately 50% of drug spend for most mid-size plans despite accounting for only 1–2% of prescription volume. For a plan with $1.5M in specialty spend, an 8–15% excess cost due to owned-pharmacy steering represents $120,000–$225,000 per year. An independent specialty pharmacy with competitive pricing and biosimilar protocols typically achieves 10–20% savings vs. PBM-owned specialty, net of any access or coordination costs.",
    fix_required: 'Add: "PBM shall not mandate or prefer its affiliated or owned specialty pharmacies over independent specialty pharmacies. Plan shall retain the right to designate any accredited specialty pharmacy as the preferred or exclusive specialty pharmacy for Plan members. PBM shall apply identical prior authorization criteria, clinical protocols, and cost-sharing structures to all accredited specialty pharmacies regardless of PBM affiliation. PBM shall provide Plan with quarterly specialty pharmacy pricing comparisons against independent market benchmarks."',
  },
  7: {
    what_pbm_does: [
      "Specialty drug carve-out means the plan can direct specialty prescription claims to a different vendor than the PBM — typically an independent specialty pharmacy, a GPO, or a direct manufacturer program. Without carve-out rights, the PBM owns all specialty volume, and the plan cannot take advantage of competitive pricing, manufacturer copay assistance programs, or direct-to-employer specialty programs that routinely save 15–30% over PBM-bundled specialty pricing.",
      "PBMs insert anti-carve-out clauses because specialty pharmacy is their fastest-growing profit center. Common anti-carve-out tactics include: (1) tying specialty carve-out to termination clauses that require 180+ days notice, (2) requiring minimum annual specialty volume commitments that make carve-out economically infeasible, (3) reducing rebate pass-through rates if specialty is carved out, effectively penalizing the plan for using the carve-out right.",
      "The practical result: even when the plan has nominal carve-out rights, the economic structure makes them impossible to exercise. This is contractual lock-in disguised as flexibility.",
    ],
    red_flag_language: [
      '"Specialty carve-out requires 180 days prior written notice and is subject to PBM approval"',
      '"Rebate pass-through rates shall be reduced by 40% if Plan elects to carve out specialty pharmacy"',
      '"Plan must maintain minimum annual specialty claim volume of $X to access specialty pricing"',
    ],
    dollar_mechanism: "Independent specialty pharmacy programs and direct manufacturer arrangements routinely save 12–28% vs. PBM-bundled specialty pricing. For a plan with $1.5M in specialty spend, this represents $180,000–$420,000 in annual savings opportunity. Even conservative access to biosimilar-first specialty programs (which PBM-owned pharmacies routinely resist) saves an additional 5–15% on applicable high-cost biologics.",
    fix_required: 'Add: "Plan retains the unconditional right to carve out specialty pharmacy dispensing to any accredited specialty pharmacy or program of Plan\'s choice, exercisable upon 30 days written notice, without penalty, reduction in rebate pass-through, or reduction in any other contracted benefit. PBM shall cooperate with any designated specialty pharmacy to ensure seamless claims processing, clinical coordination, and data sharing."',
  },
  8: {
    what_pbm_does: [
      "Without a 'lowest net cost' formulary management requirement, the PBM can legally prefer drugs on its formulary based on manufacturer payments rather than clinical efficacy or cost to the plan. The classic example: a brand drug with a high list price ($800/month) and a 40% manufacturer rebate costs the plan $480/month net. A generic equivalent with no rebate costs $28/month. The PBM has an economic incentive to keep the brand drug on formulary — even though the plan pays $452 more per fill. Without this clause, they can do this legally.",
      "Biosimilar substitution is the most glaring current example. Brand biologics (Humira, Enbrel, Stelara) have lost patent protection and biosimilar alternatives are available at 30–80% discounts. PBMs that own specialty pharmacies and receive large brand manufacturer rebates have actively resisted biosimilar substitution. Plans without 'lowest net cost' and biosimilar-first formulary requirements are paying brand prices for drugs that have cheaper, clinically equivalent alternatives today.",
      "Step therapy protocols, prior authorization criteria, and formulary tier placement are all tools the PBM can use to advantage high-rebate drugs. Without clinical integrity requirements, the PBM's formulary is a revenue-maximization tool masquerading as clinical management.",
    ],
    red_flag_language: [
      '"PBM shall maintain clinically appropriate formulary and utilization management protocols"',
      '"Formulary composition is determined by PBM\'s pharmacy and therapeutics committee in its sole discretion"',
      '"PBM shall consider clinical evidence and cost-effectiveness in formulary management decisions"',
    ],
    dollar_mechanism: "The gap between highest-rebate formulary management and lowest-net-cost formulary management averages 6–14% of total drug spend. For a $3M drug spend plan, this is $180,000–$420,000/year. Biosimilar conversion alone — switching applicable members from Humira to adalimumab biosimilars — saves $25,000–$150,000/year for plans with 5–20 Humira users, at identical clinical outcomes.",
    fix_required: 'Add: "PBM shall manage the Plan\'s formulary on a lowest net cost basis, defined as the lowest total cost to the Plan net of all manufacturer payments associated with each drug. For any drug with one or more biosimilar equivalents approved by FDA as interchangeable, PBM shall place biosimilars in the lowest cost tier and shall apply step therapy protocols favoring biosimilar initiation over brand biologic initiation, unless medically contraindicated for a specific member."',
  },
  9: {
    what_pbm_does: [
      "A termination clause determines whether your plan can actually escape a bad PBM contract. PBMs insert long notice periods (90–180 days), high termination fees, data withholding provisions, and 'cure period' requirements that make early termination practically impossible. The result: even after discovering that the PBM has been overcharging you for three years, you cannot exit quickly enough to stop the bleeding.",
      "Termination fees are often disguised as 'wind-down costs,' 'implementation fee amortization,' or 'technology migration costs.' These fees are rarely disclosed at contract signing and can run to $50,000–$250,000 for a mid-size plan — effectively making it economically impossible to switch PBMs even when switching would save far more.",
      "Data withholding is the most insidious termination tactic. Many contracts allow the PBM to delay delivering historical claims data for 30–90 days after termination. Without this data, the plan cannot onboard a new PBM efficiently, cannot conduct a retroactive audit of the exiting PBM, and cannot provide continuity of care documentation. The 'data hostage' tactic gives the PBM enormous leverage in termination disputes.",
    ],
    red_flag_language: [
      '"Either party may terminate this Agreement upon 180 days prior written notice"',
      '"Upon termination, Plan shall pay PBM\'s reasonable wind-down costs, including technology migration and implementation amortization"',
      '"PBM shall deliver historical claims data within 90 days of the effective date of termination"',
    ],
    dollar_mechanism: "A 180-day termination notice requirement vs. a 30-day requirement means a plan that discovers systematic PBM overcharging in January continues paying the PBM for 6 additional months before transitioning. If the overcharge rate is $30,000/month, the extra 5 months of notice costs $150,000. Termination fees on top of this ($50,000–$250,000) make the practical cost of switching from a bad PBM contract $200,000–$400,000 in sunk costs.",
    fix_required: 'Add: "Either party may terminate this Agreement without cause upon 30 days prior written notice, or for cause (including material breach, loss of license, or insolvency) immediately upon written notice. Upon termination: (i) no termination or wind-down fees shall be payable by Plan; (ii) PBM shall deliver complete claims data to Plan\'s designee within 5 business days; (iii) PBM shall cooperate fully with Plan\'s successor PBM. This Agreement contains no minimum volume commitments or lock-in provisions."',
  },
  10: {
    what_pbm_does: [
      "Administrative fee structures are among the most opaque elements of PBM contracts. Plans are quoted a headline PMPM rate, but the actual administrative cost is composed of many separate line items — claim processing fees, specialty fees, clinical program fees, prior authorization fees, formulary management fees, reporting fees — that are never fully itemized at contract signing. The total true administrative cost is typically 30–60% higher than the headline PMPM rate.",
      "Performance guarantees are the most commonly abused element of PBM contracts. PBMs offer guarantees that sound meaningful — 'generic dispensing rate above 85%,' '90-day refill rates above 78%' — but are structured with loopholes that prevent recovery: (1) metrics are self-reported by the PBM, (2) cure periods allow the PBM to fix performance after the plan discovers a breach, (3) total at-risk dollars are capped at 2–5% of administrative fees (a few thousand dollars), (4) measurement periods are designed to average away quarterly underperformance.",
      "The absence of benchmarking rights means the plan cannot determine whether its administrative fees are competitive. PBM administrative fees vary by 200–400% for identical service levels across different clients — and without market benchmarking rights, a plan paying $6 PMPM for services worth $2 PMPM has no contractual recourse.",
    ],
    red_flag_language: [
      '"Administrative fees are set forth in Exhibit A and are subject to annual adjustment at PBM\'s discretion"',
      '"Performance guarantees are subject to a 90-day cure period before any penalty applies"',
      '"Total performance guarantee at-risk amount shall not exceed 3% of annual administrative fees"',
    ],
    dollar_mechanism: "Administrative fee overcharges for a 500-member plan average $80,000–$180,000/year when benchmarked against market rates. Performance guarantees with 2–5% at-risk vs. 10–15% at-risk represent an accountability gap of $20,000–$40,000/year in unenforceable commitments. Fee benchmarking rights typically identify 20–35% administrative fee reduction opportunities for plans that haven't negotiated in 2+ years.",
    fix_required: 'Add: "PBM shall provide Plan with an itemized fee schedule disclosing all components of administrative compensation. Plan shall have the right to benchmark administrative fees against market rates annually and to negotiate adjustments if fees exceed the 60th percentile of market rates for comparable plans. Performance guarantees shall have no less than 10% of total annual PBM compensation at risk, measured quarterly, self-cure periods shall not exceed 30 days, and shall be based on independently verifiable data."',
  },
  11: {
    what_pbm_does: [
      "Step therapy protocols — which require members to try less expensive drugs before 'stepping up' to a more expensive brand — are clinically sound in theory. In practice, PBMs design step therapy criteria to favor drugs with the highest manufacturer rebates rather than the lowest net cost to the plan. A member needing a biologic may be required to fail on a high-rebate brand biologic before being allowed access to a lower-cost biosimilar — the reverse of what serves the plan's financial interest.",
      "Prior authorization (PA) criteria are the second major tool. PBMs set PA thresholds that create administrative friction for generic or biosimilar drugs while making high-rebate brand drugs easy to access. The PA process itself — which the PBM controls — can be used to steer prescribers and members toward the PBM's formulary preferred brands regardless of clinical equivalence.",
      "When a plan sponsor or member needs a step therapy exception — for example, a patient who has a documented contraindication to the step drug — most PBM contracts require the plan to go through the PBM's internal appeal process, which the PBM controls, has no binding timeline, and can deny for economic reasons. Without a contractual plan override right with a defined 72-hour response window, clinically urgent exceptions are held hostage to the PBM's review process.",
    ],
    red_flag_language: [
      '"Step therapy protocols are determined by PBM\'s pharmacy and therapeutics committee in its clinical discretion"',
      '"Prior authorization criteria are subject to PBM\'s proprietary clinical guidelines and are not subject to Plan modification"',
      '"Step therapy exceptions require PBM\'s written approval and are subject to a 14-business-day review period"',
    ],
    dollar_mechanism: "Evidence-based step therapy that genuinely prioritizes lowest net cost vs. highest-rebate step therapy typically produces a 6–14% difference in brand drug spend. For a plan with $1M in brand and specialty drug spend, PBM-designed step therapy protocols that favor high-rebate drugs over clinically equivalent lower-cost options cost the plan $60,000–$140,000 per year in avoidable brand drug spend. Biosimilar step therapy alone — requiring biosimilar trial before brand biologic initiation — saves $20,000–$100,000/year for plans with 5–15 members on brand biologics.",
    fix_required: 'Add: "Step therapy protocols shall be designed to achieve the lowest net cost formulary management consistent with evidence-based clinical guidelines, not to maximize manufacturer rebate revenue. Plan sponsor retains the right to override any step therapy determination within 72 hours of written notice for clinical urgency. Prior authorization criteria shall be disclosed to the Plan in writing and shall not be modified without 60 days advance notice. PBM shall not use step therapy or prior authorization protocols to advantage high-rebate brand drugs over lower-cost therapeutically equivalent alternatives."',
  },
  12: {
    what_pbm_does: [
      "Mandatory mail order programs are among the most profitable arrangements for PBM-owned dispensing operations. When the PBM mandates 90-day mail order fills for maintenance drugs (hypertension, diabetes, cholesterol), and routes those fills to its own mail pharmacy, it captures the entire dispensing margin — typically $25–$75 per 90-day fill — while simultaneously eliminating the competitive pressure that retail pharmacy creates. CVS Mail, OptumRx Home Delivery, and Express Scripts Home Delivery collectively process tens of billions of dollars in mail order volume annually.",
      "The cost differential between PBM-owned mail order pharmacies and competitive independent mail order options averages 8–18% per fill. For a plan with $800K in maintenance drug mail order volume, mandatory routing to PBM-owned mail facilities costs $64,000–$144,000/year in excess dispensing costs vs. what a competitive mail provider would charge for identical service.",
      "Specialty drug steering to PBM-owned specialty pharmacies (Accredo, CVS Specialty, OptumRx Specialty) compounds this problem in the highest-cost drug category. Specialty drugs average $3,000–$15,000 per fill. A 6–12% excess cost on even $500K of specialty volume = $30,000–$60,000/year in excess cost per plan. And because the PBM controls the specialty formulary, prior authorization, and dispensing decision simultaneously, the conflict of interest is structural and invisible without contractual neutrality requirements.",
    ],
    red_flag_language: [
      '"Members obtaining maintenance drugs shall use PBM\'s mail order pharmacy for fills of 90 days or greater"',
      '"Specialty drugs must be dispensed by PBM\'s designated specialty pharmacy or network specialty pharmacy"',
      '"Plan members may elect retail dispensing for maintenance drugs subject to an additional cost-sharing differential of 25%"',
    ],
    dollar_mechanism: "Mail order arbitrage — the excess cost of PBM-owned mail dispensing vs. competitive market rates — averages $18–$45 per 90-day fill. For a 500-member plan with 200 members on maintenance medications (at 4 fills/year each), annual excess cost from mandatory PBM-owned mail order ranges from $14,400 to $36,000. Specialty drug steering adds an additional $30,000–$120,000/year depending on specialty drug burden. Combined, mandatory mail and specialty steering cost the typical mid-size plan $45,000–$150,000 annually in excess dispensing margin captured by the PBM.",
    fix_required: 'Add: "PBM shall not mandate use of PBM-affiliated or owned mail order or specialty pharmacy for any drug category without Plan\'s express written consent. Plan members shall retain the right to fill all prescriptions at any accredited retail or mail order pharmacy in the network at identical cost-sharing, regardless of PBM affiliate status. PBM shall provide Plan with quarterly cost-comparison reports benchmarking PBM-owned dispensing costs against three independent mail order and specialty pharmacy alternatives."',
  },
  13: {
    what_pbm_does: [
      "Performance guarantee structures in PBM contracts are masterworks of apparent accountability with real-world unenforceability. The typical contract offers guarantees on generic dispensing rate (GDR), formulary compliance, claim processing accuracy, and member satisfaction — all of which sound meaningful and measurable. The exploitation is in the structure: guarantees are self-reported by the PBM using its own data systems, measurement methodology is defined by the PBM, cure periods allow the PBM to 'fix' performance after a breach is identified, and the total at-risk dollar amount is a fraction of actual PBM compensation.",
      "The most common structural problem is at-risk dollar caps. A PBM charging $2.50 PMPM administrative fee to a 500-member plan earns $15,000/year in administrative revenue. A performance guarantee with 3% at-risk = $450. When the GDR misses the target for six months, costing the plan $30,000 in avoidable brand drug spend, the maximum recovery is $450. This isn't a guarantee — it's a token obligation that creates no meaningful alignment.",
      "Measurement games compound the problem. PBMs define GDR using their own formulary claims system, which allows them to exclude specialty claims, adjust for mail order fills, and average across different member populations in ways that inflate the measured GDR above what the plan actually experiences. Without independent data verification rights and a contractually defined measurement methodology, every guarantee metric can be manipulated.",
    ],
    red_flag_language: [
      '"Total performance guarantee at-risk amount shall not exceed 2% of annual administrative fees"',
      '"Performance guarantee calculations are based on PBM\'s internal claims data and measurement methodology"',
      '"PBM shall have a 90-day cure period to remediate any performance guarantee breach before financial penalties apply"',
      '"Performance guarantees are the Plan\'s sole and exclusive remedy for PBM service failures"',
    ],
    dollar_mechanism: "For a 500-member plan on a traditional PBM model, a GDR guarantee miss of 3 percentage points (e.g., 82% actual vs. 85% guaranteed) represents approximately $27,000–$54,000 in avoidable brand drug overpayment. Claims processing accuracy misses add $5,000–$15,000/year in overpayment errors. A performance reconciliation structure with 10–15% of total PBM compensation at risk — vs. the typical 2–5% — creates $12,000–$25,000/year in additional recoverable value for the plan. Annual retroactive reconciliation vs. quarterly measurement with cure periods represents an average of $8,000–$20,000/year in deferred recovery.",
    fix_required: 'Add: "Performance guarantees shall include a minimum generic dispensing rate (GDR) of 87%, formulary compliance rate of 92%, claims processing accuracy of 99.5%, and member satisfaction score of 85 or above, each measured quarterly based on independently verifiable data. No less than 12% of total annual PBM compensation shall be at risk across all performance guarantees. No cure period shall exceed 30 days. PBM shall provide Plan with quarterly performance reconciliation with retroactive financial adjustments for any guarantee miss, without Plan request."',
  },
};

/* ─── SAVINGS CALC ───────────────────────────────────────────────────────── */

function calcSavings(provisions: ProvisionScore[]): {
  total: number;
  byProvision: { id: number; name: string; savings: number; score: number; rating: Rating; issues: Issue[]; negotiation: Negotiation; context: string; basis: string; importance: string }[];
} {
  const byProvision = provisions.map((p) => {
    const range = PROVISION_SAVINGS[p.id];
    if (!range) return { id: p.id, name: p.name, savings: 0, score: p.score, rating: p.rating, issues: p.issues, negotiation: p.negotiation, context: "", basis: "", importance: "" };
    const deficit = Math.max(0, 10 - p.score) / 10;
    const savings = Math.round(range.low + deficit * (range.high - range.low));
    return { id: p.id, name: p.name, savings, score: p.score, rating: p.rating, issues: p.issues, negotiation: p.negotiation, context: range.context, basis: range.basis, importance: range.importance };
  });
  const total = byProvision.reduce((a, b) => a + b.savings, 0);
  return { total, byProvision };
}

function fmtMoney(n: number): string {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

/* ─── PRIORITY RANKING ───────────────────────────────────────────────────── */

function prioritizeIssues(provisions: ProvisionScore[], savingsMap: Record<number, number>) {
  const all: { provision: string; provisionId: number; issue: Issue; priority: number; savingsShare: number }[] = [];
  const SEVERITY_WEIGHT: Record<Rating, number> = { red_flag: 5, concern: 3, fair: 2, good: 1, excellent: 0 };

  provisions.forEach((p) => {
    const totalProvSavings = savingsMap[p.id] || 0;
    const unfound = p.issues.filter(i => !i.found);
    const sharePerIssue = unfound.length > 0 ? totalProvSavings / unfound.length : 0;

    p.issues.forEach((issue) => {
      if (!issue.found) {
        const sWeight = SEVERITY_WEIGHT[p.rating] || 0;
        all.push({
          provision: p.name,
          provisionId: p.id,
          issue,
          priority: sWeight * (sharePerIssue / 10000 + 1),
          savingsShare: sharePerIssue,
        });
      }
    });
  });

  return all.sort((a, b) => b.priority - a.priority);
}

/* ─── REPORT BODY COMPONENTS ─────────────────────────────────────────────── */

const S = {
  page: { background: "#dde3ec", color: "#000", padding: "24px 0 40px", margin: "0", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" } as React.CSSProperties,
  section: { background: "#ffffff", borderRadius: 16, margin: "0 24px 16px", padding: "48px 56px", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)" } as React.CSSProperties,
  sectionSm: { background: "#ffffff", borderRadius: 16, margin: "0 24px 16px", padding: "32px 56px", boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05)" } as React.CSSProperties,
  h1: { fontSize: 42, fontWeight: 900, color: "#000", letterSpacing: "-0.02em", margin: 0 } as React.CSSProperties,
  h2: { fontSize: 24, fontWeight: 900, color: "#000", letterSpacing: "-0.01em", margin: "0 0 22px 0" } as React.CSSProperties,
  h3: { fontSize: 17, fontWeight: 800, color: "#000", margin: "0 0 14px 0" } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#000", display: "block", marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 1.85, color: "#000", margin: 0 } as React.CSSProperties,
  small: { fontSize: 12, color: "#000" } as React.CSSProperties,
  card: { background: "#f8f9fb", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, padding: "20px 24px" } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", gap: 12 } as React.CSSProperties,
  divider: { borderTop: "1px solid rgba(0,0,0,0.10)", margin: "28px 0" } as React.CSSProperties,
};

function SectionLabel({ children, color = "#555" }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ ...S.label, color }}>
      {children}
    </div>
  );
}

function ProvBar({ score, color }: { score: number; color: string }) {
  const pct = (score / 10) * 100;
  return (
    <div style={{ width: "100%", height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color}bb, ${color})`, borderRadius: 3, boxShadow: `0 0 6px ${color}55` }} />
    </div>
  );
}

/* ─── COVER PAGE ─────────────────────────────────────────────────────────── */

function CoverPage({ contract }: { contract: Contract }) {
  const rating = contract.rating ? RATING_CFG[contract.rating] : RATING_CFG.concern;
  const score = contract.overall_score ?? 0;
  const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const provisions = contract.provision_scores;
  const { total } = calcSavings(provisions);
  const criticals = contract.key_findings.filter(f => f.severity === "critical").length;
  const unfound = provisions.reduce((a, p) => a + p.issues.filter(i => !i.found).length, 0);
  const found = provisions.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);

  return (
    <div style={{ ...S.section, padding: 0, overflow: "hidden", borderBottom: `3px solid ${rating.border}` }}>

      {/* ── KIQ Banner ──────────────────────────────────────────── */}
      <div style={{ width: "100%", height: 80, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", padding: "0 56px" }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase" as const }}>KINCAID IQ — FIDUCIARY INTELLIGENCE PLATFORM</span>
      </div>

      {/* ── Sub-header strip ─────────────────────────────────────── */}
      <div style={{ background: "#002B5C", padding: "10px 56px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.25)" }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", color: "rgba(255,255,255,0.90)", textTransform: "uppercase" }}>
              Rx Defense IQ™ · Fiduciary-Grade PBM Intelligence
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: "0.10em", marginTop: 2 }}>
              Powered by Kincaid IQ Intelligence Platform
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: "0.10em" }}>{date}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, letterSpacing: "0.08em" }}>CONFIDENTIAL · BROKER USE ONLY</div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      <div style={{ padding: "52px 56px 56px", background: "linear-gradient(160deg, #eef1f8 0%, #f3f6fc 55%, #eef1f8 100%)", position: "relative", overflow: "hidden" }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: -80, right: -80, width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${rating.color}12 0%, transparent 65%)`, pointerEvents: "none" }} />

        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ ...S.label, color: "#9B1C2E", marginBottom: 10 }}>PBM Contract Fiduciary Analysis Report</div>
          <div style={{ fontSize: 40, fontWeight: 900, color: "#000", lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 8 }}>
            {contract.pbm_name || "Contract Analysis"}
          </div>
          <div style={{ fontSize: 13, color: "#444", letterSpacing: "0.04em" }}>
            {contract.contract_filename}
          </div>
        </div>

        {/* Score + rating */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginBottom: 44,
          padding: "28px 36px", borderRadius: 20, border: `1.5px solid ${rating.border}`, background: rating.bg,
          maxWidth: 540 }}>
          <div>
            <div style={{ fontSize: 100, fontWeight: 900, lineHeight: 1, color: rating.color, opacity: 0.95 }}>
              {Math.round(score)}
            </div>
            <div style={{ fontSize: 11, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>
              out of 100
            </div>
          </div>
          <div style={{ paddingBottom: 10 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: rating.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {rating.label}
            </div>
            <div style={{ fontSize: 12, color: "#000", marginTop: 8, lineHeight: 1.6 }}>
              CAA 2026 Fiduciary Alignment Score
            </div>
            <div style={{ fontSize: 12, color: "#000", lineHeight: 1.6 }}>
              65 Issues · 13 Provisions Evaluated
            </div>
          </div>
        </div>

        {/* Key stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, maxWidth: 720 }}>
          {[
            { label: "Estimated Annual Savings", value: fmtMoney(total), color: NEON.green },
            { label: "Critical Flags", value: String(criticals), color: NEON.red },
            { label: "Issues Not Met", value: String(unfound), color: NEON.orange },
            { label: "Protections Found", value: String(found), color: NEON.blue },
            { label: "Provisions Analyzed", value: String(provisions.length), color: NEON.purple },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...S.card, padding: "16px 18px" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#000", marginTop: 6, lineHeight: 1.4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* KIQ footer line */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.10)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>KIQ</span>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#002B5C", letterSpacing: "0.10em" }}>KINCAID IQ</div>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.06em" }}>Intelligence Platform · Rx Defense IQ™</div>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#888" }}>
            Confidential — prepared exclusively for the named plan sponsor · Not for distribution
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── TABLE OF CONTENTS ──────────────────────────────────────────────────── */

function TableOfContents({ provisions }: { provisions: ProvisionScore[] }) {
  const sections = [
    { label: "1", title: "Executive Summary", sub: "Overall assessment and key risk profile" },
    { label: "2", title: "Financial Impact Analysis", sub: "Estimated annual savings by provision" },
    { label: "3", title: "Critical Issues Ranked by Priority", sub: "All unmet requirements ordered by fiduciary risk and financial impact" },
    ...provisions.map((p, i) => ({
      label: String(4 + i), title: `Provision ${p.id}: ${p.name}`, sub: `Detailed analysis — ${p.issues.length} issues evaluated`
    })),
    { label: String(4 + provisions.length), title: "Negotiation Playbook", sub: "Model language, talking points, and remediation roadmap" },
    { label: String(5 + provisions.length), title: "Appendix A — Contract Evidence Register", sub: `All ${provisions.reduce((a,p) => a+p.issues.length, 0)} issues with verbatim contract language and AI match results` },
    { label: String(6 + provisions.length), title: "Appendix B — Score Calculation Sheet", sub: "Full issue match log, weighted scoring math, and overall score derivation" },
    { label: String(7 + provisions.length), title: "Methodology & Disclaimer", sub: "Scoring framework, CAA 2026 alignment, and legal notice" },
  ];

  return (
    <div style={S.section}>
      <SectionLabel>Table of Contents</SectionLabel>
      <div style={S.h2}>Contents</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sections.map((s, i) => (
          <button key={i}
            onClick={() => document.getElementById(`rpt-section-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 12px", margin: "0 -12px",
              borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: "transparent",
              border: "none", borderRadius: 8, textAlign: "left", transition: "background 0.15s",
              width: "calc(100% + 24px)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#000", width: 22, flexShrink: 0 }}>{s.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#000", flex: 1 }}>{s.title}</span>
            <span style={{ fontSize: 12, color: "#000", textAlign: "right", maxWidth: 300 }}>{s.sub}</span>
            <ChevronRight style={{ width: 14, height: 14, color: "#000", flexShrink: 0, marginBottom: -2 }} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── EXECUTIVE SUMMARY ──────────────────────────────────────────────────── */

function ExecutiveSummary({ contract }: { contract: Contract }) {
  const rating = contract.rating ? RATING_CFG[contract.rating] : RATING_CFG.concern;
  const score = contract.overall_score ?? 0;
  const provisions = contract.provision_scores;
  const { total } = calcSavings(provisions);
  const redFlags = provisions.filter(p => p.rating === "red_flag").length;
  const concerns = provisions.filter(p => p.rating === "concern").length;
  const criticals = contract.key_findings.filter(f => f.severity === "critical");
  const warnings = contract.key_findings.filter(f => f.severity === "warning");
  const positives = contract.key_findings.filter(f => f.severity === "positive");

  const assessmentText = score < 45
    ? `This contract presents severe fiduciary risk. With a score of ${Math.round(score)}/100, it falls in the Red Flag tier — indicating that the PBM retains significant authority to act against the economic interests of the plan and its participants. Immediate renegotiation is warranted across all major provisions.`
    : score < 60
    ? `This contract carries substantial fiduciary risk. At ${Math.round(score)}/100, it falls in the Concern tier — meaning key protections exist but critical gaps remain across multiple provisions. Targeted renegotiation focused on the highest-impact provisions should be prioritized.`
    : score < 75
    ? `This contract presents moderate fiduciary risk. At ${Math.round(score)}/100, it falls in the Fair tier — indicating a contractual framework with meaningful protections but notable gaps that represent financial exposure. Focused negotiation on the lowest-scoring provisions is recommended.`
    : `This contract demonstrates above-average fiduciary alignment at ${Math.round(score)}/100. While this places it in the Good tier, specific provisions still require attention to reach best-in-class standards under CAA 2026.`;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Section 1</SectionLabel>
      <div style={S.h2}>Executive Summary</div>

      {/* Assessment paragraph */}
      <div style={{ ...S.card, borderLeft: `3px solid ${rating.color}`, marginBottom: 28, maxWidth: 740 }}>
        <div style={{ fontSize: 15, lineHeight: 1.9, color: "#000" }}>{assessmentText}</div>
      </div>

      {/* Risk distribution */}
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Provision Risk Distribution</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
          {(["red_flag","concern","fair","good","excellent"] as Rating[]).map((r) => {
            const cfg = RATING_CFG[r];
            const count = provisions.filter(p => p.rating === r).length;
            return (
              <div key={r} style={{ ...S.card, textAlign: "center", padding: "16px 12px",
                background: count > 0 ? cfg.bg : "rgba(0,0,0,0.025)",
                border: `1px solid ${count > 0 ? cfg.border : "rgba(0,0,0,0.05)"}` }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: count > 0 ? cfg.color : "rgba(0,0,0,0.18)" }}>{count}</div>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const,
                  color: count > 0 ? cfg.color + "99" : "rgba(0,0,0,0.12)", marginTop: 6 }}>{cfg.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial headline */}
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 24, marginBottom: 28,
        background: "rgba(0,255,148,0.05)", border: `1px solid ${NEON.green}25` }}>
        <DollarSign style={{ width: 40, height: 40, color: NEON.green, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: NEON.green, lineHeight: 1 }}>{fmtMoney(total)}</div>
          <div style={{ fontSize: 12, color: "#000", marginTop: 4 }}>
            Estimated annual savings opportunity if all identified gaps are remediated through renegotiation.
            This represents the cumulative financial impact of spread pricing, unreturned rebates, audit recovery potential,
            specialty pharmacy excess cost, and administrative fee reduction.
          </div>
        </div>
      </div>

      {/* Key findings */}
      <div style={{ marginBottom: 20 }}>
        <div style={S.label}>Key Findings</div>
        {criticals.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" as const,
              color: NEON.red, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <XCircle style={{ width: 13, height: 13 }} /> Critical ({criticals.length})
            </div>
            {criticals.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", marginBottom: 6, borderRadius: 10,
                background: "rgba(255,77,109,0.06)", border: `1px solid ${NEON.red}20`,
                borderLeft: `3px solid ${NEON.red}` }}>
                <span style={{ fontSize: 13, color: "#000", lineHeight: 1.6 }}>{f.text}</span>
              </div>
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" as const,
              color: NEON.gold, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle style={{ width: 13, height: 13 }} /> Warnings ({warnings.length})
            </div>
            {warnings.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", marginBottom: 6, borderRadius: 10,
                background: "rgba(255,184,0,0.06)", border: `1px solid ${NEON.gold}20`,
                borderLeft: `3px solid ${NEON.gold}` }}>
                <span style={{ fontSize: 13, color: "#000", lineHeight: 1.6 }}>{f.text}</span>
              </div>
            ))}
          </div>
        )}
        {positives.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" as const,
              color: NEON.green, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 style={{ width: 13, height: 13 }} /> Existing Protections ({positives.length})
            </div>
            {positives.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 14px", marginBottom: 6, borderRadius: 10,
                background: "rgba(0,255,148,0.04)", border: `1px solid ${NEON.green}18`,
                borderLeft: `3px solid ${NEON.green}` }}>
                <span style={{ fontSize: 13, color: "#000", lineHeight: 1.6 }}>{f.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Urgency callout */}
      <div style={{ ...S.card, background: "rgba(191,95,255,0.06)", border: `1px solid ${NEON.purple}25`, borderLeft: `3px solid ${NEON.purple}` }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: NEON.purple, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
          Fiduciary Obligation
        </div>
        <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7 }}>
          ERISA §404(a)(1)(A) requires plan fiduciaries to act solely in the interest of plan participants and beneficiaries.
          The Consolidated Appropriations Act (CAA) of 2021, 2022, and 2026 layered specific PBM transparency and fiduciary requirements
          on top of ERISA. Failure to negotiate fiduciary protections into this contract may constitute a breach of the plan sponsor's
          own fiduciary duty under federal law. This report identifies specific gaps that should be remediated at or before the next
          contract renewal.
        </div>
      </div>
    </div>
  );
}

/* ─── FINANCIAL IMPACT ───────────────────────────────────────────────────── */

function FinancialImpact({ provisions }: { provisions: ProvisionScore[] }) {
  const { total, byProvision } = calcSavings(provisions);
  const sorted = [...byProvision].sort((a, b) => b.savings - a.savings);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.green}>Section 2</SectionLabel>
      <div style={S.h2}>Financial Impact Analysis</div>

      <div style={{ fontSize: 15, lineHeight: 1.85, color: "#000", marginBottom: 28, maxWidth: 740 }}>
        The following savings estimates represent the potential annual financial benefit to the plan if the identified contractual
        gaps in each provision are remediated through renegotiation. Estimates are derived from the provision score deficit
        (the gap between the contract's actual score and a fully-compliant score of 10/10) applied to industry-standard
        ranges for each provision type. Actual savings will vary based on plan size, drug mix, specialty spend, and negotiation outcomes.
      </div>

      {/* Total headline */}
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 24, marginBottom: 32,
        background: "rgba(0,255,148,0.06)", border: `1px solid ${NEON.green}30`, padding: "28px 32px" }}>
        <div>
          <div style={S.label}>Total Estimated Annual Savings Opportunity</div>
          <div style={{ fontSize: 56, fontWeight: 900, color: NEON.green, lineHeight: 1,
            letterSpacing: "-0.01em" }}>{fmtMoney(total)}</div>
          <div style={{ fontSize: 12, color: "#000", marginTop: 6 }}>
            Across all 13 provisions · CAA 2026 Fiduciary Standard · Annual basis
          </div>
        </div>
      </div>

      {/* Provision breakdown */}
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Savings Breakdown by Provision</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((p) => {
            const cfg = RATING_CFG[p.rating];
            const pct = (p.savings / total) * 100;
            return (
              <div key={p.id} style={{ ...S.card, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: "#000", width: 20 }}>{String(p.id).padStart(2,"0")}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#000", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: cfg.color, flexShrink: 0 }}>{cfg.label} ({p.score.toFixed(1)}/10)</span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: NEON.green, flexShrink: 0, minWidth: 80, textAlign: "right" }}>
                    {fmtMoney(p.savings)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 8, background: "rgba(0,0,0,0.04)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${NEON.green}aa, ${NEON.green})`,
                      borderRadius: 4, boxShadow: `0 0 8px ${NEON.green}44` }} />
                  </div>
                  <span style={{ fontSize: 10, color: "#000", width: 36, textAlign: "right" }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 11, color: "#000", marginTop: 8 }}>{p.basis}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ROI note */}
      <div style={{ ...S.card, background: "rgba(0,212,255,0.04)", border: `1px solid ${NEON.blue}20`, borderLeft: `3px solid ${NEON.blue}` }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: NEON.blue, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
          Return on Negotiation
        </div>
        <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7 }}>
          The cost of PBM contract renegotiation — including legal counsel, consultant fees, and actuarial review —
          typically ranges from $15,000 to $75,000 for a mid-market plan. Against a total savings opportunity of {fmtMoney(total)},
          the return on investment for a rigorous renegotiation effort is substantial. Plans that implement pass-through pricing,
          full rebate capture, and meaningful audit rights consistently outperform market averages by 8–18% on total pharmacy spend.
        </div>
      </div>
    </div>
  );
}

/* ─── CRITICAL ISSUES RANKED ─────────────────────────────────────────────── */

function CriticalIssuesRanked({ provisions }: { provisions: ProvisionScore[] }) {
  const { byProvision } = calcSavings(provisions);
  const savingsMap = Object.fromEntries(byProvision.map(p => [p.id, p.savings]));
  const ranked = prioritizeIssues(provisions, savingsMap);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.red}>Section 3</SectionLabel>
      <div style={S.h2}>Critical Issues Ranked by Priority</div>

      <div style={{ fontSize: 15, lineHeight: 1.85, color: "#000", marginBottom: 24, maxWidth: 740 }}>
        The following {ranked.length} unmet requirements are ordered by fiduciary risk and estimated financial impact.
        Items are ranked using a weighted formula incorporating provision severity rating, estimated annual savings per issue,
        and CAA 2026 compliance priority. Address items in this order for maximum fiduciary protection and financial recovery.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ranked.map((item, idx) => {
          const provData = provisions.find(p => p.id === item.provisionId);
          const cfg = provData ? RATING_CFG[provData.rating] : RATING_CFG.concern;
          return (
            <div key={idx} style={{ ...S.card, padding: "18px 22px",
              borderLeft: `3px solid ${cfg.color}`,
              background: idx < 5 ? `${cfg.color}06` : "rgba(0,0,0,0.025)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Priority number */}
                <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: idx < 5 ? cfg.bg : "rgba(0,0,0,0.03)",
                  border: `1px solid ${idx < 5 ? cfg.border : "rgba(0,0,0,0.07)"}` }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: idx < 5 ? cfg.color : "rgba(0,0,0,0.36)" }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#000" }}>{item.issue.text}</span>
                    <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, background: cfg.bg,
                      border: `1px solid ${cfg.border}`, borderRadius: 4, padding: "1px 7px",
                      letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#000", marginBottom: 6 }}>
                    Provision {item.provisionId}: {item.provision}
                  </div>
                  {item.issue.gap && (
                    <div style={{ fontSize: 13, color: "#000", lineHeight: 1.78,
                      padding: "10px 14px", background: "rgba(0,0,0,0.03)", borderRadius: 8,
                      borderLeft: `2px solid ${NEON.red}50`, marginTop: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: NEON.red, textTransform: "uppercase" as const,
                        letterSpacing: "0.12em", display: "block", marginBottom: 5 }}>Gap</span>
                      {item.issue.gap}
                    </div>
                  )}
                </div>

                {/* Savings */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: NEON.green }}>{fmtMoney(item.savingsShare)}</div>
                  <div style={{ fontSize: 9, color: "#000", textTransform: "uppercase" as const, letterSpacing: "0.1em", marginTop: 2 }}>est. annual</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── PROVISION SECTION ──────────────────────────────────────────────────── */

function ProvisionSection({ p, sectionNum }: { p: ProvisionScore; sectionNum: number }) {
  const cfg = RATING_CFG[p.rating];
  const range = PROVISION_SAVINGS[p.id];
  const deficit = Math.max(0, 10 - p.score) / 10;
  const savings = range ? Math.round(range.low + deficit * (range.high - range.low)) : 0;
  const found = p.issues.filter(i => i.found);
  const unfound = p.issues.filter(i => !i.found);
  const context = PROVISION_CONTEXT[p.id as keyof typeof PROVISION_CONTEXT] || "";

  return (
    <div style={{ ...S.section, borderLeft: `3px solid ${cfg.color}10` }}>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
        <div style={{ flex: 1 }}>
          <SectionLabel color={cfg.color}>Section {sectionNum} · Provision {p.id} of 10</SectionLabel>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#000", letterSpacing: "-0.01em", marginBottom: 6 }}>
            {p.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: cfg.color, background: cfg.bg,
              border: `1px solid ${cfg.border}`, borderRadius: 6, padding: "3px 10px",
              letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{cfg.label}</span>
            <span style={{ fontSize: 12, color: "#000" }}>
              {found.length} of {p.issues.length} requirements met
            </span>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 52, fontWeight: 900, color: cfg.color, lineHeight: 1 }}>{p.score.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: "#000", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>out of 10</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: NEON.green, marginTop: 8 }}>{fmtMoney(savings)}</div>
          <div style={{ fontSize: 9, color: "#000", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>savings opportunity</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 24 }}>
        <ProvBar score={p.score} color={cfg.color} />
      </div>

      {/* Why this matters */}
      <div style={{ ...S.card, background: "#f8fafc", borderLeft: `3px solid ${cfg.color}`, marginBottom: 24, maxWidth: 760 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" as const,
          color: cfg.color, marginBottom: 10 }}>Why This Provision Matters</div>
        <div style={{ fontSize: 15, color: "#000", lineHeight: 1.88 }}>{context}</div>
      </div>

      {/* Industry context */}
      {range && (
        <div style={{ ...S.card, marginBottom: 24, maxWidth: 760 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" as const,
            color: NEON.blue, marginBottom: 10 }}>Financial Context</div>
          <div style={{ fontSize: 15, color: "#000", lineHeight: 1.88, marginBottom: 16 }}>{range.context}</div>
          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 16 }} />
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" as const,
            color: NEON.purple, marginBottom: 10 }}>Fiduciary Significance</div>
          <div style={{ fontSize: 15, color: "#000", lineHeight: 1.88 }}>{range.importance}</div>
        </div>
      )}

      {/* Issue checklist */}
      <div style={{ marginBottom: 24 }}>
        <div style={S.label}>Issue Evaluation ({p.issues.length} Issues)</div>

        {/* Unmet issues first — DETAILED */}
        {unfound.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: NEON.red, letterSpacing: "0.12em",
              textTransform: "uppercase" as const, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <XCircle style={{ width: 12, height: 12 }} /> Not Met — {unfound.length} Protection{unfound.length > 1 ? "s" : ""} Missing
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {unfound.map((issue, i) => {
                const deep = PROVISION_DEEP_DIVE[p.id];
                return (
                  <div key={i} style={{ borderRadius: 14, border: `1px solid ${NEON.red}25`,
                    borderLeft: `4px solid ${NEON.red}`, overflow: "hidden" }}>

                    {/* Issue header */}
                    <div style={{ padding: "14px 18px 12px", background: "rgba(255,77,109,0.07)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <XCircle style={{ width: 16, height: 16, color: NEON.red, flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#000", marginBottom: 5, lineHeight: 1.4 }}>{issue.text}</div>
                        {issue.gap && (
                          <div style={{ fontSize: 13, color: "#000", lineHeight: 1.8,
                            padding: "10px 14px", background: "rgba(0,0,0,0.03)", borderRadius: 8,
                            borderLeft: `2px solid ${NEON.red}60`, marginTop: 6 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: NEON.red, textTransform: "uppercase" as const,
                              letterSpacing: "0.12em", display: "block", marginBottom: 6 }}>AI Analysis — What Was Found in This Contract</span>
                            {issue.gap}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Deep dive body */}
                    <div style={{ padding: "16px 18px 18px", background: "rgba(0,0,0,0.025)", display: "flex", flexDirection: "column", gap: 14 }}>

                      {/* How PBMs exploit this */}
                      {deep && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em",
                            textTransform: "uppercase" as const, color: NEON.orange, marginBottom: 8,
                            display: "flex", alignItems: "center", gap: 5 }}>
                            <AlertTriangle style={{ width: 11, height: 11 }} /> How PBMs Exploit This Gap
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {deep.what_pbm_does.map((pt, j) => (
                              <div key={j} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,107,26,0.18)",
                                  border: `1px solid ${NEON.orange}50`, display: "flex", alignItems: "center",
                                  justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                                  <span style={{ fontSize: 10, fontWeight: 900, color: NEON.orange }}>{j + 1}</span>
                                </div>
                                <div style={{ fontSize: 14, color: "#000", lineHeight: 1.82 }}>{pt}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dollar mechanism */}
                      {deep && (
                        <div style={{ padding: "16px 18px", borderRadius: 10,
                          background: "rgba(0,255,148,0.05)", border: `1px solid ${NEON.green}28` }}>
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
                            textTransform: "uppercase" as const, color: NEON.green, marginBottom: 8,
                            display: "flex", alignItems: "center", gap: 6 }}>
                            <DollarSign style={{ width: 12, height: 12 }} /> Dollar Impact — How This Costs Your Plan
                          </div>
                          <div style={{ fontSize: 14, color: "#000", lineHeight: 1.82 }}>{deep.dollar_mechanism}</div>
                        </div>
                      )}

                      {/* Red flag language */}
                      {deep && deep.red_flag_language.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em",
                            textTransform: "uppercase" as const, color: NEON.red, marginBottom: 8 }}>
                            🚩 Red-Flag Language to Look For in Your Contract
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {deep.red_flag_language.map((lang, j) => (
                              <div key={j} style={{ fontFamily: "monospace", fontSize: 11, color: NEON.red + "cc",
                                padding: "8px 12px", background: "rgba(255,77,109,0.06)",
                                borderRadius: 7, border: `1px solid ${NEON.red}18`, lineHeight: 1.6 }}>
                                {lang}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fix required */}
                      {deep && (
                        <div style={{ padding: "16px 20px", borderRadius: 10,
                          background: "rgba(0,212,255,0.05)", border: `1px solid ${NEON.blue}28` }}>
                          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
                            textTransform: "uppercase" as const, color: NEON.blue, marginBottom: 10,
                            display: "flex", alignItems: "center", gap: 6 }}>
                            <Shield style={{ width: 12, height: 12 }} /> Required Fix — Add This Language to the Contract
                          </div>
                          <div style={{ fontSize: 13, color: "#000",
                            lineHeight: 1.85, padding: "12px 16px", background: "rgba(0,212,255,0.05)",
                            borderRadius: 8, border: `1px solid ${NEON.blue}18`,
                            borderLeft: `3px solid ${NEON.blue}60` }}>
                            {deep.fix_required}
                          </div>
                        </div>
                      )}

                      {/* Contract quote if present */}
                      {issue.quote && (
                        <div style={{ padding: "10px 14px", borderRadius: 9,
                          background: "rgba(191,95,255,0.05)", border: `1px solid ${NEON.purple}20` }}>
                          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
                            textTransform: "uppercase" as const, color: NEON.purple, marginBottom: 5 }}>
                            Actual Contract Language Found
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#000",
                            fontStyle: "italic", lineHeight: 1.7 }}>"{issue.quote}"</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Met issues */}
        {found.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: NEON.green, letterSpacing: "0.12em",
              textTransform: "uppercase" as const, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 style={{ width: 12, height: 12 }} /> Met ({found.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {found.map((issue, i) => (
                <div key={i} style={{ padding: "14px 18px", borderRadius: 10,
                  background: "rgba(0,255,148,0.04)", border: `1px solid ${NEON.green}20`,
                  borderLeft: `3px solid ${NEON.green}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <CheckCircle2 style={{ width: 15, height: 15, color: NEON.green, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: "#000", lineHeight: 1.65 }}>{issue.text}</div>
                      {issue.quote && (
                        <div style={{ fontSize: 12, color: "#000", fontStyle: "italic",
                          marginTop: 8, padding: "8px 12px", background: "rgba(0,255,148,0.04)",
                          borderRadius: 6, borderLeft: `2px solid ${NEON.green}40`, lineHeight: 1.7 }}>
                          "{issue.quote}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Negotiation section */}
      {p.negotiation?.gap_summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Gap Summary */}
          <div style={{ ...S.card, background: "rgba(255,77,109,0.04)", border: `1px solid ${NEON.red}18` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Target style={{ width: 13, height: 13, color: NEON.red }} />
              <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: NEON.red }}>Gap Summary</span>
            </div>
            <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7 }}>{p.negotiation.gap_summary}</div>
          </div>

          {/* Model Language */}
          {p.negotiation.model_language && (
            <div style={{ ...S.card, background: "#f0fdf8", border: `1px solid ${NEON.green}40` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Lock style={{ width: 13, height: 13, color: NEON.green }} />
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: NEON.green }}>Recommended Contract Language</span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: NEON.green, lineHeight: 1.8,
                padding: "16px 18px", background: "rgba(0,255,148,0.03)", borderRadius: 8,
                border: `1px solid ${NEON.green}15` }}>
                "{p.negotiation.model_language}"
              </div>
            </div>
          )}

          {/* Talking Point */}
          {p.negotiation.talking_point && (
            <div style={{ ...S.card, background: "rgba(255,184,0,0.04)", border: `1px solid ${NEON.gold}20` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Zap style={{ width: 13, height: 13, color: NEON.gold }} />
                <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase" as const, color: NEON.gold }}>Negotiation Talking Point</span>
              </div>
              <div style={{ fontSize: 13, color: "#000", lineHeight: 1.7, fontStyle: "italic" }}>
                "{p.negotiation.talking_point}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── NEGOTIATION PLAYBOOK ───────────────────────────────────────────────── */

function NegotiationPlaybook({ provisions }: { provisions: ProvisionScore[] }) {
  const { byProvision } = calcSavings(provisions);
  const sorted = [...byProvision].sort((a, b) => b.savings - a.savings);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.gold}>Section {4 + provisions.length}</SectionLabel>
      <div style={S.h2}>Negotiation Playbook</div>

      <div style={{ fontSize: 15, lineHeight: 1.85, color: "#000", marginBottom: 28, maxWidth: 720 }}>
        The following is a consolidated negotiation roadmap, ordered by financial impact. Use this as your
        primary action document in PBM renegotiation meetings. Each item includes a talking point and the
        estimated financial value of resolution.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((p, idx) => {
          const cfg = RATING_CFG[p.rating];
          const neg = p.negotiation;
          if (!neg?.gap_summary) return null;
          return (
            <div key={p.id} style={{ ...S.card, borderLeft: `3px solid ${cfg.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: "#000", width: 24 }}>
                  #{idx + 1}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#000", flex: 1 }}>
                  Provision {p.id}: {p.name}
                </span>
                <span style={{ fontSize: 10, fontWeight: 900, color: cfg.color, background: cfg.bg,
                  border: `1px solid ${cfg.border}`, borderRadius: 4, padding: "2px 8px",
                  textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{cfg.label}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: NEON.green }}>{fmtMoney(p.savings)}</span>
              </div>
              {neg.talking_point && (
                <div style={{ fontSize: 14, color: "#000", lineHeight: 1.82,
                  padding: "12px 16px", background: "rgba(255,184,0,0.05)", borderRadius: 8,
                  border: `1px solid ${NEON.gold}25`, fontStyle: "italic", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontStyle: "normal", color: NEON.gold, marginRight: 6 }}>→</span>
                  "{neg.talking_point}"
                </div>
              )}
              <div style={{ fontSize: 13, color: "#000", lineHeight: 1.75 }}>
                <strong style={{ color: "#000" }}>Gap: </strong>{neg.gap_summary}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── APPENDIX A: CONTRACT EVIDENCE REGISTER ─────────────────────────────── */

function ContractEvidenceRegister({ provisions, sectionNum }: { provisions: ProvisionScore[]; sectionNum: number }) {
  const allIssues = provisions.flatMap(p =>
    p.issues.map(issue => ({ provision: p, issue }))
  );
  const foundCount  = allIssues.filter(x => x.issue.found).length;
  const missedCount = allIssues.filter(x => !x.issue.found).length;

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Appendix A · Section {sectionNum}</SectionLabel>
      <div style={S.h2}>Contract Evidence Register</div>
      <div style={{ fontSize: 14, color: "#000", lineHeight: 1.75, marginBottom: 24, maxWidth: 760 }}>
        Every issue evaluated during the AI contract review is listed below with its verbatim evidence —
        the exact language found in your contract (or a notation when no matching language was located).
        This register constitutes the primary audit trail for all scores in this report.
      </div>

      {/* Summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Issues Reviewed", value: allIssues.length, color: NEON.blue },
          { label: "Protections Confirmed", value: foundCount, color: NEON.green },
          { label: "Protections Missing", value: missedCount, color: NEON.red },
          { label: "Evidence Match Rate", value: `${Math.round((foundCount / allIssues.length) * 100)}%`, color: NEON.gold },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...S.card, textAlign: "center", padding: "16px" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#000", marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Per-provision evidence blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {provisions.map(p => {
          const cfg = RATING_CFG[p.rating];
          const pFound  = p.issues.filter(i => i.found).length;
          const pMissed = p.issues.filter(i => !i.found).length;
          return (
            <div key={p.id} style={{ borderRadius: 14, border: `1px solid ${cfg.color}20`, overflow: "hidden" }}>
              {/* Provision header */}
              <div style={{ padding: "14px 20px", background: `${cfg.color}08`,
                borderBottom: `1px solid ${cfg.color}18`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cfg.color}18`,
                  border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: cfg.color }}>{p.id}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#000" }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 1 }}>
                    {pFound} of {p.issues.length} requirements confirmed · Score: {p.score.toFixed(1)}/10
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {pFound > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 900, background: "rgba(5,150,105,0.10)",
                      border: "1px solid rgba(5,150,105,0.25)", color: NEON.green,
                      borderRadius: 5, padding: "3px 8px", letterSpacing: "0.08em" }}>
                      ✓ {pFound} FOUND
                    </span>
                  )}
                  {pMissed > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 900, background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(220,38,38,0.22)", color: NEON.red,
                      borderRadius: 5, padding: "3px 8px", letterSpacing: "0.08em" }}>
                      ✕ {pMissed} MISSING
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 900, padding: "4px 10px",
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: 5, color: cfg.color, letterSpacing: "0.08em" }}>
                  {cfg.label}
                </div>
              </div>

              {/* Issue rows */}
              <div style={{ background: "#fff" }}>
                {p.issues.map((issue, idx) => (
                  <div key={idx} style={{
                    padding: "16px 20px",
                    borderBottom: idx < p.issues.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none",
                    background: idx % 2 === 0 ? "#fff" : "rgba(0,0,0,0.012)",
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      {/* Issue number */}
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#bbb",
                        width: 22, flexShrink: 0, paddingTop: 2 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>

                      {/* Status badge */}
                      <div style={{ flexShrink: 0, paddingTop: 1 }}>
                        {issue.found ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 9, fontWeight: 900, color: NEON.green,
                            background: "rgba(5,150,105,0.09)", border: "1px solid rgba(5,150,105,0.25)",
                            borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em", whiteSpace: "nowrap" as const }}>
                            ✓ FOUND
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4,
                            fontSize: 9, fontWeight: 900, color: NEON.red,
                            background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.22)",
                            borderRadius: 4, padding: "2px 7px", letterSpacing: "0.1em", whiteSpace: "nowrap" as const }}>
                            ✕ MISSING
                          </span>
                        )}
                      </div>

                      {/* Issue content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#000", lineHeight: 1.55, marginBottom: issue.quote || issue.gap ? 10 : 0 }}>
                          {issue.text}
                        </div>

                        {/* Quote block */}
                        {issue.quote && (
                          <div style={{ marginBottom: issue.gap ? 8 : 0,
                            padding: "10px 14px", borderRadius: 8,
                            background: issue.found ? "rgba(5,150,105,0.05)" : "rgba(191,95,255,0.05)",
                            border: `1px solid ${issue.found ? "rgba(5,150,105,0.20)" : "rgba(191,95,255,0.20)"}`,
                            borderLeft: `3px solid ${issue.found ? NEON.green : NEON.purple}` }}>
                            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em",
                              textTransform: "uppercase" as const,
                              color: issue.found ? NEON.green : NEON.purple, marginBottom: 5 }}>
                              {issue.found ? "Contract Language Confirming This Protection" : "Actual Contract Language Found (Insufficient)"}
                            </div>
                            <div style={{ fontFamily: "Georgia, 'Times New Roman', serif",
                              fontSize: 12, color: "#222", lineHeight: 1.75, fontStyle: "italic" }}>
                              "{issue.quote}"
                            </div>
                          </div>
                        )}

                        {!issue.quote && !issue.found && (
                          <div style={{ padding: "8px 12px", borderRadius: 7,
                            background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}>
                            <span style={{ fontSize: 11, color: "#999", fontStyle: "italic" }}>
                              No matching language identified in contract text.
                            </span>
                          </div>
                        )}

                        {/* Gap note */}
                        {issue.gap && (
                          <div style={{ padding: "9px 13px", borderRadius: 7,
                            background: "rgba(255,107,26,0.05)", border: "1px solid rgba(255,107,26,0.18)",
                            borderLeft: `3px solid ${NEON.orange}` }}>
                            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.13em",
                              textTransform: "uppercase" as const, color: NEON.orange, marginBottom: 4 }}>
                              AI Analysis
                            </div>
                            <div style={{ fontSize: 12, color: "#333", lineHeight: 1.65 }}>{issue.gap}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{ marginTop: 24, padding: "14px 18px", borderRadius: 10,
        background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 11, color: "#555", lineHeight: 1.7 }}>
          <strong style={{ color: "#000" }}>Evidence Register Notes:</strong> All quotes above are extracted verbatim from the submitted contract document by AI analysis.
          "Found" means the AI identified language that satisfies the protection criterion. "Missing" means no sufficient language was located.
          This register should be reviewed by qualified ERISA counsel to confirm AI extraction accuracy before relying on it for legal or fiduciary decisions.
        </div>
      </div>
    </div>
  );
}

/* ─── APPENDIX B: SCORE CALCULATION SHEET ───────────────────────────────── */

const PROVISION_WEIGHTS: Record<number, number> = {
  1: 10, 2: 12, 3: 12, 4: 7, 5: 8,
  6: 8, 7: 8, 8: 8, 9: 7, 10: 6,
  11: 5, 12: 5, 13: 4,
};

function ScoreCalculationSheet({ provisions, contract, sectionNum }: { provisions: ProvisionScore[]; contract: Contract; sectionNum: number }) {
  const { byProvision, total } = calcSavings(provisions);
  const savingsMap = Object.fromEntries(byProvision.map(p => [p.id, p.savings]));

  const totalWeight = provisions.reduce((a, p) => a + (PROVISION_WEIGHTS[p.id] ?? 5), 0);
  const weightedSum = provisions.reduce((a, p) => {
    const w = PROVISION_WEIGHTS[p.id] ?? 5;
    return a + p.score * w;
  }, 0);
  const computedOverall = Math.round((weightedSum / totalWeight) * 10);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.blue}>Appendix B · Section {sectionNum}</SectionLabel>
      <div style={S.h2}>Score Calculation Sheet</div>
      <div style={{ fontSize: 14, color: "#000", lineHeight: 1.75, marginBottom: 24, maxWidth: 760 }}>
        A complete audit of every issue match and weighted score calculation. This sheet shows exactly
        how each provision score was derived from individual issues, and how the overall contract score
        was computed from the weighted provision scores.
      </div>

      {/* Formula box */}
      <div style={{ ...S.card, background: "rgba(37,99,235,0.04)", border: `1px solid ${NEON.blue}25`,
        borderLeft: `3px solid ${NEON.blue}`, marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" as const,
          color: NEON.blue, marginBottom: 12 }}>Scoring Formula</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#000", marginBottom: 6 }}>Provision Score (0–10)</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: NEON.blue,
              background: "rgba(37,99,235,0.06)", padding: "10px 14px", borderRadius: 8, lineHeight: 1.8 }}>
              score = (issues_found / total_issues) × 10
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#000", marginBottom: 6 }}>Overall Contract Score (0–100)</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: NEON.purple,
              background: "rgba(124,58,237,0.06)", padding: "10px 14px", borderRadius: 8, lineHeight: 1.8 }}>
              overall = Σ(provision_score × weight) / Σ(weights) × 10
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
          CAA 2026 priority weights assign higher importance to fiduciary alignment (Provision 1), spread pricing
          (Provision 2), and rebate pass-through (Provision 3) — reflecting the regulatory emphasis of the Consolidated Appropriations Act.
        </div>
      </div>

      {/* Master provision score table */}
      <div style={{ marginBottom: 28 }}>
        <div style={S.label}>Provision Score Summary</div>

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 80px 80px 60px 80px 100px",
          gap: 8, padding: "10px 16px",
          background: "#002B5C", borderRadius: "10px 10px 0 0", alignItems: "center" }}>
          {["#", "Provision", "Met", "Total", "Score", "Rating", "Weight", "Est. Savings"].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em",
              textTransform: "uppercase" as const, color: "rgba(255,255,255,0.75)" }}>{h}</div>
          ))}
        </div>

        {/* Table rows */}
        <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderTop: "none", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
          {provisions.map((p, idx) => {
            const cfg = RATING_CFG[p.rating];
            const met   = p.issues.filter(i => i.found).length;
            const total_i = p.issues.length;
            const w = PROVISION_WEIGHTS[p.id] ?? 5;
            const savings = savingsMap[p.id] ?? 0;
            return (
              <div key={p.id} style={{ display: "grid",
                gridTemplateColumns: "36px 1fr 80px 80px 80px 60px 80px 100px",
                gap: 8, padding: "11px 16px", alignItems: "center",
                background: idx % 2 === 0 ? "#fff" : "rgba(0,0,0,0.015)",
                borderBottom: idx < provisions.length - 1 ? "1px solid rgba(0,0,0,0.05)" : "none" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>{p.id}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#000", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: met === total_i ? NEON.green : NEON.orange }}>{met}</div>
                <div style={{ fontSize: 13, color: "#555" }}>{total_i}</div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 900, color: cfg.color }}>{p.score.toFixed(1)}</span>
                  <span style={{ fontSize: 10, color: "#aaa" }}>/10</span>
                </div>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 7px", borderRadius: 4,
                    background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
                    letterSpacing: "0.07em" }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>{w}%</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: savings > 0 ? NEON.green : "#aaa" }}>
                  {savings > 0 ? fmtMoney(savings) : "—"}
                </div>
              </div>
            );
          })}

          {/* Totals row */}
          <div style={{ display: "grid",
            gridTemplateColumns: "36px 1fr 80px 80px 80px 60px 80px 100px",
            gap: 8, padding: "12px 16px", alignItems: "center",
            background: "#002B5C", borderTop: "2px solid rgba(0,43,92,0.15)" }}>
            <div />
            <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.70)",
              letterSpacing: "0.10em", textTransform: "uppercase" as const }}>Overall</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.90)" }}>
              {provisions.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.90)" }}>
              {provisions.reduce((a, p) => a + p.issues.length, 0)}
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{Math.round(contract.overall_score ?? computedOverall)}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.50)" }}>/100</span>
            </div>
            <div />
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)" }}>{totalWeight}%</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#00FF94" }}>{fmtMoney(total)}</div>
          </div>
        </div>
      </div>

      {/* Issue-level match log — all 65 issues in compact ledger */}
      <div>
        <div style={S.label}>Full Issue Match Log — All {provisions.reduce((a,p) => a + p.issues.length, 0)} Issues</div>
        <div style={{ fontSize: 12, color: "#555", marginBottom: 14, lineHeight: 1.6 }}>
          Every issue evaluated in the AI analysis, showing the exact match result (✓ found / ✕ missing),
          the contribution to the provision score, and the score formula for each provision.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {provisions.map(p => {
            const cfg  = RATING_CFG[p.rating];
            const met  = p.issues.filter(i => i.found).length;
            const n    = p.issues.length;
            const computed = parseFloat(((met / n) * 10).toFixed(1));
            return (
              <div key={p.id} style={{ borderRadius: 10, overflow: "hidden",
                border: `1px solid ${cfg.color}18` }}>
                {/* Provision header row */}
                <div style={{ padding: "10px 16px", background: `${cfg.color}08`,
                  borderBottom: `1px solid ${cfg.color}15`,
                  display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: cfg.color, width: 24 }}>{p.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#000", flex: 1 }}>{p.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#555",
                    background: "rgba(0,0,0,0.04)", padding: "3px 10px", borderRadius: 6 }}>
                    ({met}/{n}) × 10 = <strong style={{ color: cfg.color }}>{computed}</strong>
                  </span>
                </div>

                {/* Issue rows — compact ledger */}
                <div style={{ background: "#fff" }}>
                  {p.issues.map((issue, idx) => (
                    <div key={idx} style={{
                      display: "grid", gridTemplateColumns: "22px 28px 1fr auto",
                      gap: 10, padding: "8px 16px", alignItems: "flex-start",
                      borderBottom: idx < p.issues.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                      background: idx % 2 === 0 ? "#fff" : "rgba(0,0,0,0.013)" }}>
                      <span style={{ fontSize: 10, color: "#ccc", fontWeight: 700, paddingTop: 1 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 900,
                        color: issue.found ? NEON.green : NEON.red,
                        background: issue.found ? "rgba(5,150,105,0.09)" : "rgba(220,38,38,0.07)",
                        border: `1px solid ${issue.found ? "rgba(5,150,105,0.22)" : "rgba(220,38,38,0.20)"}`,
                        borderRadius: 4, padding: "2px 5px",
                        display: "inline-block", textAlign: "center" as const,
                        lineHeight: 1.3, letterSpacing: "0.04em" }}>
                        {issue.found ? "✓" : "✕"}
                      </span>
                      <span style={{ fontSize: 12, color: "#222", lineHeight: 1.55 }}>{issue.text}</span>
                      <span style={{ fontSize: 11, fontWeight: 700,
                        color: issue.found ? NEON.green : "#ccc",
                        whiteSpace: "nowrap" as const }}>
                        +{issue.found ? (10 / p.issues.length).toFixed(2) : "0.00"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand total calculation */}
        <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 12,
          background: "linear-gradient(135deg, #002B5C, #003A7A)",
          border: "1px solid rgba(0,43,92,0.30)" }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" as const,
            color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>Overall Score Derivation</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "flex-end" }}>
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 2, marginBottom: 4 }}>
                {provisions.map(p => {
                  const w = PROVISION_WEIGHTS[p.id] ?? 5;
                  return `(${p.score.toFixed(1)} × ${w})`;
                }).join(" + ")}
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "8px 0" }} />
              <div style={{ fontFamily: "monospace", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                {totalWeight} (total weight) × 10 = <strong style={{ color: "#fff" }}>{computedOverall}</strong>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
                {Math.round(contract.overall_score ?? computedOverall)}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>out of 100</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── METHODOLOGY ────────────────────────────────────────────────────────── */

function Methodology({ provisions }: { provisions: ProvisionScore[] }) {
  const found = provisions.reduce((a, p) => a + p.issues.filter(i => i.found).length, 0);
  const total = provisions.reduce((a, p) => a + p.issues.length, 0);

  return (
    <div style={S.section}>
      <SectionLabel color={NEON.purple}>Section {5 + provisions.length}</SectionLabel>
      <div style={S.h2}>Methodology & Disclaimer</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        {[
          { title: "Scoring Framework", body: `Each of the 13 provisions is evaluated against 4–6 specific issues (65 total). Each issue is scored as found (1) or not found (0). The provision score (0–10) is the weighted sum of issues met. The overall score (0–100) is the weighted average of all provision scores, adjusted for CAA 2026 priority weighting. ${found} of ${total} issues were found in this contract.` },
          { title: "CAA 2026 Alignment", body: "This framework is aligned with the Consolidated Appropriations Act of 2021, 2022, and 2026, which established PBM transparency requirements, fiduciary obligations, and pass-through pricing standards for self-funded group health plans. Provisions are weighted by their relevance to the CAA's core requirements." },
          { title: "Savings Methodology", body: "Estimated savings are calculated using industry-standard ranges for each provision type, scaled by the provision score deficit (gap from a perfect score of 10). Ranges are derived from published studies, DOL enforcement actions, and actuarial analyses of PBM contract audits. Estimates assume full implementation of all recommended language." },
          { title: "AI Analysis", body: "Contract text was analyzed using an AI language model trained on PBM contract standards, ERISA fiduciary requirements, and CAA 2026 compliance frameworks. The AI extracts relevant contract language, identifies gaps against each issue criterion, and scores each provision. Results are subject to the limitations of AI document analysis." },
        ].map(({ title, body }) => (
          <div key={title} style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#000", marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 14, color: "#000", lineHeight: 1.82 }}>{body}</div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, background: "rgba(255,77,109,0.04)", border: `1px solid ${NEON.red}15`,
        borderLeft: `3px solid ${NEON.red}` }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: NEON.red, letterSpacing: "0.1em",
          textTransform: "uppercase" as const, marginBottom: 8 }}>Important Disclaimer</div>
        <div style={{ fontSize: 13, color: "#000", lineHeight: 1.82 }}>
          This report is for informational purposes only and does not constitute legal advice. Savings estimates are projections
          based on industry data and should not be relied upon as guarantees of actual savings. Plan fiduciaries should consult
          qualified ERISA counsel before making contractual decisions based on this analysis. Kincaid IQ and Kincaid RMC make no
          representation as to the legal enforceability of any model contract language provided herein. This analysis is based
          solely on the contract text submitted — oral representations, side agreements, and business practices are not evaluated.
          Scores reflect the analysis of AI systems and should be verified by qualified legal and actuarial professionals.
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid rgba(0,0,0,0.08)",
        display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: "#9B1C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>KIQ</span>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#002B5C", letterSpacing: "0.15em" }}>KINCAID IQ · RX DEFENSE IQ™</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Fiduciary-Grade PBM Contract Intelligence · CAA 2026 Aligned</div>
          </div>
        </div>
        <div style={{ fontSize: 9, color: "#888", textAlign: "right" }}>
          <div>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
          <div style={{ marginTop: 2 }}>Confidential · Broker Use Only · Not for Distribution</div>
        </div>
      </div>
    </div>
  );
}

/* ─── FULL REPORT ROOT ───────────────────────────────────────────────────── */

export default function RxDefenseFullReport({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  function handlePrint() {
    setPrinting(true);
    const onAfter = () => {
      setPrinting(false);
      window.removeEventListener("afterprint", onAfter);
    };
    window.addEventListener("afterprint", onAfter);
    setTimeout(() => window.print(), 100);
  }

  async function handleDownload() {
    toast({ title: "Generating report image…", description: "This may take a few seconds." });
    try {
      if (!reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#f0f4f8",
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: 1100,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `kincaid-rx-defense-full-report-${Date.now()}.png`;
      a.click();
      toast({ title: "Report downloaded" });
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  }

  const provisions = contract.provision_scores;

  return (
    <div id="kiq-print-overlay" style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.96)",
      display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Toolbar ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "12px 24px",
        background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.10)" }} className="print-hide">
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#000", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Rx Defense IQ™ · Full Fiduciary Report
          </div>
          <div style={{ fontSize: 11, color: "#000", marginTop: 1 }}>
            {contract.pbm_name || contract.contract_filename} · {Math.round(contract.overall_score ?? 0)}/100
          </div>
        </div>

        <button
          data-testid="rx-fullreport-email"
          onClick={() => setEmailOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.25)", color: NEON.gold,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Mail style={{ width: 14, height: 14 }} />
          Email Full Report
        </button>

        <button
          data-testid="rx-fullreport-print"
          onClick={handlePrint}
          disabled={printing}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", color: NEON.blue,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Printer style={{ width: 14, height: 14 }} />
          Print / Save PDF
        </button>

        <button
          data-testid="rx-fullreport-download"
          onClick={handleDownload}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 10,
            background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", color: NEON.green,
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          <Download style={{ width: 14, height: 14 }} />
          Download PNG
        </button>

        <button
          data-testid="rx-fullreport-close"
          onClick={onClose}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10,
            background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#000",
            fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ✕ Close
        </button>
      </div>

      {/* ── Report scroll area ── */}
      <div id="kiq-print-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div ref={reportRef} style={{ ...S.page, maxWidth: 1140, margin: "0 auto" }}>
          <div id="rpt-section-0"><CoverPage contract={contract} /></div>
          <div id="rpt-section-1"><TableOfContents provisions={provisions} /></div>
          <div id="rpt-section-2"><ExecutiveSummary contract={contract} /></div>
          <div id="rpt-section-3"><FinancialImpact provisions={provisions} /></div>
          <div id="rpt-section-4"><CriticalIssuesRanked provisions={provisions} /></div>
          {provisions.map((p, i) => (
            <div key={p.id} id={`rpt-section-${5 + i}`}>
              <ProvisionSection p={p} sectionNum={4 + i} />
            </div>
          ))}
          <div id={`rpt-section-${5 + provisions.length}`}><NegotiationPlaybook provisions={provisions} /></div>
          <div id={`rpt-section-${6 + provisions.length}`}><ContractEvidenceRegister provisions={provisions} sectionNum={6 + provisions.length} /></div>
          <div id={`rpt-section-${7 + provisions.length}`}><ScoreCalculationSheet provisions={provisions} contract={contract} sectionNum={7 + provisions.length} /></div>
          <div id={`rpt-section-${8 + provisions.length}`}><Methodology provisions={provisions} /></div>
        </div>

        {/* Back to top */}
        <div className="print-hide" style={{ display: "flex", justifyContent: "center", padding: "32px 0 48px" }}>
          <button
            onClick={() => document.getElementById("rpt-section-0")?.scrollIntoView({ behavior: "smooth" })}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 10,
              background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.10)",
              color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.06em" }}>
            ↑ Back to Top
          </button>
        </div>
      </div>

      {/* Email Modal */}
      <EmailReportModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        reportType="rx-defense"
        summaryData={{
          "PBM": contract.pbm_name ?? "PBM Contract",
          "Score": `${Math.round(contract.overall_score ?? 0)}/100`,
          "Risk": contract.rating ?? "—",
          "Provisions OK": `${contract.provision_scores.filter(p => p.rating === "good").length}/${contract.provision_scores.length}`,
          "Est. Exposure": `$${Math.round(Math.max(0, (70 - (contract.overall_score ?? 52)) * 3800)).toLocaleString()}`,
        }}
        reportData={contract}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          #kiq-print-overlay {
            position: static !important; inset: auto !important;
            height: auto !important; overflow: visible !important;
            display: flex !important; flex-direction: column !important;
            background: #f0f4f8 !important; width: 100% !important;
          }
          #kiq-print-scroll {
            overflow: visible !important; height: auto !important;
            max-height: none !important; flex: none !important;
          }
          #kiq-print-scroll > div > *:not(:first-child) {
            page-break-before: always; break-before: page;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 0.4in; size: letter portrait; }
          body::after {
            content: "KINCAID IQ — STRICTLY CONFIDENTIAL · ACCOUNT SHRACK-7742";
            position: fixed; bottom: 0.15in; left: 0; right: 0;
            text-align: center; font-size: 6pt; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase;
            color: rgba(255,184,0,0.38); pointer-events: none; z-index: 99999;
          }
        }
      `}</style>
    </div>
  );
}
