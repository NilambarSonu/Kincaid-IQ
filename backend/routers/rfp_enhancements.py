"""
RFP Intelligence OS — Enhancements (lightweight, self-contained).

Seven model-health / pipeline-hygiene improvements that wrap the existing RFP
OS data without touching the high-churn intake / intelligence routers:

  #1  GET  /api/rfp/scoring/validation          — "score the score": Brier, AUC,
                                                   calibration of the win-prob model
  #2  POST /api/rfp/opportunities/{id}/hubspot-sync — push an opp to HubSpot as a deal
  #3  POST /api/rfp/accounts/promote            — promote a watched account → pipeline
  #5  GET  /api/rfp/bid/alpha-fit               — empirical price-elasticity from outcomes
  #6  GET  /api/rfp/pipeline/stale              — high-value opps going stale / overdue
  #7  GET  /api/rfp/accounts/duplicates         — entity resolution / dedupe clusters

(#4 — Monte Carlo deal correlation — is a backward-compatible enhancement to the
 shared client forecast lib, not a backend endpoint.)

Every numeric finding is labeled with a confidence tier per the platform doctrine
(CERTIFIED / MODELED / INSUFFICIENT_EVIDENCE); findings below 5 records return
INSUFFICIENT_EVIDENCE rather than a fabricated number.
"""
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

logger = logging.getLogger("kincaid.rfp_enhancements")
router = APIRouter(prefix="/api/rfp", tags=["rfp-enhancements"])

_MIN_EVIDENCE = 5            # doctrine: below this, INSUFFICIENT_EVIDENCE
_CERTIFIED_EVIDENCE = 12     # enough decided records to call a metric CERTIFIED
_TERMINAL_STAGES = {"won", "lost", "no_bid"}


# ── shared helpers ──────────────────────────────────────────────────────────────

def _tier(n: int) -> str:
    if n < _MIN_EVIDENCE:
        return "INSUFFICIENT_EVIDENCE"
    return "CERTIFIED" if n >= _CERTIFIED_EVIDENCE else "MODELED"


def _predicted_win_prob(opp: "models.RfpOpportunity") -> Optional[float]:
    """The model's predicted win probability (0..1) at scoring time, or None."""
    import json
    raw: Optional[float] = None
    if opp.score_breakdown:
        try:
            bd = json.loads(opp.score_breakdown)
            if isinstance(bd, dict) and bd.get("win_probability") is not None:
                raw = float(bd["win_probability"])
        except Exception:
            pass
    if raw is None and opp.opportunity_score is not None:
        raw = float(opp.opportunity_score)
    if raw is None:
        return None
    # Mirror the forecast lib's getWinProb(opp, factor=1) exactly so the metrics
    # validate the SAME probabilities the pipeline forecast uses: base win prob is
    # (score/100)*0.80 clamped to [0.02, 0.80].
    p = max(min((raw / 100.0) * 0.80, 0.80), 0.02)
    return p


_CORP_SUFFIXES = {
    "inc", "incorporated", "llc", "l.l.c", "corp", "corporation", "co", "company",
    "ltd", "limited", "lp", "llp", "plc", "pllc", "group", "holdings", "the",
}


def _normalize_name(name: Optional[str]) -> str:
    if not name:
        return ""
    s = name.lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    toks = [t for t in s.split() if t and t not in _CORP_SUFFIXES]
    return " ".join(toks).strip()


def _as_dt(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y"):
        try:
            return datetime.strptime(str(value)[:19], fmt).replace(tzinfo=timezone.utc)
        except Exception:
            continue
    return None


# ── #1 — score the score ─────────────────────────────────────────────────────────

@router.get("/scoring/validation")
def scoring_validation(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Validate the opportunity score against realized outcomes (Brier, AUC, calibration)."""
    wl = (
        db.query(models.RfpWinLoss)
        .filter(models.RfpWinLoss.user_id == user.id)
        .filter(models.RfpWinLoss.outcome.in_(["won", "lost"]))
        .all()
    )
    pairs: list[tuple[float, int]] = []  # (predicted prob, label)
    for r in wl:
        opp = (
            db.query(models.RfpOpportunity)
            .filter(models.RfpOpportunity.id == r.opportunity_id)
            .first()
        )
        if not opp:
            continue
        p = _predicted_win_prob(opp)
        if p is None:
            continue
        pairs.append((p, 1 if r.outcome == "won" else 0))

    n = len(pairs)
    if n < _MIN_EVIDENCE:
        return {
            "tier": "INSUFFICIENT_EVIDENCE",
            "n": n,
            "needed": _MIN_EVIDENCE,
            "message": f"Only {n} scored+decided deals on record. Need {_MIN_EVIDENCE} to validate the model.",
            "brier": None, "auc": None, "calibration": [],
            "method": "Brier = mean((p−y)²); AUC = P(p_won > p_lost) (Mann–Whitney, ties=0.5).",
        }

    # Brier score (lower is better; 0.25 = uninformative coin flip)
    brier = sum((p - y) ** 2 for p, y in pairs) / n

    # AUC via pairwise comparison
    won = [p for p, y in pairs if y == 1]
    lost = [p for p, y in pairs if y == 0]
    auc: Optional[float] = None
    if won and lost:
        wins = 0.0
        for pw in won:
            for pl in lost:
                if pw > pl:
                    wins += 1
                elif pw == pl:
                    wins += 0.5
        auc = wins / (len(won) * len(lost))

    # Calibration buckets (5 bins of 20pp)
    bins = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]
    calibration = []
    for lo, hi in bins:
        members = [(p, y) for p, y in pairs if lo <= p < hi]
        if not members:
            calibration.append({"range": f"{int(lo*100)}–{int(min(hi,1)*100)}%", "count": 0,
                                "predicted": None, "observed": None})
            continue
        pred = sum(p for p, _ in members) / len(members)
        obs = sum(y for _, y in members) / len(members)
        calibration.append({
            "range": f"{int(lo*100)}–{int(min(hi,1)*100)}%",
            "count": len(members),
            "predicted": round(pred, 4),
            "observed": round(obs, 4),
        })

    return {
        "tier": _tier(n),
        "n": n, "n_won": len(won), "n_lost": len(lost),
        "brier": round(brier, 4),
        "auc": round(auc, 4) if auc is not None else None,
        "calibration": calibration,
        "interpretation": {
            "brier": "0.0 perfect · 0.25 = coin flip · lower is better",
            "auc": "0.5 = no skill · 0.7+ useful · 1.0 = perfect ranking",
        },
        "method": "Brier = mean((p−y)²); AUC = P(p_won > p_lost) (Mann–Whitney, ties=0.5); "
                  "calibration compares mean predicted vs. observed win rate per 20pp band.",
    }


# ── #5 — empirical bid price-elasticity ──────────────────────────────────────────

@router.get("/bid/alpha-fit")
def bid_alpha_fit(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """Fit the price-elasticity α from real bid-vs-outcome history via grid search."""
    import math
    wl = (
        db.query(models.RfpWinLoss)
        .filter(models.RfpWinLoss.user_id == user.id)
        .filter(models.RfpWinLoss.outcome.in_(["won", "lost"]))
        .all()
    )
    samples: list[tuple[float, int]] = []  # (price_ratio r, label)
    for r in wl:
        close = r.contract_value or r.realized_revenue
        if not close or close <= 0:
            continue
        opp = (
            db.query(models.RfpOpportunity)
            .filter(models.RfpOpportunity.id == r.opportunity_id)
            .first()
        )
        if not opp:
            continue
        anchor = opp.estimated_contract_value or (
            (opp.covered_lives or 0) * 600 if opp.covered_lives else 0
        ) or 60000
        ratio = close / anchor
        if ratio <= 0 or ratio > 5:
            continue
        samples.append((ratio, 1 if r.outcome == "won" else 0))

    n = len(samples)
    if n < _MIN_EVIDENCE:
        return {
            "tier": "INSUFFICIENT_EVIDENCE", "n": n, "needed": _MIN_EVIDENCE,
            "message": f"Only {n} priced+decided deals. Need {_MIN_EVIDENCE} to fit elasticity.",
            "alpha": None, "base_win_prob": None, "buckets": [],
            "method": "P(win|r) = p_base · exp(−α·max(r−1,0)); α chosen by grid search "
                      "(0.5–4.0) minimizing log-loss against actual outcomes.",
        }

    base_win = sum(y for _, y in samples) / n
    base_win = max(min(base_win, 0.95), 0.05)

    # grid search α minimizing log-loss
    best_alpha, best_loss = 1.8, float("inf")
    a = 0.5
    while a <= 4.0 + 1e-9:
        loss = 0.0
        for ratio, y in samples:
            p = base_win * math.exp(-a * max(ratio - 1.0, 0.0))
            p = max(min(p, 0.999), 0.001)
            loss += -(y * math.log(p) + (1 - y) * math.log(1 - p))
        loss /= n
        if loss < best_loss:
            best_loss, best_alpha = loss, round(a, 2)
        a += 0.1

    # observed win rate by price band
    bands = [(0.0, 0.95, "Below anchor"), (0.95, 1.05, "At anchor"),
             (1.05, 1.25, "5–25% above"), (1.25, 5.0, ">25% above")]
    buckets = []
    for lo, hi, label in bands:
        members = [(r, y) for r, y in samples if lo <= r < hi]
        if not members:
            buckets.append({"label": label, "count": 0, "win_rate": None})
            continue
        buckets.append({
            "label": label, "count": len(members),
            "win_rate": round(sum(y for _, y in members) / len(members), 4),
        })

    return {
        "tier": _tier(n), "n": n,
        "alpha": best_alpha,
        "base_win_prob": round(base_win, 4),
        "log_loss": round(best_loss, 4),
        "buckets": buckets,
        "method": "P(win|r) = p_base · exp(−α·max(r−1,0)); α chosen by grid search "
                  "(0.5–4.0) minimizing log-loss against actual outcomes.",
    }


# ── #6 — stale / overdue pipeline ────────────────────────────────────────────────

@router.get("/pipeline/stale")
def pipeline_stale(
    stale_days: int = 7,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    stale_days = max(1, min(stale_days, 120))
    now = datetime.now(timezone.utc)
    opps = (
        db.query(models.RfpOpportunity)
        .filter(models.RfpOpportunity.user_id == user.id)
        .filter(models.RfpOpportunity.status == "complete")
        .all()
    )
    items = []
    for o in opps:
        if (o.stage or "new") in _TERMINAL_STAGES:
            continue
        deadline = _as_dt(o.response_deadline or o.due_date)
        days_to_deadline = (deadline - now).days if deadline else None
        updated = _as_dt(o.updated_at)
        days_idle = (now - updated).days if updated else None
        score = o.opportunity_score or 0

        reasons = []
        severity = 0
        if days_to_deadline is not None and days_to_deadline < 0:
            reasons.append("Response deadline has passed")
            severity += 3
        elif days_to_deadline is not None and days_to_deadline <= 14:
            reasons.append(f"Deadline in {days_to_deadline}d")
            severity += 2
        if not o.owner:
            reasons.append("No owner assigned")
            severity += 1
        if days_idle is not None and days_idle >= stale_days:
            reasons.append(f"No activity for {days_idle}d")
            severity += 1
        if score >= 58:
            severity += 1  # high-value deals are costlier to let slip

        if not reasons:
            continue
        items.append({
            "id": o.id,
            "employer_name": o.employer_name or o.title or "Untitled RFP",
            "stage": o.stage,
            "owner": o.owner,
            "opportunity_score": round(score, 1) if score else None,
            "score_tier": o.score_tier,
            "estimated_value": o.estimated_contract_value or o.estimated_value,
            "days_to_deadline": days_to_deadline,
            "days_idle": days_idle,
            "severity": severity,
            "reasons": reasons,
            "recommended_action": (
                "Reassign or escalate now — high-value deal past due"
                if severity >= 4 else
                "Assign an owner and confirm next step"
            ),
        })
    items.sort(key=lambda x: (-x["severity"], x["days_to_deadline"] if x["days_to_deadline"] is not None else 9999))
    return {"count": len(items), "stale_days": stale_days, "items": items}


# ── #7 — entity resolution / duplicate accounts ──────────────────────────────────

@router.get("/accounts/duplicates")
def account_duplicates(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entities: list[dict] = []
    for a in db.query(models.RfpAccount).filter(models.RfpAccount.user_id == user.id).all():
        entities.append({"kind": "account", "id": a.id, "name": a.name,
                         "ein": (a.ein or "").strip() or None, "state": a.state})
    for o in db.query(models.RfpOpportunity).filter(models.RfpOpportunity.user_id == user.id).all():
        nm = o.employer_name or o.title
        if nm:
            entities.append({"kind": "opportunity", "id": o.id, "name": nm,
                             "ein": (o.ein or o.employer_ein or "").strip() or None,
                             "state": o.employer_state})

    clusters: dict[str, list[dict]] = {}
    for e in entities:
        key = f"ein:{e['ein']}" if e["ein"] else f"name:{_normalize_name(e['name'])}"
        if not key or key in ("name:", "ein:"):
            continue
        clusters.setdefault(key, []).append(e)

    dupes = []
    for key, members in clusters.items():
        # dedupe identical (kind,id)
        uniq = {(m["kind"], m["id"]): m for m in members}
        members = list(uniq.values())
        if len(members) < 2:
            continue
        names = sorted({m["name"] for m in members})
        dupes.append({
            "key": key,
            "matched_on": "EIN" if key.startswith("ein:") else "normalized name",
            "canonical_name": max(names, key=len),
            "variants": names,
            "members": members,
            "size": len(members),
        })
    dupes.sort(key=lambda d: -d["size"])
    return {"count": len(dupes), "clusters": dupes}


# ── #3 — promote an account into the pipeline ────────────────────────────────────

class PromoteRequest(BaseModel):
    employer_name: str
    ein: Optional[str] = None
    account_id: Optional[str] = None
    state: Optional[str] = None
    industry: Optional[str] = None
    covered_lives: Optional[int] = None
    estimated_contract_value: Optional[float] = None
    known_competitor: Optional[str] = None


@router.post("/accounts/promote")
def promote_account(
    req: PromoteRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    name = (req.employer_name or "").strip()
    if not name:
        raise HTTPException(400, "employer_name is required")

    # Ownership check: a referenced account must belong to the current user.
    if req.account_id:
        owned = (
            db.query(models.RfpAccount)
            .filter(models.RfpAccount.id == req.account_id,
                    models.RfpAccount.user_id == user.id)
            .first()
        )
        if not owned:
            raise HTTPException(404, "Account not found")

    opp = models.RfpOpportunity(
        user_id=user.id,
        account_id=req.account_id,
        source="promote",
        title=f"{name} — RFP",
        employer_name=name,
        ein=(req.ein or "").strip() or None,
        employer_ein=(req.ein or "").strip() or None,
        employer_state=req.state,
        industry=req.industry,
        covered_lives=req.covered_lives,
        estimated_contract_value=req.estimated_contract_value,
        known_competitor=(req.known_competitor or "").strip() or None,
        status="complete",     # ready to score / forecast
        stage="qualifying",
        priority="medium",
    )
    db.add(opp)
    db.commit()
    db.refresh(opp)
    logger.info(f"[RFP] Promoted account '{name}' → opportunity {opp.id} (user={user.id})")
    return {"ok": True, "opportunity_id": opp.id, "stage": opp.stage,
            "message": f"'{name}' added to the pipeline. Run scoring to rank it."}


# ── #2 — push an opportunity to HubSpot as a deal ────────────────────────────────

@router.post("/opportunities/{opp_id}/hubspot-sync")
async def hubspot_sync(
    opp_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    opp = (
        db.query(models.RfpOpportunity)
        .filter(models.RfpOpportunity.id == opp_id, models.RfpOpportunity.user_id == user.id)
        .first()
    )
    if not opp:
        raise HTTPException(404, "Opportunity not found")

    amount = opp.estimated_contract_value or opp.estimated_value
    deal_name = f"{opp.employer_name or opp.title or 'RFP'} — Kincaid RFP"
    props = {"dealname": deal_name, "dealstage": "appointmentscheduled", "pipeline": "default"}
    if amount:
        props["amount"] = str(int(amount))

    try:
        from backend.routers.crm_sync import _hs_request
        result = await _hs_request("POST", "/crm/v3/objects/deals", {"properties": props})
        deal_id = result.get("id")
        logger.info(f"[RFP→HubSpot] Deal created for opp {opp_id}: {deal_id}")
        return {"ok": True, "demo": False, "hubspot_deal_id": deal_id, "deal_name": deal_name}
    except HTTPException as e:
        if e.status_code == 503:
            return {"ok": True, "demo": True, "hubspot_deal_id": None, "deal_name": deal_name,
                    "message": "HubSpot connector not configured — demo receipt. Connect HubSpot to enable live sync."}
        raise
    except Exception as e:
        raise HTTPException(500, f"HubSpot sync failed: {e}")
