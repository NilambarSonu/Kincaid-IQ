export const clientProfile = {
  name: "Jeremiah Shrack",
  initials: "KR",
  location: "Carmel, IN",
  brokerage: "Kincaid Health",
  tier: "Private Wealth Platinum",
  advisor: "Victoria Chen, CFA",
  since: "2009",
};

export const netWorthSummary = {
  total: 2_410_000_000,
  change24h: 14_200_000,
  changePct24h: 0.59,
  asOf: "March 5, 2026",
};

export const assetAllocation = [
  { name: "Public Equities", value: 724_000_000, pct: 30.0, color: "#0D2B45" },
  { name: "Private Equity", value: 482_000_000, pct: 20.0, color: "#C49A3C" },
  { name: "Real Estate", value: 361_500_000, pct: 15.0, color: "#2E6B9E" },
  { name: "Venture Capital", value: 240_000_000, pct: 10.0, color: "#5B8DB8" },
  { name: "Hedge Funds", value: 168_700_000, pct: 7.0, color: "#A87B2C" },
  { name: "Private Credit", value: 144_600_000, pct: 6.0, color: "#8BA8BF" },
  { name: "Real Assets", value: 120_500_000, pct: 5.0, color: "#D4B896" },
  { name: "Cash & Treasury", value: 96_400_000, pct: 4.0, color: "#E8E0D4" },
  { name: "Crypto Assets", value: 48_200_000, pct: 2.0, color: "#7CB5D4" },
  { name: "Art & Collectibles", value: 24_100_000, pct: 1.0, color: "#C9B99A" },
];

export const netWorthTrend = [
  { month: "Apr", value: 2_100_000_000 },
  { month: "May", value: 2_140_000_000 },
  { month: "Jun", value: 2_080_000_000 },
  { month: "Jul", value: 2_190_000_000 },
  { month: "Aug", value: 2_240_000_000 },
  { month: "Sep", value: 2_210_000_000 },
  { month: "Oct", value: 2_290_000_000 },
  { month: "Nov", value: 2_350_000_000 },
  { month: "Dec", value: 2_310_000_000 },
  { month: "Jan", value: 2_370_000_000 },
  { month: "Feb", value: 2_395_000_000 },
  { month: "Mar", value: 2_410_000_000 },
];

export const liquidityPositions = {
  total: 96_400_000,
  cashUSD: 42_000_000,
  treasuryBills: 28_000_000,
  moneyMarket: 16_400_000,
  foreignCurrency: 10_000_000,
  burnRate: 850_000,
  liquidityHorizon: 113,
};

export const treasuryLadder = [
  { maturity: "30d", value: 8_000_000, yield: 5.21 },
  { maturity: "90d", value: 10_000_000, yield: 5.18 },
  { maturity: "180d", value: 6_000_000, yield: 5.09 },
  { maturity: "1yr", value: 4_000_000, yield: 4.92 },
];

export const currencyBalances = [
  { currency: "USD", amount: 42_000_000, flag: "🇺🇸" },
  { currency: "EUR", amount: 4_200_000, flag: "🇪🇺" },
  { currency: "CHF", amount: 2_800_000, flag: "🇨🇭" },
  { currency: "GBP", amount: 1_900_000, flag: "🇬🇧" },
  { currency: "SGD", amount: 1_100_000, flag: "🇸🇬" },
];

export const portfolioStats = {
  ytdReturn: 8.42,
  volatility: 9.8,
  sharpe: 1.64,
  maxDrawdown: -4.2,
  beta: 0.68,
  alpha: 3.1,
};

export const geographicExposure = [
  { region: "North America", pct: 48, value: 1_156_800_000 },
  { region: "Europe", pct: 22, value: 530_200_000 },
  { region: "Asia Pacific", pct: 18, value: 433_800_000 },
  { region: "Middle East", pct: 7, value: 168_700_000 },
  { region: "Latin America", pct: 3, value: 72_300_000 },
  { region: "Africa", pct: 2, value: 48_200_000 },
];

export const sectorExposure = [
  { sector: "Technology", pct: 28, color: "#0D2B45" },
  { sector: "Healthcare", pct: 16, color: "#C49A3C" },
  { sector: "Financials", pct: 14, color: "#2E6B9E" },
  { sector: "Energy", pct: 11, color: "#5B8DB8" },
  { sector: "Consumer", pct: 10, color: "#A87B2C" },
  { sector: "Industrials", pct: 9, color: "#8BA8BF" },
  { sector: "Real Estate", pct: 7, color: "#D4B896" },
  { sector: "Other", pct: 5, color: "#E8E0D4" },
];

export const privateInvestments = [
  {
    id: 1,
    name: "Sequoia Capital Fund XVIII",
    type: "Venture Capital",
    vintage: 2021,
    committed: 50_000_000,
    called: 38_000_000,
    nav: 62_400_000,
    distributed: 8_200_000,
    irr: 24.8,
    tvpi: 1.86,
    dpi: 0.22,
    status: "Active",
  },
  {
    id: 2,
    name: "KKR Americas XII",
    type: "Private Equity",
    vintage: 2020,
    committed: 75_000_000,
    called: 68_000_000,
    nav: 112_200_000,
    distributed: 18_500_000,
    irr: 31.4,
    tvpi: 1.92,
    dpi: 0.27,
    status: "Active",
  },
  {
    id: 3,
    name: "Blackstone Real Estate X",
    type: "Real Estate PE",
    vintage: 2019,
    committed: 40_000_000,
    called: 40_000_000,
    nav: 58_800_000,
    distributed: 22_400_000,
    irr: 18.6,
    tvpi: 2.03,
    dpi: 0.56,
    status: "Harvesting",
  },
  {
    id: 4,
    name: "Andreessen Horowitz Growth IV",
    type: "Growth Equity",
    vintage: 2022,
    committed: 25_000_000,
    called: 15_000_000,
    nav: 19_800_000,
    distributed: 0,
    irr: 14.2,
    tvpi: 1.32,
    dpi: 0.00,
    status: "Active",
  },
  {
    id: 5,
    name: "Apollo Credit Fund VII",
    type: "Private Credit",
    vintage: 2021,
    committed: 30_000_000,
    called: 30_000_000,
    nav: 31_200_000,
    distributed: 7_800_000,
    irr: 12.4,
    tvpi: 1.30,
    dpi: 0.26,
    status: "Active",
  },
];

export const realEstatePortfolio = [
  {
    id: 1,
    name: "432 Park Avenue Penthouse",
    city: "New York, NY",
    type: "Residential",
    value: 48_000_000,
    debt: 0,
    rentalYield: null,
    capRate: null,
    acquired: "2018",
    flag: "🇺🇸",
  },
  {
    id: 2,
    name: "The Mark Tower — Units 42–44",
    city: "New York, NY",
    type: "Residential",
    value: 32_000_000,
    debt: 12_000_000,
    rentalYield: 2.8,
    capRate: 3.1,
    acquired: "2020",
    flag: "🇺🇸",
  },
  {
    id: 3,
    name: "Mayfair Office Complex",
    city: "London, UK",
    type: "Commercial",
    value: 58_000_000,
    debt: 24_000_000,
    rentalYield: 4.2,
    capRate: 4.8,
    acquired: "2016",
    flag: "🇬🇧",
  },
  {
    id: 4,
    name: "Côte d'Azur Estate",
    city: "Saint-Jean-Cap-Ferrat",
    type: "Residential",
    value: 42_500_000,
    debt: 0,
    rentalYield: null,
    capRate: null,
    acquired: "2021",
    flag: "🇫🇷",
  },
  {
    id: 5,
    name: "Marina Bay Mixed-Use Tower",
    city: "Singapore",
    type: "Mixed-Use",
    value: 78_000_000,
    debt: 32_000_000,
    rentalYield: 3.9,
    capRate: 4.4,
    acquired: "2019",
    flag: "🇸🇬",
  },
  {
    id: 6,
    name: "Alpine Chalet Portfolio (3x)",
    city: "Verbier, Switzerland",
    type: "Residential",
    value: 28_000_000,
    debt: 8_000_000,
    rentalYield: 3.2,
    capRate: 3.6,
    acquired: "2017",
    flag: "🇨🇭",
  },
  {
    id: 7,
    name: "Austin Tech Campus",
    city: "Austin, TX",
    type: "Commercial",
    value: 75_000_000,
    debt: 40_000_000,
    rentalYield: 5.4,
    capRate: 5.9,
    acquired: "2022",
    flag: "🇺🇸",
  },
];

export const familyOfficeData = {
  trusts: [
    {
      id: 1,
      name: "Whitmore Family Irrevocable Trust",
      type: "Irrevocable",
      jurisdiction: "Delaware, USA",
      aum: 480_000_000,
      beneficiaries: 6,
      established: 2004,
      taxEfficiency: 94,
    },
    {
      id: 2,
      name: "Generation II Dynasty Trust",
      type: "Dynasty",
      jurisdiction: "South Dakota, USA",
      aum: 310_000_000,
      beneficiaries: 12,
      established: 2015,
      taxEfficiency: 97,
    },
    {
      id: 3,
      name: "Whitmore Foundation",
      type: "Charitable",
      jurisdiction: "Delaware, USA",
      aum: 120_000_000,
      beneficiaries: null,
      established: 2009,
      taxEfficiency: 98,
    },
    {
      id: 4,
      name: "Cayman Islands Holding Structure",
      type: "Offshore",
      jurisdiction: "Cayman Islands",
      aum: 280_000_000,
      beneficiaries: 3,
      established: 2012,
      taxEfficiency: 91,
    },
  ],
  generationalProjections: [
    { generation: "G1 (You)", year: 2026, projected: 2_410_000_000 },
    { generation: "G2 (Children)", year: 2055, projected: 5_800_000_000 },
    { generation: "G3 (Grandchildren)", year: 2085, projected: 12_400_000_000 },
  ],
  philanthropicAllocation: 120_000_000,
  estateDetails: {
    estateTaxExposure: 890_000_000,
    effectiveRate: 37,
    savingsViaStructures: 340_000_000,
  },
};

export const scenarioSimulations = [
  {
    id: 1,
    name: "2008-Style Market Crash",
    category: "Equity Shock",
    portfolioImpact: -18.4,
    impactValue: -443_240_000,
    liquidityRisk: "Low",
    recoveryMonths: 28,
    description: "50% equity market decline with credit spread widening of 400bps",
  },
  {
    id: 2,
    name: "Rapid Rate Hike (+300bps)",
    category: "Rate Shock",
    portfolioImpact: -7.2,
    impactValue: -173_520_000,
    liquidityRisk: "Medium",
    recoveryMonths: 14,
    description: "Fed tightens aggressively; bond values drop, real estate cap rates expand",
  },
  {
    id: 3,
    name: "Stagflation Regime",
    category: "Inflation",
    portfolioImpact: -12.8,
    impactValue: -308_480_000,
    liquidityRisk: "Medium",
    recoveryMonths: 32,
    description: "Inflation at 8%+ with GDP contraction; commodities and real assets outperform",
  },
  {
    id: 4,
    name: "USD Devaluation (−25%)",
    category: "Currency",
    portfolioImpact: -4.1,
    impactValue: -98_810_000,
    liquidityRisk: "Low",
    recoveryMonths: 18,
    description: "Dollar weakens sharply vs EUR, CHF, JPY; international holdings gain",
  },
  {
    id: 5,
    name: "Geopolitical Crisis (Taiwan)",
    category: "Geopolitical",
    portfolioImpact: -21.6,
    impactValue: -520_560_000,
    liquidityRisk: "High",
    recoveryMonths: 36,
    description: "Tech sector destruction, supply chain collapse, defense surge",
  },
  {
    id: 6,
    name: "Soft Landing (Base Case)",
    category: "Baseline",
    portfolioImpact: 9.8,
    impactValue: 236_180_000,
    liquidityRisk: "None",
    recoveryMonths: 0,
    description: "Fed achieves 2% inflation, GDP growth 2.4%, equities rally 15%",
  },
];

export const dealPipeline = [
  {
    id: 1,
    name: "Helios Energy Partners",
    sector: "Clean Energy",
    stage: "Due Diligence",
    type: "Direct Investment",
    askSize: 25_000_000,
    projectedIRR: 28,
    minInvestment: 10_000_000,
    riskRating: "Moderate",
    status: "Under Review",
    summary: "Series C solar + storage company targeting ERCOT market. $180M revenue, EBITDA positive.",
  },
  {
    id: 2,
    name: "NovaCare Health Systems",
    sector: "Healthcare",
    stage: "Term Sheet",
    type: "Co-Investment",
    askSize: 15_000_000,
    projectedIRR: 21,
    minInvestment: 5_000_000,
    riskRating: "Low-Moderate",
    status: "Term Sheet",
    summary: "Alongside Carlyle Group. Ambulatory surgery center rollup in Sun Belt markets. Proven management team.",
  },
  {
    id: 3,
    name: "Apex Logistics SPV",
    sector: "Logistics",
    stage: "Closing",
    type: "SPV",
    askSize: 8_000_000,
    projectedIRR: 18,
    minInvestment: 2_000_000,
    riskRating: "Moderate",
    status: "Closing",
    summary: "Last-mile delivery infrastructure in Southeast Asia. Singapore-based. Series B preferred.",
  },
  {
    id: 4,
    name: "Quantum Computing Inc.",
    sector: "Technology",
    stage: "Screening",
    type: "Venture",
    askSize: 5_000_000,
    projectedIRR: 35,
    minInvestment: 1_000_000,
    riskRating: "High",
    status: "Screening",
    summary: "Post-Series A quantum error correction company. IBM partnership announced. High risk/high reward.",
  },
];

export const allocationTargets: Record<string, number> = {
  "Public Equities": 30,
  "Private Equity": 20,
  "Real Estate": 15,
  "Venture Capital": 10,
  "Hedge Funds": 7,
  "Private Credit": 6,
  "Real Assets": 5,
  "Cash & Treasury": 4,
  "Crypto Assets": 2,
  "Art & Collectibles": 1,
};

export const performanceTrend = [
  { month: "Apr", portfolio: 0.0, sp500: 0.0, blend6040: 0.0, endowment: 0.0 },
  { month: "May", portfolio: 0.8, sp500: 1.4, blend6040: 0.9, endowment: 0.7 },
  { month: "Jun", portfolio: -1.2, sp500: -0.8, blend6040: -0.5, endowment: -0.9 },
  { month: "Jul", portfolio: 2.8, sp500: 3.2, blend6040: 2.1, endowment: 2.4 },
  { month: "Aug", portfolio: 1.9, sp500: 2.6, blend6040: 1.8, endowment: 1.6 },
  { month: "Sep", portfolio: -0.7, sp500: -1.1, blend6040: -0.8, endowment: -0.5 },
  { month: "Oct", portfolio: 3.2, sp500: 4.1, blend6040: 2.9, endowment: 2.8 },
  { month: "Nov", portfolio: 2.4, sp500: 2.9, blend6040: 2.2, endowment: 2.1 },
  { month: "Dec", portfolio: -0.9, sp500: -1.4, blend6040: -0.7, endowment: -0.6 },
  { month: "Jan", portfolio: 1.8, sp500: 2.3, blend6040: 1.6, endowment: 1.5 },
  { month: "Feb", portfolio: 0.6, sp500: 1.2, blend6040: 0.8, endowment: 0.5 },
  { month: "Mar", portfolio: 0.4, sp500: 0.9, blend6040: 0.5, endowment: 0.4 },
];

export const cashFlowProjection = [
  { month: "Apr", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: 0, charitable: -200_000 },
  { month: "May", dividends: 1_850_000, rent: 980_000, distributions: 2_200_000, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: -3_500_000, charitable: 0 },
  { month: "Jun", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -4_200_000, capitalCalls: 0, charitable: -500_000 },
  { month: "Jul", dividends: 1_850_000, rent: 980_000, distributions: 8_500_000, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: -2_000_000, charitable: 0 },
  { month: "Aug", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: 0, charitable: -200_000 },
  { month: "Sep", dividends: 1_850_000, rent: 980_000, distributions: 1_800_000, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: -5_000_000, charitable: -1_200_000 },
  { month: "Oct", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: 0, charitable: 0 },
  { month: "Nov", dividends: 1_850_000, rent: 980_000, distributions: 3_400_000, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: -8_000_000, charitable: -200_000 },
  { month: "Dec", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -1_800_000, taxes: -2_100_000, capitalCalls: 0, charitable: -500_000 },
  { month: "Jan", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: -4_000_000, charitable: 0 },
  { month: "Feb", dividends: 1_850_000, rent: 980_000, distributions: 5_000_000, interest: 430_000, livingExpenses: -850_000, taxes: -380_000, capitalCalls: 0, charitable: -200_000 },
  { month: "Mar", dividends: 1_850_000, rent: 980_000, distributions: 0, interest: 430_000, livingExpenses: -850_000, taxes: -4_200_000, capitalCalls: -2_500_000, charitable: 0 },
];

export const taxLots = [
  { id: 1, name: "Apple Inc.", ticker: "AAPL", assetClass: "Public Equities", shares: 12_400, costBasis: 142.30, currentPrice: 227.50, acquiredDate: "2020-03-15", unrealizedGain: 1_054_280, unrealizedGainPct: 59.9, holdingPeriod: "Long", taxLiability: 264_570, harvestable: false },
  { id: 2, name: "Nvidia Corp.", ticker: "NVDA", assetClass: "Public Equities", shares: 8_200, costBasis: 410.00, currentPrice: 875.40, acquiredDate: "2022-01-10", unrealizedGain: 3_816_280, unrealizedGainPct: 113.5, holdingPeriod: "Long", taxLiability: 956_250, harvestable: false },
  { id: 3, name: "iShares 20yr Treasury", ticker: "TLT", assetClass: "Cash & Treasury", shares: 85_000, costBasis: 112.40, currentPrice: 88.74, acquiredDate: "2021-08-20", unrealizedGain: -2_011_100, unrealizedGainPct: -21.1, holdingPeriod: "Long", taxLiability: 0, harvestable: true },
  { id: 4, name: "Vanguard Real Estate ETF", ticker: "VNQ", assetClass: "Real Estate", shares: 42_000, costBasis: 98.60, currentPrice: 82.10, acquiredDate: "2022-06-01", unrealizedGain: -693_000, unrealizedGainPct: -16.7, holdingPeriod: "Long", taxLiability: 0, harvestable: true },
  { id: 5, name: "Microsoft Corp.", ticker: "MSFT", assetClass: "Public Equities", shares: 6_800, costBasis: 280.00, currentPrice: 415.20, acquiredDate: "2019-11-05", unrealizedGain: 919_360, unrealizedGainPct: 48.3, holdingPeriod: "Long", taxLiability: 229_840, harvestable: false },
  { id: 6, name: "Emerging Markets ETF", ticker: "EEM", assetClass: "Public Equities", shares: 95_000, costBasis: 48.20, currentPrice: 39.85, acquiredDate: "2022-09-12", unrealizedGain: -793_250, unrealizedGainPct: -17.3, holdingPeriod: "Long", taxLiability: 0, harvestable: true },
  { id: 7, name: "Pimco Income Fund", ticker: "PONAX", assetClass: "Private Credit", shares: 150_000, costBasis: 10.20, currentPrice: 9.88, acquiredDate: "2023-02-14", unrealizedGain: -48_000, unrealizedGainPct: -3.1, holdingPeriod: "Short", taxLiability: 0, harvestable: true },
  { id: 8, name: "Alphabet Inc.", ticker: "GOOGL", assetClass: "Public Equities", shares: 3_200, costBasis: 95.00, currentPrice: 174.20, acquiredDate: "2020-07-22", unrealizedGain: 253_440, unrealizedGainPct: 83.4, holdingPeriod: "Long", taxLiability: 63_360, harvestable: false },
  { id: 9, name: "iShares HY Bond ETF", ticker: "HYG", assetClass: "Private Credit", shares: 60_000, costBasis: 79.40, currentPrice: 72.80, acquiredDate: "2022-11-30", unrealizedGain: -396_000, unrealizedGainPct: -8.3, holdingPeriod: "Long", taxLiability: 0, harvestable: true },
  { id: 10, name: "Global X Uranium ETF", ticker: "URA", assetClass: "Real Assets", shares: 28_000, costBasis: 32.10, currentPrice: 24.60, acquiredDate: "2023-04-08", unrealizedGain: -210_000, unrealizedGainPct: -23.4, holdingPeriod: "Short", taxLiability: 0, harvestable: true },
];

export const harvestSummary = {
  totalHarvestableLoss: -4_151_350,
  estimatedTaxSavings: 1_037_838,
  effectiveTaxRate: 25,
  washSaleRiskTickers: ["TLT", "HYG"],
  replacementSuggestions: {
    "TLT": { name: "Schwab Long-Term Treasury ETF", ticker: "SCHQ", correlation: 0.98 },
    "VNQ": { name: "iShares Core US REIT ETF", ticker: "USRT", correlation: 0.96 },
    "EEM": { name: "iShares Core MSCI EM ETF", ticker: "IEMG", correlation: 0.99 },
    "HYG": { name: "SPDR Bloomberg HY Bond ETF", ticker: "JNK", correlation: 0.97 },
    "PONAX": { name: "Metropolitan West Total Return", ticker: "MWTRX", correlation: 0.92 },
    "URA": { name: "Sprott Uranium Miners ETF", ticker: "URNM", correlation: 0.95 },
  },
};

export const monteCarloParams = {
  currentNetWorth: 2_410_000_000,
  annualContribution: 0,
  annualWithdrawal: 18_000_000,
  expectedReturn: 8.2,
  volatility: 12.4,
  simulations: 1000,
};

export const monteCarloResults = {
  percentile10: [2.41, 2.28, 2.19, 2.04, 1.92, 1.78, 1.71, 1.68, 1.72, 1.81, 1.91].map((v, i) => ({ year: 2025 + i * 3, value: v * 1e9 })),
  percentile25: [2.41, 2.62, 2.74, 2.88, 2.95, 3.08, 3.24, 3.41, 3.60, 3.82, 4.06].map((v, i) => ({ year: 2025 + i * 3, value: v * 1e9 })),
  percentile50: [2.41, 2.94, 3.48, 4.10, 4.82, 5.64, 6.58, 7.64, 8.85, 10.20, 11.74].map((v, i) => ({ year: 2025 + i * 3, value: v * 1e9 })),
  percentile75: [2.41, 3.28, 4.24, 5.42, 6.88, 8.64, 10.82, 13.44, 16.62, 20.44, 25.04].map((v, i) => ({ year: 2025 + i * 3, value: v * 1e9 })),
  percentile90: [2.41, 3.64, 5.22, 7.44, 10.40, 14.40, 19.82, 26.92, 36.24, 48.40, 64.20].map((v, i) => ({ year: 2025 + i * 3, value: v * 1e9 })),
  probabilityOfRuin: 2.4,
  medianWealth30yr: 11_740_000_000,
  successRate: 97.6,
};

export const pmeData = [
  { fund: "Sequoia Capital Fund XVIII", vintage: 2018, invested: 45_000_000, currentValue: 127_800_000, irr: 24.8, tvpi: 2.84, dpi: 1.20, moic: 2.84, pmeSP500: 1.94, pmeNasdaq: 2.28, alpha: 0.90, category: "Venture" },
  { fund: "KKR Americas XII", vintage: 2019, invested: 80_000_000, currentValue: 156_800_000, irr: 18.2, tvpi: 1.96, dpi: 0.85, moic: 1.96, pmeSP500: 1.72, pmeNasdaq: 1.85, alpha: 0.24, category: "Buyout" },
  { fund: "Andreessen Bio Fund II", vintage: 2020, invested: 30_000_000, currentValue: 88_200_000, irr: 32.1, tvpi: 2.94, dpi: 0.40, moic: 2.94, pmeSP500: 1.58, pmeNasdaq: 1.76, alpha: 1.36, category: "Venture" },
  { fund: "Blackstone Real Estate X", vintage: 2017, invested: 60_000_000, currentValue: 118_200_000, irr: 15.4, tvpi: 1.97, dpi: 1.40, moic: 1.97, pmeSP500: 2.14, pmeNasdaq: 2.60, alpha: -0.17, category: "Real Assets" },
  { fund: "Apollo Global Credit", vintage: 2021, invested: 50_000_000, currentValue: 72_000_000, irr: 12.8, tvpi: 1.44, dpi: 0.60, moic: 1.44, pmeSP500: 1.28, pmeNasdaq: 1.32, alpha: 0.16, category: "Credit" },
  { fund: "Tiger Global Venture XIV", vintage: 2022, invested: 25_000_000, currentValue: 28_750_000, irr: 8.4, tvpi: 1.15, dpi: 0.00, moic: 1.15, pmeSP500: 1.18, pmeNasdaq: 1.22, alpha: -0.03, category: "Venture" },
];

export const dividendSchedule = [
  { id: 1, date: "2026-04-15", source: "Apple Inc. (AAPL)", type: "Dividend", amount: 30_628, assetClass: "Public Equities", frequency: "Quarterly", yieldPct: 0.54 },
  { id: 2, date: "2026-04-18", source: "432 Park Ave Penthouse", type: "Rent", amount: 280_000, assetClass: "Real Estate", frequency: "Monthly", yieldPct: 2.8 },
  { id: 3, date: "2026-04-30", source: "Microsoft Corp (MSFT)", type: "Dividend", amount: 19_040, assetClass: "Public Equities", frequency: "Quarterly", yieldPct: 0.82 },
  { id: 4, date: "2026-05-01", source: "KKR Americas XII", type: "Distribution", amount: 2_200_000, assetClass: "Private Equity", frequency: "Irregular", yieldPct: 2.75 },
  { id: 5, date: "2026-05-15", source: "Alphabet Inc (GOOGL)", type: "Dividend", amount: 3_200, assetClass: "Public Equities", frequency: "Quarterly", yieldPct: 0.05 },
  { id: 6, date: "2026-05-18", source: "Mayfair Office Complex", type: "Rent", amount: 486_000, assetClass: "Real Estate", frequency: "Monthly", yieldPct: 4.2 },
  { id: 7, date: "2026-06-01", source: "Apollo Global Credit", type: "Distribution", amount: 1_600_000, assetClass: "Private Credit", frequency: "Semi-Annual", yieldPct: 12.8 },
  { id: 8, date: "2026-06-15", source: "iShares TLT", type: "Dividend", amount: 184_660, assetClass: "Cash & Treasury", frequency: "Monthly", yieldPct: 4.20 },
  { id: 9, date: "2026-06-18", source: "Marina Bay Mixed-Use Tower", type: "Rent", amount: 760_500, assetClass: "Real Estate", frequency: "Monthly", yieldPct: 3.9 },
  { id: 10, date: "2026-07-01", source: "Sequoia Capital Fund XVIII", type: "Distribution", amount: 8_500_000, assetClass: "Venture Capital", frequency: "Irregular", yieldPct: 6.6 },
  { id: 11, date: "2026-07-15", source: "Pimco Income Fund", type: "Dividend", amount: 112_500, assetClass: "Private Credit", frequency: "Monthly", yieldPct: 9.1 },
  { id: 12, date: "2026-08-01", source: "Austin Tech Campus", type: "Rent", amount: 1_012_500, assetClass: "Real Estate", frequency: "Monthly", yieldPct: 5.4 },
  { id: 13, date: "2026-09-15", source: "Blackstone Real Estate X", type: "Distribution", amount: 1_800_000, assetClass: "Private Equity", frequency: "Irregular", yieldPct: 3.0 },
  { id: 14, date: "2026-10-01", source: "Andreessen Bio Fund II", type: "Distribution", amount: 3_000_000, assetClass: "Venture Capital", frequency: "Irregular", yieldPct: 10.0 },
  { id: 15, date: "2026-11-15", source: "iShares TLT", type: "Dividend", amount: 184_660, assetClass: "Cash & Treasury", frequency: "Monthly", yieldPct: 4.20 },
  { id: 16, date: "2026-12-30", source: "Whitmore Foundation (DAF)", type: "Distribution", amount: 4_200_000, assetClass: "Charitable", frequency: "Annual", yieldPct: 3.5 },
];

export const charitableStrategies = {
  daf: {
    name: "Donor-Advised Fund",
    immediateDeduction: 10_000_000,
    deductionPct: 100,
    grantFlexibility: "High",
    setupTime: "Same-day",
    annualLimit: 0.6,
    appreciatedStockBenefit: true,
    description: "Contribute appreciated securities, take immediate deduction, grant over time at your discretion",
    estimatedTaxSaving: 3_700_000,
    fiveYearGivingPower: 12_400_000,
  },
  appreciatedStock: {
    name: "Appreciated Stock Gift",
    immediateDeduction: 8_200_000,
    deductionPct: 100,
    grantFlexibility: "Medium",
    setupTime: "1–2 weeks",
    annualLimit: 0.3,
    avoidCapGains: true,
    estimatedTaxSaving: 4_100_000,
    description: "Gift appreciated NVDA/AAPL shares directly, avoid capital gains + get deduction",
    fiveYearGivingPower: 8_200_000,
  },
  clat: {
    name: "Charitable Lead Annuity Trust",
    immediateDeduction: 6_500_000,
    deductionPct: 85,
    grantFlexibility: "Low",
    setupTime: "4–6 weeks",
    annualLimit: null,
    estimatedTaxSaving: 2_405_000,
    description: "CLAT makes payments to charity for a term; remainder passes to heirs at reduced transfer tax",
    fiveYearGivingPower: 6_500_000,
  },
  privateFoundation: {
    name: "Private Foundation",
    immediateDeduction: 15_000_000,
    deductionPct: 30,
    grantFlexibility: "Full",
    setupTime: "2–3 months",
    annualLimit: null,
    estimatedTaxSaving: 1_665_000,
    description: "Full control, family legacy, 5% annual distribution requirement, investment oversight",
    fiveYearGivingPower: 20_000_000,
  },
};

export const estateScenarios = [
  {
    id: 1,
    strategy: "No Planning (Status Quo)",
    estateValue: 2_410_000_000,
    estateTax: 890_000_000,
    netToHeirs: 1_520_000_000,
    savingsVsBase: 0,
    complexity: "None",
    timeline: "N/A",
    color: "#FF4D6D",
  },
  {
    id: 2,
    strategy: "Annual Gifting (Max Exclusion)",
    estateValue: 2_410_000_000,
    estateTax: 842_000_000,
    netToHeirs: 1_568_000_000,
    savingsVsBase: 48_000_000,
    complexity: "Low",
    timeline: "Ongoing",
    color: "#FFB800",
  },
  {
    id: 3,
    strategy: "GRAT Cascade",
    estateValue: 2_410_000_000,
    estateTax: 712_000_000,
    netToHeirs: 1_698_000_000,
    savingsVsBase: 178_000_000,
    complexity: "Medium",
    timeline: "2–3 years",
    color: "#00A8FF",
  },
  {
    id: 4,
    strategy: "IDGT + Family Loans",
    estateValue: 2_410_000_000,
    estateTax: 620_000_000,
    netToHeirs: 1_790_000_000,
    savingsVsBase: 270_000_000,
    complexity: "Medium",
    timeline: "6–12 months",
    color: "#00E5FF",
  },
  {
    id: 5,
    strategy: "Dynasty Trust + IDGT",
    estateValue: 2_410_000_000,
    estateTax: 550_000_000,
    netToHeirs: 1_860_000_000,
    savingsVsBase: 340_000_000,
    complexity: "High",
    timeline: "12–18 months",
    color: "#A855F7",
  },
  {
    id: 6,
    strategy: "Full Optimization (All Strategies)",
    estateValue: 2_410_000_000,
    estateTax: 380_000_000,
    netToHeirs: 2_030_000_000,
    savingsVsBase: 510_000_000,
    complexity: "Very High",
    timeline: "18–24 months",
    color: "#00FF94",
  },
];

export const fxExposures = [
  { currency: "GBP", flag: "🇬🇧", name: "British Pound", exposure: 58_000_000, hedged: 40_000_000, unhedged: 18_000_000, spotRate: 1.2710, forwardRate: 1.2645, hedgeCostBps: 52, annualHedgeCost: 208_000, pnlIfDown10: -1_800_000, pnlIfUp10: 1_800_000 },
  { currency: "EUR", flag: "🇪🇺", name: "Euro", exposure: 42_500_000, hedged: 30_000_000, unhedged: 12_500_000, spotRate: 1.0840, forwardRate: 1.0780, hedgeCostBps: 48, annualHedgeCost: 144_000, pnlIfDown10: -1_250_000, pnlIfUp10: 1_250_000 },
  { currency: "SGD", flag: "🇸🇬", name: "Singapore Dollar", exposure: 78_000_000, hedged: 50_000_000, unhedged: 28_000_000, spotRate: 0.7440, forwardRate: 0.7410, hedgeCostBps: 38, annualHedgeCost: 190_000, pnlIfDown10: -2_800_000, pnlIfUp10: 2_800_000 },
  { currency: "CHF", flag: "🇨🇭", name: "Swiss Franc", exposure: 28_000_000, hedged: 28_000_000, unhedged: 0, spotRate: 1.1340, forwardRate: 1.1290, hedgeCostBps: 42, annualHedgeCost: 117_600, pnlIfDown10: 0, pnlIfUp10: 0 },
  { currency: "JPY", flag: "🇯🇵", name: "Japanese Yen", exposure: 12_000_000, hedged: 0, unhedged: 12_000_000, spotRate: 0.00662, forwardRate: 0.00659, hedgeCostBps: 185, annualHedgeCost: 0, pnlIfDown10: -1_200_000, pnlIfUp10: 1_200_000 },
];

export const rateSensitivity = [
  { name: "iShares 20yr Treasury (TLT)", assetClass: "Cash & Treasury", value: 7_540_000, duration: 16.8, dv01: 12_667, pnlMinus100: 211_282, pnlMinus50: 105_641, pnlPlus50: -105_641, pnlPlus100: -211_282, pnlPlus200: -422_564, convexity: 3.4 },
  { name: "Mayfair Office Complex", assetClass: "Real Estate", value: 34_000_000, duration: 12.0, dv01: 40_800, pnlMinus100: 408_000, pnlMinus50: 204_000, pnlPlus50: -204_000, pnlPlus100: -408_000, pnlPlus200: -816_000, convexity: 1.2 },
  { name: "Apollo Global Credit Fund", assetClass: "Private Credit", value: 72_000_000, duration: 4.2, dv01: 30_240, pnlMinus100: 302_400, pnlMinus50: 151_200, pnlPlus50: -151_200, pnlPlus100: -302_400, pnlPlus200: -604_800, convexity: 0.5 },
  { name: "Pimco Income Fund", assetClass: "Private Credit", value: 14_820_000, duration: 3.8, dv01: 5_632, pnlMinus100: 56_316, pnlMinus50: 28_158, pnlPlus50: -28_158, pnlPlus100: -56_316, pnlPlus200: -112_632, convexity: 0.4 },
  { name: "432 Park Ave Penthouse", assetClass: "Real Estate", value: 85_000_000, duration: 15.0, dv01: 127_500, pnlMinus100: 1_275_000, pnlMinus50: 637_500, pnlPlus50: -637_500, pnlPlus100: -1_275_000, pnlPlus200: -2_550_000, convexity: 2.8 },
  { name: "Austin Tech Campus", assetClass: "Real Estate", value: 35_000_000, duration: 10.0, dv01: 35_000, pnlMinus100: 350_000, pnlMinus50: 175_000, pnlPlus50: -175_000, pnlPlus100: -350_000, pnlPlus200: -700_000, convexity: 1.0 },
  { name: "iShares HY Bond ETF (HYG)", assetClass: "Private Credit", value: 43_680_000, duration: 3.5, dv01: 15_288, pnlMinus100: 152_880, pnlMinus50: 76_440, pnlPlus50: -76_440, pnlPlus100: -152_880, pnlPlus200: -305_760, convexity: 0.3 },
];

export const advisorMessages = [
  {
    id: 1,
    from: "Sarah Chen",
    role: "Lead Wealth Advisor",
    avatar: "SC",
    date: "2026-03-05",
    subject: "Q1 2026 Portfolio Review — Agenda",
    preview: "Jeremiah, ahead of our March 12th meeting I wanted to share the draft agenda and a few items...",
    body: "Jeremiah,\n\nAhead of our March 12th quarterly review I wanted to share three items that warrant discussion:\n\n1. **TLT / Rate Risk**: The 16.8yr duration exposure in your Treasury position represents meaningful rate sensitivity. With the Fed holding at 5.25%, we should discuss trimming or hedging.\n\n2. **Helios Energy Partners**: Due diligence is complete. The team is recommending a $15M commitment (versus the $25M ask). I've attached the final IC memo.\n\n3. **Estate Planning**: Your current structure generates $890M in estimated estate tax. The full optimization scenario (Dynasty Trust + IDGT) could reduce this to $380M. We should loop in James Chen at Sullivan & Cromwell.\n\nPlease review the Q1 performance summary I've prepared — the portfolio delivered +14.8% vs S&P's +9.2%.\n\nBest,\nSarah",
    unread: true,
    priority: "High",
    attachments: ["Q1-2026-Review-Agenda.pdf", "Helios-IC-Memo.pdf"],
  },
  {
    id: 2,
    from: "Michael Torres",
    role: "Tax & Structuring",
    avatar: "MT",
    date: "2026-03-03",
    subject: "Tax Loss Harvesting Opportunity — $1.04M in Savings",
    preview: "We've identified six positions eligible for tax-loss harvesting totaling $4.15M in realizable losses...",
    body: "Jeremiah,\n\nWe've identified six positions eligible for tax-loss harvesting totaling $4.15M in harvestable losses. At your 25% effective rate, this represents **$1.04M in immediate tax savings**.\n\nKey positions:\n- TLT: -$2.01M loss (replace with SCHQ to maintain duration exposure)\n- EEM: -$793K loss (replace with IEMG, 0.99 correlation)\n- VNQ: -$693K loss (replace with USRT)\n- HYG: -$396K loss (replace with JNK)\n\nWash-sale rules require 30-day waiting period before repurchasing original positions. All replacement securities maintain economic exposure within 2-4% tracking error.\n\nI'd recommend executing this before April 15th to maximize Q1 tax efficiency.\n\nBest,\nMichael",
    unread: true,
    priority: "High",
    attachments: ["Tax-Harvest-Analysis.pdf"],
  },
  {
    id: 3,
    from: "Jennifer Walsh",
    role: "Alternative Investments",
    avatar: "JW",
    date: "2026-02-28",
    subject: "PME Analysis — Fund Performance vs Public Markets",
    preview: "Completed the public market equivalent analysis for your private fund portfolio. TL;DR: strong...",
    body: "Jeremiah,\n\nCompleted the PME analysis across your 6 private fund positions. Key findings:\n\n**Outperforming Public Markets (Strong Alpha):**\n- Andreessen Bio Fund II: +1.36x PME alpha vs S&P 500 (IRR: 32.1%)\n- Sequoia Capital Fund XVIII: +0.90x PME alpha\n\n**Underperforming:**\n- Blackstone Real Estate X: -0.17x PME alpha — the public REIT index outperformed over the same period\n- Tiger Global Venture XIV: -0.03x PME alpha (still early, vintage 2022)\n\nOverall, your alternatives allocation has generated meaningful alpha on 4 of 6 funds. I recommend reducing the Blackstone RE exposure on secondary and recycling into the NovaCare co-investment.\n\nFull analysis attached.\n\nJennifer",
    unread: false,
    priority: "Medium",
    attachments: ["PME-Analysis-Q1-2026.pdf"],
  },
  {
    id: 4,
    from: "Robert Kim",
    role: "FX & Derivatives",
    avatar: "RK",
    date: "2026-02-20",
    subject: "GBP/SGD Hedging Update — Recommend Increasing Cover",
    preview: "Following last month's GBP weakness, your unhedged exposure has grown to £18M...",
    body: "Jeremiah,\n\nFollowing GBP weakness in February (-2.1% vs USD), your unhedged GBP exposure has grown to £18M. At current spot (1.2710), a further 10% move lower would cost -$1.8M in mark-to-market losses on the Mayfair property cash flows.\n\nI recommend:\n1. **GBP**: Extend hedge cover from 69% to 90% using 6-month forwards. Cost: ~$52bps / $93,600/year\n2. **SGD**: Current 64% hedge is adequate given SGD's managed float against USD\n3. **JPY**: The ¥12M exposure is too small to cost-effectively hedge — recommend leaving open\n\nI've prepared FX forward tickets for your approval. Please confirm before March 15th to lock in current forward rates.\n\nRobert",
    unread: false,
    priority: "Medium",
    attachments: ["FX-Hedging-Proposal.pdf"],
  },
  {
    id: 5,
    from: "Sarah Chen",
    role: "Lead Wealth Advisor",
    avatar: "SC",
    date: "2026-02-10",
    subject: "Monte Carlo Update — 97.6% Success Rate",
    preview: "Updated the 30-year projection model with current withdrawal rates and market assumptions...",
    body: "Jeremiah,\n\nUpdated the 30-year Monte Carlo projection with current assumptions:\n- Expected return: 8.2% nominal\n- Volatility: 12.4%\n- Annual withdrawals: $18M (lifestyle + philanthropy)\n\nResults are strong:\n- **Median 30yr wealth: $11.74B** (+387% from current)\n- **97.6% probability of never depleting capital** at current spend levels\n- **10th percentile scenario (worst plausible)**: $1.91B — still well above current net worth at inflation-adjusted zero\n\nThe main risks to the projection are: extended stagflation (modeled), correlation breakdown in crisis scenarios, and liquidity constraints from illiquid alternatives.\n\nHappy to walk through the detail on March 12th.\n\nSarah",
    unread: false,
    priority: "Low",
    attachments: ["Monte-Carlo-Q1-2026.pdf"],
  },
];

export const familyEntities = [
  { id: "riddle-family", name: "Kincaid Family", type: "Principal", parent: null, ownershipPct: 100, aum: 2_410_000_000, jurisdiction: "Indiana, USA", established: "—", description: "Jeremiah Shrack — Principal", color: "#FFB800", depth: 0 },
  { id: "whitmore-trust", name: "Whitmore Dynasty Trust", type: "Dynasty Trust", parent: "riddle-family", ownershipPct: 100, aum: 680_000_000, jurisdiction: "South Dakota", established: "2018", description: "Multi-generational dynasty trust — perpetual, no rule against perpetuities", color: "#00FF94", depth: 1 },
  { id: "riddle-grat", name: "Shrack GRAT I", type: "GRAT", parent: "riddle-family", ownershipPct: 100, aum: 142_000_000, jurisdiction: "Indiana", established: "2022", description: "Grantor Retained Annuity Trust — zeroes out 2026", color: "#00A8FF", depth: 1 },
  { id: "riddle-idgt", name: "Shrack IDGT", type: "IDGT", parent: "riddle-family", ownershipPct: 100, aum: 210_000_000, jurisdiction: "Nevada", established: "2020", description: "Intentionally Defective Grantor Trust — income tax paid by grantor", color: "#00E5FF", depth: 1 },
  { id: "park-llc", name: "Park Avenue Holdings LLC", type: "LLC", parent: "riddle-family", ownershipPct: 100, aum: 85_000_000, jurisdiction: "Delaware", established: "2016", description: "Holds 432 Park Ave penthouse", color: "#A855F7", depth: 1 },
  { id: "whitmore-foundation", name: "Whitmore Family Foundation", type: "Foundation", parent: "riddle-family", ownershipPct: 100, aum: 120_000_000, jurisdiction: "Indiana", established: "2014", description: "501(c)(3) private operating foundation", color: "#FF8C00", depth: 1 },
  { id: "riddle-re-lp", name: "Shrack Real Estate LP", type: "LP", parent: "riddle-idgt", ownershipPct: 99, aum: 320_000_000, jurisdiction: "Texas", established: "2019", description: "Holds Austin Tech Campus, Mayfair Office, Marina Bay Tower", color: "#FF4D6D", depth: 2 },
  { id: "asia-holdco", name: "Asia HoldCo Pte. Ltd.", type: "Offshore Corp", parent: "whitmore-trust", ownershipPct: 100, aum: 78_000_000, jurisdiction: "Singapore", established: "2021", description: "Holds Marina Bay Mixed-Use Tower — Singapore entity for tax efficiency", color: "#00E5FF", depth: 2 },
  { id: "riddle-ventures", name: "Shrack Ventures LLC", type: "LLC", parent: "whitmore-trust", ownershipPct: 100, aum: 290_000_000, jurisdiction: "Delaware", established: "2017", description: "Co-invest vehicle for VC / PE fund allocations", color: "#00FF94", depth: 2 },
];

export const beneficiaries = [
  {
    id: 1, name: "Jeremiah Shrack", relation: "Principal", dob: "1974-08-14", age: 51,
    entities: ["Kincaid Family", "Whitmore Dynasty Trust", "Shrack IDGT", "Park Avenue Holdings LLC"],
    totalDistributions: 18_200_000, ytdDistributions: 4_800_000,
    projectedInheritance: null,
    milestones: [],
    status: "Active", avatar: "KR", color: "#FFB800",
  },
  {
    id: 2, name: "Alexandra Kincaid", relation: "Spouse", dob: "1977-03-22", age: 48,
    entities: ["Whitmore Dynasty Trust", "Shrack IDGT"],
    totalDistributions: 5_400_000, ytdDistributions: 1_200_000,
    projectedInheritance: 340_000_000,
    milestones: [{ label: "Trust distribution eligibility", date: "Ongoing", done: true }],
    status: "Active", avatar: "AR", color: "#00A8FF",
  },
  {
    id: 3, name: "Mason Kincaid", relation: "Son", dob: "2004-11-05", age: 21,
    entities: ["Whitmore Dynasty Trust"],
    totalDistributions: 420_000, ytdDistributions: 120_000,
    projectedInheritance: 510_000_000,
    milestones: [
      { label: "Age 25 distribution ($5M)", date: "2029-11-05", done: false },
      { label: "Age 30 full trustee eligibility", date: "2034-11-05", done: false },
      { label: "Trust co-trustee nomination", date: "2026-06-01", done: false },
    ],
    status: "Minor Distribution", avatar: "MR", color: "#00FF94",
  },
  {
    id: 4, name: "Olivia Shrack", relation: "Daughter", dob: "2007-04-18", age: 18,
    entities: ["Whitmore Dynasty Trust"],
    totalDistributions: 180_000, ytdDistributions: 48_000,
    projectedInheritance: 510_000_000,
    milestones: [
      { label: "Age 18 education fund access", date: "2025-04-18", done: true },
      { label: "Age 25 distribution ($5M)", date: "2032-04-18", done: false },
      { label: "Trust co-trustee eligibility", date: "2037-04-18", done: false },
    ],
    status: "Education Fund", avatar: "OR", color: "#A855F7",
  },
  {
    id: 5, name: "Whitmore Foundation", relation: "Charitable Beneficiary", dob: "—", age: 0,
    entities: ["Whitmore Family Foundation"],
    totalDistributions: 12_400_000, ytdDistributions: 3_200_000,
    projectedInheritance: null,
    milestones: [
      { label: "5% annual distribution minimum", date: "Annual", done: true },
      { label: "Foundation Board Meeting Q2", date: "2026-06-15", done: false },
    ],
    status: "Active", avatar: "WF", color: "#FF8C00",
  },
];

export const lifestyleData = {
  annualBudget: 18_400_000,
  ytdSpend: 4_820_000,
  properties: [
    {
      id: 1, name: "Carmel, IN — Primary Residence", flag: "🏠", monthlyBudget: 280_000,
      categories: {
        staffing: 85_000, utilities: 12_000, maintenance: 28_000,
        security: 18_000, food: 15_000, misc: 22_000,
      },
    },
    {
      id: 2, name: "432 Park Ave, NYC", flag: "🗽", monthlyBudget: 145_000,
      categories: {
        staffing: 40_000, utilities: 18_000, maintenance: 35_000,
        security: 22_000, food: 8_000, misc: 22_000,
      },
    },
    {
      id: 3, name: "Mayfair, London", flag: "🇬🇧", monthlyBudget: 220_000,
      categories: {
        staffing: 65_000, utilities: 25_000, maintenance: 55_000,
        security: 30_000, food: 12_000, misc: 33_000,
      },
    },
  ],
  discretionary: {
    privateAviation: { annual: 3_200_000, ytd: 840_000 },
    yachting: { annual: 1_800_000, ytd: 0 },
    art: { annual: 2_400_000, ytd: 1_200_000 },
    travel: { annual: 1_200_000, ytd: 320_000 },
    philanthropy: { annual: 3_600_000, ytd: 900_000 },
    education: { annual: 480_000, ytd: 120_000 },
  },
  monthlyHistory: [
    { month: "Oct '25", spend: 1_420_000 },
    { month: "Nov '25", spend: 1_680_000 },
    { month: "Dec '25", spend: 2_840_000 },
    { month: "Jan '26", spend: 1_240_000 },
    { month: "Feb '26", spend: 1_180_000 },
    { month: "Mar '26", spend: 1_560_000 },
  ],
};

export const staffDirectory = [
  { id: 1, name: "Sarah Chen", title: "Lead Wealth Advisor", firm: "Kincaid Health", category: "Advisory", phone: "+1 312 555 0142", email: "s.chen@invst.com", since: "2019", avatar: "SC", color: "#00A8FF", linkedin: true },
  { id: 2, name: "Jennifer Walsh", title: "Alternative Investments Director", firm: "Kincaid Health", category: "Advisory", phone: "+1 312 555 0189", email: "j.walsh@invst.com", since: "2020", avatar: "JW", color: "#00A8FF", linkedin: true },
  { id: 3, name: "Michael Torres", title: "Tax & Structuring", firm: "Kincaid Health", category: "Advisory", phone: "+1 312 555 0156", email: "m.torres@invst.com", since: "2021", avatar: "MT", color: "#00A8FF", linkedin: true },
  { id: 4, name: "Robert Kim", title: "FX & Derivatives", firm: "Kincaid Health", category: "Advisory", phone: "+1 312 555 0203", email: "r.kim@invst.com", since: "2022", avatar: "RK", color: "#00A8FF", linkedin: true },
  { id: 5, name: "James Chen", title: "Trust & Estate Partner", firm: "Sullivan & Cromwell LLP", category: "Legal", phone: "+1 212 558 4000", email: "j.chen@sullcrom.com", since: "2018", avatar: "JC", color: "#A855F7", linkedin: true },
  { id: 6, name: "Patricia Moore", title: "Tax Partner", firm: "Deloitte Private", category: "Tax", phone: "+1 312 486 5000", email: "p.moore@deloitte.com", since: "2017", avatar: "PM", color: "#FFB800", linkedin: true },
  { id: 7, name: "David Hughes", title: "Family Office COO", firm: "Shrack Family Office", category: "Family Office", phone: "+1 317 555 0188", email: "d.hughes@shrackfamilyoffice.com", since: "2020", avatar: "DH", color: "#00FF94", linkedin: false },
  { id: 8, name: "Linda Park", title: "Executive Assistant / CFO", firm: "Shrack Family Office", category: "Family Office", phone: "+1 317 555 0192", email: "l.park@shrackfamilyoffice.com", since: "2021", avatar: "LP", color: "#00FF94", linkedin: false },
  { id: 9, name: "Thomas Barrett", title: "Estate Attorney", firm: "Baker McKenzie", category: "Legal", phone: "+1 312 861 8000", email: "t.barrett@bakermckenzie.com", since: "2023", avatar: "TB", color: "#A855F7", linkedin: true },
  { id: 10, name: "Angela Wu", title: "Art Advisor", firm: "Christie's Private Sales", category: "Specialist", phone: "+1 212 636 2000", email: "a.wu@christies.com", since: "2022", avatar: "AW", color: "#FF8C00", linkedin: true },
  { id: 11, name: "Mark Donovan", title: "Head of Security", firm: "Shrack Family Office", category: "Family Office", phone: "+1 317 555 0200", email: "m.donovan@shrackfamilyoffice.com", since: "2019", avatar: "MD", color: "#00FF94", linkedin: false },
  { id: 12, name: "Claire Fontaine", title: "Private Aviation Coordinator", firm: "NetJets", category: "Specialist", phone: "+1 614 239 0000", email: "c.fontaine@netjets.com", since: "2020", avatar: "CF", color: "#FF8C00", linkedin: false },
];

export const keyDates = [
  { id: 1, date: "2026-03-15", title: "Q1 2026 Estimated Tax Payment", category: "Tax", priority: "High", description: "Federal and Indiana state Q1 estimated tax payment due — coordinate with Deloitte", daysUntil: 9 },
  { id: 2, date: "2026-04-01", title: "Shrack GRAT I Annuity Payment", category: "Trust", priority: "High", description: "Annual annuity payment from GRAT I to Jeremiah Shrack — zeroing out final payment 2026", daysUntil: 26 },
  { id: 3, date: "2026-04-15", title: "Individual Tax Return Due", category: "Tax", priority: "High", description: "Form 1040 / Indiana IT-40 — Deloitte preparing, extension possible", daysUntil: 40 },
  { id: 4, date: "2026-05-31", title: "Whitmore Foundation 990-PF Filing", category: "Compliance", priority: "Medium", description: "Annual private foundation tax return — 5% distribution minimum must be met", daysUntil: 86 },
  { id: 5, date: "2026-06-01", title: "Asia HoldCo Annual Renewal", category: "Compliance", priority: "Medium", description: "Singapore entity renewal — ACRA filing, director resolutions", daysUntil: 87 },
  { id: 6, date: "2026-06-15", title: "Foundation Board Meeting Q2", category: "Governance", priority: "Medium", description: "Whitmore Family Foundation board meeting — Q2 grant approvals, investment committee review", daysUntil: 101 },
  { id: 7, date: "2026-08-01", title: "GRAT Zero-Out Date", category: "Trust", priority: "Critical", description: "Shrack GRAT I zeroes out — all remaining appreciation passes to Whitmore Dynasty Trust tax-free. Estimated $18M transferred.", daysUntil: 147 },
  { id: 8, date: "2026-09-15", title: "Q3 2026 Estimated Tax Payment", category: "Tax", priority: "High", description: "Federal and state Q3 estimated tax payment — review YTD gains for accuracy", daysUntil: 193 },
  { id: 9, date: "2026-10-01", title: "Whitmore Dynasty Trust 8th Anniversary", category: "Trust", priority: "Low", description: "Annual trustee review meeting — confirm investment policy statement, beneficiary reports", daysUntil: 209 },
  { id: 10, date: "2026-11-05", title: "Mason Kincaid — Age 22", category: "Beneficiary", priority: "Low", description: "Mason turns 22 — review co-trustee nomination timeline (eligible at 25)", daysUntil: 244 },
  { id: 11, date: "2026-12-31", title: "Annual Gift Tax Exclusion Deadline", category: "Tax", priority: "High", description: "Final day for $19,000/person annual exclusion gifts — confirm transfers to Mason & Olivia", daysUntil: 300 },
  { id: 12, date: "2027-02-01", title: "Shrack Ventures LLC K-1 Distribution", category: "Compliance", priority: "Medium", description: "K-1 forms due from fund managers — needed for tax return preparation", daysUntil: 332 },
];

export const insurancePolicies = [
  { id: 1, type: "Life Insurance", carrier: "Northwestern Mutual", insured: "Jeremiah Shrack", coverageAmount: 50_000_000, premiumAnnual: 1_240_000, deductible: 0, expiry: "2044-01-01", status: "Active", notes: "Whole life, $50M death benefit, split-dollar arrangement with Whitmore Trust", color: "#00A8FF" },
  { id: 2, type: "Life Insurance", carrier: "Pacific Life", insured: "Jeremiah Shrack", coverageAmount: 25_000_000, premiumAnnual: 580_000, deductible: 0, expiry: "2034-06-01", status: "Active", notes: "Term policy — 10yr, converts at expiry", color: "#00A8FF" },
  { id: 3, type: "Umbrella / Excess Liability", carrier: "Chubb", insured: "Kincaid Family", coverageAmount: 100_000_000, premiumAnnual: 120_000, deductible: 25_000, expiry: "2027-01-15", status: "Active", notes: "$100M excess liability above all underlying policies", color: "#00FF94" },
  { id: 4, type: "Property — Primary Residence", carrier: "Chubb Masterpiece", insured: "Carmel IN", coverageAmount: 28_000_000, premiumAnnual: 84_000, deductible: 50_000, expiry: "2027-03-01", status: "Active", notes: "Replacement cost coverage, scheduled personal property rider", color: "#FFB800" },
  { id: 5, type: "Property — NYC Penthouse", carrier: "Chubb Masterpiece", insured: "432 Park Ave", coverageAmount: 95_000_000, premiumAnnual: 285_000, deductible: 250_000, expiry: "2027-03-01", status: "Active", notes: "All-risk, market value coverage, separate art rider excluded", color: "#FFB800" },
  { id: 6, type: "Property — London", carrier: "Lloyd's of London", insured: "Mayfair Estate", coverageAmount: 42_000_000, premiumAnnual: 168_000, deductible: 100_000, expiry: "2027-06-01", status: "Active", notes: "Listed building insurance — specialized historic property cover", color: "#FFB800" },
  { id: 7, type: "Fine Art & Collectibles", carrier: "AXA Art", insured: "Art Collection", coverageAmount: 80_000_000, premiumAnnual: 320_000, deductible: 0, expiry: "2027-02-01", status: "Active", notes: "Scheduled 847 works, worldwide transit cover, zero deductible", color: "#A855F7" },
  { id: 8, type: "Cyber Liability", carrier: "Beazley", insured: "Family Office", coverageAmount: 10_000_000, premiumAnnual: 48_000, deductible: 100_000, expiry: "2027-01-01", status: "Active", notes: "Family office cyber — social engineering, wire fraud, ransomware", color: "#FF4D6D" },
  { id: 9, type: "D&O — Foundation", carrier: "AIG", insured: "Whitmore Foundation", coverageAmount: 10_000_000, premiumAnnual: 18_000, deductible: 25_000, expiry: "2027-03-01", status: "Active", notes: "Directors & Officers for private foundation board members", color: "#FF8C00" },
  { id: 10, type: "Aviation", carrier: "Global Aerospace", insured: "NetJets (shared ownership)", coverageAmount: 75_000_000, premiumAnnual: 240_000, deductible: 0, expiry: "2027-01-01", status: "Active", notes: "Fractional ownership liability — hull & liability combined", color: "#00E5FF" },
];

export const successionData = {
  heirs: [
    {
      id: 1, name: "Mason Kincaid", relation: "Son", dob: "2004-11-05", age: 21, avatar: "MR", color: "#00FF94",
      readinessScore: 68,
      readinessAreas: [
        { area: "Financial Literacy", score: 80, notes: "Enrolled Wharton undergrad, finance major" },
        { area: "Trust Understanding", score: 70, notes: "Annual trustee education sessions since age 18" },
        { area: "Investment Knowledge", score: 65, notes: "Mentored by Sarah Chen — quarterly portfolio reviews" },
        { area: "Governance Experience", score: 40, notes: "Not yet on any board — foundation observer role 2027" },
        { area: "Legal / Tax Literacy", score: 55, notes: "Intro estate planning sessions with James Chen" },
        { area: "Leadership / Decision-making", score: 75, notes: "Campus investment club president" },
      ],
      trusteeEligibility: "2029-11-05",
      nominatedTrustee: ["Whitmore Dynasty Trust"],
      ownershipTransfer: [
        { entity: "Shrack Ventures LLC", pct: 25, scheduledYear: 2034 },
        { entity: "Whitmore Dynasty Trust", pct: 50, scheduledYear: 2044 },
      ],
      nextMilestone: "Age 25 trust distribution ($5M) — Nov 2029",
    },
    {
      id: 2, name: "Olivia Shrack", relation: "Daughter", dob: "2007-04-18", age: 18, avatar: "OR", color: "#A855F7",
      readinessScore: 42,
      readinessAreas: [
        { area: "Financial Literacy", score: 55, notes: "Starting Stanford — undeclared major" },
        { area: "Trust Understanding", score: 40, notes: "Basic trust education begun age 16" },
        { area: "Investment Knowledge", score: 35, notes: "Portfolio review sessions to begin 2026" },
        { area: "Governance Experience", score: 20, notes: "Too early — targeted for foundation board at age 22" },
        { area: "Legal / Tax Literacy", score: 30, notes: "Initial introduction scheduled Q3 2026" },
        { area: "Leadership / Decision-making", score: 70, notes: "Student government president, strong interpersonal skills" },
      ],
      trusteeEligibility: "2032-04-18",
      nominatedTrustee: ["Whitmore Dynasty Trust", "Whitmore Foundation"],
      ownershipTransfer: [
        { entity: "Shrack Ventures LLC", pct: 25, scheduledYear: 2037 },
        { entity: "Whitmore Dynasty Trust", pct: 50, scheduledYear: 2047 },
      ],
      nextMilestone: "Age 25 trust distribution ($5M) — Apr 2032",
    },
  ],
  successionRoadmap: [
    { year: 2026, event: "GRAT I zeroes out — $18M+ passes to Dynasty Trust", status: "upcoming", critical: true },
    { year: 2027, event: "Mason joins Foundation as Observer", status: "planned", critical: false },
    { year: 2029, event: "Mason age 25 — first $5M distribution, trustee eligibility", status: "planned", critical: true },
    { year: 2030, event: "Olivia joins Foundation Board", status: "planned", critical: false },
    { year: 2032, event: "Olivia age 25 — first $5M distribution", status: "planned", critical: true },
    { year: 2034, event: "Mason takes 25% of Shrack Ventures LLC", status: "planned", critical: false },
    { year: 2044, event: "Mason becomes 50% beneficiary of Dynasty Trust", status: "planned", critical: true },
  ],
};

export const foundationData = {
  name: "Whitmore Family Foundation",
  ein: "82-4501XXX",
  founded: 2014,
  aum: 120_000_000,
  ytdGrants: 4_200_000,
  ytdInvestmentReturn: 8.4,
  minimumDistribution: 6_000_000,
  remainingToDistribute: 1_800_000,
  focusAreas: ["Education", "Healthcare", "Community Development", "Arts & Culture"],
  grants: [
    { id: 1, recipient: "Riley Children's Hospital", area: "Healthcare", amount: 1_500_000, date: "2026-02-15", status: "Paid", impact: "Pediatric oncology wing expansion — 40 new beds", multi_year: true },
    { id: 2, recipient: "Indiana University Foundation", area: "Education", amount: 800_000, date: "2026-01-10", status: "Paid", impact: "Kincaid Scholar Program — 20 annual scholarships", multi_year: true },
    { id: 3, recipient: "Newfields Museum of Art", area: "Arts & Culture", amount: 500_000, date: "2026-03-01", status: "Paid", impact: "Contemporary wing renovation", multi_year: false },
    { id: 4, recipient: "Carmel Clay Schools Foundation", area: "Education", amount: 400_000, date: "2026-03-15", status: "Paid", impact: "STEM lab equipment — 12 schools", multi_year: false },
    { id: 5, recipient: "Second Helpings Indianapolis", area: "Community Development", amount: 250_000, date: "2026-04-01", status: "Approved", impact: "Food rescue operations expansion", multi_year: false },
    { id: 6, recipient: "Indiana Tech Workforce Initiative", area: "Education", amount: 600_000, date: "2026-06-01", status: "Pending", impact: "Coding bootcamp scholarships — 200 students", multi_year: true },
    { id: 7, recipient: "IU Health — Mental Health", area: "Healthcare", amount: 400_000, date: "2026-06-15", status: "Pending", impact: "Community mental health clinics", multi_year: false },
    { id: 8, recipient: "Arts for Learning Indiana", area: "Arts & Culture", amount: 150_000, date: "2026-07-01", status: "Pending", impact: "Arts integration in 50 Title I schools", multi_year: false },
  ],
  grantHistory: [
    { year: 2014, total: 480_000 },
    { year: 2015, total: 820_000 },
    { year: 2016, total: 1_200_000 },
    { year: 2017, total: 1_850_000 },
    { year: 2018, total: 2_400_000 },
    { year: 2019, total: 3_100_000 },
    { year: 2020, total: 4_200_000 },
    { year: 2021, total: 5_600_000 },
    { year: 2022, total: 6_800_000 },
    { year: 2023, total: 7_200_000 },
    { year: 2024, total: 8_400_000 },
    { year: 2025, total: 9_100_000 },
  ],
  impactMetrics: [
    { label: "Total Granted Since 2014", value: "$51.2M" },
    { label: "Grants Made", value: "184" },
    { label: "Students Supported", value: "12,400+" },
    { label: "Patients Impacted", value: "84,000+" },
    { label: "Partner Organizations", value: "67" },
    { label: "5-Yr Endowment Growth", value: "+124%" },
  ],
};

export const capitalCallsData = {
  totalCommitted: 1_020_000_000,
  totalCalled: 742_000_000,
  totalUncalled: 278_000_000,
  totalNAV: 1_380_000_000,
  totalDistributions: 312_000_000,
  funds: [
    { id: 1, name: "KKR Americas XII", type: "Buyout", vintage: 2021, committed: 150_000_000, called: 118_000_000, uncalled: 32_000_000, nav: 187_000_000, distributions: 12_000_000, dpi: 0.10, tvpi: 1.68, irr: 24.2, currency: "USD", manager: "KKR", color: "#00A8FF" },
    { id: 2, name: "Blackstone Real Estate IX", type: "Real Estate", vintage: 2020, committed: 120_000_000, called: 96_000_000, uncalled: 24_000_000, nav: 154_000_000, distributions: 28_000_000, dpi: 0.29, tvpi: 1.90, irr: 18.7, currency: "USD", manager: "Blackstone", color: "#00FF94" },
    { id: 3, name: "Apollo Global Buyout VIII", type: "Buyout", vintage: 2022, committed: 100_000_000, called: 62_000_000, uncalled: 38_000_000, nav: 89_000_000, distributions: 0, dpi: 0.00, tvpi: 1.44, irr: 31.2, currency: "USD", manager: "Apollo", color: "#FFB800" },
    { id: 4, name: "Sequoia Capital XVIII", type: "Venture", vintage: 2021, committed: 75_000_000, called: 52_000_000, uncalled: 23_000_000, nav: 142_000_000, distributions: 18_000_000, dpi: 0.35, tvpi: 3.08, irr: 44.8, currency: "USD", manager: "Sequoia", color: "#A855F7" },
    { id: 5, name: "a16z Crypto Fund II", type: "Venture", vintage: 2022, committed: 50_000_000, called: 38_000_000, uncalled: 12_000_000, nav: 67_000_000, distributions: 0, dpi: 0.00, tvpi: 1.76, irr: 28.4, currency: "USD", manager: "a16z", color: "#FF8C00" },
    { id: 6, name: "Khosla Ventures VIII", type: "Venture", vintage: 2023, committed: 40_000_000, called: 18_000_000, uncalled: 22_000_000, nav: 22_000_000, distributions: 0, dpi: 0.00, tvpi: 1.22, irr: 19.1, currency: "USD", manager: "Khosla", color: "#00E5FF" },
    { id: 7, name: "Apollo Global Credit", type: "Private Credit", vintage: 2022, committed: 80_000_000, called: 72_000_000, uncalled: 8_000_000, nav: 88_000_000, distributions: 42_000_000, dpi: 0.58, tvpi: 1.81, irr: 14.2, currency: "USD", manager: "Apollo Credit", color: "#FF4D6D" },
    { id: 8, name: "Helios Energy Partners III", type: "Infrastructure", vintage: 2020, committed: 60_000_000, called: 55_000_000, uncalled: 5_000_000, nav: 74_000_000, distributions: 22_000_000, dpi: 0.40, tvpi: 1.75, irr: 16.8, currency: "USD", manager: "Helios Energy", color: "#00FF94" },
    { id: 9, name: "Carlyle Europe V", type: "Buyout", vintage: 2023, committed: 90_000_000, called: 41_000_000, uncalled: 49_000_000, nav: 48_000_000, distributions: 0, dpi: 0.00, tvpi: 1.17, irr: 14.3, currency: "EUR", manager: "Carlyle", color: "#00A8FF" },
    { id: 10, name: "Tiger Global Private XVI", type: "Venture", vintage: 2021, committed: 55_000_000, called: 55_000_000, uncalled: 0, nav: 44_000_000, distributions: 18_000_000, dpi: 0.33, tvpi: 1.13, irr: 4.8, currency: "USD", manager: "Tiger Global", color: "#A855F7" },
    { id: 11, name: "Pimco Income Fund", type: "Private Credit", vintage: 2021, committed: 40_000_000, called: 40_000_000, uncalled: 0, nav: 43_000_000, distributions: 8_000_000, dpi: 0.20, tvpi: 1.28, irr: 9.2, currency: "USD", manager: "Pimco", color: "#FFB800" },
    { id: 12, name: "NovaCare Health Systems", type: "Growth Equity", vintage: 2022, committed: 30_000_000, called: 25_000_000, uncalled: 5_000_000, nav: 38_000_000, distributions: 0, dpi: 0.00, tvpi: 1.52, irr: 22.6, currency: "USD", manager: "General Atlantic", color: "#FF8C00" },
  ],
  upcomingCalls: [
    { id: 1, fund: "Apollo Global Buyout VIII", expectedDate: "2026-04-15", estimatedAmount: 12_000_000, callNumber: 4, notes: "Q2 2026 deployment — 3 portfolio co. add-ons" },
    { id: 2, fund: "Carlyle Europe V", expectedDate: "2026-05-01", estimatedAmount: 18_000_000, callNumber: 3, notes: "German mid-market buyout closing" },
    { id: 3, fund: "Khosla Ventures VIII", expectedDate: "2026-05-20", estimatedAmount: 8_000_000, callNumber: 3, notes: "Series B/C follow-ons — 4 companies" },
    { id: 4, fund: "Carlyle Europe V", expectedDate: "2026-07-15", estimatedAmount: 22_000_000, callNumber: 4, notes: "2nd platform acquisition — Benelux" },
    { id: 5, fund: "Apollo Global Buyout VIII", expectedDate: "2026-09-01", estimatedAmount: 15_000_000, callNumber: 5, notes: "Estimated — pending deal sourcing" },
  ],
  distributions: [
    { id: 1, fund: "Sequoia Capital XVIII", date: "2026-02-28", amount: 8_400_000, type: "Partial Return", notes: "Secondary sale — 2 portfolio companies" },
    { id: 2, fund: "KKR Americas XII", date: "2026-01-31", amount: 6_200_000, type: "DPI Distribution", notes: "Operating company dividend recap" },
    { id: 3, fund: "Blackstone Real Estate IX", date: "2025-12-15", amount: 12_800_000, type: "Property Sale", notes: "Class A office divestiture — Atlanta" },
    { id: 4, fund: "Apollo Global Credit", date: "2025-12-31", amount: 5_400_000, type: "Income Distribution", notes: "Q4 2025 interest income" },
    { id: 5, fund: "Helios Energy Partners III", date: "2025-11-30", amount: 4_200_000, type: "Income Distribution", notes: "Q3/Q4 project revenue" },
  ],
};

export const alternativesMapData = {
  byVintage: [
    { year: 2019, value: 42_000_000, count: 1 },
    { year: 2020, value: 250_000_000, count: 2 },
    { year: 2021, value: 554_000_000, count: 3 },
    { year: 2022, value: 295_000_000, count: 4 },
    { year: 2023, value: 130_000_000, count: 2 },
  ],
  bySector: [
    { sector: "Technology", value: 340_000_000, pct: 28.5, color: "#00A8FF" },
    { sector: "Real Estate", value: 275_000_000, pct: 23.1, color: "#FFB800" },
    { sector: "Healthcare", value: 145_000_000, pct: 12.2, color: "#00FF94" },
    { sector: "Energy / Infra", value: 130_000_000, pct: 10.9, color: "#FF8C00" },
    { sector: "Consumer", value: 110_000_000, pct: 9.2, color: "#A855F7" },
    { sector: "Financial", value: 95_000_000, pct: 8.0, color: "#FF4D6D" },
    { sector: "Crypto / Digital", value: 95_000_000, pct: 8.0, color: "#00E5FF" },
  ],
  byGeography: [
    { region: "North America", value: 720_000_000, pct: 60.5, color: "#00A8FF" },
    { region: "Europe", value: 215_000_000, pct: 18.1, color: "#00FF94" },
    { region: "Asia-Pacific", value: 148_000_000, pct: 12.4, color: "#FFB800" },
    { region: "Global / Multi", value: 108_000_000, pct: 9.1, color: "#A855F7" },
  ],
  byStrategy: [
    { strategy: "Buyout", value: 340_000_000, pct: 28.6, color: "#00A8FF" },
    { strategy: "Venture Capital", value: 220_000_000, pct: 18.5, color: "#A855F7" },
    { strategy: "Real Estate", value: 215_000_000, pct: 18.1, color: "#FFB800" },
    { strategy: "Private Credit", value: 180_000_000, pct: 15.1, color: "#00FF94" },
    { strategy: "Hedge Funds", value: 125_000_000, pct: 10.5, color: "#FF8C00" },
    { strategy: "Infrastructure", value: 110_000_000, pct: 9.2, color: "#00E5FF" },
  ],
  deploymentCurve: [
    { quarter: "Q1 '22", committed: 200_000_000, deployed: 42_000_000 },
    { quarter: "Q2 '22", committed: 380_000_000, deployed: 118_000_000 },
    { quarter: "Q3 '22", committed: 560_000_000, deployed: 220_000_000 },
    { quarter: "Q4 '22", committed: 720_000_000, deployed: 340_000_000 },
    { quarter: "Q1 '23", committed: 820_000_000, deployed: 440_000_000 },
    { quarter: "Q2 '23", committed: 920_000_000, deployed: 540_000_000 },
    { quarter: "Q3 '23", committed: 960_000_000, deployed: 622_000_000 },
    { quarter: "Q4 '23", committed: 980_000_000, deployed: 680_000_000 },
    { quarter: "Q1 '24", committed: 1_000_000_000, deployed: 710_000_000 },
    { quarter: "Q2 '24", committed: 1_010_000_000, deployed: 726_000_000 },
    { quarter: "Q3 '24", committed: 1_015_000_000, deployed: 736_000_000 },
    { quarter: "Q4 '24", committed: 1_020_000_000, deployed: 742_000_000 },
  ],
};

export const educationData = {
  children: [
    {
      id: 1, name: "Mason Kincaid", age: 21, avatar: "MR", color: "#00FF94",
      school: "University of Pennsylvania (Wharton)", major: "Finance",
      enrolledYear: 2022, gradYear: 2026, yearsRemaining: 1,
      plan529: { balance: 1_840_000, contributions2025: 19_000, ytdGrowth: 8.4, institution: "Vanguard 529 IN", originalContributions: 1_200_000 },
      annualCost: { tuition: 62_400, room: 12_800, fees: 4_200, books: 2_000, living: 28_000, total: 109_400 },
      totalCostRemaining: 109_400,
      gradSchoolPlan: { planned: true, school: "Harvard Business School (MBA)", estimatedCost: 165_000, startYear: 2027, years: 2 },
    },
    {
      id: 2, name: "Olivia Shrack", age: 18, avatar: "OR", color: "#A855F7",
      school: "Stanford University", major: "TBD (Undeclared)",
      enrolledYear: 2025, gradYear: 2029, yearsRemaining: 4,
      plan529: { balance: 2_240_000, contributions2025: 19_000, ytdGrowth: 8.4, institution: "Vanguard 529 CA", originalContributions: 1_400_000 },
      annualCost: { tuition: 64_500, room: 19_800, fees: 3_800, books: 1_800, living: 32_000, total: 121_900 },
      totalCostRemaining: 487_600,
      gradSchoolPlan: { planned: false, school: "", estimatedCost: 0, startYear: 0, years: 0 },
    },
  ],
  giftingStrategy: {
    annualExclusion: 19_000,
    superfunding: { available: true, maxAmount: 95_000, description: "5-year gift tax election — $95K per child, per parent" },
    ytdGifts: 38_000,
    totalGiftedToDate: 2_600_000,
  },
  historicalContributions: [
    { year: 2015, mason: 30_000, olivia: 30_000 },
    { year: 2016, mason: 30_000, olivia: 30_000 },
    { year: 2017, mason: 32_000, olivia: 32_000 },
    { year: 2018, mason: 32_000, olivia: 32_000 },
    { year: 2019, mason: 34_000, olivia: 34_000 },
    { year: 2020, mason: 34_000, olivia: 34_000 },
    { year: 2021, mason: 36_000, olivia: 36_000 },
    { year: 2022, mason: 36_000, olivia: 36_000 },
    { year: 2023, mason: 38_000, olivia: 38_000 },
    { year: 2024, mason: 38_000, olivia: 38_000 },
    { year: 2025, mason: 19_000, olivia: 19_000 },
  ],
};

export const taxPackageData = {
  taxYear: 2025,
  filingStatus: "Married Filing Jointly",
  preparer: "Patricia Moore — Deloitte Private",
  status: "In Progress",
  agi: 42_800_000,
  taxableIncome: 38_200_000,
  totalTaxFederal: 15_480_000,
  totalTaxState: 2_240_000,
  effectiveRateFederal: 36.2,
  effectiveRateAll: 41.5,
  estimatedPayments: 14_200_000,
  balanceDue: 3_520_000,
  income: [
    { type: "W-2 / Compensation", amount: 1_200_000, yoy: +8.2 },
    { type: "Qualified Dividends", amount: 4_800_000, yoy: +14.1 },
    { type: "Ordinary Dividends", amount: 1_240_000, yoy: +6.8 },
    { type: "Long-Term Capital Gains", amount: 18_400_000, yoy: +32.4 },
    { type: "Short-Term Capital Gains", amount: 2_840_000, yoy: -18.2 },
    { type: "Partnership / K-1 Income", amount: 8_200_000, yoy: +21.6 },
    { type: "Rental / Real Estate Income", amount: 3_900_000, yoy: +4.3 },
    { type: "Interest Income", amount: 1_880_000, yoy: +28.4 },
    { type: "Trust Distributions", amount: 340_000, yoy: +2.1 },
  ],
  deductions: [
    { type: "State & Local Taxes (SALT cap)", amount: 10_000, notes: "$10K federal cap applies" },
    { type: "Charitable Contributions", amount: 3_600_000, notes: "Cash + appreciated securities" },
    { type: "Investment Interest Expense", amount: 420_000, notes: "Margin interest — securities" },
    { type: "Other Itemized", amount: 180_000, notes: "Misc deductible items" },
  ],
  k1Status: [
    { fund: "KKR Americas XII", type: "Partnership K-1", status: "Received", date: "2026-02-14", ordinaryIncome: 1_240_000, capitalGains: 380_000 },
    { fund: "Blackstone RE IX", type: "Partnership K-1", status: "Received", date: "2026-02-28", ordinaryIncome: 820_000, capitalGains: 0 },
    { fund: "Apollo Buyout VIII", type: "Partnership K-1", status: "Received", date: "2026-03-01", ordinaryIncome: 640_000, capitalGains: 120_000 },
    { fund: "Sequoia Capital XVIII", type: "Partnership K-1", status: "Pending", date: null, ordinaryIncome: 0, capitalGains: 0 },
    { fund: "a16z Crypto II", type: "Partnership K-1", status: "Pending", date: null, ordinaryIncome: 0, capitalGains: 0 },
    { fund: "Helios Energy Partners", type: "Partnership K-1", status: "Received", date: "2026-02-20", ordinaryIncome: 480_000, capitalGains: 0 },
    { fund: "Carlyle Europe V", type: "Foreign K-1", status: "Pending", date: null, ordinaryIncome: 0, capitalGains: 0 },
    { fund: "Shrack Real Estate LP", type: "Schedule E", status: "Received", date: "2026-02-10", ordinaryIncome: 2_840_000, capitalGains: 0 },
  ],
  priorYear: { agi: 38_200_000, totalTax: 14_800_000, effectiveRate: 38.7 },
};

export const conciergeRequests = [
  { id: 1, category: "Aviation", title: "Arrange NetJets — Carmel to Teterboro (NYC)", status: "In Progress", priority: "High", assignee: "CF (NetJets)", created: "2026-03-05", dueDate: "2026-03-10", notes: "Depart 9am, 4 pax, luggage for 1 week. Return open-ended.", requestor: "Jeremiah Shrack" },
  { id: 2, category: "Property", title: "Mayfair Heating System Annual Service", status: "Open", priority: "Medium", assignee: "DH (Family Office)", created: "2026-03-04", dueDate: "2026-04-01", notes: "Annual boiler inspection due. Contact building manager Alistair Holt.", requestor: "Linda Park" },
  { id: 3, category: "Art", title: "Christie's Appraisal — 3 New Acquisitions", status: "Pending", priority: "Medium", assignee: "AW (Christie's)", created: "2026-03-01", dueDate: "2026-04-15", notes: "Three Basquiat works acquired in Feb need updated insurance appraisal certificates.", requestor: "Jeremiah Shrack" },
  { id: 4, category: "Legal", title: "Review Carlyle Europe V Side Letter", status: "Open", priority: "High", assignee: "JC (Sullivan & Cromwell)", created: "2026-03-03", dueDate: "2026-03-20", notes: "Revised MFN clause — need James Chen to review before signing.", requestor: "David Hughes" },
  { id: 5, category: "Finance", title: "Wire $4.8M to Kincaid Foundation — Q1 Grant", status: "Completed", priority: "Critical", assignee: "LP (Family Office)", created: "2026-02-28", dueDate: "2026-03-01", notes: "Q1 2026 foundation grant distributions — 4 recipients per board approval.", requestor: "David Hughes" },
  { id: 6, category: "Travel", title: "Book Villa Carlotta — Bellagio for July", status: "Open", priority: "Low", assignee: "CF (NetJets)", created: "2026-03-02", dueDate: "2026-04-01", notes: "Family vacation — 2 weeks July. Need 6 bdr minimum. Coordinate with NetJets.", requestor: "Alexandra Kincaid" },
  { id: 7, category: "Property", title: "432 Park Ave — HVAC Compressor Replacement", status: "In Progress", priority: "High", assignee: "DH (Family Office)", created: "2026-02-25", dueDate: "2026-03-15", notes: "Unit 82A HVAC failure — Chubb claim filed ($48K repair). Awaiting adjuster.", requestor: "Linda Park" },
  { id: 8, category: "Medical", title: "Concierge Annual Physical — Jeremiah + Alexandra", status: "Open", priority: "Medium", assignee: "DH (Family Office)", created: "2026-03-01", dueDate: "2026-04-30", notes: "Annual physicals at Cleveland Clinic Executive Health — need scheduling.", requestor: "Jeremiah Shrack" },
  { id: 9, category: "Finance", title: "GRAT Annuity Payment — Verify Q1 Transfer", status: "Completed", priority: "Critical", assignee: "LP (Family Office)", created: "2026-03-01", dueDate: "2026-04-01", notes: "Shrack GRAT I Q1 annuity — confirm $4.2M wire received by trust.", requestor: "David Hughes" },
  { id: 10, category: "Aviation", title: "NetJets Card Replenishment — 50 Hours", status: "Open", priority: "Low", assignee: "CF (NetJets)", created: "2026-03-03", dueDate: "2026-03-31", notes: "Current card at 8 hours remaining. Authorize 50hr top-up.", requestor: "Linda Park" },
];

export const screenerStocks = [
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", marketCap: 3_200_000_000_000, pe: 28.4, pb: 48.2, ps: 8.1, ey: 3.5, divYield: 0.5, beta: 1.21, mom3m: 12.4, mom12m: 28.6, revGrowth: 6.2, epsGrowth: 11.4, roe: 172.1, roa: 22.8, debtEquity: 1.72, currentRatio: 1.04 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", marketCap: 3_100_000_000_000, pe: 34.2, pb: 12.8, ps: 13.4, ey: 2.9, divYield: 0.7, beta: 0.89, mom3m: 8.1, mom12m: 22.3, revGrowth: 17.6, epsGrowth: 20.8, roe: 38.8, roa: 16.2, debtEquity: 0.42, currentRatio: 1.31 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", marketCap: 2_800_000_000_000, pe: 51.2, pb: 38.6, ps: 22.1, ey: 2.0, divYield: 0.1, beta: 1.94, mom3m: 24.8, mom12m: 92.4, revGrowth: 122.4, epsGrowth: 586.2, roe: 91.4, roa: 55.2, debtEquity: 0.44, currentRatio: 4.17 },
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", marketCap: 2_100_000_000_000, pe: 44.8, pb: 9.2, ps: 3.6, ey: 2.2, divYield: 0.0, beta: 1.14, mom3m: 14.2, mom12m: 38.4, revGrowth: 12.4, epsGrowth: 94.6, roe: 21.8, roa: 6.8, debtEquity: 0.68, currentRatio: 1.06 },
  { ticker: "META", name: "Meta Platforms", sector: "Communication Services", marketCap: 1_680_000_000_000, pe: 27.8, pb: 9.4, ps: 9.8, ey: 3.6, divYield: 0.4, beta: 1.42, mom3m: 16.8, mom12m: 64.2, revGrowth: 21.2, epsGrowth: 74.8, roe: 36.2, roa: 18.6, debtEquity: 0.22, currentRatio: 2.68 },
  { ticker: "GOOGL", name: "Alphabet Inc.", sector: "Communication Services", marketCap: 2_200_000_000_000, pe: 22.4, pb: 7.1, ps: 6.8, ey: 4.5, divYield: 0.5, beta: 1.06, mom3m: 10.4, mom12m: 32.8, revGrowth: 14.2, epsGrowth: 31.4, roe: 29.8, roa: 14.2, debtEquity: 0.08, currentRatio: 2.14 },
  { ticker: "BRK.B", name: "Berkshire Hathaway", sector: "Financials", marketCap: 870_000_000_000, pe: 22.1, pb: 1.6, ps: 2.8, ey: 4.5, divYield: 0.0, beta: 0.88, mom3m: 4.2, mom12m: 18.4, revGrowth: 4.8, epsGrowth: 28.4, roe: 7.2, roa: 3.8, debtEquity: 0.24, currentRatio: 1.82 },
  { ticker: "JPM", name: "JPMorgan Chase", sector: "Financials", marketCap: 780_000_000_000, pe: 12.8, pb: 2.2, ps: 4.1, ey: 7.8, divYield: 2.2, beta: 1.08, mom3m: 6.4, mom12m: 24.8, revGrowth: 18.2, epsGrowth: 28.6, roe: 17.2, roa: 1.4, debtEquity: 1.18, currentRatio: 0.94 },
  { ticker: "V", name: "Visa Inc.", sector: "Financials", marketCap: 640_000_000_000, pe: 31.4, pb: 14.8, ps: 15.2, ey: 3.2, divYield: 0.8, beta: 0.92, mom3m: 8.8, mom12m: 22.6, revGrowth: 10.4, epsGrowth: 16.2, roe: 52.4, roa: 18.2, debtEquity: 0.58, currentRatio: 1.62 },
  { ticker: "MA", name: "Mastercard Inc.", sector: "Financials", marketCap: 510_000_000_000, pe: 33.8, pb: 62.4, ps: 16.8, ey: 3.0, divYield: 0.6, beta: 0.96, mom3m: 7.2, mom12m: 24.4, revGrowth: 12.6, epsGrowth: 21.8, roe: 194.2, roa: 24.6, debtEquity: 2.84, currentRatio: 1.24 },
  { ticker: "LLY", name: "Eli Lilly & Co.", sector: "Healthcare", marketCap: 760_000_000_000, pe: 66.4, pb: 48.6, ps: 18.4, ey: 1.5, divYield: 0.7, beta: 0.42, mom3m: -2.4, mom12m: 18.6, revGrowth: 32.4, epsGrowth: 102.4, roe: 78.4, roa: 22.6, debtEquity: 2.18, currentRatio: 1.84 },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", marketCap: 380_000_000_000, pe: 14.8, pb: 6.2, ps: 4.8, ey: 6.8, divYield: 3.1, beta: 0.54, mom3m: -1.8, mom12m: -4.2, revGrowth: 4.2, epsGrowth: 8.6, roe: 42.4, roa: 12.4, debtEquity: 0.62, currentRatio: 1.24 },
  { ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare", marketCap: 490_000_000_000, pe: 19.4, pb: 8.4, ps: 1.4, ey: 5.2, divYield: 1.5, beta: 0.68, mom3m: -8.4, mom12m: -12.4, revGrowth: 8.2, epsGrowth: 10.4, roe: 24.8, roa: 7.2, debtEquity: 0.72, currentRatio: 0.76 },
  { ticker: "ABBV", name: "AbbVie Inc.", sector: "Healthcare", marketCap: 340_000_000_000, pe: 66.2, pb: 62.4, ps: 6.8, ey: 1.5, divYield: 3.4, beta: 0.62, mom3m: 12.4, mom12m: 22.6, revGrowth: 3.4, epsGrowth: -24.8, roe: 262.4, roa: 8.6, debtEquity: 8.24, currentRatio: 0.82 },
  { ticker: "XOM", name: "ExxonMobil Corp.", sector: "Energy", marketCap: 480_000_000_000, pe: 13.4, pb: 2.4, ps: 1.6, ey: 7.5, divYield: 3.6, beta: 0.98, mom3m: 2.4, mom12m: 8.2, revGrowth: -4.8, epsGrowth: -18.4, roe: 18.2, roa: 8.4, debtEquity: 0.22, currentRatio: 1.38 },
  { ticker: "CVX", name: "Chevron Corp.", sector: "Energy", marketCap: 280_000_000_000, pe: 14.2, pb: 1.8, ps: 1.4, ey: 7.0, divYield: 4.2, beta: 1.02, mom3m: 0.8, mom12m: 4.4, revGrowth: -6.2, epsGrowth: -22.6, roe: 12.8, roa: 6.2, debtEquity: 0.18, currentRatio: 1.26 },
  { ticker: "NEE", name: "NextEra Energy", sector: "Utilities", marketCap: 142_000_000_000, pe: 18.4, pb: 3.2, ps: 6.2, ey: 5.4, divYield: 3.2, beta: 0.56, mom3m: 4.8, mom12m: 12.4, revGrowth: 8.4, epsGrowth: 10.2, roe: 12.8, roa: 3.4, debtEquity: 1.24, currentRatio: 0.68 },
  { ticker: "DUK", name: "Duke Energy", sector: "Utilities", marketCap: 78_000_000_000, pe: 17.8, pb: 1.8, ps: 3.4, ey: 5.6, divYield: 4.2, beta: 0.44, mom3m: 2.4, mom12m: 8.8, revGrowth: 4.2, epsGrowth: 6.4, roe: 10.2, roa: 2.8, debtEquity: 1.64, currentRatio: 0.64 },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer Staples", marketCap: 380_000_000_000, pe: 26.4, pb: 10.8, ps: 5.2, ey: 3.8, divYield: 2.4, beta: 0.48, mom3m: 1.4, mom12m: 6.4, revGrowth: 2.8, epsGrowth: 8.2, roe: 42.8, roa: 12.4, debtEquity: 0.68, currentRatio: 0.68 },
  { ticker: "KO", name: "Coca-Cola Co.", sector: "Consumer Staples", marketCap: 256_000_000_000, pe: 22.8, pb: 11.2, ps: 5.8, ey: 4.4, divYield: 3.1, beta: 0.52, mom3m: 3.8, mom12m: 8.4, revGrowth: 3.4, epsGrowth: 4.8, roe: 48.4, roa: 10.8, debtEquity: 1.82, currentRatio: 1.08 },
  { ticker: "WMT", name: "Walmart Inc.", sector: "Consumer Staples", marketCap: 820_000_000_000, pe: 38.4, pb: 10.2, ps: 1.0, ey: 2.6, divYield: 1.0, beta: 0.72, mom3m: 18.4, mom12m: 82.4, revGrowth: 5.6, epsGrowth: 14.8, roe: 25.8, roa: 7.2, debtEquity: 0.84, currentRatio: 0.82 },
  { ticker: "COST", name: "Costco Wholesale", sector: "Consumer Staples", marketCap: 420_000_000_000, pe: 58.4, pb: 18.4, ps: 1.6, ey: 1.7, divYield: 0.6, beta: 0.82, mom3m: 12.4, mom12m: 42.4, revGrowth: 8.4, epsGrowth: 18.4, roe: 32.4, roa: 8.8, debtEquity: 0.42, currentRatio: 0.96 },
  { ticker: "HD", name: "Home Depot", sector: "Consumer Discretionary", marketCap: 370_000_000_000, pe: 22.4, pb: 682.4, ps: 2.6, ey: 4.5, divYield: 2.4, beta: 1.12, mom3m: 8.4, mom12m: 12.4, revGrowth: 4.2, epsGrowth: 2.8, roe: 1242.4, roa: 22.4, debtEquity: 22.4, currentRatio: 1.32 },
  { ticker: "NKE", name: "Nike Inc.", sector: "Consumer Discretionary", marketCap: 88_000_000_000, pe: 22.8, pb: 8.4, ps: 1.8, ey: 4.4, divYield: 2.2, beta: 1.22, mom3m: -12.4, mom12m: -28.4, revGrowth: -1.4, epsGrowth: -28.4, roe: 38.8, roa: 11.4, debtEquity: 0.94, currentRatio: 2.68 },
  { ticker: "BA", name: "Boeing Co.", sector: "Industrials", marketCap: 104_000_000_000, pe: 0, pb: 0, ps: 1.6, ey: 0, divYield: 0.0, beta: 1.48, mom3m: -8.4, mom12m: -14.4, revGrowth: 12.4, epsGrowth: 0, roe: 0, roa: -4.2, debtEquity: 0, currentRatio: 1.02 },
  { ticker: "CAT", name: "Caterpillar Inc.", sector: "Industrials", marketCap: 184_000_000_000, pe: 16.4, pb: 14.8, ps: 2.6, ey: 6.1, divYield: 1.6, beta: 1.18, mom3m: -4.8, mom12m: 4.8, revGrowth: -3.4, epsGrowth: 4.2, roe: 84.2, roa: 10.8, debtEquity: 2.28, currentRatio: 1.34 },
  { ticker: "GE", name: "GE Aerospace", sector: "Industrials", marketCap: 188_000_000_000, pe: 42.4, pb: 18.4, ps: 5.4, ey: 2.4, divYield: 0.8, beta: 1.24, mom3m: 18.4, mom12m: 98.4, revGrowth: 18.4, epsGrowth: 214.4, roe: 44.4, roa: 6.8, debtEquity: 1.24, currentRatio: 1.28 },
  { ticker: "UPS", name: "United Parcel Service", sector: "Industrials", marketCap: 94_000_000_000, pe: 18.4, pb: 8.4, ps: 1.2, ey: 5.4, divYield: 4.8, beta: 1.08, mom3m: -8.4, mom12m: -24.8, revGrowth: -8.4, epsGrowth: -28.4, roe: 46.8, roa: 8.4, debtEquity: 2.08, currentRatio: 1.14 },
  { ticker: "AMT", name: "American Tower", sector: "Real Estate", marketCap: 94_000_000_000, pe: 42.4, pb: 18.4, ps: 8.4, ey: 2.4, divYield: 3.2, beta: 0.82, mom3m: 4.8, mom12m: 8.4, revGrowth: 2.4, epsGrowth: 4.8, roe: 42.8, roa: 5.2, debtEquity: 4.84, currentRatio: 0.62 },
  { ticker: "PLD", name: "Prologis Inc.", sector: "Real Estate", marketCap: 94_000_000_000, pe: 38.8, pb: 2.4, ps: 14.8, ey: 2.6, divYield: 3.4, beta: 0.88, mom3m: -4.8, mom12m: -8.4, revGrowth: 8.4, epsGrowth: 28.4, roe: 6.2, roa: 2.8, debtEquity: 0.68, currentRatio: 0.74 },
  { ticker: "TSM", name: "Taiwan Semiconductor", sector: "Technology", marketCap: 680_000_000_000, pe: 22.8, pb: 6.4, ps: 8.8, ey: 4.4, divYield: 1.4, beta: 1.38, mom3m: 18.4, mom12m: 62.4, revGrowth: 42.4, epsGrowth: 54.4, roe: 28.8, roa: 20.8, debtEquity: 0.28, currentRatio: 1.88 },
  { ticker: "ASML", name: "ASML Holding NV", sector: "Technology", marketCap: 280_000_000_000, pe: 34.8, pb: 14.8, ps: 11.2, ey: 2.9, divYield: 1.0, beta: 1.42, mom3m: -4.4, mom12m: -14.8, revGrowth: -8.4, epsGrowth: -18.4, roe: 42.4, roa: 18.8, debtEquity: 0.44, currentRatio: 1.64 },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology", marketCap: 820_000_000_000, pe: 168.4, pb: 14.8, ps: 14.4, ey: 0.6, divYield: 1.2, beta: 1.28, mom3m: 28.4, mom12m: 48.4, revGrowth: 44.8, epsGrowth: 8.4, roe: 9.8, roa: 3.4, debtEquity: 1.84, currentRatio: 1.28 },
  { ticker: "ORCL", name: "Oracle Corp.", sector: "Technology", marketCap: 480_000_000_000, pe: 34.4, pb: 0, ps: 8.8, ey: 2.9, divYield: 1.0, beta: 0.98, mom3m: 4.8, mom12m: 12.4, revGrowth: 8.8, epsGrowth: 22.8, roe: 0, roa: 8.4, debtEquity: 0, currentRatio: 0.88 },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology", marketCap: 294_000_000_000, pe: 44.4, pb: 4.2, ps: 8.2, ey: 2.3, divYield: 0.5, beta: 1.14, mom3m: -4.4, mom12m: 4.4, revGrowth: 10.2, epsGrowth: 24.8, roe: 9.4, roa: 5.2, debtEquity: 0.22, currentRatio: 1.08 },
  { ticker: "NOW", name: "ServiceNow Inc.", sector: "Technology", marketCap: 224_000_000_000, pe: 148.4, pb: 28.4, ps: 18.4, ey: 0.7, divYield: 0.0, beta: 1.24, mom3m: 12.4, mom12m: 28.4, revGrowth: 22.4, epsGrowth: 44.8, roe: 19.4, roa: 10.8, debtEquity: 0.34, currentRatio: 1.24 },
  { ticker: "ANET", name: "Arista Networks", sector: "Technology", marketCap: 116_000_000_000, pe: 54.4, pb: 18.4, ps: 12.8, ey: 1.8, divYield: 0.0, beta: 1.18, mom3m: 8.4, mom12m: 14.4, revGrowth: 14.4, epsGrowth: 24.4, roe: 34.4, roa: 22.4, debtEquity: 0.04, currentRatio: 4.84 },
  { ticker: "PLTR", name: "Palantir Technologies", sector: "Technology", marketCap: 168_000_000_000, pe: 284.4, pb: 28.4, ps: 28.4, ey: 0.4, divYield: 0.0, beta: 2.24, mom3m: 62.4, mom12m: 324.4, revGrowth: 28.4, epsGrowth: 148.4, roe: 10.2, roa: 6.8, debtEquity: 0.08, currentRatio: 6.24 },
  { ticker: "GS", name: "Goldman Sachs", sector: "Financials", marketCap: 208_000_000_000, pe: 14.4, pb: 1.8, ps: 3.2, ey: 6.9, divYield: 2.4, beta: 1.38, mom3m: 8.4, mom12m: 42.4, revGrowth: 14.4, epsGrowth: 68.4, roe: 12.8, roa: 0.8, debtEquity: 4.24, currentRatio: 0.92 },
  { ticker: "MS", name: "Morgan Stanley", sector: "Financials", marketCap: 194_000_000_000, pe: 16.4, pb: 1.8, ps: 3.4, ey: 6.1, divYield: 3.2, beta: 1.42, mom3m: 12.4, mom12m: 38.4, revGrowth: 22.4, epsGrowth: 44.4, roe: 11.4, roa: 0.6, debtEquity: 3.84, currentRatio: 0.88 },
  { ticker: "BAC", name: "Bank of America", sector: "Financials", marketCap: 348_000_000_000, pe: 14.2, pb: 1.4, ps: 3.2, ey: 7.0, divYield: 2.4, beta: 1.42, mom3m: 6.4, mom12m: 24.4, revGrowth: 4.4, epsGrowth: 8.4, roe: 10.4, roa: 0.8, debtEquity: 1.08, currentRatio: 0.98 },
  { ticker: "WFC", name: "Wells Fargo", sector: "Financials", marketCap: 248_000_000_000, pe: 12.4, pb: 1.4, ps: 2.8, ey: 8.1, divYield: 2.4, beta: 1.24, mom3m: 12.4, mom12m: 42.4, revGrowth: 8.4, epsGrowth: 22.4, roe: 12.4, roa: 1.0, debtEquity: 1.14, currentRatio: 0.94 },
  { ticker: "BLK", name: "BlackRock Inc.", sector: "Financials", marketCap: 158_000_000_000, pe: 22.4, pb: 3.4, ps: 7.4, ey: 4.5, divYield: 2.2, beta: 1.34, mom3m: 14.4, mom12m: 28.4, revGrowth: 18.4, epsGrowth: 22.4, roe: 15.4, roa: 2.2, debtEquity: 0.54, currentRatio: 0.92 },
  { ticker: "SPGI", name: "S&P Global Inc.", sector: "Financials", marketCap: 152_000_000_000, pe: 46.4, pb: 14.8, ps: 12.8, ey: 2.2, divYield: 0.8, beta: 0.94, mom3m: 4.4, mom12m: 12.4, revGrowth: 14.4, epsGrowth: 28.4, roe: 34.4, roa: 12.4, debtEquity: 0.78, currentRatio: 1.08 },
  { ticker: "MCO", name: "Moody's Corp.", sector: "Financials", marketCap: 74_000_000_000, pe: 38.4, pb: 22.4, ps: 10.8, ey: 2.6, divYield: 0.8, beta: 0.98, mom3m: 2.4, mom12m: 8.4, revGrowth: 18.4, epsGrowth: 22.4, roe: 62.4, roa: 14.4, debtEquity: 2.34, currentRatio: 1.14 },
  { ticker: "CMG", name: "Chipotle Mexican Grill", sector: "Consumer Discretionary", marketCap: 78_000_000_000, pe: 44.4, pb: 28.4, ps: 7.8, ey: 2.3, divYield: 0.0, beta: 1.38, mom3m: -8.4, mom12m: 14.4, revGrowth: 14.4, epsGrowth: 24.4, roe: 64.4, roa: 14.4, debtEquity: 0.84, currentRatio: 1.78 },
  { ticker: "TJX", name: "TJX Companies", sector: "Consumer Discretionary", marketCap: 126_000_000_000, pe: 26.4, pb: 14.8, ps: 2.2, ey: 3.8, divYield: 1.4, beta: 0.82, mom3m: 4.4, mom12m: 18.4, revGrowth: 6.4, epsGrowth: 12.4, roe: 62.4, roa: 16.4, debtEquity: 0.88, currentRatio: 1.24 },
  { ticker: "LOW", name: "Lowe's Cos.", sector: "Consumer Discretionary", marketCap: 148_000_000_000, pe: 22.4, pb: 0, ps: 2.0, ey: 4.5, divYield: 2.0, beta: 1.14, mom3m: 4.4, mom12m: 8.4, revGrowth: 2.4, epsGrowth: 8.4, roe: 0, roa: 14.4, debtEquity: 0, currentRatio: 1.18 },
  { ticker: "TSN", name: "Tyson Foods", sector: "Consumer Staples", marketCap: 18_000_000_000, pe: 42.4, pb: 0.8, ps: 0.4, ey: 2.4, divYield: 3.4, beta: 0.64, mom3m: -2.4, mom12m: -8.4, revGrowth: -4.4, epsGrowth: -28.4, roe: 1.8, roa: 0.6, debtEquity: 0.64, currentRatio: 1.48 },
  { ticker: "MRK", name: "Merck & Co.", sector: "Healthcare", marketCap: 264_000_000_000, pe: 14.4, pb: 6.4, ps: 4.2, ey: 6.9, divYield: 3.2, beta: 0.58, mom3m: -12.4, mom12m: -22.4, revGrowth: 4.4, epsGrowth: -18.4, roe: 44.4, roa: 14.4, debtEquity: 0.84, currentRatio: 1.28 },
  { ticker: "PFE", name: "Pfizer Inc.", sector: "Healthcare", marketCap: 144_000_000_000, pe: 18.4, pb: 2.4, ps: 2.8, ey: 5.4, divYield: 6.8, beta: 0.58, mom3m: -4.4, mom12m: -12.4, revGrowth: -41.4, epsGrowth: -84.4, roe: 12.8, roa: 4.2, debtEquity: 0.64, currentRatio: 1.04 },
  { ticker: "AMGN", name: "Amgen Inc.", sector: "Healthcare", marketCap: 154_000_000_000, pe: 18.4, pb: 28.4, ps: 5.4, ey: 5.4, divYield: 3.2, beta: 0.52, mom3m: 4.4, mom12m: -2.4, revGrowth: 22.4, epsGrowth: 14.4, roe: 162.4, roa: 12.4, debtEquity: 5.44, currentRatio: 1.64 },
  { ticker: "REGN", name: "Regeneron Pharma", sector: "Healthcare", marketCap: 94_000_000_000, pe: 22.4, pb: 5.4, ps: 6.4, ey: 4.5, divYield: 0.0, beta: 0.38, mom3m: -4.4, mom12m: -8.4, revGrowth: 8.4, epsGrowth: 14.4, roe: 24.4, roa: 16.4, debtEquity: 0.14, currentRatio: 4.24 },
  { ticker: "SLB", name: "SLB (Schlumberger)", sector: "Energy", marketCap: 58_000_000_000, pe: 14.4, pb: 3.4, ps: 1.6, ey: 6.9, divYield: 2.8, beta: 1.38, mom3m: -8.4, mom12m: -24.4, revGrowth: 12.4, epsGrowth: 22.4, roe: 24.4, roa: 8.4, debtEquity: 0.64, currentRatio: 1.34 },
  { ticker: "OXY", name: "Occidental Petroleum", sector: "Energy", marketCap: 44_000_000_000, pe: 14.4, pb: 2.4, ps: 2.2, ey: 6.9, divYield: 1.8, beta: 1.64, mom3m: -12.4, mom12m: -28.4, revGrowth: -4.4, epsGrowth: -28.4, roe: 16.8, roa: 7.2, debtEquity: 0.72, currentRatio: 0.94 },
  { ticker: "COP", name: "ConocoPhillips", sector: "Energy", marketCap: 124_000_000_000, pe: 12.4, pb: 3.4, ps: 2.4, ey: 8.1, divYield: 3.2, beta: 1.28, mom3m: -4.4, mom12m: -4.4, revGrowth: 8.4, epsGrowth: -4.4, roe: 28.4, roa: 12.4, debtEquity: 0.38, currentRatio: 1.74 },
  { ticker: "DE", name: "Deere & Company", sector: "Industrials", marketCap: 114_000_000_000, pe: 12.4, pb: 5.4, ps: 2.2, ey: 8.1, divYield: 1.6, beta: 0.94, mom3m: -8.4, mom12m: -14.4, revGrowth: -18.4, epsGrowth: -24.4, roe: 44.4, roa: 10.4, debtEquity: 2.14, currentRatio: 1.88 },
  { ticker: "HON", name: "Honeywell Intl.", sector: "Industrials", marketCap: 128_000_000_000, pe: 22.4, pb: 8.4, ps: 3.2, ey: 4.5, divYield: 2.2, beta: 0.98, mom3m: 4.4, mom12m: -2.4, revGrowth: 4.4, epsGrowth: 8.4, roe: 38.4, roa: 10.4, debtEquity: 1.84, currentRatio: 1.28 },
  { ticker: "RTX", name: "RTX Corporation", sector: "Industrials", marketCap: 164_000_000_000, pe: 34.4, pb: 2.8, ps: 2.4, ey: 2.9, divYield: 2.2, beta: 0.88, mom3m: 8.4, mom12m: 28.4, revGrowth: 12.4, epsGrowth: 44.4, roe: 8.4, roa: 3.4, debtEquity: 0.88, currentRatio: 1.04 },
  { ticker: "LMT", name: "Lockheed Martin", sector: "Industrials", marketCap: 108_000_000_000, pe: 16.4, pb: 18.4, ps: 1.8, ey: 6.1, divYield: 2.8, beta: 0.52, mom3m: 8.4, mom12m: 14.4, revGrowth: 4.4, epsGrowth: 8.4, roe: 118.4, roa: 12.4, debtEquity: 4.44, currentRatio: 1.24 },
  { ticker: "NOC", name: "Northrop Grumman", sector: "Industrials", marketCap: 68_000_000_000, pe: 18.4, pb: 8.4, ps: 1.6, ey: 5.4, divYield: 1.8, beta: 0.48, mom3m: 4.4, mom12m: 8.4, revGrowth: 8.4, epsGrowth: 12.4, roe: 46.4, roa: 8.4, debtEquity: 2.44, currentRatio: 1.16 },
  { ticker: "SPG", name: "Simon Property Group", sector: "Real Estate", marketCap: 56_000_000_000, pe: 22.4, pb: 14.4, ps: 7.8, ey: 4.5, divYield: 5.2, beta: 1.38, mom3m: 4.4, mom12m: 14.4, revGrowth: 4.4, epsGrowth: 8.4, roe: 62.4, roa: 6.4, debtEquity: 8.84, currentRatio: 0.48 },
  { ticker: "O", name: "Realty Income Corp.", sector: "Real Estate", marketCap: 48_000_000_000, pe: 38.4, pb: 1.6, ps: 10.4, ey: 2.6, divYield: 5.8, beta: 0.78, mom3m: 2.4, mom12m: 4.4, revGrowth: 28.4, epsGrowth: -4.4, roe: 4.2, roa: 2.4, debtEquity: 1.04, currentRatio: 0.34 },
  { ticker: "DLR", name: "Digital Realty Trust", sector: "Real Estate", marketCap: 54_000_000_000, pe: 124.4, pb: 2.6, ps: 7.4, ey: 0.8, divYield: 3.4, beta: 0.68, mom3m: 4.4, mom12m: 8.4, revGrowth: 14.4, epsGrowth: 4.4, roe: 2.1, roa: 0.8, debtEquity: 1.14, currentRatio: 0.44 },
  { ticker: "EQIX", name: "Equinix Inc.", sector: "Real Estate", marketCap: 78_000_000_000, pe: 98.4, pb: 8.4, ps: 9.4, ey: 1.0, divYield: 2.0, beta: 0.72, mom3m: 8.4, mom12m: 12.4, revGrowth: 8.4, epsGrowth: 2.4, roe: 8.4, roa: 2.4, debtEquity: 2.14, currentRatio: 1.44 },
  { ticker: "NET", name: "Cloudflare Inc.", sector: "Technology", marketCap: 34_000_000_000, pe: 0, pb: 28.4, ps: 24.4, ey: 0, divYield: 0.0, beta: 2.44, mom3m: -4.4, mom12m: 8.4, revGrowth: 28.4, epsGrowth: 0, roe: 0, roa: -4.4, debtEquity: 4.44, currentRatio: 3.44 },
  { ticker: "SNOW", name: "Snowflake Inc.", sector: "Technology", marketCap: 44_000_000_000, pe: 0, pb: 6.4, ps: 14.4, ey: 0, divYield: 0.0, beta: 1.84, mom3m: -4.4, mom12m: -28.4, revGrowth: 28.4, epsGrowth: 0, roe: -14.4, roa: -8.4, debtEquity: 0.24, currentRatio: 2.88 },
  { ticker: "UBER", name: "Uber Technologies", sector: "Technology", marketCap: 158_000_000_000, pe: 28.4, pb: 12.4, ps: 4.8, ey: 3.5, divYield: 0.0, beta: 1.64, mom3m: -8.4, mom12m: 28.4, revGrowth: 18.4, epsGrowth: 0, roe: 44.4, roa: 8.4, debtEquity: 0.64, currentRatio: 1.24 },
  { ticker: "SPOT", name: "Spotify Technology", sector: "Communication Services", marketCap: 76_000_000_000, pe: 108.4, pb: 24.4, ps: 6.4, ey: 0.9, divYield: 0.0, beta: 1.88, mom3m: 28.4, mom12m: 82.4, revGrowth: 18.4, epsGrowth: 0, roe: 22.4, roa: 8.4, debtEquity: 0.44, currentRatio: 1.84 },
  { ticker: "ABNB", name: "Airbnb Inc.", sector: "Consumer Discretionary", marketCap: 88_000_000_000, pe: 22.4, pb: 8.4, ps: 8.4, ey: 4.5, divYield: 0.0, beta: 1.64, mom3m: -4.4, mom12m: 4.4, revGrowth: 12.4, epsGrowth: 14.4, roe: 38.4, roa: 12.4, debtEquity: 0.28, currentRatio: 2.24 },
  { ticker: "DIS", name: "Walt Disney Co.", sector: "Communication Services", marketCap: 184_000_000_000, pe: 42.4, pb: 2.4, ps: 2.6, ey: 2.4, divYield: 0.8, beta: 1.22, mom3m: 4.4, mom12m: 14.4, revGrowth: 4.4, epsGrowth: 84.4, roe: 5.6, roa: 2.4, debtEquity: 0.48, currentRatio: 0.92 },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Communication Services", marketCap: 398_000_000_000, pe: 48.4, pb: 18.4, ps: 9.8, ey: 2.1, divYield: 0.0, beta: 1.44, mom3m: 8.4, mom12m: 48.4, revGrowth: 16.4, epsGrowth: 74.4, roe: 38.4, roa: 14.4, debtEquity: 0.88, currentRatio: 1.22 },
];

function genOHLC(base: number, count: number) {
  const result = [];
  let price = base;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    const change = (Math.random() - 0.48) * price * 0.025;
    const open = price;
    const close = +(price + change).toFixed(2);
    const high = +(Math.max(open, close) * (1 + Math.random() * 0.015)).toFixed(2);
    const low = +(Math.min(open, close) * (1 - Math.random() * 0.015)).toFixed(2);
    result.push({ t: now - i * 86400000, o: +open.toFixed(2), h: high, l: low, c: close, v: Math.floor(Math.random() * 80_000_000 + 20_000_000) });
    price = close;
  }
  return result;
}

export const mockCandleData: Record<string, { ticker: string; candles: { t: number; o: number; h: number; l: number; c: number; v: number }[] }> = {
  AAPL: { ticker: "AAPL", candles: genOHLC(178, 252) },
  NVDA: { ticker: "NVDA", candles: genOHLC(480, 252) },
  MSFT: { ticker: "MSFT", candles: genOHLC(388, 252) },
  TSLA: { ticker: "TSLA", candles: genOHLC(245, 252) },
  AMZN: { ticker: "AMZN", candles: genOHLC(178, 252) },
  SPY: { ticker: "SPY", candles: genOHLC(478, 252) },
  QQQ: { ticker: "QQQ", candles: genOHLC(412, 252) },
  GLD: { ticker: "GLD", candles: genOHLC(218, 252) },
  TLT: { ticker: "TLT", candles: genOHLC(92, 252) },
};

function genOptionsChain(spotPrice: number, ticker: string) {
  const strikes = [-15, -10, -5, -2.5, 0, 2.5, 5, 10, 15, 20].map(d => Math.round((spotPrice * (1 + d / 100)) / 5) * 5);
  return strikes.map((strike, i) => {
    const moneyness = (strike - spotPrice) / spotPrice;
    const iv = 0.28 + Math.abs(moneyness) * 1.2 - moneyness * 0.15;
    const callDelta = Math.max(0.02, Math.min(0.98, 0.5 - moneyness * 3));
    const putDelta = callDelta - 1;
    const gamma = 0.04 * Math.exp(-moneyness * moneyness * 50);
    const theta = -(spotPrice * iv * gamma * 0.5) / 365;
    const vega = spotPrice * gamma * iv * 10;
    const callPremium = +(Math.max(0, spotPrice - strike) + spotPrice * iv * 0.18 * callDelta).toFixed(2);
    const putPremium = +(Math.max(0, strike - spotPrice) + spotPrice * iv * 0.18 * Math.abs(putDelta)).toFixed(2);
    return {
      strike,
      callBid: +(callPremium * 0.97).toFixed(2), callAsk: +(callPremium * 1.03).toFixed(2), callLast: callPremium,
      callIV: +(iv * 100).toFixed(1), callDelta: +callDelta.toFixed(3), callGamma: +gamma.toFixed(4),
      callTheta: +theta.toFixed(3), callVega: +vega.toFixed(3),
      callOI: Math.floor(Math.random() * 50000 + 1000), callVolume: Math.floor(Math.random() * 20000 + 200),
      putBid: +(putPremium * 0.97).toFixed(2), putAsk: +(putPremium * 1.03).toFixed(2), putLast: putPremium,
      putIV: +(iv * 100 + 2).toFixed(1), putDelta: +putDelta.toFixed(3), putGamma: +gamma.toFixed(4),
      putTheta: +(theta * 1.05).toFixed(3), putVega: +vega.toFixed(3),
      putOI: Math.floor(Math.random() * 40000 + 800), putVolume: Math.floor(Math.random() * 15000 + 100),
      isATM: i === 4,
    };
  });
}

export const optionsData: Record<string, { spot: number; calls_puts: ReturnType<typeof genOptionsChain> }> = {
  AAPL: { spot: 213.5, calls_puts: genOptionsChain(213.5, "AAPL") },
  NVDA: { spot: 874.2, calls_puts: genOptionsChain(874.2, "NVDA") },
  MSFT: { spot: 418.6, calls_puts: genOptionsChain(418.6, "MSFT") },
  TSLA: { spot: 248.4, calls_puts: genOptionsChain(248.4, "TSLA") },
  AMZN: { spot: 184.2, calls_puts: genOptionsChain(184.2, "AMZN") },
};

function genMonthly(startVal: number, count: number, trend: number, volatility: number) {
  const now = new Date("2026-03-01");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (count - 1 - i));
    const val = startVal + trend * i + (Math.random() - 0.5) * volatility;
    return { date: d.toISOString().slice(0, 7), value: +val.toFixed(2) };
  });
}

function genQuarterly(startVal: number, count: number, trend: number, volatility: number) {
  const quarters = ["Q1 '23","Q2 '23","Q3 '23","Q4 '23","Q1 '24","Q2 '24","Q3 '24","Q4 '24","Q1 '25","Q2 '25","Q3 '25","Q4 '25","Q1 '26"];
  return Array.from({ length: count }, (_, i) => ({
    quarter: quarters[quarters.length - count + i] || `Q${i}`,
    value: +(startVal + trend * i + (Math.random() - 0.5) * volatility).toFixed(2),
  }));
}

export const economicIndicators = {
  gdp: genQuarterly(2.1, 9, 0.08, 0.6),
  cpi: genMonthly(6.4, 24, -0.15, 0.2),
  coreCpi: genMonthly(5.8, 24, -0.12, 0.18),
  pce: genMonthly(5.4, 24, -0.12, 0.15),
  unemployment: genMonthly(3.4, 24, 0.03, 0.1),
  nfp: Array.from({ length: 24 }, (_, i) => {
    const d = new Date("2026-03-01"); d.setMonth(d.getMonth() - 23 + i);
    return { date: d.toISOString().slice(0,7), value: Math.floor(100 + Math.random() * 200 - 20 * Math.max(0, i - 18)) };
  }),
  fedFunds: genMonthly(4.5, 24, -0.01, 0.05),
  yields: {
    current: { "3M": 5.28, "2Y": 4.71, "5Y": 4.48, "10Y": 4.62, "30Y": 4.84 },
    oneYearAgo: { "3M": 5.42, "2Y": 4.98, "5Y": 4.44, "10Y": 4.18, "30Y": 4.38 },
    spread2s10s: genMonthly(-0.48, 24, 0.04, 0.12),
  },
  fomc: [
    { date: "2026-03-19", decision: "Hold", probability: { cut: 12, hold: 81, hike: 7 } },
    { date: "2026-05-07", decision: "Cut", probability: { cut: 44, hold: 52, hike: 4 } },
    { date: "2026-06-18", decision: "Cut", probability: { cut: 62, hold: 36, hike: 2 } },
    { date: "2026-07-30", decision: "Cut", probability: { cut: 68, hold: 30, hike: 2 } },
  ],
  recessionProb: 24,
  current: { gdpGrowth: 2.3, cpi: 2.8, corePce: 2.6, unemployment: 4.1, nfpLatest: 186_000, fedFundsRate: "4.25-4.50%" },
};

export const commoditiesData = [
  { id: "WTI", name: "WTI Crude Oil", sector: "Energy", unit: "bbl", spot: 71.42, d1: -0.84, w1: -2.14, m1: -4.22, ytd: -8.44, fwd1m: 71.18, fwd3m: 70.84, fwd6m: 70.22, fwd12m: 69.48, color: "#FF6B35" },
  { id: "BRENT", name: "Brent Crude Oil", sector: "Energy", unit: "bbl", spot: 75.28, d1: -0.62, w1: -1.88, m1: -3.84, ytd: -7.24, fwd1m: 74.94, fwd3m: 74.42, fwd6m: 73.68, fwd12m: 72.84, color: "#FF8C42" },
  { id: "NG", name: "Natural Gas", sector: "Energy", unit: "MMBtu", spot: 3.84, d1: 2.14, w1: 8.42, m1: 18.44, ytd: 28.84, fwd1m: 3.92, fwd3m: 4.18, fwd6m: 4.42, fwd12m: 3.84, color: "#FFB347" },
  { id: "RBOB", name: "RBOB Gasoline", sector: "Energy", unit: "gal", spot: 2.24, d1: -0.44, w1: -1.24, m1: -2.84, ytd: -4.44, fwd1m: 2.21, fwd3m: 2.18, fwd6m: 2.14, fwd12m: 2.08, color: "#FFC857" },
  { id: "GOLD", name: "Gold", sector: "Metals", unit: "oz", spot: 2942.80, d1: 0.44, w1: 1.84, m1: 6.44, ytd: 12.84, fwd1m: 2952, fwd3m: 2968, fwd6m: 2988, fwd12m: 3020, color: "#FFD700" },
  { id: "SILVER", name: "Silver", sector: "Metals", unit: "oz", spot: 33.42, d1: 0.88, w1: 2.44, m1: 8.44, ytd: 14.84, fwd1m: 33.68, fwd3m: 34.14, fwd6m: 34.88, fwd12m: 35.42, color: "#C0C0C0" },
  { id: "COPPER", name: "Copper", sector: "Metals", unit: "lb", spot: 4.48, d1: 0.22, w1: 0.84, m1: 4.44, ytd: 8.84, fwd1m: 4.52, fwd3m: 4.58, fwd6m: 4.64, fwd12m: 4.72, color: "#B87333" },
  { id: "PLATINUM", name: "Platinum", sector: "Metals", unit: "oz", spot: 984.40, d1: -0.84, w1: -1.44, m1: 2.44, ytd: -4.84, fwd1m: 986, fwd3m: 990, fwd6m: 996, fwd12m: 1008, color: "#E5E4E2" },
  { id: "PALLADIUM", name: "Palladium", sector: "Metals", unit: "oz", spot: 988.20, d1: -1.24, w1: -4.44, m1: -8.44, ytd: -18.84, fwd1m: 985, fwd3m: 980, fwd6m: 974, fwd12m: 968, color: "#CED1D4" },
  { id: "WHEAT", name: "Wheat", sector: "Agriculture", unit: "bu", spot: 548.40, d1: 0.84, w1: 2.44, m1: 4.84, ytd: 8.44, fwd1m: 550, fwd3m: 554, fwd6m: 558, fwd12m: 562, color: "#F5DEB3" },
  { id: "CORN", name: "Corn", sector: "Agriculture", unit: "bu", spot: 464.80, d1: 0.44, w1: 1.24, m1: 2.84, ytd: 4.44, fwd1m: 466, fwd3m: 468, fwd6m: 470, fwd12m: 472, color: "#FFEF82" },
  { id: "SOYBEAN", name: "Soybeans", sector: "Agriculture", unit: "bu", spot: 1024.40, d1: -0.24, w1: -0.84, m1: -2.44, ytd: -4.84, fwd1m: 1022, fwd3m: 1018, fwd6m: 1014, fwd12m: 1010, color: "#8DB600" },
  { id: "COFFEE", name: "Coffee", sector: "Agriculture", unit: "lb", spot: 312.40, d1: 2.44, w1: 8.44, m1: 18.44, ytd: 42.84, fwd1m: 314, fwd3m: 318, fwd6m: 322, fwd12m: 328, color: "#6F4E37" },
  { id: "SUGAR", name: "Sugar #11", sector: "Agriculture", unit: "lb", spot: 19.84, d1: -0.44, w1: -1.84, m1: -4.44, ytd: -8.84, fwd1m: 19.72, fwd3m: 19.54, fwd6m: 19.28, fwd12m: 18.98, color: "#FFFDD0" },
];

function genCommodityHistory(basePrice: number, count: number) {
  const result = [];
  let price = basePrice * 0.82;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    price = +(price * (1 + (Math.random() - 0.47) * 0.02)).toFixed(2);
    result.push({ t: now - i * 86400000, price });
  }
  return result;
}

export const commodityHistory: Record<string, { t: number; price: number }[]> = Object.fromEntries(
  commoditiesData.map(c => [c.id, genCommodityHistory(c.spot, 365)])
);

export const earningsData = [
  { ticker: "NVDA", name: "NVIDIA Corp.", reportDate: "2026-02-26", time: "AMC", epsEst: 5.58, epsActual: 5.78, revEst: 38200, revActual: 39331, surprise: +0.20, surprisePct: +3.6, reaction: +4.8, quarter: "Q4 FY2026", status: "Reported" },
  { ticker: "AAPL", name: "Apple Inc.", reportDate: "2026-01-30", time: "AMC", epsEst: 2.34, epsActual: 2.40, revEst: 124100, revActual: 124984, surprise: +0.06, surprisePct: +2.6, reaction: +2.8, quarter: "Q1 FY2026", status: "Reported" },
  { ticker: "MSFT", name: "Microsoft Corp.", reportDate: "2026-01-29", time: "AMC", epsEst: 3.11, epsActual: 3.23, revEst: 68800, revActual: 69632, surprise: +0.12, surprisePct: +3.9, reaction: +3.2, quarter: "Q2 FY2026", status: "Reported" },
  { ticker: "META", name: "Meta Platforms", reportDate: "2026-01-29", time: "AMC", epsEst: 6.72, epsActual: 8.02, revEst: 47100, revActual: 48389, surprise: +1.30, surprisePct: +19.3, reaction: +8.4, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "AMZN", name: "Amazon.com Inc.", reportDate: "2026-02-06", time: "AMC", epsEst: 1.48, epsActual: 1.86, revEst: 188100, revActual: 187791, surprise: +0.38, surprisePct: +25.7, reaction: -1.4, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "GOOGL", name: "Alphabet Inc.", reportDate: "2026-02-04", time: "AMC", epsEst: 2.12, epsActual: 2.15, revEst: 96400, revActual: 96469, surprise: +0.03, surprisePct: +1.4, reaction: +4.2, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "JPM", name: "JPMorgan Chase", reportDate: "2026-01-15", time: "BMO", epsEst: 4.09, epsActual: 4.81, revEst: 41900, revActual: 43736, surprise: +0.72, surprisePct: +17.6, reaction: +2.4, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "GS", name: "Goldman Sachs", reportDate: "2026-01-15", time: "BMO", epsEst: 8.22, epsActual: 11.95, revEst: 12600, revActual: 13874, surprise: +3.73, surprisePct: +45.4, reaction: +6.8, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "AVGO", name: "Broadcom Inc.", reportDate: "2026-03-06", time: "AMC", epsEst: 1.48, epsActual: 1.60, revEst: 14600, revActual: 14916, surprise: +0.12, surprisePct: +8.1, reaction: +5.2, quarter: "Q1 FY2026", status: "Reported" },
  { ticker: "COST", name: "Costco Wholesale", reportDate: "2026-03-06", time: "AMC", epsEst: 4.10, epsActual: 4.02, revEst: 64100, revActual: 63721, surprise: -0.08, surprisePct: -2.0, reaction: -2.4, quarter: "Q2 FY2026", status: "Reported" },
  { ticker: "WMT", name: "Walmart Inc.", reportDate: "2026-02-20", time: "BMO", epsEst: 0.64, epsActual: 0.66, revEst: 178400, revActual: 180555, surprise: +0.02, surprisePct: +3.1, reaction: +4.8, quarter: "Q4 FY2026", status: "Reported" },
  { ticker: "LLY", name: "Eli Lilly & Co.", reportDate: "2026-02-12", time: "BMO", epsEst: 4.90, epsActual: 5.32, revEst: 13500, revActual: 13530, surprise: +0.42, surprisePct: +8.6, reaction: -8.4, quarter: "Q4 FY2025", status: "Reported" },
  { ticker: "ORCL", name: "Oracle Corp.", reportDate: "2026-03-11", time: "AMC", epsEst: 1.47, epsActual: null, revEst: 14400, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q3 FY2026", status: "Upcoming" },
  { ticker: "ADBE", name: "Adobe Inc.", reportDate: "2026-03-12", time: "AMC", epsEst: 4.96, epsActual: null, revEst: 5700, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "FDX", name: "FedEx Corp.", reportDate: "2026-03-18", time: "AMC", epsEst: 4.82, epsActual: null, revEst: 22100, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q3 FY2026", status: "Upcoming" },
  { ticker: "NKE", name: "Nike Inc.", reportDate: "2026-03-20", time: "AMC", epsEst: 0.29, epsActual: null, revEst: 11100, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q3 FY2026", status: "Upcoming" },
  { ticker: "MU", name: "Micron Technology", reportDate: "2026-03-20", time: "AMC", epsEst: 1.44, epsActual: null, revEst: 8800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q2 FY2026", status: "Upcoming" },
  { ticker: "PAYX", name: "Paychex Inc.", reportDate: "2026-03-26", time: "BMO", epsEst: 1.22, epsActual: null, revEst: 1380, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q3 FY2026", status: "Upcoming" },
  { ticker: "WBA", name: "Walgreens Boots", reportDate: "2026-04-01", time: "BMO", epsEst: 0.38, epsActual: null, revEst: 38400, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q2 FY2026", status: "Upcoming" },
  { ticker: "DAL", name: "Delta Air Lines", reportDate: "2026-04-09", time: "BMO", epsEst: 0.36, epsActual: null, revEst: 13800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "JPM", name: "JPMorgan Chase", reportDate: "2026-04-11", time: "BMO", epsEst: 4.62, epsActual: null, revEst: 43800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "BAC", name: "Bank of America", reportDate: "2026-04-15", time: "BMO", epsEst: 0.84, epsActual: null, revEst: 26800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "NFLX", name: "Netflix Inc.", reportDate: "2026-04-15", time: "AMC", epsEst: 5.58, epsActual: null, revEst: 10500, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "TSLA", name: "Tesla Inc.", reportDate: "2026-04-22", time: "AMC", epsEst: 0.42, epsActual: null, revEst: 23800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "META", name: "Meta Platforms", reportDate: "2026-04-29", time: "AMC", epsEst: 6.84, epsActual: null, revEst: 41800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "MSFT", name: "Microsoft Corp.", reportDate: "2026-04-29", time: "AMC", epsEst: 3.22, epsActual: null, revEst: 71400, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q3 FY2026", status: "Upcoming" },
  { ticker: "GOOGL", name: "Alphabet Inc.", reportDate: "2026-04-30", time: "AMC", epsEst: 2.21, epsActual: null, revEst: 89400, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
  { ticker: "AAPL", name: "Apple Inc.", reportDate: "2026-05-01", time: "AMC", epsEst: 1.62, epsActual: null, revEst: 94800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q2 FY2026", status: "Upcoming" },
  { ticker: "AMZN", name: "Amazon.com Inc.", reportDate: "2026-05-01", time: "AMC", epsEst: 1.62, epsActual: null, revEst: 155800, revActual: null, surprise: null, surprisePct: null, reaction: null, quarter: "Q1 FY2026", status: "Upcoming" },
];

function genSpreadHistory(base: number, count: number, trend: number) {
  const result = [];
  let val = base * 0.78;
  const now = Date.now();
  for (let i = count; i >= 0; i--) {
    val = +(val + trend + (Math.random() - 0.5) * base * 0.04).toFixed(1);
    val = Math.max(base * 0.5, Math.min(base * 1.8, val));
    result.push({ t: now - i * 86400000 * 7, value: val });
  }
  return result;
}

export const creditData = {
  current: { igOas: 87, hyOas: 312, cdxIg: 58, cdxHy: 315 },
  change1d: { igOas: +2, hyOas: +8, cdxIg: +1, cdxHy: +7 },
  change1w: { igOas: -3, hyOas: -14, cdxIg: -2, cdxHy: -12 },
  igHistory: genSpreadHistory(87, 52, 0.2),
  hyHistory: genSpreadHistory(312, 52, 0.8),
  cdxIgHistory: genSpreadHistory(58, 52, 0.1),
  cdxHyHistory: genSpreadHistory(315, 52, 0.9),
  sectorMatrix: [
    { sector: "Technology",      igOas: 72,  hyOas: 268 },
    { sector: "Financials",      igOas: 84,  hyOas: 312 },
    { sector: "Energy",          igOas: 98,  hyOas: 348 },
    { sector: "Healthcare",      igOas: 78,  hyOas: 288 },
    { sector: "Consumer",        igOas: 94,  hyOas: 334 },
    { sector: "Industrials",     igOas: 88,  hyOas: 318 },
    { sector: "Utilities",       igOas: 104, hyOas: 384 },
    { sector: "Real Estate",     igOas: 118, hyOas: 412 },
  ],
  kylesBook: [
    { name: "Helios Energy Sr Secured",    sector: "Energy",      spread: 424, rating: "B+", maturity: "2028-06", notional: 28_400_000 },
    { name: "MedTech Capital II",          sector: "Healthcare",  spread: 388, rating: "BB-", maturity: "2027-09", notional: 18_200_000 },
    { name: "Apex Retail Senior",          sector: "Consumer",    spread: 498, rating: "B",  maturity: "2029-03", notional: 12_800_000 },
    { name: "TechBridge Mezz",             sector: "Technology",  spread: 612, rating: "CCC+", maturity: "2027-12", notional: 9_400_000 },
    { name: "Ridgeline RE Credit",         sector: "Real Estate", spread: 348, rating: "BB", maturity: "2028-12", notional: 22_600_000 },
    { name: "US Industrial Logistics",     sector: "Industrials", spread: 284, rating: "BBB-", maturity: "2030-06", notional: 32_800_000 },
    { name: "AgriFund Senior Secured",     sector: "Consumer",    spread: 384, rating: "BB+", maturity: "2027-06", notional: 8_400_000 },
  ],
  watchlist: [
    { name: "Apex Retail Senior", currentRating: "B", potentialAction: "Downgrade", rationale: "Deteriorating same-store sales, covenant pressure" },
    { name: "TechBridge Mezz", currentRating: "CCC+", potentialAction: "Upgrade Watch", rationale: "Potential strategic sale of subsidiary at premium" },
    { name: "US Industrial Logistics", currentRating: "BBB-", potentialAction: "Rising Star", rationale: "Strong free cash flow, deleveraging ahead of schedule" },
  ],
};

export const factorData = {
  exposures: [
    { factor: "Market Beta",  exposure: 1.08, benchmark: 1.00, active: +0.08, contribution: 4.12 },
    { factor: "Value",        exposure: 0.24, benchmark: 0.18, active: +0.06, contribution: 0.84 },
    { factor: "Growth",       exposure: 0.62, benchmark: 0.42, active: +0.20, contribution: 2.44 },
    { factor: "Momentum",     exposure: 0.44, benchmark: 0.28, active: +0.16, contribution: 1.88 },
    { factor: "Quality",      exposure: 0.72, benchmark: 0.54, active: +0.18, contribution: 1.24 },
    { factor: "Low Vol",      exposure: -0.18, benchmark: 0.22, active: -0.40, contribution: -0.62 },
    { factor: "Liquidity",    exposure: 0.38, benchmark: 0.44, active: -0.06, contribution: -0.24 },
  ],
  attribution: [
    { name: "Public Equity Alpha", value: 4.84 },
    { name: "Private Equity Premium", value: 3.22 },
    { name: "Real Estate Yield", value: 2.18 },
    { name: "VC/Growth Exposure", value: 1.84 },
    { name: "Hedge Fund Overlay", value: 0.94 },
    { name: "Credit Carry", value: 0.84 },
    { name: "Currency Effect", value: 0.44 },
    { name: "Cash Drag", value: -0.24 },
    { name: "Fees & Costs", value: -0.36 },
  ],
  sectorWeights: [
    { sector: "Technology",             portfolio: 28.4, benchmark: 32.2, active: -3.8 },
    { sector: "Financials",             portfolio: 14.8, benchmark: 12.8, active: +2.0 },
    { sector: "Healthcare",             portfolio: 10.4, benchmark: 12.4, active: -2.0 },
    { sector: "Consumer Discretionary", portfolio: 8.4, benchmark: 10.8, active: -2.4 },
    { sector: "Industrials",            portfolio: 7.4, benchmark: 8.4, active: -1.0 },
    { sector: "Energy",                 portfolio: 6.2, benchmark: 4.4, active: +1.8 },
    { sector: "Communication Services", portfolio: 8.8, benchmark: 8.8, active: 0.0 },
    { sector: "Real Estate",            portfolio: 4.2, benchmark: 2.4, active: +1.8 },
    { sector: "Utilities",              portfolio: 2.4, benchmark: 2.4, active: 0.0 },
    { sector: "Materials",              portfolio: 2.8, benchmark: 2.8, active: 0.0 },
    { sector: "Staples",                portfolio: 6.2, benchmark: 6.6, active: -0.4 },
  ],
  styleBox: { valueWeight: 0.22, growthWeight: 0.62, blendWeight: 0.16, smallCapWeight: 0.04, midCapWeight: 0.18, largeCapWeight: 0.78 },
  riskDecomp: { systematic: 68, idiosyncratic: 32 },
  rollingExposures: Array.from({ length: 12 }, (_, i) => {
    const d = new Date("2026-03-01"); d.setMonth(d.getMonth() - 11 + i);
    return {
      date: d.toISOString().slice(0,7),
      market: +(1.08 + (Math.random() - 0.5) * 0.12).toFixed(3),
      growth: +(0.62 + (Math.random() - 0.5) * 0.1).toFixed(3),
      momentum: +(0.44 + (Math.random() - 0.5) * 0.14).toFixed(3),
    };
  }),
};

export const volatilityData = {
  vix: { spot: 18.4, m1: 19.2, m3: 20.1, m6: 20.8, y1: 21.4, vvix: 94.2, vxn: 22.4, rvx: 24.8 },
  termStructure: [
    { label: "Spot", value: 18.4 },
    { label: "1M", value: 19.2 },
    { label: "3M", value: 20.1 },
    { label: "6M", value: 20.8 },
    { label: "1Y", value: 21.4 },
  ],
  historical: [
    { period: "20D HV", spx: 14.2, aapl: 22.4, nvda: 48.4 },
    { period: "60D HV", spx: 16.8, aapl: 24.8, nvda: 52.4 },
    { period: "90D HV", spx: 18.4, aapl: 26.4, nvda: 54.8 },
    { period: "180D HV", spx: 19.2, aapl: 28.4, nvda: 58.4 },
    { period: "1Y IV", spx: 21.4, aapl: 28.8, nvda: 62.4 },
  ],
  skew: [
    { moneyness: "80%", iv: 38.4 },
    { moneyness: "85%", iv: 32.8 },
    { moneyness: "90%", iv: 28.4 },
    { moneyness: "95%", iv: 24.2 },
    { moneyness: "97.5%", iv: 22.4 },
    { moneyness: "ATM", iv: 20.8 },
    { moneyness: "102.5%", iv: 21.4 },
    { moneyness: "105%", iv: 22.8 },
    { moneyness: "110%", iv: 24.8 },
    { moneyness: "115%", iv: 27.2 },
  ],
  portfolioContrib: [
    { asset: "NVDA (8.4%)",  vol: 52.4, contrib: 2.84 },
    { asset: "AAPL (12.4%)", vol: 24.8, contrib: 1.84 },
    { asset: "MSFT (9.8%)",  vol: 22.4, contrib: 1.42 },
    { asset: "Private Eq.",  vol: 18.4, contrib: 2.24 },
    { asset: "Real Estate",  vol: 14.4, contrib: 1.68 },
    { asset: "Hedge Funds",  vol: 12.4, contrib: 0.94 },
    { asset: "Private Cred", vol: 8.4,  contrib: 0.64 },
    { asset: "Cash/T-bills", vol: 1.4,  contrib: 0.08 },
  ],
  vixHistory: Array.from({ length: 52 }, (_, i) => {
    const d = new Date("2026-03-01"); d.setDate(d.getDate() - (51 - i) * 7);
    return { t: d.getTime(), value: +(14 + Math.random() * 12 + Math.sin(i * 0.4) * 4).toFixed(2) };
  }),
};

export function formatCurrency(value: number, compact = true): string {
  if (compact) {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}
