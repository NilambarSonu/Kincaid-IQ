export type EvidenceType =
  | "broker-confirm"
  | "fund-statement"
  | "appraisal"
  | "valuation"
  | "regulatory"
  | "audit"
  | "legal"
  | "tax";

export interface DrillMeta {
  key: string;
  value: string;
  positive?: boolean;
}

export interface DrillNode {
  id: string;
  label: string;
  value?: string;
  change?: string;
  changePositive?: boolean;
  badge?: string;
  badgeAccent?: string;
  meta?: DrillMeta[];
  children?: DrillNode[];
  isEvidence?: boolean;
  evidenceType?: EvidenceType;
  institution?: string;
  refNumber?: string;
  date?: string;
  hash?: string;
  description?: string;
}

export interface DrillDownRoot {
  id: string;
  title: string;
  subtitle?: string;
  value?: string;
  change?: string;
  changePositive?: boolean;
  description?: string;
  children: DrillNode[];
}

const DRILL_TREES: Record<string, DrillDownRoot> = {

  "net-worth": {
    id: "net-worth",
    title: "Total Net Worth",
    subtitle: "Consolidated across all structures",
    value: "$2.41B",
    change: "+$14.2M today (+0.59%)",
    changePositive: true,
    description: "Aggregate fair market value of all assets net of liabilities as of March 5, 2026 close.",
    children: [
      {
        id: "nw-equities", label: "Public Equities", value: "$724.0M", change: "+$6.1M", changePositive: true,
        badge: "30.0%", badgeAccent: "#00A8FF",
        meta: [{ key: "Benchmark", value: "MSCI World" }, { key: "vs Benchmark", value: "+3.4% YTD", positive: true }, { key: "Custodian", value: "Kincaid Health / Fidelity" }],
        children: [
          {
            id: "nw-eq-tiger", label: "Tiger Global Long-Only", value: "$280.0M", change: "+2.8%", changePositive: true,
            badge: "Managed",
            meta: [{ key: "Strategy", value: "Technology Long-Only" }, { key: "Inception IRR", value: "+18.4%", positive: true }, { key: "Manager Since", value: "2018" }, { key: "Fee", value: "1.5% mgmt + 15% perf" }],
            children: [
              {
                id: "nw-eq-tiger-aapl", label: "Apple Inc (AAPL)", value: "$44.2M", change: "+0.9%", changePositive: true,
                badge: "Long", badgeAccent: "#00FF94",
                meta: [{ key: "Shares", value: "241,200" }, { key: "Price", value: "$183.24" }, { key: "Cost Basis", value: "$122.40/sh" }, { key: "Unrealized P&L", value: "+$14.7M", positive: true }, { key: "Weight", value: "1.83%" }],
                children: [
                  {
                    id: "nw-eq-tiger-aapl-analytics", label: "Position Analytics", value: "$44.2M",
                    meta: [
                      { key: "Days Held", value: "847" }, { key: "Beta to SPX", value: "1.12" },
                      { key: "52W High", value: "$199.62" }, { key: "52W Low", value: "$163.85" },
                      { key: "P/E Ratio", value: "29.4x" }, { key: "Dividend Yield", value: "0.44%" },
                    ],
                    children: [
                      {
                        id: "nw-eq-tiger-aapl-txns", label: "Transaction History (3 lots)", value: "$44.2M",
                        meta: [{ key: "Total Lots", value: "3" }, { key: "Avg Cost", value: "$122.40" }, { key: "Total Invested", value: "$29.5M" }],
                        children: [
                          {
                            id: "nw-eq-tiger-aapl-lot1", label: "Buy — Dec 14, 2021", value: "$2.55M",
                            meta: [{ key: "Shares", value: "15,000" }, { key: "Price", value: "$170.22" }, { key: "Account", value: "SHRACK-7742" }, { key: "Settle Date", value: "Dec 16, 2021" }],
                            children: [
                              { id: "ev-aapl-lot1-dtcc", label: "DTCC Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2021-1214-AAPL-001", date: "Dec 14, 2021", hash: "a3f8c2d1e9b4…", description: "Exchange-cleared equity trade confirmation. Settlement T+2. Counterparty: Goldman Sachs Prime." },
                              { id: "ev-aapl-lot1-stmt", label: "Kincaid Health Account Statement Q4 2021", isEvidence: true, evidenceType: "broker-confirm", institution: "Kincaid Health", refNumber: "STMT-Q42021-7742", date: "Dec 31, 2021", hash: "b7e1f4a2c6d8…", description: "End-of-quarter custody statement. Position reconciled by KPMG. Includes all dividends and corporate actions." },
                            ],
                          },
                          {
                            id: "nw-eq-tiger-aapl-lot2", label: "Buy — Jun 3, 2022", value: "$1.45M",
                            meta: [{ key: "Shares", value: "10,000" }, { key: "Price", value: "$144.80" }, { key: "Account", value: "SHRACK-7742" }],
                            children: [
                              { id: "ev-aapl-lot2-dtcc", label: "DTCC Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2022-0603-AAPL-002", date: "Jun 3, 2022", hash: "c9d2e5f1a7b3…", description: "Exchange-cleared equity trade. Market dip purchase. Settlement T+2." },
                            ],
                          },
                          {
                            id: "nw-eq-tiger-aapl-lot3", label: "Buy — Sep 15, 2023", value: "$3.82M",
                            meta: [{ key: "Shares", value: "214,200" }, { key: "Price", value: "$178.40" }, { key: "Account", value: "SHRACK-7742" }],
                            children: [
                              { id: "ev-aapl-lot3-dtcc", label: "DTCC Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2023-0915-AAPL-003", date: "Sep 15, 2023", hash: "d4f6b8c2e1a9…", description: "Block purchase. Tiger Global program trade via Morgan Stanley." },
                              { id: "ev-aapl-lot3-audit", label: "Annual Audit Reconciliation 2023", isEvidence: true, evidenceType: "audit", institution: "KPMG LLP", refNumber: "AUDIT-2023-KR-EQ-047", date: "Feb 14, 2024", hash: "e2a1b9c4d7f5…", description: "PwC/KPMG independent audit confirms position value and cost basis. No material differences noted." },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: "nw-eq-tiger-nvda", label: "NVIDIA Corp (NVDA)", value: "$38.6M", change: "+1.4%", changePositive: true,
                badge: "Long", badgeAccent: "#00FF94",
                meta: [{ key: "Shares", value: "38,100" }, { key: "Price", value: "$1,013.22" }, { key: "Cost Basis", value: "$242.80/sh" }, { key: "Unrealized P&L", value: "+$29.2M", positive: true }],
                children: [
                  { id: "nw-eq-tiger-nvda-pos", label: "Position Analytics", value: "$38.6M", meta: [{ key: "Days Held", value: "1,204" }, { key: "Beta", value: "1.72" }, { key: "Gain %", value: "+317%", positive: true }],
                    children: [
                      { id: "nw-eq-tiger-nvda-txn", label: "Buy — Mar 12, 2021", value: "$9.25M", meta: [{ key: "Shares", value: "38,100" }, { key: "Price", value: "$242.80" }],
                        children: [
                          { id: "ev-nvda-dtcc", label: "DTCC Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2021-0312-NVDA-001", date: "Mar 12, 2021", hash: "f3c8e2a1b6d4…", description: "Equity trade confirm. Pre-AI wave purchase. Settlement via DTC." },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                id: "nw-eq-tiger-msft", label: "Microsoft Corp (MSFT)", value: "$32.1M", change: "+0.6%", changePositive: true,
                badge: "Long", badgeAccent: "#00FF94",
                meta: [{ key: "Shares", value: "79,400" }, { key: "Price", value: "$404.22" }, { key: "Cost Basis", value: "$278.60/sh" }],
                children: [
                  { id: "nw-eq-tiger-msft-pos", label: "Position Analytics", value: "$32.1M", meta: [{ key: "P/E", value: "35.8x" }, { key: "Yield", value: "0.76%" }],
                    children: [
                      { id: "nw-eq-tiger-msft-txn", label: "Buy — Aug 4, 2022", value: "$22.1M", meta: [{ key: "Shares", value: "79,400" }, { key: "Price", value: "$278.60" }],
                        children: [
                          { id: "ev-msft-dtcc", label: "DTCC Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2022-0804-MSFT-001", date: "Aug 4, 2022", hash: "g1h7i3j9k5l2…", description: "Program trade via Citadel Securities. Settlement T+2." },
                          { id: "ev-msft-stmt", label: "Kincaid Health Q3 2022 Statement", isEvidence: true, evidenceType: "broker-confirm", institution: "Kincaid Health", refNumber: "STMT-Q32022-7742", date: "Sep 30, 2022", hash: "h4j8k2l6m1n9…", description: "Quarterly custody statement confirming position." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "nw-eq-fidelity", label: "Fidelity Contrafund (FCNTX)", value: "$220.0M",
            badge: "Mutual Fund",
            meta: [{ key: "Shares", value: "1,048,500" }, { key: "NAV", value: "$209.80" }, { key: "YTD Return", value: "+11.2%", positive: true }, { key: "Expense Ratio", value: "0.85%" }],
            children: [
              { id: "nw-eq-fcntx-top", label: "Top Holdings (Fund Level)", value: "$220.0M",
                meta: [{ key: "# Holdings", value: "330" }, { key: "Turnover", value: "26%" }],
                children: [
                  { id: "nw-eq-fcntx-meta", label: "Meta Platforms (META)", value: "8.4% of fund",
                    children: [
                      { id: "nw-eq-fcntx-meta-txn", label: "FCNTX Fund Purchase", value: "$18.5M allocation",
                        children: [
                          { id: "ev-fcntx-stmt", label: "Fidelity Fund Statement", isEvidence: true, evidenceType: "fund-statement", institution: "Fidelity Investments", refNumber: "FCNTX-STT-2026-0228", date: "Feb 28, 2026", hash: "a1b2c3d4e5f6…", description: "Official monthly fund statement showing NAV, units held, and portfolio allocation. Audited by PwC." },
                          ],
                        },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "nw-eq-vanguard", label: "Vanguard S&P 500 ETF (VOO)", value: "$140.0M",
            badge: "ETF",
            meta: [{ key: "Shares", value: "274,500" }, { key: "Price", value: "$510.00" }, { key: "Expense Ratio", value: "0.03%" }],
            children: [
              { id: "nw-eq-voo-pos", label: "ETF Position Detail", value: "$140.0M",
                meta: [{ key: "Underlying Holdings", value: "503 stocks" }, { key: "Tracking Error", value: "0.02%" }],
                children: [
                  { id: "nw-eq-voo-txn", label: "DCA Purchase History (12 tranches)", value: "$140.0M",
                    children: [
                      { id: "nw-eq-voo-t1", label: "Buy — Jan 2024", value: "$12.1M", meta: [{ key: "Shares", value: "28,400" }, { key: "Price", value: "$426.40" }],
                        children: [
                          { id: "ev-voo-dtcc1", label: "DTCC Trade Confirm — Jan 2024", isEvidence: true, evidenceType: "broker-confirm", institution: "DTCC / Kincaid Health", refNumber: "TXN-2024-0115-VOO-001", date: "Jan 15, 2024", hash: "m3n7o1p5q9r4…", description: "ETF settlement. In-kind creation unit via Authorized Participant Vanguard. DTCC Continuous Net Settlement." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-pe", label: "Private Equity", value: "$482.0M", change: "+0.0%",
        badge: "20.0%", badgeAccent: "#FFB800",
        meta: [{ key: "# Funds", value: "5" }, { key: "Blended IRR", value: "+24.6%", positive: true }, { key: "Total Committed", value: "$220M" }, { key: "Remaining Unfunded", value: "$99M" }],
        children: [
          {
            id: "nw-pe-kkr", label: "KKR Americas XII", value: "$112.2M",
            badge: "Active", badgeAccent: "#00FF94",
            meta: [{ key: "Committed", value: "$75M" }, { key: "Called", value: "$68M" }, { key: "Distributed", value: "$18.5M" }, { key: "IRR", value: "+31.4%", positive: true }, { key: "TVPI", value: "1.92x" }],
            children: [
              { id: "nw-pe-kkr-comps", label: "Portfolio Companies (14 positions)", value: "$112.2M",
                meta: [{ key: "Largest", value: "Global Atlantic (22%)" }, { key: "Geo Mix", value: "78% US, 22% Canada" }],
                children: [
                  { id: "nw-pe-kkr-ga", label: "Global Atlantic Financial", value: "$24.7M (22%)",
                    children: [
                      { id: "nw-pe-kkr-ga-val", label: "Valuation Analysis", value: "$24.7M",
                        meta: [{ key: "Method", value: "DCF + Comps" }, { key: "EV/EBITDA", value: "11.2x" }, { key: "Auditor", value: "Deloitte" }],
                        children: [
                          { id: "ev-kkr-val", label: "KKR Fund XII — Q4 2025 Valuation Report", isEvidence: true, evidenceType: "valuation", institution: "KKR & Co. / Deloitte LLP", refNumber: "KKRXII-VAL-Q42025-0047", date: "Feb 28, 2026", hash: "v1a2l3u4e5s6…", description: "Independent GP valuation prepared quarterly per AICPA ASC 820 fair value standards. Reviewed by fund LP advisory board." },
                          { id: "ev-kkr-cap", label: "Capital Account Statement", isEvidence: true, evidenceType: "fund-statement", institution: "KKR Americas XII GP LLC", refNumber: "CAPSTMT-KKRXII-KR-Q42025", date: "Jan 31, 2026", hash: "c4a7p8i3t9a2…", description: "Official LP capital account statement. Confirms NAV, distributions, carried interest, and unfunded commitment." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "nw-pe-blackstone", label: "Blackstone Real Estate X", value: "$58.8M",
            badge: "Harvesting", badgeAccent: "#A855F7",
            meta: [{ key: "Committed", value: "$40M" }, { key: "Called", value: "$40M" }, { key: "Distributed", value: "$22.4M" }, { key: "IRR", value: "+18.6%", positive: true }, { key: "TVPI", value: "2.03x" }],
            children: [
              { id: "nw-pe-bx-assets", label: "Underlying Real Estate Assets", value: "$58.8M",
                meta: [{ key: "# Properties", value: "8" }, { key: "Strategy", value: "Value-add commercial" }],
                children: [
                  { id: "nw-pe-bx-1285", label: "1285 Sixth Ave Tower, NYC", value: "$18.2M (31%)",
                    meta: [{ key: "Sq Ft", value: "1.83M SF" }, { key: "Occupancy", value: "94%" }, { key: "Cap Rate", value: "4.8%" }],
                    children: [
                      { id: "nw-pe-bx-1285-appr", label: "Independent Appraisal", value: "$18.2M",
                        children: [
                          { id: "ev-bx-appr", label: "CBRE Appraisal Report — Dec 2025", isEvidence: true, evidenceType: "appraisal", institution: "CBRE Valuation & Advisory Services", refNumber: "CBRE-2025-1285-6AVE-NYC-0822", date: "Dec 15, 2025", hash: "p1r2o3p4e5r6…", description: "Full MAI appraisal per USPAP standards. Income and sales comparison approaches. Reviewed by BREIT advisory committee." },
                          { id: "ev-bx-stmt", label: "BREP X Fund Statement Q4 2025", isEvidence: true, evidenceType: "fund-statement", institution: "Blackstone Real Estate Advisors", refNumber: "BREPX-KR-STT-Q42025", date: "Jan 15, 2026", hash: "f7u8n9d1s2t3…", description: "Official quarterly LP statement. Confirms allocated NAV, distributions, and remaining commitment." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "nw-pe-sequoia", label: "Sequoia Capital Fund XVIII", value: "$62.4M",
            badge: "Active", badgeAccent: "#00FF94",
            meta: [{ key: "Committed", value: "$50M" }, { key: "Called", value: "$38M" }, { key: "Distributed", value: "$8.2M" }, { key: "IRR", value: "+24.8%", positive: true }, { key: "TVPI", value: "1.86x" }],
            children: [
              { id: "nw-pe-seq-cos", label: "Portfolio Companies", value: "$62.4M",
                meta: [{ key: "# Companies", value: "23" }, { key: "Unicorns", value: "4" }],
                children: [
                  { id: "nw-pe-seq-stripe", label: "Stripe Inc. (unquoted)", value: "$14.8M",
                    meta: [{ key: "Stage", value: "Pre-IPO" }, { key: "Last Round Val", value: "$65B" }, { key: "409A", value: "$11.2/sh" }],
                    children: [
                      { id: "nw-pe-seq-stripe-409a", label: "409A Valuation", value: "$14.8M",
                        children: [
                          { id: "ev-seq-409a", label: "Stripe 409A Valuation — Nov 2025", isEvidence: true, evidenceType: "valuation", institution: "Carta Valuations / Sequoia GP", refNumber: "STRIPE-409A-NOV2025-001", date: "Nov 30, 2025", hash: "s1t2r3i4p5e6…", description: "Independent 409A per IRC §409A. OPM Backsolve methodology. Reviewed by Sequoia's fund auditors." },
                          { id: "ev-seq-cap", label: "Sequoia XVIII Capital Account Statement", isEvidence: true, evidenceType: "fund-statement", institution: "Sequoia Capital Operations", refNumber: "SEQXVIII-CAPCALL-14", date: "Dec 31, 2025", hash: "c8a9p0i1t2a3…", description: "LP capital call notice and account reconciliation. Signed by GP. Confirmed by Kincaid Health custody." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-realestate", label: "Real Estate", value: "$361.5M",
        badge: "15.0%", badgeAccent: "#00FF94",
        meta: [{ key: "# Properties", value: "7" }, { key: "Total Debt", value: "$116M" }, { key: "Net Equity", value: "$245.5M" }, { key: "Avg Cap Rate", value: "4.7%" }],
        children: [
          { id: "nw-re-marina", label: "Marina Bay Mixed-Use Tower", value: "$78.0M", badge: "Mixed-Use", badgeAccent: "#00A8FF",
            meta: [{ key: "Location", value: "Singapore" }, { key: "Debt", value: "$32M" }, { key: "Net Equity", value: "$46M" }, { key: "Cap Rate", value: "4.4%" }, { key: "Rental Yield", value: "3.9%" }],
            children: [
              { id: "nw-re-marina-income", label: "Income Analysis", value: "$3.04M/yr",
                meta: [{ key: "NOI", value: "$3.43M" }, { key: "Occupancy", value: "97%" }, { key: "WALE", value: "5.2 yrs" }],
                children: [
                  { id: "nw-re-marina-tenants", label: "Top Tenants", value: "97% leased",
                    meta: [{ key: "DBS Bank (22%)", value: "$672K/yr" }, { key: "CapitaLand (18%)", value: "$549K/yr" }, { key: "Retail Mix (60%)", value: "$1.82M/yr" }],
                    children: [
                      { id: "nw-re-marina-dbs-lease", label: "DBS Bank Lease Agreement", value: "$672K/yr",
                        children: [
                          { id: "ev-marina-lease", label: "DBS Bank — Lease Agreement 2023", isEvidence: true, evidenceType: "legal", institution: "DBS Bank / CBRE Property Mgmt SG", refNumber: "LEASE-MBT-DBS-2023-0041", date: "Apr 1, 2023", hash: "d9e8s7i6n5g4…", description: "10-year NNN lease agreement. Executed and registered with Singapore Land Authority. Reviewed by Baker McKenzie." },
                          { id: "ev-marina-appr", label: "JLL Singapore Appraisal 2025", isEvidence: true, evidenceType: "appraisal", institution: "Jones Lang LaSalle Singapore", refNumber: "JLL-SG-MBT-2025-APR-017", date: "Oct 31, 2025", hash: "j3l4l5s6g7a8…", description: "Full appraisal report per RICS Red Book standards. Income and comparison approaches. SGD 104.2M value." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "nw-re-mayfair", label: "Mayfair Office Complex, London", value: "$58.0M", badge: "Commercial",
            meta: [{ key: "Debt", value: "$24M" }, { key: "Cap Rate", value: "4.8%" }, { key: "Yield", value: "4.2%" }],
            children: [
              { id: "nw-re-mayfair-val", label: "Valuation & Income", value: "$58.0M",
                meta: [{ key: "NRI (annual)", value: "£2.44M" }, { key: "Occupancy", value: "100%" }],
                children: [
                  { id: "nw-re-mayfair-income", label: "Rental Income Schedule", value: "£2.44M/yr",
                    children: [
                      { id: "ev-mayfair-appr", label: "Savills London Appraisal 2025", isEvidence: true, evidenceType: "appraisal", institution: "Savills plc — Valuation Division", refNumber: "SAVILLS-LON-MAY-2025-Q3-002", date: "Sep 30, 2025", hash: "s9a8v7i6l5l4…", description: "RICS-compliant valuation. £46.2M capital value (=$58M at 1.256 GBP/USD). Reviewed by JLL as secondary valuer." },
                      { id: "ev-mayfair-legal", label: "Land Registry Title Deed", isEvidence: true, evidenceType: "legal", institution: "HM Land Registry UK", refNumber: "LR-GRT-LDN-MAY-WJ1-TL-002142", date: "Mar 15, 2016", hash: "h1m2l3a4n5d6…", description: "Registered freehold title. Unencumbered. Registered in name of Kincaid Mayfair Holdings Ltd (Cayman)." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-vc", label: "Venture Capital", value: "$240.0M",
        badge: "10.0%", badgeAccent: "#A855F7",
        meta: [{ key: "# Funds", value: "6" }, { key: "# Direct", value: "12" }, { key: "TVPI (blended)", value: "2.4x" }],
        children: [
          { id: "nw-vc-a16z", label: "Andreessen Horowitz Growth IV", value: "$19.8M",
            badge: "Active", badgeAccent: "#00FF94",
            meta: [{ key: "Committed", value: "$25M" }, { key: "Called", value: "$15M" }, { key: "TVPI", value: "1.32x" }],
            children: [
              { id: "nw-vc-a16z-cos", label: "Portfolio Companies (8)", value: "$19.8M", meta: [],
                children: [
                  { id: "nw-vc-a16z-opnai", label: "OpenAI (indirect)", value: "~$4.1M",
                    children: [
                      { id: "nw-vc-a16z-opnai-basis", label: "Investment Basis", value: "$4.1M",
                        children: [
                          { id: "ev-a16z-stmt", label: "a16z Growth IV — Q4 2025 LP Report", isEvidence: true, evidenceType: "fund-statement", institution: "Andreessen Horowitz", refNumber: "A16Z-GIV-LPSTMT-Q42025", date: "Jan 31, 2026", hash: "a4n1d6r2e3e5…", description: "Quarterly LP report with position-level attribution. Prepared by Citrin Cooperman LLP." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-hedge", label: "Hedge Funds", value: "$168.7M",
        badge: "7.0%", badgeAccent: "#FF4D6D",
        meta: [{ key: "# Funds", value: "4" }, { key: "Blended Return", value: "+9.2% YTD", positive: true }, { key: "Avg. Liquidity", value: "Quarterly" }],
        children: [
          { id: "nw-hf-citadel", label: "Citadel Wellington Fund", value: "$72.4M",
            badge: "Quarterly Liquidity",
            meta: [{ key: "Strategy", value: "Multi-strategy" }, { key: "YTD", value: "+14.2%", positive: true }, { key: "Sharpe (3yr)", value: "2.14" }],
            children: [
              { id: "nw-hf-citadel-alloc", label: "Strategy Allocation", value: "$72.4M",
                meta: [{ key: "Equities", value: "40%" }, { key: "Fixed Income", value: "28%" }, { key: "Commodities", value: "18%" }, { key: "Macro", value: "14%" }],
                children: [
                  { id: "nw-hf-citadel-perf", label: "Monthly Performance", value: "+14.2% YTD",
                    meta: [{ key: "Jan", value: "+1.8%" }, { key: "Feb", value: "+3.4%" }, { key: "Mar", value: "+2.6%" }],
                    children: [
                      { id: "nw-hf-citadel-audit", label: "Citadel Investor Report — Feb 2026", value: "$72.4M",
                        children: [
                          { id: "ev-citadel-stmt", label: "Citadel LP Investor Report — Feb 2026", isEvidence: true, evidenceType: "fund-statement", institution: "Citadel LLC / PwC", refNumber: "CIT-WELL-KR-INV-202602", date: "Mar 5, 2026", hash: "c7i8t9a0d1e2…", description: "Official monthly investor report signed by CFO. Audited annually by PwC. Prepared per SEC Reg D requirements." },
                          { id: "ev-citadel-k1", label: "2025 Schedule K-1 (Fund)", isEvidence: true, evidenceType: "tax", institution: "Citadel LLC / Deloitte Tax", refNumber: "K1-CITADEL-KR-2025", date: "Mar 15, 2026", hash: "k1c4i6t8a0d2…", description: "Pass-through tax document showing allocated income, deductions, and credits for 2025 tax year." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-credit", label: "Private Credit", value: "$144.6M",
        badge: "6.0%", badgeAccent: "#00E5FF",
        meta: [{ key: "Avg Yield", value: "11.8%" }, { key: "Duration", value: "2.4 yrs" }, { key: "Default Rate", value: "0.0%" }],
        children: [
          { id: "nw-credit-apollo", label: "Apollo Credit Fund VII", value: "$31.2M", badge: "Active", badgeAccent: "#00FF94",
            meta: [{ key: "Strategy", value: "Direct Lending" }, { key: "Yield", value: "12.4%" }, { key: "Gross IRR", value: "+12.4%", positive: true }, { key: "TVPI", value: "1.30x" }],
            children: [
              { id: "nw-credit-apollo-loans", label: "Loan Portfolio (18 positions)", value: "$31.2M",
                meta: [{ key: "Avg Loan Size", value: "$1.73M" }, { key: "LTV", value: "48%" }, { key: "All First Lien", value: "100%" }],
                children: [
                  { id: "nw-credit-apollo-l1", label: "Riverside Transport Holdings", value: "$3.2M", badge: "1st Lien Senior",
                    children: [
                      { id: "nw-credit-apollo-l1-credit", label: "Credit Analysis", value: "$3.2M",
                        meta: [{ key: "EBITDA Coverage", value: "3.8x" }, { key: "Rating", value: "B+" }, { key: "Spread", value: "SOFR +425bps" }],
                        children: [
                          { id: "ev-apollo-loan", label: "Apollo VII — Loan Schedule Q4 2025", isEvidence: true, evidenceType: "fund-statement", institution: "Apollo Global Management / EY", refNumber: "APOLLOVII-LOAN-SCH-Q42025", date: "Jan 31, 2026", hash: "a2p3o4l5l6o7…", description: "Detailed loan schedule with borrower identities, outstanding balances, collateral, and covenants. Audited by Ernst & Young." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-cash", label: "Cash & Treasury", value: "$96.4M",
        badge: "4.0%", badgeAccent: "#4ADE80",
        meta: [{ key: "USD Cash", value: "$42.0M" }, { key: "T-Bills", value: "$28.0M" }, { key: "Money Market", value: "$16.4M" }, { key: "FX", value: "$10.0M" }],
        children: [
          { id: "nw-cash-usd", label: "USD Cash Accounts", value: "$42.0M",
            meta: [{ key: "Kincaid Health Checking", value: "$18.2M" }, { key: "Kincaid Health Savings", value: "$12.8M" }, { key: "JP Morgan PB", value: "$11.0M" }],
            children: [
              { id: "nw-cash-invst", label: "Kincaid Health — Operating Account", value: "$18.2M",
                meta: [{ key: "Account #", value: "****7742" }, { key: "FDIC", value: "Insured ($250K)" }, { key: "Rate", value: "4.85% HYSA" }],
                children: [
                  { id: "nw-cash-invst-txn", label: "Recent Activity (last 30 days)", value: "$18.2M",
                    meta: [{ key: "Inflows", value: "+$4.2M" }, { key: "Outflows", value: "-$1.8M" }, { key: "Net", value: "+$2.4M", positive: true }],
                    children: [
                      { id: "nw-cash-invst-wires", label: "Wire Transfers & Distributions", value: "$4.2M inflow",
                        children: [
                          { id: "ev-cash-stmt", label: "Kincaid Health Account Statement — Feb 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "Kincaid Health / FDIC", refNumber: "Kincaid Health-ACCT-7742-FEB2026", date: "Feb 28, 2026", hash: "b1a2n3k4s5t6…", description: "Official monthly account statement showing all transactions, balances, and interest earned. FDIC insured up to $250K." },
                          { id: "ev-cash-wire", label: "Fed Wire Confirmation — Feb 14, 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "Federal Reserve Wire Network / Kincaid Health", refNumber: "FEDWIRE-20260214-000042187", date: "Feb 14, 2026", hash: "w7i8r9e0f1e2…", description: "Distribution wire from KKR Americas XII fund account. Settled via Fedwire Funds Service. Irrevocable." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "nw-cash-tbills", label: "Treasury Bills (T-Bills)", value: "$28.0M",
            meta: [{ key: "30-day", value: "$8M @ 5.21%" }, { key: "90-day", value: "$10M @ 5.18%" }, { key: "180-day", value: "$6M @ 5.09%" }, { key: "1-year", value: "$4M @ 4.92%" }],
            children: [
              { id: "nw-cash-tbills-cusip", label: "CUSIP Holdings Detail", value: "$28.0M",
                children: [
                  { id: "nw-cash-tbill-1", label: "T-Bill 912796ZT7 — 30-day", value: "$8.0M @ 5.21%",
                    meta: [{ key: "CUSIP", value: "912796ZT7" }, { key: "Maturity", value: "Apr 4, 2026" }, { key: "Discount", value: "5.21%" }],
                    children: [
                      { id: "nw-cash-tbill-1-dtcc", label: "Treasury Purchase Confirm", value: "$8.0M",
                        children: [
                          { id: "ev-tbill-dtcc", label: "TreasuryDirect Confirmation — Mar 5, 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "US Department of the Treasury / DTCC", refNumber: "TD-2026-0305-912796ZT7", date: "Mar 5, 2026", hash: "t1r2e3a4s5u6…", description: "Treasury auction purchase confirmation. Settled via Fedwire Securities Service. Book-entry at DTCC." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "nw-crypto", label: "Crypto Assets", value: "$48.2M",
        badge: "2.0%", badgeAccent: "#818CF8",
        meta: [{ key: "BTC", value: "$28.4M (58.9%)" }, { key: "ETH", value: "$11.6M (24.1%)" }, { key: "Other", value: "$8.2M (17.0%)" }, { key: "Custody", value: "Coinbase Prime" }],
        children: [
          { id: "nw-crypto-btc", label: "Bitcoin (BTC)", value: "$28.4M", badge: "HOLD", badgeAccent: "#FFB800",
            meta: [{ key: "BTC Held", value: "281.4 BTC" }, { key: "Price", value: "$100,924" }, { key: "Cost Basis", value: "$41,200" }, { key: "Unrealized P&L", value: "+$16.8M", positive: true }],
            children: [
              { id: "nw-crypto-btc-pos", label: "Position Detail", value: "$28.4M",
                meta: [{ key: "Custody", value: "Coinbase Prime" }, { key: "Cold Storage", value: "70%" }, { key: "Hot Wallet", value: "30%" }],
                children: [
                  { id: "nw-crypto-btc-txns", label: "Acquisition History", value: "281.4 BTC",
                    meta: [{ key: "First Buy", value: "Mar 2020" }, { key: "Avg Cost", value: "$41,200" }, { key: "DCA Count", value: "8 purchases" }],
                    children: [
                      { id: "nw-crypto-btc-txn1", label: "Buy — Mar 2020 (100 BTC)", value: "$780K",
                        children: [
                          { id: "ev-crypto-coinbase", label: "Coinbase Prime Trade Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "Coinbase Prime / Coinbase Custody", refNumber: "CB-PRIME-TXN-2020031500148", date: "Mar 15, 2020", hash: "c8o9i0n1b2a3…", description: "OTC trade executed via Coinbase Prime institutional desk. Blockchain TX hash: 0x7a3f... Settlement: T+0." },
                          { id: "ev-crypto-audit", label: "Coinbase Proof of Reserve — Dec 2025", isEvidence: true, evidenceType: "audit", institution: "Coinbase Prime / Deloitte Digital", refNumber: "CB-PRIME-POR-DEC2025-KR", date: "Dec 31, 2025", hash: "p5r6o7o8f9r0…", description: "Cryptographic proof-of-reserve confirming client BTC holdings. On-chain verifiable. Merkle tree inclusion proof." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "ytd-return": {
    id: "ytd-return",
    title: "YTD Return",
    subtitle: "January 1 — March 5, 2026",
    value: "+8.42%",
    change: "+$203.1M absolute gain",
    changePositive: true,
    description: "Time-weighted return (TWR) across all asset classes. Benchmark: 60/40 blended index (+4.2% YTD).",
    children: [
      { id: "ytd-equities", label: "Public Equities Contribution", value: "+4.08%",
        badge: "Largest contributor", badgeAccent: "#00FF94",
        meta: [{ key: "Asset Return", value: "+13.6%" }, { key: "Weight", value: "30%" }, { key: "Contribution", value: "+4.08%", positive: true }],
        children: [
          { id: "ytd-eq-jan", label: "January 2026", value: "+1.82%",
            meta: [{ key: "SPX Return", value: "+1.40%" }, { key: "Active Return", value: "+0.42%", positive: true }, { key: "Key Driver", value: "NVDA +22% month" }],
            children: [
              { id: "ytd-eq-jan-wk1", label: "Week of Jan 6", value: "+0.62%",
                children: [
                  { id: "ytd-eq-jan-wk1-perf", label: "Daily Attribution", value: "+0.62%",
                    children: [
                      { id: "ev-ytd-jan-perf", label: "Kincaid Health Performance Report — Jan 2026", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health / Advent Geneva", refNumber: "PERF-RPT-202601-KR-001", date: "Feb 1, 2026", hash: "p9e8r7f6o5r4…", description: "GIPS-compliant performance report. Time-weighted return per AIMR standards. Verified by independent performance measurer." },
                    ],
                  },
                ],
              },
              { id: "ytd-eq-jan-wk2", label: "Week of Jan 13", value: "+0.44%", children: [{ id: "ytd-eq-jan-wk2-ev", label: "Week Performance Attribution", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health Portfolio Analytics", refNumber: "PERF-WK2-202601-KR", date: "Jan 17, 2026", hash: "w2e3e4k5p6e7…", description: "Weekly performance attribution report." }] },
            ],
          },
          { id: "ytd-eq-feb", label: "February 2026", value: "+1.40%",
            meta: [{ key: "SPX Return", value: "+1.10%" }, { key: "Active Return", value: "+0.30%", positive: true }],
            children: [
              { id: "ytd-eq-feb-wk", label: "Monthly Attribution", value: "+1.40%",
                children: [
                  { id: "ev-ytd-feb-perf", label: "Kincaid Health Performance Report — Feb 2026", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health / Advent Geneva", refNumber: "PERF-RPT-202602-KR-001", date: "Mar 1, 2026", hash: "f8e9b0r1u2a3…", description: "Monthly GIPS performance report. YTD calculations independently verified." },
                ],
              },
            ],
          },
          { id: "ytd-eq-mar", label: "March 2026 (MTD)", value: "+0.86%",
            meta: [{ key: "Days Elapsed", value: "5 of 20" }],
            children: [
              { id: "ytd-eq-mar-daily", label: "Daily Returns MTD", value: "+0.86%",
                children: [
                  { id: "ev-ytd-mar-perf", label: "Kincaid Health Daily Performance — Mar 5, 2026", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health Portfolio Analytics", refNumber: "PERF-DAILY-20260305-KR", date: "Mar 5, 2026", hash: "m5a6r7d8a9i0…", description: "End-of-day performance attribution. Sourced from real-time pricing feeds (Bloomberg/Refinitiv)." },
                ],
              },
            ],
          },
        ],
      },
      { id: "ytd-pe", label: "Private Equity Contribution", value: "+2.20%",
        meta: [{ key: "Asset Return", value: "+11.0%" }, { key: "Weight", value: "20%" }, { key: "Contribution", value: "+2.20%", positive: true }],
        children: [
          { id: "ytd-pe-kkr-perf", label: "KKR Americas XII", value: "+4.2% Q1",
            children: [
              { id: "ytd-pe-kkr-val-chg", label: "NAV Movement Q1 2026", value: "+$4.7M",
                children: [
                  { id: "ev-ytd-pe-kkr", label: "KKR Quarterly Performance Report Q1 2026", isEvidence: true, evidenceType: "fund-statement", institution: "KKR Fund Accounting / Deloitte", refNumber: "KKRXII-PERF-Q12026", date: "Apr 30, 2026", hash: "k5k6r7q8r9p0…", description: "GIPS-compliant private equity performance report. Quarterly NAV change attributed by company." },
                ],
              },
            ],
          },
        ],
      },
      { id: "ytd-re", label: "Real Estate Contribution", value: "+0.90%",
        meta: [{ key: "Asset Return", value: "+6.0%" }, { key: "Weight", value: "15%" }, { key: "Contribution", value: "+0.90%", positive: true }],
        children: [
          { id: "ytd-re-income", label: "Rental Income YTD", value: "+$7.8M",
            children: [
              { id: "ytd-re-appr-gain", label: "Unrealized Appreciation", value: "+$13.8M",
                children: [
                  { id: "ev-ytd-re-perf", label: "Kincaid Health Real Estate Portfolio Report Q1 2026", isEvidence: true, evidenceType: "valuation", institution: "CBRE / JLL / Savills", refNumber: "RE-PORT-Q12026-KR", date: "Apr 15, 2026", hash: "r3e4a5l6e7s8…", description: "Consolidated real estate performance report. Appraisals, rental income, and unrealized gains. Multi-currency reconciliation." },
                ],
              },
            ],
          },
        ],
      },
      { id: "ytd-hedge-perf", label: "Hedge Fund Contribution", value: "+0.64%",
        meta: [{ key: "Asset Return", value: "+9.2%" }, { key: "Weight", value: "7%" }],
        children: [
          { id: "ytd-hf-citadel-perf", label: "Citadel Wellington — +14.2%", value: "+$10.3M",
            children: [
              { id: "ytd-hf-citadel-monthly", label: "Monthly Performance Attribution", value: "+14.2%",
                children: [
                  { id: "ev-ytd-hf-citadel", label: "Citadel Wellington — Investor Report Mar 2026", isEvidence: true, evidenceType: "fund-statement", institution: "Citadel LLC / PwC", refNumber: "CIT-WELL-PERF-202603-KR", date: "Mar 5, 2026", hash: "c9i0t1a2d3e4…", description: "Monthly investor report. GIPS-compliant. Performance verified by independent administrator." },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "sharpe": {
    id: "sharpe",
    title: "Sharpe Ratio",
    subtitle: "36-month trailing",
    value: "1.64",
    description: "Risk-adjusted return per unit of volatility. Calculated as (Portfolio Return − Risk-Free Rate) / Portfolio StdDev. Risk-free rate: 5.15% (3M T-Bill).",
    children: [
      { id: "sharpe-formula", label: "Calculation Components", value: "1.64",
        meta: [{ key: "Portfolio Return", value: "21.4% (3yr ann.)" }, { key: "Risk-Free Rate", value: "5.15%" }, { key: "Excess Return", value: "16.25%", positive: true }, { key: "Std Dev", value: "9.91%" }, { key: "Sharpe", value: "1.64", positive: true }],
        children: [
          { id: "sharpe-returns", label: "36-Month Return Series", value: "21.4% annualized",
            meta: [{ key: "2023", value: "+18.2%" }, { key: "2024", value: "+22.8%" }, { key: "2025", value: "+23.1%" }],
            children: [
              { id: "sharpe-vol", label: "Volatility Decomposition", value: "9.91% StdDev",
                meta: [{ key: "Equity Vol", value: "12.4%" }, { key: "Portfolio Vol", value: "9.91%" }, { key: "Diversification Benefit", value: "2.5%", positive: true }],
                children: [
                  { id: "sharpe-correlation", label: "Asset Correlation Matrix", value: "9.91%",
                    meta: [{ key: "Equities↔PE", value: "0.62" }, { key: "Equities↔RE", value: "0.31" }, { key: "Equities↔Hedge", value: "0.44" }, { key: "Equities↔Crypto", value: "0.28" }],
                    children: [
                      { id: "sharpe-rolling", label: "Rolling 12M Sharpe History", value: "1.64 current",
                        meta: [{ key: "12M ago", value: "1.48" }, { key: "24M ago", value: "1.72" }, { key: "36M ago", value: "1.51" }],
                        children: [
                          { id: "ev-sharpe-calc", label: "Kincaid Health Risk Report — Mar 5, 2026", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health Risk Analytics / Bloomberg PORT", refNumber: "RISK-RPT-20260305-KR-SHARPE", date: "Mar 5, 2026", hash: "s1h2a3r4p5e6…", description: "Full Sharpe ratio calculation methodology. Daily return series. Covariance matrix from Bloomberg. Independently verified by Kincaid Health quantitative team." },
                          { id: "ev-sharpe-audit", label: "Annual Risk Audit — FY 2025", isEvidence: true, evidenceType: "audit", institution: "Aon Hewitt Investment Consulting", refNumber: "AON-RISK-KR-FY2025-SHARPE", date: "Jan 31, 2026", hash: "a7o8n9r1i2s3…", description: "Independent risk audit. Kincaid Health portfolio risk metrics verified against Bloomberg BVAL and Refinitiv data. Sharpe confirmed at 1.64." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "liquidity": {
    id: "liquidity",
    title: "Liquidity Reserve",
    subtitle: "Cash, T-Bills & Money Market",
    value: "$96.4M",
    change: "113 days runway",
    changePositive: true,
    description: "Total liquid and near-liquid assets available within 5 business days. Burn rate: $850K/month.",
    children: [
      { id: "liq-cash", label: "USD Cash", value: "$42.0M", badge: "Immediate", badgeAccent: "#00FF94",
        meta: [{ key: "Kincaid Health Operating", value: "$18.2M" }, { key: "Kincaid Health Savings", value: "$12.8M" }, { key: "JP Morgan PB", value: "$11.0M" }, { key: "FDIC Coverage", value: "$250K" }],
        children: [
          { id: "liq-cash-invst-op", label: "Kincaid Health Operating Account ****7742", value: "$18.2M",
            meta: [{ key: "Available Balance", value: "$18.2M" }, { key: "Rate", value: "4.85%" }, { key: "YTD Interest", value: "$218K" }],
            children: [
              { id: "liq-cash-invst-recent", label: "Last 30 Days Activity", value: "$18.2M",
                meta: [{ key: "Inflows", value: "+$4.2M" }, { key: "Outflows", value: "-$1.8M" }],
                children: [
                  { id: "liq-cash-invst-txns", label: "Transaction Ledger", value: "+$2.4M net",
                    children: [
                      { id: "ev-liq-cash-stmt", label: "Kincaid Health Feb 2026 Account Statement", isEvidence: true, evidenceType: "broker-confirm", institution: "Kincaid Health / Apex Clearing", refNumber: "Kincaid Health-STMT-7742-202602", date: "Feb 28, 2026", hash: "l8i9q0u1i2d3…", description: "Official monthly statement. All transactions reconciled. Apex Clearing acts as custodian. SIPC insured." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "liq-cash-jpm", label: "JP Morgan Private Bank ****3391", value: "$11.0M",
            meta: [{ key: "Type", value: "Demand Deposit" }, { key: "Rate", value: "4.62%" }, { key: "Wire Limit", value: "$5M/day" }],
            children: [
              { id: "liq-cash-jpm-stmt", label: "JP Morgan Account Statement", value: "$11.0M",
                children: [
                  { id: "liq-cash-jpm-txn", label: "Recent Transactions", value: "$11.0M",
                    children: [
                      { id: "ev-liq-jpm-stmt", label: "JP Morgan PB Statement — Feb 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "JPMorgan Chase Bank, N.A.", refNumber: "JPMB-PB-3391-FEB2026", date: "Feb 28, 2026", hash: "j4p5m6o7r8g9…", description: "Monthly private banking statement. FDIC insured. AML/KYC reviewed quarterly by JPM compliance." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "liq-tbills", label: "Treasury Bills", value: "$28.0M", badge: "≤30 days", badgeAccent: "#00A8FF",
        meta: [{ key: "30-day", value: "$8M @ 5.21%" }, { key: "90-day", value: "$10M @ 5.18%" }, { key: "180-day", value: "$6M @ 5.09%" }, { key: "1yr", value: "$4M @ 4.92%" }],
        children: [
          { id: "liq-tbill-30", label: "30-Day T-Bill (CUSIP 912796ZT7)", value: "$8.0M",
            meta: [{ key: "Maturity", value: "Apr 4, 2026" }, { key: "Discount Rate", value: "5.21%" }, { key: "Accrued Interest", value: "$34,800" }],
            children: [
              { id: "liq-tbill-30-auction", label: "Auction Details", value: "$8.0M",
                meta: [{ key: "Auction Date", value: "Mar 3, 2026" }, { key: "High Rate", value: "5.21%" }, { key: "Cover Ratio", value: "3.14x" }],
                children: [
                  { id: "liq-tbill-30-buy", label: "Purchase Confirmation", value: "$8.0M",
                    children: [
                      { id: "ev-tbill-30-td", label: "TreasuryDirect Confirmation — Mar 3, 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "US Department of Treasury / DTCC", refNumber: "TD-20260303-912796ZT7-KR", date: "Mar 3, 2026", hash: "t2r3e4a5s6u7…", description: "Purchase from competitive auction. Book-entry at Federal Reserve. DTC eligible. US gov't backed." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "liq-tbill-90", label: "90-Day T-Bill (CUSIP 912796AB5)", value: "$10.0M",
            meta: [{ key: "Maturity", value: "Jun 3, 2026" }, { key: "Discount Rate", value: "5.18%" }],
            children: [
              { id: "liq-tbill-90-detail", label: "Position Detail", value: "$10.0M",
                children: [
                  { id: "liq-tbill-90-txn", label: "Purchase History", value: "$10.0M",
                    children: [
                      { id: "ev-tbill-90-td", label: "TreasuryDirect Confirmation — Mar 3, 2026", isEvidence: true, evidenceType: "broker-confirm", institution: "US Department of Treasury / DTCC", refNumber: "TD-20260303-912796AB5-KR", date: "Mar 3, 2026", hash: "t8r9e0a1s2u3…", description: "90-day T-bill purchase. Competitive auction. Settled via Fedwire Securities Service." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "liq-mmf", label: "Money Market Fund", value: "$16.4M", badge: "T+1 Liquidity", badgeAccent: "#FFB800",
        meta: [{ key: "Fund", value: "Vanguard Federal MMF" }, { key: "Yield", value: "5.09%" }, { key: "WAM", value: "21 days" }, { key: "Rating", value: "AAAm / Stable" }],
        children: [
          { id: "liq-mmf-composition", label: "Portfolio Composition", value: "$16.4M",
            meta: [{ key: "Govt Repos", value: "48%" }, { key: "T-Bills", value: "32%" }, { key: "Agency Discs", value: "20%" }],
            children: [
              { id: "liq-mmf-rating", label: "Credit & Rating Analysis", value: "AAAm",
                meta: [{ key: "S&P Rating", value: "AAAm" }, { key: "Moody's", value: "Aaa-mf" }, { key: "Shadow NAV", value: "$1.0001" }],
                children: [
                  { id: "liq-mmf-stmt", label: "Fund Statement & Holdings", value: "$16.4M",
                    children: [
                      { id: "ev-mmf-stmt", label: "Vanguard Federal MMF — Feb 2026 Report", isEvidence: true, evidenceType: "fund-statement", institution: "Vanguard Group / State Street", refNumber: "VFMXX-STMT-202602-KR", date: "Feb 28, 2026", hash: "m7o8n9e0y1m2…", description: "Monthly fund report. Government Money Market. SEC Rule 2a-7 compliant. Daily NAV $1.00. Shadow NAV $1.0001." },
                      { id: "ev-mmf-rating", label: "S&P Global Ratings Affirm — Jan 2026", isEvidence: true, evidenceType: "regulatory", institution: "S&P Global Ratings", refNumber: "SP-VFMXX-2026-AAAm-AFFIRM", date: "Jan 15, 2026", hash: "s3p4r5a6t7i8…", description: "AAAm rating affirmation with stable outlook. Criteria: portfolio quality, diversification, WAM, and NAV stability." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "liq-fx", label: "Foreign Currency Balances", value: "$10.0M", badge: "Multi-Currency",
        meta: [{ key: "EUR", value: "€3.87M ($4.2M)" }, { key: "CHF", value: "CHF3.10M ($2.8M)" }, { key: "GBP", value: "£1.51M ($1.9M)" }, { key: "SGD", value: "SGD1.49M ($1.1M)" }],
        children: [
          { id: "liq-fx-eur", label: "Euro (EUR)", value: "$4.2M",
            meta: [{ key: "Balance", value: "€3.87M" }, { key: "Rate", value: "1.085 USD/EUR" }, { key: "Account", value: "Kincaid Health FX Account" }],
            children: [
              { id: "liq-fx-eur-hedge", label: "FX Hedge Status", value: "$4.2M",
                meta: [{ key: "Hedged?", value: "Partially (50%)" }, { key: "Forward", value: "EUR/USD 1.092 Jun 2026" }, { key: "Cost", value: "0.8% annualized" }],
                children: [
                  { id: "liq-fx-eur-confirm", label: "FX Forward Confirmation", value: "$2.1M hedged",
                    children: [
                      { id: "ev-fx-eur-confirm", label: "Deutsche Bank FX Forward Confirm", isEvidence: true, evidenceType: "broker-confirm", institution: "Deutsche Bank AG / Kincaid Health FX", refNumber: "DB-FX-FORWARD-20260305-EUR-KR", date: "Mar 5, 2026", hash: "f1x2e3u4r5c6…", description: "ISDA master agreement trade confirmation. EUR/USD forward. Gross settlement. Counterparty: Deutsche Bank AG." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "deal-helios": {
    id: "deal-helios",
    title: "Helios Energy Partners",
    subtitle: "Series C · Clean Energy · Direct Investment",
    value: "$25.0M ask",
    change: "28% projected IRR",
    changePositive: true,
    description: "Solar + storage company targeting ERCOT market. $180M revenue, EBITDA positive. Series C led by TPG Rise Climate.",
    children: [
      { id: "helios-financials", label: "Financial Overview", value: "$25.0M ask",
        badge: "Under Review", badgeAccent: "#00A8FF",
        meta: [{ key: "Revenue (LTM)", value: "$180M" }, { key: "EBITDA", value: "$24M (13.3% margin)" }, { key: "EV", value: "$890M" }, { key: "EV/Revenue", value: "4.9x" }, { key: "EV/EBITDA", value: "37.1x" }],
        children: [
          { id: "helios-revenue", label: "Revenue Breakdown", value: "$180M",
            meta: [{ key: "Solar Generation", value: "$112M (62%)" }, { key: "Storage Services", value: "$44M (24%)" }, { key: "Capacity Market", value: "$24M (14%)" }],
            children: [
              { id: "helios-contracts", label: "Power Purchase Agreements", value: "$180M/yr",
                meta: [{ key: "ERCOT PPAs", value: "8 active" }, { key: "Avg Duration", value: "12.4 yrs" }, { key: "Contracted Revenue", value: "82% of total" }],
                children: [
                  { id: "helios-ppa-main", label: "Austin Energy PPA (Largest)", value: "$42M/yr",
                    children: [
                      { id: "ev-helios-ppa", label: "Austin Energy PPA — CIM Schedule", isEvidence: true, evidenceType: "legal", institution: "Helios Energy Partners / Austin Energy", refNumber: "HELIOS-PPA-AUSTINEN-2021-001", date: "Jun 14, 2021", hash: "h4e5l6i7o8s9…", description: "20-year PPA. Fixed price $28.50/MWh. ERCOT delivery. Approved by PUCT. Shared as part of Series C CIM." },
                      { id: "ev-helios-cim", label: "Helios Series C CIM — Feb 2026", isEvidence: true, evidenceType: "valuation", institution: "Helios Energy Partners / Morgan Stanley", refNumber: "HELIOS-CIM-SERIEC-20260201", date: "Feb 1, 2026", hash: "c2i3m4s5e6r7…", description: "Confidential Information Memorandum prepared by Morgan Stanley Investment Banking. Financial projections, market analysis, and legal disclosures." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "helios-irr", label: "IRR Analysis (28% Projected)", value: "28% IRR",
            meta: [{ key: "Entry Valuation", value: "$890M" }, { key: "Exit Multiple", value: "12x EBITDA (5yr)" }, { key: "Exit Value", value: "$3.2B" }, { key: "Cash-on-Cash", value: "3.8x" }],
            children: [
              { id: "helios-irr-sensitivity", label: "Sensitivity Analysis", value: "28% base case",
                meta: [{ key: "Bull (12x exit)", value: "+38% IRR", positive: true }, { key: "Base (9x exit)", value: "+28% IRR", positive: true }, { key: "Bear (6x exit)", value: "+12% IRR", positive: true }],
                children: [
                  { id: "helios-irr-comps", label: "Comparable Transactions", value: "9x EBITDA target",
                    children: [
                      { id: "ev-helios-comps", label: "Solar Sector M&A Comparable Analysis", isEvidence: true, evidenceType: "valuation", institution: "Kincaid Health Investment Banking / Bloomberg", refNumber: "Kincaid Health-IB-HELIOS-COMPS-202602", date: "Feb 20, 2026", hash: "c5o6m7p8s9a0…", description: "Precedent transaction analysis. 18 comparable solar/storage M&A transactions 2021–2025. Bloomberg M&A database." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "helios-diligence", label: "Due Diligence Status", value: "In Progress",
        badge: "Under Review", badgeAccent: "#00A8FF",
        meta: [{ key: "Legal DD", value: "In Progress" }, { key: "Financial DD", value: "70% complete" }, { key: "Technical DD", value: "Complete" }, { key: "ESG Review", value: "Complete" }],
        children: [
          { id: "helios-tech-dd", label: "Technical Due Diligence — Complete", value: "✓ Passed",
            meta: [{ key: "Solar Capacity", value: "480 MW installed" }, { key: "Battery Storage", value: "120 MWh" }, { key: "Grid Interconnect", value: "ERCOT approved" }],
            children: [
              { id: "helios-tech-engineer", label: "Engineering Assessment", value: "480 MW",
                children: [
                  { id: "helios-tech-site", label: "Site Inspection Reports (8 sites)", value: "480 MW",
                    children: [
                      { id: "ev-helios-tech", label: "Black & Veatch Technical DD Report", isEvidence: true, evidenceType: "audit", institution: "Black & Veatch / Helios Energy", refNumber: "BV-HELIOS-TDD-202601", date: "Jan 31, 2026", hash: "t7e8c9h0d1d2…", description: "Independent engineering assessment. 8 site inspections. Equipment condition, performance history, grid interconnect status. No material issues." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "helios-legal-dd", label: "Legal Due Diligence — In Progress", value: "70% complete",
            meta: [{ key: "Corporate Structure", value: "Clean" }, { key: "IP Review", value: "In progress" }, { key: "Litigation", value: "None material" }],
            children: [
              { id: "helios-legal-corp", label: "Corporate Structure Review", value: "Clean",
                children: [
                  { id: "helios-legal-cap", label: "Cap Table Analysis", value: "Pre-money: $865M",
                    children: [
                      { id: "ev-helios-legal", label: "Simpson Thacher — Legal DD Report (Draft)", isEvidence: true, evidenceType: "legal", institution: "Simpson Thacher & Bartlett LLP", refNumber: "STB-HELIOS-LDD-DRAFT-202602", date: "Feb 28, 2026", hash: "l9e0g1a2l3d4…", description: "Legal due diligence report (draft). Corporate structure, material contracts, IP, litigation, regulatory. Final expected Apr 1, 2026." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "scenario-crash": {
    id: "scenario-crash",
    title: "2008-Style Market Crash",
    subtitle: "Equity Shock Scenario",
    value: "-18.4% impact",
    change: "-$443.2M portfolio impact",
    changePositive: false,
    description: "50% equity market decline with credit spread widening of 400bps. Based on 2008-09 GFC data.",
    children: [
      { id: "sc-equity", label: "Public Equities Impact", value: "-$361.8M",
        badge: "−50% shock", badgeAccent: "#FF4D6D",
        meta: [{ key: "Current Value", value: "$724M" }, { key: "Shock", value: "−50%" }, { key: "Impact", value: "−$362M" }],
        children: [
          { id: "sc-eq-tech", label: "Technology Sector Impact", value: "-$101.4M",
            meta: [{ key: "Tech Allocation", value: "$203M" }, { key: "GFC Tech Decline", value: "−50%" }],
            children: [
              { id: "sc-eq-tech-aapl", label: "Apple (AAPL) Stressed Value", value: "-$22.1M",
                meta: [{ key: "Current", value: "$44.2M" }, { key: "Stressed", value: "$22.1M" }, { key: "Historical low (2009)", value: "$5.08/share" }],
                children: [
                  { id: "sc-eq-tech-aapl-hist", label: "GFC Historical Drawdown", value: "−66% (2007-09)",
                    children: [
                      { id: "ev-sc-equity", label: "Bloomberg Historical Stress Test — 2008 GFC", isEvidence: true, evidenceType: "regulatory", institution: "Kincaid Health Risk Analytics / Bloomberg", refNumber: "Kincaid Health-STRESS-GFC2008-20260305", date: "Mar 5, 2026", hash: "s1t2r3e4s5s6…", description: "Historical scenario analysis using actual 2007-09 drawdown data. Bloomberg equity return series. 50th percentile of 2008 peak-to-trough." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "sc-eq-recovery", label: "Recovery Analysis", value: "28 months",
            meta: [{ key: "Historical Recovery", value: "28 months (S&P 500)" }, { key: "Portfolio Recovery", value: "Est. 22 months" }, { key: "Diversification Benefit", value: "−6 months", positive: true }],
            children: [
              { id: "sc-eq-recovery-path", label: "Recovery Path Simulation", value: "22 months est.",
                children: [
                  { id: "sc-eq-recovery-mc", label: "Monte Carlo Analysis (10,000 runs)", value: "22mo median",
                    children: [
                      { id: "ev-sc-recovery", label: "Kincaid Health Scenario Engine — Recovery Analysis", isEvidence: true, evidenceType: "audit", institution: "Kincaid Health Risk Analytics / Moody's Analytics", refNumber: "Kincaid Health-SCEN-RECOVER-GFC-20260305", date: "Mar 5, 2026", hash: "r5e6c7o8v9e0…", description: "Monte Carlo recovery analysis. 10,000 paths. Recovery defined as return to pre-shock NAV. Based on historical GFC factor loadings." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "sc-liquidity", label: "Liquidity Risk Assessment", value: "LOW",
        badge: "Low Risk", badgeAccent: "#00FF94",
        meta: [{ key: "Liquid Assets", value: "$96.4M" }, { key: "Margin Calls (est.)", value: "$0" }, { key: "Redemption Gates", value: "$0 exposure" }, { key: "Runway", value: "113 days" }],
        children: [
          { id: "sc-liq-cash", label: "Available Liquidity in Crisis", value: "$68.4M (immediate)",
            meta: [{ key: "Cash", value: "$42M" }, { key: "30-day T-bills", value: "$8M" }, { key: "MMF (T+1)", value: "$16.4M" }, { key: "90-day T-bills", value: "$10M (3mo)" }],
            children: [
              { id: "sc-liq-stress", label: "Liquidity Stress Scenario", value: "$68.4M",
                meta: [{ key: "Month 1 Burn", value: "$850K" }, { key: "Emergency Fund", value: "80x monthly burn" }],
                children: [
                  { id: "sc-liq-gates", label: "Hedge Fund Gate Analysis", value: "$0 gated",
                    children: [
                      { id: "ev-sc-liq", label: "Kincaid Health Liquidity Stress Test — Mar 2026", isEvidence: true, evidenceType: "regulatory", institution: "Kincaid Health Risk / Moody's Analytics", refNumber: "Kincaid Health-LIQ-STRESS-202603-KR", date: "Mar 5, 2026", hash: "l3i4q5s6t7r8…", description: "Liquidity stress test per SEC family office guidelines. Gate provisions reviewed for all hedge funds. No material redemption restrictions." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "volatility": {
    id: "volatility",
    title: "Portfolio Volatility",
    subtitle: "36-month trailing annualized",
    value: "9.8%",
    description: "Annualized standard deviation of daily portfolio returns. Benchmark (60/40): 11.4%. Portfolio is 1.6% less volatile than benchmark.",
    children: [
      { id: "vol-decomp", label: "Volatility by Asset Class", value: "9.8% blended",
        meta: [{ key: "Public Equities", value: "12.4%" }, { key: "Private Equity", value: "8.2%*" }, { key: "Real Estate", value: "6.8%*" }, { key: "Hedge Funds", value: "7.4%" }, { key: "Crypto", value: "48.2%" }, { key: "*", value: "smoothed IRR-based" }],
        children: [
          { id: "vol-eq-detail", label: "Public Equity Volatility Detail", value: "12.4%",
            meta: [{ key: "NVDA Contribution", value: "1.4% to portfolio vol" }, { key: "AAPL Contribution", value: "0.8%" }, { key: "Diversification", value: "−2.3%", positive: true }],
            children: [
              { id: "vol-corr", label: "Cross-Asset Correlation", value: "9.8% blended",
                meta: [{ key: "Eq↔HF", value: "0.44" }, { key: "Eq↔RE", value: "0.31" }, { key: "Eq↔Crypto", value: "0.28" }, { key: "Eq↔PE", value: "0.62" }],
                children: [
                  { id: "vol-rolling", label: "Rolling 12M Volatility", value: "9.8% current",
                    meta: [{ key: "12M ago", value: "10.6%" }, { key: "24M ago", value: "11.2%" }, { key: "Peak (2022)", value: "14.8%" }],
                    children: [
                      { id: "vol-source-calc", label: "Methodology & Data Sources", value: "9.8%",
                        children: [
                          { id: "ev-vol-bloomberg", label: "Bloomberg Portfolio Risk Report — Mar 5, 2026", isEvidence: true, evidenceType: "audit", institution: "Bloomberg PORT / Kincaid Health Risk", refNumber: "BLOOM-PORTQ-RISK-20260305-KR", date: "Mar 5, 2026", hash: "v1o2l3a4t5i6…", description: "Daily returns sourced from Bloomberg total return indices. Volatility calculated as annualized 36M rolling standard deviation. Covariance matrix updated daily." },
                          { id: "ev-vol-audit", label: "Aon Risk Audit — Volatility Verification", isEvidence: true, evidenceType: "audit", institution: "Aon Hewitt Investment Consulting", refNumber: "AON-RISK-VOL-KR-FY2025", date: "Jan 31, 2026", hash: "a2o3n4r5i6s7…", description: "Independent verification of portfolio volatility calculations. Agrees with Kincaid Health calculation within 0.05% tolerance." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "status-active": {
    id: "status-active",
    title: "Status: Active",
    subtitle: "Classification criteria & evidence",
    value: "Active",
    description: "An investment is classified as 'Active' when deployment phase is ongoing, the fund is within its stated investment period, and performance is within expected range.",
    children: [
      { id: "active-criteria", label: "Classification Criteria", value: "3/3 Passed",
        badge: "All criteria met", badgeAccent: "#00FF94",
        meta: [{ key: "Deployment >50%", value: "✓ Met" }, { key: "Within investment period", value: "✓ Met" }, { key: "No impairments", value: "✓ Met" }],
        children: [
          { id: "active-deployment", label: "Deployment Status", value: ">50% deployed",
            meta: [{ key: "Capital Called", value: "$68M of $75M (90.7%)" }, { key: "Remaining", value: "$7M unfunded" }, { key: "# Investments", value: "14 companies" }],
            children: [
              { id: "active-deploy-timeline", label: "Deployment Timeline", value: "$68M deployed",
                meta: [{ key: "2020", value: "$24M deployed" }, { key: "2021", value: "$28M deployed" }, { key: "2022", value: "$16M deployed" }],
                children: [
                  { id: "active-deploy-caps", label: "Capital Call Notices", value: "6 calls",
                    children: [
                      { id: "ev-active-capcall", label: "KKR Americas XII — Capital Call #6", isEvidence: true, evidenceType: "fund-statement", institution: "KKR Americas XII GP LLC", refNumber: "KKRXII-CAPCALL-6-2022Q3", date: "Sep 15, 2022", hash: "c8a9p0c1a2l3…", description: "Capital call notice for $16M. Wired Sep 17, 2022. Final capital call. Investment period now closed." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "active-invperiod", label: "Investment Period Status", value: "Closed 2023",
            meta: [{ key: "Period Start", value: "2020" }, { key: "Period End", value: "2023 (3 yrs)" }, { key: "Monitoring Phase", value: "Now active" }],
            children: [
              { id: "active-invperiod-lpa", label: "LPA Investment Period Terms", value: "3-year period",
                children: [
                  { id: "active-invperiod-doc", label: "Fund Documents", value: "LPA Section 4.1",
                    children: [
                      { id: "ev-active-lpa", label: "KKR Americas XII Limited Partnership Agreement", isEvidence: true, evidenceType: "legal", institution: "KKR Americas XII GP LLC / Ropes & Gray", refNumber: "LPA-KKRXII-2020-ART4", date: "Feb 14, 2020", hash: "l1p2a3k4k5r6…", description: "Executed LPA. Investment period Section 4.1: 3 years from closing. Reviewed by Kincaid Health legal counsel Willkie Farr." },
                    ],
                  },
                ],
              },
            ],
          },
          { id: "active-noimpair", label: "Impairment Assessment", value: "None",
            meta: [{ key: "Watch List", value: "0 positions" }, { key: "Impairment Tests", value: "Passed all (Q4 2025)" }, { key: "Auditor", value: "Deloitte LLP" }],
            children: [
              { id: "active-impair-audit", label: "Q4 2025 Audit Results", value: "No impairments",
                children: [
                  { id: "active-impair-deloitte", label: "Deloitte Portfolio Review", value: "No impairments",
                    children: [
                      { id: "ev-active-audit", label: "Deloitte — KKR XII Audit Report Q4 2025", isEvidence: true, evidenceType: "audit", institution: "Deloitte & Touche LLP", refNumber: "DELOITTE-KKRXII-AUD-Q42025", date: "Feb 28, 2026", hash: "d4e5l6o7i8t9…", description: "Independent audit of KKR Americas XII portfolio. ASC 820 fair value assessment. No material impairments identified." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: "active-history", label: "Status History", value: "Always Active",
        meta: [{ key: "2020 Q1", value: "Active" }, { key: "2021 Q1", value: "Active" }, { key: "2022 Q1", value: "Active" }, { key: "2023 Q1", value: "Active (monitoring)" }, { key: "2026 Q1", value: "Active" }],
        children: [
          { id: "active-history-peer", label: "Peer Comparison", value: "Active (Top Quartile)",
            meta: [{ key: "IRR vs Peers", value: "+31.4% (top quartile)" }, { key: "Cambridge Benchmark", value: "+22.1%" }, { key: "Outperformance", value: "+9.3%", positive: true }],
            children: [
              { id: "active-history-cambridge", label: "Cambridge Associates Benchmark", value: "Top Quartile",
                children: [
                  { id: "active-history-ev", label: "Performance Report vs Benchmark", value: "+31.4% vs +22.1%",
                    children: [
                      { id: "ev-active-cambridge", label: "Cambridge Associates PE Benchmark Q4 2025", isEvidence: true, evidenceType: "regulatory", institution: "Cambridge Associates LLC", refNumber: "CA-PE-BENCH-Q42025-KKRXII", date: "Feb 1, 2026", hash: "c6a7m8b9r0i1…", description: "Cambridge Associates private equity performance database. KKR Americas XII ranked in top quartile vs vintage year 2020 peers." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  "estate-tax": {
    id: "estate-tax",
    title: "Estate Tax Exposure",
    subtitle: "Family Office Structures",
    value: "$890.0M",
    change: "$340M saved via structures",
    changePositive: true,
    description: "Estimated federal estate tax exposure based on current net worth, applicable exemptions, and existing trust structures.",
    children: [
      { id: "estate-gross", label: "Gross Taxable Estate", value: "$2.41B",
        meta: [{ key: "Federal Exemption", value: "$13.61M (2026)" }, { key: "Taxable Above Exemption", value: "$2.397B" }, { key: "Max Rate", value: "40%" }, { key: "Gross Tax", value: "$958M" }],
        children: [
          { id: "estate-structures", label: "Structure Savings", value: "−$340M saved",
            meta: [{ key: "Irrevocable Trust", value: "−$192M" }, { key: "Dynasty Trust", value: "−$124M" }, { key: "Charitable Foundation", value: "−$48M" }],
            children: [
              { id: "estate-irrev", label: "Whitmore Family Irrevocable Trust", value: "−$192M",
                meta: [{ key: "AUM", value: "$480M" }, { key: "Beneficiaries", value: "6" }, { key: "Tax Efficiency", value: "94%" }, { key: "Jurisdiction", value: "Delaware" }],
                children: [
                  { id: "estate-irrev-structure", label: "Trust Structure Analysis", value: "−$192M estate savings",
                    children: [
                      { id: "estate-irrev-gift", label: "Original Gift Tax Paid", value: "$0 (annual exclusion)",
                        children: [
                          { id: "ev-estate-trust", label: "Trust Agreement & Tax Analysis", isEvidence: true, evidenceType: "legal", institution: "Wilmington Trust / Greenberg Traurig LLP", refNumber: "WKF-TRUST-IRR-2004-TAX-ANALYSIS", date: "Jan 15, 2026", hash: "t8r9u0s1t2l3…", description: "Annual trust tax analysis. Irrevocable trust removes assets from taxable estate. IRS PLR obtained 2004. Reviewed annually by Greenberg Traurig." },
                          { id: "ev-estate-irs", label: "IRS Private Letter Ruling — 2004", isEvidence: true, evidenceType: "regulatory", institution: "Internal Revenue Service", refNumber: "PLR-200422001", date: "Apr 15, 2004", hash: "i4r5s6p7l8r9…", description: "IRS Private Letter Ruling confirming estate exclusion treatment of Kincaid Family Irrevocable Trust. Binding on IRS for taxpayer." },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

export function getDrillTree(id: string): DrillDownRoot | null {
  return DRILL_TREES[id] ?? null;
}

export function getAllDrillIds(): string[] {
  return Object.keys(DRILL_TREES);
}

export function findNodeById(root: DrillDownRoot, nodeId: string): DrillNode | null {
  function search(nodes: DrillNode[]): DrillNode | null {
    for (const n of nodes) {
      if (n.id === nodeId) return n;
      if (n.children) {
        const found = search(n.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(root.children);
}
