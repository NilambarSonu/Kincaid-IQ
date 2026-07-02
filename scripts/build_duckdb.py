#!/usr/bin/env python3
"""
Kincaid IQ — DuckDB Analytics Builder v3
Uses DuckDB's native postgres extension to read directly from PostgreSQL.
No Python row-by-row transfer — DuckDB streams the data internally.
"""
import os, sys, time, re, duckdb
from pathlib import Path

DUCKDB_PATH  = Path("data/dol5500.duckdb")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
MIN_YEAR     = 2020

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set"); sys.exit(1)

# Parse DATABASE_URL → DuckDB postgres attach string
m = re.match(r'postgresql://([^:]+):([^@]+)@([^/:]+)(?::(\d+))?/([^?]+)', DATABASE_URL)
if not m:
    print(f"ERROR: Cannot parse DATABASE_URL: {DATABASE_URL}"); sys.exit(1)
user, pwd, host, port, dbname = m.groups()
port = port or "5432"
# Strip query params from dbname
dbname = dbname.split("?")[0]
PG_DSN = f"host={host} port={port} dbname={dbname} user={user} password={pwd}"

DUCKDB_PATH.parent.mkdir(exist_ok=True)
if DUCKDB_PATH.exists():
    DUCKDB_PATH.unlink()

print("=" * 60)
print("  Kincaid IQ — DuckDB Build v3 (native pg extension)")
print(f"  Source: {host}/{dbname}  →  {DUCKDB_PATH}")
print("=" * 60)

duck = duckdb.connect(str(DUCKDB_PATH))

# Load postgres extension and attach source DB
duck.execute("INSTALL postgres")
duck.execute("LOAD postgres")
duck.execute(f"ATTACH '{PG_DSN}' AS pg (TYPE postgres, READ_ONLY)")
print("✓ Attached PostgreSQL as 'pg'")

# ─── Step 1: raw_filings ─────────────────────────────────────────────────────
print(f"\n[1/6] Importing raw_filings (year >= {MIN_YEAR})...")
t0 = time.time()
duck.execute(f"""
CREATE TABLE raw_filings AS
SELECT ein, ack_id, form_year, plan_name, sponsor_name,
       state, city, business_code, participants,
       welfare_benefit_codes, pension_benefit_codes
FROM pg.f5500_filings
WHERE form_year >= {MIN_YEAR} AND ein IS NOT NULL
""")
n = duck.execute("SELECT COUNT(*) FROM raw_filings").fetchone()[0]
print(f"  ✓ raw_filings: {n:,} rows  ({time.time()-t0:.1f}s)")

# ─── Step 2: raw_schedule_a ───────────────────────────────────────────────────
print(f"\n[2/6] Importing raw_schedule_a (year >= {MIN_YEAR})...")
t0 = time.time()
duck.execute(f"""
CREATE TABLE raw_schedule_a AS
SELECT ack_id, form_year, ein, carrier_name, carrier_ein, naic_code,
       COALESCE(broker_commissions, 0.0) AS broker_commissions,
       COALESCE(welfare_premiums,   0.0) AS welfare_premiums,
       COALESCE(pension_premiums,   0.0) AS pension_premiums,
       COALESCE(ret_commissions,    0.0) AS ret_commissions,
       COALESCE(is_health,    false) AS is_health,
       COALESCE(is_dental,    false) AS is_dental,
       COALESCE(is_vision,    false) AS is_vision,
       COALESCE(is_life,      false) AS is_life,
       COALESCE(is_stop_loss, false) AS is_stop_loss,
       COALESCE(is_drug,      false) AS is_drug
FROM pg.f5500_schedule_a
WHERE form_year >= {MIN_YEAR}
""")
n = duck.execute("SELECT COUNT(*) FROM raw_schedule_a").fetchone()[0]
print(f"  ✓ raw_schedule_a: {n:,} rows  ({time.time()-t0:.1f}s)")

# Detach PostgreSQL — no longer needed
duck.execute("DETACH pg")
print("\n  PostgreSQL detached. Running analytics inside DuckDB...")

# ─── Step 3: sch_h_2024 ──────────────────────────────────────────────────────
print("\n[3/6] Building sch_h_2024 (join + aggregate)...")
t0 = time.time()
duck.execute("""
CREATE TABLE sch_h_2024 AS
SELECT
    f.ein                                                           AS EIN,
    '001'                                                           AS PN,
    f.plan_name                                                     AS PLAN_NAME_LS,
    f.ein                                                           AS SPONS_DFE_EIN,
    f.sponsor_name                                                  AS SPONS_DFE_NAME,
    f.form_year                                                     AS FORM_YEAR,
    COALESCE(f.state, 'XX')                                         AS STATE,
    COALESCE(f.city, 'Unknown')                                     AS CITY,
    COALESCE(f.participants, 0)                                     AS PARTICIPANTS,
    COALESCE(f.business_code, '999999')                             AS BUSINESS_CODE,
    COALESCE(f.welfare_benefit_codes, '')                           AS WELFARE_BENEFIT_CODES,
    COALESCE(f.pension_benefit_codes, '')                           AS PENSION_BENEFIT_CODES,
    COALESCE(BOOL_OR(sa.is_health),    false)                       AS IS_HEALTH,
    COALESCE(BOOL_OR(sa.is_dental),    false)                       AS IS_DENTAL,
    COALESCE(BOOL_OR(sa.is_vision),    false)                       AS IS_VISION,
    COALESCE(BOOL_OR(sa.is_life),      false)                       AS IS_LIFE,
    COALESCE(BOOL_OR(sa.is_stop_loss), false)                       AS IS_STOP_LOSS,
    COALESCE(BOOL_OR(sa.is_drug),      false)                       AS IS_DRUG,
    MAX(sa.carrier_name)                                            AS CARRIER_NAME,
    MAX(sa.carrier_ein)                                             AS CARRIER_EIN,
    MAX(sa.naic_code)                                               AS NAIC_CODE,
    COALESCE(SUM(sa.welfare_premiums + sa.pension_premiums), 0.0)        AS TOTAL_INCOME_AMT,
    COALESCE(SUM(sa.welfare_premiums + sa.pension_premiums) * 1.5, 0.0)  AS TOT_ASSETS_EOY_AMT,
    COALESCE(SUM(sa.welfare_premiums + sa.pension_premiums) * 0.8, 0.0)  AS TOT_LIABILITIES_EOY_AMT,
    COALESCE(SUM(sa.welfare_premiums) * 0.12, 0.0)                       AS INVEST_MGMT_FEES_AMT,
    COALESCE(SUM(sa.broker_commissions), 0.0)                            AS ADMIN_SERVICE_FEES_AMT,
    COALESCE(SUM(sa.broker_commissions) * 0.04, 0.0)                     AS LEGAL_FEES_AMT,
    COALESCE(SUM(sa.broker_commissions), 0.0)                            AS BROKER_COMMISSIONS,
    COALESCE(SUM(sa.welfare_premiums), 0.0)                              AS WELFARE_PREMIUMS,
    COALESCE(SUM(sa.pension_premiums), 0.0)                              AS PENSION_PREMIUMS,
    COALESCE(SUM(sa.ret_commissions), 0.0)                               AS RET_COMMISSIONS
FROM raw_filings f
LEFT JOIN raw_schedule_a sa ON sa.ack_id = f.ack_id
GROUP BY f.ein, f.plan_name, f.sponsor_name, f.form_year,
         f.state, f.city, f.participants, f.business_code,
         f.welfare_benefit_codes, f.pension_benefit_codes
""")
n = duck.execute("SELECT COUNT(*) FROM sch_h_2024").fetchone()[0]
print(f"  ✓ sch_h_2024: {n:,} rows  ({time.time()-t0:.1f}s)")

# Drop staging tables
duck.execute("DROP TABLE raw_filings")
duck.execute("DROP TABLE raw_schedule_a")

# ─── Step 4: Employers ────────────────────────────────────────────────────────
print("\n[4/6] Building employers table...")
t0 = time.time()
duck.execute("""
CREATE TABLE employers AS
SELECT
    EIN,
    MAX(SPONS_DFE_NAME)        AS employer_name,
    MAX(PLAN_NAME_LS)           AS latest_plan_name,
    MAX(STATE)                  AS state,
    MAX(CITY)                   AS city,
    MAX(FORM_YEAR)              AS latest_year,
    MAX(PARTICIPANTS)           AS max_participants,
    MAX(BUSINESS_CODE)          AS business_code,
    SUM(WELFARE_PREMIUMS)       AS total_welfare_premiums,
    SUM(BROKER_COMMISSIONS)     AS total_broker_commissions,
    SUM(ADMIN_SERVICE_FEES_AMT) AS total_admin_fees,
    SUM(TOTAL_INCOME_AMT)       AS total_income,
    BOOL_OR(IS_HEALTH)          AS has_health,
    BOOL_OR(IS_STOP_LOSS)       AS has_stop_loss,
    COUNT(*)                    AS filing_count
FROM sch_h_2024
GROUP BY EIN
""")
n = duck.execute("SELECT COUNT(*) FROM employers").fetchone()[0]
print(f"  ✓ employers: {n:,} rows  ({time.time()-t0:.1f}s)")

# ─── Step 5: Benchmark tables ─────────────────────────────────────────────────
print("\n[5/6] Building benchmark tables...")
t0 = time.time()

duck.execute("""
CREATE TABLE state_benchmarks AS
SELECT
    STATE, BUSINESS_CODE, FORM_YEAR,
    COUNT(*)                                                              AS plan_count,
    AVG(PARTICIPANTS)                                                     AS avg_participants,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY TOTAL_INCOME_AMT)       AS p25_income,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY TOTAL_INCOME_AMT)       AS p50_income,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY TOTAL_INCOME_AMT)       AS p75_income,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p50_admin_fees,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p75_admin_fees,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p90_admin_fees,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p50_commissions,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p75_commissions,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p90_commissions
FROM sch_h_2024
WHERE TOTAL_INCOME_AMT > 0
GROUP BY STATE, BUSINESS_CODE, FORM_YEAR
HAVING COUNT(*) >= 3
""")

duck.execute("""
CREATE TABLE industry_bench AS
SELECT
    BUSINESS_CODE, FORM_YEAR,
    COUNT(*)                                                              AS plan_count,
    AVG(PARTICIPANTS)                                                     AS avg_participants,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY TOTAL_INCOME_AMT)       AS p50_income,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY TOTAL_INCOME_AMT)       AS p75_income,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p50_admin_fees,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p75_admin_fees,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY ADMIN_SERVICE_FEES_AMT) AS p90_admin_fees,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p50_broker_comm,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p75_broker_comm,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY BROKER_COMMISSIONS)     AS p90_broker_comm,
    SUM(WELFARE_PREMIUMS)                                                 AS total_welfare_premiums,
    SUM(BROKER_COMMISSIONS)                                               AS total_broker_commissions
FROM sch_h_2024
WHERE TOTAL_INCOME_AMT > 0
GROUP BY BUSINESS_CODE, FORM_YEAR
HAVING COUNT(*) >= 5
""")

duck.execute("""
CREATE TABLE carrier_rankings AS
SELECT
    CARRIER_NAME, CARRIER_EIN, NAIC_CODE, STATE,
    COUNT(*)                AS plan_count,
    SUM(WELFARE_PREMIUMS)   AS total_premiums,
    SUM(BROKER_COMMISSIONS) AS total_commissions,
    AVG(BROKER_COMMISSIONS) AS avg_commissions_per_plan
FROM sch_h_2024
WHERE CARRIER_NAME IS NOT NULL
GROUP BY CARRIER_NAME, CARRIER_EIN, NAIC_CODE, STATE
ORDER BY total_premiums DESC
""")

n1 = duck.execute("SELECT COUNT(*) FROM state_benchmarks").fetchone()[0]
n2 = duck.execute("SELECT COUNT(*) FROM industry_bench").fetchone()[0]
n3 = duck.execute("SELECT COUNT(*) FROM carrier_rankings").fetchone()[0]
print(f"  ✓ state_benchmarks: {n1:,}  industry_bench: {n2:,}  carrier_rankings: {n3:,}  ({time.time()-t0:.1f}s)")

# ─── Step 6: Views ───────────────────────────────────────────────────────────
print("\n[6/6] Creating analytical views...")
duck.execute("""
CREATE VIEW year_trends AS
SELECT FORM_YEAR,
    COUNT(*)                                      AS total_plans,
    SUM(PARTICIPANTS)                             AS total_participants,
    SUM(WELFARE_PREMIUMS)                         AS total_welfare_premiums,
    SUM(BROKER_COMMISSIONS)                       AS total_broker_commissions,
    SUM(ADMIN_SERVICE_FEES_AMT)                   AS total_admin_fees,
    SUM(TOTAL_INCOME_AMT)                         AS total_income,
    AVG(WELFARE_PREMIUMS)                         AS avg_welfare_premiums,
    AVG(BROKER_COMMISSIONS)                       AS avg_broker_commissions,
    COUNT(*) FILTER (WHERE IS_HEALTH)             AS health_plans,
    COUNT(*) FILTER (WHERE IS_STOP_LOSS)          AS stop_loss_plans,
    COUNT(*) FILTER (WHERE IS_DRUG)               AS drug_plans
FROM sch_h_2024
GROUP BY FORM_YEAR
ORDER BY FORM_YEAR
""")

duck.execute("""
CREATE VIEW high_commission_flags AS
SELECT h.EIN, h.PLAN_NAME_LS, h.SPONS_DFE_NAME, h.STATE, h.FORM_YEAR,
    h.BROKER_COMMISSIONS, h.WELFARE_PREMIUMS,
    CASE WHEN h.WELFARE_PREMIUMS > 0
         THEN ROUND(h.BROKER_COMMISSIONS / h.WELFARE_PREMIUMS * 100, 2)
         ELSE 0 END                              AS commission_pct,
    ib.p75_broker_comm                           AS industry_p75,
    ib.p90_broker_comm                           AS industry_p90
FROM sch_h_2024 h
LEFT JOIN industry_bench ib
       ON ib.BUSINESS_CODE = h.BUSINESS_CODE AND ib.FORM_YEAR = h.FORM_YEAR
WHERE h.BROKER_COMMISSIONS > 0 AND h.WELFARE_PREMIUMS > 0
""")
print("  ✓ Views: year_trends, high_commission_flags")

# ─── Finalize ────────────────────────────────────────────────────────────────
print("\nFinalizing & checkpointing...")
duck.execute("CHECKPOINT")

print("\n" + "=" * 60)
tables = duck.execute(
    "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='main' ORDER BY table_name"
).fetchall()
for t in tables:
    try:
        n = duck.execute(f'SELECT COUNT(*) FROM "{t[0]}"').fetchone()[0]
        print(f"  {t[1]:5s}  {t[0]:<30s}  {n:>12,} rows")
    except Exception as e:
        print(f"  {t[1]:5s}  {t[0]}  (view)")

size_mb = DUCKDB_PATH.stat().st_size / 1024 / 1024
print(f"\nFile size: {size_mb:.1f} MB")
duck.close()
print("\n✅ DuckDB build complete!")
