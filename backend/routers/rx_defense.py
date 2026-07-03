"""
Kincaid IQ — Rx Defense™
AI-powered PBM contract X-Ray against 60 fiduciary risk issues across 13 provisions.
Scores contracts 0–100 and provides negotiation guidance for brokers and plan sponsors.
"""
import io
import json
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from backend.anthropic_compat import AsyncAnthropicClient as AsyncOpenAI
from openai import AsyncOpenAI as _RealAsyncOpenAI
from backend.agents.base import KIQ_VERIFY_HEADER
from pydantic import BaseModel

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.config import settings
from backend.manifest_utils import manifest_headers, register_manifest_path

register_manifest_path("/api/rx-defense/contracts/{contract_id}/redline")

router = APIRouter(prefix="/api/rx-defense", tags=["rx-defense"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)

# Real OpenAI client (NOT the Anthropic-compat shim above) — used by the
# dual-engine comparison so the same contract can be scored with GPT-5 AND
# Claude, letting the user pick whichever savings estimate they trust.
openai_native_client = _RealAsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)


def _loads_llm_json(raw: Optional[str]):
    """Parse a JSON object from an LLM response that may be wrapped in markdown
    code fences or surrounded by prose.

    The Anthropic compat shim has no native JSON mode — it only *steers* Claude
    toward JSON via the system prompt — so the model occasionally emits a
    ```json ... ``` fence or a leading sentence before the object. Plain
    json.loads then fails at char 0 and callers silently fall back to demo data.
    This helper strips fences, slices the outermost {...}, and — when the
    output was truncated mid-object — salvages the completed leading portion.
    Raises json.JSONDecodeError when no object can be recovered.
    """
    if not raw:
        raise ValueError("empty LLM content")
    s = raw.strip()
    # Strip a leading/trailing markdown code fence (```json ... ``` or ``` ... ```)
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z0-9]*\s*", "", s)
        s = re.sub(r"\s*```$", "", s).strip()
    def _as_object(parsed):
        if not isinstance(parsed, dict):
            raise ValueError(f"LLM returned non-object JSON ({type(parsed).__name__})")
        return parsed

    # 1) Strict parse.
    try:
        return _as_object(json.loads(s))
    except (json.JSONDecodeError, ValueError):
        pass

    # 2) Slice the outermost {...} (drops leading/trailing prose) and parse.
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return _as_object(json.loads(s[start:end + 1]))
        except (json.JSONDecodeError, ValueError):
            pass

    # 3) Salvage a truncated/malformed object. The 13-provision forensic JSON is
    #    large enough to be cut off mid-structure when the model hits its token
    #    budget; recovering the completed portion is far better than silently
    #    substituting demo data for the user's real contract.
    salvaged = _salvage_json_object(s)
    if salvaged is not None:
        return _as_object(salvaged)

    raise json.JSONDecodeError("no parseable JSON object in LLM output", s, 0)


def _salvage_json_object(s: str) -> Optional[dict]:
    """Best-effort recovery of a JSON object from a truncated or lightly
    malformed LLM response. Cuts the string back to the last *clean* structural
    boundary — the end of a completed nested element or a top-level member
    separator — then closes any still-open containers so a half-received
    trailing element is dropped rather than kept partially populated. Tries the
    furthest boundary first (most data recovered) and falls back to closing the
    whole balanced string. Returns None when nothing parses, so callers fall
    back exactly as they did before."""
    start = s.find("{")
    if start == -1:
        return None
    body = s[start:]

    def _balance(text: str) -> str:
        in_str = False
        escape = False
        stack: list[str] = []
        for ch in text:
            if in_str:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch in "{[":
                stack.append(ch)
            elif ch in "}]":
                if stack:
                    stack.pop()
        if in_str:
            text += '"'
        text += "".join("}" if c == "{" else "]" for c in reversed(stack))
        return text

    # Collect safe truncation points: the position right after a nested element
    # closes (a } or ] that leaves us still inside a container) and top-level
    # member separators (a comma at depth 1, cutting before the comma).
    cut_points: list[int] = []
    in_str = False
    escape = False
    depth = 0
    for i, ch in enumerate(body):
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            depth += 1
        elif ch in "}]":
            depth -= 1
            if depth >= 1:
                cut_points.append(i + 1)
        elif ch == "," and depth == 1:
            cut_points.append(i)

    for cut in sorted(set(cut_points), reverse=True) + [len(body)]:
        try:
            parsed = json.loads(_balance(body[:cut]))
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, ValueError):
            continue
    return None


PROVISIONS = [
    {
        "id": 1,
        "name": "Pricing & Reimbursement",
        "issues": [
            "AWP/WAC/NADAC benchmark opacity",
            "Spread between reimbursement benchmarks",
            "MAC list manipulation flexibility",
            "Specialty drug pricing carve-outs",
            "Dispensing fee variability asymmetry",
            "Repricing or retroactive adjustments",
        ],
    },
    {
        "id": 2,
        "name": "Spread Pricing",
        "issues": [
            "Explicit spread pricing clauses",
            "Implicit spread via reimbursement gaps",
            "Hidden spread via pharmacy clawbacks",
            "Spread non-disclosure to plan sponsor",
        ],
    },
    {
        "id": 3,
        "name": "Rebates & Manufacturer Revenue",
        "issues": [
            "PBM rebate retention rights",
            "Delayed rebate remittance timing",
            "Partial rebate pass-through structures",
            "Manufacturer contracting exclusivity control",
            "Rebate eligibility ambiguity",
            "Off-invoice rebate capture risk",
        ],
    },
    {
        "id": 4,
        "name": "Formulary Control",
        "issues": [
            "PBM unilateral formulary authority",
            "Step therapy enforcement control",
            "Exclusion list opacity",
            "Therapeutic substitution discretion",
            "Tiering manipulation incentives",
        ],
    },
    {
        "id": 5,
        "name": "Pharmacy Network Design",
        "issues": [
            "Preferred pharmacy steering",
            "Differential reimbursement across pharmacies",
            "Mail-order coercion mechanisms",
            "Limited pharmacy network transparency",
            "Spread capture via network design",
        ],
    },
    {
        "id": 6,
        "name": "Specialty Drug Management",
        "issues": [
            "Site-of-care steering restrictions",
            "White/brown bagging mandates",
            "Specialty carve-out opacity",
            "High-cost drug reimbursement manipulation",
            "Specialty rebate separation from plan sponsor",
        ],
    },
    {
        "id": 7,
        "name": "Audit Rights & Recovery",
        "issues": [
            "Limited audit scope clauses",
            "Short audit lookback windows",
            "Data access restrictions during audit",
            "Recovery limitations post-audit",
            "PBM-controlled audit methodology",
        ],
    },
    {
        "id": 8,
        "name": "Transparency & Disclosure",
        "issues": [
            '"Proprietary information" shielding used to block pricing disclosure',
            "Lack of ingredient cost disclosure",
            "Black box rebate reporting",
            "Aggregate-only reporting structures",
            "Non-itemized claim-level visibility",
        ],
    },
    {
        "id": 9,
        "name": "Performance Guarantees",
        "issues": [
            "Weak or non-binding performance quality levels (PQLs)",
            "Utilization threshold manipulation",
            "Bonus-driven misalignment incentives",
            "Penalty avoidance loopholes",
        ],
    },
    {
        "id": 10,
        "name": "Termination & Exit Barriers",
        "issues": [
            "Early termination penalties",
            "Data export restrictions upon exit",
            "Contract lock-in renewal structures",
            "Financial penalties for switching PBMs",
        ],
    },
    {
        "id": 11,
        "name": "Claim Adjudication Logic",
        "issues": [
            "Retroactive claim adjustment authority",
            "Reversal discretion without notice",
            "Pricing recalculation ambiguity",
            "Claim reprocessing opacity",
        ],
    },
    {
        "id": 12,
        "name": "Fiduciary & Legal Protections",
        "issues": [
            "Explicit fiduciary duty disclaimers",
            "Indemnification asymmetry favoring PBM",
            "Liability limitation clauses",
            "Conflict-of-interest non-disclosure",
        ],
    },
    {
        "id": 13,
        "name": "Data Ownership & Access Rights",
        "issues": [
            "PBM ownership of claims data",
            "Delayed or incomplete data access",
            "Restricted data portability/export rights",
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

    return KIQ_VERIFY_HEADER + f"""You are Rx Defense IQ — a hybrid analytical system combining MIT-level computational economics, Stanford Law contract doctrine analysis, and healthcare actuarial modeling.

SYSTEM IDENTITY:
You are simultaneously:
- A Stanford Law-trained contract theorist (ambiguity construction, fiduciary duty mapping, enforceability asymmetry, disclosure sufficiency)
- An MIT-level economic mechanism designer (incentive compatibility, principal-agent distortion, information asymmetry exploitation, rent extraction pathways)
- A healthcare actuarial intelligence system (drug pricing benchmarks, rebate flow timing, specialty cost distortion, network steering economics)

CORE MANDATE:
You do NOT summarize contracts. You reconstruct the economic architecture embedded in legal language.
You treat every PBM contract as a mechanism design system that redistributes economic value through contractual opacity.
You infer hidden incentive structures and non-obvious transfer pricing mechanisms.
You quantify economic leakage and surplus capture.
You assume asymmetric information unless disproven by explicit, binding contract language.
Treat ambiguity as financial exposure — contra proferentem analysis applies to every ambiguous clause.

ANALYTICAL FRAME — apply all three lenses simultaneously:

1. LEGAL DOCTRINE LAYER (Stanford Law):
- Contract hierarchy and incorporation by reference
- Ambiguity construction (contra proferentem implications)
- Fiduciary duty presence/absence
- Enforceability asymmetry
- Disclosure sufficiency standards

2. ECONOMIC MECHANISM LAYER (MIT PhD):
- Incentive compatibility analysis
- Principal-agent distortion identification
- Information asymmetry exploitation pathways
- Rent extraction mechanisms
- Transfer pricing opacity

3. HEALTHCARE ACTUARIAL LAYER:
- AWP/WAC/NADAC benchmark analysis
- Claims adjudication behavior patterns
- Rebate flow timing and retention
- Specialty drug cost distortion
- Network steering economics

Analyze the following PBM contract against the 60-issue Fiduciary–Economic Distortion Grid across 13 structural provision systems.

PROVISIONS & ISSUES TO EVALUATE:
{provisions_text}

CONTRACT TEXT:
---
{contract_text[:14000]}
---

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "pbm_name": "detected PBM name or null",
  "overall_score": <0-100 float>,
  "key_findings": [
    {{"severity": "critical|warning|positive", "text": "mechanism-level finding — quantify economic impact where possible"}}
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
          "text": "issue name from the 60-issue ontology",
          "found": true|false,
          "status": "Present|Partially Present|Not Present|Hidden / Ambiguous Risk",
          "severity": "Low|Medium|High|Critical",
          "mechanism_type": "Pricing distortion|Information asymmetry|Behavioral steering|Contractual lock-in|Rebate extraction|Administrative friction",
          "financial_impact": "$X,000 - $Y,000 annually or null",
          "confidence": <0-100 integer>,
          "quote": "exact contract clause verbatim or null",
          "gap": "what economic distortion or missing protection this creates — null only if fully present with no residual risk",
          "explanation": "mechanism design analysis: what economic system this clause implements, who captures surplus, and what the financial consequence is for the plan sponsor"
        }}
      ],
      "negotiation": {{
        "gap_summary": "economic mechanism description: what extraction or distortion is embedded in this provision and how it operates",
        "model_language": "model contract language that structurally closes this gap and aligns incentives",
        "talking_point": "leverage-based framing for renegotiation — what data to request and how to expose the economic distortion"
      }}
    }}
  ]
}}

SCORING RULES (apply strictly):
- Score each provision 0-10 based on plan sponsor's actual economic protection. Overall score = weighted average scaled to 0-100.
- Be structurally strict — most PBM contracts score 25-55. Contracts without fiduciary acceptance, spread prohibition, and 100% rebate pass-through cannot score above 50.
- "Hidden / Ambiguous Risk" status counts as a gap equal in severity to "Not Present."
- Critical severity issues MUST have a financial_impact estimate (dollar range, annualized).
- Confidence (0-100) reflects how clearly the issue is addressed OR OBSCURED in the contract text. Low confidence on a risk issue = elevated exposure.
- Mechanism type must be assigned to every issue — do not leave it null.
- Infer economic incentives from contract structure even when not explicitly stated."""


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


def _persist_analysis(contract, result: dict) -> None:
    """Write a parsed analysis result onto a contract's fields. Shared by the
    upload/analysis pipeline and the dual-engine engine-selection action so both
    persist identically. Always applies MODELED financial impacts first so no
    fabricated dollar figures are ever stored."""
    result = _apply_modeled_impacts(result)
    overall = float(result.get("overall_score", 45))
    # A salvaged (truncated) response can leave a structurally-incomplete trailing
    # provision; keep only fully-formed ones so downstream key access never raises
    # and no half-populated provision is persisted.
    provisions = [
        p for p in result.get("provisions", [])
        if isinstance(p, dict) and "id" in p and "name" in p and "score" in p
    ]
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


# The full 13-provision / 65-issue forensic JSON runs ~17K output tokens; the
# previous 16K cap truncated it mid-object on real contracts, causing a JSON
# parse failure and a silent fall-back to demo data. 32K leaves ~2x headroom,
# well within Claude Sonnet / GPT-5 output limits.
_ANALYSIS_MAX_TOKENS = 32000


async def _analyze_with(provider: str, contract_text: str) -> dict:
    """Run the 13-provision forensic analysis with a specific engine.
    provider='claude' → Anthropic (claude-sonnet-4-6); provider='openai' → GPT-5.
    Returns a parsed result dict; falls back to the demo analysis on empty or
    unparseable model output so a comparison always renders."""
    prompt = build_analysis_prompt(contract_text)
    if provider == "openai":
        resp = await openai_native_client.chat.completions.create(
            model="gpt-5",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_completion_tokens=_ANALYSIS_MAX_TOKENS,
            reasoning_effort="low",
        )
        raw = resp.choices[0].message.content or ""
    else:
        stream = await openai_client.chat.completions.create(
            model="claude-sonnet-4-6",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=_ANALYSIS_MAX_TOKENS,
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
        return _demo_analysis()
    try:
        return _loads_llm_json(raw)
    except (json.JSONDecodeError, ValueError):
        return _demo_analysis()


def _savings_core(prov_by_id: dict, members: int, annual_rx_spend: Optional[float]) -> dict:
    """Deterministic savings math shared by the Savings Report and the Dual-Engine
    comparison. Given per-provision scores it returns cap-anchored, 30%-hard-
    clamped savings totals plus a per-provision breakdown. Only damaging clauses
    (score < 7) contribute. This is the SINGLE source of truth for savings dollars
    — never re-implement it per surface."""
    raw_leakage = 0.0
    for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
        score = float(prov_by_id.get(pid, {}).get("score", 5.0))
        if score >= 7:
            continue
        rf = max(0.0, (10.0 - score) / 10.0)
        raw_leakage += rf * meta["pmpy"] * members
    spend_scale = _spend_cap_scale(raw_leakage, annual_rx_spend, members)

    per: dict = {}
    total_low = total_base = total_high = 0
    for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
        score = float(prov_by_id.get(pid, {}).get("score", 5.0))
        if score >= 7:
            continue
        rf = max(0.0, (10.0 - score) / 10.0)
        rate_lo, rate_base, rate_hi = _PROVISION_RECOVERY_RATE.get(pid, (0.4, 0.6, 0.8))
        annual_exposure = round(rf * meta["pmpy"] * members * spend_scale)
        save_low  = round(annual_exposure * rate_lo)
        save_base = round(annual_exposure * rate_base)
        save_high = round(annual_exposure * rate_hi)
        total_low  += save_low
        total_base += save_base
        total_high += save_high
        per[pid] = {
            "score": round(score, 1),
            "risk_fraction": round(rf, 2),
            "full_pmpy": meta["pmpy"],
            "annual_exposure": annual_exposure,
            "save_low": save_low, "save_base": save_base, "save_high": save_high,
            "rate_lo": rate_lo, "rate_base": rate_base, "rate_hi": rate_hi,
        }

    # Hard 30% ceiling on the HIGH band — only ever reduces, keeping every
    # surface provably ≤ 30% of effective Rx spend.
    cap_ceiling = _effective_rx_spend(annual_rx_spend, members) * _MAX_LEAKAGE_SHARE
    if total_high > cap_ceiling and total_high > 0:
        clamp = cap_ceiling / total_high
        total_low  = round(total_low  * clamp)
        total_base = round(total_base * clamp)
        total_high = round(total_high * clamp)
        spend_scale *= clamp
        for p in per.values():
            for k in ("annual_exposure", "save_low", "save_base", "save_high"):
                p[k] = round(p[k] * clamp)

    return {
        "spend_scale": spend_scale,
        "per": per,
        "total_low": total_low,
        "total_base": total_base,
        "total_high": total_high,
    }


async def run_analysis(contract_id: str, contract_text: str, db: Session, *, use_demo: bool = False):
    contract = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_id).first()
    if not contract:
        return
    try:
        contract.status = "analyzing"
        db.commit()

        if use_demo or not contract_text or len(contract_text.strip()) < 100:
            result = _demo_analysis()
        else:
            prompt = build_analysis_prompt(contract_text)
            stream = await openai_client.chat.completions.create(
                model="claude-sonnet-4-6",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=_ANALYSIS_MAX_TOKENS,
                stream=True,
            )
            content_parts: list[str] = []
            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    content_parts.append(delta.content)
            raw_content = "".join(content_parts)
            if not raw_content:
                import logging
                logging.warning(
                    "rx_defense: OpenAI returned null/empty content for contract %s "
                    "(likely truncated). Falling back to demo analysis.",
                    contract_id,
                )
                contract.error_message = (
                    "AI response was truncated or empty — demo analysis used as fallback."
                )
                result = _demo_analysis()
            else:
                try:
                    result = _loads_llm_json(raw_content)
                except (json.JSONDecodeError, ValueError) as parse_err:
                    import logging
                    logging.warning(
                        "rx_defense: Failed to parse OpenAI JSON for contract %s: %s. "
                        "Falling back to demo analysis.",
                        contract_id, parse_err,
                    )
                    contract.error_message = (
                        f"AI response could not be parsed ({parse_err}) — demo analysis used as fallback."
                    )
                    result = _demo_analysis()

        # Persist via the shared helper (which also applies MODELED financial
        # impacts) so the analysis pipeline and the dual-engine "use this engine"
        # action write the contract identically.
        _persist_analysis(contract, result)
        contract.status = "complete"
        db.commit()

    except Exception as e:
        db.rollback()
        contract = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_id).first()
        if contract:
            contract.status = "error"
            contract.error_message = str(e)
            db.commit()


async def run_comparison(contract_a_id: str, contract_b_id: str, db: Session):
    contract_b = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_b_id).first()
    contract_a = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_a_id).first()
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
                model="claude-opus-4-5",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                max_tokens=2000,
            )
            result = _loads_llm_json(response.choices[0].message.content)
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
        "overall_score": 36,
        "key_findings": [
            {"severity": "critical", "text": "Pricing benchmarks are opaque — AWP/WAC/NADAC spread creates material annual leakage on generics (see MODELED $ Exposure tab for a plan-specific estimate)"},
            {"severity": "critical", "text": "Spread pricing not explicitly prohibited — PBM retains margin between network reimbursement rate and amount billed to plan"},
            {"severity": "critical", "text": "Audit lookback limited to 12 months with no extrapolation — systemic overcharges across thousands of claims are structurally unrecoverable"},
            {"severity": "critical", "text": "Explicit fiduciary duty disclaimer present — PBM contractually denies any fiduciary obligation to the plan"},
            {"severity": "critical", "text": "Specialty rebates withheld at PBM level — plan not receiving full manufacturer value on high-cost drugs"},
            {"severity": "warning", "text": "Formulary authority is entirely unilateral — PBM can add/remove drugs or change tiers with 30 days notice"},
            {"severity": "warning", "text": "Mail-order mandate present — members required to use PBM-owned mail pharmacy for 90-day supplies"},
            {"severity": "warning", "text": "Termination requires 180-day notice with undefined exit penalties — market switching leverage severely constrained"},
            {"severity": "warning", "text": "Performance guarantees are non-binding aspirational targets with no financial remedy for non-performance"},
            {"severity": "positive", "text": "Plan data ownership clause is present — claims data defined as property of the plan"},
            {"severity": "positive", "text": "For-cause termination rights are clearly defined with 30-day cure period"},
        ],
        "provisions": [
            {
                "id": 1, "name": "Pricing & Reimbursement", "score": 2.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "AWP/WAC/NADAC benchmark opacity", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$40,000 - $125,000 annually", "confidence": 88, "quote": None, "gap": "Contract references 'AWP minus X%' without defining which AWP source is used — PBM selects benchmark unilaterally", "explanation": "Without a defined benchmark source, the PBM can switch between AWP databases to maximize its margin on every claim fill."},
                    {"text": "Spread between reimbursement benchmarks", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$25,000 - $75,000 annually", "confidence": 91, "quote": "Reimbursement rates shall be as set forth in the Network Rate Schedule", "gap": "Network Rate Schedule is an exhibit controlled by PBM — plan cannot verify actual pharmacy reimbursement", "explanation": "The PBM bills the plan using one benchmark and pays pharmacies using another, pocketing the spread as undisclosed margin."},
                    {"text": "MAC list manipulation flexibility", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$15,000 - $30,000 annually", "confidence": 85, "quote": None, "gap": "No MAC transparency provisions — PBM may update MAC prices without notice to exploit generic pricing gaps", "explanation": "Maximum Allowable Cost lists set the ceiling for generic reimbursement. Without transparency, PBMs can manipulate these to increase spread on generic drugs."},
                    {"text": "Specialty drug pricing carve-outs", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$30,000 - $85,000 annually", "confidence": 79, "quote": None, "gap": "Specialty pricing methodology not defined separately — lumped into standard AWP minus schedule", "explanation": "Specialty drugs are priced at 10-30x the cost of generics. Without a separate pricing methodology, the PBM has maximum economic control over the plan's highest-cost category."},
                    {"text": "Dispensing fee variability asymmetry", "found": True, "status": "Partially Present", "severity": "Medium", "mechanism_type": "Pricing distortion", "financial_impact": "$5,000 - $10,000 annually", "confidence": 72, "quote": "Dispensing fees shall be as set forth in Exhibit A attached hereto", "gap": "Exhibit A not included in base contract — PBM can update fee schedules without plan approval", "explanation": "The dispensing fee is disclosed, but since it lives in a separately controlled exhibit, the PBM can modify fees between contract years without triggering renegotiation rights."},
                    {"text": "Repricing or retroactive adjustments", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$10,000 - $25,000 annually", "confidence": 82, "quote": "PBM reserves the right to adjust claims for pricing errors or system corrections", "gap": "Retroactive adjustment clause has no time limit, no notice requirement, and no cap on adjustments", "explanation": "PBMs use retroactive repricing to claw back money from plans after claims have already been processed, often citing 'system corrections' that favor PBM economics."},
                ],
                "negotiation": {
                    "gap_summary": "Pricing architecture is entirely PBM-controlled — plan cannot verify actual pharmacy reimbursement, benchmark source, or retroactive adjustment methodology",
                    "model_language": "All claims shall be reimbursed at AWP (as defined by Medi-Span or First DataBank, Plan's election) minus the rates set forth in Schedule A. PBM shall not adjust claims retroactively without written notice to Plan within 5 business days. MAC list shall be made available to Plan upon request.",
                    "talking_point": "Ask your PBM: What is the average spread between what you bill us and what you pay pharmacies? If they can't answer, that spread is hidden income.",
                }
            },
            {
                "id": 2, "name": "Spread Pricing", "score": 1.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Explicit spread pricing clauses", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$50,000 - $135,000 annually", "confidence": 94, "quote": None, "gap": "No prohibition on spread pricing anywhere in the contract — PBM is free to retain the difference between cost and billing", "explanation": "Spread pricing is the single largest source of hidden PBM revenue. Without an explicit prohibition, the PBM is contractually permitted to charge the plan more than it pays pharmacies on every fill."},
                    {"text": "Implicit spread via reimbursement gaps", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$20,000 - $60,000 annually", "confidence": 87, "quote": "Pharmacy network reimbursement is subject to periodic adjustment at PBM's discretion", "gap": "PBM-controlled periodic adjustments create a mechanism to widen spread over time without plan notification", "explanation": "Even without explicit spread pricing language, PBMs create implicit spread by adjusting pharmacy reimbursement rates downward while maintaining plan billing rates — widening the gap with each adjustment cycle."},
                    {"text": "Hidden spread via pharmacy clawbacks", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$10,000 - $30,000 annually", "confidence": 81, "quote": "PBM may implement DIR fees and network adjustments as outlined in the Network Participation Agreement", "gap": "DIR fees and clawbacks paid by pharmacies to the PBM are not passed through to the plan — retained as additional PBM margin", "explanation": "Direct and Indirect Remuneration (DIR) fees are charges PBMs impose on pharmacies after claims are processed. These fees are not disclosed to the plan and represent a form of hidden spread capture."},
                    {"text": "Spread non-disclosure to plan sponsor", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Information asymmetry", "financial_impact": "$80,000 - $225,000 annually", "confidence": 96, "quote": None, "gap": "No requirement for PBM to disclose or report the spread between pharmacy reimbursement and plan billing — plan has no visibility", "explanation": "Without disclosure requirements, the plan cannot measure, monitor, or renegotiate the spread. This is intentional design — opacity is how spread pricing persists."},
                ],
                "negotiation": {
                    "gap_summary": "This contract contains no spread pricing prohibition, no disclosure requirement, and no mechanism for the plan to detect or recover spread-based overcharges",
                    "model_language": "PBM shall bill Plan the exact amount paid to network pharmacies for each claim, inclusive of all adjustments. Spread pricing is expressly prohibited. PBM shall provide an annual spread disclosure report showing the difference between amounts billed to Plan and amounts paid to pharmacies, by claim type.",
                    "talking_point": "Ask for the spread report. If the PBM says there is no spread, ask them to put that in writing and commit to zero-spread billing. Their response will tell you everything.",
                }
            },
            {
                "id": 3, "name": "Rebates & Manufacturer Revenue", "score": 3.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "PBM rebate retention rights", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Rebate extraction", "financial_impact": "$65,000 - $200,000 annually", "confidence": 92, "quote": "PBM shall share rebates with Plan in accordance with the applicable Rebate Schedule", "gap": "'Share' is not 100% pass-through — PBM retains a portion defined in a separately controlled schedule", "explanation": "The word 'share' in rebate language is a red flag. It means the PBM keeps a portion — the amount and methodology are buried in a schedule the PBM controls."},
                    {"text": "Delayed rebate remittance timing", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Rebate extraction", "financial_impact": "$5,000 - $15,000 annually", "confidence": 78, "quote": None, "gap": "No rebate remittance timeline specified — PBMs typically delay 6-18 months, creating significant float income at plan's expense", "explanation": "PBMs often hold rebates for 12-18 months before remitting to the plan. The interest earned on hundreds of thousands of dollars represents significant hidden PBM income."},
                    {"text": "Partial rebate pass-through structures", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Rebate extraction", "financial_impact": "$35,000 - $115,000 annually", "confidence": 89, "quote": "Rebate Schedule attached as Exhibit D", "gap": "Exhibit D not provided — rebate sharing percentage is a blank that PBM fills in and controls", "explanation": "Rebate schedules attached as separate exhibits allow PBMs to modify sharing percentages at renewal without triggering the full contract renegotiation process."},
                    {"text": "Manufacturer contracting exclusivity control", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Rebate extraction", "financial_impact": "$15,000 - $50,000 annually", "confidence": 85, "quote": None, "gap": "PBM retains exclusive manufacturer contracting rights — plan cannot independently negotiate rebate access or verify manufacturer payment amounts", "explanation": "When PBMs control manufacturer contracting exclusively, they can structure rebate agreements that maximize PBM income rather than plan savings."},
                    {"text": "Rebate eligibility ambiguity", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Rebate extraction", "financial_impact": "$15,000 - $40,000 annually", "confidence": 76, "quote": "Rebates shall apply to eligible claims as determined by PBM's rebate eligibility criteria", "gap": "PBM-controlled eligibility criteria allow exclusion of claims from rebate calculation without plan oversight", "explanation": "Rebate eligibility criteria determine which claims qualify for rebates. PBM-controlled criteria are routinely used to exclude high-volume claims from rebate calculations."},
                    {"text": "Off-invoice rebate capture risk", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Rebate extraction", "financial_impact": "$25,000 - $75,000 annually", "confidence": 83, "quote": None, "gap": "No disclosure or pass-through requirement for off-invoice manufacturer payments — data fees, educational grants, preferred placement fees, and market share bonuses are unaddressed", "explanation": "Manufacturers pay PBMs for preferred formulary placement, data licensing, and educational programs. These off-invoice payments are economically equivalent to rebates but are not defined as such in the contract."},
                ],
                "negotiation": {
                    "gap_summary": "Plan receives a portion of traditional rebates but the PBM retains off-invoice payments, controls eligibility criteria, and faces no disclosure obligation for the full scope of manufacturer revenue",
                    "model_language": "PBM shall pass through 100% of all Manufacturer Revenue received in connection with Plan's members, including but not limited to rebates, chargebacks, administrative fees, educational grants, data fees, and market share payments. Manufacturer Revenue shall be remitted within 45 days of receipt by PBM.",
                    "talking_point": "Ask your PBM for the total dollar amount received from manufacturers last year — all sources, not just rebates. Compare it to what was remitted to the plan. That gap is your leakage.",
                }
            },
            {
                "id": 4, "name": "Formulary Control", "score": 3.0,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "PBM unilateral formulary authority", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Behavioral steering", "financial_impact": "$25,000 - $80,000 annually", "confidence": 91, "quote": "PBM shall maintain and update the formulary in accordance with its clinical and economic criteria", "gap": "Plan has no approval rights over formulary — PBM can change covered drugs based on rebate economics without plan consent", "explanation": "Unilateral formulary authority allows the PBM to prioritize rebated drugs over clinically equivalent lower-cost alternatives, driving plan costs up while PBM revenue increases."},
                    {"text": "Step therapy enforcement control", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Behavioral steering", "financial_impact": "$10,000 - $30,000 annually", "confidence": 84, "quote": None, "gap": "Step therapy protocols not disclosed — PBM applies undisclosed clinical criteria that may be economically rather than clinically driven", "explanation": "Step therapy requirements force members to try lower-cost drugs before accessing preferred medications. When these protocols are PBM-controlled and undisclosed, they can be used to steer volume to higher-rebate drugs."},
                    {"text": "Exclusion list opacity", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$5,000 - $20,000 annually", "confidence": 79, "quote": "Certain drugs may be excluded from coverage as determined by PBM's clinical review process", "gap": "Exclusion criteria not defined — PBM can exclude drugs that compete with high-rebate alternatives without plan knowledge", "explanation": "Drug exclusion lists are a powerful economic lever. Excluding a competitor to a rebated drug drives volume to the preferred product, increasing PBM rebate income at the plan's clinical expense."},
                    {"text": "Therapeutic substitution discretion", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Behavioral steering", "financial_impact": "$10,000 - $25,000 annually", "confidence": 82, "quote": None, "gap": "No plan approval required for therapeutic substitutions — PBM can switch member medications based on economic rather than clinical criteria", "explanation": "Therapeutic substitution allows the PBM to substitute one drug for another deemed 'therapeutically equivalent.' Without plan oversight, this mechanism can be used to shift members to higher-rebate drugs."},
                    {"text": "Tiering manipulation incentives", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Medium", "mechanism_type": "Behavioral steering", "financial_impact": "$5,000 - $15,000 annually", "confidence": 74, "quote": "Drug tier placement shall be determined by PBM's P&T Committee using clinical and economic criteria", "gap": "Economic criteria in tier placement create incentive to place high-rebate drugs on preferred tiers regardless of comparative cost-effectiveness", "explanation": "When economic criteria influence tier placement, drugs that generate more rebate revenue for the PBM receive preferred placement — which drives member cost-sharing lower for those drugs, increasing utilization and PBM rebate income."},
                ],
                "negotiation": {
                    "gap_summary": "The PBM has complete, unilateral control over what drugs are covered, at what tier, with what restrictions — all informed by economic incentives that are undisclosed to the plan",
                    "model_language": "PBM shall not make adverse formulary changes without Plan's written approval and 90 days advance notice. Step therapy, exclusion, and therapeutic substitution criteria shall be disclosed to Plan annually. Economic criteria shall not be the primary driver of formulary placement decisions.",
                    "talking_point": "Ask your PBM to show you the financial relationship between their top 20 formulary drugs and their rebate income. That relationship determines your formulary — not clinical evidence.",
                }
            },
            {
                "id": 5, "name": "Pharmacy Network Design", "score": 3.0,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Preferred pharmacy steering", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Behavioral steering", "financial_impact": "$15,000 - $40,000 annually", "confidence": 86, "quote": None, "gap": "No anti-steering protections — PBM can incentivize members to use preferred (often PBM-affiliated) pharmacies through cost-sharing differentials", "explanation": "Preferred pharmacy networks steer members to PBM-affiliated or high-margin pharmacies using lower copays as bait, directing volume to the PBM's economic interest."},
                    {"text": "Differential reimbursement across pharmacies", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$10,000 - $30,000 annually", "confidence": 83, "quote": "Preferred pharmacy reimbursement rates are set forth in the Network Participation Agreement", "gap": "Plan cannot access the Network Participation Agreement — differential rates between preferred and standard pharmacies are hidden", "explanation": "Differential reimbursement allows PBMs to profit from the spread between what they pay preferred (often owned) pharmacies and what they charge the plan."},
                    {"text": "Mail-order coercion mechanisms", "found": True, "status": "Present", "severity": "Medium", "mechanism_type": "Behavioral steering", "financial_impact": "$5,000 - $20,000 annually", "confidence": 89, "quote": "Members requiring maintenance medications for 90+ day supply shall use PBM's mail order pharmacy unless otherwise authorized", "gap": "Mandatory mail-order requirement routes 90-day supply volume to PBM-owned pharmacy — member choice is eliminated", "explanation": "Mandatory mail-order requirements are one of the clearest examples of PBM self-dealing: forcing members to use the PBM's own pharmacy captures the dispensing margin in addition to the PBM management fee."},
                    {"text": "Limited pharmacy network transparency", "found": False, "status": "Not Present", "severity": "Medium", "mechanism_type": "Information asymmetry", "financial_impact": "$5,000 - $15,000 annually", "confidence": 77, "quote": None, "gap": "Network participation criteria and reimbursement tiers not disclosed — plan cannot evaluate network adequacy or cost-effectiveness", "explanation": "Without network transparency, the plan cannot determine whether the pharmacy network was designed to serve members or to capture margin for the PBM."},
                    {"text": "Spread capture via network design", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$20,000 - $60,000 annually", "confidence": 88, "quote": "PBM-affiliated pharmacies shall be included in the preferred pharmacy network", "gap": "PBM-affiliated pharmacy inclusion in preferred network creates structural spread capture — PBM profits on both the management fee and the dispensing margin", "explanation": "This is the network design equivalent of vertical integration: the PBM controls the preferred network, owns pharmacies within it, and captures margin at every transaction point."},
                ],
                "negotiation": {
                    "gap_summary": "Network design systematically routes volume to PBM-affiliated pharmacies through mandatory mail-order mandates and undisclosed preferred pharmacy steering mechanisms",
                    "model_language": "Members shall not be required to use any PBM-affiliated pharmacy. PBM shall disclose all pharmacy network participation criteria and reimbursement differentials. Mail-order mandates are prohibited without Plan's written consent.",
                    "talking_point": "What percentage of your members' mail-order prescriptions are filled at a pharmacy the PBM owns? Ask for that number in writing.",
                }
            },
            {
                "id": 6, "name": "Specialty Drug Management", "score": 2.0,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Site-of-care steering restrictions", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Behavioral steering", "financial_impact": "$65,000 - $265,000 annually", "confidence": 87, "quote": None, "gap": "No site-of-care protections — PBM can mandate hospital outpatient for drugs available at ASC or physician office at 40-60% lower cost", "explanation": "Site-of-care for specialty and biologic drugs is a massive cost driver. Mandating hospital outpatient over lower-cost alternatives is a primary mechanism for specialty cost inflation."},
                    {"text": "White/brown bagging mandates", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Behavioral steering", "financial_impact": "$50,000 - $150,000 annually", "confidence": 84, "quote": "Specialty drugs requiring administration shall be dispensed through PBM's specialty pharmacy network", "gap": "White/brown bagging mandate routes specialty drug dispensing to PBM specialty pharmacy, capturing the margin and preventing provider buy-and-bill which is often lower cost", "explanation": "White bagging (PBM ships drug to provider) and brown bagging (member carries drug) mandates prevent physicians from billing under their own contracts. PBM specialty pharmacy margins on these drugs can exceed 20%."},
                    {"text": "Specialty carve-out opacity", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Contractual lock-in", "financial_impact": "$25,000 - $75,000 annually", "confidence": 81, "quote": None, "gap": "No specialty carve-out rights defined — plan cannot engage alternative specialty vendors without PBM approval", "explanation": "Specialty drug management is the highest-margin segment for PBMs. Without carve-out rights, the plan is locked into the PBM's specialty economics even if superior alternatives exist."},
                    {"text": "High-cost drug reimbursement manipulation", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$35,000 - $115,000 annually", "confidence": 79, "quote": "High-cost drug reimbursement shall be established by PBM's specialty drug pricing committee", "gap": "PBM-controlled specialty pricing committee sets reimbursement for drugs costing $5,000-$80,000 per month — no plan oversight", "explanation": "A specialty drug pricing committee controlled by the PBM can set reimbursement in ways that maximize PBM margin. For drugs costing $50,000+ annually per member, small percentage differences create enormous dollar impact."},
                    {"text": "Specialty rebate separation from plan sponsor", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Rebate extraction", "financial_impact": "$50,000 - $165,000 annually", "confidence": 92, "quote": None, "gap": "Specialty manufacturer rebates retained by PBM's specialty pharmacy subsidiary — not included in general rebate pass-through obligations", "explanation": "PBMs structure specialty operations through subsidiaries to legally separate specialty manufacturer revenue from standard rebate obligations. Plan sponsors are typically unaware of this structural separation."},
                ],
                "negotiation": {
                    "gap_summary": "The specialty drug segment is an economic black box — PBM controls site-of-care, dispensing, pricing, and manufacturer revenue with no plan oversight at the segment with the highest per-claim dollar impact",
                    "model_language": "Plan retains the right to carve out specialty drugs at any time upon 30 days notice. PBM shall pass through 100% of specialty manufacturer revenue. White and brown bagging shall not be mandated without Plan's written consent.",
                    "talking_point": "Specialty drugs are typically 1-3% of claims volume but 30-50% of cost. Your PBM is making their largest margin in this segment. Ask for a complete financial accounting of specialty drug economics.",
                }
            },
            {
                "id": 7, "name": "Audit Rights & Recovery", "score": 2.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Limited audit scope clauses", "found": True, "status": "Partially Present", "severity": "Critical", "mechanism_type": "Administrative friction", "financial_impact": "$35,000 - $100,000 annually", "confidence": 90, "quote": "Plan may audit PBM's claims processing records upon 60 days written notice", "gap": "Audit scope limited to 'claims processing records' — excludes rebate calculations, network reimbursement, sub-contractor arrangements, and manufacturer revenue", "explanation": "A narrow audit scope clause that limits review to claims processing records is designed to prevent auditors from finding the most significant overcharges: rebate retention, spread pricing, and sub-contractor margin."},
                    {"text": "Short audit lookback windows", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Administrative friction", "financial_impact": "$25,000 - $80,000 annually", "confidence": 93, "quote": "Audit rights shall be limited to records from the 12-month period immediately preceding the audit request", "gap": "12-month lookback prevents recovery of systematic overcharges that persist across multiple years — industry standard is 36 months minimum", "explanation": "Systemic overcharges — spread pricing, rebate retention, incorrect pricing — repeat on every claim, every day. A 12-month lookback means 2-3 years of overcharges escape recovery entirely."},
                    {"text": "Data access restrictions during audit", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Administrative friction", "financial_impact": "$15,000 - $40,000 annually", "confidence": 85, "quote": None, "gap": "No defined timeline for PBM to produce records — PBMs routinely delay audit responses 6-12 months to exhaust plan resources", "explanation": "Without defined data production timelines, PBMs can delay audit responses until plan resources are exhausted or lookback windows close, structurally preventing meaningful recovery."},
                    {"text": "Recovery limitations post-audit", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Administrative friction", "financial_impact": "$15,000 - $50,000 annually", "confidence": 87, "quote": "PBM shall not be liable for claims not specifically identified and documented in the audit report", "gap": "Claim-by-claim recovery requirement prevents use of statistical extrapolation — each overcharge must be individually proven at prohibitive cost", "explanation": "Requiring individual claim-by-claim documentation for recovery makes systematic overcharge recovery economically impossible. At $2-5 per generic claim, the audit cost exceeds the recovery value."},
                    {"text": "PBM-controlled audit methodology", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Administrative friction", "financial_impact": "$35,000 - $100,000 annually", "confidence": 91, "quote": "Audit methodology disputes shall be resolved by PBM's internal audit team", "gap": "PBM resolves its own audit disputes — the entity being audited controls the audit outcome", "explanation": "A PBM-controlled dispute resolution process for audit findings is structural protection against accountability. Independent arbitration should be the standard."},
                ],
                "negotiation": {
                    "gap_summary": "Audit rights exist on paper but are operationally designed to prevent meaningful recovery: narrow scope, short lookback, no extrapolation, PBM-controlled methodology",
                    "model_language": "Plan shall have the right to audit all PBM records for a 36-month retroactive period. Statistical extrapolation at 95% confidence interval is permitted. Audit findings are final and binding unless disputed in independent arbitration within 30 days. PBM shall produce requested records within 15 business days.",
                    "talking_point": "If your audit clause has a 12-month lookback and no extrapolation, it is designed to find nothing. Ask your PBM to extend the lookback to 36 months and permit statistical sampling.",
                }
            },
            {
                "id": 8, "name": "Transparency & Disclosure", "score": 2.0,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": '"Proprietary information" shielding used to block pricing disclosure', "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Information asymmetry", "financial_impact": "$50,000 - $165,000 annually", "confidence": 95, "quote": "PBM pricing information, network contracts, and manufacturer agreements constitute proprietary information and shall not be disclosed", "gap": "Sweeping proprietary designation shields pricing from audit and disclosure — the plan cannot verify any economic arrangement the PBM has structured", "explanation": "Proprietary information clauses are the legal mechanism that makes all other opacity provisions enforceable. They prevent auditors, consultants, and plan sponsors from accessing the underlying economics."},
                    {"text": "Lack of ingredient cost disclosure", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$20,000 - $60,000 annually", "confidence": 88, "quote": None, "gap": "No requirement to disclose actual ingredient cost — plan cannot verify whether billed amount reflects actual acquisition cost or PBM margin", "explanation": "Ingredient cost disclosure is the foundation of pharmaceutical transparency. Without it, the plan cannot measure spread, verify benchmark application, or audit MAC list accuracy."},
                    {"text": "Black box rebate reporting", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$25,000 - $85,000 annually", "confidence": 86, "quote": "Quarterly rebate reports provided at aggregate level", "gap": "Aggregate rebate reporting prevents drug-level verification — plan cannot confirm whether rebate amounts are accurate or complete", "explanation": "Aggregate-only rebate reporting is a disclosure floor, not a transparency standard. Drug-level rebate data is necessary to verify that all eligible claims are included and that the full rebate value is being remitted."},
                    {"text": "Aggregate-only reporting structures", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$25,000 - $85,000 annually", "confidence": 90, "quote": "Reporting shall be provided in the format and at the frequency determined by PBM", "gap": "PBM controls both the content and format of all financial reporting — plan receives only what the PBM chooses to provide", "explanation": "PBM-controlled reporting formats are designed to prevent plan sponsors from identifying the data needed to quantify leakage. Meaningful transparency requires claim-level data with pharmacy, drug, and reimbursement detail."},
                    {"text": "Non-itemized claim-level visibility", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$15,000 - $40,000 annually", "confidence": 84, "quote": None, "gap": "No claim-level data access right — plan cannot perform independent analysis of pricing, utilization, or network performance", "explanation": "Without claim-level data, the plan is entirely dependent on PBM-generated reports to understand its pharmaceutical economics. This information asymmetry is the foundation of PBM pricing power."},
                ],
                "negotiation": {
                    "gap_summary": "The transparency architecture in this contract is designed to prevent disclosure rather than enable it — every financial arrangement the PBM has structured is shielded from plan review",
                    "model_language": "PBM shall provide claim-level data to Plan in a machine-readable format within 15 days of each calendar quarter. Data shall include NDC, pharmacy NPI, days supply, ingredient cost, dispensing fee, member cost share, and rebate allocation by claim. No data shall be designated proprietary as against the Plan.",
                    "talking_point": "The CAA 2026 requires plan sponsors to have access to their claims data. If your PBM is calling their pricing 'proprietary' to block your data access, that is a compliance risk.",
                }
            },
            {
                "id": 9, "name": "Performance Guarantees", "score": 4.5,
                "rating": "concern", "quick_look": "concern",
                "issues": [
                    {"text": "Weak or non-binding performance quality levels (PQLs)", "found": True, "status": "Partially Present", "severity": "High", "mechanism_type": "Administrative friction", "financial_impact": "$10,000 - $25,000 annually", "confidence": 82, "quote": "PBM shall use commercially reasonable efforts to achieve performance targets as set forth in Exhibit E", "gap": "'Commercially reasonable efforts' is not a binding guarantee — no financial penalty for non-performance", "explanation": "'Commercially reasonable efforts' language creates aspirational targets with no accountability. In practice, PBMs routinely miss these targets with no financial consequence to the plan."},
                    {"text": "Utilization threshold manipulation", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Medium", "mechanism_type": "Administrative friction", "financial_impact": "$5,000 - $15,000 annually", "confidence": 75, "quote": "Generic dispensing rate guarantee shall be measured using PBM's proprietary methodology", "gap": "PBM-controlled GDR methodology allows exclusion of certain drug categories from the calculation — reported GDR may exceed actual plan experience", "explanation": "Generic dispensing rate guarantees are often measured using methodology that excludes specialty and brand drugs — inflating the reported GDR while the plan pays for brand fills that could have been substituted generically."},
                    {"text": "Bonus-driven misalignment incentives", "found": False, "status": "Not Present", "severity": "Medium", "mechanism_type": "Behavioral steering", "financial_impact": "$5,000 - $20,000 annually", "confidence": 78, "quote": None, "gap": "No disclosure of PBM employee incentive structures — plan cannot assess whether bonus structures are aligned with plan savings or PBM revenue", "explanation": "If PBM account managers and clinical teams receive bonuses tied to PBM revenue metrics rather than plan cost metrics, their incentives are structurally misaligned with the plan's interests."},
                    {"text": "Penalty avoidance loopholes", "found": True, "status": "Partially Present", "severity": "High", "mechanism_type": "Administrative friction", "financial_impact": "$10,000 - $25,000 annually", "confidence": 86, "quote": "Performance guarantees shall not apply during periods of force majeure, system upgrades, or market disruption events as defined by PBM", "gap": "PBM-defined exemption categories for performance guarantee penalties are broad enough to routinely avoid accountability", "explanation": "Guarantee exemption clauses allow PBMs to avoid financial penalties by declaring performance failures as 'market disruption events' or 'system upgrades' — categories they define and apply unilaterally."},
                ],
                "negotiation": {
                    "gap_summary": "Performance guarantees exist but are unenforceable — commercially reasonable efforts language, PBM-controlled measurement, and broad exemptions make financial accountability nearly impossible",
                    "model_language": "PBM shall guarantee a generic dispensing rate of no less than 85% measured by Plan's own data. Failure to achieve any performance guarantee shall result in a credit of $X,000 per percentage point of miss. No exemption shall apply without Plan's written consent.",
                    "talking_point": "Ask your PBM what they paid out in performance guarantee credits last year. If the answer is zero or near-zero, the guarantees are not real.",
                }
            },
            {
                "id": 10, "name": "Termination & Exit Barriers", "score": 2.0,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Early termination penalties", "found": True, "status": "Present", "severity": "Critical", "mechanism_type": "Contractual lock-in", "financial_impact": "$50,000 - $165,000 annually", "confidence": 93, "quote": "In the event of termination by Plan prior to the end of the contract term, Plan shall pay PBM a termination fee equal to three months of average PMPM fees", "gap": "Early termination fee of approximately 3 months of PMPM fees creates significant financial barrier to switching PBMs", "explanation": "A 3-month termination penalty on a 500-member plan spending $800 PMPM equals $1.2M in exit costs. This is structurally designed to make switching prohibitively expensive regardless of PBM performance."},
                    {"text": "Data export restrictions upon exit", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Contractual lock-in", "financial_impact": "$15,000 - $50,000 annually", "confidence": 87, "quote": None, "gap": "No defined data export obligation upon termination — PBM can delay or restrict data transfer, complicating transition to successor PBM", "explanation": "Without a defined data export obligation, the departing PBM can delay providing claims history to the incoming PBM, creating gaps in member care continuity and increasing transition costs."},
                    {"text": "Contract lock-in renewal structures", "found": True, "status": "Present", "severity": "High", "mechanism_type": "Contractual lock-in", "financial_impact": "$35,000 - $100,000 annually", "confidence": 91, "quote": "Unless written notice of non-renewal is provided 180 days prior to expiration, this Agreement shall automatically renew for successive one-year terms", "gap": "180-day auto-renewal notice requirement extends effective contract by 6 months beyond decision date — combined with termination fee creates 9-month effective lock-in", "explanation": "Auto-renewal with a 180-day non-renewal window means a plan that decides not to renew on January 1 must have provided notice the previous July 4. Missing this window means another full year of contract."},
                    {"text": "Financial penalties for switching PBMs", "found": True, "status": "Present", "severity": "Critical", "mechanism_type": "Contractual lock-in", "financial_impact": "$65,000 - $200,000 annually", "confidence": 89, "quote": "PBM retains the right to offset any amounts owed to Plan against amounts owed by Plan including termination fees, outstanding claims, and administrative costs", "gap": "Broad offset clause allows PBM to withhold rebates, data, and other plan assets against disputed termination fees — plan loses leverage in exit disputes", "explanation": "The combination of termination fees, auto-renewal lock-in, data export restriction, and offset rights creates a four-part exit trap that makes switching economically and operationally very difficult."},
                ],
                "negotiation": {
                    "gap_summary": "This contract contains a four-part exit trap: early termination penalties, 180-day auto-renewal, undefined data export obligations, and broad offset rights that allow the PBM to hold plan assets hostage during exit disputes",
                    "model_language": "Either party may terminate this Agreement without cause upon 60 days written notice. No termination fee or liquidated damages shall be payable. PBM shall provide a complete, machine-readable claims data extract within 15 days of termination notice. PBM may not offset plan assets against any disputed amounts.",
                    "talking_point": "What is the total cost to exit this contract today — termination fees, notice period, legal fees, and transition costs? If the answer is more than $100,000, you have an exit trap.",
                }
            },
            {
                "id": 11, "name": "Claim Adjudication Logic", "score": 3.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Retroactive claim adjustment authority", "found": True, "status": "Present", "severity": "Critical", "mechanism_type": "Pricing distortion", "financial_impact": "$15,000 - $40,000 annually", "confidence": 90, "quote": "PBM reserves the right to adjust previously adjudicated claims for pricing corrections, coding errors, or system updates at any time within 24 months of the original claim date", "gap": "24-month retroactive adjustment window with no notice requirement gives PBM broad authority to modify past claims without plan consent", "explanation": "Retroactive adjustment authority allows PBMs to reclassify claims after the fact in ways that increase plan costs or reduce recoveries. The 24-month window exceeds most plan audit periods, reducing the plan's ability to review adjustments."},
                    {"text": "Reversal discretion without notice", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Information asymmetry", "financial_impact": "$5,000 - $20,000 annually", "confidence": 83, "quote": None, "gap": "No notice requirement for claim reversals — PBM can reverse and rebill claims without informing the plan sponsor or affected member", "explanation": "Claim reversals without notice prevent plan sponsors from understanding their true benefit costs and make accurate financial reporting impossible."},
                    {"text": "Pricing recalculation ambiguity", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "mechanism_type": "Pricing distortion", "financial_impact": "$10,000 - $30,000 annually", "confidence": 78, "quote": "Claims shall be priced according to the applicable pricing logic in effect at the time of adjudication as updated by PBM from time to time", "gap": "PBM can update adjudication pricing logic unilaterally — 'from time to time' language allows mid-year pricing changes without plan notification", "explanation": "Pricing logic updated 'from time to time' allows the PBM to modify reimbursement methodology mid-contract without triggering formal amendment rights, effectively renegotiating economics without the plan's knowledge."},
                    {"text": "Claim reprocessing opacity", "found": False, "status": "Not Present", "severity": "Medium", "mechanism_type": "Information asymmetry", "financial_impact": "$5,000 - $15,000 annually", "confidence": 76, "quote": None, "gap": "No requirement to disclose the reason for claim reprocessing or provide a summary of reprocessed claims to the plan", "explanation": "Claim reprocessing without transparency allows PBMs to modify claim economics systematically without creating an auditable trail that the plan can review or challenge."},
                ],
                "negotiation": {
                    "gap_summary": "PBM has broad authority to adjust, reverse, reprice, and reprocess claims retroactively without plan notification — creating a mechanism to modify plan economics long after services are rendered",
                    "model_language": "PBM shall not adjust, reverse, or reprice any previously adjudicated claim without providing written notice to Plan within 5 business days. Retroactive adjustments shall be limited to a 12-month lookback. PBM shall provide a quarterly summary of all claims that were adjusted, reversed, or reprocessed.",
                    "talking_point": "Ask for a report of all claims that were retroactively adjusted in the last 12 months and the dollar impact on the plan. That number quantifies your adjudication exposure.",
                }
            },
            {
                "id": 12, "name": "Fiduciary & Legal Protections", "score": 1.5,
                "rating": "red_flag", "quick_look": "red_flag",
                "issues": [
                    {"text": "Explicit fiduciary duty disclaimers", "found": True, "status": "Present", "severity": "Critical", "mechanism_type": "Information asymmetry", "financial_impact": "$65,000 - $265,000 annually", "confidence": 97, "quote": "Nothing in this Agreement shall be construed to make PBM a fiduciary of the Plan or its participants", "gap": "Explicit fiduciary disclaimer contractually removes PBM's obligation to act in the plan's interest — PBM can legally prioritize its own economic interests", "explanation": "This is the most dangerous clause in a PBM contract. An explicit fiduciary disclaimer means the PBM has no legal duty to the plan — it can structure all of its pricing, rebate, and formulary decisions to maximize its own revenue, and the plan has no contractual basis to object."},
                    {"text": "Indemnification asymmetry favoring PBM", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Contractual lock-in", "financial_impact": "$15,000 - $65,000 annually", "confidence": 88, "quote": "Plan shall indemnify and hold harmless PBM for all claims arising from Plan's benefit design or coverage decisions", "gap": "One-sided indemnification requires Plan to defend PBM against claims arising from the PBM's own benefit administration — asymmetric and inappropriate", "explanation": "Indemnification clauses that require the plan to defend the PBM against third-party claims shift legal and financial risk to the plan sponsor. This is particularly egregious when the PBM makes benefit administration decisions unilaterally."},
                    {"text": "Liability limitation clauses", "found": False, "status": "Not Present", "severity": "High", "mechanism_type": "Contractual lock-in", "financial_impact": "$15,000 - $65,000 annually", "confidence": 91, "quote": "PBM's liability under this Agreement shall not exceed the fees paid by Plan in the three months immediately preceding the claim", "gap": "Liability cap at 3 months of fees limits PBM's total accountability to approximately $50,000-$200,000 regardless of actual damages caused", "explanation": "For a plan that could suffer millions in damages from systematic overcharging or plan design errors, a liability cap of 3 months of administrative fees is an effective immunity clause."},
                    {"text": "Conflict-of-interest non-disclosure", "found": False, "status": "Not Present", "severity": "Critical", "mechanism_type": "Information asymmetry", "financial_impact": "$35,000 - $135,000 annually", "confidence": 94, "quote": None, "gap": "No conflict-of-interest disclosure requirement — PBM is not obligated to disclose economic relationships with manufacturers, pharmacies, or other counterparties that influence plan economics", "explanation": "Without a conflict-of-interest disclosure requirement, the plan cannot identify or evaluate the financial relationships that shape the PBM's decisions on pricing, formulary, and network design."},
                ],
                "negotiation": {
                    "gap_summary": "The legal architecture of this contract maximizes PBM protection and minimizes plan rights — explicit fiduciary disclaimer, asymmetric indemnification, liability cap, and no conflict-of-interest disclosure combine to create near-total PBM immunity",
                    "model_language": "PBM acknowledges its fiduciary obligations to the Plan under ERISA and CAA 2026. PBM shall disclose all material conflicts of interest annually. Liability shall not be capped at less than 12 months of Plan spend. Indemnification obligations shall be mutual.",
                    "talking_point": "The fiduciary disclaimer in Section [X] means your PBM has no legal duty to act in your interest. Every pricing decision, formulary choice, and rebate calculation can legally be made to benefit the PBM at your expense. Removing that clause is non-negotiable.",
                }
            },
            {
                "id": 13, "name": "Data Ownership & Access Rights", "score": 6.0,
                "rating": "fair", "quick_look": "good",
                "issues": [
                    {"text": "PBM ownership of claims data", "found": True, "status": "Present", "severity": "Low", "mechanism_type": "Contractual lock-in", "financial_impact": None, "confidence": 88, "quote": "All claims data generated in connection with Plan's benefit is the property of Plan Sponsor", "gap": None, "explanation": "Data ownership is clearly established. This is the strongest provision in the contract and the baseline for any data access rights."},
                    {"text": "Delayed or incomplete data access", "found": False, "status": "Partially Present", "severity": "Medium", "mechanism_type": "Administrative friction", "financial_impact": "$5,000 - $20,000 annually", "confidence": 79, "quote": "Plan may request a complete data extract upon 30 days written notice, subject to PBM's data security protocols", "gap": "30-day production timeline and undefined 'data security protocols' allow PBM to delay or restrict data access in practice even though ownership is established", "explanation": "Owning data is meaningless if access is delayed or restricted. A 30-day production timeline with undefined security carve-outs gives the PBM a practical mechanism to withhold data despite the ownership language."},
                    {"text": "Restricted data portability/export rights", "found": False, "status": "Not Present", "severity": "Medium", "mechanism_type": "Contractual lock-in", "financial_impact": "$10,000 - $30,000 annually", "confidence": 82, "quote": None, "gap": "No defined data format, completeness standard, or portability requirement upon termination — Plan may receive data in a format incompatible with successor PBM systems", "explanation": "Data portability is the practical test of data ownership. Without format standards and completeness requirements, the PBM can provide data that is technically complete but practically unusable by a successor PBM or analytics vendor."},
                ],
                "negotiation": {
                    "gap_summary": "Data ownership is established but data access and portability are practically limited — the gap between paper ownership and practical access is where PBM friction is created",
                    "model_language": "Plan shall have continuous, real-time access to its claims data via a secure web portal. Upon termination, PBM shall provide a complete claims data extract in NCPDP standard format within 10 business days at no charge. No security protocol shall be invoked to delay data access.",
                    "talking_point": "You own the data on paper. Can you actually access it in real time? Can you get it out within 10 days if you switch PBMs? If not, the ownership clause is theoretical.",
                }
            },
        ]
    }


def _demo_renegotiated_analysis():
    return {
        "pbm_name": "OptimaCare PBM — Renegotiated",
        "overall_score": 67,
        "key_findings": [
            {"severity": "positive", "text": "Spread pricing expressly prohibited — ingredient cost pass-through language added and binding"},
            {"severity": "positive", "text": "Audit lookback extended from 12 to 24 months; statistical extrapolation now permitted"},
            {"severity": "positive", "text": "Early termination penalties eliminated — no liquidated damages clause in renegotiated agreement"},
            {"severity": "positive", "text": "Fiduciary duty disclaimer softened — PBM acknowledges obligations to Plan participants"},
            {"severity": "positive", "text": "100% rebate pass-through secured with quarterly remittance requirement"},
            {"severity": "warning", "text": "Specialty drug management remains weak — site-of-care and white/brown bagging not addressed"},
            {"severity": "warning", "text": "Transparency still limited — claim-level data access and ingredient cost disclosure not secured"},
            {"severity": "warning", "text": "Performance guarantees improved but penalty avoidance loopholes remain in force majeure language"},
            {"severity": "critical", "text": "Off-invoice rebate capture risk unresolved — PBM still retains manufacturer data fees and placement payments"},
        ],
        "provisions": [
            {"id": 1, "name": "Pricing & Reimbursement", "score": 6.5, "rating": "fair", "quick_look": "good",
             "issues": [
                 {"text": "AWP/WAC/NADAC benchmark opacity", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 85, "quote": "AWP shall be defined as the Medi-Span published rate as of the date of dispensing", "gap": None, "explanation": "Benchmark source is now contractually defined — eliminates PBM's ability to switch sources to maximize margin."},
                 {"text": "Spread between reimbursement benchmarks", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 88, "quote": "Spread pricing is expressly prohibited. Plan shall be billed the actual amount paid to network pharmacies.", "gap": None, "explanation": "Explicit spread pricing prohibition is the single most valuable clause added in this renegotiation."},
                 {"text": "MAC list manipulation flexibility", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $10,000 annually", "confidence": 74, "quote": "MAC list shall be made available to Plan upon written request within 10 business days", "gap": "MAC appeal process added but response timeline not defined", "explanation": "MAC transparency is improved — plan can now review the list. Appeal response timeline still needs to be specified."},
                 {"text": "Specialty drug pricing carve-outs", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$20,000 - $60,000 annually", "confidence": 81, "quote": None, "gap": "Specialty pricing methodology still bundled into standard AWP schedule", "explanation": "Specialty pricing remains opaque — this was not addressed in the renegotiation and should be a priority for next cycle."},
                 {"text": "Dispensing fee variability asymmetry", "found": True, "status": "Present", "severity": "Medium", "financial_impact": None, "confidence": 79, "quote": "Dispensing fees as set forth in Exhibit A shall not be increased without 60 days written notice", "gap": None, "explanation": "Fee change protection added — plan now has advance notice and implicit approval rights."},
                 {"text": "Repricing or retroactive adjustments", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $15,000 annually", "confidence": 72, "quote": "Retroactive adjustments limited to 12 months retroactive from date of claim", "gap": "12-month retroactive window still permits significant claim repricing — was 24 months, now 12", "explanation": "An improvement from 24 to 12 months, but retroactive adjustment authority without notice requirements remains a risk."},
             ],
             "negotiation": {"gap_summary": "Major gains on benchmark definition and spread pricing — specialty carve-outs and retroactive adjustment controls are next priorities", "model_language": "Retroactive adjustments shall require written notice to Plan within 5 business days and shall be subject to Plan's right to dispute.", "talking_point": "You closed the two biggest pricing gaps. Specialty pricing and retroactive adjustment notice are the next targets."}},
            {"id": 2, "name": "Spread Pricing", "score": 7.5, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "Explicit spread pricing clauses", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 94, "quote": "Spread pricing is expressly and irrevocably prohibited under this Agreement", "gap": None, "explanation": "The explicit prohibition is binding and unambiguous — the primary mechanism of PBM hidden revenue has been contractually closed."},
                 {"text": "Implicit spread via reimbursement gaps", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 78, "quote": "Plan shall be billed the actual network rate paid to pharmacies", "gap": "Pass-through commitment does not address periodic pharmacy reimbursement adjustments that could widen gap over time", "explanation": "The billing commitment is strong but the contract still allows pharmacy network rate adjustments without plan notice — a potential channel for implicit spread."},
                 {"text": "Hidden spread via pharmacy clawbacks", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 76, "quote": None, "gap": "DIR fees and pharmacy clawbacks still not required to be passed through to the plan", "explanation": "Even with spread pricing prohibited, PBMs can still capture DIR fee income from pharmacies without disclosing or passing it through. This gap remains open."},
                 {"text": "Spread non-disclosure to plan sponsor", "found": True, "status": "Partially Present", "severity": "Critical", "financial_impact": None, "confidence": 81, "quote": "PBM shall provide an annual spread disclosure report", "gap": "Annual frequency is too infrequent — quarterly reporting would be the standard for meaningful monitoring", "explanation": "Annual disclosure is a significant step forward. Quarterly reporting would provide actionable data in time to catch spread that reopens through network adjustments."},
             ],
             "negotiation": {"gap_summary": "Spread pricing is prohibited and annual disclosure is secured — DIR clawback pass-through and quarterly disclosure are the remaining gaps", "model_language": "PBM shall pass through 100% of all DIR fees and pharmacy network adjustments to the Plan. Spread disclosure reports shall be provided quarterly.", "talking_point": "The spread prohibition is your biggest win. Now close the DIR fee gap before next renewal — it's the back door to spread."}},
            {"id": 3, "name": "Rebates & Manufacturer Revenue", "score": 6.0, "rating": "fair", "quick_look": "concern",
             "issues": [
                 {"text": "PBM rebate retention rights", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 89, "quote": "PBM shall pass through 100% of all rebates received from pharmaceutical manufacturers", "gap": None, "explanation": "100% rebate pass-through is a significant victory. The definition of 'rebates' still needs to be confirmed to include all forms of manufacturer payment."},
                 {"text": "Delayed rebate remittance timing", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 83, "quote": "Rebates shall be remitted to Plan within 45 days of receipt by PBM", "gap": None, "explanation": "45-day remittance requirement eliminates the float income from delayed rebate payments. Industry standard is 30-45 days."},
                 {"text": "Partial rebate pass-through structures", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 85, "quote": "No portion of Manufacturer Revenue defined as 'rebates' shall be retained by PBM", "gap": None, "explanation": "Pass-through language is binding and includes all amounts classified as rebates under the agreement."},
                 {"text": "Manufacturer contracting exclusivity control", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$10,000 - $30,000 annually", "confidence": 77, "quote": None, "gap": "PBM still retains exclusive manufacturer contracting rights — plan cannot independently verify manufacturer payment amounts", "explanation": "100% pass-through of classified rebates is meaningless if the PBM controls how much is classified as a rebate. Contracting exclusivity allows reclassification of revenue to avoid the pass-through obligation."},
                 {"text": "Rebate eligibility ambiguity", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$10,000 - $25,000 annually", "confidence": 71, "quote": "Rebate-eligible claims shall be determined in accordance with PBM's standard eligibility methodology", "gap": "PBM still controls eligibility criteria — improved but not fully addressed", "explanation": "Eligibility methodology is still PBM-controlled. The 100% pass-through commitment is only as strong as the eligibility definition."},
                 {"text": "Off-invoice rebate capture risk", "found": False, "status": "Not Present", "severity": "Critical", "financial_impact": "$20,000 - $60,000 annually", "confidence": 86, "quote": None, "gap": "Off-invoice manufacturer payments (data fees, educational grants, preferred placement fees) not included in rebate definition — retained by PBM", "explanation": "This is the largest unresolved gap. 100% of classified rebates now pass through, but off-invoice payments are a growing share of total manufacturer revenue and remain entirely at the PBM."},
             ],
             "negotiation": {"gap_summary": "Major progress on rebate pass-through — the unresolved gap is off-invoice manufacturer revenue which the PBM retains outside the rebate definition", "model_language": "Manufacturer Revenue shall include all forms of payment from pharmaceutical manufacturers including rebates, chargebacks, administrative fees, data fees, educational grants, and preferred placement payments. 100% of all Manufacturer Revenue shall be passed through.", "talking_point": "You won 100% rebate pass-through. Now ask: what did the PBM receive from manufacturers that isn't classified as a rebate? That's the next dollar to recover."}},
            {"id": 4, "name": "Formulary Control", "score": 5.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "PBM unilateral formulary authority", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": "$15,000 - $40,000 annually", "confidence": 76, "quote": "Adverse formulary changes require 90 days advance written notice to Plan", "gap": "90-day notice is now secured but plan still has no approval rights — notice without approval is insufficient", "explanation": "Notice requirement is a meaningful improvement but the plan still cannot veto formulary changes that increase costs. Approval rights are the next target."},
                 {"text": "Step therapy enforcement control", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 73, "quote": None, "gap": "Step therapy protocols still not disclosed — not addressed in renegotiation", "explanation": "Step therapy remains a blind spot. The PBM can still use undisclosed protocols that drive volume to high-rebate drugs."},
                 {"text": "Exclusion list opacity", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $10,000 annually", "confidence": 74, "quote": "Exclusion list shall be disclosed to Plan upon request", "gap": "Disclosure on request is reactive — Plan should receive proactive notification of exclusion changes", "explanation": "A step forward from no disclosure at all — plan can now review the list. Proactive notification of changes would be the standard."},
                 {"text": "Therapeutic substitution discretion", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$5,000 - $15,000 annually", "confidence": 70, "quote": None, "gap": "Therapeutic substitution criteria not addressed — PBM retains full discretion", "explanation": "Not addressed in renegotiation. The PBM still can substitute drugs based on economic criteria without plan knowledge."},
                 {"text": "Tiering manipulation incentives", "found": False, "status": "Not Present", "severity": "Medium", "financial_impact": "$5,000 - $10,000 annually", "confidence": 68, "quote": None, "gap": "Tiering criteria and economic incentives undisclosed — not improved in renegotiation", "explanation": "Tiering transparency remains an unresolved issue. Economic incentives in tier placement are still not disclosed to the plan."},
             ],
             "negotiation": {"gap_summary": "90-day formulary notice secured is a win — the remaining agenda is plan approval rights, step therapy disclosure, and therapeutic substitution controls", "model_language": "Plan shall have the right to approve or reject formulary changes with a financial cost impact exceeding $10,000 annually. Step therapy criteria shall be disclosed annually.", "talking_point": "You have 90 days of notice now. Use that window to analyze every formulary change for economic vs. clinical rationale before it takes effect."}},
            {"id": 5, "name": "Pharmacy Network Design", "score": 4.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Preferred pharmacy steering", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$10,000 - $25,000 annually", "confidence": 79, "quote": None, "gap": "Anti-steering protections not addressed in renegotiation — PBM retains ability to use cost-sharing differentials to direct volume", "explanation": "Pharmacy steering was not a priority in this negotiation cycle. PBM-affiliated pharmacies continue to receive preferred cost-sharing treatment."},
                 {"text": "Differential reimbursement across pharmacies", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 74, "quote": None, "gap": "Network rate differentials still not disclosed — PBM controls reimbursement spread between pharmacy tiers", "explanation": "Spread pricing is now prohibited at the plan billing level, but reimbursement differentials within the pharmacy network are still not disclosed."},
                 {"text": "Mail-order coercion mechanisms", "found": True, "status": "Partially Present", "severity": "Medium", "financial_impact": "$5,000 - $10,000 annually", "confidence": 77, "quote": "Mail-order is encouraged for maintenance medications but members may opt out upon request", "gap": "Opt-out option is an improvement but the default is still mail-order — PBM-owned pharmacy still captures most of the volume", "explanation": "The opt-out provision is a meaningful improvement. However, most members will not exercise it, meaning the PBM-owned mail pharmacy continues to capture the majority of maintenance volume."},
                 {"text": "Limited pharmacy network transparency", "found": False, "status": "Not Present", "severity": "Medium", "financial_impact": "$5,000 - $10,000 annually", "confidence": 71, "quote": None, "gap": "Network participation criteria still not disclosed", "explanation": "Network transparency was not addressed. The plan still cannot evaluate whether network design serves members or PBM economics."},
                 {"text": "Spread capture via network design", "found": False, "status": "Hidden / Ambiguous Risk", "severity": "Critical", "financial_impact": "$10,000 - $30,000 annually", "confidence": 80, "quote": None, "gap": "PBM-affiliated specialty pharmacy still receives preferred network placement — structural spread capture via network design unaddressed", "explanation": "Even with spread pricing banned, PBM specialty pharmacy inclusion in the preferred network creates a parallel margin capture mechanism through preferred placement."},
             ],
             "negotiation": {"gap_summary": "Network design remains a significant gap — mail-order opt-out is a modest win but affiliated pharmacy steering and differential reimbursement are unresolved", "model_language": "PBM-affiliated pharmacies shall not receive preferred network placement. Mail-order shall be optional for all members. Reimbursement differentials between pharmacy tiers shall be disclosed annually.", "talking_point": "The mail-order opt-out is a start. Now get data on what percentage of volume is going to PBM-owned pharmacies versus independent — that number will tell you whether steering is still happening."}},
            {"id": 6, "name": "Specialty Drug Management", "score": 3.0, "rating": "red_flag", "quick_look": "red_flag",
             "issues": [
                 {"text": "Site-of-care steering restrictions", "found": False, "status": "Not Present", "severity": "Critical", "financial_impact": "$40,000 - $135,000 annually", "confidence": 82, "quote": None, "gap": "Site-of-care protections not addressed — PBM can still mandate higher-cost hospital outpatient settings for infused drugs", "explanation": "Specialty drugs represent the largest unresolved economic exposure. Site-of-care alone is a $100K+ annual leakage driver for most mid-market plans."},
                 {"text": "White/brown bagging mandates", "found": False, "status": "Not Present", "severity": "Critical", "financial_impact": "$25,000 - $85,000 annually", "confidence": 79, "quote": None, "gap": "White/brown bagging mandate unchanged — PBM specialty pharmacy still captures all infused drug dispensing", "explanation": "Not addressed in renegotiation. The PBM's specialty pharmacy continues to receive all infused drug volume through mandatory bagging, capturing the dispensing margin."},
                 {"text": "Specialty carve-out opacity", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": "$15,000 - $40,000 annually", "confidence": 75, "quote": "Plan may carve out specialty drugs upon 60 days written notice", "gap": "Carve-out right established but specialty pricing methodology and transition support still not defined", "explanation": "A carve-out right without defined pricing and transition obligations is difficult to exercise in practice. Transition support and data transfer obligations are needed to make this right usable."},
                 {"text": "High-cost drug reimbursement manipulation", "found": False, "status": "Not Present", "severity": "Critical", "financial_impact": "$20,000 - $65,000 annually", "confidence": 77, "quote": None, "gap": "Specialty drug pricing committee still PBM-controlled — no plan oversight of high-cost drug reimbursement", "explanation": "The largest per-claim cost risk in the contract. PBM-controlled specialty pricing on $50,000+ annual drugs creates enormous financial exposure."},
                 {"text": "Specialty rebate separation from plan sponsor", "found": False, "status": "Not Present", "severity": "Critical", "financial_impact": "$25,000 - $85,000 annually", "confidence": 83, "quote": None, "gap": "Specialty manufacturer rebates still retained by PBM's specialty pharmacy subsidiary — not included in 100% rebate pass-through obligation", "explanation": "The 100% rebate pass-through secured in Provision 3 does not extend to specialty manufacturer rebates held by the PBM's specialty pharmacy subsidiary. This is a structurally separate revenue stream."},
             ],
             "negotiation": {"gap_summary": "Specialty management is the biggest remaining economic exposure — site-of-care, white/brown bagging, specialty rebate separation, and high-cost drug pricing are all unresolved", "model_language": "PBM shall pass through 100% of specialty manufacturer rebates regardless of which subsidiary receives them. Plan may elect site-of-care alternatives with PBM's operational support. White/brown bagging shall not be mandated.", "talking_point": "Specialty drugs are where the real money is — 1-3% of claims but 40-50% of cost. Every unresolved specialty provision costs more per issue than any other area of this contract."}},
            {"id": 7, "name": "Audit Rights & Recovery", "score": 5.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Limited audit scope clauses", "found": True, "status": "Partially Present", "severity": "Critical", "financial_impact": "$40,000 - $120,000 unrecoverable", "confidence": 82, "quote": "Plan may audit all claims processing records and rebate calculations", "gap": "Audit scope now includes rebate calculations but still excludes sub-contractor arrangements and manufacturer contracting", "explanation": "Significant expansion of audit scope — rebate calculations are now auditable. Sub-contractor and manufacturer contracting exclusions are the remaining gaps."},
                 {"text": "Short audit lookback windows", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": "$50,000 - $150,000 per additional year", "confidence": 85, "quote": "Audit rights shall apply to records from the 24-month period preceding the audit request", "gap": "Extended from 12 to 24 months — meaningful improvement but still below the 36-month industry standard", "explanation": "Going from 12 to 24 months doubles your recovery window. One more cycle to push to 36 months would align with the ERISA claims statute of limitations."},
                 {"text": "Data access restrictions during audit", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 80, "quote": "PBM shall produce requested records within 15 business days of audit request", "gap": None, "explanation": "Defined production timeline is a strong win — prevents PBM from delaying audits until lookback windows close."},
                 {"text": "Recovery limitations post-audit", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": "$20,000 - $60,000 improvement", "confidence": 76, "quote": "Statistical extrapolation at 95% confidence is permitted for claim populations exceeding 500 claims", "gap": "Extrapolation is now permitted — but recovery is still subject to PBM dispute rights", "explanation": "Extrapolation permission is a major win. Dispute rights at extrapolation findings still allow PBM to contest methodology and delay recovery."},
                 {"text": "PBM-controlled audit methodology", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": None, "confidence": 74, "quote": "Audit methodology disputes shall be submitted to independent arbitration within 30 days", "gap": "Independent arbitration for methodology disputes is secured — but PBM still sets initial methodology", "explanation": "Arbitration backstop is meaningful. The standard should be plan-selected auditor with binding findings. Arbitration still adds delay and cost to the recovery process."},
             ],
             "negotiation": {"gap_summary": "Audit rights improved substantially — extrapolation allowed, 24-month lookback, 15-day production. Remaining agenda: 36-month lookback and binding findings without arbitration", "model_language": "Audit period extended to 36 months. Audit findings are final and binding unless disputed within 30 days in arbitration.", "talking_point": "From 12 to 24 months and extrapolation added — you've dramatically improved your recovery rights. The final push: 36 months and binding findings."}},
            {"id": 8, "name": "Transparency & Disclosure", "score": 4.0, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": '"Proprietary information" shielding used to block pricing disclosure', "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": None, "confidence": 78, "quote": "Pricing information may not be designated proprietary as against the Plan for purposes of Plan's audit rights", "gap": "Proprietary designation is narrowed for audit purposes but still applies to general disclosure — PBM can still invoke it in other contexts", "explanation": "Narrowing the proprietary shield for audits is meaningful progress. Full transparency would require eliminating the designation entirely as against the plan sponsor."},
                 {"text": "Lack of ingredient cost disclosure", "found": False, "status": "Not Present", "severity": "High", "financial_impact": "$10,000 - $30,000 annually", "confidence": 75, "quote": None, "gap": "Ingredient cost disclosure still not required — plan cannot verify that billed amounts reflect actual acquisition cost", "explanation": "Ingredient cost disclosure was not secured in this negotiation. Without it, the plan cannot perform independent spread analysis even with audit rights."},
                 {"text": "Black box rebate reporting", "found": True, "status": "Partially Present", "severity": "High", "financial_impact": None, "confidence": 79, "quote": "Quarterly rebate reports shall include drug-level detail for rebate-eligible claims", "gap": "Drug-level rebate detail is now included but aggregate off-invoice revenue still not reported", "explanation": "Drug-level rebate reporting allows meaningful verification of the 100% pass-through commitment. Off-invoice payment reporting is the next transparency gap."},
                 {"text": "Aggregate-only reporting structures", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": None, "confidence": 73, "quote": "Quarterly reports shall include claim-level data upon Plan's written request", "gap": "Claim-level data is now available upon request — but not proactively provided, creating an ongoing access friction barrier", "explanation": "Access on request is better than no access, but plan sponsors will not consistently exercise this right. Default claim-level reporting would be the standard."},
                 {"text": "Non-itemized claim-level visibility", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 71, "quote": "Claim-level data including NDC, pharmacy, and days supply available upon written request", "gap": "Missing ingredient cost and reimbursement fields — data is partial without financial detail needed for spread analysis", "explanation": "Claim-level access is established but the financial fields needed for meaningful analysis (ingredient cost, dispensing fee, spread) are still not included."},
             ],
             "negotiation": {"gap_summary": "Transparency improved materially — rebate reporting is now drug-level and claim data is accessible on request. The next agenda: default claim-level reporting with full financial fields and ingredient cost disclosure", "model_language": "PBM shall provide claim-level data including NDC, ingredient cost, dispensing fee, and reimbursement as part of the standard quarterly reporting package.", "talking_point": "You can now see rebate data at the drug level and access claim data on request. The next step is making claim-level data with full financial detail the default, not an exception."}},
            {"id": 9, "name": "Performance Guarantees", "score": 6.0, "rating": "fair", "quick_look": "good",
             "issues": [
                 {"text": "Weak or non-binding performance quality levels (PQLs)", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 81, "quote": "PBM shall achieve a generic dispensing rate of no less than 85%, with a financial penalty of $X per percentage point of miss", "gap": None, "explanation": "Binding GDR guarantee with financial penalty is a meaningful improvement from 'commercially reasonable efforts' language."},
                 {"text": "Utilization threshold manipulation", "found": False, "status": "Partially Present", "severity": "Medium", "financial_impact": "$5,000 - $10,000 annually", "confidence": 72, "quote": "GDR shall be measured using Plan's claim data as verified by Plan's analytics platform", "gap": "Measurement methodology improved but GDR calculation still excludes specialty drugs — denominator manipulation remains possible", "explanation": "Plan-verified measurement is a meaningful improvement. Specialty drug exclusion from GDR denominator still allows PBM to inflate reported rates."},
                 {"text": "Bonus-driven misalignment incentives", "found": False, "status": "Not Present", "severity": "Medium", "financial_impact": "$5,000 - $15,000 annually", "confidence": 69, "quote": None, "gap": "PBM employee incentive structure disclosure not included in renegotiation", "explanation": "Incentive structure alignment was not addressed. PBM account team bonuses may still be tied to PBM revenue metrics rather than plan savings."},
                 {"text": "Penalty avoidance loopholes", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $20,000 annually", "confidence": 76, "quote": "Force majeure events shall not excuse performance guarantee penalties for periods exceeding 30 days", "gap": "30-day force majeure cap is improved but 'market disruption event' exemption category remains broad and PBM-defined", "explanation": "The 30-day cap prevents indefinite penalty avoidance under force majeure — a meaningful constraint. The 'market disruption event' carve-out remains a practical exemption mechanism."},
             ],
             "negotiation": {"gap_summary": "Binding GDR guarantee with financial penalty is secured — remaining agenda is specialty drug inclusion in GDR denominator and narrowing force majeure exemptions", "model_language": "GDR guarantee shall apply to all claims including specialty drugs. Force majeure exemptions shall require Plan's written consent for any exemption period.", "talking_point": "You now have a real GDR guarantee with teeth. The next step is making sure specialty drug exclusions don't allow the PBM to game the calculation."}},
            {"id": 10, "name": "Termination & Exit Barriers", "score": 6.5, "rating": "fair", "quick_look": "good",
             "issues": [
                 {"text": "Early termination penalties", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 90, "quote": "Early termination fees and liquidated damages are expressly waived. No payment shall be owed by Plan upon termination.", "gap": None, "explanation": "Exit penalties eliminated entirely — the most impactful termination clause change in the renegotiation."},
                 {"text": "Data export restrictions upon exit", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 83, "quote": "PBM shall provide complete data extract within 15 business days of termination notice in NCPDP format", "gap": None, "explanation": "Defined format, timeline, and no-charge commitment closes the data hostage risk at termination."},
                 {"text": "Contract lock-in renewal structures", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$50,000 - $150,000 opportunity cost", "confidence": 80, "quote": "Auto-renewal notice period reduced from 180 to 90 days", "gap": "90 days is improved but still creates a 3-month advance planning requirement — 60-day standard would be ideal", "explanation": "Going from 180 to 90 days halves the lock-in window. One more push to 60 days would align with market standards."},
                 {"text": "Financial penalties for switching PBMs", "found": True, "status": "Present", "severity": "Critical", "financial_impact": None, "confidence": 87, "quote": "PBM may not withhold any amounts owed to Plan, including rebates and data, against disputed termination claims", "gap": None, "explanation": "Offset prohibition closes the data and rebate hostage mechanism that allowed PBMs to weaponize plan assets during exit disputes."},
             ],
             "negotiation": {"gap_summary": "Major termination improvements — penalties eliminated, data export defined, offset rights removed. Final push: reduce auto-renewal notice to 60 days", "model_language": "Auto-renewal notice period reduced to 60 days. Without-cause termination may be elected upon 60 days notice.", "talking_point": "You've eliminated the exit trap. The 90-day auto-renewal notice is the last piece — push for 60 at the next cycle."}},
            {"id": 11, "name": "Claim Adjudication Logic", "score": 5.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Retroactive claim adjustment authority", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": "$5,000 - $20,000 annually", "confidence": 78, "quote": "Retroactive adjustments limited to 12 months and require written notice within 5 business days", "gap": "Notice requirement added and window halved — but PBM still retains the retroactive adjustment right without plan approval", "explanation": "Meaningful improvement. The next target is requiring plan consent for retroactive adjustments exceeding a defined dollar threshold."},
                 {"text": "Reversal discretion without notice", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 80, "quote": "PBM shall provide written notice of any claim reversal within 3 business days", "gap": None, "explanation": "Reversal notification requirement closes a significant transparency gap — the plan now has visibility into claim modifications."},
                 {"text": "Pricing recalculation ambiguity", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": "$5,000 - $15,000 annually", "confidence": 74, "quote": "Pricing logic updates require 30 days advance notice to Plan", "gap": "30-day notice is an improvement but plan still has no approval rights over pricing logic changes", "explanation": "Notice without approval means the PBM can still modify pricing methodology mid-year — with 30 days notice. Approval rights would be the standard."},
                 {"text": "Claim reprocessing opacity", "found": True, "status": "Present", "severity": "Medium", "financial_impact": None, "confidence": 77, "quote": "PBM shall provide quarterly summary of all claims reprocessed including reason and dollar impact", "gap": None, "explanation": "Quarterly reprocessing summary provides the audit trail needed to monitor adjudication changes over time."},
             ],
             "negotiation": {"gap_summary": "Adjudication transparency improved materially — notice requirements added for reversals, adjustments, and pricing changes. Next agenda: plan approval rights for adjustments above $10,000", "model_language": "Retroactive adjustments exceeding $10,000 in aggregate shall require Plan's written approval. Pricing logic changes require 30 days notice and Plan's right to object.", "talking_point": "You now get notified of adjustments and reversals. The next step is requiring approval for large retroactive changes rather than just notification."}},
            {"id": 12, "name": "Fiduciary & Legal Protections", "score": 5.5, "rating": "concern", "quick_look": "concern",
             "issues": [
                 {"text": "Explicit fiduciary duty disclaimers", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": None, "confidence": 82, "quote": "PBM acknowledges its obligations to act in the interests of Plan participants in connection with the administration of this Agreement", "gap": "Fiduciary disclaimer softened but not removed — 'acknowledges obligations' is weaker than 'accepts fiduciary status'", "explanation": "Meaningful progress — PBM can no longer claim zero obligation to participants. Full fiduciary acceptance would require explicit ERISA fiduciary language."},
                 {"text": "Indemnification asymmetry favoring PBM", "found": True, "status": "Present", "severity": "High", "financial_impact": None, "confidence": 79, "quote": "Indemnification obligations are mutual — each party indemnifies the other for claims arising from its own acts or omissions", "gap": None, "explanation": "Mutual indemnification is a significant improvement from a one-sided clause. This aligns financial risk with the party responsible for each decision."},
                 {"text": "Liability limitation clauses", "found": False, "status": "Partially Present", "severity": "High", "financial_impact": None, "confidence": 76, "quote": "PBM's liability shall not exceed 12 months of Plan spend under this Agreement", "gap": "Increased from 3 months to 12 months — meaningful improvement but still a cap that limits accountability for large-scale overcharges", "explanation": "Quadrupling the liability cap is a significant negotiating win. For major overcharging incidents, 12 months of spend provides meaningful recovery exposure for the PBM."},
                 {"text": "Conflict-of-interest non-disclosure", "found": False, "status": "Partially Present", "severity": "Critical", "financial_impact": None, "confidence": 73, "quote": "PBM shall disclose material conflicts of interest in writing within 30 days of each contract anniversary", "gap": "Annual disclosure of material conflicts is secured — but 'material' is self-defined by the PBM, allowing selective disclosure", "explanation": "Annual conflict disclosure is a meaningful step forward. The self-defined 'material' threshold allows the PBM to exclude conflicts it deems immaterial — which will systematically bias toward underdisclosure."},
             ],
             "negotiation": {"gap_summary": "Legal protections improved substantially — mutual indemnification, increased liability cap, and annual conflict disclosure. Full fiduciary acceptance and objective conflict materiality standard are the remaining agenda", "model_language": "PBM expressly accepts fiduciary status for purposes of benefit administration. Conflict-of-interest disclosure shall include all financial relationships with pharmaceutical manufacturers, pharmacies, and data vendors regardless of PBM's assessment of materiality.", "talking_point": "'Acknowledges obligations' is not the same as 'accepts fiduciary status.' Closing that language gap is worth pursuing — it changes your legal rights in a dispute."}},
            {"id": 13, "name": "Data Ownership & Access Rights", "score": 8.0, "rating": "good", "quick_look": "good",
             "issues": [
                 {"text": "PBM ownership of claims data", "found": True, "status": "Present", "severity": "Low", "financial_impact": None, "confidence": 92, "quote": "All claims data is the exclusive property of Plan Sponsor and shall not be used by PBM for any commercial purpose", "gap": None, "explanation": "Data ownership language is now explicit and includes commercial use restriction — a strong baseline for all data rights."},
                 {"text": "Delayed or incomplete data access", "found": True, "status": "Present", "severity": "Medium", "financial_impact": None, "confidence": 85, "quote": "Plan shall have access to claims data via a secure web portal with no more than 48-hour reporting lag", "gap": None, "explanation": "Real-time portal access with 48-hour lag is a significant improvement — plan can now monitor claims economics continuously rather than waiting for quarterly reports."},
                 {"text": "Restricted data portability/export rights", "found": True, "status": "Present", "severity": "Medium", "financial_impact": None, "confidence": 83, "quote": "Upon termination, PBM shall provide complete data extract in NCPDP D.0 format within 15 business days at no charge", "gap": None, "explanation": "Defined format standard (NCPDP D.0), timeline (15 days), and no-charge commitment complete the data portability picture. This is a best-practice provision."},
             ],
             "negotiation": {"gap_summary": "Data provisions are now best-in-class — real-time portal access, NCPDP format portability, and commercial use prohibition represent the full standard", "model_language": "No further changes needed in this provision — use this as the template for other contract areas.", "talking_point": "Data ownership is done. Redirect your negotiation energy to specialty drugs and off-invoice rebates — that's where the remaining leakage is."}},
        ]
    }


class UploadContractBody(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"
    data_b64: str
    pbm_name: Optional[str] = None


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
                "No readable text found in this file. "
                "If this is a scanned PDF (image-based), please export a text-layer version or copy-paste the contract text into a .txt file and upload that instead."
            ),
        )

    contract = models.RxDefenseContract(
        user_id=current_user.id,
        pbm_name=body.pbm_name,
        contract_filename=body.filename or "contract.pdf",
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
        db.query(models.RxDefenseContract)
        .filter(models.RxDefenseContract.user_id == current_user.id)
        .order_by(models.RxDefenseContract.created_at.desc())
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
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
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
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    db.delete(contract)
    db.commit()


@router.post("/contracts/{contract_id}/retry", status_code=202)
async def retry_contract_analysis(
    contract_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract.status not in ("error", "complete"):
        raise HTTPException(status_code=409, detail="Contract is already being analyzed")
    contract.status = "pending"
    contract.error_message = None
    db.commit()
    contract_text = contract.contract_text or ""
    background_tasks.add_task(run_analysis, contract.id, contract_text, db)
    return {"id": contract.id, "status": "analyzing"}


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
    contract_a = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == body.contract_a_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    contract_b = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_b_id,
        models.RxDefenseContract.user_id == current_user.id,
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
    contract = models.RxDefenseContract(
        user_id=current_user.id,
        pbm_name=body.pbm_name,
        contract_filename="demo_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    background_tasks.add_task(run_analysis, contract.id, "", db, use_demo=True)
    return {"id": contract.id, "status": "analyzing"}


@router.post("/demo-pair", status_code=202)
async def run_demo_pair(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    contract_a = models.RxDefenseContract(
        user_id=current_user.id,
        pbm_name="OptimaCare PBM — Original",
        contract_filename="original_contract.pdf",
        contract_text="",
        status="pending",
    )
    db.add(contract_a)
    db.commit()
    db.refresh(contract_a)

    contract_b = models.RxDefenseContract(
        user_id=current_user.id,
        pbm_name="OptimaCare PBM — Renegotiated",
        contract_filename="renegotiated_contract.pdf",
        contract_text="__renegotiated__",
        status="pending",
    )
    db.add(contract_b)
    db.commit()
    db.refresh(contract_b)

    background_tasks.add_task(run_analysis, contract_a.id, "", db, use_demo=True)
    background_tasks.add_task(_run_renegotiated_demo, contract_b.id, contract_a.id, db)

    return {"contract_a_id": contract_a.id, "contract_b_id": contract_b.id}


async def _run_renegotiated_demo(contract_b_id: str, contract_a_id: str, db: Session):
    import asyncio
    await asyncio.sleep(3)

    contract_b = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_b_id).first()
    if not contract_b:
        return

    try:
        contract_b.status = "analyzing"
        db.commit()

        result = _apply_modeled_impacts(_demo_renegotiated_analysis())
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

        await asyncio.sleep(1)
        await run_comparison(contract_a_id, contract_b_id, db)

    except Exception as e:
        db.rollback()
        contract_b = db.query(models.RxDefenseContract).filter(models.RxDefenseContract.id == contract_b_id).first()
        if contract_b:
            contract_b.status = "error"
            contract_b.error_message = str(e)
            db.commit()


# ── Dollar Exposure Estimator ────────────────────────────────────────────────

# Full-risk recoverable exposure per member per year (PMPY) for each provision.
# Calibrated so the all-provisions total (~$499 PMPY) stays a credible share of a
# typical commercial Rx spend (~$1,200–1,600 PMPY). After risk_fraction and
# recovery-rate haircuts, realized base-case savings land at a realistic ~8–16% of
# spend even for an egregious contract — not the implausible >100%-of-spend figures
# the prior constants produced.
_PROVISION_EXPOSURE_PMPY: dict[int, dict] = {
    1:  {"label": "Fiduciary Loyalty Commitment",        "pmpy": 8,    "category": "Legal / Liability"},
    2:  {"label": "Pass-Through Pharmacy Costs",         "pmpy": 140,  "category": "Spread Pricing"},
    3:  {"label": "Rebate & Manufacturer Revenue",       "pmpy": 75,   "category": "Rebate Leakage"},
    4:  {"label": "Data Ownership & Access",             "pmpy": 5,    "category": "Data Governance"},
    5:  {"label": "Audit Rights & Extrapolation",        "pmpy": 45,   "category": "Unrecoverable Overcharges"},
    6:  {"label": "Pharmacy Ownership & Neutrality",     "pmpy": 45,   "category": "Specialty Steering"},
    7:  {"label": "Carve-Out & Vendor Rights",           "pmpy": 25,   "category": "Flexibility Loss"},
    8:  {"label": "Lowest Net Cost & Clinical Integrity","pmpy": 50,   "category": "Formulary Waste"},
    9:  {"label": "Termination & Clean Exit",            "pmpy": 12,   "category": "Transition / Legal"},
    10: {"label": "Administrative Fee Verification",     "pmpy": 18,   "category": "Hidden Admin Costs"},
    11: {"label": "Step Therapy & Clinical Management",  "pmpy": 30,   "category": "Unnecessary Drug Spend"},
    12: {"label": "Mail Order & Specialty Steering",     "pmpy": 38,   "category": "Specialty Premium"},
    13: {"label": "Performance Guarantees & Remedies",   "pmpy": 8,    "category": "SLA Violations"},
}

# Realistic ceiling: even an egregious PBM contract cannot leak more than ~30% of
# total Rx spend. Every MODELED figure is scaled so it never exceeds this share.
# Mirrors the client-side ≤30% cap so the $ Exposure tab and Savings Report stay
# consistent.
_MAX_LEAKAGE_SHARE = 0.30
# Typical commercial Rx spend baseline (PMPY), used ONLY as the cap denominator
# when the plan's actual annual Rx spend is unknown, so the ≤30% ceiling ALWAYS
# binds instead of silently disabling the cap. Mirrors RX_ASSUMED_RX_PMPY in
# client/src/lib/pdfReports.ts.
_ASSUMED_RX_PMPY = 1400


def _effective_rx_spend(annual_rx_spend: Optional[float], members: int = 0) -> float:
    """Effective annual Rx spend used as the 30% cap denominator: the plan's
    actual spend when known, else a MODELED baseline (members × typical Rx PMPY)
    so the cap has a floor and can never be silently disabled."""
    if annual_rx_spend and annual_rx_spend > 0:
        return float(annual_rx_spend)
    m = members if (members and members > 0) else 500
    return float(m) * _ASSUMED_RX_PMPY


def _spend_cap_scale(modeled_total: float, annual_rx_spend: Optional[float], members: int = 0) -> float:
    """Return a ≤1.0 scale factor capping MODELED leakage at _MAX_LEAKAGE_SHARE of
    the effective Rx spend (actual when known, else a members-based baseline).
    Returns 1.0 only when the modeled total is already within the cap, so figures
    can never exceed 30% of pharmacy spend on any surface."""
    spend = _effective_rx_spend(annual_rx_spend, members)
    if spend <= 0 or modeled_total <= 0:
        return 1.0
    cap = spend * _MAX_LEAKAGE_SHARE
    if modeled_total <= cap:
        return 1.0
    return cap / modeled_total


def _compute_financial_impact(provision_id: int, score: float, members: int = 500, scale: float = 1.0) -> Optional[str]:
    """MODELED annual $ exposure range for a provision.

    Derived from _PROVISION_EXPOSURE_PMPY × members × risk_fraction,
    risk_fraction = (10 − score) / 10. `scale` is the aggregate ≤30% leakage-cap
    factor so per-provision figures never sum to more than the capped total.
    Returns a disclosed ±25% band string, or None when there is no residual
    exposure. Never a hardcoded constant.
    """
    meta = _PROVISION_EXPOSURE_PMPY.get(provision_id)
    if not meta:
        return None
    risk_fraction = max(0.0, (10.0 - float(score)) / 10.0)
    midpoint = risk_fraction * meta["pmpy"] * members * scale
    if midpoint <= 0:
        return None
    low = midpoint * 0.75
    high = midpoint * 1.25
    if midpoint >= 10000:
        low = round(low / 1000) * 1000
        high = round(high / 1000) * 1000
    return f"${low:,.0f} - ${high:,.0f} annually"


def _modeled_reference_exposure(provisions: list, members: int = 500, annual_rx_spend: Optional[float] = None) -> float:
    """MODELED total annual exposure across all provisions for a reference plan.
    Sum of member_count × PMPY × risk_fraction over _PROVISION_EXPOSURE_PMPY.
    Returns 0.0 when no provision scores are available (caller should treat as
    INSUFFICIENT_EVIDENCE rather than substituting a constant)."""
    score_map = {}
    for p in (provisions or []):
        try:
            score_map[int(p["id"])] = float(p.get("score", 5))
        except (KeyError, TypeError, ValueError):
            continue
    # No score evidence → INSUFFICIENT_EVIDENCE. Never substitute a constant or
    # assume midpoint scores; the caller must render INSUFFICIENT_EVIDENCE.
    if not score_map:
        return 0.0
    total = 0.0
    for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
        if pid not in score_map:
            continue
        risk_fraction = max(0.0, (10.0 - score_map[pid]) / 10.0)
        total += risk_fraction * meta["pmpy"] * members
    # Cap intrinsically at ≤30% of Rx spend — the plan's actual spend when known,
    # else a members-based baseline — so this fallback path can never exceed the
    # ceiling on any surface, whether or not the caller supplied a spend figure.
    total *= _spend_cap_scale(total, annual_rx_spend, members)
    return round(total)


def _apply_modeled_impacts(result: dict, members: int = 500) -> dict:
    """Replace any baked-in financial_impact strings on demo/analysis provisions
    with MODELED values computed at request time from the PMPY table.
    Issues with a non-null financial_impact are recomputed from their provision's
    id + score so figures always scale with the reference member count. A single
    aggregate ≤30% leakage-cap factor is applied to every provision so the
    issue-card dollars can never sum to more than the capped total."""
    # Raw (uncapped) aggregate exposure across scored provisions, then the same
    # ≤30% cap the totals use (spend unknown at analysis time → members baseline).
    raw_total = 0.0
    for prov in result.get("provisions", []):
        pid = prov.get("id")
        if pid is None:
            continue
        meta = _PROVISION_EXPOSURE_PMPY.get(int(pid))
        if not meta:
            continue
        rf = max(0.0, (10.0 - float(prov.get("score", 5))) / 10.0)
        raw_total += rf * meta["pmpy"] * members
    scale = _spend_cap_scale(raw_total, None, members)
    for prov in result.get("provisions", []):
        pid = prov.get("id")
        score = prov.get("score", 5)
        if pid is None:
            continue
        computed = _compute_financial_impact(int(pid), float(score), members, scale)
        for issue in prov.get("issues", []):
            if issue.get("financial_impact"):
                issue["financial_impact"] = computed
    return result


@router.get("/contracts/{contract_id}/exposure")
def get_contract_exposure(
    contract_id: str,
    members: int = 500,
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Dollar exposure estimator — returns per-provision and total annual exposure at risk."""
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    try:
        provisions = json.loads(contract.provision_scores or "[]")
    except Exception:
        provisions = []

    score_map = {p["id"]: float(p.get("score", 5)) for p in provisions}

    # First pass: raw (uncapped) PMPY-derived exposure.
    raw_items = []
    raw_total_exposure = 0.0
    raw_total_at_stake = 0.0
    for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
        score = score_map.get(pid, 5.0)
        risk_fraction = max(0.0, (10.0 - score) / 10.0)
        exposure = risk_fraction * meta["pmpy"] * members
        full_exposure = float(meta["pmpy"] * members)
        raw_total_exposure += exposure
        raw_total_at_stake += full_exposure
        raw_items.append((pid, meta, score, risk_fraction, exposure, full_exposure))

    # Anchor to actual Rx spend. Even the theoretical worst case (every score 0 —
    # the "total at stake") cannot leak more than ≤30% of pharmacy spend, so cap
    # the WORST-CASE total at 30% and scale the score-adjusted exposure by the
    # same factor. This guarantees NO exposure figure — current OR at-stake —
    # exceeds 30% of what the plan actually spends, while preserving their
    # ordering (at-stake ≥ current exposure).
    scale = _spend_cap_scale(raw_total_at_stake, annual_rx_spend, members)
    capped = scale < 1.0

    items = []
    total_exposure = 0
    total_at_stake = 0
    for pid, meta, score, risk_fraction, exposure, full_exposure in raw_items:
        exp = round(exposure * scale)
        full = round(full_exposure * scale)
        total_exposure += exp
        total_at_stake += full
        severity = "critical" if score < 3 else "high" if score < 5 else "medium" if score < 7 else "low"
        items.append({
            "provision_id": pid,
            "label": meta["label"],
            "category": meta["category"],
            "score": score,
            "pmpy_at_risk": meta["pmpy"],
            "exposure": exp,
            "full_exposure": full,
            "risk_fraction": round(risk_fraction, 2),
            "severity": severity,
        })

    items.sort(key=lambda x: -x["exposure"])

    # If annual Rx spend provided, also compute as % of spend
    spend_pct = round(total_exposure / annual_rx_spend * 100, 1) if annual_rx_spend else None

    return {
        "contract_id": contract_id,
        "members": members,
        "annual_rx_spend": annual_rx_spend,
        "total_exposure": total_exposure,
        "total_at_stake": total_at_stake,
        "exposure_as_pct_of_spend": spend_pct,
        "spend_capped": capped,
        "per_member_exposure": round(total_exposure / max(members, 1)),
        "items": items,
    }


# ── Executive Summary (AI Plain-English CFO Brief) ───────────────────────────

@router.get("/contracts/{contract_id}/executive-summary")
async def get_executive_summary(
    contract_id: str,
    members: int = 500,
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """AI-generated plain-English executive summary for CFO/HR Director."""
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    try:
        provisions = json.loads(contract.provision_scores or "[]")
        key_findings = json.loads(contract.key_findings or "[]")
    except Exception:
        provisions = []
        key_findings = []

    score = contract.overall_score or 0
    rating = contract.rating or "concern"
    pbm = contract.pbm_name or "your PBM"
    red_flags = [p for p in provisions if p.get("rating") in ("red_flag", "concern")]
    critical_findings = [f["text"] for f in key_findings if f.get("severity") == "critical"]

    # Hard dollar ceiling for anything this summary might quantify: modeled
    # savings/exposure can never exceed 30% of the plan's Rx spend (actual when
    # provided, else a members-based baseline). Fed to the LLM so the AI-authored
    # narrative cannot invent a figure above the cap.
    _cap_ceiling = round(_effective_rx_spend(annual_rx_spend, members) * _MAX_LEAKAGE_SHARE)

    try:
        prompt = f"""You are a senior benefits attorney writing a plain-English executive summary of a PBM contract analysis for a CFO or HR Director who is NOT a benefits expert.

PBM: {pbm}
Overall Score: {score:.0f}/100 ({rating.replace('_', ' ').title()})
Provisions with Concerns: {len(red_flags)} of 13
Critical Issues Found: {', '.join(critical_findings[:3]) if critical_findings else 'None identified'}

Write a 3-paragraph executive summary:
1. What this contract score means in plain business terms (one paragraph, no jargon)
2. The 2-3 biggest specific risks this plan sponsor faces RIGHT NOW
3. The one most important action to take in the next 30 days

HARD CONSTRAINT: If you cite any dollar figure for potential savings, recovery, or exposure, it MUST NOT exceed ${_cap_ceiling:,} (30% of this plan's annual Rx spend). Never state a savings or exposure number larger than ${_cap_ceiling:,}. Prefer describing risk qualitatively over inventing a dollar figure.

Keep it under 300 words. Be direct, not alarmist. Sound like a trusted advisor, not a lawyer.
Respond with JSON: {{"headline": "one strong headline sentence", "paragraphs": ["p1", "p2", "p3"], "action": "one specific next step"}}"""

        response = await openai_client.chat.completions.create(
            model="claude-opus-4-5",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=600,
        )
        result = _loads_llm_json(response.choices[0].message.content)
        result["ai_generated"] = True
        result["contract_fingerprint"] = _contract_fingerprint(score, provisions)
        _auto_save_exec_summary(result, contract_id, score, current_user.id, db)
        return result
    except Exception:
        # Rule-based fallback
        headline = f"Your PBM contract scored {score:.0f}/100 — {'significant gaps exist' if score < 60 else 'moderate improvements needed' if score < 80 else 'strong protections in place'}."
        _exec_exposure = _modeled_reference_exposure(provisions, members, annual_rx_spend)
        fallback = {
            "headline": headline,
            "paragraphs": [
                f"This contract with {pbm} scored {score:.0f} out of 100 against 65 fiduciary-aligned standards — putting it in the '{rating.replace('_', ' ')}' tier. Most commercial PBM contracts score between 30–60, so this score {'is below average and warrants immediate attention' if score < 45 else 'is in line with the market but still leaves your organization exposed' if score < 70 else 'is above average, though key gaps remain'}.",
                f"The analysis identified {len(red_flags)} provisions with significant gaps. {'The most critical: ' + critical_findings[0] if critical_findings else 'Key risks include spread pricing exposure, audit limitations, and rebate transparency.'} " + (
                    f"These gaps translate directly into dollars — for a {members:,}-member plan, MODELED annual exposure is approximately ${_exec_exposure:,.0f} (member_count × PMPY × risk_fraction).{' Enter your plan size for plan-specific figures.' if members == 500 else ''}"
                    if _exec_exposure > 0 else
                    "Provision-level scores are not yet available, so a plan-specific dollar exposure cannot be modeled — this is logged as INSUFFICIENT_EVIDENCE. Run a full provision analysis to quantify exposure."
                ),
                f"The most important next step is to request a contract amendment addressing the lowest-scoring provisions. Start with {red_flags[0]['name'] if red_flags else 'Pass-Through Pharmacy Costs'} — this single change can recover hundreds of thousands of dollars annually.",
            ],
            "action": f"Request a written amendment to {red_flags[0]['name'] if red_flags else 'spread pricing'} within 30 days. Use the model language in your Negotiation Guide.",
            "ai_generated": False,
        }
        fallback["contract_fingerprint"] = _contract_fingerprint(score, provisions)
        _auto_save_exec_summary(fallback, contract_id, score, current_user.id, db)
        return fallback


def _contract_fingerprint(score: float, provisions: list) -> str:
    """Stable fingerprint of the contract data that drives an executive summary.
    Changes whenever the overall score or any provision score changes."""
    try:
        parts = sorted(
            (str(p.get("id", "")), float(p.get("score", 0) or 0))
            for p in (provisions or [])
        )
        prov_str = ",".join(f"{pid}:{s:.2f}" for pid, s in parts)
        return f"{float(score or 0):.2f}|{prov_str}"
    except Exception:
        return ""


def _auto_save_exec_summary(result: dict, contract_id: str, score: float, user_id: str, db):
    """Silently persist an executive summary to the AI output history log."""
    try:
        from backend.routers.ai_history import save_history_internal
        save_history_internal(db, "rx_defense", contract_id, result, user_id=user_id, score=score)
    except Exception:
        pass


# ── Redline Generator ─────────────────────────────────────────────────────────

@router.get("/contracts/{contract_id}/redline")
def download_redline(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a Word (.docx) redline with model contract language for all weak provisions."""
    from docx import Document as DocxDocument
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from fastapi.responses import Response
    import io as _io

    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    try:
        guide = json.loads(contract.negotiation_guide or "[]")
    except Exception:
        guide = []

    doc = DocxDocument()

    # Title
    title = doc.add_heading("Rx Defense™ — Model Contract Language", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    meta = doc.add_paragraph()
    meta.add_run(f"PBM: {contract.pbm_name or 'N/A'}   |   Score: {contract.overall_score:.0f}/100   |   Generated by Kincaid IQ").bold = False
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()
    doc.add_paragraph(
        "The following provisions were identified as gaps in your PBM contract. "
        "Model language below is suggested for negotiation purposes only and should be reviewed by qualified counsel."
    )
    doc.add_paragraph()

    # Provisions below 7
    weak = sorted([p for p in guide if float(p.get("score", 10)) < 7], key=lambda x: x.get("score", 10))

    for p in weak:
        neg = p.get("negotiation", {})
        score = float(p.get("score", 0))
        score_label = "RED FLAG" if score < 3 else "CONCERN" if score < 5 else "FAIR"

        # Provision heading
        h = doc.add_heading(f"Provision {p['id']}: {p['name']} — Score {score:.1f}/10 [{score_label}]", level=2)
        h.runs[0].font.color.rgb = RGBColor(155, 28, 46) if score < 5 else RGBColor(180, 100, 0)

        # Gap summary
        if neg.get("gap_summary"):
            gap_para = doc.add_paragraph()
            gap_para.add_run("Gap: ").bold = True
            gap_para.add_run(neg["gap_summary"])

        # Model language in a bordered box (via paragraph shading)
        if neg.get("model_language"):
            doc.add_paragraph()
            lang_h = doc.add_paragraph()
            lang_h.add_run("SUGGESTED MODEL LANGUAGE:").bold = True
            lang_para = doc.add_paragraph(neg["model_language"])
            lang_para.paragraph_format.left_indent = Inches(0.3)
            lang_para.paragraph_format.right_indent = Inches(0.3)
            # Style the paragraph
            run = lang_para.runs[0] if lang_para.runs else lang_para.add_run(neg["model_language"])
            run.font.color.rgb = RGBColor(0, 80, 0)

        # Talking point
        if neg.get("talking_point"):
            tp = doc.add_paragraph()
            tp.add_run("Talking Point: ").bold = True
            tp.add_run(neg["talking_point"])

        # Gaps per issue
        issues = p.get("issues", [])
        missing = [i for i in issues if not i.get("found") and i.get("gap")]
        if missing:
            doc.add_paragraph()
            doc.add_paragraph().add_run("Missing Protections:").bold = True
            for issue in missing:
                bullet = doc.add_paragraph(style="List Bullet")
                bullet.add_run(issue.get("text", "")).bold = True
                if issue.get("gap"):
                    bullet.add_run(f" — {issue['gap']}")

        doc.add_paragraph()

    # Footer
    doc.add_paragraph()
    footer = doc.add_paragraph("This document is generated by Kincaid IQ · Rx Defense™. Not legal advice. © Kincaid Risk Management Consulting.")
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.runs[0].font.size = Pt(8)
    footer.runs[0].font.color.rgb = RGBColor(128, 128, 128)

    buf = _io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    raw = buf.read()

    # Auto-save redline generation to history
    try:
        from backend.routers.ai_history import save_history_internal
        guide_snapshot = []
        try:
            guide_snapshot = json.loads(contract.negotiation_guide or "[]")
        except Exception:
            pass
        weak_provisions = [
            {"id": p["id"], "name": p["name"], "score": p.get("score"), "negotiation": p.get("negotiation", {})}
            for p in guide_snapshot if float(p.get("score", 10)) < 7
        ]
        save_history_internal(
            db, "rx_defense", contract_id,
            {"type": "redline", "pbm_name": contract.pbm_name, "overall_score": contract.overall_score, "weak_provisions": weak_provisions},
            user_id=current_user.id,
            score=contract.overall_score,
            label="Redline generated",
        )
    except Exception:
        pass

    filename = f"rx_defense_redline_{contract.pbm_name or contract_id}.docx".replace(" ", "_")
    return Response(
        content=raw,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=manifest_headers(raw, filename=filename),
    )


# ── PBM Provision Benchmarks ──────────────────────────────────────────────────

_PBM_BENCHMARKS = {
    "CVS Caremark":    [3.5, 4.0, 4.5, 6.5, 4.0, 3.5, 5.5, 5.0, 3.5, 5.0, 6.0, 3.5, 5.5],
    "Express Scripts": [4.0, 4.5, 5.0, 7.0, 4.5, 4.0, 5.0, 5.5, 4.0, 5.5, 6.5, 4.0, 5.0],
    "OptumRx":         [3.0, 3.5, 4.0, 6.0, 3.5, 3.0, 4.5, 4.5, 3.0, 4.5, 5.5, 3.0, 4.5],
    "Industry Avg":    [3.8, 4.2, 4.7, 6.3, 4.1, 3.7, 5.1, 5.2, 3.7, 5.0, 6.0, 3.6, 5.2],
    "Best-in-Class":   [9.5, 9.0, 9.5, 9.0, 9.0, 8.5, 9.0, 9.0, 9.5, 8.5, 8.5, 8.5, 9.0],
}


@router.get("/benchmarks/provisions")
def get_provision_benchmarks(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Provision-level benchmark data for CVS Caremark, Express Scripts, OptumRx, Industry Avg, Best-in-Class."""
    provisions = [{"id": p["id"], "name": p["name"]} for p in PROVISIONS]
    return {
        "provisions": provisions,
        "benchmarks": _PBM_BENCHMARKS,
        "note": "Scores represent typical contract terms observed in the market. Individual contracts may vary.",
        "source": "Kincaid IQ Fiduciary Contract Intelligence Database — March 2026",
    }


# ── Portfolio Summary ─────────────────────────────────────────────────────────

@router.get("/portfolio")
def get_portfolio(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Aggregate portfolio view of all user contracts with risk summary."""
    contracts = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.user_id == current_user.id,
        models.RxDefenseContract.status == "complete",
    ).order_by(models.RxDefenseContract.created_at.desc()).all()

    if not contracts:
        return {"contracts": [], "aggregate": None}

    scores = [c.overall_score for c in contracts if c.overall_score is not None]
    ratings = [c.rating for c in contracts if c.rating]

    total_red_flags = 0
    for c in contracts:
        try:
            ps = json.loads(c.provision_scores or "[]")
            total_red_flags += sum(1 for p in ps if p.get("rating") == "red_flag")
        except Exception:
            pass

    return {
        "contracts": [
            {
                "id": c.id,
                "pbm_name": c.pbm_name,
                "filename": c.contract_filename,
                "score": c.overall_score,
                "rating": c.rating,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in contracts
        ],
        "aggregate": {
            "total_contracts": len(contracts),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "min_score": min(scores) if scores else None,
            "max_score": max(scores) if scores else None,
            "total_red_flags": total_red_flags,
            "contracts_below_50": sum(1 for s in scores if s < 50),
            "contracts_above_75": sum(1 for s in scores if s >= 75),
            "rating_distribution": {r: ratings.count(r) for r in set(ratings)},
        },
    }


@router.get("/index")
def rx_defense_accountability_index(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return {
        "updated": "March 2026",
        "description": "PBM contracts scored against 50 fiduciary-aligned issues across 10 provisions. Ratings based on explicit contract language only.",
        "tiers": [
            {"tier": "excellent", "range": "90-100", "pbms": ["PBM Direct+", "ClearPath Rx"]},
            {"tier": "good",      "range": "75-89",  "pbms": ["MedCore PBM", "TransparentRx", "AlignedHealth"]},
            {"tier": "fair",      "range": "60-74",  "pbms": ["MegaScript", "NationalPharm", "BenefitBridge"]},
            {"tier": "concern",   "range": "45-59",  "pbms": ["OptimaCare PBM", "RxAdvantage", "PharmaLink"]},
            {"tier": "red_flag",  "range": "<45",    "pbms": ["ConglomeratePBM", "HiddenFee Rx"]},
        ],
    }


# ── DOL Gap Analysis — Live from DuckDB ─────────────────────────────────────
from backend.duckdb import get_duck as _get_duck_rx

@router.get("/dol-gap")
def rx_dol_gap_analysis(
    ein: str = Query(None, description="Optional EIN for company-specific analysis"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Live PBM/Rx gap analysis from DOL Form 5500 Schedule H data"""
    duck = _get_duck_rx()

    # National benchmarks
    nat = duck.execute("""
        SELECT
            ROUND(100.0 * MEDIAN(BROKER_COMMISSIONS / NULLIF(WELFARE_PREMIUMS, 0)), 2) as median_broker_ratio,
            ROUND(MEDIAN(WELFARE_PREMIUMS), 0) as median_welfare_prem,
            ROUND(100.0 * MEDIAN(ADMIN_SERVICE_FEES_AMT / NULLIF(WELFARE_PREMIUMS, 0)), 2) as median_admin_ratio,
            ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS / NULLIF(WELFARE_PREMIUMS, 0)), 4) * 100 as p90_broker_ratio,
            COUNT(*) as total_plans
        FROM sch_h_2024
        WHERE WELFARE_PREMIUMS > 10000 AND BROKER_COMMISSIONS >= 0
    """).fetchone()

    benchmarks = {
        "median_broker_ratio_pct": float(nat[0] or 6.3),
        "median_welfare_prem": float(nat[1] or 947700),
        "median_admin_ratio_pct": float(nat[2] or 6.27),
        "p90_broker_ratio_pct": float(nat[3] or 18.5),
        "total_plans": int(nat[4] or 0),
    }

    # Company-specific if EIN provided
    company = None
    if ein:
        ein_clean = "".join(c for c in ein if c.isdigit())
        rows = duck.execute("""
            SELECT FORM_YEAR, WELFARE_PREMIUMS, BROKER_COMMISSIONS,
                   ADMIN_SERVICE_FEES_AMT, PARTICIPANTS, INVEST_MGMT_FEES_AMT
            FROM sch_h_2024
            WHERE EIN = ?
            ORDER BY FORM_YEAR DESC LIMIT 4
        """, [ein_clean]).fetchall()

        if rows:
            latest = rows[0]
            welfare = float(latest[1] or 0)
            broker = float(latest[2] or 0)
            admin = float(latest[3] or 0)
            participants = int(latest[4] or 1)
            invest = float(latest[5] or 0)

            broker_ratio = round(100.0 * broker / max(welfare, 1), 2)
            admin_ratio = round(100.0 * admin / max(welfare, 1), 2)
            prem_per_participant = round(welfare / max(participants, 1), 0)

            # Gap calculations
            broker_excess = max(0, broker - (benchmarks["median_broker_ratio_pct"] / 100 * welfare))
            admin_excess = max(0, admin - (benchmarks["median_admin_ratio_pct"] / 100 * welfare))
            total_recoverable = round((broker_excess + admin_excess) * 0.4)

            company = {
                "ein": ein_clean,
                "year": int(latest[0]),
                "welfare_premiums": round(welfare),
                "broker_commissions": round(broker),
                "admin_fees": round(admin),
                "invest_fees": round(invest),
                "participants": participants,
                "broker_ratio_pct": broker_ratio,
                "admin_ratio_pct": admin_ratio,
                "prem_per_participant": prem_per_participant,
                "broker_excess": round(broker_excess),
                "admin_excess": round(admin_excess),
                "total_recoverable": total_recoverable,
                "broker_vs_median": round(broker_ratio - benchmarks["median_broker_ratio_pct"], 2),
                "admin_vs_median": round(admin_ratio - benchmarks["median_admin_ratio_pct"], 2),
                "verdict": "Excessive" if broker_ratio > benchmarks["p90_broker_ratio_pct"] else "Elevated" if broker_ratio > benchmarks["median_broker_ratio_pct"] * 1.5 else "Aligned",
                "history": [
                    {
                        "year": int(r[0]),
                        "welfare": round(float(r[1] or 0)),
                        "broker": round(float(r[2] or 0)),
                        "admin": round(float(r[3] or 0)),
                        "broker_pct": round(100.0 * float(r[2] or 0) / max(float(r[1] or 1), 1), 2),
                    }
                    for r in rows
                ],
            }

    # Industry spread analysis (top broker ratio industries)
    spread = duck.execute("""
        SELECT BUSINESS_CODE,
               ROUND(100.0 * MEDIAN(BROKER_COMMISSIONS / NULLIF(WELFARE_PREMIUMS, 0)), 2) as broker_ratio,
               ROUND(MEDIAN(WELFARE_PREMIUMS) / 1000, 0) as median_prem_K,
               COUNT(*) as n
        FROM sch_h_2024
        WHERE WELFARE_PREMIUMS > 50000 AND BROKER_COMMISSIONS > 0
        GROUP BY BUSINESS_CODE HAVING COUNT(*) > 100
        ORDER BY broker_ratio DESC LIMIT 10
    """).fetchall()

    return {
        "benchmarks": benchmarks,
        "company": company,
        "industry_spread": [
            {"sic": r[0], "broker_ratio_pct": float(r[1]), "median_prem_K": float(r[2]), "plan_count": r[3]}
            for r in spread
        ],
        "gap_rules": [
            {"rule": "Broker Commission Ratio", "threshold_pct": benchmarks["median_broker_ratio_pct"], "p90_pct": benchmarks["p90_broker_ratio_pct"], "note": "Commissions > P90 = Excessive"},
            {"rule": "Admin Fee Ratio", "threshold_pct": benchmarks["median_admin_ratio_pct"], "note": "Admin > 2x median triggers fiduciary review"},
            {"rule": "Premium Per Participant", "threshold": "$1,701K (P75)", "note": "High welfare load = GLP-1 + specialty Rx exposure"},
        ],
    }


# ─── McKinsey-grade Savings Report ───────────────────────────────────────────
# Strategic Advisory deliverable — clause-by-clause damaging-provision analysis
# with savings waterfall, methodology appendix, and implementation roadmap.

_PROVISION_RECOVERY_RATE = {
    # fraction of full PMPY exposure that is realistically recoverable through
    # contract renegotiation (low / base / high case)
    1:  (0.60, 0.80, 0.95),  # Fiduciary Loyalty — pure legal protection
    2:  (0.45, 0.65, 0.85),  # Pass-Through Pharmacy Costs
    3:  (0.50, 0.70, 0.90),  # Rebate & Manufacturer Revenue
    4:  (0.70, 0.85, 0.95),  # Data Ownership
    5:  (0.40, 0.60, 0.80),  # Audit Rights
    6:  (0.35, 0.55, 0.75),  # Pharmacy Ownership
    7:  (0.50, 0.70, 0.85),  # Carve-Out Rights
    8:  (0.40, 0.60, 0.80),  # Lowest Net Cost
    9:  (0.65, 0.80, 0.95),  # Termination
    10: (0.55, 0.75, 0.90),  # Admin Fee Verification
    11: (0.35, 0.55, 0.75),  # Step Therapy
    12: (0.30, 0.50, 0.70),  # Mail Order Steering
    13: (0.55, 0.75, 0.90),  # Performance Guarantees
}

def _confidence_tier(score: float, has_quote: bool) -> str:
    if has_quote and score < 5:   return "CERTIFIED"
    if score < 6:                  return "MODELED"
    return "INSUFFICIENT_EVIDENCE"

def _severity_label(score: float) -> str:
    if score < 3: return "CRITICAL"
    if score < 5: return "HIGH"
    if score < 7: return "MODERATE"
    return "LOW"


@router.get("/contracts/{contract_id}/savings-report")
async def get_savings_report(
    contract_id: str,
    members: int = 1500,
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    McKinsey/Bain/Deloitte/Crowe-grade Strategic Advisory deliverable.
    Returns a fully structured savings report detailing every damaging clause:
    quoted contract language, economic mechanism, savings band (low/base/high),
    confidence tier, and model remediation language.
    """
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    try:
        provisions      = json.loads(contract.provision_scores  or "[]")
        guide           = json.loads(contract.negotiation_guide or "[]")
        key_findings    = json.loads(contract.key_findings      or "[]")
    except Exception:
        provisions, guide, key_findings = [], [], []

    guide_by_id = {int(g.get("id", 0)): g for g in guide}
    prov_by_id  = {int(p.get("id", 0)): p for p in provisions}

    # ── Deterministic savings math (cap-anchored + 30% hard clamp) lives in the
    # shared _savings_core helper so the Savings Report and the Dual-Engine
    # comparison can never disagree on dollars.
    core        = _savings_core(prov_by_id, members, annual_rx_spend)
    spend_scale = core["spend_scale"]
    total_low   = core["total_low"]
    total_base  = core["total_base"]
    total_high  = core["total_high"]

    # ── Build clause-by-clause findings (damaging only: score < 7) ──────────
    findings = []
    waterfall = []

    for pid, meta in _PROVISION_EXPOSURE_PMPY.items():
        cp = core["per"].get(pid)
        if cp is None:
            continue  # only damaging clauses (score >= 7 excluded by _savings_core)
        prov  = prov_by_id.get(pid, {})
        g     = guide_by_id.get(pid, {})
        score = cp["score"]

        risk_fraction   = cp["risk_fraction"]
        full_pmpy       = cp["full_pmpy"]
        rate_lo, rate_base, rate_hi = cp["rate_lo"], cp["rate_base"], cp["rate_hi"]
        annual_exposure = cp["annual_exposure"]
        save_low        = cp["save_low"]
        save_base       = cp["save_base"]
        save_high       = cp["save_high"]

        issues = prov.get("issues", []) or g.get("issues", [])
        red_issues = [i for i in issues
                      if (not i.get("found")) or i.get("severity") in ("Critical", "High")]
        present_quotes = [i.get("quote") for i in issues if i.get("quote")]
        has_quote = bool(present_quotes)

        neg = g.get("negotiation", {}) or {}

        # Recompute issue-level dollars at the SAME request-time cap scale as the
        # totals (actual spend when provided, else baseline) so issue-card figures
        # never drift above — or disagree with — the capped clause totals.
        issue_impact = _compute_financial_impact(pid, score, members, spend_scale)
        clause_issues = []
        for i in (red_issues or issues)[:8]:
            clause_issues.append({
                "text":             i.get("text", ""),
                "status":           i.get("status", "Not Present"),
                "severity":         i.get("severity", "Medium"),
                "quote":            i.get("quote"),
                "gap":              i.get("gap"),
                "mechanism_type":   i.get("mechanism_type"),
                "financial_impact": issue_impact if i.get("financial_impact") else None,
                "confidence":       i.get("confidence"),
                "explanation":      i.get("explanation"),
            })

        findings.append({
            "id":                 pid,
            "provision_name":     meta["label"],
            "category":           meta["category"],
            "score":              round(score, 1),
            "severity":           _severity_label(score),
            "confidence_tier":    _confidence_tier(score, has_quote),
            "economic_mechanism": neg.get("gap_summary") or (
                f"Plan sponsor protections in {meta['label']} score {score:.1f}/10. "
                f"Each percentage point below the fiduciary baseline of 7.0 translates to "
                f"~${round(full_pmpy * 0.10 * members * spend_scale):,}/yr of recoverable spend on a "
                f"{members:,}-member plan."
            ),
            "exposure": {
                "pmpy_at_full_risk":   full_pmpy,
                "risk_fraction":       round(risk_fraction, 2),
                "annual_exposure":     annual_exposure,
                "savings_low":         save_low,
                "savings_base":        save_base,
                "savings_high":        save_high,
                "recovery_rate_low":   rate_lo,
                "recovery_rate_base":  rate_base,
                "recovery_rate_high":  rate_hi,
            },
            "issues":          clause_issues,
            "remediation": {
                "model_language": neg.get("model_language"),
                "talking_point":  neg.get("talking_point"),
                "deadline":       "Within 60 days of executed addendum or next renewal cycle, whichever is sooner.",
            },
        })

        waterfall.append({
            "provision_id":  pid,
            "name":          meta["label"],
            "savings_base":  save_base,
            "savings_low":   save_low,
            "savings_high":  save_high,
        })

    findings.sort(key=lambda f: -f["exposure"]["savings_base"])
    waterfall.sort(key=lambda w: -w["savings_base"])

    overall_score = float(contract.overall_score or 0)
    pbm = contract.pbm_name or "Incumbent PBM"

    # ── Client label for the deliverable cover. Use the organization/plan-sponsor
    # name, never an individual's personal name or email, so reports stay
    # institution-addressed and no person is identified on the document.
    client_label = "Plan Sponsor"
    try:
        membership = (
            db.query(models.OrganizationMember)
            .filter(models.OrganizationMember.user_id == current_user.id)
            .first()
        )
        if membership:
            org = (
                db.query(models.Organization)
                .filter(models.Organization.id == membership.org_id)
                .first()
            )
            if org and org.name:
                client_label = org.name
    except Exception:
        client_label = "Plan Sponsor"

    # ── AI engagement narrative (situation / complication / resolution) ─────
    narrative = {
        "engagement_title":    f"PBM Contract Forensic Review — {pbm}",
        "situation":           "",
        "complication":        "",
        "resolution":          "",
    }
    try:
        top3 = findings[:3]
        top3_summary = "; ".join(
            f"{f['provision_name']} (score {f['score']}/10, save ${f['exposure']['savings_base']:,}/yr base case)"
            for f in top3
        ) or "no damaging provisions identified"

        prompt = f"""You are a senior partner at a Big 4 / MBB consulting firm authoring the executive narrative for a Strategic Advisory deliverable presented to a CFO and Plan Committee.

CONTEXT
- PBM under review: {pbm}
- Overall fiduciary protection score: {overall_score:.0f}/100
- Plan size: {members:,} members
- Damaging provisions identified: {len(findings)} of 13
- Base-case annual savings opportunity: ${total_base:,}
- Top 3 economic exposures: {top3_summary}

STRUCTURE (McKinsey Situation–Complication–Resolution)
Write exactly three paragraphs:

1. SITUATION — frame what the contract IS and the fiduciary standard it must meet. 3–4 sentences. Board-ready voice. No marketing language.
2. COMPLICATION — explain the specific structural deficiencies extracting value, anchored to ERISA §404(a) and §408(b)(2) where relevant. 3–4 sentences. Reference the dominant economic mechanisms found.
3. RESOLUTION — state the recommended path: amendment package, savings range, governance milestone. 3–4 sentences. Senior partner directness, no hedging.

Output JSON: {{"situation": "...", "complication": "...", "resolution": "..."}}
Total length under 380 words. No bullet points. No emojis.
"""
        response = await openai_client.chat.completions.create(
            model="claude-opus-4-5",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=900,
        )
        ai = _loads_llm_json(response.choices[0].message.content)
        narrative["situation"]    = ai.get("situation", "")
        narrative["complication"] = ai.get("complication", "")
        narrative["resolution"]   = ai.get("resolution", "")
        narrative["ai_generated"] = True
    except Exception:
        narrative["situation"] = (
            f"The Plan's current pharmacy benefit is administered by {pbm} under a contract scoring "
            f"{overall_score:.0f}/100 against a 65-issue fiduciary-aligned standard. ERISA §404(a) imposes "
            f"a duty of prudence on the Plan Committee to ensure that compensation paid to service providers "
            f"is reasonable in relation to services rendered."
        )
        narrative["complication"] = (
            f"Forensic review of the executed agreement surfaced {len(findings)} provisions operating below "
            f"the fiduciary baseline. The dominant economic mechanisms include spread pricing exposure, "
            f"rebate retention asymmetries, audit-right limitations, and opaque administrative fee structures. "
            f"On a plan of {members:,} members, the aggregate value-leakage exposure is estimated at "
            f"${total_low:,}–${total_high:,} annually (base case ${total_base:,})."
        )
        narrative["resolution"] = (
            f"We recommend a contract-amendment package addressing the {min(len(findings), 5)} highest-impact "
            f"provisions within 60 days, governed by a quarterly fiduciary-review cadence. Expected base-case "
            f"recovery is ${total_base:,}/year with no operational disruption to members. Failure to act "
            f"perpetuates exposure that is documentable, quantifiable, and recoverable through standard "
            f"contract-amendment mechanics — not litigation."
        )
        narrative["ai_generated"] = False

    # ── 30 / 60 / 90 day roadmap ────────────────────────────────────────────
    top_finding = findings[0] if findings else None
    roadmap = [
        {
            "horizon": "Days 0–30",
            "phase":   "Mobilize",
            "actions": [
                "Convene Plan Committee + ERISA counsel to ratify the savings-report findings.",
                f"Issue formal contract-amendment request to {pbm} citing the top {min(len(findings), 5)} damaging provisions.",
                "Lock baseline claims data and PMPM benchmarks for amendment validation.",
            ],
        },
        {
            "horizon": "Days 31–60",
            "phase":   "Negotiate",
            "actions": [
                f"Execute amendment package targeting ${total_base:,}/yr base-case recovery.",
                "Insert model language for pass-through pricing, audit rights, and data ownership.",
                "Secure performance guarantees with binding remedies (not credits-only).",
            ],
        },
        {
            "horizon": "Days 61–90",
            "phase":   "Govern",
            "actions": [
                "Establish quarterly fiduciary-review cadence with auditable scorecards.",
                "Activate independent claims audit on Q1 post-amendment data.",
                "Brief Plan Committee on realized savings and remaining exposure.",
            ],
        },
    ]

    spend_pct = round(total_base / annual_rx_spend * 100, 1) if annual_rx_spend else None

    return {
        "contract_id":    contract_id,
        "generated_at":   __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "engagement": {
            "firm":           "Kincaid Strategic Advisory",
            "practice":       "Pharmacy Benefit Integrity",
            "deliverable":    "Strategic Savings Report",
            "voice":          "Senior Partner — Big 4 / MBB standard",
            "client":         client_label,
            "pbm":            pbm,
            "members":        members,
            "annual_rx_spend": annual_rx_spend,
            "overall_score":  overall_score,
            "rating":         contract.rating or "concern",
        },
        "savings": {
            "total_low":           total_low,
            "total_base":          total_base,
            "total_high":          total_high,
            "savings_as_pct_of_spend": spend_pct,
            "per_member_savings":  round(total_base / max(members, 1)),
            "damaging_count":      len(findings),
            "provisions_total":    13,
            "spend_capped":        spend_scale < 1.0,
        },
        "narrative":   narrative,
        "findings":    findings,
        "waterfall":   waterfall,
        "roadmap":     roadmap,
        "methodology": {
            "framework":   "65-Issue Fiduciary–Economic Distortion Grid across 13 structural provision systems",
            "scoring":     "0–10 per provision based on plan-sponsor economic protection; overall = weighted avg scaled to 0–100",
            "exposure":    "PMPY at full-risk × (1 − score/10) × member count, calibrated to mid-market commercial plans; always capped at 30% of Rx spend (actual annual Rx spend when provided, else a members-based modeled baseline)",
            "recovery":    "Per-provision low/base/high recovery rates derived from observed amendment outcomes",
            "confidence":  "CERTIFIED (quoted clause + low score) · MODELED (inference) · INSUFFICIENT_EVIDENCE (no finding)",
            "sources": [
                "ERISA §404(a) duty of prudence",
                "ERISA §408(b)(2) reasonable compensation",
                "Consolidated Appropriations Act 2021 §202 — broker compensation disclosure",
                "DOL FAQs on health-plan transparency (2023, 2024)",
                "Form 5500 Schedule A / Schedule C filings",
            ],
            "disclaimers": [
                "Not legal advice. Review by qualified ERISA counsel required before action.",
                "Savings estimates are good-faith forecasts based on observed contract data and industry benchmarks; actuals vary by utilization, formulary mix, and negotiation outcomes.",
                "INSUFFICIENT_EVIDENCE designations are valid findings — they identify exposure the Plan cannot currently quantify.",
            ],
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  STRATEGIC REPORT — 12-Attorney ERISA Panel (McKinsey/Bain engagement)
# ══════════════════════════════════════════════════════════════════════════════

# Each attorney owns a slice of the 13-provision / 60-issue ontology and analyses
# the contract through a distinct doctrinal / economic lens. provision_ids maps the
# attorney to the PROVISIONS they primarily reason over.
RX_ATTORNEYS = [
    {
        "id": 1,
        "name": "Eleanor V. Ashford",
        "title": "ERISA §408(b)(2) Disclosure Counsel",
        "specialty": "Fiduciary Fee Disclosure",
        "provision_ids": [3, 8, 12],
        "framing": "Every dollar of PBM compensation the plan cannot see is a dollar the fiduciary cannot defend.",
        "system_prompt": (
            "You are Eleanor V. Ashford, ERISA §408(b)(2) Disclosure Counsel with 22 years advising "
            "self-funded plan sponsors. Your analytical lens is the covered-service-provider disclosure "
            "regime: direct vs. indirect compensation, the reasonableness standard of 29 CFR 2550.408b-2, "
            "and the non-exempt prohibited transaction that arises under §406(a)(1)(C) when required "
            "disclosures are absent. You map each contract provision to its disclosure obligation, flag "
            "compensation elements that are unreasonable or undisclosed, and identify where 'proprietary "
            "information' shields are used to defeat the statute. You write with board-room economy and "
            "cite the precise regulatory hook for each finding. You never hedge; an undisclosed spread or "
            "rebate is a fiduciary breach, stated plainly."
        ),
    },
    {
        "id": 2,
        "name": "Marcus D. Reyes",
        "title": "DOL Enforcement Strategist",
        "specialty": "Regulatory Enforcement",
        "provision_ids": [1, 2, 7],
        "framing": "Read the contract the way an EBSA investigator will: every ambiguity is an audit trigger.",
        "system_prompt": (
            "You are Marcus D. Reyes, a former DOL Employee Benefits Security Administration investigator now "
            "advising plan sponsors on enforcement exposure. Your lens is the agency's enforcement playbook: "
            "what triggers an investigation, what documents EBSA demands first, and which contract structures "
            "have produced settlements and 502(l) penalties. You identify the top audit triggers embedded in "
            "this contract, rank them by enforcement probability, and reference the pattern of enforcement "
            "actions and DOL advisory opinions that apply. You quantify enforcement exposure and describe the "
            "remediation that converts a red flag into a defensible position."
        ),
    },
    {
        "id": 3,
        "name": "Priya Chandrasekaran",
        "title": "CAA 2026 Compliance Partner",
        "specialty": "Transparency Compliance",
        "provision_ids": [8, 13, 9],
        "framing": "The Consolidated Appropriations Act turned transparency from best practice into binding law.",
        "system_prompt": (
            "You are Priya Chandrasekaran, CAA Compliance Partner specialising in the transparency mandates of "
            "the Consolidated Appropriations Act (2021 gag-clause prohibition, broker/consultant compensation "
            "disclosure, and the enhanced 2026 PBM transparency and rebate pass-through expectations). Your "
            "lens is statutory compliance: you build a compliance matrix across the CAA transparency rules, "
            "identify gag-clause and reporting gaps in the contract, and produce a gap-to-deadline assessment. "
            "You state, rule by rule, whether the contract is compliant, partially compliant, or exposed, and "
            "what attestation or amendment closes each gap."
        ),
    },
    {
        "id": 4,
        "name": "Daniel O. Brecht",
        "title": "Actuarial Economics Lead",
        "specialty": "Rebate & Spread Economics",
        "provision_ids": [1, 2, 3],
        "framing": "Contract language is a pricing mechanism; my job is to compute who captures the surplus.",
        "system_prompt": (
            "You are Daniel O. Brecht, FSA, MAAA, the actuarial economics lead. Your lens is quantitative: you "
            "model rebate flow timing and retention, spread pricing between reimbursement benchmarks, and "
            "AWP/WAC/NADAC distortion. You express exposure as formulae and per-1,000-member dollar estimates, "
            "stating assumptions explicitly. You distinguish CERTIFIED quantification (anchored to quoted "
            "contract terms) from MODELED estimates (inference with disclosed bounds). You never invent "
            "precision the contract does not support; where evidence is insufficient you say so and bound the "
            "range. Every number is justified by a structural property of the contract."
        ),
    },
    {
        "id": 5,
        "name": "Sophia L. Marchetti",
        "title": "Litigation Defense Counsel",
        "specialty": "Fiduciary Litigation",
        "provision_ids": [12, 7, 11],
        "framing": "Assume a complaint is already drafted; show me which clauses survive a motion to dismiss.",
        "system_prompt": (
            "You are Sophia L. Marchetti, ERISA litigation defense counsel. Your lens is exposure to breach-of-"
            "fiduciary-duty class actions: the Hughes v. Northwestern line, excessive-fee theories applied to "
            "PBM arrangements, and the statute-of-limitations framework under ERISA §413. You score the "
            "contract's class-action exposure, identify the clauses a plaintiff's bar would plead, assess "
            "indemnification asymmetry and liability-limitation enforceability, and lay out the documentation "
            "that builds a procedural-prudence defense. You write like a litigator preparing for deposition."
        ),
    },
    {
        "id": 6,
        "name": "James T. Okafor",
        "title": "Plan Sponsor Advocacy Lead",
        "specialty": "Sponsor & Participant Rights",
        "provision_ids": [12, 10, 9],
        "framing": "The plan exists for participants; every clause is judged by what it does to them.",
        "system_prompt": (
            "You are James T. Okafor, Plan Sponsor Advocacy Lead. Your lens is the inventory of rights the plan "
            "sponsor and participants hold or have surrendered: audit rights, data rights, termination freedom, "
            "and the duty of loyalty owed to beneficiaries. You build a rights inventory (present vs. missing), "
            "trace participant impact (cost-sharing, formulary access, steering), and identify where the "
            "contract subordinates beneficiary interests to PBM economics. You translate legal structure into "
            "participant consequence in plain, board-ready language."
        ),
    },
    {
        "id": 7,
        "name": "Hannah Goldberg",
        "title": "Formulary & Clinical Policy Counsel",
        "specialty": "Formulary Governance",
        "provision_ids": [4, 9, 6],
        "framing": "Formulary control is economic control dressed in clinical language.",
        "system_prompt": (
            "You are Hannah Goldberg, Formulary & Clinical Policy Counsel. Your lens is the governance of "
            "formulary design: unilateral PBM formulary authority, step-therapy and prior-authorization "
            "protocols, therapeutic substitution discretion, and tiering incentives that follow rebate dollars "
            "rather than clinical value. You analyse who controls formulary decisions, what override and notice "
            "rights the plan retains, and where clinical policy is a vehicle for rebate maximisation. You "
            "connect each governance gap to both clinical-access risk and economic distortion."
        ),
    },
    {
        "id": 8,
        "name": "Victor Ramirez",
        "title": "Specialty Pharmacy Practice Lead",
        "specialty": "Specialty Drug Management",
        "provision_ids": [6, 5, 3],
        "framing": "Specialty drugs are 2% of scripts and 50% of spend — and where the contract hides the most.",
        "system_prompt": (
            "You are Victor Ramirez, Specialty Pharmacy Practice Lead. Your lens is the management of high-cost "
            "specialty drugs: site-of-care steering, white/brown bagging mandates, specialty carve-out opacity, "
            "DIR-style fee exposure, and the separation of specialty rebates from the plan sponsor. You identify "
            "the provisions that concentrate margin in the PBM's specialty pharmacy, quantify the spend at risk, "
            "and specify the contractual controls (pass-through, transparency, channel choice) that realign "
            "specialty economics with the plan."
        ),
    },
    {
        "id": 9,
        "name": "Aisha N. Bello",
        "title": "Network Design & Access Counsel",
        "specialty": "Pharmacy Network",
        "provision_ids": [5, 4, 9],
        "framing": "Network design is a steering engine; the question is who it steers value toward.",
        "system_prompt": (
            "You are Aisha N. Bello, Network Design & Access Counsel. Your lens is pharmacy network architecture: "
            "preferred-pharmacy steering, differential reimbursement across pharmacies, mail-order coercion, "
            "any-willing-provider considerations, and spread capture engineered through network design. You "
            "assess network adequacy and access, identify steering mechanisms that move value to PBM-affiliated "
            "pharmacies, and prescribe the transparency and reimbursement-parity terms that neutralise the "
            "steering economics."
        ),
    },
    {
        "id": 10,
        "name": "Robert F. Kingsley",
        "title": "Audit Rights & Enforcement Lead",
        "specialty": "Audit & Recovery",
        "provision_ids": [7, 11, 1],
        "framing": "A right you cannot audit is a right you do not have.",
        "system_prompt": (
            "You are Robert F. Kingsley, Audit Rights & Enforcement Lead. Your lens is the plan's ability to "
            "verify and recover: audit scope limitations, lookback windows, extrapolation rights, data access "
            "during audit, recovery caps, and PBM-controlled audit methodology. You assess whether the contract "
            "lets the plan actually detect and claw back overcharges, identify the clauses that defeat recovery, "
            "and prescribe an enforcement ladder — from routine claims audit to extrapolated recovery and "
            "dispute resolution — that makes the plan's rights operational."
        ),
    },
    {
        "id": 11,
        "name": "Naomi Whitfield",
        "title": "Data Rights & Transparency Counsel",
        "specialty": "Data Ownership",
        "provision_ids": [13, 8, 11],
        "framing": "Whoever owns the claims data owns the leverage; everything else is negotiation.",
        "system_prompt": (
            "You are Naomi Whitfield, Data Rights & Transparency Counsel. Your lens is control of plan data: "
            "claims-data ownership, claim-level vs. aggregate-only reporting, de-identification restrictions, "
            "data portability and export rights on termination, and the PBM's reporting obligations. You "
            "determine whether the plan can obtain claim-level transparency and carry its data to a competitor, "
            "identify the clauses that trap data inside the PBM, and specify the ownership, access, and export "
            "terms required for genuine transparency and market mobility."
        ),
    },
    {
        "id": 12,
        "name": "Charles A. Whitman",
        "title": "Negotiation & Exit Strategy Partner",
        "specialty": "Negotiation & Termination",
        "provision_ids": [10, 9, 2],
        "framing": "Leverage is built before the renewal letter is sent; the exit clause is the whole negotiation.",
        "system_prompt": (
            "You are Charles A. Whitman, Negotiation & Exit Strategy Partner and the engagement's closer. Your "
            "lens is leverage: which term changes carry the largest dollar impact, how termination, data-export, "
            "and transition-support provisions either free or trap the plan, and the sequence in which to "
            "negotiate. You rank negotiation priorities by dollar impact, analyse the exit and lock-in "
            "structures, and produce a concrete 90-day action plan that converts the panel's findings into a "
            "negotiated outcome. You write like a managing partner handing the client a battle plan."
        ),
    },
]


def _provisions_for_attorney(attorney: dict, provisions: list) -> list:
    """Return the provision dicts most relevant to this attorney's domain."""
    ids = set(attorney.get("provision_ids", []))
    primary = [p for p in provisions if p.get("id") in ids]
    return primary if primary else provisions[:3]


def _summarize_provisions_for_prompt(provisions: list) -> str:
    lines = []
    for p in provisions:
        lines.append(f"\nProvision {p.get('id')} — {p.get('name')} (score {p.get('score', '?')}/10, {p.get('rating', '?')})")
        for issue in (p.get("issues") or [])[:8]:
            status = issue.get("status") or ("Present" if issue.get("found") else "Not Present")
            fin = issue.get("financial_impact") or "—"
            lines.append(f"   • {issue.get('text')} [{status} · {issue.get('severity', '?')} · {fin}]")
            if issue.get("quote"):
                lines.append(f"       quote: \"{str(issue['quote'])[:240]}\"")
            if issue.get("gap"):
                lines.append(f"       gap: {str(issue['gap'])[:240]}")
        neg = p.get("negotiation") or {}
        if neg.get("gap_summary"):
            lines.append(f"   negotiation gap: {str(neg['gap_summary'])[:280]}")
    return "\n".join(lines)


def _attorney_chapter_prompt(attorney: dict, ctx: dict) -> str:
    provisions = _provisions_for_attorney(attorney, ctx["provisions"])
    prov_text = _summarize_provisions_for_prompt(provisions)
    findings_text = "\n".join(
        f"   • [{f.get('severity', '?')}] {f.get('text')}" for f in ctx["key_findings"][:8]
    ) or "   • (no platform-level findings recorded)"

    return f"""You are contributing one chapter to a 100+ page institutional strategic report on a PBM contract, prepared by a 12-attorney ERISA panel operating as a McKinsey/Bain engagement.

ENGAGEMENT CONTEXT
- PBM: {ctx['pbm_name']}
- Overall contract score: {ctx['overall_score']:.0f}/100 ({ctx['rating']})
- Plan size assumption: {ctx['members']} members

YOUR DOMAIN: {attorney['title']} — {attorney['specialty']}
FRAMING STATEMENT: {attorney['framing']}

PLATFORM KEY FINDINGS (whole contract):
{findings_text}

PROVISION DATA MOST RELEVANT TO YOUR DOMAIN:
{prov_text}

Write your chapter as the named attorney. Be specific, cite the relevant ERISA/CAA/DOL/FTC hooks, quantify exposure where the data supports it, and tie every assertion to a structural property of the contract — no marketing language, no hedging. Where evidence is insufficient, say INSUFFICIENT_EVIDENCE rather than inventing a finding.

HARD CONSTRAINT: any dollar figure you cite for savings, recovery, or exposure — per finding or in total — MUST NOT exceed ${ctx['cap_ceiling']:,} (30% of the plan's annual Rx spend). Never state a number above ${ctx['cap_ceiling']:,}; use qualitative language instead when the modeled figure would exceed it.

Respond with ONLY valid JSON (no markdown):
{{
  "title": "a specific, board-ready chapter title for your domain analysis (max 9 words)",
  "risk_tier": "CERTIFIED|MODELED|INSUFFICIENT_EVIDENCE",
  "thesis": "2-3 sentence chapter thesis in your voice — the central argument of your domain analysis",
  "narrative": ["3-5 substantial analytical paragraphs (4-6 sentences each) developing your domain argument in depth: doctrinal framework, economic mechanism, how this contract's specific language creates or fails to close the exposure, and what a defensible posture looks like"],
  "findings": [
    {{"title": "short finding title", "severity": "Critical|High|Medium|Low", "analysis": "2-4 sentences of doctrinal/economic analysis", "regulatory_hook": "e.g. ERISA §408(b)(2)", "exposure": "dollar range or qualitative exposure or null"}}
  ],
  "recommendations": [
    {{"action": "specific recommended action", "rationale": "why it matters", "priority": "P1|P2|P3"}}
  ],
  "model_language": [
    {{"provision": "provision name", "language": "model contract clause that closes the gap"}}
  ],
  "key_quotes": ["notable contract quote or doctrinal principle relevant to this chapter"]
}}

Provide a title, 3-5 narrative paragraphs, 4-6 findings, 3-5 recommendations, 2-3 model_language entries, and 2-3 key_quotes. Write at depth — this chapter must stand as a substantive section of an institutional report."""


def _synthesis_prompt(chapters: list, ctx: dict) -> str:
    digest = []
    for ch in chapters:
        digest.append(f"\n[{ch['attorney']['title']}] tier={ch.get('risk_tier')} — {ch.get('thesis', '')}")
        for f in (ch.get("findings") or [])[:3]:
            digest.append(f"   • ({f.get('severity')}) {f.get('title')}")
    digest_text = "\n".join(digest)

    return f"""You are the Managing Partner of a 12-attorney ERISA strategic engagement, writing in the voice of a senior McKinsey partner overlaid with systems-engineering rigor. You have just read all 12 attorney chapters analyzing a PBM contract scored {ctx['overall_score']:.0f}/100 for {ctx['pbm_name']}.

THE 12 CHAPTER DIGESTS:
{digest_text}

Produce the engagement's executive synthesis. MECE structure, board-room directness, every claim justified by a structural property. No hedging, no marketing language.

HARD CONSTRAINT: any dollar figure you cite for savings, recovery, or exposure MUST NOT exceed ${ctx['cap_ceiling']:,} (30% of the plan's annual Rx spend). Never state a number above ${ctx['cap_ceiling']:,}.

Respond with ONLY valid JSON (no markdown):
{{
  "headline": "the single most important finding of the entire engagement, one sentence",
  "imperatives": [
    {{"title": "strategic imperative title", "detail": "2-3 sentences — the so-what and now-what"}}
  ],
  "bottom_line": "the board-ready bottom line — what the plan sponsor must conclude and do, 3-4 sentences",
  "structural_themes": [
    {{"theme": "cross-cutting structural vulnerability", "vulnerability": "why it is structural, not incidental", "remediation": "the single most leveraged remediation path"}}
  ],
  "board_slides": [
    {{"title": "slide title", "headline": "the one-line takeaway", "points": ["supporting point", "supporting point", "supporting point"]}}
  ]
}}

Provide exactly 3 imperatives, exactly 5 structural_themes, and exactly 4 board_slides (one per constitutional tile: Exposure, Compliance, Leverage, Roadmap)."""


def _fallback_chapter(attorney: dict, ctx: dict) -> dict:
    provisions = _provisions_for_attorney(attorney, ctx["provisions"])
    findings = []
    for p in provisions[:4]:
        score = float(p.get("score", 5) or 5)
        sev = "Critical" if score < 3 else "High" if score < 5 else "Medium" if score < 7 else "Low"
        neg = p.get("negotiation") or {}
        findings.append({
            "title": f"{p.get('name')} scored {score:.0f}/10",
            "severity": sev,
            "analysis": neg.get("gap_summary") or f"Provision {p.get('name')} presents structural exposure for the plan sponsor under this attorney's domain. The contract language does not adequately protect the plan against the economic distortion embedded in this provision.",
            "regulatory_hook": "ERISA §404(a) / §408(b)(2)",
            "exposure": next((i.get("financial_impact") for i in (p.get("issues") or []) if i.get("financial_impact")), None),
        })
    recs = []
    for p in provisions[:3]:
        neg = p.get("negotiation") or {}
        recs.append({
            "action": neg.get("talking_point") or f"Renegotiate {p.get('name')} to add fiduciary-aligned protections.",
            "rationale": "Closes the structural gap identified in this provision and realigns incentives toward the plan.",
            "priority": "P1" if float(p.get("score", 5) or 5) < 4 else "P2",
        })
    model_lang = []
    for p in provisions[:3]:
        neg = p.get("negotiation") or {}
        if neg.get("model_language"):
            model_lang.append({"provision": p.get("name"), "language": neg["model_language"]})
    quotes = []
    for p in provisions:
        for i in (p.get("issues") or []):
            if i.get("quote"):
                quotes.append(str(i["quote"]))
            if len(quotes) >= 3:
                break
        if len(quotes) >= 3:
            break
    spec = attorney["specialty"]
    narrative = [
        f"This chapter examines the {ctx['pbm_name']} contract through the lens of {spec.lower()}. {attorney['framing']} The contract's overall protection score of {ctx['overall_score']:.0f}/100 establishes a baseline of incomplete protection, and within this domain the structural posture mirrors that weakness: the provisions that should constrain the PBM's discretion instead preserve it, leaving the plan sponsor unable to verify, price, or recover the value at stake.",
        f"The doctrinal framework that governs this domain is unforgiving. ERISA imposes on the plan sponsor a duty of prudence and an exclusive-benefit obligation that cannot be delegated away by contract; where the agreement transfers control to the PBM without a corresponding right of verification, the fiduciary retains the duty but loses the means to discharge it. The relevant provisions here do not supply the transparency, audit, or governance rights a prudent expert would require, and that gap is structural rather than incidental — it is engineered into the contract's allocation of control.",
        f"Economically, the mechanism at work in {spec.lower()} converts informational advantage into retained margin. Each provision that withholds data, narrows audit scope, or vests unilateral discretion in the PBM is a lever that moves surplus away from the plan and its participants. For a plan of roughly {ctx['members']:,} members, even modest per-member distortions compound into material annual leakage, and because the contract renews on the PBM's terms, the exposure recurs and grows until the underlying language is amended.",
        f"A defensible posture in this domain is achievable but requires deliberate amendment rather than goodwill. The plan must convert discretionary PBM authority into contractually bounded obligations: disclosure that meets the §408(b)(2) reasonableness standard, audit and data rights that are operational rather than nominal, and economic terms that pass value through to the plan. The recommendations and model language below specify the precise changes that close this domain's gaps and restore the fiduciary's ability to defend the arrangement.",
    ]
    return {
        "title": f"{spec}: Structural Exposure Analysis",
        "narrative": narrative,
        "risk_tier": "MODELED",
        "thesis": f"{attorney['framing']} Across {attorney['specialty'].lower()}, this contract leaves the plan sponsor structurally exposed and requires targeted amendment.",
        "findings": findings or [{"title": "Insufficient evidence in domain", "severity": "Medium", "analysis": "The contract text did not yield sufficient detail to issue a certified finding in this domain.", "regulatory_hook": "ERISA §404(a)", "exposure": None}],
        "recommendations": recs or [{"action": "Request the full contract and exhibits for this domain.", "rationale": "Evidence is currently insufficient to quantify exposure.", "priority": "P2"}],
        "model_language": model_lang,
        "key_quotes": quotes or [attorney["framing"]],
    }


async def _generate_chapter(attorney: dict, ctx: dict) -> dict:
    try:
        prompt = _attorney_chapter_prompt(attorney, ctx)
        response = await openai_client.chat.completions.create(
            model="claude-opus-4-5",
            messages=[
                {"role": "system", "content": KIQ_VERIFY_HEADER + attorney["system_prompt"]},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=3200,
            temperature=0.4,
        )
        data = _loads_llm_json(response.choices[0].message.content)
        if not data.get("findings"):
            raise ValueError("empty findings")
        chapter = data
    except Exception:
        chapter = _fallback_chapter(attorney, ctx)
    chapter.setdefault("title", f"{attorney['specialty']}: Structural Exposure Analysis")
    if not chapter.get("narrative"):
        chapter["narrative"] = _fallback_chapter(attorney, ctx)["narrative"]
    chapter["attorney"] = {
        "id": attorney["id"],
        "name": attorney["name"],
        "title": attorney["title"],
        "specialty": attorney["specialty"],
        "framing": attorney["framing"],
    }
    return chapter


def _fallback_synthesis(chapters: list, ctx: dict) -> dict:
    crit = sum(
        1 for ch in chapters for f in (ch.get("findings") or [])
        if f.get("severity") == "Critical"
    )
    return {
        "headline": f"The {ctx['pbm_name']} contract scores {ctx['overall_score']:.0f}/100 and concentrates economic control in the PBM across every domain the panel reviewed.",
        "imperatives": [
            {"title": "Restore disclosure and fiduciary alignment", "detail": "The contract's compensation and rebate structures are not fully disclosed. Amend to compel §408(b)(2)-grade transparency before the next renewal."},
            {"title": "Make the plan's audit and data rights operational", "detail": "Audit scope, lookback, and data-export rights are restricted. Without operational rights, overcharges are structurally unrecoverable."},
            {"title": "Sequence the renegotiation by dollar impact", "detail": "Spread, rebate pass-through, and specialty economics carry the largest exposure. Lead the negotiation with these provisions."},
        ],
        "bottom_line": f"The panel identified {crit} critical findings across 12 domains. The plan sponsor cannot currently verify what it pays or recover what it overpays. A structured amendment — disclosure, audit rights, pass-through, and a clean exit — is required, and the leverage to obtain it exists at renewal.",
        "structural_themes": [
            {"theme": "Information asymmetry by design", "vulnerability": "Pricing, rebate, and claims data are withheld or aggregated, defeating verification.", "remediation": "Mandate claim-level transparency and data ownership."},
            {"theme": "Spread and rebate retention", "vulnerability": "Margin is captured between benchmarks and through retained rebates.", "remediation": "Convert to pass-through with 100% rebate remittance."},
            {"theme": "Unverifiable recovery rights", "vulnerability": "Audit scope and extrapolation are restricted, so overcharges cannot be clawed back.", "remediation": "Expand audit scope, lookback, and extrapolation rights."},
            {"theme": "Formulary and network steering", "vulnerability": "Clinical and network levers steer value to PBM-affiliated channels.", "remediation": "Impose reimbursement parity and formulary governance rights."},
            {"theme": "Exit friction", "vulnerability": "Termination penalties and data lock-in trap the plan.", "remediation": "Negotiate clean termination, data export, and transition support."},
        ],
        "board_slides": [
            {"title": "Financial Exposure", "headline": "Material, quantifiable, and recurring.", "points": ["Spread and rebate retention drive annual leakage", "Specialty drugs concentrate the largest spend at risk", "Exposure compounds at every renewal left unaddressed"]},
            {"title": "Regulatory Compliance", "headline": "Gaps against ERISA and CAA transparency.", "points": ["§408(b)(2) disclosure incomplete", "CAA gag-clause and reporting gaps present", "Enforcement triggers identified by the panel"]},
            {"title": "Negotiation Leverage", "headline": "The plan holds more leverage than it is using.", "points": ["Renewal timing creates the opening", "Data and audit rights are the highest-value asks", "Pass-through conversion is achievable in this market"]},
            {"title": "Implementation Roadmap", "headline": "A 90-day path to a defensible contract.", "points": ["0-30 days: disclosure and audit demands", "30-60 days: amendment drafting and benchmarking", "60-90 days: negotiated execution or RFP"]},
        ],
    }


async def _generate_synthesis(chapters: list, ctx: dict) -> dict:
    try:
        prompt = _synthesis_prompt(chapters, ctx)
        response = await openai_client.chat.completions.create(
            model="claude-opus-4-5",
            messages=[
                {"role": "system", "content": KIQ_VERIFY_HEADER + "You are the Managing Partner of an elite ERISA strategic advisory engagement. Senior McKinsey partner voice: MECE, board-room direct, every claim justified by a structural property. No hedging, no marketing language."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            max_tokens=2000,
            temperature=0.4,
        )
        data = _loads_llm_json(response.choices[0].message.content)
        if not data.get("imperatives") or not data.get("structural_themes"):
            raise ValueError("incomplete synthesis")
        return data
    except Exception:
        return _fallback_synthesis(chapters, ctx)


def _load_strategic_ctx(contract, members: int, annual_rx_spend: Optional[float] = None) -> dict:
    def parse(field):
        try:
            return json.loads(field) if field else []
        except Exception:
            return []

    provisions = parse(contract.negotiation_guide) or parse(contract.provision_scores)
    if not provisions:
        provisions = parse(contract.provision_scores)
    key_findings = parse(contract.key_findings)

    return {
        "pbm_name": contract.pbm_name or "the PBM",
        "overall_score": float(contract.overall_score or 0),
        "rating": (contract.rating or "concern").replace("_", " "),
        "members": members,
        # Hard dollar ceiling (30% of Rx spend, actual when known else baseline)
        # injected into every attorney/synthesis prompt so AI-authored strategic
        # figures can never exceed the platform-wide leakage cap.
        "cap_ceiling": round(_effective_rx_spend(annual_rx_spend, members) * _MAX_LEAKAGE_SHARE),
        "provisions": provisions,
        "key_findings": key_findings,
    }


def _build_strategic_payload(contract, ctx: dict, chapters: list, synthesis: dict) -> dict:
    return {
        "contract": {
            "id": contract.id,
            "pbm_name": contract.pbm_name,
            "contract_filename": contract.contract_filename,
            "overall_score": ctx["overall_score"],
            "rating": contract.rating,
            "members": ctx["members"],
            "provisions": ctx["provisions"],
            "key_findings": ctx["key_findings"],
        },
        "attorneys": [
            {"id": a["id"], "name": a["name"], "title": a["title"], "specialty": a["specialty"], "framing": a["framing"]}
            for a in RX_ATTORNEYS
        ],
        "chapters": chapters,
        "synthesis": synthesis,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }


@router.get("/contracts/{contract_id}/strategic-report")
async def strategic_report(
    contract_id: str,
    members: int = Query(500, ge=1),
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Generate a 100+ page institutional strategic report: 12 parallel attorney
    chapters plus a Managing Partner synthesis, returned as one JSON payload.
    Synchronous variant (used as a fallback); the job-based endpoints provide
    real per-attorney progress."""
    import asyncio

    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    ctx = _load_strategic_ctx(contract, members, annual_rx_spend)
    chapters = await asyncio.gather(*[_generate_chapter(a, ctx) for a in RX_ATTORNEYS])
    chapters = sorted(chapters, key=lambda c: c["attorney"]["id"])
    synthesis = await _generate_synthesis(chapters, ctx)
    payload = _build_strategic_payload(contract, ctx, chapters, synthesis)

    try:
        from backend.routers.ai_history import save_history_internal
        save_history_internal(db, "rx_defense_strategic", contract_id, {"headline": synthesis.get("headline"), "chapters": len(chapters)}, user_id=current_user.id, score=ctx["overall_score"])
    except Exception:
        pass

    return payload


# ── Job-based strategic report (real per-attorney progress) ──────────────────
# In-memory job store. Single-process uvicorn deployment; jobs are short-lived
# and pruned on creation. Keyed by job_id.
_STRATEGIC_JOBS: dict = {}
_STRATEGIC_JOB_TTL = 1800  # seconds


def _prune_strategic_jobs():
    import time
    now = time.time()
    stale = [jid for jid, j in _STRATEGIC_JOBS.items() if now - j.get("created_at", now) > _STRATEGIC_JOB_TTL]
    for jid in stale:
        _STRATEGIC_JOBS.pop(jid, None)


async def _run_strategic_job(job_id: str, contract_meta: dict, ctx: dict):
    import asyncio
    job = _STRATEGIC_JOBS.get(job_id)
    if job is None:
        return

    chapters_by_id: dict = {}

    async def run_one(attorney: dict):
        job["attorney_status"][attorney["id"]] = "active"
        chapter = await _generate_chapter(attorney, ctx)
        chapters_by_id[attorney["id"]] = chapter
        job["attorney_status"][attorney["id"]] = "done"
        return chapter

    try:
        await asyncio.gather(*[run_one(a) for a in RX_ATTORNEYS])
        chapters = [chapters_by_id[a["id"]] for a in RX_ATTORNEYS]
        chapters = sorted(chapters, key=lambda c: c["attorney"]["id"])
        job["synthesis_status"] = "active"
        synthesis = await _generate_synthesis(chapters, ctx)
        job["synthesis_status"] = "done"

        class _Meta:
            pass
        meta = _Meta()
        meta.id = contract_meta["id"]
        meta.pbm_name = contract_meta["pbm_name"]
        meta.contract_filename = contract_meta["contract_filename"]
        meta.rating = contract_meta["rating"]
        job["payload"] = _build_strategic_payload(meta, ctx, chapters, synthesis)
        job["status"] = "complete"
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


@router.post("/contracts/{contract_id}/strategic-report/start")
async def strategic_report_start(
    contract_id: str,
    members: int = Query(500, ge=1),
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Kick off a strategic-report job and return a job_id immediately. The 12
    attorney chapters are generated concurrently; each attorney's status flips to
    'done' as its chapter actually completes, so the client can render real
    per-attorney progress via the status endpoint."""
    import asyncio
    import uuid

    _prune_strategic_jobs()

    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if contract.status != "complete":
        raise HTTPException(400, "Contract analysis not complete")

    ctx = _load_strategic_ctx(contract, members, annual_rx_spend)
    job_id = uuid.uuid4().hex
    _STRATEGIC_JOBS[job_id] = {
        "created_at": __import__("time").time(),
        "user_id": current_user.id,
        "contract_id": contract_id,
        "status": "running",
        "attorney_status": {a["id"]: "pending" for a in RX_ATTORNEYS},
        "synthesis_status": "pending",
        "payload": None,
        "error": None,
    }
    contract_meta = {
        "id": contract.id,
        "pbm_name": contract.pbm_name,
        "contract_filename": contract.contract_filename,
        "rating": contract.rating,
    }
    asyncio.create_task(_run_strategic_job(job_id, contract_meta, ctx))

    return {
        "job_id": job_id,
        "attorneys": [
            {"id": a["id"], "name": a["name"], "title": a["title"], "specialty": a["specialty"], "framing": a["framing"]}
            for a in RX_ATTORNEYS
        ],
    }


@router.get("/strategic-report/jobs/{job_id}")
async def strategic_report_status(
    job_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Poll a strategic-report job. Returns per-attorney status as chapters
    complete, then the full payload once the synthesis is done."""
    job = _STRATEGIC_JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found or expired")
    if job.get("user_id") != current_user.id:
        raise HTTPException(403, "Not authorized for this job")

    done = job["status"] == "complete"
    if done and not job.get("_saved"):
        job["_saved"] = True
        try:
            from backend.routers.ai_history import save_history_internal
            synthesis = (job.get("payload") or {}).get("synthesis") or {}
            save_history_internal(
                db, "rx_defense_strategic", job["contract_id"],
                {"headline": synthesis.get("headline"), "chapters": len(RX_ATTORNEYS)},
                user_id=current_user.id, score=(job.get("payload") or {}).get("contract", {}).get("overall_score"),
            )
        except Exception:
            pass

    return {
        "job_id": job_id,
        "status": job["status"],
        "attorney_status": job["attorney_status"],
        "synthesis_status": job["synthesis_status"],
        "error": job.get("error"),
        "report": job["payload"] if done else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dual-engine comparison — score the SAME contract with Claude AND OpenAI, then
# let the user pick whichever savings estimate they trust as the active analysis.
# ─────────────────────────────────────────────────────────────────────────────
# Server-side cache of the last dual-engine run per contract. /select-engine only
# ever persists a result that THIS server produced (looked up here by engine name)
# so a client can never inject a fabricated analysis by posting an arbitrary body.
_DUAL_RUN_CACHE: "dict[str, dict]" = {}
_DUAL_RUN_CACHE_MAX = 256


def _cache_dual_run(contract_id: str, results: dict) -> None:
    kept = {k: v for k, v in results.items() if isinstance(v, dict) and v.get("provisions")}
    if not kept:
        return
    _DUAL_RUN_CACHE.pop(contract_id, None)
    _DUAL_RUN_CACHE[contract_id] = kept
    while len(_DUAL_RUN_CACHE) > _DUAL_RUN_CACHE_MAX:
        _DUAL_RUN_CACHE.pop(next(iter(_DUAL_RUN_CACHE)))


def _engine_savings_summary(res, engine: str, model: str, members: int,
                            annual_rx_spend: Optional[float]) -> dict:
    """Turn one engine's raw analysis result into a compact savings summary using
    the shared _savings_core math so both engines are compared on identical rules."""
    if isinstance(res, Exception) or not isinstance(res, dict):
        return {
            "engine": engine, "model": model, "ok": False,
            "error": str(res) if isinstance(res, Exception) else "No result returned.",
        }
    res = _apply_modeled_impacts(res)
    provisions = res.get("provisions", [])
    prov_by_id = {int(p.get("id", 0)): p for p in provisions}
    core = _savings_core(prov_by_id, members, annual_rx_spend)
    top = sorted(
        [
            {
                "id": pid,
                "name": _PROVISION_EXPOSURE_PMPY[pid]["label"],
                "score": core["per"][pid]["score"],
                "save_low": core["per"][pid]["save_low"],
                "save_base": core["per"][pid]["save_base"],
                "save_high": core["per"][pid]["save_high"],
            }
            for pid in core["per"]
        ],
        key=lambda x: -x["save_base"],
    )
    overall = float(res.get("overall_score", 45))
    spend_pct = (
        round(core["total_base"] / annual_rx_spend * 100, 1)
        if annual_rx_spend else None
    )
    return {
        "engine": engine, "model": model, "ok": True,
        "overall_score": overall,
        "rating": score_to_rating(overall),
        "damaging_count": len(core["per"]),
        "savings": {
            "low": core["total_low"],
            "base": core["total_base"],
            "high": core["total_high"],
            "spend_pct": spend_pct,
        },
        "top_provisions": top[:6],
        "result": res,  # full result echoed back so /select-engine can persist it
    }


@router.post("/contracts/{contract_id}/dual-savings")
async def dual_savings(
    contract_id: str,
    members: int = 1500,
    annual_rx_spend: Optional[float] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Analyze the same contract with BOTH Claude and OpenAI in parallel and
    return each engine's savings estimate side by side so the user can pick the
    one they trust. Requires readable source text (demo contracts can't be
    re-scored)."""
    import asyncio
    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")
    if not contract.contract_text or len(contract.contract_text.strip()) < 100:
        raise HTTPException(
            400,
            "This contract has no readable source text to re-analyze. "
            "Dual-engine scoring needs the original uploaded contract.",
        )

    claude_res, openai_res = await asyncio.gather(
        _analyze_with("claude", contract.contract_text),
        _analyze_with("openai", contract.contract_text),
        return_exceptions=True,
    )

    claude_sum = _engine_savings_summary(
        claude_res, "claude", "claude-sonnet-4-6", members, annual_rx_spend)
    openai_sum = _engine_savings_summary(
        openai_res, "openai", "gpt-5", members, annual_rx_spend)

    # Cache the server-produced results so /select-engine can persist exactly what
    # was shown without trusting a client-supplied payload.
    _cache_dual_run(contract_id, {
        "claude": claude_sum.get("result") if claude_sum.get("ok") else None,
        "openai": openai_sum.get("result") if openai_sum.get("ok") else None,
    })

    # Strip the bulky raw result from the wire response — it is no longer needed by
    # the client now that selection is server-authoritative.
    claude_sum.pop("result", None)
    openai_sum.pop("result", None)

    return {
        "contract_id": contract_id,
        "members": members,
        "annual_rx_spend": annual_rx_spend,
        "cap_note": (
            f"All savings figures are hard-capped at {int(_MAX_LEAKAGE_SHARE * 100)}% "
            f"of effective Rx spend, identically for both engines."
        ),
        "claude": claude_sum,
        "openai": openai_sum,
    }


class SelectEngineBody(BaseModel):
    engine: str


@router.post("/contracts/{contract_id}/select-engine")
def select_engine(
    contract_id: str,
    body: SelectEngineBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Persist a chosen engine's analysis as the contract's active analysis, so
    every other tab (scorecard, savings report, negotiation, etc.) reflects the
    engine the user selected in the dual-engine comparison. The result applied is
    the one THIS server produced in the most recent dual-savings run (looked up by
    engine name) — never a client-supplied payload."""
    engine = (body.engine or "").strip().lower()
    if engine not in ("claude", "openai"):
        raise HTTPException(400, "engine must be 'claude' or 'openai'.")

    contract = db.query(models.RxDefenseContract).filter(
        models.RxDefenseContract.id == contract_id,
        models.RxDefenseContract.user_id == current_user.id,
    ).first()
    if not contract:
        raise HTTPException(404, "Contract not found")

    cached = _DUAL_RUN_CACHE.get(contract_id, {})
    result = cached.get(engine)
    if not isinstance(result, dict) or not result.get("provisions"):
        raise HTTPException(
            409,
            "No cached analysis for that engine. Re-run the dual-engine comparison "
            "and then apply an engine.",
        )

    _persist_analysis(contract, result)
    contract.status = "complete"
    contract.error_message = None
    db.commit()
    return {
        "ok": True,
        "engine": engine,
        "overall_score": contract.overall_score,
        "rating": contract.rating,
    }
