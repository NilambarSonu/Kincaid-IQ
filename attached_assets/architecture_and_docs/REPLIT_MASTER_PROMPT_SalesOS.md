# MASTER REPLIT PROMPT
# Sales OS for Founders — Pre-Call Intelligence Engine
# Powered by Kincaid IQ × SiriusB iQ Ai Data Sciences Lab
# Version: 1.0 | April 2026

---

## PASTE THIS ENTIRE DOCUMENT INTO REPLIT AGENT AT PROJECT START

---

## PROJECT IDENTITY

You are building the **Sales OS for Founders** — a pre-call intelligence platform
that automatically generates an evidence-grade prospect brief for every commercial
account with 100+ employees using six live federal government APIs. No proprietary
data required. No third-party data vendors. Pure public regulatory intelligence.

This is a product of **SiriusB iQ Ai Data Sciences Lab** and **Kincaid IQ Verify™**,
the Bloomberg of Employee Benefits. The platform's tagline is:
"Cold call is dead. Evidence briefing is the motion."

Every output must carry a confidence tier: CERTIFIED / MODELED / INSUFFICIENT EVIDENCE.
Evidence lineage is the MO. Disruption by math, not by marketing.

---

## THE CORE INSIGHT

Every commercial employer with 100+ employees files a DOL Form 5500 with the
U.S. Department of Labor annually, under penalty of law. This filing discloses:
- Total health benefits spend (Schedule H)
- Broker/advisor compensation paid by the plan (Schedule C)
- Carrier contract premiums, claims, and retention (Schedule A)
- Stop-loss carrier and structure (Schedule A cross-reference)

Before any founder makes a sales call, they can pull the prospect's full benefits
financial profile from a public federal database — for free — and walk in with:
1. Their exact health spend per year
2. What their broker gets paid (and whether it's an outlier)
3. Which carrier and PBM they use
4. An estimated recoverable capital range
5. A SBI™ (Shady Broker Index) conflict score
6. An AI-generated evidence-anchored call opener

This is the Sales OS. Build it.

---

## TECH STACK

### Backend
- **Python 3.12** with **FastAPI** (async)
- **DuckDB** for in-process analytical queries against ingested federal data
- **httpx** for async federal API calls
- **pandas** for data normalization and canonical schema mapping
- **hashlib** (SHA-256) for evidence fingerprinting on every data record
- **pydantic v2** for all data models with strict typing

### Frontend
- **React 18** with **Vite**
- **TailwindCSS** (utility classes only)
- **JetBrains Mono** font (Google Fonts CDN)
- Zero external UI component libraries — build everything from scratch

### Database
- **DuckDB** (embedded, file-based: `data/salesos.duckdb`)
- **SQLite** fallback for session/cache state
- No PostgreSQL required for MVP — DuckDB handles all analytics

### Infrastructure
- Single `docker-compose.yml` with: api (FastAPI), frontend (Vite dev server)
- `.env` file for API keys (BLS requires free registration key)
- `requirements.txt` and `package.json` fully specified

---

## FILE STRUCTURE

```
salesos/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── routers/
│   │   ├── accounts.py            # Account list, search, filter
│   │   ├── brief.py               # Pre-call brief generation
│   │   ├── ingest.py              # Federal API ingestion triggers
│   │   ├── pipeline.py            # Pipeline status and health
│   │   └── benchmark.py          # Peer cohort benchmarking
│   ├── services/
│   │   ├── dol_efast2.py         # DOL Form 5500 EFAST2 client
│   │   ├── sec_edgar.py          # SEC EDGAR full-text search client
│   │   ├── cms_open.py           # CMS Open Data API client
│   │   ├── irs_990.py            # IRS 990 Explorer (ProPublica) client
│   │   ├── sam_gov.py            # SAM.gov entity information client
│   │   ├── bls_qcew.py           # BLS Quarterly Census API client
│   │   └── evidence.py           # SHA-256 evidence chain utilities
│   ├── models/
│   │   ├── account.py            # Account canonical schema
│   │   ├── brief.py              # Pre-call brief schema
│   │   ├── evidence.py           # EvidenceRef, confidence tiers
│   │   └── benchmark.py         # Peer cohort benchmark schema
│   ├── compute/
│   │   ├── sbi.py                # Shady Broker Index™ computation
│   │   ├── recoverable.py        # Recoverable capital estimation
│   │   ├── glp1_risk.py          # GLP-1 exposure scoring
│   │   └── confidence.py        # CERTIFIED/MODELED/INSUFFICIENT gating
│   └── data/
│       └── salesos.duckdb        # Embedded analytical database
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Shell.jsx     # App shell with left nav
│       │   │   ├── TopBar.jsx    # Brand bar + live indicator
│       │   │   └── LeftNav.jsx   # Nav with group sections
│       │   ├── views/
│       │   │   ├── AccountBrief.jsx   # Pre-call dossier view
│       │   │   ├── Pipeline.jsx       # Account pipeline sorted by value
│       │   │   ├── ApiRegistry.jsx    # Federal API status + coverage
│       │   │   ├── Benchmark.jsx      # Peer cohort benchmark engine
│       │   │   └── IngestLog.jsx      # Federal data ingestion log
│       │   └── shared/
│       │       ├── TierBadge.jsx      # CERTIFIED/MODELED/INSUFFICIENT
│       │       ├── SbiGauge.jsx       # SBI™ score gauge
│       │       ├── RecoverableBar.jsx # Capital recovery range bar
│       │       └── EvidenceCite.jsx   # Federal filing citation block
│       └── lib/
│           ├── api.js            # API client (fetch wrappers)
│           ├── tokens.js         # Design tokens (colors, fonts)
│           └── format.js         # Number/currency formatters
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## DESIGN SYSTEM — NON-NEGOTIABLE

### Colors (CSS variables + Tailwind config)
```
--bg:         #08080a    (page background — true dark)
--surface:    #111116    (card backgrounds)
--surface2:   #18181f    (nested surfaces, table rows)
--gold:       #D4AF37    (primary brand accent — all headings, values)
--gold-light: #F0D060    (pullquotes, highlights)
--green:      #22c55e    (CERTIFIED, positive, hot leads)
--red:        #ef4444    (P0 alerts, BREACHED, high risk)
--blue:       #3b82f6    (informational, EDGAR, secondary actions)
--purple:     #a855f7    (IRS 990, nonprofit data)
--orange:     #f97316    (SAM.gov, government contractors)
--cyan:       #06b6d4    (BLS, wage data, watch status)
--muted:      #6b7280    (secondary text, labels)
--border:     rgba(255,255,255,0.08)   (all card borders)
--text:       #e5e7eb    (primary body text)
--text-light: #f9fafb    (headings, values)
```

### Typography
- **Font:** JetBrains Mono — every element, no exceptions
- **Weights:** 400 (body), 700 (labels), 800 (values, headings)
- **Scale:** 8px (labels) · 9px (metadata) · 10px (nav) · 11px (body) · 12–14px (section headers) · 16–22px (values)
- Letter spacing: 0.1–0.2em on all uppercase labels

### Component Rules
- All cards: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 8–10px`
- Left accent bars on active items: 3px, `border-radius: 2px`, color matches status
- Confidence tier badges: `border: 1px solid {color}`, transparent fill, monospace font
- No gradients on functional UI elements
- No box-shadows except 0px focus rings
- Status dots: 6px circle, `box-shadow: 0 0 8px {color}66`

---

## FEDERAL API INTEGRATIONS

### 1. DOL EFAST2 — Primary Data Source
```
Base URL: https://efts.dol.gov/LATEST/search-index
Docs: https://efts.dol.gov/

Key endpoint: GET /search?q={company_name}&dateRange=custom&startDate=2023-01-01&endDate=2025-12-31&hits.hits.total.value=true
Returns: Form 5500 filings with ACK_ID, plan name, sponsor EIN, filing year

Schedule data extraction:
- Schedule A: /filing/{ack_id}/scheduleA → carrier premiums, broker fees
- Schedule C: /filing/{ack_id}/scheduleC → service provider compensation
- Schedule H: /filing/{ack_id}/scheduleH → plan financials (large plans)
- Schedule I: /filing/{ack_id}/scheduleI → plan financials (small plans)

Key fields to extract:
  ack_id, plan_name, sponsor_name, sponsor_ein, plan_year_begin, plan_year_end,
  total_participants, employer_contributions, total_plan_assets,
  schedule_a.insurance_carrier, schedule_a.premiums_paid, schedule_a.claims_paid,
  schedule_a.broker_fees, schedule_c.service_provider_name,
  schedule_c.direct_compensation, schedule_c.indirect_compensation
```

### 2. SEC EDGAR — Public Company Intelligence
```
Base URL: https://efts.sec.gov/LATEST/search-index
EDGAR Full-Text: https://efts.sec.gov/LATEST/search-index?q="{company_name}"&dateRange=custom&startdt=2023-01-01&enddt=2025-12-31&forms=10-K

CIK lookup: https://www.sec.gov/cgi-bin/browse-edgar?company={name}&action=getcompany&type=10-K&dateb=&owner=include&count=10&search_text=&output=atom

10-K compensation fields (from filing text extraction):
  total_compensation_expense, benefits_as_pct_sgna, headcount_total,
  benefits_cost_annual, health_plan_type, stop_loss_disclosed

Note: Use SEC EDGAR full-text search to find 10-K filings, then extract
compensation tables from filing HTML using BeautifulSoup.
```

### 3. CMS Open Data — Healthcare Provider Intelligence
```
Base URL: https://data.cms.gov/api/1/datastore/sql
Key dataset: Medicare Advantage Organization Contract List
Endpoint: POST /api/1/datastore/sql
Body: {"query": "SELECT * FROM {dataset_id} WHERE state='{state}' LIMIT 100"}

Also useful:
- National Plan and Provider Enumeration System (NPPES): https://npiregistry.cms.hhs.gov/api/
- Provider lookup: GET https://npiregistry.cms.hhs.gov/api/?number={npi}&version=2.1
```

### 4. IRS 990 Explorer (ProPublica Nonprofit API)
```
Base URL: https://projects.propublica.org/nonprofits/api/v2
Search: GET /search.json?q={org_name}&state[id]={state}&ntee[id]=H (Health)
Filing: GET /organizations/{ein}.json
Returns: total_revenue, total_expenses, total_compensation, employee_count,
         form_990_part_ix_total_functional_expenses, employee_benefits_amount
No API key required.
```

### 5. SAM.gov — Federal Contractor Intelligence
```
Base URL: https://api.sam.gov/entity-information/v3/entities
Requires: Free API key from SAM.gov (register at https://sam.gov/content/entity-registration)
Key params: ?api_key={key}&legalBusinessName={name}&registrationStatus=Active
Returns: ueiSAM, cageCode, naicsCode, entityStructureCode, employeeCount, annualRevenue
```

### 6. BLS QCEW — Wage & Employment Benchmarks
```
Base URL: https://api.bls.gov/publicAPI/v2
Requires: Free API key from https://www.bls.gov/developers/api_faqs.htm
Quarterly data: POST https://api.bls.gov/publicAPI/v2/timeseries/data/
Series IDs for QCEW: ENU{state_fips}{area_fips}10{size_class}XXXXX
Returns: avg_weekly_wage, employment_level, establishment_count by NAICS
```

---

## CANONICAL ACCOUNT SCHEMA

```python
# models/account.py
from pydantic import BaseModel
from typing import Optional, List
from enum import Enum

class ConfidenceTier(str, Enum):
    CERTIFIED = "CERTIFIED"
    MODELED = "MODELED"
    INSUFFICIENT = "INSUFFICIENT_EVIDENCE"

class SbiTier(str, Enum):
    RED = "RED"        # SBI 70-100: high conflict risk
    WARN = "WARN"      # SBI 45-69: moderate concern
    MONITOR = "MONITOR" # SBI 25-44: watch
    GREEN = "GREEN"    # SBI 0-24: aligned

class AccountStatus(str, Enum):
    HOT = "hot"        # P0 outreach — act now
    WARM = "warm"      # Strong signal — outreach within 30 days
    WATCH = "watch"    # Monitor — outreach pre-renewal
    COLD = "cold"      # Low signal — deprioritize

class EvidenceRef(BaseModel):
    source_api: str           # "DOL_EFAST2" | "SEC_EDGAR" | "CMS" | "IRS_990" | "SAM_GOV" | "BLS_QCEW"
    filing_type: str          # "Form_5500" | "10-K" | "990" | "QCEW"
    ack_id: Optional[str]     # DOL ACK_ID or SEC accession number
    schedule: Optional[str]   # "A" | "C" | "H" | "I"
    plan_year: Optional[int]
    input_hash: str           # SHA-256 of raw API response
    retrieved_at: str         # ISO timestamp
    confidence: ConfidenceTier

class CanonicalAccount(BaseModel):
    # Identity
    id: str
    name: str
    ein: Optional[str]
    city: str
    state: str
    industry: str
    naics_code: Optional[str]
    employees: int
    funding_type: str         # "self_funded" | "fully_insured" | "level_funded"

    # Federal filing linkage
    ack_id: Optional[str]     # DOL Form 5500 ACK_ID
    plan_year: Optional[int]
    source_flags: List[str]   # Which APIs contributed data

    # Benefits economics (from DOL 5500)
    health_spend_annual: Optional[float]
    broker_comp_annual: Optional[float]
    broker_comp_pct_premium: Optional[float]
    carrier: Optional[str]
    pbm: Optional[str]
    plan_type: Optional[str]
    stop_loss_carrier: Optional[str]
    stop_loss_attachment: Optional[float]
    last_rfp_year: Optional[int]

    # Intelligence scores
    sbi_score: Optional[float]       # 0-100
    sbi_tier: Optional[SbiTier]
    sbi_components: Optional[dict]   # opacity, renewal_bias, rebate_distortion, spread_linkage

    # Capital recovery
    recoverable_low: Optional[float]
    recoverable_high: Optional[float]
    recoverable_confidence: ConfidenceTier

    # Risk flags
    glp1_exposure: Optional[str]     # "HIGH" | "ELEVATED" | "MODERATE" | "LOW"
    erisa_risk: Optional[str]        # "RED" | "YELLOW" | "GREEN"

    # Pipeline
    status: AccountStatus
    insight: Optional[str]
    call_opener: Optional[str]
    p0_action: Optional[str]

    # Evidence chain
    evidence_refs: List[EvidenceRef] = []
```

---

## CORE COMPUTATION ENGINES

### Shady Broker Index™ (SBI)
```python
# compute/sbi.py
# SBI = (Opacity × 0.30) + (Renewal_Incentive_Bias × 0.25) +
#        (Rebate_Distortion × 0.25) + (Spread_Pricing_Linkage × 0.20)
# All components normalized 0-100. Output: 0-100.

def compute_sbi(
    broker_comp_pct_premium: float,        # From Schedule A/C
    peer_median_comp_pct: float,           # From benchmark corpus
    years_since_rfp: int,                  # From filing history
    carrier_count: int,                    # 1 carrier = higher opacity
    schedule_c_filed: bool,                # Transparency flag
    indirect_comp_ratio: float             # Indirect vs direct comp
) -> dict:
    # Opacity component (0-100)
    opacity = 0
    if not schedule_c_filed:
        opacity += 40
    opacity += min(40, (broker_comp_pct_premium / peer_median_comp_pct - 1) * 100)
    opacity += min(20, indirect_comp_ratio * 20)

    # Renewal incentive bias (0-100)
    renewal_bias = min(100, years_since_rfp * 15)

    # Rebate distortion — modeled from carrier/PBM alignment signals
    rebate_distortion = 50  # MODELED default when NDC claims unavailable

    # Spread pricing linkage — modeled from carrier concentration
    spread_linkage = 30 if carrier_count == 1 else 20

    sbi = (opacity * 0.30 + renewal_bias * 0.25 +
           rebate_distortion * 0.25 + spread_linkage * 0.20)

    tier = ("RED" if sbi >= 70 else "WARN" if sbi >= 45
            else "MONITOR" if sbi >= 25 else "GREEN")

    return {
        "score": round(sbi, 1),
        "tier": tier,
        "components": {
            "opacity": round(opacity, 1),
            "renewal_bias": round(renewal_bias, 1),
            "rebate_distortion": round(rebate_distortion, 1),
            "spread_linkage": round(spread_linkage, 1),
        },
        "confidence": "MODELED"
    }
```

### Recoverable Capital Estimation
```python
# compute/recoverable.py
# Three-component model: spread + rebate + formulary distortion
# All components MODELED unless NDC-level claims provided (upgrades to CERTIFIED)

def estimate_recoverable(
    total_rx_spend: float,
    total_health_spend: float,
    employees: int,
    industry_group: str,      # For SIC/NAICS benchmark lookup
    peer_percentile: float,   # Where employer sits vs peer cohort (0-1)
) -> dict:
    # Component 1: PBM Spread (estimated 6-10pp on branded)
    rx_branded_pct = 0.45  # Industry benchmark
    spread_rate = 0.08     # Median spread rate
    spread_recovery = total_rx_spend * rx_branded_pct * spread_rate

    # Component 2: Rebate under-remittance
    # Median passthrough: 88% vs 100% guarantee = 12pp gap
    rebate_recovery = total_rx_spend * 0.30 * 0.12  # 30% rebate-eligible, 12pp gap

    # Component 3: Formulary / biosimilar opportunity
    biosimilar_recovery = total_rx_spend * 0.08 * 0.30  # 8% specialty, 30% savings

    total_rx_recovery = spread_recovery + rebate_recovery + biosimilar_recovery

    # Medical component: site-of-service, network optimization
    medical_recovery = (total_health_spend - total_rx_spend) * 0.035

    low = round(total_rx_recovery * 0.7 + medical_recovery * 0.5)
    high = round(total_rx_recovery * 1.3 + medical_recovery * 1.5)

    return {
        "low": low,
        "high": high,
        "components": {
            "pbm_spread": round(spread_recovery),
            "rebate_gap": round(rebate_recovery),
            "biosimilar": round(biosimilar_recovery),
            "medical": round(medical_recovery),
        },
        "confidence": "MODELED",
        "upgrade_path": "Provide NDC-level claims + PBM remittance report → CERTIFIED"
    }
```

---

## FASTAPI ENDPOINTS

```python
# All endpoints return: {"data": ..., "confidence": ..., "evidence": [...], "metadata": {...}}

GET  /api/accounts                     # List accounts with filters
GET  /api/accounts/{id}                # Single account with full brief
GET  /api/accounts/{id}/brief          # Pre-call intelligence brief
GET  /api/accounts/{id}/opener         # AI-generated call opener
POST /api/accounts/search              # Search by name, EIN, city, state
POST /api/accounts/ingest              # Trigger federal API ingest for EIN

GET  /api/benchmark/cohort             # Peer cohort stats (anon, k>=11)
GET  /api/benchmark/sbi                # SBI distribution by industry
GET  /api/benchmark/recoverable        # Recoverable capital distribution

GET  /api/pipeline                     # Full pipeline sorted by value
GET  /api/pipeline/stats               # Pipeline aggregate statistics

GET  /api/ingest/status                # Federal API connection health
POST /api/ingest/dol/{ein}            # Ingest DOL 5500 for specific EIN
POST /api/ingest/edgar/{ticker}        # Ingest EDGAR for public company
GET  /api/ingest/log                   # Ingestion history with hashes

GET  /api/health                       # Platform health check
```

---

## KEY UI VIEWS

### View 1: Account Brief (default view)
Split layout: account list left (220px), brief panel right
- Account list: search bar, status dot, SBI badge, source flags
- Brief panel sections:
  1. Account header: name, industry, employees, status badges
  2. Intelligence insight (gold italic, left border accent)
  3. KPI grid 2×3: Health Spend / Broker Comp / Recoverable Low / Recoverable High / GLP-1 / Last RFP
  4. Call opener block (gold-tinted, italic, evidence cite footer)
  5. P0 action block (red-tinted, specific next step)
  6. Evidence chain: list of federal filing citations with SHA-256 hashes

### View 2: Pipeline
- Three summary stat cards: Total Accounts / Hot P0 / Total Recoverable Portfolio
- Table rows: Name, Industry, Status, Recoverable Range, SBI Score, Last RFP, Confidence
- Sorted by recoverable_high descending
- Click row → navigate to Account Brief

### View 3: Federal API Registry
Six API cards in a vertical list, each showing:
- API name, label, live status badge
- Coverage description
- Fields extracted (as small chips)
- Endpoint (dimmed monospace)
- Last sync timestamp
- Record count
Bottom: The Architecture Insight block (gold-tinted, explains why this data exists and why no one uses it)

### View 4: Benchmark Engine
- Cohort selector: industry × state × employee_size × funding_type
- Percentile chart for: health_spend_pepm, broker_comp_pct, sbi_score
- "Where does your prospect sit?" — input EIN, get cohort position
- k-anonymity enforcer: hide cohorts with fewer than 11 members

### View 5: Ingest Log
- Federal API connection status table (6 rows, green/yellow/red status dots)
- Recent ingestion events: EIN, company, API source, rows processed, SHA-256 hash, timestamp
- Failed ingestion alerts with retry button

---

## EVIDENCE ARCHITECTURE RULES

These rules are constitutional. Never violate them.

1. **Every API response is SHA-256 hashed on receipt** before any transformation.
   ```python
   import hashlib, json
   def hash_response(data: dict) -> str:
       return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
   ```

2. **Every computed KPI carries a confidence tier**: CERTIFIED | MODELED | INSUFFICIENT_EVIDENCE
   - CERTIFIED: evidence set is complete and verified (all required fields present, source hash validated)
   - MODELED: actuarial projection with disclosed uncertainty bounds (missing 1+ required fields)
   - INSUFFICIENT_EVIDENCE: do not surface to user — log and request more data

3. **Deterministic computation**: same inputs always produce same outputs.
   No random sampling. No probabilistic outputs that vary between runs.

4. **Evidence chain on every account record**: list of EvidenceRef objects,
   each with source_api, filing_type, ack_id, schedule, plan_year, input_hash, retrieved_at.

5. **No output without evidence**: if federal API returns no data for an EIN,
   the account status is "INSUFFICIENT_EVIDENCE" — do not generate a brief.

6. **Confidence tier propagation**: the overall account confidence is the
   minimum confidence tier across all contributing evidence refs.

---

## BRANDING CONSTANTS (use exactly)

```javascript
// frontend/src/lib/tokens.js
export const BRAND = {
  name: "KINCAID IQ VERIFY™",
  sub: "SALES OS · FOUNDER EDITION",
  parent: "SIRIUSB iQ AI DATA SCIENCES LAB",
  advisory: "KINCAID RISK MANAGEMENT CONSULTANTS",
  tagline: "Cold call is dead. Evidence briefing is the motion.",
  tagline2: "Dashboards show numbers. Kincaid IQ shows receipts.",
  mo: "Evidence lineage is our MO.",
  disruption: "Disruption by math, not by marketing.",
  believe: "I believe in myself.",
};

export const COLORS = {
  bg: "#08080a",
  surface: "#111116",
  surface2: "#18181f",
  gold: "#D4AF37",
  goldLight: "#F0D060",
  green: "#22c55e",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
  cyan: "#06b6d4",
  muted: "#6b7280",
  border: "rgba(255,255,255,0.08)",
  text: "#e5e7eb",
  textLight: "#f9fafb",
};

export const TIERS = {
  CERTIFIED:            { color: "#22c55e", label: "CERTIFIED" },
  MODELED:              { color: "#D4AF37", label: "MODELED" },
  INSUFFICIENT_EVIDENCE:{ color: "#ef4444", label: "INSUFFICIENT EVIDENCE" },
};

export const STATUS = {
  hot:   { color: "#ef4444", label: "HOT" },
  warm:  { color: "#D4AF37", label: "WARM" },
  watch: { color: "#06b6d4", label: "WATCH" },
  cold:  { color: "#6b7280", label: "COLD" },
};

export const SBI_TIERS = {
  RED:     { color: "#ef4444", range: "70–100", label: "HIGH CONFLICT RISK" },
  WARN:    { color: "#D4AF37", range: "45–69",  label: "MODERATE CONCERN" },
  MONITOR: { color: "#06b6d4", range: "25–44",  label: "MONITOR" },
  GREEN:   { color: "#22c55e", range: "0–24",   label: "ALIGNED" },
};
```

---

## DOCKER COMPOSE

```yaml
version: "3.9"
services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/data:/app/data
    env_file: .env
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
    command: npm run dev -- --host
```

---

## .env.example

```
# BLS API (free at https://www.bls.gov/developers/api_faqs.htm)
BLS_API_KEY=your_bls_key_here

# SAM.gov API (free at https://sam.gov/content/entity-registration)
SAM_GOV_API_KEY=your_sam_key_here

# DOL EFAST2 (no key required — public API)
DOL_EFAST2_BASE=https://efts.dol.gov/LATEST/search-index

# SEC EDGAR (no key required — public API)
SEC_EDGAR_BASE=https://efts.sec.gov/LATEST/search-index

# CMS Open Data (no key required — public API)
CMS_BASE=https://data.cms.gov/api/1/datastore/sql

# IRS 990 / ProPublica (no key required — public API)
IRS_990_BASE=https://projects.propublica.org/nonprofits/api/v2

# App settings
APP_ENV=development
DUCKDB_PATH=./data/salesos.duckdb
K_ANON_MIN=11
CONFIDENCE_GATE_STRICT=true
```

---

## SEED DATA (for MVP demo without live API calls)

Pre-load the following five accounts into DuckDB on startup if no live data exists.
These are based on real DOL Form 5500 public filings and represent the Indiana
market (primary ICP geography).

| EIN | Company | Employees | Health Spend | Broker Comp | Carrier | SBI | Status |
|-----|---------|-----------|-------------|-------------|---------|-----|--------|
| 35-XXXXXXX | R.T. Moore Co. | 612 | $2,840,000 | $187,400 | UHC | 74 | HOT |
| 35-XXXXXXX | Interstate Cold Storage | 448 | $1,960,000 | $142,000 | Cigna | 61 | WARM |
| 35-XXXXXXX | Zotec Partners LLC | 887 | $4,120,000 | $224,000 | Anthem | 82 | HOT |
| 35-XXXXXXX | Brehob Corporation | 334 | $1,480,000 | $98,000 | UHC | 55 | WATCH |
| 13-XXXXXXX | FullBeauty Brands | 1,240 | $5,890,000 | $312,000 | Cigna | 79 | HOT |

All recoverable capital figures confidence tier: MODELED.
Upgrade path on each record: "Provide NDC-level Rx claims → CERTIFIED"

---

## BUILD ORDER (execute in sequence)

1. `backend/main.py` — FastAPI app skeleton with health check
2. `backend/data/` — DuckDB schema init with canonical account table
3. `backend/models/` — Pydantic schemas for account, evidence, brief
4. `backend/compute/sbi.py` — SBI™ computation engine
5. `backend/compute/recoverable.py` — Recoverable capital estimation
6. `backend/compute/confidence.py` — Confidence tier gating logic
7. `backend/services/dol_efast2.py` — DOL EFAST2 client with SHA-256 hashing
8. `backend/services/sec_edgar.py` — EDGAR client
9. `backend/routers/accounts.py` — Account CRUD + search endpoints
10. `backend/routers/brief.py` — Pre-call brief generation
11. `backend/routers/pipeline.py` — Pipeline stats endpoint
12. `backend/routers/ingest.py` — Federal API ingestion triggers
13. `frontend/src/lib/tokens.js` — Design tokens
14. `frontend/src/components/layout/Shell.jsx` — App shell
15. `frontend/src/components/layout/LeftNav.jsx` — Nav with Go-To-Market group
16. `frontend/src/components/views/AccountBrief.jsx` — Primary view
17. `frontend/src/components/views/Pipeline.jsx` — Pipeline view
18. `frontend/src/components/views/ApiRegistry.jsx` — Federal API status
19. `frontend/src/components/shared/TierBadge.jsx` — Reusable confidence badge
20. `frontend/src/App.jsx` — Route wiring
21. `docker-compose.yml` — Container orchestration
22. Seed data load → verify all 5 demo accounts render in Account Brief

---

## CRITICAL ARCHITECTURAL CONSTRAINTS

- The deterministic layer (SBI™, recoverable capital, confidence tiering) and
  the generative layer (call opener, insight text) MUST NEVER MERGE.
  Deterministic computations run first. Generative text is gated and labeled.

- Every generative output (call opener, insight, P0 action) is labeled:
  "AI-Generated · Evidence-Anchored · MODELED" — never presented as CERTIFIED.

- No KPI reaches the UI without a confidence tier. No confidence tier without
  an evidence chain. No evidence chain without a SHA-256 hash.

- The SBI™ is a registered trademark of SiriusB iQ Ai Data Sciences Lab.
  Always render as "SBI™" with the trademark symbol.

- k-anonymity: the benchmark cohort engine never returns statistics for a
  cohort smaller than 11 members (k=11). Return "INSUFFICIENT_EVIDENCE" instead.

---

## README HEADER (include in project)

```
# Sales OS for Founders
## Pre-Call Intelligence Engine · Powered by Kincaid IQ × SiriusB iQ

Cold call is dead. Evidence briefing is the motion.

Six federal APIs. One pre-call brief. Every commercial account with 100+
employees — health spend, broker comp, PBM, GLP-1 exposure, recoverable
capital estimate — before you dial.

Built by Jeremiah Franklin Shrack | SiriusB iQ Ai Data Sciences Lab
Evidence lineage is our MO. Disruption by math, not by marketing.

kincaidrmc.com | jer@kincaidrmc.com | Carmel, Indiana
```

---

BEGIN BUILDING. Execute the build order above in sequence.
Do not skip the evidence architecture rules.
Every number needs a receipt.
```
