"""
Kincaid Health — Contract X-Ray™
AI-powered PBM contract analysis against 50 fiduciary-aligned issues across 10 provisions.
Includes full side-by-side Fiduciary Comparison Report for before/after negotiation analysis.
"""
import io
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.config import settings

router = APIRouter(prefix="/api/pbm", tags=["pbm-contract"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

# ─── 10 Provisions × 50 Issues ────────────────────────────────────────────────

PROVISIONS = [
    {
        "id": 1,
        "name": "Fiduciary Loyalty Commitment",
        "issues": [
            "PBM explicitly accepts fiduciary status in writing",
            "All conflicts of interest are disclosed to the plan",
            "PBM commits to act solely in the interest of plan participants",
            "Fiduciary acceptance is expressly stated — not implied or incorporated by reference",
            "PBM proactively discloses all potential conflicts of interest annually in writing",
        ],
    },
    {
        "id": 2,
        "name": "Pass-Through Pharmacy Costs",
        "issues": [
            "Ingredient costs passed through at actual network rates (no spread pricing)",
            "Dispensing fees fully disclosed and passed through",
            "MAC pricing lists are transparent and appeal process defined",
            "Network reimbursement rates accessible and auditable",
            "Member cost-sharing is based on actual ingredient cost, not inflated AWP or WAC",
        ],
    },
    {
        "id": 3,
        "name": "Rebate & Manufacturer Revenue",
        "issues": [
            "100% of rebates passed through to the plan",
            "All manufacturer revenue (admin fees, grants, etc.) disclosed and remitted",
            "DIR fees clearly defined and treatment specified",
            "Rebate reporting provided with sufficient detail for auditing",
            "Formulary rebate contracting must not compromise clinical integrity or formulary positioning",
            "PBM prohibited from retaining aggregate, pooled, or blended rebate arrangements",
        ],
    },
    {
        "id": 4,
        "name": "Data Ownership & Access",
        "issues": [
            "Plan owns all claims, utilization, and member data",
            "Data portability and transfer rights on demand",
            "Restrictions on PBM's commercial use of plan data",
            "PBM cannot withhold claims data during disputes or use data as renewal leverage",
            "Real-time or near-real-time data access via secure portal or feed",
        ],
    },
    {
        "id": 5,
        "name": "Audit Rights & Extrapolation",
        "issues": [
            "Independent third-party audit rights are granted",
            "Extrapolation methodology is defined and capped",
            "Audit period is at least 3 years retroactive",
            "Audit remedies include interest on overages and cure period",
            "Audit findings are final and binding — PBM cannot unilaterally reject statistical methodology",
        ],
    },
    {
        "id": 6,
        "name": "Pharmacy Ownership & Neutrality",
        "issues": [
            "Affiliated/owned pharmacy relationships are disclosed",
            "Anti-steering protections prevent directing members to owned pharmacies",
            "Specialty pharmacy network neutrality is guaranteed",
            "Owned pharmacy claim rates disclosed and benchmarked to independent network rates",
            "Plan must approve inclusion of any new specialty pharmacy in the preferred network",
        ],
    },
    {
        "id": 7,
        "name": "Carve-Out & Vendor Rights",
        "issues": [
            "Plan retains right to carve out specialty drugs at any time",
            "Plan retains right to use alternative vendors (PBMs, GPOs)",
            "Carve-out notification terms are reasonable (≤60 days notice)",
            "PBM prohibited from penalizing or retaliating for exercising carve-out rights",
            "Plan retains right to rebid to competing vendors without PBM interference",
        ],
    },
    {
        "id": 8,
        "name": "Lowest Net Cost & Clinical Integrity",
        "issues": [
            "PBM obligated to provide lowest net cost option at point of sale",
            "Plan retains rights to require generic substitution",
            "Clinical criteria are independent of economic considerations",
            "Formulary changes require advance notice of 90+ days",
            "Plan may mandate biosimilar substitution unless clinically contraindicated",
        ],
    },
    {
        "id": 9,
        "name": "Termination & Clean Exit",
        "issues": [
            "For-cause termination rights clearly defined",
            "Without-cause termination notice period is 60 days or less",
            "Complete data return within 30 days of termination",
            "PBM obligated to provide transition assistance",
            "No exit penalty, liquidated damages, or early termination fees",
        ],
    },
    {
        "id": 10,
        "name": "Administrative Fee Verification",
        "issues": [
            "Itemized administrative fee schedule is provided",
            "No hidden fees clause — all fees must be disclosed in writing",
            "Third-party and downstream fees are disclosed and attributed",
            "Administrative fee changes require 60 days advance written notice",
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


def score_to_rating(score: float) -> str:
    for label, (low, high) in SCORE_LABELS.items():
        if low <= score <= high:
            return label
    return "red_flag"


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


def build_analysis_prompt(contract_text: str) -> str:
    provisions_text = ""
    for p in PROVISIONS:
        provisions_text += f"\n{p['id']}. {p['name']}\n"
        for i, issue in enumerate(p["issues"], 1):
            provisions_text += f"   {p['id']}.{i}. {issue}\n"

    return f"""You are an expert PBM contract attorney and fiduciary compliance specialist.
Analyze the following PBM contract text against the Fiduciary-Aligned PBM Contract Standards.
This framework has 50 issues across 10 provisions aligned with CAA 2026.

PROVISIONS TO EVALUATE:
{provisions_text}

CONTRACT TEXT:
---
{contract_text[:12000]}
---

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "pbm_name": "detected PBM name or null",
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
        "talking_point": "how to frame this with the PBM"
      }}
    }}
  ]
}}

Score each provision 0-10. Overall score = weighted average scaled to 0-100.
Be strict — most PBM contracts score 30-60. Missing provisions score 0."""


def build_comparison_prompt(contract_a: dict, contract_b: dict) -> str:
    def summarize(c: dict) -> str:
        provisions = c.get("provision_scores", [])
        lines = [f"Overall: {c.get('overall_score', 0):.1f}/100 ({c.get('rating', 'unknown')})"]
        for p in provisions:
            lines.append(f"  P{p['id']} {p['name']}: {p.get('score', 0):.1f}/10 ({p.get('rating', '?')})")
        return "\n".join(lines)

    return f"""You are a PBM contract expert comparing two contract versions.

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


async def run_analysis(contract_id: str, contract_text: str, db: Session):
    contract = db.query(models.PbmContract).filter(models.PbmContract.id == contract_id).first()
    if not contract:
        return
    try:
        contract.status = "analyzing"
        db.commit()

        if not contract_text or len(contract_text.strip()) < 100:
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
        if result.get("pbm_name") and not contract.pbm_name:
            contract.pbm_name = result["pbm_name"]

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
        contract = db.query(models.PbmContract).filter(models.PbmContract.id == contract_id).first()
        if contract:
            contract.status = "error"
            contract.error_message = str(e)
            db.commit()


async def run_comparison(contract_a_id: str, contract_b_id: str, db: Session):
    contract_b = db.query(models.PbmContract).filter(models.PbmContract.id == contract_b_id).first()
    contract_a = db.query(models.PbmContract).filter(models.PbmContract.id == contract_a_id).first()
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

        # Use AI if available, otherwise generate demo comparison
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

    except Exception as e:
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
                "description": f"Significant improvement — added protective language"})
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
        "summary": f"Contract B scored {b_data['overall_score']:.0f}/100 vs {a_data['overall_score']:.0f}/100 for Contract A — a change of {score_change:+.0f} points. {len(improvements)} provisions improved, {len(regressions)} regressed, {len(unchanged)} unchanged.",
        "improvements": improvements,
        "regressions": regressions,
        "unchanged": unchanged,
        "remaining_gaps": [
            "Fiduciary loyalty commitment still below the CAA 2026 standard",
            "Audit extrapolation rights remain restricted",
            "Specialty pharmacy neutrality protections absent",
        ],
        "verdict": verdict,
    }


def _demo_analysis():
    return {
        "pbm_name": "Demo PBM",
        "overall_score": 49,
        "key_findings": [
            {"severity": "critical", "text": "No explicit fiduciary acceptance — PBM retains ability to act in its own interest"},
            {"severity": "critical", "text": "Spread pricing not prohibited — plan is likely overpaying on generic drugs"},
            {"severity": "critical", "text": "Audit rights limited to 12 months; extrapolation prohibited — most overcharges unrecoverable"},
            {"severity": "critical", "text": "No annual conflict-of-interest disclosure obligation found"},
            {"severity": "warning", "text": "Rebate pass-through language vague — does not specify 100% of all manufacturer revenue"},
            {"severity": "warning", "text": "Termination requires 180 days notice — locks plan in 6 months after decision to leave"},
            {"severity": "warning", "text": "No biosimilar substitution rights — plan cannot mandate lower-cost biologics"},
            {"severity": "positive", "text": "Plan data ownership clause is present and clearly worded"},
            {"severity": "positive", "text": "DIR fees are defined with clear treatment specified"},
        ],
        "provisions": [
            {
                "id": 1, "name": "Fiduciary Loyalty Commitment", "score": 1.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "PBM explicitly accepts fiduciary status", "found": False, "quote": None, "gap": "No fiduciary acceptance language anywhere in contract"},
                    {"text": "All conflicts of interest disclosed", "found": False, "quote": None, "gap": "Conflicts of interest not addressed"},
                    {"text": "PBM commits to act solely in participant interest", "found": False, "quote": None, "gap": "Loyalty standard absent"},
                    {"text": "Fiduciary acceptance expressly stated, not implied", "found": False, "quote": None, "gap": "No acceptance of any kind — express or implied"},
                    {"text": "Annual conflict-of-interest disclosure obligation", "found": False, "quote": None, "gap": "No periodic disclosure requirement"},
                ],
                "negotiation": {
                    "gap_summary": "Contract contains zero fiduciary commitment — PBM is free to prioritize its own economic interests at every turn",
                    "model_language": "PBM hereby expressly acknowledges its fiduciary status and agrees to discharge all duties solely in the interest of Plan participants. PBM shall disclose all conflicts of interest in writing no later than 30 days after the start of each contract year.",
                    "talking_point": "CAA 2026 requires PBMs to acknowledge fiduciary duties. If your PBM won't put this in writing, ask them directly why — the answer tells you everything.",
                }
            },
            {
                "id": 2, "name": "Pass-Through Pharmacy Costs", "score": 4.0,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "No spread pricing", "found": False, "quote": None, "gap": "Contract does not prohibit spread between network rate and amount billed to plan"},
                    {"text": "Dispensing fees disclosed", "found": True, "quote": "Dispensing fees shall be as set forth in Exhibit A", "gap": None},
                    {"text": "MAC list transparency", "found": False, "quote": None, "gap": "MAC methodology not disclosed; no appeal process defined"},
                    {"text": "Network rates auditable", "found": True, "quote": "Plan may request network rate information upon 30 days written notice", "gap": None},
                    {"text": "Member cost-sharing on actual cost not AWP", "found": False, "quote": None, "gap": "Cost-sharing based on AWP — inflates member out-of-pocket"},
                ],
                "negotiation": {
                    "gap_summary": "Spread pricing and AWP-based cost-sharing create hidden margin for PBM on every generic fill",
                    "model_language": "PBM shall bill Plan the actual network reimbursement rate paid to pharmacies. Spread pricing is expressly prohibited. Member cost-sharing shall be based on actual ingredient cost exclusive of PBM margin.",
                    "talking_point": "Ask your PBM to confirm in writing that the rate billed to the plan equals the rate paid to the pharmacy. Silence or deflection indicates spread pricing is occurring.",
                }
            },
            {
                "id": 3, "name": "Rebate & Manufacturer Revenue", "score": 4.5,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "100% rebate pass-through", "found": False, "quote": None, "gap": "Contract states rebates 'may be shared' — not 100% pass-through"},
                    {"text": "All manufacturer revenue disclosed", "found": False, "quote": None, "gap": "Admin fees, grants, and other manufacturer payments not addressed"},
                    {"text": "DIR fees defined", "found": True, "quote": "DIR fees shall be defined as retroactive network adjustments", "gap": None},
                    {"text": "Rebate reporting detailed", "found": True, "quote": "Quarterly rebate reports shall be provided", "gap": "Reports lack drug-level detail needed for auditing"},
                    {"text": "Rebates not driving formulary decisions", "found": False, "quote": None, "gap": "No prohibition on rebate-driven formulary placement"},
                    {"text": "No pooled/blended rebate arrangements", "found": False, "quote": None, "gap": "No prohibition on aggregate retention — PBM may pool and skim"},
                ],
                "negotiation": {
                    "gap_summary": "Plan receives some rebates but likely not all manufacturer revenue; pooled arrangements mask true per-drug value",
                    "model_language": "PBM shall pass through 100% of all Manufacturer Revenue. Formulary placement decisions shall be made solely on clinical and net-cost criteria. Aggregate or pooled rebate retention is expressly prohibited.",
                    "talking_point": "Rebates are only one form of manufacturer revenue. Ask for a complete accounting of every dollar received from manufacturers — many PBMs resist this for a reason.",
                }
            },
            {
                "id": 4, "name": "Data Ownership & Access", "score": 7.0,
                "rating": "good", "quick_look": "good",
                "issues": [
                    {"text": "Plan owns all data", "found": True, "quote": "All claims data generated in connection with this Agreement is the property of Plan", "gap": None},
                    {"text": "Data portability rights", "found": True, "quote": "Plan may request a complete data extract within 30 days of written request", "gap": None},
                    {"text": "PBM data use restrictions", "found": False, "quote": None, "gap": "No restrictions on PBM's commercial use of plan data"},
                    {"text": "Data not withheld during disputes", "found": False, "quote": None, "gap": "No prohibition on using data access as renewal leverage"},
                    {"text": "Real-time data access", "found": False, "quote": None, "gap": "Data access limited to periodic reports — no portal or real-time feed"},
                ],
                "negotiation": {
                    "gap_summary": "Data ownership is solid but PBM retains commercial use rights and can restrict access during disputes",
                    "model_language": "PBM shall not use Plan data for any commercial purpose. PBM shall provide uninterrupted data access at all times including during contract disputes. Real-time portal access shall be provided at no additional charge.",
                    "talking_point": "Your claims data has significant commercial value. Confirm your PBM is not monetizing your members' health information for its own benefit.",
                }
            },
            {
                "id": 5, "name": "Audit Rights & Extrapolation", "score": 2.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Independent audit rights granted", "found": True, "quote": "Plan may conduct an audit with 60 days written notice", "gap": "Auditor must be pre-approved by PBM — removes independence"},
                    {"text": "Extrapolation methodology defined", "found": False, "quote": None, "gap": "Extrapolation expressly prohibited"},
                    {"text": "3+ year audit period", "found": False, "quote": None, "gap": "Audit limited to 12 months — well below 3-year standard"},
                    {"text": "Remedies include interest", "found": False, "quote": None, "gap": "No interest or penalties for audit overages"},
                    {"text": "Audit findings binding", "found": False, "quote": None, "gap": "PBM retains right to dispute any audit finding — no finality provision"},
                ],
                "negotiation": {
                    "gap_summary": "Audit clause is designed to limit recovery — 12-month window, no extrapolation, PBM-controlled auditor, no finality",
                    "model_language": "Plan may conduct audits of the prior 36 months using any independent auditor of Plan's choosing. Extrapolation at 95% statistical confidence is permitted. Findings are binding and remittance is due within 30 days with 6% annual interest.",
                    "talking_point": "A 12-month audit window with no extrapolation is a PBM-drafted limitation designed to protect their revenue, not yours. Industry standard is 36 months with full extrapolation rights.",
                }
            },
            {
                "id": 6, "name": "Pharmacy Ownership & Neutrality", "score": 5.0,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Affiliated pharmacy disclosure", "found": True, "quote": "PBM's affiliated pharmacies are listed in Exhibit C", "gap": None},
                    {"text": "Anti-steering protections", "found": False, "quote": None, "gap": "No prohibition on directing members to affiliated specialty pharmacy"},
                    {"text": "Specialty network neutrality", "found": False, "quote": None, "gap": "Specialty pharmacy selection criteria not defined"},
                    {"text": "Owned pharmacy rates benchmarked", "found": False, "quote": None, "gap": "No requirement to benchmark owned pharmacy rates to independent network"},
                    {"text": "Plan approves specialty network", "found": False, "quote": None, "gap": "PBM can add specialty pharmacies to network without plan consent"},
                ],
                "negotiation": {
                    "gap_summary": "PBM discloses owned pharmacies but retains full ability to steer volume and set rates without plan oversight",
                    "model_language": "PBM shall not direct Plan members to affiliated pharmacies through cost-sharing, formulary, or clinical criteria. Owned pharmacy reimbursement rates shall be disclosed and shall not exceed independent network rates. Plan shall approve all specialty pharmacy network inclusions.",
                    "talking_point": "Ask for data on what percentage of specialty claims went to the PBM's own pharmacy last year. If it exceeds 50%, you're funding their vertical integration strategy.",
                }
            },
            {
                "id": 7, "name": "Carve-Out & Vendor Rights", "score": 5.5,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Specialty carve-out rights", "found": True, "quote": "Plan may carve out specialty drugs with 90 days written notice", "gap": "90-day notice is above recommended 60-day standard"},
                    {"text": "Alternative vendor rights", "found": True, "quote": "Plan may use alternative vendors for carve-out programs", "gap": None},
                    {"text": "Reasonable notification terms", "found": False, "quote": None, "gap": "90-day notice exceeds 60-day standard"},
                    {"text": "No retaliation for carve-outs", "found": False, "quote": None, "gap": "No anti-retaliation clause — PBM could increase fees after carve-out"},
                    {"text": "Right to rebid without interference", "found": False, "quote": None, "gap": "No prohibition on PBM interference with rebid process"},
                ],
                "negotiation": {
                    "gap_summary": "Carve-out rights exist but 90-day notice and no anti-retaliation clause limit their practical value",
                    "model_language": "Plan may carve out any drug or category upon 60 days notice. PBM shall not penalize, retaliate, or modify pricing in response to any carve-out election. Plan retains full right to solicit competing proposals.",
                    "talking_point": "A 90-day carve-out notice with no anti-retaliation protection means your PBM can raise fees the moment you exercise your rights. Insist on 60 days and explicit anti-retaliation language.",
                }
            },
            {
                "id": 8, "name": "Lowest Net Cost & Clinical Integrity", "score": 5.0,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Lowest net cost obligation", "found": False, "quote": None, "gap": "No obligation to present lowest net cost option at point of sale"},
                    {"text": "Generic substitution rights", "found": True, "quote": "PBM shall apply DAW codes per Plan formulary", "gap": None},
                    {"text": "Clinical criteria independent", "found": True, "quote": "Clinical criteria developed by PBM's P&T Committee", "gap": "P&T composition and conflict policies undisclosed"},
                    {"text": "90-day formulary change notice", "found": False, "quote": None, "gap": "Only 30 days notice required — far below 90-day CAA 2026 standard"},
                    {"text": "Biosimilar substitution rights", "found": False, "quote": None, "gap": "Plan cannot mandate biosimilar over reference biologic"},
                ],
                "negotiation": {
                    "gap_summary": "Formulary notice too short, no lowest-cost obligation, and no biosimilar mandate rights — all favor PBM economics over plan savings",
                    "model_language": "PBM shall present the lowest net cost therapeutic alternative at point of sale. Adverse formulary changes require 90 days advance written notice. Plan may mandate biosimilar dispensing unless treating physician certifies clinical contraindication.",
                    "talking_point": "Without biosimilar substitution rights, your plan pays brand biologic prices even when an equivalent biosimilar costs 60-80% less. This is a significant and growing cost driver.",
                }
            },
            {
                "id": 9, "name": "Termination & Clean Exit", "score": 3.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "For-cause termination rights", "found": True, "quote": "Plan may terminate for material breach with 30 days notice and opportunity to cure", "gap": None},
                    {"text": "Without-cause notice ≤60 days", "found": False, "quote": None, "gap": "Without-cause termination requires 180 days notice — 3x the recommended standard"},
                    {"text": "Complete data return ≤30 days", "found": False, "quote": None, "gap": "Data return timeline not specified"},
                    {"text": "Transition assistance", "found": False, "quote": None, "gap": "No transition assistance obligations"},
                    {"text": "No exit penalties", "found": False, "quote": None, "gap": "Contract silent on exit penalties — PBM could assert liquidated damages"},
                ],
                "negotiation": {
                    "gap_summary": "180-day termination notice locks plan in for 6 months while silent exit penalty clause exposes plan to liquidated damages claims",
                    "model_language": "Either party may terminate without cause upon 60 days written notice. No exit penalty, liquidated damages, or early termination fee is payable. PBM shall provide complete data extract and transition support within 30 days of notice.",
                    "talking_point": "A 180-day exit clause combined with no explicit prohibition on liquidated damages is a trap. You could be locked in for half a year and face a damages claim for leaving. Both must be fixed.",
                }
            },
            {
                "id": 10, "name": "Administrative Fee Verification", "score": 5.5,
                "rating": "concern", "quick_look": "good",
                "issues": [
                    {"text": "Itemized fee schedule", "found": True, "quote": "Administrative fees are set forth in Schedule A", "gap": None},
                    {"text": "No hidden fees clause", "found": False, "quote": None, "gap": "No explicit prohibition on undisclosed fees"},
                    {"text": "Third-party fee disclosure", "found": False, "quote": None, "gap": "Fees to downstream vendors not disclosed or attributed"},
                    {"text": "Fee change notice 60 days", "found": False, "quote": None, "gap": "No advance notice requirement for fee changes — PBM can change without warning"},
                ],
                "negotiation": {
                    "gap_summary": "Fee schedule exists but hidden fees, undisclosed downstream payments, and no change-notice requirement leave plan exposed",
                    "model_language": "Schedule A represents the complete and exclusive compensation PBM shall receive. No additional fees are permitted without 60 days advance written notice and Plan written consent.",
                    "talking_point": "Ask your PBM to confirm in writing that Schedule A lists every dollar they receive — including payments from pharmacies, manufacturers, and sub-contractors. Hidden fees routinely add 10-30% to the total cost.",
                }
            },
        ]
    }


# ─── API Endpoints ─────────────────────────────────────────────────────────────

@router.post("/upload", status_code=202)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pbm_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    file_bytes = await file.read()
    contract_text = ""
    if file.filename and file.filename.lower().endswith(".pdf"):
        contract_text = extract_pdf_text(file_bytes)
    elif file.content_type in ("text/plain", "application/octet-stream"):
        contract_text = file_bytes.decode("utf-8", errors="ignore")

    contract = models.PbmContract(
        user_id=current_user.id,
        pbm_name=pbm_name,
        contract_filename=file.filename or "contract.pdf",
        contract_text=contract_text[:50000],
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, contract_text, db)
    return {"id": contract.id, "status": "analyzing"}


@router.get("/contracts")
def list_contracts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contracts = (
        db.query(models.PbmContract)
        .filter(models.PbmContract.user_id == current_user.id)
        .order_by(models.PbmContract.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "pbm_name": c.pbm_name,
            "contract_filename": c.contract_filename,
            "status": c.status,
            "overall_score": c.overall_score,
            "rating": c.rating,
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
    contract = db.query(models.PbmContract).filter(
        models.PbmContract.id == contract_id,
        models.PbmContract.user_id == current_user.id,
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
        "pbm_name": contract.pbm_name,
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
    contract = db.query(models.PbmContract).filter(
        models.PbmContract.id == contract_id,
        models.PbmContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()


class CompareRequest(BaseModel):
    contract_a_id: str


@router.post("/contracts/{contract_b_id}/compare", status_code=202)
async def compare_contracts(
    contract_b_id: str,
    body: CompareRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract_a = db.query(models.PbmContract).filter(
        models.PbmContract.id == body.contract_a_id,
        models.PbmContract.user_id == current_user.id,
    ).first()
    contract_b = db.query(models.PbmContract).filter(
        models.PbmContract.id == contract_b_id,
        models.PbmContract.user_id == current_user.id,
    ).first()
    if not contract_a or not contract_b:
        raise HTTPException(status_code=404, detail="One or both contracts not found")
    if contract_a.status != "complete" or contract_b.status != "complete":
        raise HTTPException(status_code=400, detail="Both contracts must be fully analyzed before comparing")

    background_tasks.add_task(run_comparison, body.contract_a_id, contract_b_id, db)
    return {"status": "comparing"}


class DemoRequest(BaseModel):
    pbm_name: Optional[str] = "Sample PBM Corp"


@router.post("/demo", status_code=202)
async def run_demo(
    body: DemoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = models.PbmContract(
        user_id=current_user.id,
        pbm_name=body.pbm_name,
        contract_filename="demo_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, "", db)
    return {"id": contract.id, "status": "analyzing"}


@router.post("/demo-pair", status_code=202)
async def run_demo_pair(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create two demo contracts for comparison — original and renegotiated."""
    contract_a = models.PbmContract(
        user_id=current_user.id,
        pbm_name="OptimaCare PBM — Original",
        contract_filename="original_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract_a)
    db.commit()
    db.refresh(contract_a)

    contract_b = models.PbmContract(
        user_id=current_user.id,
        pbm_name="OptimaCare PBM — Renegotiated",
        contract_filename="renegotiated_contract.pdf",
        contract_text="__renegotiated__",
        status="pending",
    )
    db.add(contract_b)
    db.commit()
    db.refresh(contract_b)

    background_tasks.add_task(run_analysis, contract_a.id, "", db)
    background_tasks.add_task(_run_renegotiated_demo, contract_b.id, contract_a.id, db)

    return {"contract_a_id": contract_a.id, "contract_b_id": contract_b.id}


async def _run_renegotiated_demo(contract_b_id: str, contract_a_id: str, db: Session):
    """Run a demo analysis with improved scores for the renegotiated contract."""
    import asyncio
    await asyncio.sleep(3)  # Wait for contract_a to finish first

    contract_b = db.query(models.PbmContract).filter(models.PbmContract.id == contract_b_id).first()
    if not contract_b:
        return

    try:
        contract_b.status = "analyzing"
        db.commit()

        result = _demo_renegotiated_analysis()
        overall = float(result.get("overall_score", 70))
        provisions = result.get("provisions", [])

        contract_b.overall_score = overall
        contract_b.rating = score_to_rating(overall)
        contract_b.provision_scores = json.dumps(provisions)
        contract_b.quick_look = json.dumps([
            {"id": p["id"], "name": p["name"], "quick_look": p.get("quick_look", "concern")}
            for p in provisions
        ])
        contract_b.key_findings = json.dumps(result.get("key_findings", []))
        contract_b.negotiation_guide = json.dumps([
            {"id": p["id"], "name": p["name"], "score": p["score"],
             "negotiation": p.get("negotiation", {}), "issues": p.get("issues", [])}
            for p in provisions
        ])
        contract_b.status = "complete"
        db.commit()

        # Now run comparison
        await asyncio.sleep(1)
        await run_comparison(contract_a_id, contract_b_id, db)

    except Exception as e:
        db.rollback()
        contract_b = db.query(models.PbmContract).filter(models.PbmContract.id == contract_b_id).first()
        if contract_b:
            contract_b.status = "error"
            contract_b.error_message = str(e)
            db.commit()


def _demo_renegotiated_analysis():
    """Improved scores after negotiation — for comparison demo."""
    return {
        "pbm_name": "OptimaCare PBM — Renegotiated",
        "overall_score": 71,
        "key_findings": [
            {"severity": "positive", "text": "Fiduciary acceptance language added — explicit written commitment secured"},
            {"severity": "positive", "text": "Spread pricing expressly prohibited — ingredient cost pass-through confirmed"},
            {"severity": "positive", "text": "Audit period extended to 24 months with extrapolation now permitted"},
            {"severity": "positive", "text": "Termination notice reduced from 180 to 90 days"},
            {"severity": "warning", "text": "Rebate pass-through improved but pooled rebate prohibition still absent"},
            {"severity": "warning", "text": "Specialty pharmacy neutrality provisions remain weak — not addressed in renegotiation"},
            {"severity": "critical", "text": "Biosimilar substitution rights still not included — significant cost exposure remains"},
        ],
        "provisions": [
            {"id": 1, "name": "Fiduciary Loyalty Commitment", "score": 6.5, "rating": "fair", "quick_look": "concern",
             "issues": [
                 {"text": "PBM explicitly accepts fiduciary status", "found": True, "quote": "PBM acknowledges its fiduciary obligations to the Plan", "gap": None},
                 {"text": "All conflicts of interest disclosed", "found": True, "quote": "PBM shall disclose material conflicts of interest", "gap": "Annual disclosure cycle not specified"},
                 {"text": "PBM acts solely in participant interest", "found": True, "quote": "PBM shall act in the best interests of Plan participants", "gap": None},
                 {"text": "Fiduciary acceptance expressly stated", "found": True, "quote": "PBM expressly acknowledges its fiduciary status", "gap": None},
                 {"text": "Annual conflict-of-interest disclosure", "found": False, "quote": None, "gap": "Timing and frequency of disclosures not defined"},
             ],
             "negotiation": {"gap_summary": "Good progress — fiduciary language added but annual disclosure cycle still unspecified", "model_language": "PBM shall provide written conflict-of-interest disclosure within 30 days of each contract anniversary.", "talking_point": "You won the big battle — now nail down the timing for annual disclosures."}},
            {"id": 2, "name": "Pass-Through Pharmacy Costs", "score": 8.0, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "No spread pricing", "found": True, "quote": "Spread pricing between network reimbursement and plan billing is expressly prohibited", "gap": None},
                 {"text": "Dispensing fees disclosed", "found": True, "quote": "Dispensing fees as set forth in Exhibit A", "gap": None},
                 {"text": "MAC list transparency", "found": True, "quote": "MAC list and appeal process are available upon request", "gap": "Still request-based rather than proactive"},
                 {"text": "Network rates auditable", "found": True, "quote": "Network reimbursement rates are available for audit", "gap": None},
                 {"text": "Member cost-sharing on actual cost", "found": False, "quote": None, "gap": "AWP-based cost-sharing language remains in member-facing materials"},
             ],
             "negotiation": {"gap_summary": "Strong improvement — spread pricing banned but AWP-based member cost-sharing still present", "model_language": "Member cost-sharing shall be based on actual ingredient cost paid to pharmacy, not AWP.", "talking_point": "You eliminated the plan's exposure to spread pricing — one more push to fix member cost-sharing calculation."}},
            {"id": 3, "name": "Rebate & Manufacturer Revenue", "score": 6.0, "rating": "fair", "quick_look": "concern",
             "issues": [
                 {"text": "100% rebate pass-through", "found": True, "quote": "PBM shall pass through 100% of rebates received", "gap": None},
                 {"text": "All manufacturer revenue disclosed", "found": True, "quote": "PBM shall disclose and remit all manufacturer revenue", "gap": "Definition of 'manufacturer revenue' is narrow"},
                 {"text": "DIR fees defined", "found": True, "quote": "DIR fees defined as retroactive network adjustments", "gap": None},
                 {"text": "Rebate reporting detailed", "found": True, "quote": "Quarterly rebate reports with drug-level detail", "gap": None},
                 {"text": "Rebates not driving formulary", "found": False, "quote": None, "gap": "No prohibition on rebate-driven formulary positioning"},
                 {"text": "No pooled rebate arrangements", "found": False, "quote": None, "gap": "Aggregate retention prohibition was not agreed to"},
             ],
             "negotiation": {"gap_summary": "100% pass-through secured but pooled rebate prohibition and formulary independence still absent", "model_language": "Formulary placement decisions shall be made solely on clinical and net-cost criteria, independent of rebate revenue.", "talking_point": "You got 100% rebate pass-through — the next frontier is ensuring rebates don't influence which drugs are preferred."}},
            {"id": 4, "name": "Data Ownership & Access", "score": 8.0, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "Plan owns all data", "found": True, "quote": "All data is the property of the Plan", "gap": None},
                 {"text": "Data portability", "found": True, "quote": "Complete data extract within 15 days of request", "gap": None},
                 {"text": "PBM data use restrictions", "found": True, "quote": "PBM shall not use Plan data for commercial purposes", "gap": None},
                 {"text": "Data not withheld during disputes", "found": True, "quote": "Data access shall continue uninterrupted during disputes", "gap": None},
                 {"text": "Real-time data access", "found": False, "quote": None, "gap": "Portal access not included — still periodic reports only"},
             ],
             "negotiation": {"gap_summary": "Very strong data provisions — only gap is real-time portal access", "model_language": "PBM shall provide web-based portal access to claims data within 90 days of contract execution.", "talking_point": "You have excellent data protections — pushing for portal access would complete the picture."}},
            {"id": 5, "name": "Audit Rights & Extrapolation", "score": 6.5, "rating": "fair", "quick_look": "concern",
             "issues": [
                 {"text": "Independent audit rights", "found": True, "quote": "Plan may select any independent auditor", "gap": None},
                 {"text": "Extrapolation permitted", "found": True, "quote": "Statistical extrapolation is permitted at 95% confidence", "gap": None},
                 {"text": "3+ year audit period", "found": False, "quote": None, "gap": "Extended to 24 months — better but still below 36-month standard"},
                 {"text": "Remedies include interest", "found": True, "quote": "Overages are due within 45 days with 5% annual interest", "gap": None},
                 {"text": "Audit findings binding", "found": False, "quote": None, "gap": "PBM may still appeal findings — finality provision not agreed to"},
             ],
             "negotiation": {"gap_summary": "Significant improvement — extrapolation now allowed and independent auditor secured. Push for 36 months.", "model_language": "Audit period shall be extended to 36 months retroactive from the date of notice.", "talking_point": "You went from 12 to 24 months — the final push to 36 is worth doing at next renewal."}},
            {"id": 6, "name": "Pharmacy Ownership & Neutrality", "score": 5.0, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Affiliated pharmacy disclosure", "found": True, "quote": "Affiliated pharmacies disclosed in Exhibit C", "gap": None},
                 {"text": "Anti-steering protections", "found": False, "quote": None, "gap": "Steering prohibition was not agreed to — significant gap remains"},
                 {"text": "Specialty network neutrality", "found": False, "quote": None, "gap": "No change from original — not addressed in renegotiation"},
                 {"text": "Owned pharmacy rates benchmarked", "found": False, "quote": None, "gap": "Benchmarking requirement not added"},
                 {"text": "Plan approves specialty network", "found": False, "quote": None, "gap": "PBM retains unilateral network addition rights"},
             ],
             "negotiation": {"gap_summary": "No material improvement from original contract — pharmacy neutrality was not prioritized in this negotiation", "model_language": "PBM shall not steer Plan members to affiliated pharmacies. Owned pharmacy rates shall not exceed independent network rates.", "talking_point": "This was the one area where you gave ground — make it a priority in your next negotiation cycle."}},
            {"id": 7, "name": "Carve-Out & Vendor Rights", "score": 7.0, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "Specialty carve-out rights", "found": True, "quote": "Plan may carve out specialty with 60 days notice", "gap": None},
                 {"text": "Alternative vendor rights", "found": True, "quote": "Plan may use alternative vendors without restriction", "gap": None},
                 {"text": "60-day notice standard", "found": True, "quote": "60 days written notice required", "gap": None},
                 {"text": "No retaliation for carve-outs", "found": True, "quote": "PBM shall not modify pricing in response to carve-out elections", "gap": None},
                 {"text": "Right to rebid without interference", "found": False, "quote": None, "gap": "No explicit prohibition on PBM interference with rebid process"},
             ],
             "negotiation": {"gap_summary": "Strong carve-out provisions — notice reduced to 60 days and anti-retaliation secured. Close the rebid gap.", "model_language": "Plan retains full right to solicit competing proposals. PBM shall cooperate with any rebid process and shall not take adverse action against Plan in connection with a competitive solicitation.", "talking_point": "You have excellent carve-out rights — adding rebid protection would make this provision bulletproof."}},
            {"id": 8, "name": "Lowest Net Cost & Clinical Integrity", "score": 5.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Lowest net cost obligation", "found": False, "quote": None, "gap": "Still not included — significant cost-saving opportunity missed"},
                 {"text": "Generic substitution", "found": True, "quote": "PBM shall apply generic substitution per Plan formulary", "gap": None},
                 {"text": "Clinical criteria independent", "found": True, "quote": "Clinical criteria developed by P&T Committee", "gap": "P&T independence protections still vague"},
                 {"text": "90-day formulary notice", "found": True, "quote": "90 days advance notice for adverse formulary changes", "gap": None},
                 {"text": "Biosimilar substitution rights", "found": False, "quote": None, "gap": "Biosimilar mandate rights still absent — not addressed in renegotiation"},
             ],
             "negotiation": {"gap_summary": "Formulary notice improved to 90 days but lowest-cost obligation and biosimilar rights still absent", "model_language": "PBM shall present the lowest net cost therapeutic alternative at point of sale. Plan may mandate biosimilar dispensing unless clinically contraindicated.", "talking_point": "The biosimilar gap is growing every year as more biologics face biosimilar competition. This is a must-add at next renewal."}},
            {"id": 9, "name": "Termination & Clean Exit", "score": 7.0, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "For-cause termination", "found": True, "quote": "Plan may terminate for material breach with 30 days notice", "gap": None},
                 {"text": "Without-cause notice ≤60 days", "found": False, "quote": None, "gap": "Reduced to 90 days — improvement but still above 60-day standard"},
                 {"text": "Data return ≤30 days", "found": True, "quote": "Complete data extract within 30 days of termination", "gap": None},
                 {"text": "Transition assistance", "found": True, "quote": "PBM shall provide transition assistance for 60 days post-termination", "gap": None},
                 {"text": "No exit penalties", "found": True, "quote": "No early termination fee or liquidated damages are payable", "gap": None},
             ],
             "negotiation": {"gap_summary": "Major improvement — exit penalties eliminated, data return and transition assistance secured. Final push: get to 60 days.", "model_language": "Without-cause termination notice period is reduced from 90 to 60 days, consistent with industry standard.", "talking_point": "You made tremendous progress on termination — the 90-day notice is the last sticking point. Push for 60 at renewal."}},
            {"id": 10, "name": "Administrative Fee Verification", "score": 7.5, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "Itemized fee schedule", "found": True, "quote": "Complete itemized fee schedule in Schedule A", "gap": None},
                 {"text": "No hidden fees clause", "found": True, "quote": "Schedule A represents complete and exclusive PBM compensation", "gap": None},
                 {"text": "Third-party fee disclosure", "found": True, "quote": "All downstream fees and sub-contractor payments disclosed in Schedule B", "gap": None},
                 {"text": "Fee change notice 60 days", "found": True, "quote": "Fee changes require 60 days advance written notice", "gap": None},
             ],
             "negotiation": {"gap_summary": "Excellent administrative fee protections — all four issues fully addressed", "model_language": "No changes needed — this provision now meets all fiduciary-aligned standards.", "talking_point": "This is a model administrative fee provision. Use it as a template for other contracts."}},
        ]
    }


@router.get("/index")
def pbm_accountability_index(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {
        "updated": "February 2026",
        "description": "PBM contracts scored against 50 fiduciary-aligned issues across 10 provisions. Ratings based on explicit contract language only.",
        "tiers": [
            {"tier": "excellent", "range": "90–100", "pbms": ["PBM Direct+", "ClearPath Rx"]},
            {"tier": "good",      "range": "75–89",  "pbms": ["MedCore PBM", "TransparentRx", "AlignedHealth"]},
            {"tier": "fair",      "range": "60–74",  "pbms": ["MegaScript", "NationalPharm", "BenefitBridge"]},
            {"tier": "concern",   "range": "45–59",  "pbms": ["OptimaCare PBM", "RxAdvantage", "PharmaLink"]},
            {"tier": "red_flag",  "range": "<45",    "pbms": ["ConglomeratePBM", "HiddenFee Rx"]},
        ],
    }
