import os, re, json, logging
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from backend.duckdb import get_duck
from backend.database import get_db
from backend.models import DiscoveredContact

router = APIRouter(prefix="/api/contact-intel", tags=["contact-intel"])
logger = logging.getLogger("kincaid.contact_intel")

HUNTER_KEY = os.getenv("HUNTER_API_KEY", "")
ANTHROPIC_KEY = os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")

PRIORITY_TITLES = [
    "benefits", "human resources", "hr director", "vp hr", "chief human",
    "director of benefits", "plan administrator", "compensation", "total rewards",
    "cfo", "chief financial", "controller", "vp finance", "treasurer",
    "ceo", "president", "chief executive", "chief operating", "coo",
]


def _infer_domain(company_name: str) -> str:
    remove = r"\b(inc|incorporated|llc|corp|corporation|ltd|limited|co|company|group|services|solutions|healthcare|health|plan|insurance|holding|holdings|associates|advisors|management|consulting|industries|international|national|systems|technology|technologies|usa|america|american)\b"
    clean = re.sub(remove, "", company_name.lower(), flags=re.IGNORECASE)
    clean = re.sub(r"[^a-z0-9\s]", "", clean).strip()
    words = [w for w in clean.split() if len(w) > 1][:2]
    slug = "".join(words)
    return (slug or re.sub(r"[^a-z0-9]", "", company_name.lower())) + ".com"


def _priority_score(email: dict) -> int:
    title = (email.get("position") or "").lower()
    return sum(1 for kw in PRIORITY_TITLES if kw in title)


@router.get("/state-summary")
def state_summary():
    duck = get_duck()
    rows = duck.execute("""
        SELECT state, COUNT(*) as cnt
        FROM employers
        WHERE state IS NOT NULL AND TRIM(state) != ''
        GROUP BY state
        ORDER BY cnt DESC
    """).fetchall()
    return {r[0]: r[1] for r in rows if r[0]}


@router.get("/state-prospects")
def state_prospects(state: str, limit: int = 30):
    duck = get_duck()
    rows = duck.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, total_welfare_premiums, has_health, has_stop_loss
        FROM employers
        WHERE UPPER(state) = UPPER(?)
        ORDER BY max_participants DESC
        LIMIT ?
    """, [state, limit]).fetchall()
    return [
        {
            "ein": r[0], "name": r[1], "plan": r[2], "state": r[3], "city": r[4],
            "year": r[5], "participants": r[6], "welfare_premiums": r[7],
            "has_health": r[8], "has_stop_loss": r[9],
            "inferred_domain": _infer_domain(r[1]),
        }
        for r in rows
    ]


@router.get("/search-employers")
def search_employers(q: str, limit: int = 12):
    duck = get_duck()
    rows = duck.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year, max_participants,
               total_welfare_premiums, has_health, has_stop_loss
        FROM employers
        WHERE LOWER(employer_name) LIKE ?
        ORDER BY max_participants DESC
        LIMIT ?
    """, [f"%{q.lower()}%", limit]).fetchall()
    return [
        {
            "ein": r[0], "name": r[1], "plan": r[2], "state": r[3], "city": r[4],
            "year": r[5], "participants": r[6], "welfare_premiums": r[7],
            "has_health": r[8], "has_stop_loss": r[9],
            "inferred_domain": _infer_domain(r[1]),
        }
        for r in rows
    ]


@router.get("/lookup-employer/{ein}")
def lookup_employer(ein: str):
    duck = get_duck()
    rows = duck.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city, latest_year,
               max_participants, total_welfare_premiums, has_health, has_stop_loss
        FROM employers WHERE EIN = ?
    """, [ein]).fetchall()
    if not rows:
        rows2 = duck.execute("""
            SELECT DISTINCT EIN, SPONS_DFE_NAME, PLAN_NAME_LS, STATE, CITY,
                   FORM_YEAR, PARTICIPANTS
            FROM sch_h_2024 WHERE EIN = ?
            ORDER BY FORM_YEAR DESC LIMIT 1
        """, [ein]).fetchall()
        if not rows2:
            raise HTTPException(404, "No employer found for EIN " + ein)
        r = rows2[0]
        return {
            "ein": r[0], "name": r[1], "plan": r[2], "state": r[3], "city": r[4],
            "year": r[5], "participants": r[6], "welfare_premiums": 0,
            "has_health": False, "has_stop_loss": False,
            "inferred_domain": _infer_domain(r[1]),
        }
    r = rows[0]
    return {
        "ein": r[0], "name": r[1], "plan": r[2], "state": r[3], "city": r[4],
        "year": r[5], "participants": r[6], "welfare_premiums": r[7],
        "has_health": r[8], "has_stop_loss": r[9],
        "inferred_domain": _infer_domain(r[1]),
    }


class DiscoverRequest(BaseModel):
    ein: str
    employer_name: str
    plan_name: str
    participants: int
    welfare_premiums: float


@router.post("/discover")
async def discover_contact(req: DiscoverRequest, db: Session = Depends(get_db)):
    if not HUNTER_KEY:
        raise HTTPException(422, "HUNTER_API_KEY is not configured. Add it as a secret to enable email discovery.")

    # Step 1: Auto-discover domain via Hunter company search
    domain = ""
    all_emails: list = []
    organization = req.employer_name

    async with httpx.AsyncClient(timeout=20.0) as client:
        company_resp = await client.get(
            "https://api.hunter.io/v2/domain-search",
            params={"company": req.employer_name, "api_key": HUNTER_KEY, "limit": 20},
        )

    if company_resp.status_code == 200:
        cdata = company_resp.json().get("data", {})
        domain = cdata.get("domain", "")
        all_emails = cdata.get("emails", [])
        organization = cdata.get("organization", req.employer_name) or req.employer_name
        logger.info(f"[ContactIntel] Hunter company search found domain: {domain} for '{req.employer_name}'")

    # Step 2: If Hunter didn't return a domain, fall back to inferred domain + re-search
    if not domain:
        domain = _infer_domain(req.employer_name)
        logger.info(f"[ContactIntel] Using inferred domain '{domain}' for '{req.employer_name}'")
        async with httpx.AsyncClient(timeout=20.0) as client:
            ds_resp = await client.get(
                "https://api.hunter.io/v2/domain-search",
                params={"domain": domain, "api_key": HUNTER_KEY, "limit": 20},
            )
        if ds_resp.status_code == 200:
            ds_data = ds_resp.json().get("data", {})
            all_emails = ds_data.get("emails", [])
            organization = ds_data.get("organization", req.employer_name) or req.employer_name

    if not all_emails and not domain:
        raise HTTPException(404, f"Could not locate email contacts for '{req.employer_name}'. Try a different employer.")

    top5 = sorted(all_emails, key=_priority_score, reverse=True)[:5]

    verified = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for e in top5[:3]:
            addr = e.get("value", "")
            if not addr:
                continue
            vr = await client.get(
                "https://api.hunter.io/v2/email-verifier",
                params={"email": addr, "api_key": HUNTER_KEY},
            )
            v_data = vr.json().get("data", {}) if vr.status_code == 200 else {}
            verified.append({
                "email": addr,
                "first_name": e.get("first_name", ""),
                "last_name": e.get("last_name", ""),
                "position": e.get("position", ""),
                "confidence": e.get("confidence", 0),
                "result": v_data.get("result", "unknown"),
                "score": v_data.get("score", 0),
                "disposable": v_data.get("disposable", False),
                "mx_records": v_data.get("mx_records", True),
            })

    best = next(
        (v for v in verified if v["result"] == "deliverable"),
        next((v for v in verified if v["result"] != "invalid"), verified[0] if verified else None),
    )

    contact_name = f"{best['first_name']} {best['last_name']}".strip() if best else "Benefits Leader"
    contact_title = (best.get("position") or "Benefits Administrator") if best else "Benefits Administrator"

    ai_result = {"subject_lines": [], "email_body": ""}
    if ANTHROPIC_KEY:
        prompt = f"""You are drafting an executive-level business development communication for Kincaid IQ — a fiduciary intelligence platform purpose-built for employer-sponsored health plan sponsors, ERISA plan administrators, and their advisors.

Target recipient:
- Name: {contact_name}
- Title: {contact_title}
- Organization: {organization}
- Plan Name: {req.plan_name}
- Covered Lives: {req.participants:,}
- Welfare Premiums (DOL Form 5500, public record): ${req.welfare_premiums:,.0f}

Drafting standards:
1. Open with a precise reference to their plan's public DOL Form 5500 filing — frame this as publicly available fiduciary data, not surveillance. The tone should convey that you are peer, not vendor.
2. Identify one specific, legally grounded risk with precision: either (a) CAA §204 PBM spread pricing obligations and pass-through enforcement gaps, (b) ERISA §408(b)(2) fee disclosure deficiencies creating prohibited transaction exposure for named plan fiduciaries, or (c) CAA 2026 comparative effectiveness and mental health parity enforcement under MHPAEA — select the most compelling for a plan of this size.
3. Articulate the cost of inaction in concrete terms — personal liability under ERISA §409, DOL civil monetary penalties under §502(c), or recoverable overpayments as a percentage of welfare premiums.
4. Request a focused 20-minute working session — frame it as showing them what their own plan's data looks like inside Kincaid IQ, not a sales pitch.
5. Tone: direct, measured, and executive-to-executive. Avoid superlatives, marketing language, and platitudes. Write as a senior advisor who has read their filing, not as a vendor who bought a list.
6. Length: three paragraphs, under 180 words. Every sentence must earn its place.

Return ONLY valid JSON in this exact format:
{{"subject_lines": ["subject 1", "subject 2", "subject 3"], "email_body": "the full email text here"}}

Subject lines should be specific, non-promotional, and reference a concrete legal or financial concept — not a value proposition."""

        try:
            from backend import anthropic_compat as anthropic
            ant = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
            msg = ant.messages.create(
                model="claude-opus-4-5",
                max_tokens=700,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = msg.content[0].text.strip()
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                ai_result = json.loads(m.group())
        except Exception as e:
            logger.warning(f"AI draft failed: {e}")
            ai_result = {
                "subject_lines": [
                    f"{organization} — ERISA §408(b)(2) disclosure compliance and fee exposure",
                    f"DOL Form 5500 — {req.participants:,} covered lives, CAA §204 PBM obligations",
                    f"Fiduciary liability exposure in {organization}'s health plan",
                ],
                "email_body": (
                    f"Dear {contact_name},\n\n"
                    f"Your organization's DOL Form 5500 filing reflects a self-funded welfare benefit plan covering {req.participants:,} participants with ${req.welfare_premiums:,.0f} in reported welfare premiums — plan data that is publicly available and actively reviewed by DOL enforcement staff. "
                    f"For plans of this size, two statutory obligations are frequently unaddressed: ERISA §408(b)(2) requires written fee disclosure from every covered service provider before or upon execution of any service agreement — deficiencies constitute prohibited transactions attaching personal liability to named plan administrators regardless of intent; and CAA §204 requires PBM contracts to prohibit spread pricing and mandates pass-through pricing — non-compliant contracts expose the plan to retroactive recovery claims and DOL referral.\n\n"
                    f"Kincaid IQ is a fiduciary intelligence platform that maps your plan's contractual and statutory exposure against public DOL data and current enforcement priorities. Plans our clients have analyzed have identified, on average, recoverable overpayments of 9–14% of annual welfare spend.\n\n"
                    f"I would welcome the opportunity to spend twenty minutes showing you what your plan's data surfaces inside Kincaid IQ — not a presentation, but your actual filings reviewed in real time. Would that be worthwhile?\n\n"
                    f"Regards,\n[Your name]\nKincaid IQ  |  kincaidiq.com"
                ),
            }

    # Fallback draft if Anthropic key not set or result is empty
    if not ai_result.get("email_body"):
        ai_result = {
            "subject_lines": [
                f"{organization} — ERISA §408(b)(2) disclosure compliance and fee exposure",
                f"DOL Form 5500 — {req.participants:,} covered lives, CAA §204 PBM obligations",
                f"Fiduciary liability exposure in {organization}'s health plan",
            ],
            "email_body": (
                f"Dear {contact_name},\n\n"
                f"Your organization's DOL Form 5500 filing reflects a self-funded welfare benefit plan covering {req.participants:,} participants with ${req.welfare_premiums:,.0f} in reported welfare premiums — plan data that is publicly available and actively reviewed by DOL enforcement staff. "
                f"For plans of this size, two statutory obligations are frequently unaddressed: ERISA §408(b)(2) requires written fee disclosure from every covered service provider before or upon execution of any service agreement — deficiencies constitute prohibited transactions attaching personal liability to named plan administrators regardless of intent; and CAA §204 requires PBM contracts to prohibit spread pricing and mandates pass-through pricing — non-compliant contracts expose the plan to retroactive recovery claims and DOL referral.\n\n"
                f"Kincaid IQ is a fiduciary intelligence platform that maps your plan's contractual and statutory exposure against public DOL data and current enforcement priorities. Plans our clients have analyzed have identified, on average, recoverable overpayments of 9–14% of annual welfare spend.\n\n"
                f"I would welcome the opportunity to spend twenty minutes showing you what your plan's data surfaces inside Kincaid IQ — not a presentation, but your actual filings reviewed in real time. Would that be worthwhile?\n\n"
                f"Regards,\n[Your name]\nKincaid IQ  |  kincaidiq.com"
            ),
        }

    # Auto-save best contact to discovered_contacts table
    saved_contact_id = None
    if best:
        try:
            contact_rec = DiscoveredContact(
                ein=req.ein,
                employer_name=req.employer_name,
                plan_name=req.plan_name,
                city=None,
                state=None,
                participants=req.participants,
                welfare_premiums=req.welfare_premiums,
                domain=domain,
                first_name=best.get("first_name", ""),
                last_name=best.get("last_name", ""),
                email=best.get("email", ""),
                position=best.get("position", ""),
                confidence=best.get("confidence"),
                verification_result=best.get("result"),
                verification_score=best.get("score"),
                outreach_subject=(ai_result.get("subject_lines") or [None])[0],
                outreach_body=ai_result.get("email_body", ""),
                status="new",
            )
            db.add(contact_rec)
            db.commit()
            db.refresh(contact_rec)
            saved_contact_id = contact_rec.id
            logger.info(f"[ContactIntel] Saved contact {contact_rec.email} (id={contact_rec.id})")
        except Exception as e:
            db.rollback()
            logger.warning(f"[ContactIntel] Failed to save contact: {e}")

    return {
        "employer": {
            "name": organization,
            "plan_name": req.plan_name,
            "participants": req.participants,
            "welfare_premiums": req.welfare_premiums,
            "domain": domain,
        },
        "hunter_meta": {
            "total_emails_found": len(all_emails),
            "organization": organization,
        },
        "candidates": [
            {
                "email": e.get("value", ""),
                "first_name": e.get("first_name", ""),
                "last_name": e.get("last_name", ""),
                "position": e.get("position", ""),
                "confidence": e.get("confidence", 0),
                "sources": len(e.get("sources", [])),
            }
            for e in top5
        ],
        "verified": verified,
        "best_contact": best,
        "outreach": ai_result,
        "saved_contact_id": saved_contact_id,
    }


# ─── Contacts Database CRUD ────────────────────────────────────────────────────

class ContactUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


@router.get("/contacts")
def list_contacts(
    state: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    q = db.query(DiscoveredContact)
    if state:
        q = q.filter(DiscoveredContact.state == state.upper())
    if status:
        q = q.filter(DiscoveredContact.status == status)
    contacts = q.order_by(DiscoveredContact.discovered_at.desc()).limit(limit).all()
    return [
        {
            "id": c.id,
            "ein": c.ein,
            "employer_name": c.employer_name,
            "plan_name": c.plan_name,
            "city": c.city,
            "state": c.state,
            "participants": c.participants,
            "welfare_premiums": c.welfare_premiums,
            "domain": c.domain,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "email": c.email,
            "position": c.position,
            "confidence": c.confidence,
            "verification_result": c.verification_result,
            "verification_score": c.verification_score,
            "outreach_subject": c.outreach_subject,
            "outreach_body": c.outreach_body,
            "status": c.status,
            "notes": c.notes,
            "discovered_at": c.discovered_at.isoformat() if c.discovered_at else None,
        }
        for c in contacts
    ]


@router.patch("/contacts/{contact_id}")
def update_contact(contact_id: int, body: ContactUpdateRequest, db: Session = Depends(get_db)):
    c = db.query(DiscoveredContact).filter(DiscoveredContact.id == contact_id).first()
    if not c:
        raise HTTPException(404, "Contact not found")
    if body.status is not None:
        c.status = body.status
    if body.notes is not None:
        c.notes = body.notes
    db.commit()
    return {"ok": True, "id": c.id, "status": c.status, "notes": c.notes}


@router.delete("/contacts/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    c = db.query(DiscoveredContact).filter(DiscoveredContact.id == contact_id).first()
    if not c:
        raise HTTPException(404, "Contact not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
