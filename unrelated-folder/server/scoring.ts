import type { Prospect5500, BrokerBook } from "@shared/schema";

interface ScoringParams {
  targetSizes?: string[];
  targetMetros?: string[];
  targetIndustries?: string[];
  serviceWedge?: string;
  salesMotion?: string;
  minSize?: number;
  maxSize?: number;
}

interface BookProfile {
  avgEmployees: number;
  industries: Record<string, number>;
  metros: Record<string, number>;
  avgRenewalMonth: number;
  planTypes: Record<string, number>;
  totalClients: number;
}

interface ScoredProspect {
  prospect: Prospect5500;
  matchScore: number;
  scoreBreakdown: Record<string, number>;
  fitFlags: string[];
  openingAngle: string;
  whyThisAccount: string[];
}

const NAICS_INDUSTRY_MAP: Record<string, string[]> = {
  healthcare: ["62"],
  manufacturing: ["31", "32", "33"],
  education: ["61"],
  professional: ["54", "55", "56"],
  construction: ["23"],
  transportation: ["48", "49"],
  finance: ["52"],
  retail: ["44", "45"],
  nonprofit: ["81"],
};

const SIZE_RANGES: Record<string, [number, number]> = {
  small: [50, 199],
  midmarket: [200, 499],
  large: [500, 999],
  enterprise: [1000, 9999],
};

function getSizeKey(participants: number): string {
  if (participants >= 1000) return "enterprise";
  if (participants >= 500) return "large";
  if (participants >= 200) return "midmarket";
  return "small";
}

function getIndustryKey(naicsCode: string): string {
  for (const [key, prefixes] of Object.entries(NAICS_INDUSTRY_MAP)) {
    if (prefixes.some(p => naicsCode.startsWith(p))) return key;
  }
  return "other";
}

function currentMonth(): number {
  return new Date().getMonth() + 1;
}

function monthsUntilRenewal(renewalMonth: number): number {
  const cm = currentMonth();
  const diff = renewalMonth - cm;
  return diff >= 0 ? diff : diff + 12;
}

export function scoreProspectQuiz(prospect: Prospect5500, params: ScoringParams): ScoredProspect {
  const breakdown: Record<string, number> = {};

  let sizeScore = 50;
  if (params.targetSizes && params.targetSizes.length > 0) {
    const prospectSize = getSizeKey(prospect.participants);
    if (params.targetSizes.includes(prospectSize)) {
      sizeScore = 90;
    } else {
      const sizeIdx = ["small", "midmarket", "large", "enterprise"];
      const pIdx = sizeIdx.indexOf(prospectSize);
      const minDist = Math.min(...params.targetSizes.map(s => Math.abs(sizeIdx.indexOf(s) - pIdx)));
      sizeScore = minDist === 1 ? 60 : 30;
    }
  }
  if (params.minSize && params.maxSize) {
    if (prospect.participants >= params.minSize && prospect.participants <= params.maxSize) {
      sizeScore = Math.max(sizeScore, 85);
    }
  }
  breakdown.size_match = Math.round(sizeScore);

  let industryScore = 50;
  if (params.targetIndustries && params.targetIndustries.length > 0) {
    const prospectIndustry = getIndustryKey(prospect.naicsCode);
    const naicsPrefixes = params.targetIndustries;
    const directMatch = naicsPrefixes.some(p => prospect.naicsCode.startsWith(p));
    const keyMatch = Object.entries(NAICS_INDUSTRY_MAP).some(([key, prefixes]) =>
      prefixes.some(p => prospect.naicsCode.startsWith(p)) &&
      naicsPrefixes.some(np => prefixes.includes(np))
    );
    if (directMatch) industryScore = 92;
    else if (keyMatch) industryScore = 75;
    else industryScore = 35;
  }
  breakdown.industry_match = Math.round(industryScore);

  let geoScore = 50;
  if (params.targetMetros && params.targetMetros.length > 0 && !params.targetMetros.includes("any")) {
    if (params.targetMetros.includes(prospect.metroRegion)) {
      geoScore = 95;
    } else {
      geoScore = 30;
    }
  } else {
    geoScore = 70;
  }
  breakdown.geography = Math.round(geoScore);

  let serviceScore = 50;
  if (params.serviceWedge && params.serviceWedge !== "any") {
    if (params.serviceWedge === "rx" && prospect.rxScore !== null && prospect.rxScore < 50) serviceScore = 95;
    else if (params.serviceWedge === "stoploss" && !prospect.hasStopLoss) serviceScore = 95;
    else if (params.serviceWedge === "stoploss" && prospect.slScore !== null && prospect.slScore < 50) serviceScore = 90;
    else if (params.serviceWedge === "fullrenewal") serviceScore = 70;
    else if (params.serviceWedge === "plandesign" && prospect.participants >= 200) serviceScore = 80;
    else serviceScore = 55;
  }
  breakdown.service_fit = Math.round(serviceScore);

  const mur = monthsUntilRenewal(prospect.renewalMonth);
  let renewalScore = 50;
  if (params.salesMotion === "quickwins") {
    renewalScore = mur <= 3 ? 95 : mur <= 6 ? 70 : 30;
  } else if (params.salesMotion === "strategic") {
    renewalScore = mur >= 6 ? 85 : mur >= 3 ? 70 : 50;
  } else {
    renewalScore = mur <= 4 ? 85 : mur <= 8 ? 65 : 50;
  }
  breakdown.renewal_timing = Math.round(renewalScore);

  let strategicScore = 50;
  if (params.salesMotion === "disruption" && prospect.carriers.length > 0) strategicScore = 80;
  else if (params.salesMotion === "turnaround" && prospect.rxScore !== null && prospect.rxScore < 40) strategicScore = 85;
  else if (params.salesMotion === "quickwins" && mur <= 3) strategicScore = 90;
  else if (params.salesMotion === "strategic") strategicScore = 65;
  breakdown.strategic_pref = Math.round(strategicScore);

  const matchScore = Math.round(
    breakdown.size_match * 0.25 +
    breakdown.industry_match * 0.20 +
    breakdown.geography * 0.20 +
    breakdown.service_fit * 0.15 +
    breakdown.renewal_timing * 0.10 +
    breakdown.strategic_pref * 0.10
  );

  const { fitFlags, openingAngle, whyThisAccount } = deriveFlags(prospect, params, breakdown, matchScore);

  return { prospect, matchScore, scoreBreakdown: breakdown, fitFlags, openingAngle, whyThisAccount };
}

export function buildBookProfile(bookClients: BrokerBook[]): BookProfile {
  const industries: Record<string, number> = {};
  const metros: Record<string, number> = {};
  const planTypes: Record<string, number> = {};
  let totalEmps = 0;
  let totalRenewal = 0;

  for (const c of bookClients) {
    totalEmps += c.employees;
    totalRenewal += c.renewalMonth;
    industries[c.industry] = (industries[c.industry] || 0) + 1;
    metros[c.metro] = (metros[c.metro] || 0) + 1;
    planTypes[c.planType] = (planTypes[c.planType] || 0) + 1;
  }

  return {
    avgEmployees: bookClients.length > 0 ? Math.round(totalEmps / bookClients.length) : 300,
    industries,
    metros,
    avgRenewalMonth: bookClients.length > 0 ? Math.round(totalRenewal / bookClients.length) : 6,
    planTypes,
    totalClients: bookClients.length,
  };
}

export function scoreProspectBook(prospect: Prospect5500, profile: BookProfile): ScoredProspect {
  const breakdown: Record<string, number> = {};

  const sizeDiff = Math.abs(prospect.participants - profile.avgEmployees) / Math.max(profile.avgEmployees, 1);
  breakdown.size_match = Math.round(sizeDiff < 0.3 ? 90 : sizeDiff < 0.6 ? 70 : sizeDiff < 1.0 ? 50 : 30);

  const prospectIndustry = prospect.industry;
  const topIndustry = Object.entries(profile.industries).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (profile.industries[prospectIndustry]) {
    const pct = profile.industries[prospectIndustry] / profile.totalClients;
    breakdown.industry_match = Math.round(pct > 0.3 ? 85 : pct > 0.15 ? 70 : 55);
  } else if (topIndustry && prospectIndustry === topIndustry) {
    breakdown.industry_match = 80;
  } else {
    breakdown.industry_match = 40;
  }

  if (profile.metros[prospect.metroRegion]) {
    const pct = profile.metros[prospect.metroRegion] / profile.totalClients;
    breakdown.geography = Math.round(pct > 0.3 ? 60 : 50);
  } else {
    breakdown.geography = 75;
  }

  const mur = monthsUntilRenewal(prospect.renewalMonth);
  breakdown.renewal_timing = Math.round(mur <= 4 ? 90 : mur <= 8 ? 65 : 40);

  let serviceFit = 60;
  const sfPct = (profile.planTypes["Self-Funded"] || 0) / profile.totalClients;
  if (sfPct > 0.5 && !prospect.hasStopLoss) serviceFit = 85;
  else if (sfPct > 0.5) serviceFit = 70;
  breakdown.service_fit = Math.round(serviceFit);

  let whitespace = 50;
  if (!profile.industries[prospectIndustry]) whitespace = 80;
  if (!profile.metros[prospect.metroRegion]) whitespace = Math.max(whitespace, 75);
  breakdown.whitespace = Math.round(whitespace);

  const matchScore = Math.round(
    breakdown.size_match * 0.25 +
    breakdown.industry_match * 0.20 +
    breakdown.geography * 0.15 +
    breakdown.renewal_timing * 0.15 +
    breakdown.service_fit * 0.15 +
    breakdown.whitespace * 0.10
  );

  const { fitFlags, openingAngle, whyThisAccount } = deriveFlags(prospect, {}, breakdown, matchScore);

  return { prospect, matchScore, scoreBreakdown: breakdown, fitFlags, openingAngle, whyThisAccount };
}

function deriveFlags(
  prospect: Prospect5500,
  params: ScoringParams,
  breakdown: Record<string, number>,
  matchScore: number
): { fitFlags: string[]; openingAngle: string; whyThisAccount: string[] } {
  const fitFlags: string[] = [];
  const whyThisAccount: string[] = [];

  if (!prospect.hasStopLoss || (prospect.slScore !== null && prospect.slScore < 50)) {
    fitFlags.push("stop_loss_gap");
    whyThisAccount.push(`Stop-loss gap detected — ${!prospect.hasStopLoss ? "no stop-loss coverage on file" : `current protection score only ${prospect.slScore}/100`}. High exposure for a ${prospect.participants}-life group.`);
  }

  if (prospect.rxScore !== null && prospect.rxScore < 50) {
    fitFlags.push("rx_opportunity");
    whyThisAccount.push(`Rx fiduciary score ${prospect.rxScore}/100 — likely paying above-market rates on PBM spread. PBM audit could unlock 15-25% Rx savings.`);
  }

  if (matchScore >= 80 && prospect.participants >= 300) {
    fitFlags.push("high_value_strategic");
    whyThisAccount.push(`High-value strategic account: ${prospect.participants.toLocaleString()} participants with ${matchScore} fit score — strong alignment to your profile.`);
  }

  if (prospect.carriers.length > 0) {
    fitFlags.push("disruption_target");
    whyThisAccount.push(`Currently with ${prospect.carriers.join(", ")} — displacement opportunity using cost transparency evidence.`);
  }

  const mur = monthsUntilRenewal(prospect.renewalMonth);
  if (mur <= 3) {
    fitFlags.push("likely_fast_close");
    whyThisAccount.push(`Renewal window open within ${mur * 30} days — approach now for fast-close opportunity.`);
  }

  if (whyThisAccount.length === 0) {
    whyThisAccount.push(`${prospect.industry} employer in ${prospect.metroLabel} with ${prospect.participants.toLocaleString()} participants — solid fit for your target profile.`);
  }

  let openingAngle = "";
  if (fitFlags.includes("rx_opportunity")) {
    openingAngle = `Lead with a PBM audit — ${prospect.sponsorName}'s Rx fiduciary score of ${prospect.rxScore}/100 suggests significant spread pricing exposure. Position as a fiduciary compliance conversation, not a sales pitch.`;
  } else if (fitFlags.includes("stop_loss_gap")) {
    openingAngle = `Open with a stop-loss risk review — ${prospect.sponsorName} ${!prospect.hasStopLoss ? "has no stop-loss on file" : "shows gaps in aggregate protection"}. Frame as risk mitigation for their ${prospect.participants}-life plan.`;
  } else if (fitFlags.includes("likely_fast_close")) {
    openingAngle = `Time-sensitive: ${prospect.sponsorName}'s renewal is within ${mur * 30} days. Lead with a competitive benchmark showing where their current carrier is leaving money on the table.`;
  } else {
    openingAngle = `Introduce through a fiduciary stewardship review for ${prospect.sponsorName}. Highlight how a ${prospect.participants}-life ${prospect.industry.toLowerCase()} group in ${prospect.metroLabel} deserves transparent, advisor-led benefit oversight.`;
  }

  return { fitFlags: fitFlags.slice(0, 4), openingAngle, whyThisAccount: whyThisAccount.slice(0, 4) };
}

export function computeBookAnalysis(bookClients: BrokerBook[]) {
  const profile = buildBookProfile(bookClients);

  const industryCounts = Object.entries(profile.industries).map(([name, value]) => ({
    name, value, pct: Math.round((value / profile.totalClients) * 100),
  })).sort((a, b) => b.value - a.value);

  const sizeBands = [
    { band: "Small (50-199)", min: 50, max: 199 },
    { band: "Mid-Market (200-499)", min: 200, max: 499 },
    { band: "Large (500-999)", min: 500, max: 999 },
    { band: "Enterprise (1000+)", min: 1000, max: 99999 },
  ];

  const sizeDistribution = sizeBands.map(b => ({
    band: b.band,
    count: bookClients.filter(c => c.employees >= b.min && c.employees <= b.max).length,
  }));

  const renewalMonths = Array.from({ length: 12 }, (_, i) => ({
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
    count: bookClients.filter(c => c.renewalMonth === i + 1).length,
  }));

  const topIndustries = industryCounts.slice(0, 3).map(i => i.name);
  const topMetros = Object.entries(profile.metros).sort((a, b) => b[1] - a[1]).slice(0, 2).map(m => m[0]);

  const METRO_LABELS: Record<string, string> = {
    indianapolis: "Indianapolis Metro", fortwayne: "Fort Wayne", southbend: "South Bend / Elkhart",
    northwest: "NW Indiana", evansville: "Evansville", terrehaute: "Terre Haute",
    bloomington: "Bloomington", lafayette: "Lafayette / Purdue",
  };

  const allMetros = ["indianapolis", "fortwayne", "southbend", "northwest", "evansville", "terrehaute", "bloomington", "lafayette"];
  const underservedMetros = allMetros.filter(m => !profile.metros[m]).slice(0, 2);
  const allIndustries = ["Healthcare", "Manufacturing", "Construction", "Transportation", "Professional Services", "Finance", "Education", "Retail"];
  const underservedIndustries = allIndustries.filter(i => !profile.industries[i]).slice(0, 2);

  const insights = [
    {
      type: "strength" as const,
      text: `You win well in Indiana self-funded accounts around ${profile.avgEmployees} employees — ${topIndustries.join(", ")} is your proven vertical${topIndustries.length > 1 ? "s" : ""}.`,
    },
    {
      type: "gap" as const,
      text: underservedMetros.length > 0
        ? `Your book has no presence in ${underservedMetros.map(m => METRO_LABELS[m] || m).join(" or ")} — significant untapped employer volume in these corridors.`
        : `Your geographic coverage is broad — consider deepening penetration in your strongest metro: ${topMetros.map(m => METRO_LABELS[m] || m).join(", ")}.`,
    },
    {
      type: "next" as const,
      text: `Your next best target: a self-funded ${underservedIndustries[0] || topIndustries[0]?.toLowerCase() || "manufacturing"} employer, ${Math.round(profile.avgEmployees * 0.8)}–${Math.round(profile.avgEmployees * 1.3)} employees, renewing in the next 120 days${underservedMetros[0] ? `, ${METRO_LABELS[underservedMetros[0]] || underservedMetros[0]}` : ""}.`,
    },
  ];

  return {
    profile,
    industryDistribution: industryCounts,
    sizeDistribution,
    renewalDistribution: renewalMonths,
    planTypeBreakdown: Object.entries(profile.planTypes).map(([type, count]) => ({ type, count })),
    insights,
    avgEmployees: profile.avgEmployees,
    totalClients: profile.totalClients,
  };
}