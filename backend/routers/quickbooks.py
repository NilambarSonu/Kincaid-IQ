from fastapi import APIRouter
from typing import List

router = APIRouter(prefix="/api/quickbooks", tags=["quickbooks"])

DEMO_COMPANY = {
    "id": "9341058891748920",
    "name": "Human Capital Concepts LLC",
    "fiscal_year_start": "November",
    "country": "US",
    "currency": "USD",
    "connected_at": "2025-03-01T09:00:00Z",
    "plan": "QuickBooks Online Advanced",
    "demo_mode": True,
}

DEMO_VENDORS = [
    {"id": "v001", "name": "Guardian Life Insurance Company of America", "category": "Carrier — Health/Life", "ytd_payments": 1423890, "prior_year": 1182340, "flag": "CARRIER", "flag_color": "blue"},
    {"id": "v002", "name": "OptumRx (PBM Services)", "category": "Pharmacy Benefit Manager", "ytd_payments": 487620, "prior_year": 441200, "flag": "PBM", "flag_color": "red"},
    {"id": "v003", "name": "Kincaid RMC Benefits Advisory", "category": "Broker / Benefits Advisor", "ytd_payments": 0, "prior_year": 0, "flag": "BROKER_KINCAID", "flag_color": "green"},
    {"id": "v004", "name": "Benefits Broker Services LLC", "category": "Broker / TPA Admin", "ytd_payments": 299827, "prior_year": 257366, "flag": "BROKER_CURRENT", "flag_color": "amber"},
    {"id": "v005", "name": "HealthMarket TPA Inc.", "category": "Third-Party Administrator", "ytd_payments": 214400, "prior_year": 198750, "flag": "TPA", "flag_color": "purple"},
    {"id": "v006", "name": "Lincoln National Life Insurance", "category": "Former Carrier", "ytd_payments": 0, "prior_year": 0, "flag": "FORMER_CARRIER", "flag_color": "gray"},
    {"id": "v007", "name": "DOL ERISA Legal Counsel LLP", "category": "Legal / Compliance", "ytd_payments": 47800, "prior_year": 41200, "flag": "LEGAL", "flag_color": "cyan"},
    {"id": "v008", "name": "VSP Vision Care", "category": "Carrier — Vision", "ytd_payments": 38420, "prior_year": 35100, "flag": "CARRIER", "flag_color": "blue"},
]

DEMO_PL = [
    {"year": 2020, "quarter": "FY", "revenue": 4820000, "total_benefits_expense": 618200, "payroll": 2940000, "benefits_pct_revenue": 12.8},
    {"year": 2021, "quarter": "FY", "revenue": 6140000, "total_benefits_expense": 1347600, "payroll": 3610000, "benefits_pct_revenue": 21.9},
    {"year": 2022, "quarter": "FY", "revenue": 7280000, "total_benefits_expense": 1298400, "payroll": 4190000, "benefits_pct_revenue": 17.8},
    {"year": 2023, "quarter": "FY", "revenue": 8840000, "total_benefits_expense": 1561200, "payroll": 4970000, "benefits_pct_revenue": 17.7},
    {"year": 2024, "quarter": "Q1", "revenue": 2390000, "total_benefits_expense": 412800, "payroll": 1320000, "benefits_pct_revenue": 17.3},
    {"year": 2024, "quarter": "Q2", "revenue": 2580000, "total_benefits_expense": 448900, "payroll": 1410000, "benefits_pct_revenue": 17.4},
    {"year": 2024, "quarter": "Q3", "revenue": 2710000, "total_benefits_expense": 471200, "payroll": 1480000, "benefits_pct_revenue": 17.4},
    {"year": 2024, "quarter": "Q4", "revenue": 2890000, "total_benefits_expense": 498300, "payroll": 1560000, "benefits_pct_revenue": 17.2},
]

DEMO_PAYROLL = [
    {"period": "Q1 2024", "total_w2_employees": 2089, "benefit_deductions": 1840, "deduction_participation_pct": 88.1},
    {"period": "Q2 2024", "total_w2_employees": 2134, "benefit_deductions": 1877, "deduction_participation_pct": 88.0},
    {"period": "Q3 2024", "total_w2_employees": 2197, "benefit_deductions": 1931, "deduction_participation_pct": 87.9},
    {"period": "Q4 2024", "total_w2_employees": 2241, "benefit_deductions": 1973, "deduction_participation_pct": 88.0},
]

DEMO_AP_HIDDEN = [
    {"date": "2023-12-15", "vendor": "Benefits Broker Services LLC", "memo": "Annual advisory retainer Q4", "amount": 24900, "gl_code": "6100 Admin Expense", "flag": "POSSIBLE_BROKER_FEE"},
    {"date": "2023-09-30", "vendor": "Benefits Broker Services LLC", "memo": "Consulting fee — enrollment support", "amount": 18500, "gl_code": "6100 Admin Expense", "flag": "POSSIBLE_BROKER_FEE"},
    {"date": "2023-06-30", "vendor": "Benefits Broker Services LLC", "memo": "Carrier liaison services Q2", "amount": 22000, "gl_code": "6100 Admin Expense", "flag": "POSSIBLE_BROKER_FEE"},
    {"date": "2023-03-31", "vendor": "Benefits Broker Services LLC", "memo": "Benefits consulting Q1", "amount": 19750, "gl_code": "6100 Admin Expense", "flag": "POSSIBLE_BROKER_FEE"},
]

@router.get("/status")
def get_status():
    return {"connected": True, "demo_mode": True, "company": DEMO_COMPANY}

@router.get("/vendors")
def get_vendors():
    total_broker = sum(v["ytd_payments"] for v in DEMO_VENDORS if "BROKER_CURRENT" in v["flag"])
    total_carrier = sum(v["ytd_payments"] for v in DEMO_VENDORS if v["flag"] == "CARRIER")
    total_pbm = sum(v["ytd_payments"] for v in DEMO_VENDORS if v["flag"] == "PBM")
    return {
        "vendors": DEMO_VENDORS,
        "summary": {
            "total_broker_payments_ytd": total_broker,
            "total_carrier_payments_ytd": total_carrier,
            "total_pbm_payments_ytd": total_pbm,
            "total_benefits_spend_ytd": total_broker + total_carrier + total_pbm,
        },
        "kincaid_finding": (
            f"QuickBooks vendor ledger confirms ${total_broker:,} in broker/admin payments YTD to "
            f"'Benefits Broker Services LLC' — consistent with DOL Schedule H broker commission "
            f"figure of $299,827. Cross-reference verified. PBM spend to OptumRx: ${total_pbm:,} "
            f"YTD — not reported on DOL filing."
        )
    }

@router.get("/pl-trend")
def get_pl_trend():
    industry_avg_pct = 14.2
    hcc_2023_pct = 17.7
    excess_pct = hcc_2023_pct - industry_avg_pct
    excess_dollars_2023 = round(8840000 * (excess_pct / 100))
    return {
        "pl_data": DEMO_PL,
        "benchmarks": {
            "industry_avg_benefits_pct_revenue": industry_avg_pct,
            "hcc_current_pct": hcc_2023_pct,
            "excess_pct": round(excess_pct, 1),
            "estimated_excess_annual": excess_dollars_2023,
        },
        "kincaid_finding": (
            f"HCC benefits expense runs at {hcc_2023_pct}% of revenue vs industry average of "
            f"{industry_avg_pct}% — an excess of {excess_pct:.1f} points representing ~${excess_dollars_2023:,} "
            f"in above-market spend annually. Restructuring to P75 benchmark saves ~$163K/year."
        )
    }

@router.get("/payroll")
def get_payroll():
    dol_participants = 2141
    qb_q4_headcount = 2241
    discrepancy = qb_q4_headcount - dol_participants
    return {
        "payroll_periods": DEMO_PAYROLL,
        "crossref": {
            "qb_active_employees_q4": qb_q4_headcount,
            "dol_5500_participants": dol_participants,
            "discrepancy": discrepancy,
            "flag": "MODERATE",
        },
        "kincaid_finding": (
            f"QuickBooks payroll shows {qb_q4_headcount:,} active W-2 employees in Q4 2024 "
            f"vs {dol_participants:,} participants reported on the 2023 Form 5500 "
            f"(plan year ending Oct 2024). Discrepancy of {discrepancy:+,} lives. "
            f"May indicate lag in 5500 reporting or enrollment eligibility gap."
        )
    }

@router.get("/hidden-fees")
def get_hidden_fees():
    total_hidden = sum(t["amount"] for t in DEMO_AP_HIDDEN)
    dol_reported = 299827
    total_actual = dol_reported + total_hidden
    return {
        "transactions": DEMO_AP_HIDDEN,
        "analysis": {
            "dol_reported_broker_comm": dol_reported,
            "qb_additional_advisory_fees": total_hidden,
            "total_actual_broker_comp": total_actual,
            "undisclosed_amount": total_hidden,
            "undisclosed_pct": round((total_hidden / dol_reported) * 100, 1),
        },
        "kincaid_finding": (
            f"QuickBooks AP ledger reveals ${total_hidden:,} in additional advisory/consulting "
            f"payments to the broker NOT captured on the DOL Schedule H ($0 welfare premiums). "
            f"Total actual broker compensation: ${total_actual:,}/year — "
            f"{round((total_hidden/dol_reported)*100,1)}% above what was disclosed to the DOL. "
            f"This is a direct ERISA §408(b)(2) violation."
        )
    }

@router.get("/summary")
def get_summary():
    return {
        "company": DEMO_COMPANY,
        "kpi": {
            "total_benefits_spend_2023": 1561200,
            "broker_payments_ytd": 299827,
            "hidden_advisory_fees": 85150,
            "pbm_spend": 487620,
            "benefits_pct_revenue": 17.7,
            "industry_avg_pct": 14.2,
            "excess_annual": 312280,
        },
        "alerts": [
            {"level": "CRITICAL", "message": "$85,150 in undisclosed broker advisory fees found in AP ledger — §408(b)(2) violation"},
            {"level": "HIGH", "message": "Benefits spend 3.5% above industry average — $312K excess annually"},
            {"level": "MEDIUM", "message": "OptumRx PBM payments ($487K) not disclosed on DOL Schedule H"},
            {"level": "LOW", "message": "Payroll headcount vs 5500 discrepancy: +100 lives — review enrollment roster"},
        ]
    }
