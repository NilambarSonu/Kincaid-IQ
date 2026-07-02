---
name: DOL Form 5500 DuckDB quirks
description: Non-obvious traps when querying data/dol5500.duckdb (sch_h_2024) for health-plan opportunity work
---

# DOL Form 5500 DuckDB (`data/dol5500.duckdb`, table `sch_h_2024`)

- **Boolean benefit flags are unusable.** `IS_HEALTH`, `IS_DRUG`, `IS_STOP_LOSS` are all false across the table (and `employers.has_health` / `has_stop_loss` are ALL FALSE too). Detect plan type from `WELFARE_BENEFIT_CODES`: `'%4A%'` = health/medical, `'%4I%'` = stop-loss. The `employers` rollup has NO usable plan-type column — derive per-EIN flags by joining `sch_h_2024` codes (e.g. `BOOL_OR(WELFARE_BENEFIT_CODES LIKE '%4A%')` grouped by EIN).
- **DuckDB returns `decimal.Decimal`** for money/numeric columns. Coerce to `float` before any arithmetic or JSON serialization, or downstream math/formatting breaks.
- **`PARTICIPANTS` is INT32.** Any product like `PARTICIPANTS * 1000` in SQL overflows. Cast with `PARTICIPANTS::BIGINT` first.
- **Meaningful filings filter:** most rows are noise. Real opportunities have `PARTICIPANTS > 0 AND (TOTAL_INCOME_AMT > 0 OR BROKER_COMMISSIONS > 0)`. ~85k distinct sponsors qualify.
- **Year skew:** FORM_YEAR spans 2020-2024 but 2024 has only ~1.3k rows; bulk is 2020-2023. De-dupe to one row per EIN with a window over FORM_YEAR DESC.
- Benchmark joins: `industry_bench` (BUSINESS_CODE, FORM_YEAR) and `state_benchmarks` (STATE, BUSINESS_CODE, FORM_YEAR) carry p50/p75/p90 admin_fees + broker_comm percentiles.
- **Funding type (self- vs fully-insured) is NOT a filed field.** Infer it: `WELFARE_PREMIUMS > 0 AND CARRIER_NAME present` → fully-insured; premium ≈ 0 with admin fees → self-insured; else indeterminate. Tier such inference MODELED, never CERTIFIED.
- **Not in this DB (return INSUFFICIENT_EVIDENCE, never fabricate):** Schedule C service-provider/indirect comp, participant active/retired/separated splits (only the single `PARTICIPANTS` total exists), PBM contract terms/rebates. SEC XBRL lives in **Postgres** (`sec_submissions`/`sec_numeric`), not DuckDB; most private employers have no 10-K → INSUFFICIENT. Doctrine: any derived/transformed value (e.g. EBITDA = OperatingIncomeLoss×1.12) is MODELED, not CERTIFIED.
- **`BUSINESS_CODE` is 6-digit NAICS, NOT SIC** (e.g. `622000` = Hospitals/Health Care, `541xxx` = Professional Services). Map to a readable sector via the NAICS 2-digit prefix. WARNING: `ma_diligence.SECTOR_MAP` / `_sector()` is an SIC-style 2-digit map and produces WRONG labels on this data (it reads `62` as "Securities" instead of Health Care). Use a NAICS 2-digit map instead — see `_naics_sector()` in `backend/routers/rfp_intelligence.py`.

## `employers` table (aggregated one-row-per-EIN view)
- Columns are **different from `sch_h_2024`**: participant count is `max_participants` (NOT `participants`), industry is `business_code` VARCHAR (NOT `naics`), and money columns are `total_welfare_premiums`, `total_admin_fees`, `total_broker_commissions`, `total_income` — there is **no `tot_charges`/claims-cost column**.
- For a peer-cohort PMPM proxy, use `SUM(total_welfare_premiums) / SUM(max_participants) / 12` segmented by `state` + `substr(business_code,1,2)`; TX/54 ≈ $324 PMPM (n≈118), CA/54 ≈ $470, national ≈ $577. Guard with `n >= 5` and require the value land in a sane band before trusting it, else fall back to a modeled national number.

**Why:** these cost hours of dead-end debugging (silent false flags, Decimal TypeErrors, INT32 OverflowException, "column not found" binder errors from guessing column names) on every new query against this DB.
