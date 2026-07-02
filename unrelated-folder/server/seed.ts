import { storage } from "./storage";

const INDIANA_CITIES: Record<string, { cities: string[]; label: string }> = {
  indianapolis: { cities: ["Indianapolis", "Carmel", "Fishers", "Noblesville", "Greenwood", "Zionsville", "Westfield", "Brownsburg", "Avon", "Plainfield"], label: "Indianapolis Metro" },
  fortwayne: { cities: ["Fort Wayne", "New Haven", "Huntington", "Warsaw", "Auburn", "Columbia City"], label: "Fort Wayne" },
  southbend: { cities: ["South Bend", "Elkhart", "Mishawaka", "Goshen", "Granger"], label: "South Bend / Elkhart" },
  northwest: { cities: ["Gary", "Hammond", "Merrillville", "Valparaiso", "Crown Point", "Michigan City"], label: "NW Indiana" },
  evansville: { cities: ["Evansville", "Newburgh", "Jasper", "Tell City", "Princeton"], label: "Evansville" },
  terrehaute: { cities: ["Terre Haute", "Brazil", "Clinton", "Sullivan"], label: "Terre Haute" },
  bloomington: { cities: ["Bloomington", "Bedford", "Columbus", "Seymour"], label: "Bloomington" },
  lafayette: { cities: ["Lafayette", "West Lafayette", "Kokomo", "Logansport", "Frankfort"], label: "Lafayette / Purdue" },
};

const INDUSTRIES = [
  { name: "Manufacturing", naics: "33", weight: 25 },
  { name: "Healthcare", naics: "62", weight: 18 },
  { name: "Transportation", naics: "48", weight: 12 },
  { name: "Professional Services", naics: "54", weight: 12 },
  { name: "Construction", naics: "23", weight: 8 },
  { name: "Education", naics: "61", weight: 6 },
  { name: "Finance", naics: "52", weight: 6 },
  { name: "Retail", naics: "44", weight: 5 },
  { name: "Nonprofit", naics: "81", weight: 4 },
  { name: "Food Service", naics: "72", weight: 4 },
];

const CARRIERS = [
  "Anthem BCBS", "UnitedHealthcare", "Aetna", "Cigna", "Humana",
  "CareSource", "MDwise", "IU Health Plans", "PHP", "Trilogy Health",
];

const COMPANY_PREFIXES = [
  "Hoosier", "Indiana", "Crossroads", "Heritage", "Circle City", "Midwest",
  "Great Lakes", "Wabash", "Prairie", "Heartland", "Liberty", "Eagle",
  "Summit", "Keystone", "Buckeye", "Cardinal", "Pinnacle", "Atlas",
  "Premier", "Catalyst", "Horizon", "Legacy", "Vanguard", "Sterling",
];

const COMPANY_SUFFIXES: Record<string, string[]> = {
  Manufacturing: ["Manufacturing", "Industries", "Precision", "Metalworks", "Components", "Fabrication", "Assembly", "Tool & Die"],
  Healthcare: ["Health System", "Medical Group", "Healthcare", "Clinic Network", "Physicians", "Home Health"],
  Transportation: ["Logistics", "Transport", "Freight", "Distribution", "Trucking", "Shipping"],
  "Professional Services": ["Consulting", "Solutions", "Advisors", "Group", "Partners", "Associates"],
  Construction: ["Construction", "Builders", "Contractors", "Infrastructure", "Excavation"],
  Education: ["Academy", "Schools", "Learning Center", "Institute", "Education Group"],
  Finance: ["Financial", "Banking Group", "Credit Union", "Investments", "Capital"],
  Retail: ["Retail Group", "Auto Group", "Supply Co.", "Stores", "Mart"],
  Nonprofit: ["Foundation", "Community Services", "Mission", "Outreach", "Coalition"],
  "Food Service": ["Foods", "Restaurant Group", "Catering", "Hospitality", "Food Service"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genEIN(): string {
  return `${randInt(10, 99)}-${randInt(1000000, 9999999)}`;
}

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

const METRO_WEIGHTS: Record<string, number> = {
  indianapolis: 35, fortwayne: 15, southbend: 12, northwest: 10,
  evansville: 8, lafayette: 8, bloomington: 7, terrehaute: 5,
};

function weightedMetro(): string {
  const entries = Object.entries(METRO_WEIGHTS);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return "indianapolis";
}

export async function seedDatabase() {
  const prospectCount = await storage.getProspectCount();
  if (prospectCount > 0) {
    console.log(`[seed] Database already has ${prospectCount} prospects, skipping seed.`);
    return;
  }

  console.log("[seed] Seeding Indiana Prospecting Engine data...");

  const broker = await storage.createBrokerProfile({
    name: "Keith Schuh",
    firm: "SiriusB",
    targetSizes: ["midmarket", "large"],
    targetMetros: ["indianapolis", "fortwayne", "southbend"],
    targetIndustries: ["manufacturing", "healthcare", "professional"],
    serviceWedge: "fullrenewal",
    salesMotion: "strategic",
  });

  const usedNames = new Set<string>();
  const NUM_PROSPECTS = 220;

  for (let i = 0; i < NUM_PROSPECTS; i++) {
    const metro = weightedMetro();
    const metroData = INDIANA_CITIES[metro];
    const industry = weightedPick(INDUSTRIES);
    const suffixes = COMPANY_SUFFIXES[industry.name] || ["Corp"];

    let name = "";
    let attempts = 0;
    do {
      name = `${pick(COMPANY_PREFIXES)} ${pick(suffixes)}`;
      attempts++;
    } while (usedNames.has(name) && attempts < 20);
    if (usedNames.has(name)) name = `${name} ${i}`;
    usedNames.add(name);

    const participants = industry.name === "Manufacturing" ? randInt(80, 1800) :
      industry.name === "Healthcare" ? randInt(100, 2200) :
      industry.name === "Transportation" ? randInt(60, 600) :
      randInt(50, 1200);

    const hasStopLoss = Math.random() > 0.35;
    const rxScore = Math.random() > 0.3 ? randInt(15, 85) : null;
    const slScore = hasStopLoss ? (Math.random() > 0.4 ? randInt(20, 90) : null) : null;
    const estCommission = Math.round(participants * (randInt(8, 18)) * 12 * 0.04);
    const renewalMonth = randInt(1, 12);
    const numCarriers = Math.random() > 0.4 ? randInt(1, 3) : 0;
    const carriers: string[] = [];
    const available = [...CARRIERS];
    for (let c = 0; c < numCarriers; c++) {
      const idx = randInt(0, available.length - 1);
      carriers.push(available.splice(idx, 1)[0]);
    }

    const naicsCode = `${industry.naics}${randInt(10, 99)}${randInt(10, 99)}`;

    await storage.createProspect({
      ein: genEIN(),
      sponsorName: name,
      city: pick(metroData.cities),
      state: "IN",
      industry: industry.name,
      naicsCode,
      participants,
      formYear: pick([2022, 2023, 2023, 2023]),
      metroRegion: metro,
      metroLabel: metroData.label,
      welfareCodes: pick(["4A", "4B", "4C", "4D", "4A,4C"]),
      carriers,
      hasStopLoss,
      renewalMonth,
      rxScore,
      slScore,
      estCommission,
    });
  }

  const bookClients = [
    { clientName: "Midwest Precision Manufacturing", industry: "Manufacturing", employees: 420, annualSpend: 3200000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 3 },
    { clientName: "Hoosier Components Inc", industry: "Manufacturing", employees: 280, annualSpend: 2100000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 6 },
    { clientName: "Heritage Metalworks", industry: "Manufacturing", employees: 650, annualSpend: 5200000, planType: "Self-Funded", metro: "fortwayne", renewalMonth: 9 },
    { clientName: "Circle City Health Partners", industry: "Healthcare", employees: 890, annualSpend: 7800000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 1 },
    { clientName: "Indiana Medical Associates", industry: "Healthcare", employees: 340, annualSpend: 2900000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 7 },
    { clientName: "Crossroads Education Group", industry: "Education", employees: 520, annualSpend: 3600000, planType: "Level-Funded", metro: "bloomington", renewalMonth: 8 },
    { clientName: "Prairie Financial Advisors", industry: "Finance", employees: 180, annualSpend: 1400000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 4 },
    { clientName: "Summit Logistics LLC", industry: "Transportation", employees: 310, annualSpend: 2200000, planType: "Self-Funded", metro: "northwest", renewalMonth: 11 },
    { clientName: "Wabash Construction Co", industry: "Construction", employees: 240, annualSpend: 1700000, planType: "Level-Funded", metro: "lafayette", renewalMonth: 2 },
    { clientName: "Cardinal Professional Group", industry: "Professional Services", employees: 160, annualSpend: 1100000, planType: "Self-Funded", metro: "indianapolis", renewalMonth: 5 },
    { clientName: "Great Lakes Foods", industry: "Food Service", employees: 490, annualSpend: 3100000, planType: "Self-Funded", metro: "southbend", renewalMonth: 10 },
    { clientName: "Liberty Community Services", industry: "Nonprofit", employees: 120, annualSpend: 800000, planType: "Level-Funded", metro: "evansville", renewalMonth: 12 },
  ];

  for (const client of bookClients) {
    await storage.createBookClient({ brokerId: broker.id, ...client });
  }

  const lists = [
    { name: "Q2 Priority Targets", items: 3 },
    { name: "Manufacturing Pipeline", items: 4 },
    { name: "Stop-Loss Opportunities", items: 2 },
    { name: "NE Indiana Prospects", items: 3 },
  ];

  const allProspects = await storage.getAllProspects();

  for (const listDef of lists) {
    const list = await storage.createSavedList({ brokerId: broker.id, name: listDef.name });
    const shuffled = [...allProspects].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(listDef.items, shuffled.length); i++) {
      await storage.createListItem({
        listId: list.id,
        prospectId: shuffled[i].id,
        notes: pick(["High priority — reach out this week", "Discussed at chamber event", "Referred by existing client", "Follow up after renewal season", ""]),
        priority: pick(["high", "medium", "low"]),
      });
    }
  }

  console.log(`[seed] Seeded ${NUM_PROSPECTS} prospects, ${bookClients.length} book clients, ${lists.length} saved lists.`);
}
