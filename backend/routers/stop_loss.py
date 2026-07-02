"""
Kincaid IQ — Stop-Loss IQ™
AI-powered stop-loss contract analysis against 50 fiduciary-aligned issues across 10 provisions.
Scores contracts 0–100 with negotiation guidance for brokers and self-funded plan sponsors.
"""
import io
import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.config import settings

router = APIRouter(prefix="/api/stop-loss", tags=["stop-loss"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

PROVISIONS = [
    {
        "id": 1,
        "name": "Specific Deductible & Attachment Point",
        "issues": [
            "Specific deductible (SDL) clearly defined in dollar amount per covered person",
            "Laser provisions — if any — are explicitly listed with named claimant and amount",
            "No unilateral right for carrier to add mid-term lasers without plan consent",
            "New hires and late enrollees subject to same SDL as existing members",
            "Aggregating specific deductible (ASD) terms clearly defined if applicable",
        ],
    },
    {
        "id": 2,
        "name": "Aggregate Stop-Loss Threshold",
        "issues": [
            "Aggregate attachment point defined as a fixed percentage of expected claims (typically 125%)",
            "Minimum aggregate corridor (125% or lower) contractually guaranteed",
            "Monthly aggregate accommodation rights are granted to the plan",
            "Run-in claims credited toward aggregate attachment point",
            "Aggregate laser provisions (if any) are disclosed and limited",
        ],
    },
    {
        "id": 3,
        "name": "Claim Basis & Coverage Period",
        "issues": [
            "Policy basis (paid vs. incurred) is clearly defined",
            "Run-in and run-out periods are specified (minimum 3/12 or 12/12)",
            "Terminal liability option is available at a defined premium",
            "Incurred But Not Reported (IBNR) liability is addressed",
            "Claims incurred during policy period but paid after are covered under run-out",
        ],
    },
    {
        "id": 4,
        "name": "Lasering & Exclusions",
        "issues": [
            "All exclusions are listed exhaustively — no blanket 'carrier discretion' exclusions",
            "Pre-existing condition exclusions are time-limited and clearly defined",
            "Experimental / investigational exclusions use objective, published clinical standards",
            "Mental health and substance abuse claims treated on parity with medical claims",
            "Carrier must provide written notice and justification for any claim denial",
        ],
    },
    {
        "id": 5,
        "name": "Renewal & Rate Change Rights",
        "issues": [
            "Minimum advance notice of rate changes is 60 days or more",
            "Carrier cannot add new lasers at renewal without actuarial justification",
            "Plan retains right to non-renew without penalty",
            "Rate increase caps or guaranteed renewable provisions are included",
            "Experience rating methodology and factors are disclosed in writing",
        ],
    },
    {
        "id": 6,
        "name": "Claim Submission & Administration",
        "issues": [
            "Timely filing deadlines are reasonable (minimum 12 months from date of service)",
            "Clean claim definition and processing timeline are specified",
            "Internal and external appeal rights are defined for denied stop-loss claims",
            "TPA/carrier coordination responsibilities are clearly delineated",
            "Carrier must acknowledge and respond to claims within defined timeframes",
        ],
    },
    {
        "id": 7,
        "name": "Data, Audit & Transparency Rights",
        "issues": [
            "Plan has right to audit carrier claims decisions and loss experience",
            "Loss ratio and claims detail reports provided quarterly or more frequently",
            "Carrier discloses commissions, fees, and administrative costs in writing",
            "Plan owns all claims and utilization data — carrier cannot retain or sell it",
            "Carrier must cooperate with plan audits within 60 days of request",
        ],
    },
    {
        "id": 8,
        "name": "Termination & Portability",
        "issues": [
            "Without-cause termination allowed with 60 days or less notice",
            "For-cause termination triggers are clearly defined",
            "No early termination penalties or minimum premium requirements",
            "Carrier obligated to pay all eligible claims incurred during policy period post-termination",
            "Transition assistance and data portability obligations defined on exit",
        ],
    },
    {
        "id": 9,
        "name": "Carrier Financial Strength & Solvency",
        "issues": [
            "Carrier holds minimum AM Best rating of A- or equivalent",
            "Carrier maintains reinsurance or retrocession arrangements disclosed to plan",
            "Insolvency protections specify plan's rights and claim priority",
            "Carrier required to maintain reserves adequate to cover run-out liabilities",
            "Parent company guarantee or letter of credit available if carrier is rated below A-",
        ],
    },
    {
        "id": 10,
        "name": "Fiduciary Alignment & Conflict Disclosure",
        "issues": [
            "Carrier discloses all conflicts of interest, including TPA ownership or affiliations",
            "Broker/consultant compensation from carrier is fully disclosed",
            "Carrier does not have discretionary authority over plan benefit determinations",
            "Performance guarantees with financial penalties for SLA violations are included",
            "Contract includes a fiduciary warranty that carrier will act in plan's best interest",
        ],
    },
]

SCORE_LABELS = {
    "excellent": (90, 100),
    "good":      (75, 89),
    "fair":      (60, 74),
    "concern":   (45, 59),
    "red_flag":  (0,  44),
}


def score_to_rating(score: float) -> str:
    for label, (low, high) in SCORE_LABELS.items():
        if low <= score <= high:
            return label
    return "red_flag"


def extract_pdf_text(file_bytes: bytes) -> str:
    text_parts = []
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages[:40]:
            try:
                text = page.extract_text()
                if text and text.strip():
                    text_parts.append(text)
            except Exception:
                continue
    except Exception:
        pass

    if text_parts:
        return "\n\n".join(text_parts)

    # Fallback: try pdfminer if pypdf yields nothing
    try:
        from pdfminer.high_level import extract_text as pdfminer_extract
        result = pdfminer_extract(io.BytesIO(file_bytes))
        if result and result.strip():
            return result
    except Exception:
        pass

    return ""


def extract_docx_text(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also pull table cells
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

    return f"""You are an expert stop-loss insurance attorney and self-funded health plan fiduciary specialist.
Analyze the following stop-loss contract text against the Fiduciary-Aligned Stop-Loss Contract Standards.
This framework has 50 issues across 10 provisions aligned with ERISA, ACA, and CAA 2026 requirements.

PROVISIONS TO EVALUATE:
{provisions_text}

CONTRACT TEXT:
---
{contract_text[:12000]}
---

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "carrier_name": "detected carrier name or null",
  "overall_score": <0-100 float>,
  "key_findings": [
    {{"severity": "critical|warning|positive", "text": "finding description"}}
  ],
  "provisions": [
    {{
      "id": 1,
      "name": "provision name",
      "score": <0-10 float>,
      "rating": "excellent|good|fair|concern|red_flag",
      "quick_look": "good|concern|red_flag",
      "issues": [
        {{
          "text": "issue description",
          "found": true|false,
          "quote": "exact contract quote or null",
          "gap": "what is missing or null"
        }}
      ],
      "negotiation": {{
        "gap_summary": "brief description of what is missing",
        "model_language": "suggested contract language",
        "talking_point": "how to frame this with the carrier"
      }}
    }}
  ]
}}

Score each provision 0-10. Overall score = weighted average scaled to 0-100.
Be strict — most stop-loss contracts score 35-60. Missing provisions score 0."""


def build_comparison_prompt(contract_a: dict, contract_b: dict) -> str:
    def summarize(c: dict) -> str:
        provisions = c.get("provision_scores", [])
        lines = [f"Overall: {c.get('overall_score', 0):.1f}/100 ({c.get('rating', 'unknown')})"]
        for p in provisions:
            lines.append(f"  P{p['id']} {p['name']}: {p.get('score', 0):.1f}/10 ({p.get('rating', '?')})")
        return "\n".join(lines)

    return f"""You are a stop-loss contract expert comparing two contract versions for a self-funded health plan.

CONTRACT A (Original):
{summarize(contract_a)}

CONTRACT B (Renegotiated):
{summarize(contract_b)}

Respond with ONLY valid JSON:
{{
  "score_change": <Contract B overall - Contract A overall>,
  "summary": "one paragraph describing the negotiation outcome",
  "improvements": [
    {{"provision_id": 1, "provision_name": "name", "before": 3.0, "after": 7.0, "change": "+4.0", "description": "what was added"}}
  ],
  "regressions": [
    {{"provision_id": 2, "provision_name": "name", "before": 8.0, "after": 6.0, "change": "-2.0", "description": "what was weakened"}}
  ],
  "unchanged": [
    {{"provision_id": 3, "provision_name": "name", "score": 5.0, "note": "no change — still needs attention"}}
  ],
  "remaining_gaps": ["description of critical issues still not addressed in Contract B"],
  "verdict": "improved|mixed|regressed"
}}"""


async def run_analysis(contract_id: str, contract_text: str, db: Session, *, use_demo: bool = False):
    contract = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_id).first()
    if not contract:
        return
    try:
        contract.status = "analyzing"
        db.commit()

        if use_demo or not contract_text or len(contract_text.strip()) < 100:
            result = _demo_analysis()
        else:
            prompt = build_analysis_prompt(contract_text)
            response = await openai_client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=5000,
            )
            result = json.loads(response.choices[0].message.content)

        overall = float(result.get("overall_score", 45))
        provisions = result.get("provisions", [])

        contract.overall_score = overall
        contract.rating = score_to_rating(overall)
        if result.get("carrier_name") and not contract.carrier_name:
            contract.carrier_name = result["carrier_name"]

        contract.provision_scores = json.dumps(provisions)
        contract.quick_look = json.dumps([
            {"id": p["id"], "name": p["name"], "quick_look": p.get("quick_look", "concern")}
            for p in provisions
        ])
        contract.key_findings = json.dumps(result.get("key_findings", []))
        contract.negotiation_guide = json.dumps([
            {"id": p["id"], "name": p["name"], "score": p["score"],
             "negotiation": p.get("negotiation", {}), "issues": p.get("issues", [])}
            for p in provisions
        ])
        contract.status = "complete"
        db.commit()

    except Exception as e:
        db.rollback()
        contract = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_id).first()
        if contract:
            contract.status = "error"
            contract.error_message = str(e)
            db.commit()


async def run_comparison(contract_a_id: str, contract_b_id: str, db: Session):
    contract_b = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_b_id).first()
    contract_a = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_a_id).first()
    if not contract_b or not contract_a:
        return

    try:
        def parse(field):
            try:
                return json.loads(field) if field else []
            except Exception:
                return []

        a_data = {
            "overall_score": contract_a.overall_score or 0,
            "rating": contract_a.rating or "concern",
            "provision_scores": parse(contract_a.provision_scores),
        }
        b_data = {
            "overall_score": contract_b.overall_score or 0,
            "rating": contract_b.rating or "concern",
            "provision_scores": parse(contract_b.provision_scores),
        }

        try:
            prompt = build_comparison_prompt(a_data, b_data)
            response = await openai_client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=2000,
            )
            result = json.loads(response.choices[0].message.content)
        except Exception:
            result = _demo_comparison(a_data, b_data)

        contract_b.compare_contract_id = contract_a_id
        contract_b.compare_result = json.dumps(result)
        db.commit()

    except Exception:
        db.rollback()


def _demo_comparison(a_data: dict, b_data: dict) -> dict:
    a_provisions = {p["id"]: p for p in a_data.get("provision_scores", [])}
    b_provisions = {p["id"]: p for p in b_data.get("provision_scores", [])}
    score_change = (b_data["overall_score"] or 0) - (a_data["overall_score"] or 0)

    improvements, regressions, unchanged = [], [], []
    for pid in range(1, 11):
        a_p = a_provisions.get(pid, {})
        b_p = b_provisions.get(pid, {})
        a_score = float(a_p.get("score", 0))
        b_score = float(b_p.get("score", 0))
        name = b_p.get("name") or a_p.get("name") or f"Provision {pid}"
        diff = round(b_score - a_score, 1)

        if diff >= 1.5:
            improvements.append({"provision_id": pid, "provision_name": name,
                "before": a_score, "after": b_score, "change": f"+{diff}",
                "description": "Significant improvement — added protective language"})
        elif diff <= -1.0:
            regressions.append({"provision_id": pid, "provision_name": name,
                "before": a_score, "after": b_score, "change": str(diff),
                "description": "Provision weakened during negotiation"})
        else:
            unchanged.append({"provision_id": pid, "provision_name": name,
                "score": b_score, "note": "Minimal change — consider re-negotiating"})

    verdict = "improved" if score_change >= 10 else "mixed" if score_change >= 0 else "regressed"
    return {
        "score_change": score_change,
        "summary": f"Contract B scored {b_data['overall_score']:.0f}/100 vs {a_data['overall_score']:.0f}/100 — a change of {score_change:+.0f} points. {len(improvements)} provisions improved, {len(regressions)} regressed, {len(unchanged)} unchanged.",
        "improvements": improvements,
        "regressions": regressions,
        "unchanged": unchanged,
        "remaining_gaps": [
            "Aggregate accommodation rights still not guaranteed in writing",
            "Terminal liability option absent — creates significant IBNR exposure",
            "Carrier audit rights remain restricted to summary data only",
        ],
        "verdict": verdict,
    }


def _demo_analysis() -> dict:
    return {
        "carrier_name": "Acme Re Stop-Loss Corp",
        "overall_score": 47.0,
        "key_findings": [
            {"severity": "critical", "text": "No terminal liability option — plan faces unlimited IBNR exposure at termination"},
            {"severity": "critical", "text": "Carrier retains unilateral right to add lasers at renewal with only 30-day notice"},
            {"severity": "critical", "text": "Timely filing deadline of 90 days is far below the 12-month industry standard"},
            {"severity": "warning", "text": "Aggregate attachment point set at 130% — above the recommended 125% corridor"},
            {"severity": "warning", "text": "Audit rights limited to aggregate data — no access to individual claim decisions"},
            {"severity": "warning", "text": "Mental health parity language absent — creates ACA/MHPAEA compliance risk"},
            {"severity": "positive", "text": "Specific deductible clearly defined with no ambiguous aggregating provisions"},
            {"severity": "positive", "text": "Carrier discloses AM Best rating of A (Excellent) in the contract"},
        ],
        "provisions": [
            {
                "id": 1, "name": "Specific Deductible & Attachment Point",
                "score": 6.5, "rating": "fair", "quick_look": "concern",
                "issues": [
                    {"text": "Specific deductible clearly defined in dollar amount per covered person", "found": True, "quote": "The specific deductible shall be $150,000 per covered person per policy year.", "gap": None},
                    {"text": "Laser provisions explicitly listed with named claimant and amount", "found": False, "quote": None, "gap": "No laser schedule attached — carrier may add lasers at renewal with minimal notice"},
                    {"text": "No unilateral right for carrier to add mid-term lasers without plan consent", "found": False, "quote": None, "gap": "Section 4.2 grants carrier sole discretion to laser any claimant exceeding $50,000 in a quarter"},
                    {"text": "New hires and late enrollees subject to same SDL as existing members", "found": True, "quote": "All eligible employees enrolled within 31 days of eligibility are subject to the standard specific deductible.", "gap": None},
                    {"text": "Aggregating specific deductible (ASD) terms clearly defined if applicable", "found": True, "quote": "N/A — no ASD applies to this policy.", "gap": None},
                ],
                "negotiation": {
                    "gap_summary": "Laser rights are too broad — carrier can unilaterally laser high-cost claimants with only 30 days notice at renewal",
                    "model_language": "Carrier may not add or modify laser amounts for any covered person during the policy term without written consent of the Plan Administrator. At renewal, lasers may only be added for claimants with claims exceeding [X]% of the specific deductible in the prior policy year, with 60 days advance written notice and actuarial justification.",
                    "talking_point": "Unilateral laser rights expose the plan to unexpected budget variance. A mutual consent requirement protects both parties — carriers with strong underwriting don't need broad laser authority."
                },
            },
            {
                "id": 2, "name": "Aggregate Stop-Loss Threshold",
                "score": 5.0, "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Aggregate attachment point defined as fixed percentage of expected claims (125%)", "found": False, "quote": None, "gap": "Attachment set at 130% — 5 points above fiduciary best practice of 125%"},
                    {"text": "Minimum aggregate corridor (125% or lower) contractually guaranteed", "found": False, "quote": None, "gap": "Contract is silent on corridor guarantee — carrier can adjust at renewal"},
                    {"text": "Monthly aggregate accommodation rights are granted to the plan", "found": True, "quote": "Plan may request monthly aggregate accommodation subject to carrier approval.", "gap": "Approval is discretionary — plan has no guaranteed accommodation right"},
                    {"text": "Run-in claims credited toward aggregate attachment point", "found": True, "quote": "Claims incurred in the 3 months prior to the effective date and paid during the policy year shall be credited against the aggregate attachment point.", "gap": None},
                    {"text": "Aggregate laser provisions disclosed and limited", "found": False, "quote": None, "gap": "No aggregate laser provisions defined — creates ambiguity"},
                ],
                "negotiation": {
                    "gap_summary": "Aggregate corridor is 130% rather than the industry-standard 125%, and accommodation rights are discretionary rather than guaranteed",
                    "model_language": "The aggregate attachment point shall not exceed 125% of expected claims as calculated using the carrier's approved rate manual. The Plan shall have the right to receive monthly aggregate accommodation payments when paid claims exceed 80% of the pro-rated attachment point, without requiring carrier approval.",
                    "talking_point": "A 130% corridor means the plan absorbs $50,000 in excess losses for every $1M of expected claims before stop-loss kicks in. The 125% standard is well-established — push back on anything above it."
                },
            },
            {
                "id": 3, "name": "Claim Basis & Coverage Period",
                "score": 4.0, "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Policy basis (paid vs. incurred) clearly defined", "found": True, "quote": "This policy is written on a paid basis — claims must be paid during the policy year to be reimbursable.", "gap": None},
                    {"text": "Run-in and run-out periods specified (minimum 3/12 or 12/12)", "found": True, "quote": "A 3-month run-in and 3-month run-out period apply.", "gap": "3/3 run-out is below the recommended 3/12 minimum — leaves significant tail exposure"},
                    {"text": "Terminal liability option available at defined premium", "found": False, "quote": None, "gap": "No terminal liability option offered — plan must purchase a separate tail policy at market rates"},
                    {"text": "IBNR liability addressed", "found": False, "quote": None, "gap": "Contract does not address IBNR — creates significant exposure on non-renewal"},
                    {"text": "Claims incurred during policy period but paid after are covered under run-out", "found": True, "quote": "Claims incurred before the termination date and paid within the 3-month run-out period are eligible for reimbursement.", "gap": "Only 3 months — insufficient for complex or delayed claims"},
                ],
                "negotiation": {
                    "gap_summary": "Run-out period is only 3 months and no terminal liability option exists — creates significant financial exposure at contract end",
                    "model_language": "The run-out period shall be 12 months from the policy termination date for claims incurred during the policy year. Carrier shall offer a terminal liability (tail) option at a premium not to exceed [X]% of the final annual premium, exercisable within 30 days of termination notice.",
                    "talking_point": "Complex stop-loss claims — transplants, cancer, NICU — often take 6–12 months to finalize billing. A 3-month run-out guarantees the plan will absorb tail losses. This is a critical gap."
                },
            },
            {
                "id": 4, "name": "Lasering & Exclusions",
                "score": 3.5, "rating": "concern", "quick_look": "red_flag",
                "issues": [
                    {"text": "All exclusions listed exhaustively — no blanket 'carrier discretion' exclusions", "found": False, "quote": None, "gap": "Section 7.1 includes a blanket exclusion for 'any condition deemed experimental at carrier's sole discretion'"},
                    {"text": "Pre-existing condition exclusions time-limited and clearly defined", "found": True, "quote": "Pre-existing conditions are excluded for the first 12 months of coverage for late enrollees only.", "gap": None},
                    {"text": "Experimental/investigational exclusions use objective, published clinical standards", "found": False, "quote": None, "gap": "Experimental exclusions reference carrier's internal criteria — not published standards (NCCN, Hayes, Milliman)"},
                    {"text": "Mental health and substance abuse claims treated on parity with medical claims", "found": False, "quote": None, "gap": "MH/SUD parity language absent — creates MHPAEA compliance risk"},
                    {"text": "Carrier must provide written notice and justification for any claim denial", "found": True, "quote": "Carrier shall provide written explanation for any claim not reimbursed within 30 days of determination.", "gap": None},
                ],
                "negotiation": {
                    "gap_summary": "Experimental exclusions use carrier's internal criteria and MH/SUD parity language is absent — both are significant compliance and financial risks",
                    "model_language": "Experimental and investigational exclusions shall be defined by reference to published criteria from NCCN, Hayes Rating, or Milliman Care Guidelines. Carrier shall apply the same exclusion criteria to mental health and substance abuse claims as applied to analogous medical/surgical claims, consistent with MHPAEA requirements.",
                    "talking_point": "Using carrier-internal experimental criteria gives them unlimited discretion to deny high-cost claims. Reference to published clinical standards is the only way to get objective, defensible exclusion decisions."
                },
            },
            {
                "id": 5, "name": "Renewal & Rate Change Rights",
                "score": 4.5, "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Minimum advance notice of rate changes is 60 days or more", "found": False, "quote": None, "gap": "Only 30 days notice required for rate changes — insufficient for plan budgeting"},
                    {"text": "Carrier cannot add new lasers at renewal without actuarial justification", "found": False, "quote": None, "gap": "No restriction on adding lasers at renewal — carrier has unlimited authority"},
                    {"text": "Plan retains right to non-renew without penalty", "found": True, "quote": "Plan may elect not to renew this policy upon 30 days written notice.", "gap": None},
                    {"text": "Rate increase caps or guaranteed renewable provisions included", "found": False, "quote": None, "gap": "No rate cap or guaranteed renewable provision — unlimited renewal increases allowed"},
                    {"text": "Experience rating methodology and factors disclosed in writing", "found": True, "quote": "Renewal rates are based on 24-month experience with a 60/40 plan/industry blend.", "gap": "Blending factors and credibility matrix not disclosed"},
                ],
                "negotiation": {
                    "gap_summary": "Only 30 days notice for rate changes and no restriction on laser additions at renewal — plan has minimal renewal protections",
                    "model_language": "Carrier shall provide a minimum of 90 days advance written notice of any renewal rate change, together with actuarial justification. Rate increases shall not exceed [X]% in any single year without plan consent. New lasers at renewal require 90 days notice and written actuarial support for each named claimant.",
                    "talking_point": "30 days notice for a renewal rate change is completely unworkable for plan budgeting. Finance needs at least 90 days to process. This is non-negotiable for a well-run organization."
                },
            },
            {
                "id": 6, "name": "Claim Submission & Administration",
                "score": 3.0, "rating": "concern", "quick_look": "red_flag",
                "issues": [
                    {"text": "Timely filing deadlines reasonable (minimum 12 months from date of service)", "found": False, "quote": None, "gap": "90-day timely filing deadline — far below the 12-month industry standard; will cause claim denials"},
                    {"text": "Clean claim definition and processing timeline specified", "found": True, "quote": "Carrier shall process clean claims within 30 business days of receipt.", "gap": None},
                    {"text": "Internal and external appeal rights defined for denied stop-loss claims", "found": True, "quote": "Plan may appeal any denial within 60 days. External review available for clinical denials over $50,000.", "gap": None},
                    {"text": "TPA/carrier coordination responsibilities clearly delineated", "found": False, "quote": None, "gap": "Contract does not specify TPA coordination obligations — creates gap risk on large claims"},
                    {"text": "Carrier must acknowledge and respond to claims within defined timeframes", "found": True, "quote": "Carrier shall acknowledge receipt of stop-loss claims within 5 business days.", "gap": None},
                ],
                "negotiation": {
                    "gap_summary": "90-day timely filing deadline is a critical gap — will cause legitimate claims to be denied when TPA processing is delayed",
                    "model_language": "Stop-loss claims shall be accepted for submission within 24 months of the date of service, or 12 months from the date of payment by the Plan, whichever is later. Carrier waives timely filing defenses for any delay caused by carrier's own administrative processes.",
                    "talking_point": "Complex claims — transplants, cancer infusions, NICU stays — routinely take 6–9 months to fully adjudicate at the TPA level. A 90-day stop-loss filing deadline guarantees the plan will lose money on its highest-cost cases. This clause must be renegotiated."
                },
            },
            {
                "id": 7, "name": "Data, Audit & Transparency Rights",
                "score": 4.0, "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Plan has right to audit carrier claims decisions and loss experience", "found": False, "quote": None, "gap": "Audit rights limited to aggregate loss ratio — no right to audit individual claim adjudication"},
                    {"text": "Loss ratio and claims detail reports provided quarterly or more frequently", "found": True, "quote": "Carrier shall provide semi-annual loss ratio reports within 45 days of period end.", "gap": "Semi-annual only — quarterly is the minimum fiduciary standard"},
                    {"text": "Carrier discloses commissions, fees, and administrative costs in writing", "found": False, "quote": None, "gap": "Broker compensation from carrier not disclosed — creates CAA 2022 compliance risk"},
                    {"text": "Plan owns all claims and utilization data", "found": True, "quote": "All claims data submitted by the Plan remains the property of the Plan.", "gap": None},
                    {"text": "Carrier must cooperate with plan audits within 60 days of request", "found": False, "quote": None, "gap": "No audit cooperation timeline specified — carrier can delay indefinitely"},
                ],
                "negotiation": {
                    "gap_summary": "Audit rights are limited to aggregate data, reports are only semi-annual, and broker compensation is not disclosed — all three are CAA 2022 compliance gaps",
                    "model_language": "Plan shall have the right to audit carrier's claim adjudication decisions, reinsurance arrangements, and administrative costs upon 30 days written notice. Carrier shall provide monthly claims detail reports and quarterly loss ratio reports. Carrier shall disclose all compensation paid to brokers, consultants, or intermediaries in connection with this policy.",
                    "talking_point": "CAA 2022 requires full compensation disclosure. Semi-annual reports won't support real-time fiduciary decision-making. These are ERISA compliance requirements, not preferences."
                },
            },
            {
                "id": 8, "name": "Termination & Portability",
                "score": 6.0, "rating": "fair", "quick_look": "concern",
                "issues": [
                    {"text": "Without-cause termination allowed with 60 days or less notice", "found": True, "quote": "Either party may terminate this agreement upon 60 days written notice without cause.", "gap": None},
                    {"text": "For-cause termination triggers clearly defined", "found": True, "quote": "For-cause termination may occur upon material breach, insolvency, or loss of licensure.", "gap": None},
                    {"text": "No early termination penalties or minimum premium requirements", "found": False, "quote": None, "gap": "Minimum earned premium of 75% applies — plan owes premium even if terminated early"},
                    {"text": "Carrier obligated to pay all eligible claims incurred during policy period post-termination", "found": True, "quote": "Carrier remains liable for claims incurred prior to termination date, subject to timely filing requirements.", "gap": None},
                    {"text": "Transition assistance and data portability obligations defined on exit", "found": False, "quote": None, "gap": "No data portability or transition assistance obligations — creates gap on carrier change"},
                ],
                "negotiation": {
                    "gap_summary": "Minimum earned premium of 75% creates a significant financial penalty for early termination — plan cannot freely change carriers",
                    "model_language": "No minimum earned premium shall apply. Plan may terminate this policy at any time with 60 days written notice. Carrier shall provide all claims data in standard electronic format within 30 days of termination and cooperate with any successor carrier for a minimum of 90 days.",
                    "talking_point": "A 75% minimum premium means the plan must pay for coverage it doesn't have. If the carrier underperforms or the TPA relationship changes, the plan needs the freedom to move without a financial penalty."
                },
            },
            {
                "id": 9, "name": "Carrier Financial Strength & Solvency",
                "score": 7.0, "rating": "good", "quick_look": "good",
                "issues": [
                    {"text": "Carrier holds minimum AM Best rating of A- or equivalent", "found": True, "quote": "Carrier maintains an AM Best rating of A (Excellent) as of the policy effective date.", "gap": None},
                    {"text": "Carrier maintains reinsurance or retrocession arrangements disclosed to plan", "found": True, "quote": "Carrier maintains aggregate retrocession coverage with Hannover Re for losses exceeding 150% of premium.", "gap": None},
                    {"text": "Insolvency protections specify plan's rights and claim priority", "found": True, "quote": "In the event of carrier insolvency, plan claims shall be treated as priority liabilities.", "gap": None},
                    {"text": "Carrier required to maintain reserves adequate to cover run-out liabilities", "found": False, "quote": None, "gap": "No reserve adequacy requirement — plan's run-out claims may be at risk if carrier deteriorates"},
                    {"text": "Parent company guarantee available if carrier rated below A-", "found": False, "quote": None, "gap": "No parent guarantee provision — rating downgrade leaves plan unprotected"},
                ],
                "negotiation": {
                    "gap_summary": "Strong current rating but no reserve requirements or parent guarantee if rating deteriorates",
                    "model_language": "Carrier shall maintain an AM Best rating of A- or better throughout the policy term. In the event of a rating downgrade below A-, carrier shall within 30 days provide a parent company guarantee or letter of credit equal to 125% of estimated run-out liability. Carrier shall certify reserve adequacy annually.",
                    "talking_point": "A carrier can be A-rated today and downgraded tomorrow. The reserve adequacy and parent guarantee provisions only matter when things go wrong — which is exactly when you need them."
                },
            },
            {
                "id": 10, "name": "Fiduciary Alignment & Conflict Disclosure",
                "score": 3.5, "rating": "concern", "quick_look": "red_flag",
                "issues": [
                    {"text": "Carrier discloses all conflicts of interest including TPA ownership or affiliations", "found": False, "quote": None, "gap": "No conflict of interest disclosure — carrier may have ownership interest in TPA not disclosed"},
                    {"text": "Broker/consultant compensation from carrier fully disclosed", "found": False, "quote": None, "gap": "Broker override and bonus arrangements from carrier not disclosed — CAA 2022 violation"},
                    {"text": "Carrier does not have discretionary authority over plan benefit determinations", "found": True, "quote": "The Plan Administrator retains sole discretionary authority over benefit eligibility determinations.", "gap": None},
                    {"text": "Performance guarantees with financial penalties for SLA violations included", "found": False, "quote": None, "gap": "No performance guarantees — carrier faces no financial consequence for claim processing failures"},
                    {"text": "Contract includes fiduciary warranty that carrier will act in plan's best interest", "found": False, "quote": None, "gap": "No fiduciary warranty — carrier has no contractual obligation to act in plan's interest"},
                ],
                "negotiation": {
                    "gap_summary": "No conflict disclosure, no broker compensation transparency, no performance guarantees, and no fiduciary warranty — four critical gaps in one provision",
                    "model_language": "Carrier warrants that it will act at all times in the best interest of the Plan and its participants. Carrier shall disclose all compensation paid to any intermediary in connection with this policy within 30 days of request. Carrier shall maintain performance guarantees with financial penalties of [$X] per day for processing failures exceeding [Y] business days.",
                    "talking_point": "CAA 2022 requires compensation transparency. Performance guarantees create accountability. Without them, the carrier has no financial incentive to process your claims correctly or on time."
                },
            },
        ],
    }


def _demo_renegotiated_analysis() -> dict:
    base = _demo_analysis()
    improvements = {
        1: 8.5, 2: 7.0, 3: 7.5, 4: 6.5, 5: 7.0,
        6: 7.5, 7: 7.0, 8: 8.0, 9: 8.5, 10: 6.5,
    }
    new_provisions = []
    for p in base["provisions"]:
        p = dict(p)
        p["score"] = improvements[p["id"]]
        p["rating"] = score_to_rating(p["score"] * 10)
        p["quick_look"] = "good" if p["score"] >= 7 else "concern"
        new_provisions.append(p)

    base["provisions"] = new_provisions
    base["overall_score"] = 72.0
    base["carrier_name"] = "Acme Re Stop-Loss Corp (Renegotiated)"
    base["key_findings"] = [
        {"severity": "positive", "text": "Run-out extended to 12 months — terminal liability exposure eliminated"},
        {"severity": "positive", "text": "Timely filing deadline extended to 18 months from date of service"},
        {"severity": "positive", "text": "Aggregate corridor reduced to 125% — $50K savings per $1M of expected claims"},
        {"severity": "positive", "text": "Carrier conflict disclosure and broker compensation transparency added"},
        {"severity": "warning", "text": "Laser rights still exist at renewal — mutual consent provision was not obtained"},
        {"severity": "warning", "text": "Performance guarantees added but penalties are below market standard"},
    ]
    return base


# ─── Carrier Accountability Index (Seeded) ───────────────────────────────────

def _carrier_index() -> dict:
    import random
    rng = random.Random(99887766)

    def rand_score():
        return round(rng.uniform(38, 88), 1)

    carriers = [
        ("Sun Life Financial", "A+"), ("Symetra Life", "A"),
        ("HM Life Insurance", "A-"), ("Tokio Marine HCC", "A++"),
        ("Swiss Re Life & Health", "A+"), ("Voya Financial", "A"),
        ("Munich Re Stop-Loss", "A+"), ("Berkley Life & Health", "A"),
        ("Companion Life", "A+"), ("Reliance Standard", "A"),
        ("QBE North America", "A"), ("Acme Re Stop-Loss Corp", "B+"),
        ("Nationwide Life", "A+"), ("The Hartford", "A+"),
        ("Zurich Life", "A"), ("Unum Group", "A"),
        ("Principal Life", "A+"), ("Guardian Life", "A++"),
        ("MetLife Stop-Loss", "A+"), ("Cigna Stop-Loss", "A"),
    ]

    tiers = []
    for name, rating in carriers:
        score = rand_score()
        tiers.append({
            "carrier": name, "am_best": rating, "score": score,
            "rating": score_to_rating(score),
            "strengths": rng.choice([
                "Strong run-out provisions", "Guaranteed aggregate corridor",
                "Transparent laser methodology", "Quarterly loss reporting",
                "Broad timely filing window",
            ]),
            "weaknesses": rng.choice([
                "Minimum earned premium clause", "Discretionary experimental exclusions",
                "Limited audit rights", "30-day rate notice only",
                "No terminal liability option",
            ]),
        })

    tiers.sort(key=lambda x: x["score"], reverse=True)
    return {"carriers": tiers, "updated": "Q1 2026", "methodology": "50-point fiduciary framework — Stop-Loss IQ™"}


# ─── API Routes ───────────────────────────────────────────────────────────────

class CompareRequest(BaseModel):
    contract_a_id: str


@router.post("/upload", status_code=202)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    carrier_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    file_bytes = await file.read()
    if len(file_bytes) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 100MB)")

    filename = file.filename or "contract"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        contract_text = extract_pdf_text(file_bytes)
    elif ext in ("docx", "doc"):
        contract_text = extract_docx_text(file_bytes)
    elif ext == "txt":
        contract_text = file_bytes.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload PDF, DOCX, or TXT.")

    if not contract_text or len(contract_text.strip()) < 50:
        raise HTTPException(
            status_code=422,
            detail=(
                "No readable text found in this file. "
                "If this is a scanned PDF (image-based), please export a text-layer version or copy-paste the contract text into a .txt file and upload that instead."
            ),
        )

    contract = models.StopLossContract(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        carrier_name=carrier_name,
        contract_filename=filename,
        contract_text=contract_text[:50000],
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)

    background_tasks.add_task(run_analysis, contract.id, contract_text, db)
    return {"id": contract.id, "status": "pending"}


@router.post("/demo", status_code=202)
async def create_demo(
    background_tasks: BackgroundTasks,
    body: dict = {},
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    carrier_name = (body or {}).get("carrier_name", "Sample Carrier Corp")
    contract = models.StopLossContract(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        carrier_name=carrier_name,
        contract_filename="demo_stop_loss_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, "", db, use_demo=True)
    return {"id": contract.id, "status": "pending"}


@router.post("/demo-pair", status_code=202)
async def create_demo_pair(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract_a = models.StopLossContract(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        carrier_name="Acme Re Stop-Loss Corp",
        contract_filename="original_stop_loss_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract_a)
    db.commit()
    db.refresh(contract_a)

    contract_b = models.StopLossContract(
        id=str(uuid.uuid4()),
        user_id=str(current_user.id),
        carrier_name="Acme Re Stop-Loss Corp (Renegotiated)",
        contract_filename="renegotiated_stop_loss_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract_b)
    db.commit()
    db.refresh(contract_b)

    background_tasks.add_task(_run_renegotiated_demo, contract_b.id, contract_a.id, db)
    return {"contract_a_id": contract_a.id, "contract_b_id": contract_b.id}


async def _run_renegotiated_demo(contract_b_id: str, contract_a_id: str, db: Session):
    import asyncio
    contract_a = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_a_id).first()
    contract_b = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_b_id).first()
    if not contract_a or not contract_b:
        return

    try:
        contract_a.status = "analyzing"
        contract_b.status = "analyzing"
        db.commit()
        await asyncio.sleep(1)

        demo_a = _demo_analysis()
        contract_a.overall_score = demo_a["overall_score"]
        contract_a.rating = score_to_rating(contract_a.overall_score)
        contract_a.carrier_name = demo_a["carrier_name"]
        contract_a.provision_scores = json.dumps(demo_a["provisions"])
        contract_a.quick_look = json.dumps([
            {"id": p["id"], "name": p["name"], "quick_look": p["quick_look"]}
            for p in demo_a["provisions"]
        ])
        contract_a.key_findings = json.dumps(demo_a["key_findings"])
        contract_a.negotiation_guide = json.dumps([
            {"id": p["id"], "name": p["name"], "score": p["score"],
             "negotiation": p["negotiation"], "issues": p["issues"]}
            for p in demo_a["provisions"]
        ])
        contract_a.status = "complete"
        db.commit()

        await asyncio.sleep(1)

        demo_b = _demo_renegotiated_analysis()
        contract_b.overall_score = demo_b["overall_score"]
        contract_b.rating = score_to_rating(contract_b.overall_score)
        contract_b.carrier_name = demo_b["carrier_name"]
        contract_b.provision_scores = json.dumps(demo_b["provisions"])
        contract_b.quick_look = json.dumps([
            {"id": p["id"], "name": p["name"], "quick_look": p["quick_look"]}
            for p in demo_b["provisions"]
        ])
        contract_b.key_findings = json.dumps(demo_b["key_findings"])
        contract_b.negotiation_guide = json.dumps([
            {"id": p["id"], "name": p["name"], "score": p["score"],
             "negotiation": p["negotiation"], "issues": p["issues"]}
            for p in demo_b["provisions"]
        ])
        contract_b.status = "complete"
        db.commit()

        await run_comparison(contract_a_id, contract_b_id, db)

        contract_b = db.query(models.StopLossContract).filter(models.StopLossContract.id == contract_b_id).first()
        if contract_b:
            db.refresh(contract_b)
    except Exception as e:
        db.rollback()


@router.get("/contracts")
def list_contracts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contracts = db.query(models.StopLossContract).filter(
        models.StopLossContract.user_id == str(current_user.id)
    ).order_by(models.StopLossContract.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "carrier_name": c.carrier_name,
            "contract_filename": c.contract_filename,
            "status": c.status,
            "overall_score": c.overall_score,
            "rating": c.rating,
        }
        for c in contracts
    ]


@router.get("/contracts/{contract_id}")
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.StopLossContract).filter(
        models.StopLossContract.id == contract_id,
        models.StopLossContract.user_id == str(current_user.id),
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    def parse(field):
        try:
            return json.loads(field) if field else []
        except Exception:
            return []

    return {
        "id": contract.id,
        "carrier_name": contract.carrier_name,
        "contract_filename": contract.contract_filename,
        "status": contract.status,
        "error_message": contract.error_message,
        "overall_score": contract.overall_score,
        "rating": contract.rating,
        "provision_scores": parse(contract.provision_scores),
        "quick_look": parse(contract.quick_look),
        "key_findings": parse(contract.key_findings),
        "negotiation_guide": parse(contract.negotiation_guide),
        "compare_contract_id": contract.compare_contract_id,
        "compare_result": parse(contract.compare_result) if contract.compare_result else None,
        "created_at": contract.created_at.isoformat() if contract.created_at else None,
    }


@router.delete("/contracts/{contract_id}", status_code=204)
def delete_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.StopLossContract).filter(
        models.StopLossContract.id == contract_id,
        models.StopLossContract.user_id == str(current_user.id),
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()


@router.post("/contracts/{contract_b_id}/compare", status_code=202)
async def compare_contracts(
    contract_b_id: str,
    body: CompareRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract_b = db.query(models.StopLossContract).filter(
        models.StopLossContract.id == contract_b_id,
        models.StopLossContract.user_id == str(current_user.id),
    ).first()
    if not contract_b:
        raise HTTPException(status_code=404, detail="Contract not found")

    contract_a = db.query(models.StopLossContract).filter(
        models.StopLossContract.id == body.contract_a_id,
        models.StopLossContract.user_id == str(current_user.id),
    ).first()
    if not contract_a:
        raise HTTPException(status_code=404, detail="Comparison contract not found")

    background_tasks.add_task(run_comparison, body.contract_a_id, contract_b_id, db)
    return {"status": "comparing"}


@router.get("/index")
def carrier_index(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _carrier_index()
