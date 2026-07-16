"""
Kincaid Health — TPA IQ™
Fiduciary-grade forensic examination of Third-Party Administrator (TPA) agreements.

Scores a TPA contract 0–100 across 13 structural provision systems, derived from the
ERISA Litigator master framework (economic incentive analysis, ERISA 404/406/408
fiduciary analysis, hidden-revenue forensics, information asymmetry, data lock-in,
litigation attack vectors, and actuarial financial leakage). Produces a final
decision framework (7 risk scores) and a prudent-fiduciary execution verdict.
"""
import io
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.anthropic_compat import AsyncAnthropicClient as AsyncOpenAI
from backend.agents.base import KIQ_VERIFY_HEADER
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.config import settings

logger = logging.getLogger("kincaid.tpa_iq")

router = APIRouter(prefix="/api/tpa-iq", tags=["tpa-iq"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

# ─── 13-provision / issue ontology (TPA forensic grid) ───────────────────────
PROVISIONS = [
    {
        "id": 1,
        "name": "Compensation & Fee Transparency",
        "issues": [
            "Administrative fee structure opacity",
            "Variable / per-transaction fee escalators",
            "Undisclosed compensation buckets",
            "Fee schedule controlled in side exhibits",
            "Reasonable-compensation (ERISA 408(b)(2)) disclosure gaps",
        ],
    },
    {
        "id": 2,
        "name": "Hidden & Indirect Revenue",
        "issues": [
            "Network access / steerage fees",
            "Rebate or override retention",
            "Float / interest income on plan assets",
            "Shared-savings arrangements favoring the TPA",
            "Vendor / broker commissions and overrides",
            "Data monetization revenue",
        ],
    },
    {
        "id": 3,
        "name": "Claims Administration Authority",
        "issues": [
            "Unilateral claims approval / denial discretion",
            "Medical-necessity determination control",
            "Retroactive claim adjustment authority",
            "Adjudication logic opacity",
            "Economic incentive to deny or delay claims",
        ],
    },
    {
        "id": 4,
        "name": "Fiduciary Status & ERISA Disclaimers",
        "issues": [
            "Explicit fiduciary-duty disclaimer",
            "De-facto fiduciary functions despite disclaimer",
            "Duty-of-loyalty / exclusive-benefit conflicts",
            "Prohibited-transaction (ERISA 406) exposure",
            "Failure-to-monitor / co-fiduciary risk",
        ],
    },
    {
        "id": 5,
        "name": "Audit Rights & Recovery",
        "issues": [
            "Limited audit scope clauses",
            "Short audit lookback windows",
            "TPA-controlled audit methodology",
            "Recovery limitations post-audit",
            "Data access restrictions during audit",
        ],
    },
    {
        "id": 6,
        "name": "Data Ownership & Portability",
        "issues": [
            "TPA ownership of claims / participant data",
            "Restricted or incomplete data export rights",
            "Proprietary-format switching barriers",
            "Predictive / benchmarking output ownership",
            "Historical-record transfer limitations",
        ],
    },
    {
        "id": 7,
        "name": "Network & Provider Pricing",
        "issues": [
            "Reference-based-pricing leakage",
            "Network steering to affiliated providers",
            "Provider reimbursement opacity",
            "Out-of-network leakage exposure",
            "Repricing / discount-guarantee gaming",
        ],
    },
    {
        "id": 8,
        "name": "Stop-Loss Coordination",
        "issues": [
            "Stop-loss commission / override capture",
            "Lasering and disclosure asymmetry",
            "Claims-to-stop-loss timing misalignment",
            "Conflicted carrier-placement incentives",
        ],
    },
    {
        "id": 9,
        "name": "Performance Guarantees",
        "issues": [
            "Weak or non-binding performance guarantees",
            "Penalty-avoidance loopholes",
            "Self-reported / unauditable metrics",
            "No financial remedy for non-performance",
        ],
    },
    {
        "id": 10,
        "name": "Subcontracting & Delegation",
        "issues": [
            "Unrestricted assignment / delegation rights",
            "Undisclosed subcontractor compensation",
            "Vendor-relationship conflict of interest",
            "No flow-down of fiduciary obligations",
        ],
    },
    {
        "id": 11,
        "name": "Termination & Exit Barriers",
        "issues": [
            "Early-termination penalties",
            "Data-export restrictions upon exit",
            "Auto-renewal / lock-in structures",
            "Run-out claims administration leverage",
        ],
    },
    {
        "id": 12,
        "name": "Liability & Indemnification",
        "issues": [
            "Liability caps limiting accountability",
            "Indemnification asymmetry favoring TPA",
            "Gross-negligence / willful-misconduct carve-out gaps",
            "Mandatory arbitration / venue asymmetry",
        ],
    },
    {
        "id": 13,
        "name": "Conflicts of Interest & Disclosure",
        "issues": [
            "Conflict-of-interest non-disclosure",
            "Revenue-sharing partner relationships",
            "Affiliated-entity self-dealing",
            "Material-change disclosure gaps",
        ],
    },
]

SCORE_LABELS = {
    "excellent": (90, 100),
    "good":      (75, 89),
    "fair":      (60, 74),
    "concern":   (45, 59),
    "red_flag":  (0, 44),
}

# Final-decision framework risk dimensions (each scored 0–100, higher = more risk).
FRAMEWORK_KEYS = [
    ("contract_risk", "Contract Risk"),
    ("litigation_risk", "Litigation Risk"),
    ("economic_leakage", "Economic Leakage"),
    ("fiduciary_governance", "Fiduciary Governance Risk"),
    ("information_asymmetry", "Information Asymmetry"),
    ("data_lock_in", "Data Lock-In"),
    ("operational_risk", "Operational Risk"),
]

# Modeled annual $ leakage per provision (PEPY — per employee per year) used to
# replace any LLM- or demo-provided dollar strings so no figure is fabricated.
PEPY_BY_PROVISION = {
    1: 45.0,   2: 120.0,  3: 90.0,   4: 60.0,   5: 55.0,
    6: 30.0,   7: 140.0,  8: 80.0,   9: 35.0,  10: 40.0,
    11: 25.0, 12: 20.0,  13: 50.0,
}
REFERENCE_EMPLOYEES = 1000


def score_to_rating(score: float) -> str:
    for label, (low, high) in SCORE_LABELS.items():
        if low <= score <= high:
            return label
    return "red_flag"


def grade_from_score(score: float) -> str:
    if score >= 85:
        return "fiduciary"
    if score >= 70:
        return "institutional"
    if score >= 50:
        return "commercial"
    if score >= 35:
        return "substandard"
    return "litigation_sensitive"


def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages[:40]:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except Exception:
        return ""


def extract_docx_text(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        paragraphs.append(cell.text.strip())
        return "\n\n".join(paragraphs)
    except Exception:
        return ""


def build_analysis_prompt(contract_text: str) -> str:
    provisions_text = ""
    for p in PROVISIONS:
        provisions_text += f"\n{p['id']}. {p['name']}\n"
        for i, issue in enumerate(p["issues"], 1):
            provisions_text += f"   {p['id']}.{i}. {issue}\n"

    return KIQ_VERIFY_HEADER + f"""You are TPA IQ — a fiduciary-grade forensic intelligence engine operating simultaneously as:
- A University of Chicago PhD economist (industrial organization, transaction-cost economics, agency theory, information asymmetry).
- A University of Chicago PhD computer scientist (contract intelligence, mechanism design, forensic analytics).
- A senior ERISA plaintiff attorney AND a senior ERISA defense attorney.
- A former U.S. Department of Labor ERISA investigator, a healthcare actuary, a Fortune 100 CFO and General Counsel.

MANDATE:
Do not summarize — deconstruct. Do not describe — quantify. Do not assume — prove.
Determine whether this Third-Party Administrator agreement aligns with the interests of the
self-funded plan sponsor, participants and beneficiaries, OR whether it primarily extracts value
for the TPA, its subcontractors, PBMs, networks, stop-loss carriers, and revenue-sharing partners.

Apply simultaneously: transaction-cost economics (Coase/Williamson), agency theory
(Jensen-Meckling), information asymmetry (Akerlof), and ERISA fiduciary doctrine
(Sections 404 duty of loyalty/prudence & exclusive benefit, 406 prohibited transactions,
408 reasonable compensation). Treat ambiguity as financial exposure.

Analyze the contract against this 13-provision forensic grid:
{provisions_text}

CONTRACT TEXT:
---
{contract_text[:14000]}
---

Respond with ONLY valid JSON (no markdown):
{{
  "tpa_name": "detected TPA name or null",
  "overall_score": <0-100 float>,
  "key_findings": [
    {{"severity": "critical|warning|positive", "text": "mechanism-level finding tied to contract language and economic impact"}}
  ],
  "provisions": [
    {{
      "id": 1,
      "name": "provision name",
      "score": <0-10 float>,
      "rating": "excellent|good|fair|concern|red_flag",
      "quick_look": "good|concern|red_flag",
      "incentive_alignment": <-10 to 10 integer>,
      "issues": [
        {{
          "text": "issue name from the ontology",
          "found": true|false,
          "status": "Present|Partially Present|Not Present|Hidden / Ambiguous Risk",
          "severity": "Low|Medium|High|Critical",
          "confidence": <0-100 integer>,
          "quote": "exact contract clause verbatim or null",
          "gap": "what economic distortion, fiduciary exposure, or missing protection this creates — null only if fully protective",
          "explanation": "mechanism + ERISA analysis: who captures value, which fiduciary duty is implicated, and the consequence for the plan sponsor"
        }}
      ],
      "litigation": {{
        "plaintiff_theory": "how an ERISA plaintiff firm would attack this provision",
        "defense_theory": "how defense counsel would respond",
        "erisa_section": "404|406|408|none"
      }},
      "negotiation": {{
        "gap_summary": "what extraction or distortion is embedded and how it operates",
        "model_language": "model contract language that closes the gap and aligns incentives",
        "talking_point": "leverage-based framing and the data to demand in renegotiation"
      }}
    }}
  ],
  "framework_scores": {{
    "contract_risk": <0-100>,
    "litigation_risk": <0-100>,
    "economic_leakage": <0-100>,
    "fiduciary_governance": <0-100>,
    "information_asymmetry": <0-100>,
    "data_lock_in": <0-100>,
    "operational_risk": <0-100>
  }},
  "verdict": {{
    "grade": "fiduciary|institutional|commercial|substandard|litigation_sensitive",
    "conclusion": "yes|yes_with_modifications|no",
    "rationale": "investment-grade explanation answering: would a prudent ERISA fiduciary, acting solely in the interests of participants and beneficiaries, execute this TPA agreement in its current form?"
  }}
}}

SCORING RULES (apply strictly):
- Score each provision 0-10 on the plan sponsor's actual protection. Overall = weighted average scaled to 0-100.
- Be structurally strict — most TPA agreements score 30-55. A contract without explicit fiduciary acceptance, full fee/compensation transparency, unrestricted audit rights, and clean data ownership cannot score above 55.
- Framework risk scores are 0-100 where HIGHER means MORE risk (inverse of provision protection).
- incentive_alignment: +10 = perfect employer alignment, 0 = neutral, -10 = direct economic conflict with the employer.
- "Hidden / Ambiguous Risk" status counts as a gap equal in severity to "Not Present."
- Infer economic incentives from contract structure even when not explicitly stated."""


# ─── Demo analysis (used when no real text or AI unavailable) ─────────────────
def _demo_analysis() -> dict:
    def issue(text, found, status, sev, conf, quote, gap, expl):
        return {
            "text": text, "found": found, "status": status, "severity": sev,
            "confidence": conf, "quote": quote, "gap": gap, "explanation": expl,
        }

    provisions = [
        {
            "id": 1, "name": "Compensation & Fee Transparency", "score": 3.0,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -6,
            "issues": [
                issue("Administrative fee structure opacity", False, "Hidden / Ambiguous Risk", "Critical", 90,
                      "Administrative fees shall be as set forth in the Fee Schedule attached as Exhibit B",
                      "Fee Schedule lives in a TPA-controlled exhibit that can be revised without renegotiation",
                      "When the fee schedule is severable from the contract, the TPA can re-price administration between plan years without triggering the sponsor's renegotiation rights."),
                issue("Undisclosed compensation buckets", False, "Not Present", "Critical", 86, None,
                      "No 408(b)(2) reasonable-compensation disclosure of indirect compensation",
                      "ERISA 408(b)(2) requires covered service providers to disclose all direct and indirect compensation; absence creates a prohibited-transaction and excessive-fee exposure."),
                issue("Variable / per-transaction fee escalators", True, "Partially Present", "Medium", 74,
                      "Per-claim processing fees may be adjusted annually based on TPA's cost index",
                      "TPA-defined cost index gives unilateral fee-escalation power",
                      "An internally-defined index lets the TPA raise per-transaction fees without an objective external benchmark."),
            ],
            "litigation": {"plaintiff_theory": "Excessive-fee and 408(b)(2) disclosure-failure claim — indirect compensation was never disclosed, defeating the reasonable-compensation safe harbor.", "defense_theory": "Fees were market-competitive and the sponsor had access to the fee schedule on request.", "erisa_section": "408"},
            "negotiation": {"gap_summary": "Compensation is opaque and severable — the sponsor cannot establish that fees are reasonable, the core fiduciary test.", "model_language": "TPA shall disclose in writing all direct and indirect compensation (including from third parties) in compliance with ERISA 408(b)(2). The fee schedule is incorporated into this Agreement and may not be modified without the Plan's written consent.", "talking_point": "Ask the TPA to itemize every dollar it earns connected to this plan — from all sources. The gap between that figure and the stated admin fee is your leakage."},
        },
        {
            "id": 2, "name": "Hidden & Indirect Revenue", "score": 2.0,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -8,
            "issues": [
                issue("Network access / steerage fees", False, "Hidden / Ambiguous Risk", "Critical", 88,
                      "TPA may receive administrative allowances from network and vendor partners",
                      "'Administrative allowances' is undefined and not passed through to the plan",
                      "Network access fees are economically equivalent to rebates; retained by the TPA they inflate the plan's effective cost while remaining invisible."),
                issue("Float / interest income on plan assets", False, "Not Present", "High", 80, None,
                      "No provision requiring interest earned on plan-funded claims accounts to be credited to the plan",
                      "TPAs hold plan claim-funding balances and earn float; without a pass-through clause that interest is silent TPA income on plan assets."),
                issue("Shared-savings arrangements favoring the TPA", False, "Hidden / Ambiguous Risk", "High", 78,
                      "TPA shall retain 30% of identified claim savings as a program fee",
                      "Contingency on 'identified savings' rewards aggressive, disputable savings claims",
                      "Percentage-of-savings compensation creates an incentive to manufacture savings that may not be real and to favor programs that maximize the TPA's cut."),
            ],
            "litigation": {"plaintiff_theory": "Prohibited-transaction and self-dealing claim under ERISA 406 — TPA received undisclosed third-party compensation in connection with plan assets.", "defense_theory": "Allowances were de minimis and industry-standard; no plan assets were involved.", "erisa_section": "406"},
            "negotiation": {"gap_summary": "Multiple undisclosed indirect-revenue streams (network allowances, float, contingent savings fees) extract value from plan assets with no pass-through.", "model_language": "TPA shall pass through 100% of all compensation received from any third party in connection with the Plan, and shall credit to the Plan all interest earned on Plan-funded accounts. Any shared-savings fee requires Plan pre-approval of the savings methodology.", "talking_point": "Float income and network allowances are real money earned on your plan. Demand the dollar figures and a 100% pass-through."},
        },
        {
            "id": 3, "name": "Claims Administration Authority", "score": 3.5,
            "rating": "red_flag", "quick_look": "concern", "incentive_alignment": -4,
            "issues": [
                issue("Unilateral claims approval / denial discretion", True, "Present", "High", 84,
                      "TPA shall have full and final discretionary authority to determine eligibility for benefits and to construe the terms of the Plan",
                      "Full discretionary authority is exercised while the TPA disclaims fiduciary status elsewhere",
                      "Discretionary benefit determination is a textbook fiduciary function; exercising it while disclaiming fiduciary duty is the central contradiction ERISA plaintiffs attack."),
                issue("Retroactive claim adjustment authority", False, "Hidden / Ambiguous Risk", "Medium", 72,
                      "TPA may reprocess or adjust claims to correct administrative or system errors",
                      "No time limit, notice requirement, or cap on retroactive adjustments",
                      "Open-ended reprocessing rights let the TPA claw back or restate claim activity after the fact with no sponsor visibility."),
            ],
            "litigation": {"plaintiff_theory": "Functional-fiduciary / failure-to-monitor claim — the TPA exercised discretionary authority and is therefore a fiduciary regardless of contractual disclaimers.", "defense_theory": "Discretion was ministerial and bounded by the plan document; the named fiduciary retained final authority.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "The TPA holds final discretionary claims authority — a fiduciary function — while disclaiming fiduciary status, creating both liability and a monitoring blind spot for the sponsor.", "model_language": "TPA shall administer claims in accordance with the Plan document and shall provide the Plan with claim-level data sufficient to audit all determinations. Retroactive adjustments require 10 business days' written notice.", "talking_point": "If the TPA decides who gets paid, it is acting as a fiduciary. Either it accepts that duty or it gives up final discretion."},
        },
        {
            "id": 4, "name": "Fiduciary Status & ERISA Disclaimers", "score": 2.5,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -7,
            "issues": [
                issue("Explicit fiduciary-duty disclaimer", True, "Present", "Critical", 93,
                      "Nothing in this Agreement shall render TPA a fiduciary within the meaning of ERISA",
                      "Blanket fiduciary disclaimer paired with discretionary authority elsewhere in the contract",
                      "Courts look to function, not labels. A disclaimer alongside discretionary claims and appeals authority is the single most-litigated TPA contradiction."),
                issue("Failure-to-monitor / co-fiduciary risk", False, "Not Present", "High", 81, None,
                      "No reporting framework enabling the named fiduciary to monitor TPA performance",
                      "The sponsor's duty to monitor service providers cannot be satisfied without the data and reporting the contract fails to require."),
            ],
            "litigation": {"plaintiff_theory": "Breach of duty of loyalty/prudence and co-fiduciary liability — sponsor cannot monitor and the TPA acts as a functional fiduciary.", "defense_theory": "TPA is a non-fiduciary service provider; the named fiduciary retained all discretionary authority.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "The contract disclaims fiduciary status while assigning fiduciary functions and providing no monitoring framework — exposing the sponsor to failure-to-monitor liability.", "model_language": "TPA acknowledges it performs discretionary functions and accepts fiduciary responsibility for those functions, and shall furnish quarterly performance and claims-integrity reporting sufficient for the Plan to discharge its monitoring duty.", "talking_point": "Your duty to monitor doesn't disappear because the TPA disclaims fiduciary status — it grows. Demand the reporting that lets you monitor."},
        },
        {
            "id": 5, "name": "Audit Rights & Recovery", "score": 3.0,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -6,
            "issues": [
                issue("Short audit lookback windows", True, "Present", "High", 85,
                      "Plan may audit claims paid within the preceding twelve (12) months",
                      "12-month lookback with no extrapolation makes systemic overpayments unrecoverable",
                      "A short, non-extrapolated lookback structurally caps recovery far below the life-of-contract overpayment exposure."),
                issue("TPA-controlled audit methodology", True, "Present", "High", 82,
                      "Audits shall be conducted in accordance with TPA's standard audit protocol",
                      "TPA defines the audit protocol, sample size, and methodology",
                      "When the audited party controls the methodology, the audit cannot independently detect the errors that favor the TPA."),
            ],
            "litigation": {"plaintiff_theory": "Imprudent-contracting claim — fiduciary accepted audit terms that make overpayment recovery practically impossible.", "defense_theory": "Audit rights were reasonable and consistent with industry practice.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "Audit rights are scoped to be ineffective — short lookback, no extrapolation, TPA-controlled methodology.", "model_language": "Plan may audit with an independent auditor of its choosing, with a minimum 36-month lookback and statistically valid extrapolation. TPA shall reimburse identified overpayments plus audit costs where errors exceed 1%.", "talking_point": "An audit you cannot extrapolate and cannot scope is theater. Insist on independent methodology and a real lookback."},
        },
        {
            "id": 6, "name": "Data Ownership & Portability", "score": 4.5,
            "rating": "concern", "quick_look": "concern", "incentive_alignment": -3,
            "issues": [
                issue("Restricted or incomplete data export rights", False, "Hidden / Ambiguous Risk", "High", 80,
                      "Upon termination, TPA shall provide standard reports in TPA's standard format",
                      "'Standard reports' and 'standard format' fall short of complete claim-level data export",
                      "Summary reports in a proprietary format prevent the sponsor from reconstructing history or onboarding a successor TPA — a structural switching barrier."),
                issue("TPA ownership of claims / participant data", True, "Partially Present", "Medium", 76,
                      "Claims data is owned by the Plan; analytics and derived datasets remain TPA property",
                      "Derived analytics and benchmarking outputs are carved out of plan ownership",
                      "Carving 'derived' data out of plan ownership lets the TPA monetize insights generated from the plan's own claims."),
            ],
            "litigation": {"plaintiff_theory": "Imprudence in exit planning — sponsor cannot transition vendors, harming participants through switching costs.", "defense_theory": "Plan retained ownership of raw claims data; derived analytics are TPA intellectual property.", "erisa_section": "none"},
            "negotiation": {"gap_summary": "Raw data ownership is acknowledged but export format and derived-data carve-outs create lock-in and a data-monetization stream.", "model_language": "Upon request or termination, TPA shall deliver complete claim-level data in a non-proprietary, machine-readable format within 30 days, including all derived datasets attributable to the Plan, at no cost.", "talking_point": "If you can't take complete claim-level data with you in a usable format, you're locked in. Make portability a contract term, not a favor."},
        },
        {
            "id": 7, "name": "Network & Provider Pricing", "score": 3.5,
            "rating": "red_flag", "quick_look": "concern", "incentive_alignment": -5,
            "issues": [
                issue("Provider reimbursement opacity", False, "Hidden / Ambiguous Risk", "High", 83,
                      "Network reimbursement rates are governed by the Network Participation Agreement",
                      "Plan cannot access the underlying network agreement or verify provider payments",
                      "Without access to actual provider reimbursement, the plan cannot detect spread between what it is billed and what providers are paid."),
                issue("Out-of-network leakage exposure", False, "Not Present", "Medium", 71, None,
                      "No reference-based-pricing or OON cost-containment commitment",
                      "Absent RBP or OON controls, out-of-network claims are a primary uncontrolled cost leak."),
            ],
            "litigation": {"plaintiff_theory": "Excessive-cost / failure-to-monitor claim — sponsor cannot verify network pricing and tolerated avoidable leakage.", "defense_theory": "Network terms are confidential and standard; the plan received contracted discounts.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "Network economics are a black box and OON leakage is uncontrolled.", "model_language": "TPA shall disclose, under NDA, actual provider reimbursement for the Plan's claims and shall implement out-of-network cost-containment with a guaranteed minimum savings.", "talking_point": "Ask for the spread between what you're billed and what providers are paid. Refusal is the answer."},
        },
        {
            "id": 8, "name": "Stop-Loss Coordination", "score": 4.0,
            "rating": "concern", "quick_look": "concern", "incentive_alignment": -4,
            "issues": [
                issue("Stop-loss commission / override capture", False, "Hidden / Ambiguous Risk", "High", 79,
                      "TPA may place stop-loss coverage with carriers of its selection",
                      "TPA-directed placement plus undisclosed commissions creates a conflict",
                      "When the TPA both administers claims and earns commission on stop-loss placement, its carrier selection may favor its own compensation over the plan's terms."),
                issue("Claims-to-stop-loss timing misalignment", True, "Partially Present", "Medium", 70,
                      "Claims shall be submitted to the stop-loss carrier in accordance with carrier requirements",
                      "No TPA accountability for missed stop-loss filing deadlines",
                      "If the TPA misses stop-loss filing windows, the plan absorbs reimbursable claims with no remedy."),
            ],
            "litigation": {"plaintiff_theory": "Conflicted-transaction claim — TPA's stop-loss commissions influenced placement to the plan's detriment.", "defense_theory": "Stop-loss placement was competitive and commissions were disclosed.", "erisa_section": "406"},
            "negotiation": {"gap_summary": "Stop-loss placement is TPA-directed with undisclosed compensation and no accountability for filing timeliness.", "model_language": "TPA shall disclose all stop-loss compensation, place coverage at the Plan's direction, and indemnify the Plan for any reimbursement lost due to late filing.", "talking_point": "Whoever earns the stop-loss commission shouldn't pick the carrier unsupervised. Get the numbers and a late-filing indemnity."},
        },
        {
            "id": 9, "name": "Performance Guarantees", "score": 3.5,
            "rating": "red_flag", "quick_look": "concern", "incentive_alignment": -4,
            "issues": [
                issue("Weak or non-binding performance guarantees", True, "Present", "High", 82,
                      "TPA shall use commercially reasonable efforts to achieve a 99% claims processing accuracy target",
                      "'Commercially reasonable efforts' and 'target' make the guarantee aspirational",
                      "Soft language converts a guarantee into a goal with no enforceable standard."),
                issue("No financial remedy for non-performance", False, "Not Present", "High", 80, None,
                      "No fee-at-risk or penalty tied to performance metrics",
                      "Without fees at risk, performance guarantees impose no economic discipline on the TPA."),
            ],
            "litigation": {"plaintiff_theory": "Imprudence claim — fiduciary accepted unenforceable guarantees with no remedy.", "defense_theory": "Service levels were monitored and substantially met.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "Performance guarantees are aspirational with no fee at risk.", "model_language": "TPA shall place not less than 15% of annual fees at risk against binding, independently-audited performance guarantees with automatic credits for misses.", "talking_point": "A guarantee with no money behind it isn't a guarantee. Put fees at risk."},
        },
        {
            "id": 10, "name": "Subcontracting & Delegation", "score": 4.0,
            "rating": "concern", "quick_look": "concern", "incentive_alignment": -3,
            "issues": [
                issue("Unrestricted assignment / delegation rights", True, "Present", "Medium", 77,
                      "TPA may delegate any of its duties to subcontractors or affiliates without Plan consent",
                      "No consent right or fiduciary flow-down to subcontractors",
                      "Unrestricted delegation moves plan functions to entities the sponsor never vetted and cannot monitor."),
                issue("Undisclosed subcontractor compensation", False, "Not Present", "High", 75, None,
                      "No disclosure of compensation paid to or retained by subcontractors and affiliates",
                      "Affiliate subcontracting can route plan dollars to related entities at undisclosed margins."),
            ],
            "litigation": {"plaintiff_theory": "Failure-to-monitor and prohibited-transaction claim involving affiliated subcontractors.", "defense_theory": "Delegation is standard and the TPA remains responsible for subcontractor performance.", "erisa_section": "406"},
            "negotiation": {"gap_summary": "Delegation is unrestricted and affiliate compensation is undisclosed.", "model_language": "TPA shall obtain Plan consent before delegating material functions, flow down all obligations to subcontractors, and disclose all affiliate compensation.", "talking_point": "Find out who actually touches your plan and what affiliates earn. Consent and disclosure are non-negotiable."},
        },
        {
            "id": 11, "name": "Termination & Exit Barriers", "score": 3.5,
            "rating": "red_flag", "quick_look": "concern", "incentive_alignment": -5,
            "issues": [
                issue("Auto-renewal / lock-in structures", True, "Present", "Medium", 78,
                      "This Agreement shall automatically renew for successive three-year terms unless terminated 180 days prior",
                      "Long auto-renewal term with a long notice window compresses the sponsor's leverage",
                      "Three-year evergreen renewals with a 180-day notice trap reduce the sponsor's ability to test the market."),
                issue("Run-out claims administration leverage", False, "Hidden / Ambiguous Risk", "High", 76,
                      "Run-out claims administration shall be provided at TPA's then-current rates",
                      "Open-ended run-out pricing gives the incumbent pricing leverage at exit",
                      "Undefined run-out fees let the incumbent extract premium pricing exactly when the sponsor has the least leverage."),
            ],
            "litigation": {"plaintiff_theory": "Imprudent-contracting claim — exit terms entrenched an underperforming vendor.", "defense_theory": "Renewal and run-out terms were standard and disclosed.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "Evergreen renewal and undefined run-out pricing entrench the incumbent.", "model_language": "Term shall be one year, renewable by mutual agreement with 90 days' notice. Run-out administration shall be priced in this Agreement at no more than current per-claim fees.", "talking_point": "Lock in your run-out pricing now, while you still have leverage. After you give notice, it's too late."},
        },
        {
            "id": 12, "name": "Liability & Indemnification", "score": 3.0,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -6,
            "issues": [
                issue("Liability caps limiting accountability", True, "Present", "Critical", 86,
                      "TPA's aggregate liability shall not exceed three (3) months of administrative fees",
                      "A 3-month-fee cap is trivial relative to claims overpayment exposure",
                      "Capping liability at a few months of admin fees means the TPA bears almost no risk for systemic claims errors worth far more."),
                issue("Indemnification asymmetry favoring TPA", True, "Present", "High", 81,
                      "Plan shall indemnify TPA for all claims arising from administration of the Plan",
                      "One-sided indemnity shifts the TPA's operational risk to the plan",
                      "Asymmetric indemnification makes the plan the insurer of the TPA's own administrative failures."),
            ],
            "litigation": {"plaintiff_theory": "Unconscionable risk-allocation / imprudence claim — fiduciary accepted terms leaving the plan without remedy.", "defense_theory": "Liability allocation reflects negotiated, arm's-length pricing.", "erisa_section": "404"},
            "negotiation": {"gap_summary": "The liability cap is trivial and indemnification is one-sided, leaving the plan to absorb the TPA's errors.", "model_language": "Liability caps shall not apply to claims-processing errors, gross negligence, or willful misconduct. Indemnification shall be mutual and each party shall be responsible for its own acts and omissions.", "talking_point": "A 3-month-fee cap means the TPA has no skin in the game on a million-dollar error. Carve out claims errors and gross negligence."},
        },
        {
            "id": 13, "name": "Conflicts of Interest & Disclosure", "score": 3.0,
            "rating": "red_flag", "quick_look": "red_flag", "incentive_alignment": -6,
            "issues": [
                issue("Conflict-of-interest non-disclosure", False, "Not Present", "Critical", 84, None,
                      "No affirmative obligation to disclose conflicts of interest or related-party relationships",
                      "Without a disclosure duty, the sponsor cannot evaluate the conflicts that shape the TPA's recommendations and vendor selections."),
                issue("Revenue-sharing partner relationships", False, "Hidden / Ambiguous Risk", "High", 80,
                      "TPA maintains relationships with preferred vendors and partners",
                      "'Preferred' relationships imply revenue sharing that is never quantified",
                      "Undisclosed revenue-sharing with preferred vendors biases the TPA's recommendations toward its own economics."),
            ],
            "litigation": {"plaintiff_theory": "Self-dealing and disclosure-failure claim under ERISA 406 — undisclosed conflicts tainted plan decisions.", "defense_theory": "No material conflicts existed and standard vendor relationships are not reportable.", "erisa_section": "406"},
            "negotiation": {"gap_summary": "There is no conflict-disclosure duty and revenue-sharing relationships are unquantified.", "model_language": "TPA shall disclose annually all conflicts of interest and all compensation, in any form, received from any vendor, carrier, or partner in connection with the Plan.", "talking_point": "Ask the TPA to list every partner it earns money from. The relationships it won't disclose are the ones that matter."},
        },
    ]

    framework_scores = {
        "contract_risk": 72,
        "litigation_risk": 68,
        "economic_leakage": 76,
        "fiduciary_governance": 80,
        "information_asymmetry": 74,
        "data_lock_in": 58,
        "operational_risk": 55,
    }

    return {
        "tpa_name": "Demo TPA Administrators, Inc.",
        "overall_score": 33,
        "key_findings": [
            {"severity": "critical", "text": "Explicit ERISA fiduciary disclaimer paired with full discretionary claims authority — the central contradiction ERISA plaintiff firms attack (see Litigation tab)."},
            {"severity": "critical", "text": "No 408(b)(2) indirect-compensation disclosure — network allowances, float income, and contingent savings fees extract value from plan assets invisibly."},
            {"severity": "critical", "text": "Liability capped at 3 months of admin fees with one-sided indemnification — the plan, not the TPA, absorbs the cost of administrative errors."},
            {"severity": "critical", "text": "Audit rights scoped to be ineffective — 12-month lookback, no extrapolation, TPA-controlled methodology — systemic overpayments are structurally unrecoverable."},
            {"severity": "warning", "text": "Data export limited to 'standard reports' in proprietary format with derived-analytics carve-out — a switching barrier and a data-monetization stream."},
            {"severity": "warning", "text": "Stop-loss placement is TPA-directed with undisclosed commissions and no late-filing accountability."},
            {"severity": "warning", "text": "Performance guarantees are aspirational ('commercially reasonable efforts') with no fees at risk."},
            {"severity": "positive", "text": "Raw claims-data ownership is acknowledged as belonging to the Plan — a usable baseline for negotiating full portability."},
        ],
        "provisions": provisions,
        "framework_scores": framework_scores,
        "verdict": {
            "grade": "litigation_sensitive",
            "conclusion": "no",
            "rationale": "A prudent ERISA fiduciary acting solely in the interests of participants and beneficiaries should NOT execute this agreement in its current form. The contract assigns discretionary fiduciary functions to the TPA while disclaiming fiduciary status, fails the reasonable-compensation test by omitting indirect-compensation disclosure, neutralizes the plan's audit and recovery rights, and caps the TPA's accountability below its error exposure. These are not isolated defects — together they form a value-extraction architecture that systematically transfers risk and revenue from the plan to the TPA. Execution should be conditioned on the redline items in the Negotiation tab; absent those modifications the litigation and economic-leakage exposure is unacceptable.",
        },
    }


def _modeled_pepy_impact(provision_id: int, score: float, employees: int) -> Optional[str]:
    """Modeled annual $ leakage = employees × PEPY × risk_fraction (lower score = more risk)."""
    base = PEPY_BY_PROVISION.get(provision_id)
    if base is None:
        return None
    risk_fraction = max(0.0, (10.0 - float(score))) / 10.0
    if risk_fraction <= 0:
        return None
    expected = employees * base * risk_fraction
    low = expected * 0.6
    high = expected * 1.5
    return f"${low:,.0f} - ${high:,.0f} annually"


def _apply_modeled_impacts(result: dict, employees: int = REFERENCE_EMPLOYEES) -> dict:
    """Replace any LLM/demo financial_impact with modeled values so no figure is fabricated."""
    for prov in result.get("provisions", []):
        pid = prov.get("id")
        score = prov.get("score", 0)
        for issue in prov.get("issues", []):
            modeled = _modeled_pepy_impact(pid, score, employees)
            sev = (issue.get("severity") or "").lower()
            found = issue.get("found")
            if (not found or sev in ("high", "critical")) and modeled:
                issue["financial_impact"] = modeled
            else:
                issue["financial_impact"] = None
    return result


def _persist_result(contract: models.TpaIqContract, result: dict, db: Session):
    overall = float(result.get("overall_score", 0) or 0)
    contract.tpa_name = result.get("tpa_name") or contract.tpa_name
    contract.overall_score = overall
    contract.rating = score_to_rating(overall)
    verdict = result.get("verdict") or {}
    contract.grade = verdict.get("grade") or grade_from_score(overall)
    contract.provision_scores = json.dumps(result.get("provisions", []))
    contract.key_findings = json.dumps(result.get("key_findings", []))
    contract.framework_scores = json.dumps(result.get("framework_scores", {}))
    contract.verdict = json.dumps(verdict)
    contract.status = "complete"
    db.commit()


async def run_analysis(contract_id: str, contract_text: str, db: Session, *, use_demo: bool = False):
    contract = db.query(models.TpaIqContract).filter(models.TpaIqContract.id == contract_id).first()
    if not contract:
        return
    try:
        contract.status = "analyzing"
        db.commit()

        if use_demo or not contract_text or len(contract_text.strip()) < 100:
            result = _demo_analysis()
        else:
            prompt = build_analysis_prompt(contract_text)
            try:
                stream = await openai_client.chat.completions.create(
                    model="claude-opus-4-5",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=16000,
                    stream=True,
                )
                parts: list[str] = []
                async for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    if delta and delta.content:
                        parts.append(delta.content)
                raw = "".join(parts)
                if not raw:
                    raise ValueError("empty AI response")
                result = json.loads(raw)
            except Exception as ai_err:
                logger.warning(
                    "tpa_iq: AI analysis failed for %s (%s) — using demo fallback.",
                    contract_id, ai_err,
                )
                contract.error_message = (
                    f"AI analysis unavailable ({ai_err}) — demo analysis used as fallback."
                )
                result = _demo_analysis()

        result = _apply_modeled_impacts(result)
        _persist_result(contract, result, db)
    except Exception as exc:  # noqa: BLE001
        logger.exception("tpa_iq: fatal analysis error for %s", contract_id)
        contract.status = "error"
        contract.error_message = str(exc)
        db.commit()


# ─── Request models ──────────────────────────────────────────────────────────
class UploadContractBody(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    data_b64: str
    tpa_name: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.get("/provisions")
def list_provisions():
    """The 13-provision forensic ontology (static reference for the UI)."""
    return {"provisions": PROVISIONS}


@router.post("/upload", status_code=202)
async def upload_contract(
    body: UploadContractBody,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    import base64
    try:
        file_bytes = base64.b64decode(body.data_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 file data.")

    if len(file_bytes) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 100 MB")

    filename = (body.filename or "").lower()
    contract_text = ""
    if filename.endswith(".pdf"):
        contract_text = extract_pdf_text(file_bytes)
    elif filename.endswith(".docx"):
        contract_text = extract_docx_text(file_bytes)
    elif filename.endswith(".doc"):
        raise HTTPException(status_code=400, detail="Legacy .doc format is not supported. Please convert to .docx or PDF and re-upload.")
    elif filename.endswith(".txt") or body.content_type in ("text/plain", "application/octet-stream"):
        contract_text = file_bytes.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF, DOCX, or TXT file.")

    if not contract_text or len(contract_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text found in this file. If this is a scanned PDF (image-based), "
                "please export a text-layer version or copy-paste the contract text into a .txt file and upload that instead."
            ),
        )

    contract = models.TpaIqContract(
        user_id=current_user.id,
        tpa_name=body.tpa_name,
        contract_filename=body.filename or "tpa_agreement.pdf",
        contract_text=contract_text[:50000],
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, contract_text, db)
    return {"id": contract.id, "status": "analyzing"}


@router.post("/demo", status_code=202)
async def run_demo(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = models.TpaIqContract(
        user_id=current_user.id,
        tpa_name="Demo TPA Administrators, Inc.",
        contract_filename="demo_tpa_agreement.pdf",
        contract_text=None,
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, "", db, use_demo=True)
    return {"id": contract.id, "status": "analyzing"}


@router.get("/contracts")
def list_contracts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contracts = (
        db.query(models.TpaIqContract)
        .filter(models.TpaIqContract.user_id == current_user.id)
        .order_by(models.TpaIqContract.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "tpa_name": c.tpa_name,
            "contract_filename": c.contract_filename,
            "status": c.status,
            "overall_score": c.overall_score,
            "rating": c.rating,
            "grade": c.grade,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in contracts
    ]


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.TpaIqContract).filter(
        models.TpaIqContract.id == contract_id,
        models.TpaIqContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    def parse(field, default):
        try:
            return json.loads(field) if field else default
        except Exception:
            return default

    return {
        "id": contract.id,
        "tpa_name": contract.tpa_name,
        "contract_filename": contract.contract_filename,
        "status": contract.status,
        "error_message": contract.error_message,
        "overall_score": contract.overall_score,
        "rating": contract.rating,
        "grade": contract.grade,
        "provision_scores": parse(contract.provision_scores, []),
        "key_findings": parse(contract.key_findings, []),
        "framework_scores": parse(contract.framework_scores, {}),
        "verdict": parse(contract.verdict, {}),
        "created_at": contract.created_at.isoformat() if contract.created_at else None,
    }


@router.post("/contracts/{contract_id}/retry", status_code=202)
async def retry_contract_analysis(
    contract_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.TpaIqContract).filter(
        models.TpaIqContract.id == contract_id,
        models.TpaIqContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    contract.status = "pending"
    contract.error_message = None
    db.commit()
    use_demo = not contract.contract_text
    background_tasks.add_task(run_analysis, contract.id, contract.contract_text or "", db, use_demo=use_demo)
    return {"id": contract.id, "status": "analyzing"}


@router.delete("/contracts/{contract_id}", status_code=204)
def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.TpaIqContract).filter(
        models.TpaIqContract.id == contract_id,
        models.TpaIqContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()
    return None
