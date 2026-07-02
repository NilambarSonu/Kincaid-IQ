from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.database import get_db
from backend.duckdb import get_duck
from backend import models
from backend.auth import get_current_user
import re

router = APIRouter(prefix="/api/commit", tags=["commit-engine"])

def _f(v): 
    try: return float(v or 0)
    except: return 0.0

def _ein(e): 
    return re.sub(r"[^0-9]", "", str(e or ""))

def _sector_label(sic):
    table = {
        60:"Banking",61:"Credit",62:"Securities",63:"Insurance",64:"Insurance Agents",
        65:"Real Estate",70:"Hotels",72:"Personal Svcs",73:"Business Svcs",
        75:"Auto Repair",78:"Amusement",79:"Recreation",80:"Health Svcs",
        82:"Education",83:"Social Svcs",87:"Engineering",
        20:"Food Mfg",21:"Tobacco",22:"Textile",23:"Apparel",24:"Lumber",
        26:"Paper",27:"Printing",28:"Chemicals",29:"Petroleum",30:"Rubber",
        32:"Stone/Glass",33:"Primary Metal",34:"Fabricated Metal",
        35:"Machinery",36:"Electronics",37:"Transportation Equip",38:"Instruments",
        39:"Misc Mfg",40:"Railroad",41:"Transit",42:"Trucking",44:"Water Trans",
        45:"Air Trans",48:"Communications",49:"Utilities",
        52:"Building Materials",53:"General Merchandise",54:"Grocery",
        55:"Auto Dealers",56:"Apparel Stores",57:"Furniture",58:"Eating/Drinking",
        59:"Misc Retail",
    }
    for prefix, label in sorted(table.items(), key=lambda x: -len(str(x[0]))):
        if str(sic).startswith(str(prefix)):
            return label
    return f"SIC {sic}"

# ── Gate 1 + 2: Company identification + plan inventory ─────────────────────
@router.get("/analyze/{ein}")
def analyze(ein: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Full 7-gate analysis packet for one company EIN."""
    duck = get_duck()
    ein_clean = _ein(ein)

    # EDGAR profile — basic info from sec_submissions
    edgar_row = db.execute(text("""
        SELECT DISTINCT ON (ein) adsh, name, sic, stprba, cityba, cik, period
        FROM sec_submissions
        WHERE REGEXP_REPLACE(ein,'[^0-9]','','g') = :ein AND form='10-K'
        ORDER BY ein, period DESC LIMIT 1
    """), {"ein": ein_clean}).fetchone()

    if not edgar_row:
        raise HTTPException(404, f"No EDGAR filing found for EIN {ein}")

    adsh = edgar_row[0]

    # Financial data from sec_numeric
    financials = db.execute(text("""
        SELECT tag, MAX(value) as value
        FROM sec_numeric
        WHERE adsh = :adsh AND qtrs IN (4, 0)
          AND tag IN ('Revenues','Revenue','RevenueFromContractWithCustomerExcludingAssessedTax',
                      'NetIncomeLoss','Assets','EntityNumberOfEmployees',
                      'CommonStocksSharesOutstanding')
        GROUP BY tag
    """), {"adsh": adsh}).fetchall()

    fin_map = {r[0]: _f(r[1]) for r in financials}
    revenue = (fin_map.get('Revenues') or fin_map.get('Revenue') or
               fin_map.get('RevenueFromContractWithCustomerExcludingAssessedTax') or 0)
    net_income = fin_map.get('NetIncomeLoss', 0)
    assets = fin_map.get('Assets', 0)
    employees = int(fin_map.get('EntityNumberOfEmployees', 0))

    edgar = {
        "name": edgar_row[1], "sic": int(edgar_row[2] or 0),
        "state": edgar_row[3], "city": edgar_row[4], "cik": edgar_row[5],
        "revenue": revenue, "net_income": net_income,
        "assets": assets, "employees": employees,
        "period": str(edgar_row[6] or ""),
        "sector": _sector_label(int(edgar_row[2] or 0)),
    }

    # DOL Plan inventory — all plans across all years
    dol_rows = duck.execute("""
        SELECT FORM_YEAR, PLAN_NAME_LS, PN, PARTICIPANTS, TOTAL_INCOME_AMT,
               INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT as fees,
               BROKER_COMMISSIONS, CARRIER_NAME,
               IS_HEALTH, IS_STOP_LOSS, IS_DRUG, WELFARE_PREMIUMS,
               ADMIN_SERVICE_FEES_AMT, INVEST_MGMT_FEES_AMT, LEGAL_FEES_AMT
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC, fees DESC
    """, [ein_clean]).fetchall()

    if not dol_rows:
        raise HTTPException(404, f"No DOL 5500 filings found for EIN {ein}")

    latest_year = dol_rows[0][0]
    latest_plans = [r for r in dol_rows if r[0] == latest_year]
    all_participants = sum(int(r[3] or 0) for r in latest_plans)
    all_fees = sum(_f(r[5]) for r in latest_plans)
    all_income = sum(_f(r[4]) for r in latest_plans)
    all_broker = sum(_f(r[6]) for r in latest_plans)
    all_welfare = sum(_f(r[11]) for r in latest_plans)
    all_admin = sum(_f(r[12]) for r in latest_plans)
    all_invest = sum(_f(r[13]) for r in latest_plans)
    all_legal = sum(_f(r[14]) for r in latest_plans)
    carriers = list({r[7] for r in latest_plans if r[7]})
    has_health = any(r[8] for r in latest_plans)
    has_stop_loss = any(r[9] for r in latest_plans)
    has_drug = any(r[10] for r in latest_plans)

    # Gate 3: Sector FCR benchmark
    sic = edgar["sic"]
    sic_prefix = str(sic)[:2]
    peer_eins_rows = db.execute(text("""
        SELECT DISTINCT REGEXP_REPLACE(ein,'[^0-9]','','g') as ein_clean
        FROM sec_submissions
        WHERE sic::text LIKE :pre AND form='10-K' AND ein IS NOT NULL
          AND REGEXP_REPLACE(ein,'[^0-9]','','g') != :ein
          AND REGEXP_REPLACE(ein,'[^0-9]','','g') != ''
        LIMIT 300
    """), {"pre": f"{sic_prefix}%", "ein": ein_clean}).fetchall()

    peer_ph = ", ".join(f"'{r[0]}'" for r in peer_eins_rows if r[0])
    sector_bench = {"median_fees": 0, "median_participants": 0, "plan_count": 0}
    if peer_ph:
        sb = duck.execute(f"""
            SELECT MEDIAN(INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) as med_fees,
                   MEDIAN(PARTICIPANTS) as med_part, COUNT(*) as n
            FROM sch_h_2024
            WHERE EIN IN ({peer_ph}) AND FORM_YEAR = ?
              AND (INVEST_MGMT_FEES_AMT + ADMIN_SERVICE_FEES_AMT + LEGAL_FEES_AMT) > 0
        """, [latest_year]).fetchone()
        if sb and sb[0]:
            sector_bench = {"median_fees": round(_f(sb[0])), "median_participants": round(_f(sb[1])), "plan_count": int(sb[2])}

    # FCR calculation
    revenue = edgar["revenue"]
    fcr_pct = (all_fees / revenue * 100) if revenue > 0 else 0
    sector_median_fcr = (sector_bench["median_fees"] / max(revenue, 1) * 100) if revenue > 0 else 0.5
    fcr_excess = max(0, all_fees - sector_bench["median_fees"] * len(latest_plans))
    recoverable = round(fcr_excess * 0.4)
    fee_per_participant = round(all_fees / max(all_participants, 1))

    # Gate 4: GLP-1 risk
    sic_int = sic
    risk_map = {
        (5800, 5900): 90, (5400, 5500): 85, (4200, 4300): 81,
        (7000, 7100): 82, (2300, 2400): 78, (3300, 3400): 72,
        (5500, 5600): 70, (5600, 5700): 68,
    }
    glp1_score = 50
    for (lo, hi), score in risk_map.items():
        if lo <= sic_int < hi:
            glp1_score = score
            break
    glp1_eligible = int(all_participants * 0.12 * (glp1_score / 100))
    glp1_exposure = glp1_eligible * 18_000
    glp1_3yr = round(glp1_exposure * 1.75)
    intervention_savings = round(glp1_exposure * 0.4)

    # Gate 5: Stop-loss and carrier risk
    has_sl_gap = not has_stop_loss and all_participants > 200
    carrier_risk = "High" if all_broker > all_fees * 0.4 else "Moderate" if all_broker > all_fees * 0.2 else "Low"
    # Use DOL income OR EDGAR revenue (whichever is larger) to avoid inflated %
    income_base = max(all_income, edgar["revenue"], 1)
    commission_pct = (all_broker / income_base * 100)

    # Gate 6: Opportunity sizing
    estimated_commission = round(recoverable * 0.20)
    glp1_commission = round(intervention_savings * 0.05)
    total_opportunity = estimated_commission + glp1_commission

    # YoY history
    yoy = {}
    years_seen = sorted({r[0] for r in dol_rows}, reverse=True)[:4]
    for yr in years_seen:
        yr_plans = [r for r in dol_rows if r[0] == yr]
        yoy[yr] = {
            "participants": sum(int(r[3] or 0) for r in yr_plans),
            "fees": round(sum(_f(r[5]) for r in yr_plans)),
            "broker": round(sum(_f(r[6]) for r in yr_plans)),
            "plan_count": len(yr_plans),
        }
    # YoY deltas
    yrs_sorted = sorted(yoy.keys())
    for i in range(1, len(yrs_sorted)):
        prev = yoy[yrs_sorted[i-1]]["fees"] or 1
        curr = yoy[yrs_sorted[i]]["fees"]
        yoy[yrs_sorted[i]]["fee_delta_pct"] = round((curr - prev) / prev * 100, 1)

    # Composite Go/No-Go verdicts per gate
    gates = {
        "gate1_intel": {
            "status": "GO" if edgar and dol_rows else "NO-GO",
            "score": 100 if (edgar and dol_rows) else 0,
            "note": f"EDGAR + DOL 5500 match confirmed — {len(dol_rows)} filings across {len(years_seen)} years",
        },
        "gate2_inventory": {
            "status": "GO" if len(latest_plans) >= 1 and all_participants > 100 else "REVIEW",
            "score": min(100, len(latest_plans) * 25 + (20 if all_participants > 1000 else 5)),
            "note": f"{len(latest_plans)} active plans · {all_participants:,} participants · {len(carriers)} carriers",
        },
        "gate3_fcr": {
            "status": "GO" if fcr_pct > sector_median_fcr * 1.3 else "REVIEW" if fcr_pct > sector_median_fcr else "PASS",
            "score": min(100, round(fcr_pct / max(sector_median_fcr, 0.01) * 50)),
            "note": f"FCR {fcr_pct:.2f}% vs sector median {sector_median_fcr:.2f}% — recoverable ${recoverable:,}",
        },
        "gate4_risk": {
            "status": "GO" if glp1_score >= 70 or has_sl_gap else "REVIEW",
            "score": glp1_score if glp1_score >= 50 else 30,
            "note": f"GLP-1 score {glp1_score}/100 · {glp1_eligible:,} eligible members · ${glp1_exposure/1e6:.1f}M exposure",
        },
        "gate5_market": {
            "status": "GO" if carrier_risk in ("High", "Moderate") else "REVIEW",
            "score": 80 if carrier_risk == "High" else 55 if carrier_risk == "Moderate" else 25,
            "note": f"Carrier risk: {carrier_risk} · Commission/income: {commission_pct:.1f}% · Stop-loss gap: {has_sl_gap}",
        },
        "gate6_opportunity": {
            "status": "GO" if total_opportunity > 10_000 else "REVIEW",
            "score": min(100, round(total_opportunity / 1_000)),
            "note": f"Est. first-year commission: ${estimated_commission:,} (fee recovery) + ${glp1_commission:,} (GLP-1) = ${total_opportunity:,}",
        },
        "gate7_commit": {
            "status": "GO" if total_opportunity > 10_000 and (fcr_pct > sector_median_fcr or glp1_score >= 70) else "REVIEW",
            "score": min(100, round((total_opportunity / 50_000) * 100)),
            "note": "Ready for executive-level proposal" if total_opportunity > 10_000 else "Needs further qualification",
        },
    }

    go_count = sum(1 for g in gates.values() if g["status"] == "GO")
    composite_score = round(sum(g["score"] for g in gates.values()) / len(gates))

    return {
        "ein": ein_clean,
        "edgar": edgar,
        "dol": {
            "latest_year": latest_year, "plan_count": len(latest_plans),
            "participants": all_participants, "total_income": round(all_income),
            "total_fees": round(all_fees), "broker_commissions": round(all_broker),
            "welfare_premiums": round(all_welfare), "carriers": carriers,
            "has_health": has_health, "has_stop_loss": has_stop_loss,
            "has_drug": has_drug, "fee_per_participant": fee_per_participant,
            "invest_fees": round(all_invest), "admin_fees": round(all_admin), "legal_fees": round(all_legal),
            "plan_details": [{
                "plan_name": r[1] or f"Plan {r[2]}",
                "participants": int(r[3] or 0),
                "fees": round(_f(r[5])),
                "broker": round(_f(r[6])),
                "carrier": r[7] or "Unknown",
                "has_health": bool(r[8]), "has_stop_loss": bool(r[9]), "has_drug": bool(r[10]),
            } for r in latest_plans],
        },
        "fcr": {
            "fcr_pct": round(fcr_pct, 2), "sector_median_fcr": round(sector_median_fcr, 2),
            "sector_bench_fees": sector_bench["median_fees"], "sector_plans": sector_bench["plan_count"],
            "fcr_excess": round(fcr_excess), "recoverable": recoverable,
            "fee_per_participant": fee_per_participant, "verdict": "Excessive" if fcr_pct > sector_median_fcr * 1.5 else "Elevated" if fcr_pct > sector_median_fcr else "Aligned",
        },
        "glp1": {
            "risk_score": glp1_score, "eligible_members": glp1_eligible,
            "annual_exposure": round(glp1_exposure), "exposure_3yr": glp1_3yr,
            "intervention_savings": intervention_savings,
            "risk_tier": "Critical" if glp1_score >= 80 else "High" if glp1_score >= 65 else "Moderate",
        },
        "risk": {
            "has_stop_loss_gap": has_sl_gap, "carrier_risk": carrier_risk,
            "commission_pct": round(commission_pct, 1),
        },
        "opportunity": {
            "fee_recovery_commission": estimated_commission,
            "glp1_commission": glp1_commission,
            "total_first_year": total_opportunity,
            "three_year_value": total_opportunity * 3,
        },
        "gates": gates,
        "go_count": go_count,
        "composite_score": composite_score,
        "history": [{"year": yr, **yoy[yr]} for yr in sorted(yoy.keys())],
    }


@router.get("/search")
def commit_search(q: str = Query(..., min_length=2), db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Search for companies to analyze — returns quick match list."""
    rows = db.execute(text("""
        SELECT DISTINCT ON (ein) REGEXP_REPLACE(ein,'[^0-9]','','g') as ein_clean,
               name, sic, stprba, cityba
        FROM sec_submissions
        WHERE form='10-K' AND ein IS NOT NULL
          AND (name ILIKE :q OR REGEXP_REPLACE(ein,'[^0-9]','','g') LIKE :eq)
        ORDER BY ein, period DESC LIMIT 12
    """), {"q": f"%{q}%", "eq": f"{q}%"}).fetchall()

    duck = get_duck()
    results = []
    for r in rows:
        if not r[0]:
            continue
        has_dol = duck.execute("SELECT 1 FROM sch_h_2024 WHERE EIN=? LIMIT 1", [r[0]]).fetchone()
        results.append({
            "ein": r[0], "name": r[1], "sic": r[2],
            "state": r[3], "city": r[4],
            "sector": _sector_label(int(r[2] or 0)),
            "has_dol": bool(has_dol),
        })
    return {"results": results}


@router.get("/history/{ein}")
def commit_history(ein: str, user: models.User = Depends(get_current_user)):
    """Return 4-year detailed plan history for a specific EIN"""
    ein_clean = "".join(c for c in ein if c.isdigit())
    duck = get_duck()
    rows = duck.execute("""
        SELECT FORM_YEAR,
               SUM(PARTICIPANTS) as participants,
               SUM(WELFARE_PREMIUMS) as welfare_prem,
               SUM(ADMIN_SERVICE_FEES_AMT) as admin_fees,
               SUM(BROKER_COMMISSIONS) as broker,
               SUM(TOT_ASSETS_EOY_AMT) as assets,
               SUM(TOTAL_INCOME_AMT) as income,
               SUM(INVEST_MGMT_FEES_AMT) as invest_fees,
               COUNT(*) as plan_count
        FROM sch_h_2024
        WHERE EIN = ?
        GROUP BY FORM_YEAR
        ORDER BY FORM_YEAR ASC
    """, [ein_clean]).fetchall()

    if not rows:
        return {"ein": ein_clean, "history": []}

    history = []
    prev = None
    for r in rows:
        yr = int(r[0])
        welfare = float(r[1] or 0) if r[1] else 0
        participants = int(r[2] or 0) if r[2] else 0
        admin = float(r[3] or 0) if r[3] else 0
        broker = float(r[4] or 0) if r[4] else 0
        assets = float(r[5] or 0) if r[5] else 0
        income = float(r[6] or 0) if r[6] else 0
        invest = float(r[7] or 0) if r[7] else 0
        plans = int(r[8] or 0)

        total_fees = admin + broker + invest
        fee_per_part = round(total_fees / max(participants, 1))
        broker_ratio = round(100.0 * broker / max(welfare, 1), 2)
        admin_ratio = round(100.0 * admin / max(income, 1), 2)

        entry = {
            "year": yr,
            "participants": participants,
            "welfare_premiums": round(welfare),
            "admin_fees": round(admin),
            "broker_commissions": round(broker),
            "invest_fees": round(invest),
            "total_fees": round(total_fees),
            "assets": round(assets),
            "income": round(income),
            "fee_per_participant": fee_per_part,
            "broker_ratio_pct": broker_ratio,
            "admin_ratio_pct": admin_ratio,
            "plan_count": plans,
            "yoy_fee_chg": None,
            "yoy_participant_chg": None,
        }

        if prev:
            if prev["total_fees"] > 0:
                entry["yoy_fee_chg"] = round(100.0 * (total_fees - prev["total_fees"]) / prev["total_fees"], 1)
            if prev["participants"] > 0:
                entry["yoy_participant_chg"] = round(100.0 * (participants - prev["participants"]) / prev["participants"], 1)

        history.append(entry)
        prev = entry

    return {"ein": ein_clean, "history": history}
