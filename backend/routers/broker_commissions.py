"""
Actuarial Broker Commissions — Form 5500 Schedule A / Schedule C Intelligence
DOL EBSA public dataset: https://www.dol.gov/agencies/ebsa/about-ebsa/our-activities/public-disclosure/foia/form-5500-datasets

Schema mirrors the DOL Form 5500 Schedule A (insurance information) and
Schedule C (service provider compensation) fields relevant to broker commissions.
"""
import random
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Text, Index, func, or_, cast, Float
from sqlalchemy.orm import Session

from backend.database import get_db, Base

router = APIRouter(prefix="/api/broker-commissions", tags=["broker-commissions"])


# ─── ORM Model ────────────────────────────────────────────────────────────────

class BrokerCommission(Base):
    __tablename__ = "broker_commissions"

    id                    = Column(Integer, primary_key=True, autoincrement=True)

    # Plan identification
    plan_name             = Column(String(300), nullable=False, index=True)
    plan_ein              = Column(String(20), nullable=False, index=True)   # XX-XXXXXXX
    plan_year             = Column(Integer, nullable=False, index=True)
    plan_year_end         = Column(String(10), nullable=True)                # YYYY-MM-DD
    plan_number           = Column(String(10), nullable=True)
    plan_type             = Column(String(60), nullable=True)                # health, welfare, pension

    # Sponsor (employer)
    sponsor_name          = Column(String(200), nullable=False, index=True)
    sponsor_state         = Column(String(2), nullable=False, index=True)
    sponsor_zip           = Column(String(10), nullable=True)
    sponsor_industry      = Column(String(100), nullable=True)
    covered_lives         = Column(Integer, nullable=True)

    # Broker / agent
    broker_name           = Column(String(200), nullable=False, index=True)
    broker_ein            = Column(String(20), nullable=True)
    broker_npn            = Column(String(20), nullable=True)               # National Producer Number
    broker_state          = Column(String(2), nullable=True)
    broker_firm           = Column(String(200), nullable=True)

    # Insurance carrier
    carrier_name          = Column(String(200), nullable=True)
    carrier_naic          = Column(String(10), nullable=True)
    benefit_type          = Column(String(60), nullable=False, index=True)  # medical, dental, vision, life, stop-loss

    # Financials
    total_premiums        = Column(Numeric(18, 2), nullable=True)
    direct_commissions    = Column(Numeric(18, 2), nullable=False)
    override_commissions  = Column(Numeric(18, 2), nullable=True, default=0)
    bonus_commissions     = Column(Numeric(18, 2), nullable=True, default=0)
    total_compensation    = Column(Numeric(18, 2), nullable=False)
    commission_pct        = Column(Numeric(8, 4), nullable=True)            # % of premium
    pmpm_commission       = Column(Numeric(8, 4), nullable=True)            # $ per member per month

    # Benchmark / actuarial flags
    benchmark_pct         = Column(Numeric(8, 4), nullable=True)            # industry benchmark commission %
    above_benchmark       = Column(Boolean, nullable=True, default=False)
    variance_pct          = Column(Numeric(8, 4), nullable=True)            # actual vs. benchmark
    flagged               = Column(Boolean, nullable=False, default=False)
    flag_reason           = Column(Text, nullable=True)

    # Source
    source_filing         = Column(String(100), nullable=True)              # "Form 5500 Schedule A"
    ack_id                = Column(String(50), nullable=True)               # DOL acknowledgement ID
    ingested_at           = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def _serialize(r: BrokerCommission) -> dict:
    return {
        "id": r.id,
        "planName": r.plan_name,
        "planEin": r.plan_ein,
        "planYear": r.plan_year,
        "planYearEnd": r.plan_year_end,
        "planNumber": r.plan_number,
        "planType": r.plan_type,
        "sponsorName": r.sponsor_name,
        "sponsorState": r.sponsor_state,
        "sponsorZip": r.sponsor_zip,
        "sponsorIndustry": r.sponsor_industry,
        "coveredLives": r.covered_lives,
        "brokerName": r.broker_name,
        "brokerEin": r.broker_ein,
        "brokerNpn": r.broker_npn,
        "brokerState": r.broker_state,
        "brokerFirm": r.broker_firm,
        "carrierName": r.carrier_name,
        "carrierNaic": r.carrier_naic,
        "benefitType": r.benefit_type,
        "totalPremiums": float(r.total_premiums) if r.total_premiums else None,
        "directCommissions": float(r.direct_commissions),
        "overrideCommissions": float(r.override_commissions) if r.override_commissions else 0,
        "bonusCommissions": float(r.bonus_commissions) if r.bonus_commissions else 0,
        "totalCompensation": float(r.total_compensation),
        "commissionPct": float(r.commission_pct) if r.commission_pct else None,
        "pmpmCommission": float(r.pmpm_commission) if r.pmpm_commission else None,
        "benchmarkPct": float(r.benchmark_pct) if r.benchmark_pct else None,
        "aboveBenchmark": r.above_benchmark,
        "variancePct": float(r.variance_pct) if r.variance_pct else None,
        "flagged": r.flagged,
        "flagReason": r.flag_reason,
        "sourceFiling": r.source_filing,
        "ackId": r.ack_id,
        "ingestedAt": r.ingested_at.isoformat() if r.ingested_at else None,
    }


# ─── Seed Data ────────────────────────────────────────────────────────────────

SEED_DATA = [
    # format: (plan_name, plan_ein, plan_year, sponsor_name, sponsor_state, covered_lives,
    #          broker_name, broker_firm, carrier_name, benefit_type,
    #          total_premiums, direct_commissions, override, bonus, benchmark_pct)
    ("Midwest Manufacturing Co. Health Plan", "36-1234567", 2023, "Midwest Manufacturing Co.", "IL", 1200,
     "James R. Holloway", "Holloway Benefits Group", "BlueCross BlueShield of Illinois", "medical",
     4_200_000, 168_000, 21_000, 12_600, 4.00),
    ("Midwest Manufacturing Co. Health Plan", "36-1234567", 2022, "Midwest Manufacturing Co.", "IL", 1140,
     "James R. Holloway", "Holloway Benefits Group", "BlueCross BlueShield of Illinois", "medical",
     3_850_000, 150_150, 19_250, 11_550, 3.90),
    ("Midwest Manufacturing Co. Health Plan", "36-1234567", 2021, "Midwest Manufacturing Co.", "IL", 1090,
     "James R. Holloway", "Holloway Benefits Group", "BlueCross BlueShield of Illinois", "medical",
     3_510_000, 133_380, 17_550, 10_530, 3.80),
    ("Apex Financial Services Welfare Plan", "13-9876543", 2023, "Apex Financial Services LLC", "NY", 480,
     "Sandra M. Kowalski", "Empire Benefits Consulting", "Cigna Health and Life", "medical",
     2_100_000, 126_000, 15_750, 0, 6.00),
    ("Apex Financial Services Welfare Plan", "13-9876543", 2022, "Apex Financial Services LLC", "NY", 455,
     "Sandra M. Kowalski", "Empire Benefits Consulting", "Cigna Health and Life", "medical",
     1_920_000, 115_200, 14_400, 0, 6.00),
    ("Apex Financial Services Welfare Plan", "13-9876543", 2021, "Apex Financial Services LLC", "NY", 430,
     "Sandra M. Kowalski", "Empire Benefits Consulting", "Cigna Health and Life", "medical",
     1_750_000, 105_000, 10_500, 0, 6.00),
    ("Sunridge Hospitality Group Health Plan", "84-5551234", 2023, "Sunridge Hospitality Group Inc.", "TX", 3400,
     "David T. Parrish", "Lone Star Benefits Partners", "Aetna Life Insurance", "medical",
     9_100_000, 273_000, 45_500, 27_300, 3.00),
    ("Sunridge Hospitality Group Health Plan", "84-5551234", 2022, "Sunridge Hospitality Group Inc.", "TX", 3200,
     "David T. Parrish", "Lone Star Benefits Partners", "Aetna Life Insurance", "medical",
     8_200_000, 246_000, 41_000, 24_600, 3.00),
    ("Sunridge Hospitality Group Health Plan", "84-5551234", 2021, "Sunridge Hospitality Group Inc.", "TX", 2950,
     "David T. Parrish", "Lone Star Benefits Partners", "Aetna Life Insurance", "medical",
     7_400_000, 222_000, 37_000, 22_200, 3.00),
    ("Pacific Coast Logistics Welfare Benefit Plan", "94-2223344", 2023, "Pacific Coast Logistics Inc.", "CA", 2100,
     "Michelle L. Nakamura", "Pacific Rim Benefits Advisory", "Kaiser Permanente", "medical",
     7_350_000, 367_500, 36_750, 0, 5.00),
    ("Pacific Coast Logistics Welfare Benefit Plan", "94-2223344", 2022, "Pacific Coast Logistics Inc.", "CA", 1980,
     "Michelle L. Nakamura", "Pacific Rim Benefits Advisory", "Kaiser Permanente", "medical",
     6_720_000, 336_000, 33_600, 0, 5.00),
    ("Pacific Coast Logistics Welfare Benefit Plan", "94-2223344", 2021, "Pacific Coast Logistics Inc.", "CA", 1850,
     "Michelle L. Nakamura", "Pacific Rim Benefits Advisory", "Kaiser Permanente", "medical",
     6_100_000, 305_000, 30_500, 0, 5.00),
    ("Great Plains Energy Corp. Employee Benefit Plan", "47-8889901", 2023, "Great Plains Energy Corp.", "KS", 680,
     "Robert J. Flemming", "Heartland Insurance Advisors", "United Healthcare", "medical",
     2_856_000, 142_800, 14_280, 8_568, 5.00),
    ("Great Plains Energy Corp. Employee Benefit Plan", "47-8889901", 2022, "Great Plains Energy Corp.", "KS", 645,
     "Robert J. Flemming", "Heartland Insurance Advisors", "United Healthcare", "medical",
     2_624_500, 131_225, 13_123, 7_874, 5.00),
    ("Northeast Healthcare Partners Plan", "04-6667788", 2023, "Northeast Healthcare Partners LLC", "MA", 820,
     "Patricia G. Sullivan", "Sullivan Benefits Group", "Harvard Pilgrim Health Care", "medical",
     3_608_000, 216_480, 18_040, 0, 6.00),
    ("Northeast Healthcare Partners Plan", "04-6667788", 2022, "Northeast Healthcare Partners LLC", "MA", 780,
     "Patricia G. Sullivan", "Sullivan Benefits Group", "Harvard Pilgrim Health Care", "medical",
     3_276_000, 196_560, 16_380, 0, 6.00),
    ("Summit Retail Group Employee Welfare Plan", "26-4445566", 2023, "Summit Retail Group Inc.", "OH", 5600,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "Anthem Blue Cross Blue Shield", "medical",
     11_760_000, 352_800, 58_800, 35_280, 3.00),
    ("Summit Retail Group Employee Welfare Plan", "26-4445566", 2022, "Summit Retail Group Inc.", "OH", 5200,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "Anthem Blue Cross Blue Shield", "medical",
     10_608_000, 318_240, 53_040, 31_824, 3.00),
    ("Summit Retail Group Employee Welfare Plan", "26-4445566", 2021, "Summit Retail Group Inc.", "OH", 4900,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "Anthem Blue Cross Blue Shield", "medical",
     9_800_000, 294_000, 49_000, 29_400, 3.00),
    ("Western Tech Innovations Health Plan", "81-3334455", 2023, "Western Tech Innovations Inc.", "CO", 340,
     "Angela R. Torres", "Mile High Benefits Consultants", "Cigna Health and Life", "medical",
     1_496_000, 104_720, 7_480, 0, 7.00),
    ("Western Tech Innovations Health Plan", "81-3334455", 2022, "Western Tech Innovations Inc.", "CO", 310,
     "Angela R. Torres", "Mile High Benefits Consultants", "Cigna Health and Life", "medical",
     1_333_000, 93_310, 6_665, 0, 7.00),
    ("Riverbend Automotive Group Welfare Plan", "38-7778899", 2023, "Riverbend Automotive Group LLC", "MI", 1580,
     "Thomas B. Garrison", "Great Lakes Benefits Inc.", "Priority Health", "medical",
     5_688_000, 227_520, 28_440, 17_064, 4.00),
    ("Riverbend Automotive Group Welfare Plan", "38-7778899", 2022, "Riverbend Automotive Group LLC", "MI", 1490,
     "Thomas B. Garrison", "Great Lakes Benefits Inc.", "Priority Health", "medical",
     5_215_000, 208_600, 26_075, 15_645, 4.00),
    ("Cardinal Health Systems Employee Plan", "31-2221122", 2023, "Cardinal Health Systems Corp.", "IN", 920,
     "Nancy L. Morrison", "Keystone Benefits Advisors", "Anthem Inc.", "medical",
     3_956_000, 237_360, 19_780, 0, 6.00),
    ("Cardinal Health Systems Employee Plan", "31-2221122", 2022, "Nancy L. Morrison", "IN", 870,
     "Nancy L. Morrison", "Keystone Benefits Advisors", "Anthem Inc.", "medical",
     3_654_000, 219_240, 18_270, 0, 6.00),
    # Dental plans
    ("Midwest Manufacturing Co. Dental Plan", "36-1234567", 2023, "Midwest Manufacturing Co.", "IL", 1200,
     "James R. Holloway", "Holloway Benefits Group", "Delta Dental of Illinois", "dental",
     360_000, 18_000, 1_800, 0, 5.00),
    ("Sunridge Hospitality Group Dental Plan", "84-5551234", 2023, "Sunridge Hospitality Group Inc.", "TX", 3400,
     "David T. Parrish", "Lone Star Benefits Partners", "Delta Dental of Texas", "dental",
     680_000, 27_200, 3_400, 0, 4.00),
    ("Summit Retail Group Dental Plan", "26-4445566", 2023, "Summit Retail Group Inc.", "OH", 5600,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "Delta Dental of Ohio", "dental",
     1_120_000, 44_800, 5_600, 0, 4.00),
    # Vision plans
    ("Apex Financial Services Vision Plan", "13-9876543", 2023, "Apex Financial Services LLC", "NY", 480,
     "Sandra M. Kowalski", "Empire Benefits Consulting", "VSP Vision Care", "vision",
     72_000, 5_040, 0, 0, 7.00),
    ("Pacific Coast Logistics Vision Plan", "94-2223344", 2023, "Pacific Coast Logistics Inc.", "CA", 2100,
     "Michelle L. Nakamura", "Pacific Rim Benefits Advisory", "VSP Vision Care", "vision",
     315_000, 15_750, 0, 0, 5.00),
    # Stop-loss plans (high commission flags)
    ("Midwest Manufacturing Stop-Loss Policy", "36-1234567", 2023, "Midwest Manufacturing Co.", "IL", 1200,
     "James R. Holloway", "Holloway Benefits Group", "Sun Life Financial", "stop-loss",
     580_000, 52_200, 5_800, 3_480, 9.00),
    ("Sunridge Hospitality Stop-Loss Policy", "84-5551234", 2023, "Sunridge Hospitality Group Inc.", "TX", 3400,
     "David T. Parrish", "Lone Star Benefits Partners", "Symetra Life Insurance", "stop-loss",
     1_365_000, 136_500, 13_650, 8_190, 10.00),
    ("Summit Retail Group Stop-Loss Policy", "26-4445566", 2023, "Summit Retail Group Inc.", "OH", 5600,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "Swiss Re Life & Health", "stop-loss",
     2_352_000, 235_200, 23_520, 14_112, 10.00),
    # Additional groups
    ("Clearwater Construction Group Health Plan", "59-3330011", 2023, "Clearwater Construction Group", "FL", 760,
     "Brian K. Holt", "Sunshine Benefits Solutions LLC", "Florida Blue", "medical",
     2_888_000, 173_280, 14_440, 0, 6.00),
    ("Clearwater Construction Group Health Plan", "59-3330011", 2022, "Clearwater Construction Group", "FL", 720,
     "Brian K. Holt", "Sunshine Benefits Solutions LLC", "Florida Blue", "medical",
     2_664_000, 159_840, 13_320, 0, 6.00),
    ("Clearwater Construction Group Health Plan", "59-3330011", 2021, "Clearwater Construction Group", "FL", 680,
     "Brian K. Holt", "Sunshine Benefits Solutions LLC", "Florida Blue", "medical",
     2_448_000, 146_880, 12_240, 0, 6.00),
    ("Intermountain Food Services Employee Plan", "82-7771234", 2023, "Intermountain Food Services Inc.", "UT", 1890,
     "Kevin S. Bradshaw", "Rocky Mountain Benefits LLC", "SelectHealth", "medical",
     5_859_000, 234_360, 29_295, 17_577, 4.00),
    ("Intermountain Food Services Employee Plan", "82-7771234", 2022, "Intermountain Food Services Inc.", "UT", 1750,
     "Kevin S. Bradshaw", "Rocky Mountain Benefits LLC", "SelectHealth", "medical",
     5_250_000, 210_000, 26_250, 15_750, 4.00),
    ("Atlantic Shipping Corp. Welfare Plan", "22-5556677", 2023, "Atlantic Shipping Corp.", "NJ", 630,
     "Linda M. Ferrara", "Garden State Benefits Advisors", "Horizon BCBS of NJ", "medical",
     2_331_000, 139_860, 11_655, 0, 6.00),
    ("Atlantic Shipping Corp. Welfare Plan", "22-5556677", 2022, "Atlantic Shipping Corp.", "NJ", 600,
     "Linda M. Ferrara", "Garden State Benefits Advisors", "Horizon BCBS of NJ", "medical",
     2_160_000, 129_600, 10_800, 0, 6.00),
    ("Blue Ridge Technology Partners Health Plan", "54-1119988", 2023, "Blue Ridge Technology Partners", "VA", 290,
     "Mark E. Caldwell", "Capitol Benefits Consulting", "Anthem HealthKeepers", "medical",
     1_218_000, 97_440, 6_090, 0, 8.00),
    ("Blue Ridge Technology Partners Health Plan", "54-1119988", 2022, "Blue Ridge Technology Partners", "VA", 265,
     "Mark E. Caldwell", "Capitol Benefits Consulting", "Anthem HealthKeepers", "medical",
     1_089_500, 87_160, 5_448, 0, 8.00),
    # Life insurance
    ("Midwest Manufacturing Co. Group Life Plan", "36-1234567", 2023, "Midwest Manufacturing Co.", "IL", 1200,
     "James R. Holloway", "Holloway Benefits Group", "Lincoln National Life", "life",
     240_000, 19_200, 0, 0, 8.00),
    ("Sunridge Hospitality Group Life Plan", "84-5551234", 2023, "Sunridge Hospitality Group Inc.", "TX", 3400,
     "David T. Parrish", "Lone Star Benefits Partners", "Prudential Insurance", "life",
     680_000, 47_600, 0, 0, 7.00),
    ("Pacific Coast Logistics Life Plan", "94-2223344", 2023, "Pacific Coast Logistics Inc.", "CA", 2100,
     "Michelle L. Nakamura", "Pacific Rim Benefits Advisory", "MetLife", "life",
     630_000, 37_800, 0, 0, 6.00),
    # More groups for variety
    ("Ashford Property Management Welfare Plan", "91-4442233", 2023, "Ashford Property Management LLC", "WA", 410,
     "Steven C. Dunlap", "Northwest Benefits Group", "Regence BlueShield", "medical",
     1_763_000, 123_410, 8_815, 0, 7.00),
    ("Ashford Property Management Welfare Plan", "91-4442233", 2022, "Ashford Property Management LLC", "WA", 385,
     "Steven C. Dunlap", "Northwest Benefits Group", "Regence BlueShield", "medical",
     1_617_000, 113_190, 8_085, 0, 7.00),
    ("Delta Star Aerospace Benefits Plan", "73-9990001", 2023, "Delta Star Aerospace Corp.", "OK", 540,
     "Carol P. Jennings", "Southwest Benefits Partners", "BlueCross BlueShield of Oklahoma", "medical",
     2_268_000, 158_760, 11_340, 0, 7.00),
    ("Delta Star Aerospace Benefits Plan", "73-9990001", 2022, "Delta Star Aerospace Corp.", "OK", 510,
     "Carol P. Jennings", "Southwest Benefits Partners", "BlueCross BlueShield of Oklahoma", "medical",
     2_091_000, 146_370, 10_455, 0, 7.00),
    ("National Staffing Alliance Employee Plan", "20-1112223", 2023, "National Staffing Alliance Inc.", "GA", 8200,
     "Howard W. Barnes", "Southeast Benefits Consulting", "United Healthcare", "medical",
     16_400_000, 492_000, 82_000, 49_200, 3.00),
    ("National Staffing Alliance Employee Plan", "20-1112223", 2022, "National Staffing Alliance Inc.", "GA", 7800,
     "Howard W. Barnes", "Southeast Benefits Consulting", "United Healthcare", "medical",
     15_210_000, 456_300, 76_050, 45_630, 3.00),
    ("National Staffing Alliance Employee Plan", "20-1112223", 2021, "National Staffing Alliance Inc.", "GA", 7400,
     "Howard W. Barnes", "Southeast Benefits Consulting", "United Healthcare", "medical",
     14_060_000, 421_800, 70_300, 42_180, 3.00),
    # More stop-loss with high variance
    ("Western Tech Innovations Stop-Loss", "81-3334455", 2023, "Western Tech Innovations Inc.", "CO", 340,
     "Angela R. Torres", "Mile High Benefits Consultants", "HM Life Insurance", "stop-loss",
     212_000, 27_560, 2_120, 1_272, 13.00),
    ("Great Plains Energy Stop-Loss Policy", "47-8889901", 2023, "Great Plains Energy Corp.", "KS", 680,
     "Robert J. Flemming", "Heartland Insurance Advisors", "Sun Life Financial", "stop-loss",
     428_400, 47_124, 4_284, 2_570, 11.00),
    # Pharmacy / RX benefit (newer Schedule C disclosure)
    ("Midwest Manufacturing Co. RX Plan", "36-1234567", 2023, "Midwest Manufacturing Co.", "IL", 1200,
     "James R. Holloway", "Holloway Benefits Group", "CVS Caremark", "pharmacy",
     1_680_000, 50_400, 0, 8_400, 3.00),
    ("National Staffing Alliance RX Plan", "20-1112223", 2023, "National Staffing Alliance Inc.", "GA", 8200,
     "Howard W. Barnes", "Southeast Benefits Consulting", "Express Scripts", "pharmacy",
     4_100_000, 123_000, 0, 20_500, 3.00),
    ("Summit Retail Group RX Plan", "26-4445566", 2023, "Summit Retail Group Inc.", "OH", 5600,
     "Craig A. Whitmore", "Whitmore Benefits Solutions", "OptumRx", "pharmacy",
     2_800_000, 84_000, 0, 14_000, 3.00),
]


def _flag_record(direct: float, override: float, bonus: float,
                 premiums: float, benchmark_pct: float, lives: int) -> tuple[bool, str | None, float, float, float]:
    total = direct + (override or 0) + (bonus or 0)
    actual_pct = (total / premiums * 100) if premiums else 0
    pmpm = (total / lives / 12) if lives else 0
    variance = actual_pct - benchmark_pct
    flagged = False
    flag_reason = None
    if variance > 2.0:
        flagged = True
        flag_reason = f"Commission {actual_pct:.2f}% exceeds benchmark {benchmark_pct:.2f}% by {variance:.2f}pp"
    elif variance > 1.0:
        flagged = True
        flag_reason = f"Commission {actual_pct:.2f}% is {variance:.2f}pp above benchmark — review recommended"
    return flagged, flag_reason, round(actual_pct, 4), round(variance, 4), round(pmpm, 4)


def seed_broker_commissions(db: Session) -> int:
    existing = db.query(func.count(BrokerCommission.id)).scalar()
    if existing and existing > 0:
        return 0

    records = []
    industries = ["Manufacturing", "Hospitality", "Technology", "Healthcare", "Retail",
                  "Construction", "Energy", "Financial Services", "Transportation", "Logistics"]
    states = ["IL", "NY", "TX", "CA", "OH", "MI", "FL", "WA", "CO", "KS",
              "MA", "VA", "GA", "IN", "NJ", "UT", "OK"]

    for i, row in enumerate(SEED_DATA):
        (plan_name, plan_ein, plan_year, sponsor_name, sponsor_state,
         covered_lives, broker_name, broker_firm, carrier_name, benefit_type,
         premiums, direct, override, bonus, bench_pct) = row

        flagged, flag_reason, actual_pct, variance_pct, pmpm = _flag_record(
            direct, override, bonus, premiums, bench_pct, covered_lives
        )
        total_comp = direct + (override or 0) + (bonus or 0)

        # Derive plan number & type
        plan_number = f"{plan_ein[-4:]}-{plan_year % 100:02d}"
        plan_type = "health" if benefit_type in ("medical", "dental", "vision", "pharmacy") else "welfare"

        r = BrokerCommission(
            plan_name=plan_name,
            plan_ein=plan_ein,
            plan_year=plan_year,
            plan_year_end=f"{plan_year}-12-31",
            plan_number=plan_number,
            plan_type=plan_type,
            sponsor_name=sponsor_name,
            sponsor_state=sponsor_state,
            sponsor_zip="",
            sponsor_industry=industries[i % len(industries)],
            covered_lives=covered_lives,
            broker_name=broker_name,
            broker_ein=f"XX-{random.randint(1000000, 9999999)}",
            broker_npn=f"NPN{random.randint(1000000, 9999999)}",
            broker_state=sponsor_state,
            broker_firm=broker_firm,
            carrier_name=carrier_name,
            carrier_naic=f"{random.randint(60000, 90000)}",
            benefit_type=benefit_type,
            total_premiums=premiums,
            direct_commissions=direct,
            override_commissions=override,
            bonus_commissions=bonus,
            total_compensation=total_comp,
            commission_pct=actual_pct,
            pmpm_commission=pmpm,
            benchmark_pct=bench_pct,
            above_benchmark=(actual_pct > bench_pct),
            variance_pct=variance_pct,
            flagged=flagged,
            flag_reason=flag_reason,
            source_filing="Form 5500 Schedule A/C",
            ack_id=f"2024{plan_year % 100:02d}{random.randint(100000, 999999)}",
        )
        records.append(r)

    db.bulk_save_objects(records)
    db.commit()
    return len(records)


# ─── API Endpoints ────────────────────────────────────────────────────────────

@router.get("")
def list_broker_commissions(
    q:           Optional[str] = Query(None, description="Full-text search: plan, sponsor, broker"),
    plan_ein:    Optional[str] = Query(None),
    broker_name: Optional[str] = Query(None),
    benefit_type: Optional[str] = Query(None),
    state:       Optional[str] = Query(None),
    plan_year:   Optional[int] = Query(None),
    year_from:   Optional[int] = Query(None),
    year_to:     Optional[int] = Query(None),
    flagged:     Optional[bool] = Query(None),
    above_benchmark: Optional[bool] = Query(None),
    min_commission: Optional[float] = Query(None),
    max_commission: Optional[float] = Query(None),
    sort_by:     str = Query("plan_year", description="plan_year|total_compensation|commission_pct|variance_pct"),
    sort_dir:    str = Query("desc"),
    limit:       int = Query(200, ge=1, le=1000),
    offset:      int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    qs = db.query(BrokerCommission)

    if q:
        like = f"%{q.lower()}%"
        qs = qs.filter(or_(
            func.lower(BrokerCommission.plan_name).like(like),
            func.lower(BrokerCommission.sponsor_name).like(like),
            func.lower(BrokerCommission.broker_name).like(like),
            func.lower(BrokerCommission.broker_firm).like(like),
            func.lower(BrokerCommission.carrier_name).like(like),
            BrokerCommission.plan_ein.like(like),
        ))
    if plan_ein:
        qs = qs.filter(BrokerCommission.plan_ein == plan_ein)
    if broker_name:
        qs = qs.filter(func.lower(BrokerCommission.broker_name).like(f"%{broker_name.lower()}%"))
    if benefit_type:
        qs = qs.filter(BrokerCommission.benefit_type == benefit_type)
    if state:
        qs = qs.filter(BrokerCommission.sponsor_state == state.upper())
    if plan_year:
        qs = qs.filter(BrokerCommission.plan_year == plan_year)
    if year_from:
        qs = qs.filter(BrokerCommission.plan_year >= year_from)
    if year_to:
        qs = qs.filter(BrokerCommission.plan_year <= year_to)
    if flagged is not None:
        qs = qs.filter(BrokerCommission.flagged == flagged)
    if above_benchmark is not None:
        qs = qs.filter(BrokerCommission.above_benchmark == above_benchmark)
    if min_commission is not None:
        qs = qs.filter(BrokerCommission.total_compensation >= min_commission)
    if max_commission is not None:
        qs = qs.filter(BrokerCommission.total_compensation <= max_commission)

    sort_col = {
        "plan_year": BrokerCommission.plan_year,
        "total_compensation": BrokerCommission.total_compensation,
        "commission_pct": BrokerCommission.commission_pct,
        "variance_pct": BrokerCommission.variance_pct,
    }.get(sort_by, BrokerCommission.plan_year)

    qs = qs.order_by(sort_col.desc() if sort_dir == "desc" else sort_col.asc())

    total = qs.count()
    rows = qs.offset(offset).limit(limit).all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "data": [_serialize(r) for r in rows],
    }


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    total_records = db.query(func.count(BrokerCommission.id)).scalar() or 0
    flagged_count = db.query(func.count(BrokerCommission.id)).filter(BrokerCommission.flagged == True).scalar() or 0
    total_comp = db.query(func.sum(BrokerCommission.total_compensation)).scalar() or 0
    total_premiums = db.query(func.sum(BrokerCommission.total_premiums)).scalar() or 0
    avg_pct = db.query(func.avg(BrokerCommission.commission_pct)).scalar() or 0
    years = db.query(BrokerCommission.plan_year).distinct().order_by(BrokerCommission.plan_year.desc()).all()
    benefit_types = db.query(
        BrokerCommission.benefit_type,
        func.count(BrokerCommission.id),
        func.sum(BrokerCommission.total_compensation)
    ).group_by(BrokerCommission.benefit_type).all()

    return {
        "totalRecords": total_records,
        "flaggedCount": flagged_count,
        "totalCompensation": float(total_comp),
        "totalPremiums": float(total_premiums),
        "avgCommissionPct": round(float(avg_pct), 4),
        "years": [y[0] for y in years],
        "byBenefitType": [
            {"benefitType": bt, "count": c, "totalCompensation": float(tc or 0)}
            for bt, c, tc in benefit_types
        ],
    }


@router.get("/groups/{plan_ein}")
def get_group_history(plan_ein: str, db: Session = Depends(get_db)):
    rows = (
        db.query(BrokerCommission)
        .filter(BrokerCommission.plan_ein == plan_ein)
        .order_by(BrokerCommission.plan_year.asc(), BrokerCommission.benefit_type.asc())
        .all()
    )
    return {"planEin": plan_ein, "records": [_serialize(r) for r in rows]}


@router.post("/seed")
def seed_endpoint(db: Session = Depends(get_db)):
    seeded = seed_broker_commissions(db)
    return {"seeded": seeded, "message": f"Seeded {seeded} records (0 = already existed)"}


@router.post("/reseed")
def reseed_endpoint(db: Session = Depends(get_db)):
    db.query(BrokerCommission).delete()
    db.commit()
    seeded = seed_broker_commissions(db)
    return {"seeded": seeded, "message": f"Reseeded {seeded} records"}
