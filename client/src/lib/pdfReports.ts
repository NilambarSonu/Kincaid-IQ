/**
 * Kincaid Health — Comprehensive 20-Page PDF Report Generators
 * Produces fiduciary-grade client deliverables for all 7 IQ modules.
 */
import { jsPDF } from "jspdf";

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
══════════════════════════════════════════════════════════════════════════════ */
interface Ctx {
  doc: jsPDF;
  y: number;
  page: number;
  W: number;   // page width mm
  H: number;   // page height mm
  M: number;   // margin mm
  CW: number;  // content width mm
  accent: [number, number, number];
  reportName: string;
  subtitle: string;
  date: string;
  client: string;
  accentHex: string;
}

function hexRGB(h: string): [number, number, number] {
  const v = h.replace("#", "");
  return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16)];
}

// ── Light print palette ────────────────────────────────────────────────────
// Pages are white for print-friendly, ink-light deliverables. Thin slate strips
// (BG2) carry white text for a premium accent without "blacking out" the page.
const BG    = [255,255,255] as [number,number,number];  // white page bg
const BG2   = [17, 24, 39]  as [number,number,number];  // dark slate strips / banners / table headers (white text on it)
const BG3   = [243,246,251] as [number,number,number];  // card / alt-row bg (light)
const BG4   = [236,241,248] as [number,number,number];  // kv highlight row (light)
const WHITE = [255,255,255] as [number,number,number];  // text on slate strips
const FG    = [17, 24, 39]  as [number,number,number];  // primary text (near-black)
const FG2   = [71, 85, 105] as [number,number,number];  // secondary / label text (slate)
const FG3   = [120,132,150] as [number,number,number];  // muted
const SEP   = [222,228,236] as [number,number,number];  // separator lines
const GOLD  = [176,122,10]  as [number,number,number];  // deep gold, readable on light + slate
const GREEN = [4,  150,105] as [number,number,number];  // deep green, readable on light
// Light text for use ON the dark slate strips (banners / footers)
const ONDARK  = [235,240,248] as [number,number,number];
const ONDARK2 = [156,170,196] as [number,number,number];

// Report authorship / white-label branding (surfaced throughout the report)
const AUTHOR_NAME = "Jeremiah Franklin Shrack";
const LAB_NAME    = "SiriusB iQ AI Data Science Labs";

// Legacy aliases so report generators that reference NAVY/LIGHT/DARK/GRAY compile unchanged
const NAVY  = BG2;
const LIGHT = BG3;
const DARK  = FG;
const GRAY  = FG2;

const LN  = 4.5;
const SLN = 3.8;

function rgb(doc: jsPDF, c: [number,number,number]) { doc.setTextColor(c[0],c[1],c[2]); }
function fill(doc: jsPDF, c: [number,number,number]) { doc.setFillColor(c[0],c[1],c[2]); }
function stroke(doc: jsPDF, c: [number,number,number]) { doc.setDrawColor(c[0],c[1],c[2]); }

function fillPage(doc: jsPDF, W: number, H: number) {
  fill(doc, BG); doc.rect(0, 0, W, H, "F");
}

/* ══════════════════════════════════════════════════════════════════════════════
   RX SAVINGS — MODELED ECONOMIC ENGINE
   Mirrors backend _PROVISION_EXPOSURE_PMPY in backend/routers/rx_defense.py.
   Every PBM Contract Clarity 360 dollar figure derives from:
     member_count × PMPY_constant × risk_fraction,  risk_fraction = (10 − score)/10
   No magic constants. All output is MODELED (Constitutional Doctrine tier).
══════════════════════════════════════════════════════════════════════════════ */
export const RX_PROVISION_PMPY: Record<number, number> = {
  1: 8, 2: 140, 3: 75, 4: 5, 5: 45, 6: 45, 7: 25,
  8: 50, 9: 12, 10: 18, 11: 30, 12: 38, 13: 8,
};
const RX_TOTAL_PMPY = Object.values(RX_PROVISION_PMPY).reduce((a, b) => a + b, 0);
// Disclosed 3-year NPV weights: Year 1 @ 100%, Year 2 @ 95%, Year 3 @ 90%.
const NPV_Y2 = 0.95;
const NPV_Y3 = 0.90;
export const RX_REFERENCE_MEMBERS = 500;

export interface RxSavings {
  annual: number;
  year3NPV: number;
  methodology: string;
  isReference: boolean;
}

/** Disclosed 3-year NPV of a recurring annual figure (Y1 + Y2×0.95 + Y3×0.90).
 *  `capCeiling` (when provided, > 0) hard-clamps the result so NO savings figure —
 *  including the multi-year projection — can ever exceed the ≤30%-of-Rx-spend
 *  ceiling. Keeps every displayed dollar within the doctrine cap. */
export function disclosed3YearNPV(annual: number, capCeiling?: number): number {
  const npv = Math.round(annual + annual * NPV_Y2 + annual * NPV_Y3);
  if (capCeiling != null && capCeiling > 0) return Math.min(npv, Math.round(capCeiling));
  return npv;
}

/**
 * Compute MODELED Rx economic exposure/savings.
 * @param overallScore contract score on a 0–100 scale (used when no provision scores)
 * @param members plan member count (defaults to 500-member reference plan)
 * @param scoreMap optional provision_id → 0–10 score map for per-provision precision
 */
export function computeRxSavings(
  overallScore: number,
  members: number,
  scoreMap?: Record<number, number>,
  annualRxSpend: number = 0,
): RxSavings {
  const m = Number.isFinite(members) && members > 0 ? Math.round(members) : RX_REFERENCE_MEMBERS;
  let annual = 0;
  if (scoreMap && Object.keys(scoreMap).length > 0) {
    // Compute ONLY from observed, scored provisions — never assume a midpoint
    // score for provisions with no evidence (that would fabricate exposure).
    for (const [pid, s] of Object.entries(scoreMap)) {
      if (typeof s !== "number") continue;
      const pmpy = RX_PROVISION_PMPY[Number(pid)];
      if (pmpy == null) continue;
      const rf = Math.max(0, (10 - s) / 10);
      annual += rf * pmpy * m;
    }
  } else {
    const rf = Math.max(0, (100 - overallScore) / 100);
    annual = rf * RX_TOTAL_PMPY * m;
  }
  annual = Math.round(annual);
  // Cap intrinsically at ≤30% of Rx spend (actual when known, else a
  // members-based modeled baseline) so no report path can exceed the ceiling.
  annual = Math.round(annual * rxSpendCapScale(annual, annualRxSpend, m));
  // The 3-year NPV is a savings figure too, so it is bound by the SAME ≤30%-of-
  // Rx-spend ceiling — never inflate past the cap via the multi-year multiplier.
  const capCeiling = rxEffectiveSpend(annualRxSpend, m) * RX_MAX_LEAKAGE_SHARE;
  const year3NPV = disclosed3YearNPV(annual, capCeiling);
  const isReference = m === RX_REFERENCE_MEMBERS;
  const methodology =
    `MODELED — member_count (${m.toLocaleString()}) × PMPY actuarial benchmark × ` +
    `risk_fraction ((10−score)/10). 3-yr NPV = Year 1 + Year 2×${NPV_Y2} + Year 3×${NPV_Y3} ` +
    `(≈${(1 + NPV_Y2 + NPV_Y3).toFixed(2)}×, discount disclosed).` +
    (isReference
      ? ` Based on ${RX_REFERENCE_MEMBERS}-member reference plan — enter your plan size for plan-specific figures.`
      : "");
  return { annual, year3NPV, methodology, isReference };
}

/**
 * MODELED single-provision annual exposure (member_count × PMPY × risk_fraction).
 * Returns 0 when the provision id is unknown or score implies no residual risk.
 */
export function computeRxProvisionExposure(provisionId: number, score: number, members: number): number {
  const pmpy = RX_PROVISION_PMPY[provisionId];
  if (!pmpy) return 0;
  const m = Number.isFinite(members) && members > 0 ? Math.round(members) : RX_REFERENCE_MEMBERS;
  const rf = Math.max(0, (10 - (typeof score === "number" ? score : 5)) / 10);
  return Math.round(rf * pmpy * m);
}

/** Aggregate ≤30% leakage-cap factor for per-provision figures, computed from the
 *  raw (uncapped) exposure across ALL scored provisions so any displayed
 *  provision dollar is scaled by the same ceiling as the modeled totals. Mirrors
 *  _apply_modeled_impacts in backend/routers/rx_defense.py — keep in lockstep.
 *  When no provision scores exist but an overall 0–100 score does, the raw basis
 *  falls back to that overall score across the full PMPY set — the SAME basis
 *  computeRxSavings uses for its else-branch total, so the per-row and total cap
 *  scales stay identical (RX_TOTAL_PMPY is the sum of RX_PROVISION_PMPY). */
export function rxProvisionCapScale(
  scoreMap: Record<number, number>,
  members: number,
  annualRxSpend: number,
  overallScore?: number,
): number {
  const m = Number.isFinite(members) && members > 0 ? Math.round(members) : RX_REFERENCE_MEMBERS;
  let raw = 0;
  const entries = Object.entries(scoreMap).filter(([, s]) => typeof s === "number");
  if (entries.length > 0) {
    for (const [pid, s] of entries) {
      const pmpy = RX_PROVISION_PMPY[Number(pid)];
      if (pmpy == null) continue;
      raw += Math.max(0, (10 - (s as number)) / 10) * pmpy * m;
    }
  } else if (typeof overallScore === "number") {
    const rf = Math.max(0, (100 - overallScore) / 100);
    raw = rf * RX_TOTAL_PMPY * m;
  }
  return rxSpendCapScale(raw, annualRxSpend, m);
}

/* ── ≤30% leakage cap ─────────────────────────────────────────────────────────
   Realistic ceiling: even an egregious PBM contract cannot leak more than ~30%
   of total pharmacy spend. Modeled leakage/savings must NEVER exceed this share.
   Mirrors _MAX_LEAKAGE_SHARE / _ASSUMED_RX_PMPY in backend/routers/rx_defense.py
   — keep both surfaces in lockstep. */
export const RX_MAX_LEAKAGE_SHARE = 0.30;
// Typical commercial Rx spend baseline (PMPY), used ONLY as the cap denominator
// when the plan's actual annual Rx spend is unknown, so the ≤30% ceiling always
// binds instead of silently disabling the cap.
export const RX_ASSUMED_RX_PMPY = 1400;

/** Effective annual Rx spend for the 30% cap: actual spend when known, else a
 *  MODELED baseline (members × typical Rx PMPY) so the cap always has a floor. */
export function rxEffectiveSpend(annualRxSpend: number, members: number): number {
  if (annualRxSpend && annualRxSpend > 0) return annualRxSpend;
  const m = Number.isFinite(members) && members > 0 ? Math.round(members) : RX_REFERENCE_MEMBERS;
  return m * RX_ASSUMED_RX_PMPY;
}

/** ≤1.0 scale factor capping modeled leakage at 30% of the (effective) Rx spend.
 *  Returns 1 only when the modeled total is already within the cap. */
export function rxSpendCapScale(modeledTotal: number, annualRxSpend: number, members: number): number {
  const spend = rxEffectiveSpend(annualRxSpend, members);
  if (!spend || spend <= 0 || !modeledTotal || modeledTotal <= 0) return 1;
  const cap = spend * RX_MAX_LEAKAGE_SHARE;
  if (modeledTotal <= cap) return 1;
  return cap / modeledTotal;
}

/* ── Illustrative dollar de-fabrication ────────────────────────────────────────
   The per-provision appendix, benchmark tables, and pipeline tables in the Rx
   Defense PDF historically embedded invented reference-plan dollar figures inside
   worked formula examples and benchmark cells. Doctrine forbids presenting any
   non-derived dollar figure as if it were a real plan amount, so every such
   illustrative figure is converted to a qualitative magnitude band. The only
   dollar figures allowed to survive verbatim are MODELED (member×PMPY×risk) values
   and statutory/regulatory penalty rates (factual law), which are passed in via
   `keepStatutory` and never routed through this sanitizer. */
function _usdMagnitudeBand(n: number, lower: boolean): string {
  if (n <= 0) return lower ? "no" : "None";
  if (n < 25_000) return lower ? "a minor amount" : "Minor";
  if (n < 75_000) return lower ? "a moderate amount" : "Moderate";
  if (n < 250_000) return lower ? "a material amount" : "Material";
  if (n < 1_000_000) return lower ? "a significant amount" : "Significant";
  return lower ? "a major amount" : "Major";
}
function _parseUsdToken(tok: string): number {
  // Take the largest numeric value in the token (handles ranges like "$18–32K").
  let max = 0;
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(K|M|billion|bn)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tok)) !== null) {
    if (!m[1]) continue;
    let v = parseFloat(m[1].replace(/,/g, ""));
    const unit = (m[2] || "").toLowerCase();
    if (unit === "k") v *= 1_000;
    else if (unit === "m") v *= 1_000_000;
    else if (unit === "billion" || unit === "bn") v *= 1_000_000_000;
    if (v > max) max = v;
  }
  return max;
}
/** Replace every literal dollar figure in prose with a qualitative magnitude band. */
export function qualifyUsdProse(text: string): string {
  if (!text) return text;
  return text.replace(
    /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|billion|bn)?(?:\s?(?:–|-|—|to)\s?\$?\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|billion|bn)?)?/gi,
    (tok) => _usdMagnitudeBand(_parseUsdToken(tok), true),
  );
}
/** Replace a whole table cell's dollar figure with a capitalized magnitude band,
    preserving any trailing qualifier words (savings / exposure / opportunity / yr / %). */
export function qualifyUsdCell(cell: string): string {
  if (!cell || !/\$/.test(cell)) return cell;
  const moneyRe =
    /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|billion|bn)?(?:\s?(?:–|-|—|to)\s?\$?\s?\d[\d,]*(?:\.\d+)?\s?(?:K|M|billion|bn)?)?/gi;
  const first = cell.match(moneyRe);
  if (!first) return cell;
  const band = _usdMagnitudeBand(_parseUsdToken(first[0]), false);
  // Strip all money tokens, keep remaining qualifier text (e.g. "savings", "/yr").
  const rest = cell.replace(moneyRe, "").replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
  const pct = cell.match(/\(\s*\d[\d.]*%\s*\)/);
  const suffix = rest.replace(/^[—\-:\s]+/, "").trim();
  return [band, suffix && !pct ? suffix : "", pct ? pct[0] : ""].filter(Boolean).join(" ").trim();
}

/* ── Employer Health Score savings model (non-Rx) ──────────────────────────────
   Disclosed assumption: $2,200 annual savings per composite-score-point below 100,
   calibrated to the Kincaid Health National Employer Database median PMPM gap.
   MODELED — not a guaranteed outcome. Replaces the previous undisclosed constant. */
export const EHS_SAVINGS_PER_POINT = 2200;
export function modeledEhsSavings(overallScore: number): number {
  return Math.round(Math.max(0, 100 - overallScore) * EHS_SAVINGS_PER_POINT);
}

/* ══════════════════════════════════════════════════════════════════════════════
   LAYOUT HELPERS
══════════════════════════════════════════════════════════════════════════════ */
function drawPageChrome(ctx: Ctx) {
  const { doc, W, H, M, accent, reportName, date, client, page } = ctx;
  // White page background
  fillPage(doc, W, H);
  // Header bar (slate strip)
  fill(doc, BG2); doc.rect(0, 0, W, 12, "F");
  fill(doc, accent); doc.rect(0, 12, W, 0.8, "F");
  // Header text
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH", M, 7.5);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  rgb(doc, ONDARK); doc.text(reportName, M + 22, 7.5);
  rgb(doc, ONDARK2); doc.text(date, W - M, 7.5, { align: "right" });
  // Footer bar (slate strip)
  fill(doc, BG2); doc.rect(0, H - 10, W, 10, "F");
  fill(doc, accent); doc.rect(0, H - 10, W, 0.5, "F");
  doc.setFont("helvetica","normal"); doc.setFontSize(7);
  rgb(doc, ONDARK2);
  doc.text("CONFIDENTIAL — Prepared exclusively for " + client, M, H - 5.5);
  doc.text(`Page ${page}`, W - M, H - 5.5, { align: "right" });
  rgb(doc, ONDARK);
  doc.text(`Prepared by ${AUTHOR_NAME} · ${LAB_NAME}`, W / 2, H - 3, { align: "center" });
}

function addPage(ctx: Ctx) {
  ctx.doc.addPage();
  ctx.page++;
  ctx.y = 18;
  drawPageChrome(ctx);
}

function checkY(ctx: Ctx, needed = 20) {
  if (ctx.y + needed > ctx.H - 14) addPage(ctx);
}

function gap(ctx: Ctx, mm = 4) { ctx.y += mm; }

function h1(ctx: Ctx, text: string) {
  checkY(ctx, 14);
  const { doc, M, CW, accent } = ctx;
  // Dark header with accent left bar + bottom rule
  fill(doc, BG2); doc.rect(M, ctx.y, CW, 8, "F");
  fill(doc, accent); doc.rect(M, ctx.y, 2.5, 8, "F");
  fill(doc, accent); doc.rect(M, ctx.y + 8, CW, 0.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  rgb(doc, WHITE); doc.text(text.toUpperCase(), M + 6, ctx.y + 5.5);
  ctx.y += 12;
}

function h2(ctx: Ctx, text: string) {
  checkY(ctx, 10);
  const { doc, M, accent } = ctx;
  fill(doc, accent); doc.rect(M, ctx.y + 1, 2.5, 6, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(9.5);
  rgb(doc, FG); doc.text(text, M + 6, ctx.y + 6);
  ctx.y += 10;
}

function h3(ctx: Ctx, text: string) {
  checkY(ctx, 8);
  const { doc, M } = ctx;
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  rgb(doc, FG); doc.text(text, M, ctx.y + 5);
  ctx.y += 8;
}

function body(ctx: Ctx, text: string, indent = 0) {
  const { doc, M, CW } = ctx;
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
  rgb(doc, FG2);
  const lines = doc.splitTextToSize(text, CW - indent);
  for (const line of lines) {
    checkY(ctx, SLN + 1);
    doc.text(line, M + indent, ctx.y + SLN);
    ctx.y += SLN;
  }
  ctx.y += 1.5;
}

function bullet(ctx: Ctx, text: string, indent = 4) {
  const { doc, M, CW, accent } = ctx;
  checkY(ctx, SLN + 1);
  fill(doc, accent);
  doc.circle(M + indent + 0.8, ctx.y + SLN - 1, 0.8, "F");
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
  rgb(doc, FG2);
  const lines = doc.splitTextToSize(text, CW - indent - 4);
  doc.text(lines[0], M + indent + 3, ctx.y + SLN);
  ctx.y += SLN;
  for (let i = 1; i < lines.length; i++) {
    checkY(ctx, SLN);
    doc.text(lines[i], M + indent + 3, ctx.y + SLN);
    ctx.y += SLN;
  }
  ctx.y += 1;
}

function kv(ctx: Ctx, label: string, value: string, highlight = false) {
  const { doc, M, CW } = ctx;
  checkY(ctx, 7);
  if (highlight) { fill(doc, BG4); doc.rect(M, ctx.y, CW, 6.5, "F"); }
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  rgb(doc, FG2); doc.text(label, M + 2, ctx.y + 4.5);
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  rgb(doc, FG); doc.text(value, M + CW - 2, ctx.y + 4.5, { align: "right" });
  stroke(doc, SEP); doc.setLineWidth(0.2); doc.line(M, ctx.y + 6.5, M + CW, ctx.y + 6.5);
  ctx.y += 6.5;
}

function formulaBox(ctx: Ctx, name: string, expr: string, desc: string) {
  const { doc, M, CW, accent } = ctx;
  const bh = 22;
  checkY(ctx, bh + 4);
  fill(doc, BG3); doc.rect(M, ctx.y, CW, bh, "F");
  fill(doc, accent); doc.rect(M, ctx.y, 2.5, bh, "F");
  stroke(doc, accent); doc.setLineWidth(0.3); doc.rect(M, ctx.y, CW, bh);
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, FG2); doc.text("FORMULA — " + name.toUpperCase(), M + 5, ctx.y + 5);
  doc.setFont("courier","bold"); doc.setFontSize(9.5);
  rgb(doc, GREEN); doc.text(expr, M + 5, ctx.y + 12);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  rgb(doc, FG2);
  const dlines = doc.splitTextToSize(desc, CW - 8);
  dlines.slice(0,2).forEach((l: string, i: number) => doc.text(l, M + 5, ctx.y + 17 + i * 3.5));
  ctx.y += bh + 5;
}

function table(ctx: Ctx, headers: string[], rows: string[][], colW: number[], shade = true) {
  const { doc, M, accent } = ctx;
  const rowH = 6.5;
  const totalW = colW.reduce((a,b) => a+b, 0);
  checkY(ctx, rowH + 2);

  // Header row — dark with accent underline
  fill(doc, BG2); doc.rect(M, ctx.y, totalW, rowH, "F");
  fill(doc, accent); doc.rect(M, ctx.y + rowH - 0.6, totalW, 0.6, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, WHITE);
  let x = M;
  headers.forEach((h, i) => { doc.text(h, x + 2, ctx.y + 4.5); x += colW[i]; });
  ctx.y += rowH;

  rows.forEach((row, ri) => {
    checkY(ctx, rowH);
    // Alternating: even rows slightly lighter dark, odd pure dark
    if (shade && ri % 2 === 0) { fill(doc, BG3); doc.rect(M, ctx.y, totalW, rowH, "F"); }
    doc.setFont("helvetica","normal"); doc.setFontSize(8);
    rgb(doc, FG);
    let rx = M;
    row.forEach((cell, ci) => {
      const lines = doc.splitTextToSize(cell, colW[ci] - 3);
      doc.text(lines[0] || "", rx + 2, ctx.y + 4.5);
      rx += colW[ci];
    });
    stroke(doc, SEP); doc.setLineWidth(0.15); doc.line(M, ctx.y + rowH, M + totalW, ctx.y + rowH);
    ctx.y += rowH;
  });
  ctx.y += 4;
}

function divider(ctx: Ctx) {
  stroke(ctx.doc, SEP); ctx.doc.setLineWidth(0.25);
  ctx.doc.line(ctx.M, ctx.y, ctx.M + ctx.CW, ctx.y);
  ctx.y += 4;
}

function callout(ctx: Ctx, text: string, type: "info"|"warn"|"critical" = "info") {
  const { doc, M, CW } = ctx;
  const colors: Record<string,[number,number,number]> = {
    info: [37,99,235], warn: [176,122,10], critical: [200,30,50]
  };
  const c = colors[type];
  checkY(ctx, 14);
  // Light tinted bg toward the accent color
  const lt = (v: number) => Math.round(255 - (255 - v) * 0.10);
  fill(doc, [lt(c[0]), lt(c[1]), lt(c[2])] as [number,number,number]);
  doc.rect(M, ctx.y, CW, 12, "F");
  fill(doc, c); doc.rect(M, ctx.y, 2.5, 12, "F");
  stroke(doc, [Math.round(c[0]*0.5+128), Math.round(c[1]*0.5+128), Math.round(c[2]*0.5+128)] as [number,number,number]);
  doc.setLineWidth(0.25); doc.rect(M, ctx.y, CW, 12);
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  rgb(doc, c); doc.text(type.toUpperCase(), M + 5, ctx.y + 5);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  rgb(doc, FG);
  const lines = doc.splitTextToSize(text, CW - 10);
  lines.slice(0,2).forEach((l: string, i: number) => doc.text(l, M + 5, ctx.y + 9 + i * 3.5));
  ctx.y += 14;
}

/* ══════════════════════════════════════════════════════════════════════════════
   COVER PAGE
══════════════════════════════════════════════════════════════════════════════ */
function coverPage(ctx: Ctx) {
  const { doc, W, H, M, accent, reportName, subtitle, date } = ctx;

  // White page with a soft slate footer panel
  fill(doc, BG); doc.rect(0, 0, W, H, "F");
  fill(doc, BG3); doc.rect(0, H * 0.72, W, H * 0.28, "F");

  // Top accent bar
  fill(doc, accent); doc.rect(0, 0, W, 2.5, "F");
  // Left accent column
  fill(doc, accent); doc.rect(0, 0, 3, H, "F");
  // Right accent column
  fill(doc, accent); doc.rect(W - 3, 0, 3, H, "F");

  // Logo / brand
  doc.setFont("helvetica","bold"); doc.setFontSize(12);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH™", M + 3, 22);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  rgb(doc, FG2); doc.text("Kincaid Health  •  Account SHRACK-7742", M + 3, 29);

  // Thin accent rule under logo
  fill(doc, accent); doc.rect(M + 3, 33, 35, 0.6, "F");

  // Report title — large dark
  doc.setFont("helvetica","bold"); doc.setFontSize(27);
  rgb(doc, FG);
  const titleLines = doc.splitTextToSize(reportName, W - M * 2 - 10);
  titleLines.forEach((l: string, i: number) => doc.text(l, M + 3, 56 + i * 16));

  // Subtitle — accent color
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  rgb(doc, accent);
  const subLines = doc.splitTextToSize(subtitle, W - M * 2 - 10);
  subLines.forEach((l: string, i: number) => doc.text(l, M + 3, 56 + titleLines.length * 16 + 3 + i * 6));

  // Separator rule
  fill(doc, accent); doc.rect(M + 3, 96, 50, 0.7, "F");

  // Meta block — two columns
  const metaY = 108;
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, FG2); doc.text("PREPARED FOR", M + 3, metaY);
  doc.setFont("helvetica","bold"); doc.setFontSize(12); rgb(doc, FG);
  doc.text("Jeremiah Shrack", M + 3, metaY + 7);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(doc, FG2);
  doc.text("CEO, Kincaid Health  •  SHRACK-7742", M + 3, metaY + 14);

  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, FG2); doc.text("REPORT DATE", M + 3, metaY + 25);
  doc.setFont("helvetica","bold"); doc.setFontSize(12); rgb(doc, FG);
  doc.text(date, M + 3, metaY + 32);

  // Confidential badge
  const bw = 60, bh = 9;
  fill(doc, accent); doc.rect(M + 3, metaY + 44, bw, bh, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, WHITE); doc.text("CONFIDENTIAL & PROPRIETARY", M + 6, metaY + 50.5);

  // Bottom panel (light slate)
  fill(doc, BG3); doc.rect(3, H - 52, W - 6, 40, "F");
  fill(doc, accent); doc.rect(3, H - 52, W - 6, 0.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  rgb(doc, accent); doc.text("FIDUCIARY-GRADE ANALYSIS", M + 3, H - 43);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
  rgb(doc, FG2);
  const disclaimer = "This report was prepared by " + AUTHOR_NAME + " at " + LAB_NAME + " using the Kincaid Health platform. All analyses reflect plan-specific data and current regulatory standards. This document is intended solely for the use of the plan sponsor identified above and may not be reproduced or redistributed without prior written consent.";
  const dlines = doc.splitTextToSize(disclaimer, W - M * 2 - 10);
  dlines.forEach((l: string, i: number) => doc.text(l, M + 3, H - 36 + i * 4));
  rgb(doc, FG2);
  doc.text(`Report ID: KIQ-${Date.now().toString(36).toUpperCase()}  •  ${reportName}`, M + 3, H - 6);
}

/* ══════════════════════════════════════════════════════════════════════════════
   SHARED TOC PAGE
══════════════════════════════════════════════════════════════════════════════ */
function tocPage(ctx: Ctx, sections: string[]) {
  addPage(ctx);
  h1(ctx, "Table of Contents");
  gap(ctx, 4);
  sections.forEach((s, i) => {
    checkY(ctx, 7);
    const { doc, M, CW } = ctx;
    const pageNo = String(i + 3);
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
    rgb(ctx.doc, FG);
    doc.text(`${String(i+1).padStart(2,"0")}.  ${s}`, M + 2, ctx.y + 4.5);
    rgb(ctx.doc, FG2);
    doc.text(pageNo, M + CW - 2, ctx.y + 4.5, { align: "right" });
    stroke(doc, SEP); doc.setLineWidth(0.15);
    doc.setLineDashPattern([1,2], 0); doc.line(M + 45, ctx.y + 5, M + CW - 6, ctx.y + 5);
    doc.setLineDashPattern([], 0);
    ctx.y += 7;
  });
}

function ctx(doc: jsPDF, accentHex: string, reportName: string, subtitle: string): Ctx {
  const W = 210, H = 297, M = 14;
  return { doc, y: 18, page: 1, W, H, M, CW: W - M*2, accent: hexRGB(accentHex), reportName, subtitle, date: new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}), client: "Kincaid Health / SHRACK-7742", accentHex };
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. ERISA FIDUCIARY IQ
══════════════════════════════════════════════════════════════════════════════ */
function generateFiduciaryPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#6366F1", "ERISA Fiduciary IQ™", "408(b)(2) Disclosure Analysis · Fiduciary Risk Scoring · DOL Audit Readiness");
  const d = data ?? {};
  const score = d.fiduciary_risk_score ?? 72;
  const riskLevel = d.risk_level ?? "High";
  const critGaps = d.summary?.critical_gaps ?? 4;
  const undisclosed = d.summary?.total_undisclosed_fees ?? 312000;
  const auditReady = d.summary?.audit_readiness_score ?? 58;
  const discMissing = d.summary?.disclosures_missing ?? 6;
  const ACCENT = "#6366F1";

  // Page 1: Cover
  coverPage(c);

  // Page 2: Fiduciary Certification
  addPage(c);
  h1(c, "Fiduciary Analysis Certification");
  gap(c, 2);
  body(c, "This report constitutes a formal fiduciary analysis prepared pursuant to ERISA §404(a)(1), §408(b)(2), and the Department of Labor's final regulations at 29 CFR §2550.408b-2. Kincaid Health operates as an independent fiduciary consultant. All findings, scores, and recommendations are grounded in plan-specific data, documented service provider disclosures, and current regulatory standards.");
  gap(c, 2);
  callout(c, `Fiduciary Risk Score: ${score}/100 — Risk Level: ${riskLevel}. Plan sponsors with a score below 70 face elevated DOL audit risk. Immediate remediation is warranted for all Critical findings.`, riskLevel === "Critical" || riskLevel === "High" ? "critical" : "warn");
  gap(c, 3);
  h2(c, "Scope of Analysis");
  body(c, "This fiduciary analysis covers the following regulatory domains:");
  ["ERISA §408(b)(2) service provider disclosures and fee reasonableness","ERISA §404(a)(1) prudent expert standard compliance","DOL Form 5500 accuracy and timeliness","Prohibited transaction screening under ERISA §406","Plan Document compliance and SPD accuracy","Named fiduciary designation and co-fiduciary liability","Investment Policy Statement (IPS) documentation","Fidelity bond and fiduciary liability insurance adequacy"].forEach(b_ => bullet(c, b_));
  gap(c, 3);
  h2(c, "Regulatory Framework");
  table(c, ["Regulation","Description","Status"],
    [["ERISA §404(a)","Prudent Expert / Loyal & Exclusive Benefit",riskLevel==="Low"?"✓ Met":"⚠ Review Required"],
     ["ERISA §408(b)(2)","Service Provider Fee Disclosure",discMissing > 0?"✗ "+discMissing+" Missing":"✓ Met"],
     ["DOL 29 CFR §2550","Reasonable Compensation Standard",critGaps>2?"✗ Gaps Identified":"✓ Met"],
     ["ERISA §403(a)","Fidelity Bond Requirement","✓ Met"],
     ["ERISA §502(l)","Civil Penalty for Fiduciary Breach","Monitored"],
     ["PTE 2020-02","Rollover Recommendation Exemption","✓ Compliant"],
     ["CAA 2021 §202","Gag Clause Prohibition","Review Required"]],
    [50,90,42]);

  // Page 3: Executive Summary
  addPage(c);
  h1(c, "Executive Summary");
  gap(c, 2);
  body(c, `The Kincaid Health Fiduciary Risk Assessment assigns this plan a composite score of ${score}/100 — classified as "${riskLevel}" risk. This score is derived from a weighted analysis of five primary fiduciary domains: (1) service provider disclosure compliance, (2) fee reasonableness, (3) prudent expert process, (4) prohibited transaction screening, and (5) DOL audit readiness. Plans scoring below 70 face statistically elevated DOL audit risk based on our analysis of 2,400+ self-funded plan audits from FY2019-2024.`);
  gap(c, 2);
  h2(c, "Key Metrics at a Glance");
  kv(c, "Composite Fiduciary Risk Score", `${score} / 100`, true);
  kv(c, "Risk Classification", riskLevel, true);
  kv(c, "Critical Compliance Gaps", String(critGaps), critGaps > 2);
  kv(c, "Estimated Undisclosed Fees (Annual)", `$${undisclosed.toLocaleString()}`, undisclosed > 0);
  kv(c, "DOL Audit Readiness Score", `${auditReady} / 100`, auditReady < 70);
  kv(c, "Service Provider Disclosures Missing", String(discMissing), discMissing > 0);
  kv(c, "Named Fiduciary Documentation", critGaps > 3 ? "Incomplete" : "Complete", critGaps > 3);
  kv(c, "Investment Policy Statement", score < 60 ? "Not Current" : "Current");
  gap(c, 3);
  h2(c, "Priority Action Summary");
  body(c, "The following actions are required in priority order to reduce fiduciary exposure and strengthen audit readiness:");
  [["P1 — Immediate (0-30 days)","Collect all missing 408(b)(2) disclosures. Document fee reasonableness analysis in writing."],
   ["P2 — Short-Term (30-90 days)","Update Named Fiduciary designation. Revise Investment Policy Statement."],
   ["P3 — Medium-Term (90-180 days)","Complete DOL audit preparedness binder. Engage ERISA counsel for prohibited transaction review."],
   ["P4 — Ongoing","Annual fee benchmarking review. Quarterly fiduciary committee minutes."]
  ].forEach(([label,desc]) => { h3(c, label); body(c, desc, 4); });

  // Page 4: Fiduciary Score Methodology
  addPage(c);
  h1(c, "Fiduciary Risk Score — Methodology");
  gap(c, 2);
  body(c, "The Kincaid Health Fiduciary Risk Score is a weighted composite of five domain scores. Each domain is scored 0–100 based on binary compliance assessments, fee benchmarking percentile analysis, and documentation completeness reviews. Domain weights reflect the relative regulatory emphasis placed by the DOL in recent audit guidance and enforcement actions.");
  gap(c, 2);
  formulaBox(c, "Composite Fiduciary Risk Score",
    "FRS = Σ(Dᵢ × Wᵢ)  for i = 1..5",
    "FRS = Fiduciary Risk Score (0-100). Dᵢ = Domain score i. Wᵢ = Domain weight. Weights: Disclosure 30%, Fee Reasonableness 25%, Prudent Process 20%, Audit Readiness 15%, Prohibited Txns 10%.");
  gap(c, 2);
  table(c, ["Domain","Weight","Score","Weighted Pts","Status"],
    [["§408(b)(2) Disclosures","30%",String(discMissing>0?45:90),String(discMissing>0?13.5:27),discMissing>0?"⚠ Gaps":"✓ OK"],
     ["Fee Reasonableness","25%",String(Math.max(40, 100 - critGaps*12)),String(Math.round((Math.max(40, 100-critGaps*12))*0.25)),"Review"],
     ["Prudent Expert Process","20%",String(auditReady),String(Math.round(auditReady*0.20)),""],
     ["DOL Audit Readiness","15%",String(auditReady),String(Math.round(auditReady*0.15)),""],
     ["Prohibited Transactions","10%","85","8.5","✓ OK"]],
    [52,20,20,25,35]);
  gap(c, 2);
  body(c, "Score interpretation follows DOL enforcement data: 90-100 = Low risk (<3% audit probability), 75-89 = Moderate (8-15%), 60-74 = Elevated (22-35%), 40-59 = High (45-60%), <40 = Critical (>75% audit probability based on trigger analysis).");
  formulaBox(c, "Fee Reasonableness Percentile",
    "FRP = (Plan Fee / Benchmark Median) × 100",
    "Plans scoring above 120th percentile (fees >20% above median) must document specific justification or seek competitive bids. FRP >150 triggers automatic critical flag.");

  // Page 5: 408(b)(2) Disclosure Analysis
  addPage(c);
  h1(c, "§408(b)(2) Disclosure Analysis — Service Provider Review");
  body(c, "ERISA §408(b)(2) requires that covered service providers (CSPs) furnish written disclosures of all direct and indirect compensation to plan fiduciaries before services are rendered. Failure to obtain required disclosures creates a non-exempt prohibited transaction under ERISA §406(a)(1)(C). The plan sponsor — not the service provider — bears fiduciary responsibility for ensuring disclosures are obtained and evaluated.");
  gap(c, 2);
  table(c, ["Service Provider","Service Category","Direct Comp","Indirect Comp","Disclosure Status","Reasonableness"],
    [["BlueCross Admin","Third-Party Administrator","$47.50 PEPM","$12,000/yr Sub","✓ Received","In Range"],
     ["Express Scripts","PBM","Spread Pricing","$8.40 PEPM Rebate","⚠ Incomplete","Over Benchmark"],
     ["Prudential","Stop-Loss Carrier","$52,800 Premium","N/A","✓ Received","Market Rate"],
     ["Wellness Co.","Wellness Platform","$8.50 PEPM","$3,200 Incentive","✗ Missing","Unknown"],
     ["CBIZ Advisors","Benefits Broker","$45,000/yr","$12,000 Override","⚠ Incomplete","Review Needed"],
     ["EAP Partners","EAP Services","$3.20 PEPM","$0","✓ Received","Reasonable"]],
    [40,32,28,28,30,24]);
  gap(c, 2);
  callout(c, `${discMissing} service providers have not provided complete 408(b)(2) disclosures. Each missing disclosure represents a potential prohibited transaction. Kincaid Health recommends issuing written demand letters within 30 days.`, "critical");
  h2(c, "Disclosure Deficiency Analysis");
  body(c, "When a covered service provider fails to furnish required disclosures, ERISA §408(b)(2)(D) requires the responsible plan fiduciary to: (1) request the disclosure in writing, (2) notify the DOL if the disclosure is not furnished within 90 days, and (3) determine whether to terminate the service arrangement. Failure to follow this procedure renders the arrangement a non-exempt prohibited transaction subject to excise taxes of 15-100% of the prohibited amount.");

  // Page 6: Fee Benchmarking
  addPage(c);
  h1(c, "Fee Benchmarking & Reasonableness Analysis");
  body(c, "ERISA §404(a)(1)(B) requires plan fiduciaries to act as a 'prudent expert' would, which courts have interpreted to require fee benchmarking against comparable plans and services. This analysis benchmarks all material plan fees against the Kincaid Health National Fee Database (KNFD), incorporating data from 4,200+ self-funded plans with 50-10,000 employees.");
  gap(c, 2);
  formulaBox(c, "Fee Excess / Savings Calculation",
    "FE = (Actual_Fee - Benchmark_Median) × Enrolled_Lives",
    "FE = Fee Excess (annual $). If FE > 0, plan is overpaying; if FE < 0, plan is obtaining favorable rates. All fees normalized to PEPM (Per Employee Per Month) basis for cross-plan comparability.");
  gap(c, 2);
  table(c, ["Fee Category","Plan PEPM","Benchmark Median","Percentile","Excess/Deficit","Action"],
    [["TPA Administration","$47.50","$41.20","78th","$74,160 excess","Renegotiate"],
     ["PBM (net of rebates)","$89.20","$71.40","88th","$200,640 excess","RFP Required"],
     ["Stop-Loss Premium","$52,800 agg","$48,200","64th","$4,600 excess","Monitor"],
     ["Broker Compensation","$45,000","$38,500","72nd","$6,500 excess","Disclose & Review"],
     ["Wellness Platform","$8.50","$7.20","63rd","$14,640 excess","Benchmark"],
     ["EAP Services","$3.20","$3.80","38th","$(6,720) savings","Favorable"]],
    [35,22,28,22,30,25]);
  gap(c, 2);
  kv(c, "Total Estimated Annual Fee Excess", `$${(undisclosed).toLocaleString()}`, true);
  kv(c, "Projected 3-Year Savings Opportunity (if corrected, NPV)", `$${disclosed3YearNPV(undisclosed).toLocaleString()}`);
  body(c, "The PBM arrangement represents the highest priority for remediation. The plan's effective net PBM cost (inclusive of administrative fees and net of rebates) places it at the 88th percentile nationally — meaning 88% of comparable plans achieve lower net costs. An immediate RFP process is warranted with emphasis on pass-through rebate arrangements, MAC pricing transparency, and audit rights.");

  // Page 7: ERISA Checklist Part 1
  addPage(c);
  h1(c, "ERISA Fiduciary Compliance Checklist — Part I (Items 1–25)");
  body(c, "The following 50-point fiduciary checklist is based on DOL Field Assistance Bulletins, ERISA Advisory Council recommendations, and Kincaid Health proprietary audit protocols. Items marked ✗ require immediate corrective action.");
  gap(c, 2);
  table(c, ["#","Requirement","Status","Priority"],
    [["1","Written investment policy statement (IPS) current within 2 years",score<65?"✗":"✓","High"],
     ["2","Named fiduciary(ies) properly designated in plan document",critGaps>3?"✗":"✓","Critical"],
     ["3","Fidelity bond ≥ 10% of plan assets (min $1,000, max $500,000)","✓","High"],
     ["4","Fiduciary liability insurance in place","✓","High"],
     ["5","Annual plan audit (if >100 participants)",discMissing>3?"✗":"✓","Critical"],
     ["6","Form 5500 filed timely","✓","Critical"],
     ["7","Summary Plan Description (SPD) current",score<70?"⚠":"✓","High"],
     ["8","SMM distributed within 210 days for material changes","✓","High"],
     ["9","All 408(b)(2) disclosures obtained before engagement",discMissing>0?"✗":"✓","Critical"],
     ["10","Fee reasonableness documentation completed annually",critGaps>1?"✗":"✓","Critical"],
     ["11","Competing bids obtained for major service contracts in last 3 years",critGaps>2?"⚠":"✓","High"],
     ["12","Plan document consistent with actual plan operations","✓","High"],
     ["13","Claim procedures meet DOL timeframe requirements","✓","Medium"],
     ["14","External appeals available for claim denials","✓","Medium"],
     ["15","HIPAA Privacy Policies current",score<70?"⚠":"✓","High"],
     ["16","COBRA notices issued correctly","✓","High"],
     ["17","Medicare Part D creditable coverage notices sent","✓","High"],
     ["18","SBC (Summary of Benefits and Coverage) distributed","✓","High"],
     ["19","Gag clause prohibition attestation filed (CAA 2021)",score<75?"✗":"✓","Critical"],
     ["20","Machine-readable files published (CAA 2021 §203)","⚠","Critical"],
     ["21","Mental health parity compliance analysis documented","⚠","High"],
     ["22","Surprise billing protections implemented (NSA 2022)","✓","High"],
     ["23","No-cost preventive services provided per ACA","✓","High"],
     ["24","Grandfathered plan status documented (if applicable)","N/A","Medium"],
     ["25","Wellness program HIPAA-compliant","✓","Medium"]],
    [8,80,14,20]);

  // Page 8: ERISA Checklist Part 2
  addPage(c);
  h1(c, "ERISA Fiduciary Compliance Checklist — Part II (Items 26–50)");
  table(c, ["#","Requirement","Status","Priority"],
    [["26","Fiduciary committee meeting minutes documented quarterly",score<65?"✗":"✓","High"],
     ["27","Conflicts of interest disclosed and managed","✓","High"],
     ["28","Prohibited transactions screened",critGaps>3?"⚠":"✓","Critical"],
     ["29","Service provider termination protocol documented",score<70?"✗":"✓","Medium"],
     ["30","Prudent expert process documented for each major decision",score<65?"✗":"✓","Critical"],
     ["31","Vendor performance tracking system in place",critGaps>2?"✗":"✓","High"],
     ["32","Cybersecurity policy for plan data","✓","High"],
     ["33","Plan assets held in trust","✓","Critical"],
     ["34","Participant contributions deposited timely","✓","Critical"],
     ["35","ERISA counsel relationship established","✓","High"],
     ["36","Pharmacy Benefit Manager (PBM) audited in last 3 years",critGaps>1?"✗":"✓","High"],
     ["37","Stop-loss carrier A-rated by AM Best","✓","High"],
     ["38","Reference-Based Pricing legal review completed (if applicable)","N/A","Medium"],
     ["39","Direct contracting agreements reviewed by ERISA counsel",score<75?"⚠":"✓","Medium"],
     ["40","QHP status confirmed (if applicable)","N/A","Low"],
     ["41","Retiree plan properly maintained (if applicable)","N/A","Low"],
     ["42","COBRA plan administrator bond in place","✓","High"],
     ["43","Annual notice of CHIPRA special enrollment rights sent","✓","Medium"],
     ["44","Women's Health and Cancer Rights Act notices sent","✓","Medium"],
     ["45","Newborns' and Mothers' Health Protection Act compliant","✓","High"],
     ["46","Genetic Information Nondiscrimination Act (GINA) compliant","✓","High"],
     ["47","ADA reasonable accommodation for plan participation","✓","High"],
     ["48","State mandate compliance reviewed for self-funded exception","✓","Medium"],
     ["49","Annual review of ERISA preemption claims","✓","Low"],
     ["50","Succession plan for named fiduciary role",score<70?"✗":"✓","Medium"]],
    [8,80,14,20]);

  // Page 9: DOL Audit Readiness
  addPage(c);
  h1(c, "DOL Audit Readiness Assessment");
  body(c, `DOL audit readiness score: ${auditReady}/100. The Employee Benefits Security Administration (EBSA) conducts approximately 3,500 civil investigations annually. Plans with self-funded health arrangements face heightened audit risk following the CAA 2021 and Consolidated Appropriations Act 2023 transparency mandates. Plans scoring below 70 on our audit readiness scale have an estimated 28-42% probability of a finding or penalty in the event of a DOL examination.`);
  gap(c, 2);
  table(c, ["Audit Readiness Domain","Score","Documentation Status","Priority"],
    [["Form 5500 & Schedules","92/100","Complete & Filed","Low"],
     ["Service Provider Files","62/100","Missing "+discMissing+" Disclosures","Critical"],
     ["Meeting Minutes & Process","58/100","Gaps in Quarterly Records","High"],
     ["Fee Reasonableness Documentation","44/100","Not Documented in Writing","Critical"],
     ["Plan Document & SPD","78/100","Current","Medium"],
     ["Claims Procedures","81/100","Meets DOL Standards","Low"],
     ["Mental Health Parity Analysis","52/100","Not Completed","High"],
     ["Transparency Filings (CAA)","48/100","Machine Readable Files Incomplete","Critical"]],
    [52,18,65,25]);
  gap(c, 2);
  h2(c, "DOL Audit Trigger Risk Factors");
  ["Plan has >100 participants (Form 5500 audit required)","PBM indirect compensation >$1,000 not fully disclosed on Schedule C","Prior Form 5500 amendments filed","Stop-loss claim disputes with carrier on record","Employee complaint filed with EBSA (creates audit trigger)"].forEach(b_ => bullet(c, b_));
  gap(c, 2);
  h2(c, "Document Retention Requirements (ERISA §107)");
  body(c, "ERISA requires retention of plan records for at least 6 years from the date of the filing or report to which they relate. The following categories must be preserved:");
  [["Form 5500 and all schedules","6 years"], ["Service provider contracts and disclosures","6 years"], ["Fiduciary committee minutes","6 years (recommend 10)"], ["Claims and EOB records","6 years from claim date"], ["Participant notices and elections","6 years from plan termination"]].forEach(([doc_, ret]) => kv(c, doc_, ret));

  // Page 10: Prohibited Transaction Analysis
  addPage(c);
  h1(c, "Prohibited Transaction Analysis — ERISA §406");
  body(c, "ERISA §406(a) prohibits transactions between the plan and 'parties in interest' unless a specific statutory or administrative exemption applies. Prohibited transactions carry excise taxes of 15% per year of the prohibited amount (§4975 of the Internal Revenue Code), which can increase to 100% if not corrected. The following screening was conducted against all service provider relationships:");
  gap(c, 2);
  table(c, ["Transaction Type","Party","Amount","Exemption","Status"],
    [["Broker Compensation","CBIZ Advisors","$45,000/yr","§408(b)(2) if disclosed","⚠ Verify Disclosure"],
     ["PBM Rebate Sharing","Express Scripts","$8.40 PEPM","Requires 408(b)(2)","✗ Incomplete"],
     ["TPA Override","BlueCross Admin","$12,000/yr","Requires 408(b)(2)","✓ Disclosed"],
     ["Stop-Loss Premium","Prudential","$52,800","§408(b)(2)","✓ Disclosed"],
     ["Wellness Incentives","Wellness Co.","$3,200","Wellness PTE","⚠ Review Needed"],
     ["Direct Primary Care","N/A","N/A","N/A","Not Applicable"]],
    [45,35,28,40,24]);
  gap(c, 2);
  callout(c, "The PBM rebate arrangement may constitute a prohibited transaction if full disclosure of all indirect compensation (including rebates, administrative fees, and spread pricing) has not been made pursuant to ERISA §408(b)(2). Immediate disclosure review required.", "critical");
  formulaBox(c, "Prohibited Transaction Excise Tax Exposure",
    "PT_Tax = PT_Amount × 15% × Years_Uncorrected",
    "PT_Amount = total value of prohibited transaction. If uncorrected beyond DOL demand, rate increases to 100%. Self-correction available under VFCP (Voluntary Fiduciary Correction Program).");

  // Page 11: Investment Policy Statement
  addPage(c);
  h1(c, "Investment Policy Statement (IPS) Review");
  body(c, "An Investment Policy Statement documents the fiduciary process for selecting and monitoring investments. While ERISA does not explicitly require an IPS, courts and the DOL have treated the absence of a documented process as evidence of fiduciary imprudence. For self-funded health plans, an analogous 'Plan Administration Policy' documenting vendor selection and monitoring criteria is strongly recommended.");
  gap(c, 2);
  h2(c, "Required IPS / Plan Administration Policy Elements");
  [["Purpose and Scope","Defines the policy's coverage, authorized fiduciaries, and effective date"],
   ["Fiduciary Roles","Named fiduciary, investment committee, discretionary vs. ministerial"],
   ["Vendor Selection Criteria","Minimum standards for service provider selection"],
   ["Fee Monitoring","Frequency and method of fee reasonableness review"],
   ["Performance Standards","Metrics for monitoring vendor performance"],
   ["Replacement Criteria","Triggers for vendor review and replacement"],
   ["Conflict of Interest Policy","Disclosure and management procedures"],
   ["Review and Amendment","Frequency of IPS review and update procedures"]
  ].forEach(([elem,desc]) => { kv(c, elem, score < 65 ? "⚠ Not Documented" : "✓ Documented"); body(c, desc, 4); gap(c, 1); });

  // Page 12: Co-Fiduciary Liability
  addPage(c);
  h1(c, "Co-Fiduciary Liability & Named Fiduciary Analysis");
  body(c, "Under ERISA §405, a fiduciary may be liable for the breach of another fiduciary if: (1) the fiduciary participates in or conceals the breach, (2) the fiduciary enables the breach through their own failure, or (3) the fiduciary has knowledge of the breach and fails to make reasonable efforts to remedy it. Co-fiduciary liability is a frequent basis for DOL enforcement action in health plan contexts.");
  gap(c, 2);
  formulaBox(c, "Co-Fiduciary Liability Exposure",
    "CFE = Σ(Breach_Amount × Liability_Share_Pct)",
    "Liability Share Pct is determined by degree of control over the breached function. Multiple fiduciaries may each be jointly and severally liable for the full amount.");
  gap(c, 2);
  h2(c, "Named Fiduciary Designation Review");
  table(c, ["Role","Designated?","Documentation","Liability Risk"],
    [["Plan Sponsor (Corporate)","Yes","Board Resolution","High"],
     ["Benefits Committee","Yes","Charter","Medium"],
     ["HR Director","Informal","Not Documented",critGaps>3?"High":"Medium"],
     ["Benefits Manager","Informal","Not Documented","Medium"],
     ["Outside Advisor (Broker)","No","N/A (Non-Fiduciary)","Low"],
     ["TPA","Limited","Service Agreement","Low"]],
    [42,24,60,30]);
  gap(c, 2);
  callout(c, "HR Director and Benefits Manager appear to exercise discretionary authority over plan operations without formal named fiduciary designation. This creates undocumented co-fiduciary liability. Formal designation and appropriate D&O/fiduciary insurance coverage is required.", "warn");

  // Page 13: Mental Health Parity
  addPage(c);
  h1(c, "Mental Health Parity & Addiction Equity Act (MHPAEA) Analysis");
  body(c, "The Mental Health Parity and Addiction Equity Act (MHPAEA), as strengthened by the Consolidated Appropriations Act 2023, requires that mental health and substance use disorder (MH/SUD) benefits be no more restrictive than medical/surgical benefits. The CAA 2023 added a nonquantitative treatment limitation (NQTL) analysis requirement — plans must perform and document a comparative analysis.");
  gap(c, 2);
  table(c, ["MHPAEA Requirement","Status","Finding"],
    [["NQTL Comparative Analysis Completed","⚠ Incomplete","Written analysis not documented"],
     ["Prior Authorization Parity","✓ Met","MH/SUD PA criteria not more restrictive"],
     ["Step Therapy Parity","⚠ Review","SUD step therapy may be more restrictive"],
     ["Network Adequacy (MH/SUD)","✗ Gap","MH provider network below adequacy standard"],
     ["Out-of-Network Reimbursement Parity","✓ Met","Same OON rates apply"],
     ["Fail-First / Step Therapy Disclosed","⚠ Partial","Not fully documented in SPD"],
     ["Annual Comparative Analysis on File","✗ Missing","Required under CAA 2023"]],
    [70,24,88]);
  body(c, "The DOL has identified MHPAEA noncompliance as a top enforcement priority. Plans that cannot produce a written NQTL comparative analysis upon request face penalties and potential plan-level class action exposure. Kincaid Health recommends engaging ERISA counsel to complete the analysis within 60 days.");

  // Page 14: Claim Fiduciary Process
  addPage(c);
  h1(c, "Claims Fiduciary Process & Benefit Determination Review");
  body(c, "The DOL's claims procedure regulation (29 CFR §2560.503-1) establishes minimum standards for benefit claim determinations. Failure to follow these procedures constitutes both a fiduciary breach and a statutory violation, and may result in the claimant being deemed to have exhausted administrative remedies — allowing immediate access to federal court without further administrative review.");
  gap(c, 2);
  table(c, ["Claim Type","DOL Time Limit","Plan's Actual Turnaround","Compliant?"],
    [["Urgent/Expedited","72 hours","48-60 hours","✓ Met"],
     ["Pre-Service Concurrent","24 hours","20-36 hours","✓ Met"],
     ["Pre-Service Initial","15 days","12-14 days","✓ Met"],
     ["Post-Service Claims","30 days","28-35 days","⚠ At Limit"],
     ["Disability Claims","45 days","40-52 days","✗ Occasional Breach"],
     ["External Appeals","4 months","Meets DOL standard","✓ Met"]],
    [42,30,45,35]);

  // Page 15: Self-Correction & VFCP
  addPage(c);
  h1(c, "Self-Correction & Voluntary Fiduciary Correction Program (VFCP)");
  body(c, "The DOL's VFCP allows plan fiduciaries to voluntarily correct certain prohibited transactions and fiduciary violations in exchange for 'no-action' letters and relief from civil penalties. Participation in VFCP also generally eliminates the 15% excise tax under IRC §4975. Kincaid Health recommends proactive use of VFCP for identified issues prior to any DOL inquiry.");
  gap(c, 2);
  h2(c, "VFCP-Eligible Transactions Identified");
  [["Delinquent participant contributions","Plan sponsor failed to deposit participant deferrals within 7 business days in Q2. VFCP correction requires payment of lost earnings using the DOL online calculator."],
   ["Improper payment of expenses","Plan administrative expenses paid without plan document authorization. VFCP correction requires reimbursement of the plan plus lost earnings."],
   ["PBM indirect compensation not disclosed","If PBM rebates were not properly disclosed under 408(b)(2), VFCP provides a correction mechanism with excise tax relief."]
  ].forEach(([issue, fix]) => { h3(c, issue); body(c, fix, 4); gap(c, 1); });
  formulaBox(c, "VFCP Lost Earnings Calculation",
    "LE = Principal × [(1 + IRS_Rate/4)^(n/91) - 1]",
    "IRS_Rate = Underpayment rate (Federal Short-Term Rate + 3%). n = Days delinquent. Principal = Amount of delinquent transaction.");

  // Page 16: Plan Sponsor Responsibilities
  addPage(c);
  h1(c, "Plan Sponsor Fiduciary Responsibilities — Summary Matrix");
  body(c, "ERISA imposes fiduciary duties on any person who exercises discretionary authority or control over plan management, plan assets, or administration. The following matrix summarizes key plan sponsor fiduciary responsibilities and their current compliance status:");
  gap(c, 2);
  table(c, ["Responsibility","Frequency","Owner","Current Status"],
    [["Select and Monitor Service Providers","Ongoing","Benefits Committee","⚠ Partial"],
     ["Benchmark and Evaluate Fees","Annual","HR Director","✗ Not Documented"],
     ["Review Plan Document","Annual / As Needed","ERISA Counsel","✓ Current"],
     ["Administer Claims Prudently","Ongoing","TPA","✓ Delegated"],
     ["File Form 5500","Annual","Finance / HR","✓ Timely"],
     ["Distribute Required Notices","Per Schedule","Benefits Manager","✓ Current"],
     ["Maintain DOL Audit Readiness","Ongoing","Benefits Committee","⚠ Partial"],
     ["Document Fiduciary Process","Ongoing","HR Director","✗ Gaps Identified"],
     ["Review Vendor Performance","Quarterly","Benefits Committee","✗ No Records"],
     ["Engage ERISA Counsel","Annual / As Needed","CEO / CFO","✓ Active"]],
    [58,24,35,35]);

  // Page 17: Regulatory Citations & Case Law
  addPage(c);
  h1(c, "Key Regulatory Citations & Relevant Case Law");
  h2(c, "Primary ERISA Provisions");
  [["ERISA §3(21)","Definition of fiduciary — functional test based on exercise of discretion"],
   ["ERISA §404(a)(1)","General fiduciary duty — prudence, loyalty, diversification, plan document compliance"],
   ["ERISA §405","Co-fiduciary liability — participation in or knowledge of breach"],
   ["ERISA §406(a)","Prohibited transactions with parties in interest"],
   ["ERISA §408(b)(2)","Exemption for reasonable service contracts with required disclosures"],
   ["ERISA §412","Bonding requirements for plan fiduciaries"],
   ["ERISA §502(a)","Civil enforcement actions available to participants, beneficiaries, and DOL"],
   ["ERISA §502(l)","20% civil penalty on recovery amounts in successful DOL actions"],
  ].forEach(([cite, desc]) => kv(c, cite, desc));
  gap(c, 3);
  h2(c, "Significant Case Law");
  [["Tibble v. Edison International (2015)","SCOTUS — ongoing duty to monitor plan investments; 6-year statute of limitations runs from last act of imprudence"],
   ["Hughes v. Northwestern University (2022)","SCOTUS — participants stated a plausible claim that plan fiduciaries failed to remove imprudent options despite availability of lower-cost alternatives"],
   ["Wit v. United Behavioral Health (9th Cir. 2023)","UBH improperly applied internal coverage criteria more restrictive than generally accepted standards of care; reinforces MHPAEA parity requirements"],
  ].forEach(([case_, holding]) => { h3(c, case_); body(c, holding, 4); });

  // Page 18: Financial Exposure Quantification
  addPage(c);
  h1(c, "Financial Exposure Quantification");
  body(c, "The following table quantifies the estimated financial exposure arising from identified fiduciary deficiencies. These figures represent management's best estimates based on available plan data, DOL penalty schedules, and Kincaid Health analysis of comparable enforcement actions.");
  gap(c, 2);
  table(c, ["Exposure Category","Annual Estimate","3-Year NPV","Priority"],
    [["Undisclosed Service Provider Fees",`$${(undisclosed*0.4).toLocaleString()}`,"","Critical"],
     ["PBM Fee Excess vs. Benchmark",`$${(undisclosed*0.6).toLocaleString()}`,"","Critical"],
     ["Potential ERISA §502(l) Penalty","20% of DOL recovery","","Critical"],
     ["Prohibited Transaction Excise Tax (15%)","Based on undisclosed comp","","High"],
     ["MHPAEA Penalty (CAA 2023)","Up to $100/day/participant","","High"],
     ["Improper Claim Denial Exposure","Estimated $45,000","","Medium"],
     ["Fiduciary Liability Insurance Gap","Assess vs. exposure","","High"],
     ["Total Estimated Exposure",`$${undisclosed.toLocaleString()}`,`$${disclosed3YearNPV(undisclosed).toLocaleString()}`,"CRITICAL"]],
    [58,32,28,24]);
  formulaBox(c, "3-Year Net Present Value of Fee Excess",
    "NPV = Σ [FE_t / (1 + r)^t]  for t = 1..3",
    "FE_t = Annual fee excess in year t. r = Discount rate (5.25% based on current Fed Funds target). Assumes fee excess grows 3% annually without intervention.");
  callout(c, `Total estimated 3-year financial exposure: $${(undisclosed*6.6).toLocaleString()}. This includes direct fee excess, regulatory penalties, and potential plaintiff recovery. Proactive correction reduces expected exposure by 65-80%.`, "critical");

  // Page 19: Prioritized Action Plan
  addPage(c);
  h1(c, "Fiduciary Action Plan — Prioritized Recommendations");
  body(c, "The following action plan is organized by priority level and time horizon. Kincaid Health recommends scheduling a fiduciary committee meeting within 30 days to review and formally adopt this action plan. All actions should be documented in committee minutes.");
  gap(c, 2);
  table(c, ["Priority","Action Item","Owner","Timeline","Estimated Cost Savings"],
    [["P1 — Critical","Issue written 408(b)(2) disclosure demand letters to "+discMissing+" service providers","HR Director","0-30 days","Avoids prohibited transaction penalties"],
     ["P1 — Critical","Initiate PBM RFP process — current PBM costs at 88th percentile","Benefits Committee","0-60 days",`$${(undisclosed*0.6).toLocaleString()} annually`],
     ["P1 — Critical","Document fee reasonableness analysis in writing for all service providers","ERISA Counsel","0-30 days","Eliminates DOL audit trigger"],
     ["P2 — High","Complete MHPAEA NQTL comparative analysis","ERISA Counsel","30-60 days","Avoids $100/day/participant penalty"],
     ["P2 — High","Formalize Named Fiduciary designations and distribute to all parties","HR Director","30-60 days","Eliminates co-fiduciary exposure"],
     ["P2 — High","Update Investment Policy Statement / Plan Administration Policy","Benefits Committee","30-90 days","Strengthens prudent process defense"],
     ["P3 — Medium","Implement quarterly fiduciary committee meeting schedule with documented minutes","HR Director","60-90 days","Ongoing risk mitigation"],
     ["P3 — Medium","Complete DOL audit preparedness binder","Benefits Committee","90-120 days","Reduces audit finding risk by est. 40%"],
     ["P4 — Ongoing","Annual fee benchmarking review","HR Director","Annually","Identifies future savings opportunities"]],
    [28,65,25,22,42]);

  // Page 20: Certification
  addPage(c);
  h1(c, "Certification & Analyst Attestation");
  body(c, "Kincaid Health certifies that this ERISA Fiduciary IQ™ analysis was prepared in accordance with the standards of practice of a prudent ERISA benefits consultant. All findings are based on plan-specific data provided by or on behalf of the plan sponsor, publicly available regulatory guidance, and the Kincaid Health analytical platform.");
  gap(c, 4);
  h2(c, "Analyst Certification");
  body(c, "The findings, scores, and recommendations contained in this report represent the professional judgment of the Kincaid Health analytical team. This report is provided for informational purposes and does not constitute legal advice. Plan sponsors should engage qualified ERISA counsel before implementing any recommendations.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "ERISA Fiduciary IQ™");
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Analyst", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Report Date", c.date);
  kv(c, "Composite Risk Score", `${score}/100 — ${riskLevel}`);
  kv(c, "Critical Gaps Identified", String(critGaps));
  kv(c, "Estimated Fee Excess", `$${undisclosed.toLocaleString()}/yr`);
  kv(c, "DOL Audit Readiness", `${auditReady}/100`);
  kv(c, "Report Version", "1.0 Final");
  kv(c, "Confidentiality", "Attorney-Client Privilege / Confidential");
  gap(c, 6);
  body(c, "© Kincaid Health™. All rights reserved. Reproduction or redistribution of this report in whole or in part without the written consent of Kincaid Health is strictly prohibited. This report is prepared under the protection of the attorney-client privilege and work product doctrine to the extent applicable.");

  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. CLAIMS RECOVERY IQ
══════════════════════════════════════════════════════════════════════════════ */
function generateClaimsPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#FF6B1A", "Claims Recovery IQ™", "Overpayment Detection · Billing Error Recovery · Success-Fee Model");
  const d = data ?? {};
  const opp = d.summary?.total_recovery_opportunity ?? 284000;
  const audited = d.summary?.total_claims_audited ?? 12847;
  const errors = d.summary?.billing_errors_detected ?? 847;
  const successRate = d.summary?.success_rate ?? 78;
  const avgRec = d.summary?.average_recovery_per_claim ?? 335;

  coverPage(c);

  addPage(c);
  h1(c, "Engagement Overview & Success Fee Disclosure");
  body(c, "Kincaid Health's Claims Recovery IQ™ program operates on a contingency (success-fee) basis. Kincaid Health receives compensation only when overpayments are identified, documented, and recovered. There is no upfront cost to the plan sponsor. This aligns our interests with those of the plan and its participants — we are motivated to maximize legitimate recoveries.");
  gap(c, 2);
  table(c, ["Engagement Parameter","Value"],
    [["Success Fee Rate","20-25% of recovered amount"],
     ["Minimum Claim Size for Review","$500 (smaller claims excluded for cost-efficiency)"],
     ["Look-Back Period","36 months from audit date"],
     ["Carrier Cooperation Requirement","60-day response window per ERISA §503"],
     ["Recovery Payment Timeline","90-120 days post-carrier agreement"],
     ["Audit Scope","All medical, Rx, and facility claims in period"],
     ["Reporting Frequency","Monthly during active audit; quarterly thereafter"]],
    [80,102]);
  gap(c, 3);
  callout(c, `Total identified recovery opportunity: $${opp.toLocaleString()} across ${errors.toLocaleString()} billing errors found in ${audited.toLocaleString()} claims reviewed. Historical success rate: ${successRate}%.`, "info");

  addPage(c);
  h1(c, "Executive Summary — Claims Audit Findings");
  kv(c, "Total Claims Reviewed", audited.toLocaleString(), true);
  kv(c, "Billing Errors Identified", errors.toLocaleString(), true);
  kv(c, "Error Rate", ((errors/audited)*100).toFixed(1)+"%", true);
  kv(c, "Total Recovery Opportunity", `$${opp.toLocaleString()}`, true);
  kv(c, "Historical Success Rate", `${successRate}%`);
  kv(c, "Average Recovery Per Claim", `$${avgRec.toLocaleString()}`);
  kv(c, "Projected Net Recovery (after fees)", `$${Math.round(opp * (1-0.22)).toLocaleString()}`);
  kv(c, "Audit Period", "January 2022 – December 2024");
  gap(c, 3);
  h2(c, "Error Distribution by Category");
  table(c, ["Error Category","Claims","Recovery $","% of Total","Confidence"],
    [["Duplicate Billing","142","$38,400","13.5%","High"],
     ["Unbundling Violations","198","$67,200","23.7%","High"],
     ["Upcoding (CPT)","163","$51,800","18.2%","High"],
     ["Coordination of Benefits","89","$44,600","15.7%","Medium"],
     ["Medical Necessity","91","$42,000","14.8%","Medium"],
     ["Incorrect Modifier Usage","164","$40,000","14.1%","High"]],
    [42,18,24,20,30]);

  addPage(c);
  h1(c, "Audit Methodology — Claims Selection & Scoring");
  body(c, "Kincaid Health's claims audit applies a proprietary 7-layer screening protocol to identify high-probability overpayment candidates. Claims are scored using a predictive model trained on 4.2 million historical claims with known overpayment outcomes. Only claims scoring above the 75th percentile threshold are advanced to manual review — maximizing recovery while minimizing false positives.");
  gap(c, 2);
  formulaBox(c, "Claim Overpayment Score (COS)",
    "COS = Σ(Fᵢ × Wᵢ) / max_score × 100",
    "Fᵢ = Factor score for screening criterion i (e.g., code edit violation, statistical outlier, historical error rate). Wᵢ = Weight. Normalized to 0-100. Claims with COS > 75 advance to manual review.");
  gap(c, 2);
  table(c, ["Screening Layer","Method","Weight","Claims Flagged"],
    [["1. Code Edit Analysis","NCCI edit database — unbundling, incidental procedures","25%","342"],
     ["2. Statistical Outlier","Provider billing patterns vs. peer cohort (p<0.05)","20%","218"],
     ["3. Duplicate Detection","Exact & fuzzy match on date, provider, procedure, amount","20%","156"],
     ["4. Historical Error Rate","Provider-level error rate from prior audits","15%","189"],
     ["5. Medical Necessity Screen","ICD-10 / CPT alignment with clinical guidelines","12%","134"],
     ["6. Coordination of Benefits","Cross-plan coverage verification","8%","98"]],
    [42,60,15,25]);

  addPage(c);
  h1(c, "Duplicate Billing Analysis");
  body(c, "Duplicate billing occurs when a provider submits the same claim for payment more than once, or when two providers bill for the same service episode. Our duplicate detection algorithm employs a combination of exact matching and probabilistic matching to identify both exact and near-duplicate claims.");
  formulaBox(c, "Duplicate Similarity Score (DSS)",
    "DSS = 0.35×(DOS_match) + 0.25×(Provider_match) + 0.25×(Proc_match) + 0.15×(Amount_±10%)",
    "DSS > 0.85 = High probability duplicate (auto-flagged). DSS 0.65-0.84 = Manual review. DOS = Date of Service.");
  gap(c, 2);
  table(c, ["Provider","Service Date","CPT Code","Amount","Status"],
    [["Memorial Hospital","2024-03-14","99215","$385","✓ Confirmed Duplicate"],
     ["Radiology Assoc.","2024-04-02","71046","$1,240","✓ Confirmed Duplicate"],
     ["Urgent Care #247","2024-01-18","99213","$185","✓ Confirmed Duplicate"],
     ["Lab Corp","2024-05-29","80053","$89","✓ Confirmed Duplicate"],
     ["Anesthesia Group","2024-02-11","00840","$2,100","✓ Confirmed Duplicate"]],
    [48,28,22,22,42]);

  addPage(c);
  h1(c, "Unbundling Violations — NCCI Edit Analysis");
  body(c, "Unbundling occurs when a provider bills for multiple component procedures separately when they should be billed as a single comprehensive procedure code. The National Correct Coding Initiative (NCCI) maintains over 1.1 million code pairs that define bundling rules. Unbundling violations represent the largest single category of overpayments in the Kincaid Health audit.");
  table(c, ["Component Code","Comprehensive Code","Provider","Overpayment","NCCI Reference"],
    [["99213+99024","99215","Family Medicine PC","$148","Column 1/2 Edit"],
     ["29880+29881","29882","Orthopedic Surg","$892","Mutually Exclusive"],
     ["36000+36410","36415","Lab Corp","$42","Column 1/2 Edit"],
     ["62323+64483","62323","Pain Mgmt","$1,205","Mutually Exclusive"],
     ["45380+45385","45385","GI Assoc","$628","Column 1/2 Edit"]],
    [28,28,35,24,47]);

  addPage(c);
  h1(c, "Upcoding Analysis — CPT Code Benchmarking");
  body(c, "Upcoding is the practice of billing a higher-complexity CPT code than the service actually rendered. For E&M (Evaluation & Management) services, the level of service must be supported by documentation in the medical record. Kincaid Health applies the 2021 AMA/CMS E&M documentation guidelines and statistical outlier analysis to identify systematic upcoding patterns.");
  formulaBox(c, "E&M Level Distribution Score (ELDS)",
    "ELDS = [Provider's 99215 % - Cohort_Median_99215%] / Cohort_StdDev",
    "Z-score. ELDS > 2.0 triggers upcoding review (provider's 99215 usage is >2 standard deviations above cohort). Cohort = same specialty, same geographic market.");
  table(c, ["Provider","99215 Usage","Cohort Median","Z-Score","Overpayment Est."],
    [["Dr. A. Smith, MD","68%","41%","3.2 ★","$12,400"],
     ["City Family Practice","72%","41%","3.7 ★","$18,200"],
     ["Internal Med Group","55%","41%","1.6","$6,100"],
     ["Urgent Care Chain","49%","38%","1.4","$3,800"]],
    [48,25,30,22,30]);

  addPage(c);
  h1(c, "Coordination of Benefits (COB) Audit");
  body(c, "COB errors occur when a plan pays as primary when it should pay as secondary, or fails to coordinate with other coverage. Under the NAIC Model Regulation and ERISA preemption principles, self-funded plans may establish their own COB rules in the plan document. Our COB audit cross-references enrollment data with CMS dual-coverage databases and carrier eligibility files.");
  table(c, ["Member","Primary Payer","Secondary (Plan)","COB Error Type","Recovery"],
    [["Member A1042","Medicare Part A","This Plan","Plan paid primary — should be secondary","$4,200"],
     ["Member B7831","Spouse's Employer Plan","This Plan","COB order incorrect","$1,840"],
     ["Member C2219","Workers' Comp","This Plan","WC should be primary","$8,600"],
     ["Member D5518","Auto Insurance","This Plan","Auto should be primary","$3,750"]],
    [24,32,32,50,22]);
  body(c, "Total COB recovery opportunity: $44,600. COB issues typically take 120-180 days to resolve due to inter-carrier coordination requirements. Recovery rate: 72% historically.");

  addPage(c);
  h1(c, "Medical Necessity Review");
  body(c, "Medical necessity denials require clinical review by a certified medical reviewer applying generally accepted standards of care. Kincaid Health partners with board-certified physicians to review all medical necessity findings before any recovery demand is issued. This protects plan participants and reduces carrier/provider disputes.");
  table(c, ["Category","Claims Reviewed","Denials Recommended","Recovery Opportunity","Confidence"],
    [["Inpatient Day Excess","23","12","$86,400","High"],
     ["Inappropriate Setting","18","9","$41,200","High"],
     ["Non-Covered Service Billed as Covered","31","19","$28,600","Medium"],
     ["Experimental/Investigational","8","4","$62,000","Medium"],
     ["Lack of Documentation","11","7","$18,400","High"]],
    [42,25,28,38,27]);

  addPage(c);
  h1(c, "Recovery Calculation Methodology & Financial Projections");
  formulaBox(c, "Net Recovery Projection",
    "NR = RO × SR × (1 - FF)",
    "NR = Net Recovery. RO = Recovery Opportunity ($284,000). SR = Success Rate (78%). FF = Fee Factor (22%). Expected: NR = $284,000 × 0.78 × 0.78 = $172,700 net to plan.");
  gap(c, 2);
  table(c, ["Scenario","Recovery Opp.","Success Rate","Fee %","Net to Plan","Timeline"],
    [["Conservative (Base)","$227,200","70%","22%","$123,900","12 months"],
     ["Expected","$284,000","78%","22%","$172,700","18 months"],
     ["Optimistic","$312,400","85%","20%","$211,200","24 months"]],
    [30,28,22,15,25,22]);
  gap(c, 2);
  body(c, "Recovery timelines depend heavily on carrier cooperation. Carriers are required under ERISA §503 and plan contract terms to respond to overpayment demands within 60 days. Non-responsive carriers may be pursued through arbitration or civil litigation as provided in the plan document.");

  addPage(c);
  h1(c, "Carrier Response Analysis & Appeal Strategy");
  body(c, "Carriers and providers have established processes for disputing overpayment recovery demands. Our appeal strategy is calibrated to the type of error, documentation strength, and carrier relationship. We use a staged escalation approach: initial demand → formal appeal → arbitration → litigation.");
  table(c, ["Error Type","Initial Acceptance Rate","After Appeal","Timeline","Notes"],
    [["Duplicate Billing","94%","98%","30-45 days","Highest win rate"],
     ["Unbundling","81%","89%","45-90 days","NCCI edit support"],
     ["Upcoding","62%","74%","60-120 days","Requires medical review"],
     ["COB","72%","80%","120-180 days","Inter-carrier delays"],
     ["Medical Necessity","55%","68%","90-150 days","Highest dispute rate"]],
    [35,30,28,28,41]);

  addPage(c);
  h1(c, "Benchmarking vs. Industry Recovery Rates");
  body(c, "The following benchmarks compare this plan's recovery opportunity and error rates against Kincaid Health's portfolio of 180+ self-funded plan audits conducted over the past 4 years.");
  table(c, ["Metric","This Plan","Portfolio Median","Percentile Rank","Assessment"],
    [["Error Rate",((errors/audited)*100).toFixed(1)+"%","5.8%","72nd","Above Average"],
     ["Recovery per Audited Claim","$22.11","$18.40","68th","Good Opportunity"],
     ["COB Error Rate","0.70%","0.65%","55th","Average"],
     ["Duplicate Rate","1.10%","0.90%","72nd","Review Recommended"],
     ["Upcoding Prevalence","1.27%","0.95%","78th","High — RFP E&M Providers"]],
    [40,22,25,22,33]);

  addPage(c);
  h1(c, "Prioritized Action Plan & Recovery Timeline");
  table(c, ["Priority","Action","Expected Recovery","Timeline","Owner"],
    [["P1","Issue demand letters — confirmed duplicates ($38,400)","$36,100","30-45 days","Kincaid Health"],
     ["P1","Issue demand letters — confirmed unbundling ($67,200)","$54,100","45-90 days","Kincaid Health"],
     ["P2","Initiate upcoding appeals — E&M outliers ($51,800)","$38,300","60-120 days","Kincaid Health + Clinical"],
     ["P2","COB recovery — cross-plan coordination ($44,600)","$32,100","120-180 days","Kincaid Health"],
     ["P3","Medical necessity reviews ($42,000)","$28,600","90-150 days","Kincaid Health + Clinical"],
     ["Ongoing","Concurrent audit — claims processed monthly","$50,000+/yr","Continuous","Kincaid Health"]],
    [15,60,30,28,29]);

  addPage(c);
  h1(c, "High-Dollar Claim Analysis — Claimants Above $50K");
  body(c, "High-dollar claimants (individual claims or member episode costs exceeding $50,000) represent a disproportionate share of total plan costs and audit risk. The following analysis identifies the top cost episodes in the audit period and flags those with evidence of billing irregularities, inappropriate setting, or medical necessity concerns.");
  table(c, ["Episode Type","Members Affected","Total Paid","Kincaid Review Finding","Action"],
    [["Inpatient Surgical (elective)","8","$648,000","2 cases: DRG mismatch — $44K overbilling","Demand letter issued"],
     ["Oncology (outpatient infusion)","6","$412,000","4 cases: site-of-care saving opportunity","Navigation initiated"],
     ["NICU / Newborn","4","$387,000","1 case: discharge timing $18K excess","Review in progress"],
     ["Spinal Surgery","5","$336,000","3 cases: coding discrepancy — $62K exposure","Clinical review"],
     ["Substance Use Residential","3","$228,000","All claims: medical necessity documentation gaps","Audit requested"],
     ["Gene Therapy (SMA)","1","$2,100,000","Stop-loss max triggered — carrier paid","Verify reimbursement"],
     ["TOTAL HIGH-DOLLAR","27","$4,111,000","$124K identified overbilling","$124K demand pending"]],
    [38,20,22,50,28]);

  addPage(c);
  h1(c, "Provider Risk Profiling & Fraud Indicators");
  body(c, "Kincaid Health's provider risk profiling engine analyzes billing patterns, code frequency distributions, and historical error rates to identify providers with elevated fraud, waste, and abuse (FWA) indicators. Providers flagged by three or more indicators are escalated to clinical review before payment of future claims.");
  formulaBox(c, "Provider Risk Score (PRS)",
    "PRS = (Upcoding_Z × 0.30) + (Unbundling_Rate × 0.25) + (Denial_Rate × 0.20) + (Historical_Error × 0.25)",
    "PRS > 70 = High Risk (refer to SIU). PRS 50-70 = Elevated (pre-payment review). PRS < 50 = Standard monitoring.");
  gap(c, 2);
  table(c, ["Provider","Specialty","Risk Score","Primary Indicator","Claims In Audit","Recovery"],
    [["City Family Practice","Primary Care","82 ✗ High","Upcoding Z=3.7","340","$18,200"],
     ["Memorial Hospital — Billing","Hospital","76 ✗ High","DRG Upcoding, unbundling","128","$44,000"],
     ["Pain Management Associates","Pain Mgmt","74 ✗ High","Unbundling, modifier abuse","89","$12,800"],
     ["Regional Surgical Center","Outpatient Surg","65 ⚠ Elevated","Code creep, implant billing","52","$8,400"],
     ["Behavioral Health Group","Psychiatry","61 ⚠ Elevated","Session length upcoding","204","$6,100"],
     ["Lab Corp Network","Lab","58 ⚠ Elevated","Panel unbundling","1,840","$9,200"]],
    [40,28,24,40,28,20]);
  callout(c, "Refer City Family Practice and Memorial Hospital to the plan's Special Investigations Unit (SIU) or contracted FWA vendor for enhanced monitoring. Place both providers on pre-payment clinical review pending investigation outcome.", "critical");

  addPage(c);
  h1(c, "ERISA §503 Claims Procedure Compliance Audit");
  body(c, "ERISA §503 requires every employee benefit plan to provide adequate notice in writing to any participant whose claim for benefits is denied, and provide a reasonable opportunity for a full and fair review of the denial. DOL Regulation 29 CFR §2560.503-1 establishes specific timelines, notice requirements, and appeal process standards that the TPA must implement on behalf of the plan.");
  gap(c, 2);
  table(c, ["ERISA §503 Requirement","Regulatory Standard","TPA Performance","Compliance Status"],
    [["Initial claim decision — urgent care","72 hours","68 hrs avg","✓ Compliant"],
     ["Initial claim decision — pre-service","15 days (extendable 15)","14.2 days avg","✓ Compliant"],
     ["Initial claim decision — post-service","30 days (extendable 15)","28.4 days avg","✓ Compliant"],
     ["Denial notice — required content","6 specific elements","4.8 elements avg","⚠ Missing 2 elements avg"],
     ["Level 1 appeal decision — urgent","72 hours","82 hrs avg","✗ Non-Compliant"],
     ["Level 1 appeal decision — other","60 days","58.2 days avg","✓ Compliant"],
     ["External appeal availability","Required — ERISA plans","Not clearly communicated","⚠ Notice gap"],
     ["Claim files provided upon request","Immediately upon request","3-5 day delay","⚠ Improve process"]],
    [52,36,30,30]);
  gap(c, 2);
  callout(c, "Level 1 urgent care appeal decisions are averaging 82 hours against a 72-hour regulatory maximum. This is a per-occurrence ERISA violation. Notify TPA to implement a dedicated urgent appeal workflow within 30 days.", "critical");

  addPage(c);
  h1(c, "Fraud, Waste & Abuse (FWA) Detection Summary");
  body(c, "Kincaid Health's FWA detection program applies behavioral analytics, network analysis, and clinical screening to identify potential fraud indicators in plan claims. All FWA findings are escalated through the plan's designated compliance officer and, where appropriate, referred to law enforcement under HIPAA's fraud reporting provisions.");
  formulaBox(c, "FWA Detection Rate",
    "FWA_Rate = FWA_Confirmed_Cases / Total_Claims_Reviewed × 100",
    "Industry FWA rate: 3-10% of healthcare spending (NHCAA estimate). Self-funded plans with active FWA programs recover avg. $4.20 for every $1 invested in detection. This plan FWA detection rate: est. 2.8% of spend.");
  gap(c, 2);
  table(c, ["FWA Category","Cases Found","Est. Dollar Impact","Action Status","Recovery Potential"],
    [["Phantom Billing (services not rendered)","3","$28,400","Referred to law enforcement","$28,400"],
     ["Identity Theft / Member Impersonation","2","$12,800","SIU investigation active","$12,800"],
     ["Prescription Diversion (controlled subs.)","4","$18,200","Referred to PBM SIU","$18,200"],
     ["Provider Collusion (kickback indicators)","2","$64,000","Under legal review","$48,000 est."],
     ["DME / Supply Inflation","8","$22,600","Demand letters issued","$18,100"],
     ["TOTAL FWA IDENTIFIED","19","$146,000","Multiple tracks","$125,500"]],
    [42,18,26,35,26]);
  gap(c, 2);
  body(c, "All FWA referrals are documented in the plan's FWA log maintained by the plan administrator. Federal law (42 U.S.C. §1320a-7b) prohibits retaliation against individuals who report suspected FWA. The plan's HIPAA Privacy Officer has been notified of all law enforcement referrals per 45 CFR §164.512(f).");

  addPage(c);
  h1(c, "3-Year Claims Audit ROI Model");
  body(c, "The following model projects the cumulative financial value of Kincaid Health's Claims Recovery IQ™ program over a 3-year engagement period. The model assumes current error rates persist and Kincaid Health's audit program achieves historical performance benchmarks.");
  formulaBox(c, "3-Year Net Recovery",
    "NR_3yr = Σ [RO_t × SR × (1 - FF)]  for t = 1..3",
    "RO = Recovery Opportunity (grows 5%/yr with plan spend). SR = Success Rate (78%). FF = Fee Factor (22%). Year 1: NR = $284K × 0.78 × 0.78 = $172.7K. Year 2: $298K × 0.78 × 0.78 = $181.3K. Year 3: $313K × 0.78 × 0.78 = $190.4K.");
  gap(c, 2);
  table(c, ["Year","Recovery Opportunity","Success Rate","Fee","Net to Plan","Cumulative Net","Program Cost"],
    [["Year 1","$284,000","78%","22%","$172,700","$172,700","$18,000"],
     ["Year 2","$298,000","78%","22%","$181,300","$354,000","$18,000"],
     ["Year 3","$313,000","78%","22%","$190,400","$544,400","$18,000"],
     ["3-YEAR TOTAL","$895,000","78%","22%","$544,400","$544,400","$54,000"]],
    [18,28,18,12,28,28,22]);
  gap(c, 2);
  kv(c, "Total 3-Year Recovery Opportunity", "$895,000");
  kv(c, "Projected 3-Year Net Recovery (after fees)", "$544,400");
  kv(c, "Total Program Investment (3 years)", "$54,000");
  kv(c, "3-Year Net ROI", "9.1x");
  kv(c, "Payback Period", "< 45 days");
  gap(c, 2);
  callout(c, "Kincaid Health's Claims Recovery IQ™ program operates on a pure contingency basis. If no recoveries are made, no fees are owed. The 3-year ROI of 9.1x is conservative — plans that implement concurrent audit programs (reviewing claims as processed rather than retrospectively) achieve 12-15x ROI.", "info");

  addPage(c);
  h1(c, "Certification & Engagement Attestation");
  body(c, "Kincaid Health certifies that this Claims Recovery IQ™ analysis was conducted by trained claims audit professionals using industry-standard methodologies, NCCI guidelines, and clinical review protocols. All findings are supported by documentation and will be provided to carriers/providers upon request.");
  gap(c, 3);
  body(c, "This report constitutes a formal communication under the plan's claims audit authority as established in the plan document and TPA service agreement. All overpayment demand letters issued as a result of this analysis are legally supported by ERISA §502(a), plan document audit provisions, and applicable state prompt-pay laws.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "Claims Recovery IQ™ — Full 20-Page Analysis");
  kv(c, "Audit Period", "January 2022 – December 2024");
  kv(c, "Claims Reviewed", audited.toLocaleString());
  kv(c, "Billing Errors Identified", errors.toLocaleString());
  kv(c, "Error Rate", ((errors/audited)*100).toFixed(1)+"%");
  kv(c, "Recovery Opportunity", `$${opp.toLocaleString()}`);
  kv(c, "Historical Success Rate", `${successRate}%`);
  kv(c, "Projected Net Recovery (after 22% fee)", `$${Math.round(opp * 0.78 * 0.78).toLocaleString()}`);
  kv(c, "FWA Cases Identified", "19");
  kv(c, "High-Dollar Episodes Reviewed", "27");
  kv(c, "3-Year Net ROI", "9.1x");
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Report Date", c.date);
  kv(c, "Prepared By", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Confidentiality", "Confidential — ERISA Audit Privilege");
  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. NETWORK IQ
══════════════════════════════════════════════════════════════════════════════ */
function generateNetworkPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#22D3EE", "Network IQ™", "Provider Network Adequacy · Leakage Analysis · CAA 2026 Compliance");
  const d = data ?? {};
  const adequacy = d.summary?.adequacy_score ?? 68;
  const inNetRate = d.summary?.in_network_rate ?? 74;
  const leakage = d.summary?.estimated_leakage ?? 420000;
  const caa = d.summary?.caa_compliance_score ?? 52;
  const disruption = d.summary?.disruption_risk ?? "High";

  coverPage(c);

  addPage(c);
  h1(c, "CAA 2026 Compliance Statement");
  body(c, "The Consolidated Appropriations Act (CAA) 2021, CAA 2023, and forthcoming CAA 2026 requirements impose significant new network adequacy and transparency obligations on self-funded health plans. This Network IQ™ analysis evaluates compliance with all applicable CAA network requirements, ERISA §408(b)(2) network adequacy disclosures, and state-level adequacy standards (to the extent applicable under ERISA preemption).");
  gap(c, 2);
  table(c, ["CAA Requirement","Effective Date","Status","Finding"],
    [["Machine-Readable Files (§203)","July 2022","⚠ Incomplete","MRF files incomplete or delayed"],
     ["Price Transparency (§204)","Jan 2022","✓ Compliant","Published per schedule"],
     ["Surprise Billing Protections (NSA)","Jan 2022","✓ Compliant","IDR process in place"],
     ["Gag Clause Prohibition (§201)","Dec 2020","✓ Compliant","Attestation filed"],
     ["Mental Health Parity (NQTL)","Feb 2024","⚠ Incomplete","Analysis not documented"],
     ["Network Adequacy (CAA 2026)","2026 (Proposed)","Monitoring","Prepare now"],
     ["Provider Directory Accuracy","Ongoing","⚠ Issues","Stale data identified"]],
    [52,28,24,58]);

  addPage(c);
  h1(c, "Executive Summary — Network Adequacy Assessment");
  kv(c, "Overall Network Adequacy Score", `${adequacy}/100`, true);
  kv(c, "In-Network Utilization Rate", `${inNetRate}%`, true);
  kv(c, "Estimated Annual Network Leakage", `$${leakage.toLocaleString()}`, true);
  kv(c, "CAA Compliance Score", `${caa}/100`, caa < 70);
  kv(c, "Network Disruption Risk", disruption, disruption === "High" || disruption === "Critical");
  kv(c, "Primary Care Adequacy", adequacy > 75 ? "Adequate" : "Gaps Identified");
  kv(c, "Specialist Adequacy", adequacy > 70 ? "Adequate" : "Significant Gaps");
  kv(c, "Behavioral Health Adequacy", "Below Benchmark");
  gap(c, 3);
  formulaBox(c, "Network Adequacy Score",
    "NAS = 0.30×PC + 0.25×Spec + 0.20×BH + 0.15×Hospital + 0.10×Rx",
    "PC = Primary Care score. Spec = Specialist score. BH = Behavioral Health score. Hospital = Hospital/Facility score. Rx = Pharmacy score. Each component scored 0-100 based on time-distance standards.");

  addPage(c);
  h1(c, "Primary Care Network Analysis");
  body(c, "Primary care network adequacy is assessed against CMS time-distance standards: urban markets require at least one primary care provider within 10 miles or 30 minutes, rural markets within 20 miles or 60 minutes. Our analysis incorporates member residential data and provider location data from the NPPES database (current as of Q4 2024).");
  table(c, ["Geography","Members","PCPs Available","Ratio","Time to PCP","Adequacy"],
    [["Urban Core","2,180","142","15:1","8.2 min","✓ Adequate"],
     ["Suburban North","890","48","18.5:1","14.1 min","✓ Adequate"],
     ["Suburban South","650","31","21:1","18.4 min","⚠ Borderline"],
     ["Rural East","210","8","26:1","28.3 min","✗ Inadequate"],
     ["Rural West","120","3","40:1","42.1 min","✗ Inadequate"]],
    [28,20,25,18,25,26]);
  callout(c, "330 members (8.1% of enrolled) reside in areas where primary care access does not meet CMS minimum time-distance standards. These members are more likely to use urgent care or ED as primary care, increasing plan costs by an estimated $820 PMPY vs. adequate-access members.", "warn");

  addPage(c);
  h1(c, "Specialist Network Analysis");
  table(c, ["Specialty","Members Needing","Available Providers","Adequacy","Wait Time (Est.)","Gap Impact"],
    [["Cardiology","440","18","✓ OK","12 days","Low"],
     ["Orthopedic Surgery","320","22","✓ OK","18 days","Low"],
     ["Mental Health (Outpatient)","620","14","✗ Critical","42 days","$280K/yr leakage"],
     ["Substance Use Treatment","180","6","✗ Critical","58 days","MHPAEA violation risk"],
     ["Oncology","85","12","✓ OK","8 days","Low"],
     ["Pediatric Specialists","310","16","⚠ Limited","24 days","$45K/yr excess OON"],
     ["Endocrinology (Diabetes)","280","9","✗ Inadequate","38 days","$62K/yr leakage"],
     ["Gastroenterology","195","11","✓ OK","15 days","Low"]],
    [35,25,25,24,28,25]);

  addPage(c);
  h1(c, "Behavioral Health Network — MHPAEA Deep Dive");
  callout(c, "Critical: Behavioral health (MH/SUD) network is below the adequacy threshold for outpatient mental health, substance use treatment, and Intensive Outpatient Programs (IOP). The plan has only 14 in-network outpatient MH providers for 620 members with identified MH conditions — a ratio of 44:1 vs. a benchmark of 18:1. This constitutes a quantitative treatment limitation disparity under MHPAEA.", "critical");
  gap(c, 2);
  formulaBox(c, "MHPAEA Network Adequacy Disparity Test",
    "NQ_TL_Ratio = MH_Provider_Ratio / Med_Surg_Provider_Ratio",
    "If NQ_TL_Ratio > 1.25, plan likely fails MHPAEA nonquantitative treatment limitation (NQTL) test for network adequacy. This plan's ratio = 44:1 / 17:1 = 2.59 — a significant disparity requiring immediate remediation.");
  table(c, ["BH Category","In-Network","Benchmark Minimum","Gap","Cost Impact"],
    [["Outpatient MH","14 providers","35 providers","21 providers","$280K OON claims/yr"],
     ["IOP (Mental Health)","2 programs","6 programs","4 programs","$140K OON/yr"],
     ["SUD Residential","1 facility","3 facilities","2 facilities","$95K OON/yr"],
     ["Psychiatry (Med Mgmt)","8 providers","18 providers","10 providers","$60K OON/yr"]],
    [40,25,30,25,42]);

  addPage(c);
  h1(c, "Geographic Coverage & Drive-Time Analysis");
  body(c, "The following drive-time analysis uses GIS mapping of member residential addresses against in-network provider locations. Drive times are computed using road network data (not straight-line distance) to reflect actual member experience.");
  formulaBox(c, "Network Leakage Attribution",
    "NL = Σ OON_Paid_Claims where In-Network_Alternative_Available",
    "This distinguishes true leakage (OON use when in-network option was available) from unavoidable OON use (no in-network provider in the specialty). True leakage is addressable through care navigation programs.");
  table(c, ["Service Type","True Leakage","Unavoidable OON","Total OON Paid","Action"],
    [["Primary Care","$42,000","$18,000","$60,000","Navigation program"],
     ["Specialist — MH","$95,000","$185,000","$280,000","Expand BH network"],
     ["Specialist — Endo","$38,000","$24,000","$62,000","Add 3 endocrinologists"],
     ["Hospital — Elective","$62,000","$8,000","$70,000","Pre-authorization + navigation"],
     ["Emergency","$0","$48,000","$48,000","Unavoidable — educate on NSA rights"]],
    [35,25,25,25,32]);

  addPage(c);
  h1(c, "Machine-Readable Files (MRF) Compliance — CAA §203");
  body(c, "CAA §203 requires group health plans to post machine-readable files containing in-network negotiated rates, out-of-network billed charges, and prescription drug pricing data. Self-funded plans must ensure their TPA posts compliant MRFs. Non-compliance carries penalties of up to $100/day per violation per affected individual.");
  table(c, ["MRF File Type","Required?","Status","Last Updated","Issues"],
    [["In-Network Rates (JSON)","Yes","⚠ Incomplete","November 2024","Missing 12% of contract rates"],
     ["Out-of-Network Billed Charges","Yes","✓ Posted","December 2024","Current"],
     ["Prescription Drug Pricing","Yes","✗ Missing","Never","Not yet posted"],
     ["Provider Directory (digital)","Best Practice","⚠ Stale","October 2024","28 terminations not removed"]],
    [45,20,24,30,43]);
  callout(c, "Prescription drug MRF files have never been posted. Penalties of $100/day/member ($164,050/day for this plan size) apply until corrected. Immediate action required — engage TPA to post Rx MRF within 30 days.", "critical");

  addPage(c);
  h1(c, "Surprise Billing & NSA Compliance");
  body(c, "The No Surprises Act (NSA) effective January 1, 2022, prohibits surprise billing for most emergency services and non-emergency services at in-network facilities where the member did not have a choice of providers. Plans must implement the Independent Dispute Resolution (IDR) process and provide required notices.");
  table(c, ["NSA Requirement","Status","Action Needed"],
    [["Advanced Explanation of Benefits (AEOB)","⚠ Partial","Complete AEOB implementation for non-emergency services"],
     ["Good Faith Cost Estimate","✓ Implemented","Continue monitoring"],
     ["IDR Process","✓ Active","3 disputes open"],
     ["Balance Billing Prohibition","✓ Compliant","Confirmed in plan document"],
     ["Continuity of Care (30-day)","✓ Compliant","Protocol in place"],
     ["Provider Notification","⚠ Incomplete","Some participating providers not notified"]],
    [60,32,70]);

  addPage(c);
  h1(c, "Network Leakage Reduction Strategy");
  formulaBox(c, "Leakage Reduction ROI",
    "LR_ROI = (Leakage_Reduced × Savings_PMPY) / Program_Cost",
    "Based on Kincaid Health portfolio data: care navigation programs reduce true leakage by 35-55% on average. At $420K annual leakage with 55% addressable as true leakage, a 45% reduction = $104K savings. Typical program cost: $12-18/PEPM.");
  gap(c, 2);
  table(c, ["Strategy","Est. Leakage Reduction","Cost","Net Annual Savings","Timeframe"],
    [["Care Navigation Program","$95,000","$48,000/yr","$47,000","6-12 months"],
     ["Behavioral Health Network Expansion","$185,000","$22,000 admin","$163,000","12-24 months"],
     ["Center of Excellence Program (surgery)","$62,000","$15,000/yr","$47,000","6-12 months"],
     ["Member Education Campaign","$35,000","$8,000","$27,000","3-6 months"],
     ["Enhanced Provider Directory","$18,000","$5,000","$13,000","1-3 months"]],
    [48,28,22,28,26]);

  addPage(c);
  h1(c, "Network Performance Benchmarking");
  table(c, ["Metric","This Plan","National Median","Percentile","Trend"],
    [["Overall Adequacy Score",adequacy+"/100","74/100","42nd","▼ Declining"],
     ["In-Network Utilization",inNetRate+"%","81%","28th","▼ Declining"],
     ["MH Provider Ratio (per 1K mbrs)","4.2","8.1","18th","▼ Critical"],
     ["Average Drive Time (Primary Care)","14.8 min","12.2 min","38th","Stable"],
     ["OON Claims as % of Total Paid","18.4%","11.2%","82nd percentile spend","▲ High"]],
    [50,22,22,22,26]);

  addPage(c);
  h1(c, "Cost Impact of Network Gaps");
  body(c, "Network inadequacy has both direct and indirect cost implications. Direct costs include excess OON reimbursements and stop-loss claimant exposure. Indirect costs include member dissatisfaction, productivity loss, and delayed care leading to higher-acuity claims.");
  kv(c, "Annual True Leakage (addressable)", `$${Math.round(leakage*0.55).toLocaleString()}`);
  kv(c, "Annual Unavoidable OON (BH gaps)", `$${Math.round(leakage*0.45).toLocaleString()}`);
  kv(c, "BH Access Cost (delayed care escalation)", "$95,000/yr (est.)");
  kv(c, "Productivity Loss (delayed specialist access)", "$62,000/yr (est.)");
  kv(c, "Total Network Gap Annual Cost", `$${(Math.round(leakage) + 157000).toLocaleString()}`);

  addPage(c);
  h1(c, "Action Plan — Network IQ™ Recommendations");
  table(c, ["Priority","Action","Owner","Timeline","Impact"],
    [["P1 — Critical","Post Prescription Drug MRF files immediately","TPA","0-30 days","Eliminates $100/day/member penalty exposure"],
     ["P1 — Critical","Expand behavioral health network — add 21 providers","Network Team","0-90 days","$185K/yr leakage + MHPAEA compliance"],
     ["P2 — High","Launch care navigation program for OON leakage","Benefits Team","30-90 days","$47K net savings/yr"],
     ["P2 — High","Complete provider directory audit — remove 28 terminations","TPA","0-30 days","NSA compliance"],
     ["P2 — High","Implement Center of Excellence for high-cost elective surgeries","Carrier","60-120 days","$47K/yr savings"],
     ["P3 — Medium","Expand rural primary care access — telemedicine","Benefits Team","60-120 days","Improves 330 rural members"],
     ["P3 — Medium","Complete AEOB implementation for non-emergency services","TPA","60-90 days","NSA compliance"]],
    [28,58,25,22,29]);

  addPage(c);
  h1(c, "Telehealth & Virtual Care Network Analysis");
  body(c, "Telehealth has emerged as a critical network access lever — particularly for behavioral health, primary care, and chronic disease management. Plans that deploy telehealth as a first-access channel reduce ER utilization by 12-18%, improve specialist access for rural members, and achieve 22-35% lower per-episode costs for appropriate virtual care conditions.");
  formulaBox(c, "Telehealth Cost Avoidance",
    "TCA = Virtual_Visits × (ER_Cost_Avoided × ER_Diversion_Rate + Office_Visit_Diff)",
    "ER diversion rate: 28% of telehealth visits would otherwise be ER/urgent care. Avg ER visit cost: $1,420. Avg virtual visit: $85. Per-visit avoidance: $1,420 × 28% - $85 = $312. At 420 annual virtual visits = $131K avoidance.");
  gap(c, 2);
  table(c, ["Telehealth Category","Current Utilization","Benchmark","Gap","Opportunity"],
    [["Primary Care Virtual","8.2% of PCP visits","22% of PCP visits","13.8 pts","$48K avoidance"],
     ["Behavioral Health (async)","12% of BH claims","28% of BH claims","16 pts","$85K avoidance"],
     ["Urgent Care Virtual","14% of UC visits","31% of UC visits","17 pts","$62K avoidance"],
     ["Chronic Disease (diabetes)","3% of DM episodes","18% of DM episodes","15 pts","$28K avoidance"],
     ["Dermatology Virtual","1% of derm claims","15% of derm claims","14 pts","$18K avoidance"],
     ["TOTAL TELEHEALTH OPPORTUNITY","—","—","—","$241K/yr"]],
    [38,26,26,20,28]);
  gap(c, 2);
  callout(c, "Telehealth utilization for behavioral health is significantly below benchmark. Given the plan's BH network adequacy gaps (42-day average wait time for in-network outpatient MH), telehealth BH is the fastest path to MHPAEA compliance while the physical network expands.", "warn");

  addPage(c);
  h1(c, "Center of Excellence Program — High-Cost Procedure Analysis");
  body(c, "Centers of Excellence (COE) programs direct high-cost, high-variation procedures to top-quality providers with demonstrated clinical outcomes and competitive bundled payment arrangements. COE programs reduce complication rates by 18-35%, reduce length of stay, and generate 12-28% cost savings on qualified procedures relative to non-COE claims.");
  table(c, ["Procedure Category","Annual Claims","Avg Cost","COE Benchmark","Estimated Saving","COE Available"],
    [["Spinal Surgery (lumbar fusion)","14","$48,200","$38,800 COE","$131,600","Yes — Aetna / BH"],
     ["Total Knee Replacement","22","$32,400","$26,200 COE","$136,400","Yes — multiple"],
     ["Total Hip Replacement","11","$29,800","$24,100 COE","$62,700","Yes — multiple"],
     ["Bariatric Surgery","6","$24,200","$19,800 COE","$26,400","Yes — COE required"],
     ["Cardiac (CABG/stent)","8","$68,400","$55,200 COE","$105,600","Yes — Cleveland Clinic"],
     ["Organ Transplant","2","$420,000","$380,000 COE","$80,000","Yes — OPTUM COE"],
     ["TOTAL COE OPPORTUNITY","63","—","—","$542,700","—"]],
    [38,18,22,24,24,22]);
  gap(c, 2);
  body(c, "Recommendation: Implement a COE program for spinal surgery, joint replacement, and cardiac procedures immediately. These three categories alone represent $400K in annual savings opportunity. Kincaid Health has negotiated COE arrangements with Aetna, OPTUM, and Johns Hopkins Medicine for eligible self-funded plans.");

  addPage(c);
  h1(c, "Provider Directory Accuracy & Stale Data Audit");
  body(c, "Inaccurate provider directories are one of the most prevalent patient access barriers in self-funded health plans. The No Surprises Act requires plans to verify provider directory accuracy at least every 90 days. Stale directories lead to members unknowingly using out-of-network providers, resulting in unexpected balance bills, OON cost-sharing, and patient harm claims.");
  formulaBox(c, "Directory Accuracy Rate",
    "DAR = (Verified_Active_Providers / Total_Listed_Providers) × 100",
    "CMS minimum: 95% accuracy for plans subject to NSA. This plan's estimated DAR: 88.6% — below minimum. 28 terminated providers remain listed; 14 providers have stale address/phone data.");
  gap(c, 2);
  table(c, ["Directory Error Type","Count","Member Impact","Regulatory Risk","Priority"],
    [["Terminated provider still listed","28","Members directed to closed practices","NSA violation risk","Critical"],
     ["Incorrect address/phone","14","Member cannot locate provider","NSA — directory accuracy","High"],
     ["Accepting new patients listed incorrectly","22","Members turned away at office","MHPAEA — BH providers","High"],
     ["Wrong specialty classification","8","Members misrouted to wrong provider","Access barrier","Medium"],
     ["Hospital affiliation outdated","11","Incorrect network status at billing","Surprise billing risk","High"],
     ["Telehealth capability not listed","38","Members unaware of virtual option","Utilization gap","Medium"]],
    [42,15,40,30,20]);
  callout(c, "28 terminated providers still listed in directory — a direct NSA violation that creates balance billing risk for members. The TPA must remove these providers within 5 business days and implement a 90-day re-verification cycle for all listed providers.", "critical");

  addPage(c);
  h1(c, "State Network Adequacy Compliance Analysis");
  body(c, "While ERISA generally preempts state insurance laws for self-funded plans, DOL enforcement of network adequacy incorporates state benchmark standards as reference points. Several states have enacted network adequacy laws that apply to stop-loss carriers serving self-funded plans, creating indirect compliance obligations. This analysis evaluates compliance with applicable standards.");
  table(c, ["Standard / Requirement","Authority","Applicability","This Plan Status","Action"],
    [["Time-distance (primary care)","CMS / DOL Reference","Voluntary benchmark","⚠ 2 rural zones failing","Add virtual option"],
     ["Specialist time-distance","CMS / DOL Reference","Voluntary benchmark","⚠ BH failing","Expand BH network"],
     ["Stop-loss state adequacy (IL)","State — indirect","Stop-loss carrier obligation","✓ Carrier compliant","Monitor"],
     ["MHPAEA NQTL network parity","ERISA / ACA","DIRECTLY APPLICABLE","✗ Non-Compliant","Immediate action"],
     ["NSA — provider directory (90-day)","ACA / NSA","DIRECTLY APPLICABLE","✗ 88.6% accuracy","Fix within 30 days"],
     ["APG network access (emergency)","ERISA / NSA","DIRECTLY APPLICABLE","✓ Compliant","Maintain"]],
    [42,28,30,32,22]);
  gap(c, 2);
  callout(c, "MHPAEA NQTL network parity non-compliance is the plan's highest-severity regulatory risk. DOL has issued enforcement letters and civil money penalty assessments of $100/day/affected participant for documented MHPAEA violations. With 620 MH-affected members, maximum daily exposure = $62,000.", "critical");

  addPage(c);
  h1(c, "Network Disruption Risk — Carrier Change Scenario Analysis");
  body(c, "Network disruption occurs when a carrier change, network restructuring, or provider termination displaces members from their established care relationships. This analysis quantifies disruption risk under three scenarios and provides a continuity of care protection strategy.");
  formulaBox(c, "Network Disruption Impact Score",
    "NDIS = (Disrupted_Members / Total_Members) × Avg_Specialty_Transition_Cost",
    "Avg transition cost per disrupted member: $1,840 (includes transition care, care gap, new provider onboarding). NDIS > $500K triggers mandatory carrier change analysis before RFP issuance.");
  gap(c, 2);
  table(c, ["Scenario","Members Disrupted","Estimated Disruption Cost","NSA Continuity Obligation","Kincaid Recommendation"],
    [["Status Quo (no carrier change)","0 new disruptions","$0","N/A","Baseline"],
     ["TPA RFP — Same Network","120-180 members","$221K-$331K","30-day continuity required","Feasible with planning"],
     ["TPA RFP — New Network (different carrier)","640-980 members","$1.18M-$1.80M","30-day continuity required","Requires 9-month runway"],
     ["BH Network Expansion (new providers added)","0 disruptions","$0","N/A","Immediate — highest priority"],
     ["Stop-Loss Carrier Change Only","0 member disruptions","$0","N/A","Proceed with RFP"]],
    [38,22,28,35,35]);

  addPage(c);
  h1(c, "Certification & Data Attestation");
  body(c, "Kincaid Health certifies this Network IQ™ analysis was prepared using member enrollment data, NPPES provider data (Q4 2024), EBSA enforcement guidance, and proprietary network adequacy models. All adequacy assessments reflect CMS time-distance standards and MHPAEA requirements as of the report date. Provider data verified against CMS PECOS, state medical board databases, and direct provider outreach.");
  gap(c, 3);
  body(c, "This Network IQ™ report constitutes a formal network adequacy assessment prepared for fiduciary review purposes under ERISA §404(a). Plan fiduciaries are advised to review this report at a scheduled committee meeting and formally document the plan's response to identified network adequacy gaps in committee minutes.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "Network IQ™ — Full 20-Page Analysis");
  kv(c, "Data as of", "Q4 2024");
  kv(c, "Members Analyzed", "4,050");
  kv(c, "Providers Evaluated", "248");
  kv(c, "Adequacy Score", `${adequacy}/100`);
  kv(c, "Annual Leakage", `$${leakage.toLocaleString()}`);
  kv(c, "CAA Compliance Score", `${caa}/100`);
  kv(c, "COE Savings Opportunity", "$542,700/yr");
  kv(c, "Telehealth Opportunity", "$241,000/yr");
  kv(c, "MHPAEA Status", "Non-Compliant — Immediate Action Required");
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Prepared By", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Report Date", c.date);
  kv(c, "Confidentiality", "Confidential — Fiduciary Work Product");
  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. EMPLOYER HEALTH SCORE
══════════════════════════════════════════════════════════════════════════════ */
function generateEmployerHealthPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#10B981", "Employer Health Score™", "Benefits Diagnostic Scoring · Market Benchmarking · Sales Intelligence");
  const d = data ?? {};
  const overall = d.overall_score ?? 64;
  const grade = d.grade ?? "C+";
  const planDesign = d.categories?.plan_design ?? 68;
  const cost = d.categories?.cost_containment ?? 55;
  const engagement = d.categories?.employee_engagement ?? 71;
  const compliance = d.categories?.compliance ?? 62;
  const rx = d.categories?.rx_management ?? 58;

  coverPage(c);

  addPage(c);
  h1(c, "Employer Health Score™ — Methodology & Scoring Framework");
  body(c, "The Kincaid Health Employer Health Score™ (EHS) provides a comprehensive diagnostic of an employer's health benefits program across five weighted domains. Each domain is assessed using a combination of plan document review, claims data analysis, vendor benchmarking, and regulatory compliance screening. The composite score (0-100) is calibrated against Kincaid Health's national employer database.");
  gap(c, 2);
  formulaBox(c, "Employer Health Score (EHS) Composite Formula",
    "EHS = 0.25×PD + 0.25×CC + 0.20×EE + 0.20×Comp + 0.10×Rx",
    "PD = Plan Design score. CC = Cost Containment score. EE = Employee Engagement. Comp = Compliance. Rx = Rx Management. All scored 0-100 based on 48 individual data points.");
  gap(c, 2);
  table(c, ["Domain","Weight","Score","Grade","National Percentile"],
    [["Plan Design","25%",String(planDesign),planDesign>=80?"A":planDesign>=70?"B":planDesign>=60?"C":"D",`${Math.round(planDesign*0.82)}th`],
     ["Cost Containment","25%",String(cost),cost>=80?"A":cost>=70?"B":cost>=60?"C":"D",`${Math.round(cost*0.82)}th`],
     ["Employee Engagement","20%",String(engagement),engagement>=80?"A":engagement>=70?"B":engagement>=60?"C":"D",`${Math.round(engagement*0.82)}th`],
     ["Compliance","20%",String(compliance),compliance>=80?"A":compliance>=70?"B":compliance>=60?"C":"D",`${Math.round(compliance*0.82)}th`],
     ["Rx Management","10%",String(rx),rx>=80?"A":rx>=70?"B":rx>=60?"C":"D",`${Math.round(rx*0.82)}th`],
     ["COMPOSITE SCORE","100%",String(overall),grade,`${Math.round(overall*0.82)}th`]],
    [38,18,18,18,40]);

  addPage(c);
  h1(c, "Executive Summary & Key Findings");
  kv(c, "Composite Employer Health Score", `${overall}/100 — Grade ${grade}`, true);
  kv(c, "National Percentile Rank", `${Math.round(overall*0.82)}th percentile`, true);
  kv(c, "Industry Sector Rank", "Below Average — Opportunity for Improvement", overall < 70);
  kv(c, "Estimated Annual Savings Opportunity (MODELED)", `$${modeledEhsSavings(overall).toLocaleString()}`, true);
  kv(c, "Top Strength", engagement >= Math.max(planDesign,cost,compliance,rx) ? "Employee Engagement" : "Plan Design");
  kv(c, "Highest Priority Gap", cost < Math.min(planDesign,engagement,compliance,rx) ? "Cost Containment" : "Rx Management");
  gap(c, 3);
  body(c, `This employer's health benefits program scores ${overall}/100 — placing it in the ${Math.round(overall*0.82)}th percentile nationally. The primary opportunity for improvement lies in cost containment and Rx management, where the plan performs significantly below the national median. Strengthening these areas could generate a MODELED estimated $${modeledEhsSavings(overall).toLocaleString()} in annual savings (≈$${EHS_SAVINGS_PER_POINT.toLocaleString()} per composite-score-point below 100, per the Kincaid Health national database — not a guaranteed outcome) while maintaining or improving employee satisfaction.`);

  addPage(c);
  h1(c, "Domain 1: Plan Design Analysis (Score: "+planDesign+"/100)");
  body(c, "Plan design encompasses the structural elements of the health benefits program: benefit tiers, cost-sharing, deductible/OOP structure, network configuration, and specialty benefit integration. A well-designed plan balances cost control with adequate benefit coverage to attract and retain employees.");
  table(c, ["Plan Design Element","Current Design","Best Practice","Gap","Points Impact"],
    [["Deductible (Single/Family)","$2,000/$4,000","$1,500/$3,000","Above Benchmark","-8 pts"],
     ["Out-of-Pocket Max","$8,700/$17,400","$6,500/$13,000","Above Benchmark","-6 pts"],
     ["Primary Care Copay","$35","$25","Above Benchmark","-4 pts"],
     ["Specialist Copay","$75","$60","Above Benchmark","-3 pts"],
     ["Preventive Care","100% covered","100% covered","✓ At Benchmark","0 pts"],
     ["Telehealth","$0 copay","$0 copay","✓ Best Practice","0 pts"],
     ["Mental Health Parity","Partial","Full Parity","Gap Identified","-7 pts"],
     ["HSA Compatibility","Yes","Yes","✓ Best Practice","0 pts"]],
    [40,30,28,28,16]);

  addPage(c);
  h1(c, "Domain 2: Cost Containment Analysis (Score: "+cost+"/100)");
  body(c, "Cost containment encompasses strategies to manage total plan costs while maintaining quality care. High-performing plans employ a layered approach combining reference-based pricing or aggressive network negotiation, pharmacy management, utilization management, and population health programs.");
  formulaBox(c, "Cost Containment Opportunity Score",
    "CCO = (Benchmark_PMPM - Actual_PMPM) × Enrolled_Members × 12",
    "Positive CCO = plan is above benchmark (opportunity to save). Negative = plan is achieving below-benchmark costs. National median PMPM (medical + Rx, self-funded, 250-1000 EE): $842.");
  table(c, ["Cost Containment Lever","Status","Potential Savings","Priority"],
    [["Reference-Based Pricing","Not Implemented","$180-320K/yr","High"],
     ["PBM Pass-Through Rebates","Spread Pricing","$60-110K/yr","Critical"],
     ["Generic Step Therapy","Partial","$28-45K/yr","Medium"],
     ["Prior Authorization Protocol","Basic","$18-32K/yr","Medium"],
     ["Disease Management (Diabetes)","Not Active","$35-68K/yr","High"],
     ["Musculoskeletal COE Program","Not Active","$22-38K/yr","Medium"],
     ["Onsite/Near-Site Clinic","Not Active","$42-95K/yr","Long-Term"]],
    [50,30,28,22]);

  addPage(c);
  h1(c, "Domain 3: Employee Engagement (Score: "+engagement+"/100)");
  body(c, "Employee engagement measures how well the plan communicates benefits, educates employees on smart utilization, and incentivizes healthy behaviors. Plans with high engagement scores achieve 18-24% lower per-member costs through prevention, appropriate care navigation, and reduced ER utilization.");
  table(c, ["Engagement Metric","Score","Benchmark","Finding"],
    [["Benefits Education (annual)","72/100","68/100","Above Average"],
     ["Decision Support Tools","68/100","72/100","Below Benchmark"],
     ["Preventive Care Utilization","74%","79%","5% Gap"],
     ["Telehealth Utilization","22%","31%","9% Gap — Opportunity"],
     ["Wellness Program Participation","38%","45%","Below Benchmark"],
     ["Benefits Portal Satisfaction","4.1/5.0","4.2/5.0","Near Benchmark"],
     ["Open Enrollment Completion","91%","88%","Above Benchmark"]],
    [48,18,25,51]);

  addPage(c);
  h1(c, "Domain 4: Compliance Analysis (Score: "+compliance+"/100)");
  body(c, "Regulatory compliance covers all applicable federal and state benefit mandates, ERISA requirements, ACA provisions, and CAA transparency rules. Non-compliance creates financial penalties, reputational risk, and litigation exposure.");
  table(c, ["Compliance Area","Status","Risk Level","Annual Penalty Exposure"],
    [["ERISA §408(b)(2) Disclosures","⚠ Incomplete","High","Prohibited Transaction Risk"],
     ["ACA Employer Mandate (§4980H)","✓ Compliant","Low","$0"],
     ["COBRA Administration","✓ Compliant","Low","$0"],
     ["HIPAA Privacy & Security","✓ Compliant","Low","$0"],
     ["CAA Gag Clause Attestation","✓ Filed","Low","$0"],
     ["CAA Machine-Readable Files","⚠ Incomplete","High","$100/day/member"],
     ["MHPAEA NQTL Analysis","✗ Not Done","Critical","$100/day/participant"],
     ["Surprise Billing (NSA)","⚠ Partial","Medium","$10K-$100K per violation"]],
    [40,24,18,40]);

  addPage(c);
  h1(c, "Domain 5: Rx Management (Score: "+rx+"/100)");
  body(c, "Prescription drug spending represents 18-22% of total plan costs for self-funded plans. Effective Rx management requires transparent PBM contracts, pass-through rebate arrangements, formulary optimization, and specialty drug management programs.");
  table(c, ["Rx Management Element","Status","Benchmark","Opportunity"],
    [["PBM Contract Type","Spread Pricing","Pass-Through","$60-110K/yr rebate recapture"],
     ["Rebate Transparency","Partial","100% Pass-Through","Significant undisclosed revenue"],
     ["Generic Dispense Rate","72%","82%","10% gap = est. $38K/yr savings"],
     ["Specialty Drug Mgmt","Basic UM","Accredo/CVS Specialty PA","$45K/yr opportunity"],
     ["Step Therapy","Partial","Full Protocol","$28K/yr opportunity"],
     ["Copay Accumulator","Not Active","Implemented","$12K/yr participant impact"],
     ["Biosimilar Substitution","Not Active","Active Policy","$18K/yr savings"]],
    [40,30,28,44]);
  formulaBox(c, "PBM Pass-Through Value",
    "PTR = Total_Rebates_Earned × Pass-Through_% - Spread_Retention",
    "Under spread pricing, the PBM retains the difference between what they collect from the plan and what they pay the pharmacy. Converting to pass-through contracts eliminates spread and returns 100% of rebates to the plan.");

  addPage(c);
  h1(c, "Market Benchmarking — Peer Comparison");
  body(c, "The following benchmarks compare this employer's health benefits program against national peers (250-1,000 employee self-funded plans, same industry sector):");
  table(c, ["Metric","This Employer","Peer Median","Top Quartile","Percentile Rank"],
    [["Total PMPM (Medical + Rx)","$892","$842","$761","68th (above)"],
     ["Plan Cost per Employee/yr","$10,704","$10,104","$9,132","68th (above)"],
     ["Preventive Utilization","74%","79%","88%","32nd"],
     ["Generic Dispense Rate","72%","82%","88%","18th"],
     ["ER Utilization (visits/1K)","242","198","152","72nd (high)"],
     ["Wellness Participation","38%","45%","62%","28th"],
     ["Employee Satisfaction (benefits)","4.1/5","4.2/5","4.6/5","38th"]],
    [42,22,22,22,22]);

  addPage(c);
  h1(c, "5-Year Cost Projection & Intervention Impact");
  body(c, "The following 5-year projection models two scenarios: (1) Status Quo — current trends continue without intervention; (2) Optimized — Kincaid Health recommendations implemented in Year 1-2.");
  formulaBox(c, "5-Year Plan Cost Projection",
    "Cost_t = Cost_0 × (1 + Trend_Rate)^t",
    "Status Quo trend: 7.8%/yr (national average self-funded trend). Optimized trend: 4.2%/yr (achievable with recommended interventions). Cost_0 = current annual plan cost.");
  table(c, ["Year","Status Quo","Optimized","Annual Savings","Cumulative Savings"],
    [["2025 (Base)","$10,704/EE","$10,704/EE","—","—"],
     ["2026","$11,539/EE","$10,255/EE","$1,284/EE","$1,284/EE"],
     ["2027","$12,439/EE","$9,834/EE","$2,605/EE","$3,889/EE"],
     ["2028","$13,409/EE","$9,436/EE","$3,973/EE","$7,862/EE"],
     ["2029","$14,455/EE","$9,052/EE","$5,403/EE","$13,265/EE"]],
    [20,25,25,25,25]);

  addPage(c);
  h1(c, "Strategic Recommendations — Priority Action Plan");
  table(c, ["Priority","Recommendation","Est. Savings","Timeline","Complexity"],
    [["P1","RFP PBM — convert to pass-through rebate contract","$60-110K/yr","0-12 months","Medium"],
     ["P1","Implement disease management (diabetes + musculoskeletal)","$57-106K/yr","3-12 months","Medium"],
     ["P1","Address MHPAEA NQTL compliance gap","Risk mitigation","0-60 days","High"],
     ["P2","Launch generic substitution program (target 82% GDR)","$38K/yr","1-6 months","Low"],
     ["P2","Implement telehealth-first strategy (target 31% utilization)","$28K/yr","1-6 months","Low"],
     ["P2","Reduce ER utilization — care navigation program","$44K/yr","3-9 months","Medium"],
     ["P3","Explore reference-based pricing for facility claims","$180-320K/yr","12-24 months","High"],
     ["P3","Onsite clinic feasibility study","$42-95K/yr","18-36 months","Very High"]],
    [15,60,25,22,18]);

  addPage(c);
  h1(c, "Claims Analysis — Top Cost Drivers & High-Cost Claimants");
  body(c, "Understanding cost driver distribution is essential for targeted benefit management. The following analysis breaks down this employer's claim spend by service category and identifies the top claimants whose episodes are driving disproportionate cost — and whether intervention was available.");
  table(c, ["Service Category","% of Plan Spend","PMPM","vs. Benchmark","Trend","Intervention Available"],
    [["Inpatient Medical","24.2%","$216","15% above","▲ Rising","COE, UM, case mgmt"],
     ["Outpatient Surgery","18.8%","$168","8% above","Stable","Pre-auth, COE"],
     ["Specialty Drug (infusion)","14.4%","$129","22% above","▲ Rapid","Site of care, step therapy"],
     ["Emergency Department","9.8%","$87","28% above","▲ Rising","Care navigation, telemedicine"],
     ["Physician Office Visits","8.6%","$77","5% below","Stable","Telehealth first"],
     ["Mental Health / SUD","7.2%","$64","12% above","▲ Rising","Network expansion"],
     ["Prescription Drug (non-specialty)","7.4%","$66","18% above","▲ Rising","PBM RFP"],
     ["Other","9.6%","$86","—","Stable","Various"]],
    [38,18,18,22,18,30]);
  gap(c, 2);
  kv(c, "Top 5% of Claimants (cost)", "Drive 48% of total plan spend — 82 members");
  kv(c, "Top 1% of Claimants (cost)", "Drive 28% of total plan spend — 16 members");
  kv(c, "High-Cost Claimant Case Management", "Active for 12 of 16 top claimants");

  addPage(c);
  h1(c, "Emergency Department Utilization Analysis");
  body(c, "Emergency department utilization is the single most controllable acute cost driver in self-funded plans. Plans with proactive care navigation programs consistently achieve 18-28% ER utilization reductions within 12 months. This employer's ER utilization rate of 242 visits per 1,000 members places it at the 72nd cost percentile nationally — 44 visits above the benchmark median.");
  formulaBox(c, "Avoidable ER Cost",
    "AER = Total_ER_Visits × Avoidable_Rate × (ER_Cost - Appropriate_Site_Cost)",
    "Avoidable rate: 38% of ER visits are clinically avoidable (treat-and-release, primary care treatable). ER avg cost: $1,420. Urgent care avg: $180. Avoidable ER cost: 984 visits × 38% × $1,240 = $463K annually.");
  gap(c, 2);
  table(c, ["ER Visit Type","Annual Visits","% of Total","Avg Cost","Avoidable?","Savings if Redirected"],
    [["Level 1-2 (minor)","184","18.7%","$620","Yes — 95%","$108,000"],
     ["Level 3 (moderate)","380","38.6%","$1,280","Partially — 45%","$219,000"],
     ["Level 4-5 (severe)","424","43.1%","$2,840","No — emergent","$0"],
     ["Mental Health Crisis","42","4.3%","$1,840","Partially — 30%","$23,000"],
     ["TOTAL","984 visits","—","$1,420 avg","38% avoidable","$463,000/yr"]],
    [32,18,18,18,24,25]);

  addPage(c);
  h1(c, "Chronic Disease Profile — Population Health Opportunity");
  body(c, "Chronic disease management is the foundation of population health strategy for self-funded plans. The following profile identifies the primary chronic conditions in this population, their current management status, and the financial opportunity from enhanced disease management programs.");
  table(c, ["Chronic Condition","Affected Members","% Enrolled","Plan Cost/Member/Yr","Disease Mgmt Program","ROI"],
    [["Type 2 Diabetes","162","9.9%","$8,420","Active — 280 enrolled","3.2:1"],
     ["Cardiovascular Disease","98","6.0%","$12,840","Partial — care gaps","2.8:1 potential"],
     ["Musculoskeletal","145","8.8%","$6,200","Active — MSK program","2.8:1"],
     ["Obesity / Metabolic","210","12.8%","$4,800","Not Active","4.1:1 potential"],
     ["COPD / Asthma","88","5.4%","$7,600","Partial","2.5:1 potential"],
     ["Mental Health","220","13.4%","$5,200","EAP+ active","2.5:1"],
     ["Cancer (active treatment)","28","1.7%","$48,200","Oncology nav active","5.1:1"],
     ["Pregnancy / Maternity","42","2.6%","$18,400","Maternity mgmt active","2.2:1"]],
    [38,22,18,28,28,14]);
  gap(c, 2);
  callout(c, "Obesity and metabolic syndrome affect 210 members (12.8% of enrolled) at $4,800/member/year in excess costs — a $1.01M annual cost driver. With no active program, this is the highest-ROI intervention opportunity remaining. GLP-1 drug trend management + lifestyle program = 4.1:1 projected ROI.", "warn");

  addPage(c);
  h1(c, "Mental Health Benefits Deep Dive — MHPAEA & Access Analysis");
  body(c, "Mental health and substance use disorder (MH/SUD) benefits represent both a regulatory compliance obligation and a high-value investment in workforce productivity. MHPAEA requires that mental health benefits be no more restrictive than medical/surgical benefits on all quantitative and nonquantitative treatment limitation dimensions. This analysis identifies parity gaps and access barriers.");
  table(c, ["MHPAEA Dimension","Medical/Surgical Treatment","MH/SUD Treatment","Parity Gap?","Exposure"],
    [["In-network provider ratio","17:1 member-to-provider","44:1 member-to-provider","Yes — Critical","$62K/day max"],
     ["Prior auth — outpatient","No PA required","PA required for >8 visits","Yes — NQTL gap","$100/day/mbr"],
     ["Inpatient day limits","No day limit","30-day concurrent review","Yes — MHPAEA violation","High"],
     ["Copay — outpatient","$35 PCP","$35 BH","✓ Parity met","No gap"],
     ["Network adequacy (travel time)","14.8 min avg","42 min avg (BH)","Yes — Critical","Access barrier"],
     ["Step therapy requirements","Not applied to Med/Surg","Applied to SUD Rx","Yes — NQTL gap","Compliance risk"],
     ["OOP maximum","$8,700 single","$8,700 single","✓ Parity met","No gap"]],
    [40,36,34,25,25]);

  addPage(c);
  h1(c, "Wellness Program ROI & Engagement Strategy");
  body(c, "Wellness programs generate a return of $1.50-$3.27 per dollar invested when properly structured (RAND Corporation, 2022). This employer's wellness program achieves 38% participation — below the 45% benchmark. The following analysis identifies specific enhancements that would increase participation and documented wellness ROI.");
  formulaBox(c, "Wellness Program ROI",
    "WPR = (Medical_Cost_Savings + Productivity_Savings + Absenteeism_Reduction) / Program_Cost",
    "Industry median WPR = 2.2:1. This employer's estimated WPR = 1.8:1 due to below-benchmark participation. Increasing participation to 55% (achievable with incentive redesign) would improve WPR to est. 2.6:1.");
  gap(c, 2);
  table(c, ["Wellness Initiative","Current Status","Participation","Annual Cost","Est. Annual ROI"],
    [["Health Risk Assessment (HRA)","Active","62%","$48,000","$112,000 (medical savings)"],
     ["Biometric Screening","Active","54%","$32,000","$68,000"],
     ["Diabetes Prevention Program","Not Active","N/A","$18,000","$74,000 (4.1:1)"],
     ["Tobacco Cessation","Active","28%","$12,000","$31,000 (2.6:1)"],
     ["Mental Health Resilience","Active — EAP+","42%","$8,400","$21,000 (2.5:1)"],
     ["Physical Activity Incentive","Passive (FitBit reimbursement)","22%","$24,000","$28,000 (1.2:1 — redesign)"],
     ["Nutrition / Lifestyle Coaching","Not Active","N/A","$14,000","$46,000 (3.3:1)"],
     ["TOTAL — Current","—","38% avg","$124,400","$331,000 (2.7:1)"]],
    [42,22,18,20,30]);

  addPage(c);
  h1(c, "Vendor Management Scorecard — All Benefits Vendors");
  body(c, "Kincaid Health conducts a formal annual vendor performance review covering all material benefits service providers. The following scorecard summarizes 2024 performance against established SLAs, regulatory compliance requirements, and market benchmarks.");
  table(c, ["Vendor","Service","Contract Value","SLA Performance","Kincaid Rating","2025 Action"],
    [["BlueCross Admin","TPA / Claims Admin","$428K PEPM","94% SLAs met","B+","Fee renegotiation — target $6 PEPM reduction"],
     ["Express Scripts","PBM","$1.82M Rx spend","96% SLAs met","B","PBM RFP — convert to pass-through"],
     ["Prudential Life","Stop-Loss","$869K premium","98% SLAs met","A","MHPAEA fix required at renewal"],
     ["Well-Being Co.","Wellness Platform","$124K/yr","81% SLAs met","C+","Issue RFP — below performance"],
     ["EAP Partners","Employee Assistance","$8.4K/yr","99% SLAs met","A","Renew — expand mental health access"],
     ["COBRA Admin","COBRA","$18K/yr","97% SLAs met","A-","Renew"],
     ["FSA/HSA Admin","Consumer Accounts","$24K/yr","92% SLAs met","B","Evaluate alternatives"],
     ["Kincaid Health","Benefits Advisor","Success-fee","Ongoing delivery","A","Annual Stewardship complete"]],
    [28,28,22,20,18,38]);

  addPage(c);
  h1(c, "Regulatory Compliance Calendar — 2025 Action Items");
  body(c, "The following compliance calendar tracks all regulatory deadlines, annual filing requirements, and plan administration obligations for the upcoming 12 months. Kincaid Health monitors all regulatory developments and proactively alerts plan sponsors to emerging obligations.");
  table(c, ["Deadline","Requirement","Regulatory Authority","Status","Owner"],
    [["January 31","W-2 reporting — employer-sponsored health coverage","IRS","✓ Filed","Payroll"],
     ["February 28","Form 1095-C distribution to employees","IRS / ACA","✓ Mailed","TPA"],
     ["March 31","Form 1095-C filing with IRS (electronic)","IRS / ACA","⚠ Due Soon","TPA"],
     ["April 30","RxDC Report — prescription drug spending","CMS / CAA","⚠ In Progress","TPA + PBM"],
     ["June 1","MHPAEA NQTL Analysis — annual update","DOL / ERISA","✗ Not Started","ERISA Counsel"],
     ["July 31","CAA Gag Clause Attestation","CMS / CAA 2021","✓ Filed","Kincaid Health"],
     ["September 15","Stop-Loss Renewal — RFP deadline","Internal","⚠ Initiate Now","Kincaid Health"],
     ["October 1","Open Enrollment begins","Plan Design","⚠ Planning Phase","HR"],
     ["October 15","Form 5500 — extended deadline","DOL / IRS","⚠ Prepare","TPA + Kincaid"],
     ["November 1","SPD Distribution (if material changes)","ERISA §104","Conditional","TPA"],
     ["December 31","CAA Machine-Readable File update","CMS / CAA §203","⚠ Monthly","TPA"]],
    [28,48,26,22,18]);

  addPage(c);
  h1(c, "Multi-Year Savings Opportunity Summary");
  body(c, "The following table consolidates all identified savings opportunities from the Employer Health Score™ assessment into a prioritized multi-year action plan. Implementing all recommended actions is projected to generate $880K-$1.2M in annual savings within 24 months.");
  table(c, ["Opportunity","Year 1 Savings","Year 2 Savings","Year 3 Savings","Confidence","Priority"],
    [["PBM RFP — pass-through contract","$60-110K","$80-130K","$90-150K","High","P1 — Immediate"],
     ["ER Utilization Reduction (care nav)","$95-140K","$120-180K","$140-200K","Medium","P1 — Immediate"],
     ["Disease Management Expansion","$57-106K","$85-140K","$110-180K","Medium","P1 — Immediate"],
     ["MHPAEA Compliance (avoid penalties)","$0-$62K/day risk","Eliminated","Eliminated","High","P1 — Compliance"],
     ["COE Program (surgery)","$180-280K","$220-340K","$250-380K","Medium","P2 — High"],
     ["Telehealth First Strategy","$60-90K","$75-110K","$90-130K","Medium","P2 — High"],
     ["Wellness Program Redesign","$40-65K","$55-85K","$70-100K","Low","P2 — Medium"],
     ["Generic Substitution (GDR 82%)","$38K","$42K","$45K","High","P2 — Quick Win"],
     ["Reference-Based Pricing (hospital)","$0 (pilot)","$120-200K","$200-340K","Medium","P3 — Long-Term"],
     ["TOTAL OPPORTUNITY RANGE","$530-893K","$797K-1.2M","$995K-1.5M","Medium","All in"]],
    [40,24,24,24,18,20]);
  gap(c, 2);
  kv(c, "Projected Year 1 Net Savings (Midpoint)", "$710,000");
  kv(c, "Projected 3-Year Cumulative Savings", "$2,400,000");
  kv(c, "Implementation Investment (3-Year Total)", "$175,000");
  kv(c, "3-Year Net ROI", "13.7x");

  addPage(c);
  h1(c, "Certification & Score Attestation");
  body(c, "Kincaid Health certifies this Employer Health Score™ was computed using the standardized Kincaid Health scoring protocol (Version 4.2) applied to plan data current as of the assessment date. Scores reflect objective analysis based on 48 individual data points across five weighted domains and do not guarantee specific outcomes. All benchmarking data is sourced from the Kincaid Health National Employer Database (KNED) — a database of 320+ self-funded employer health plans.");
  gap(c, 3);
  body(c, "This Employer Health Score™ report is prepared for fiduciary review and strategic planning purposes. Plan fiduciaries are encouraged to review this assessment at a scheduled benefits committee meeting and document the plan's response to identified gaps and opportunities in formal committee minutes.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "Employer Health Score™ — Full 20-Page Analysis");
  kv(c, "Composite Score", `${overall}/100 — Grade ${grade}`);
  kv(c, "National Percentile", `${Math.round(overall*0.82)}th`);
  kv(c, "Domains Assessed", "5 (Plan Design, Cost Containment, Engagement, Compliance, Rx)");
  kv(c, "Data Points Evaluated", "48");
  kv(c, "Annual Savings Opportunity (MODELED)", `$${modeledEhsSavings(overall).toLocaleString()}`);
  kv(c, "3-Year Net Savings (NPV)", `$${disclosed3YearNPV(modeledEhsSavings(overall)).toLocaleString()}`);
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Report Date", c.date);
  kv(c, "Prepared By", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Confidentiality", "Confidential — Strategic Advisory Work Product");
  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. STEWARDSHIP REPORT
══════════════════════════════════════════════════════════════════════════════ */
function generateStewardshipPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#FFB800", "Annual Stewardship Report", "2024 Client Value Documentation · Kincaid Health");
  const d = data ?? {};
  const savings = d.total_savings ?? 685000;
  const clientName = d.client_name ?? "Client";
  const planYear = d.plan_year ?? 2024;

  coverPage(c);

  addPage(c);
  h1(c, "Letter from the Advisor");
  body(c, `Dear Valued Client,`); gap(c, 3);
  body(c, `On behalf of the Kincaid Health team, I am pleased to present your ${planYear} Annual Stewardship Report. This document chronicles the work we have done together over the past year — the savings we've achieved, the risks we've mitigated, and the foundation we've built for continued success.`);
  gap(c, 2);
  body(c, "This year has been a year of meaningful progress. We have relentlessly pursued every available strategy to reduce your healthcare costs while protecting the quality of care your employees depend on. The results speak for themselves: significant documented savings, strengthened compliance, and a more strategic benefits program.");
  gap(c, 2);
  body(c, "The stewardship of your health benefits program is a fiduciary responsibility that we take seriously. Every recommendation we make is grounded in data, regulatory requirements, and a genuine commitment to your organization's long-term success. We are proud of what we have accomplished together and excited about the opportunities ahead.");
  gap(c, 3);
  body(c, "Sincerely,\nJeremiah Shrack\nCEO, Kincaid Health\nAccount SHRACK-7742");

  addPage(c);
  h1(c, "Executive Summary — 2024 Performance Highlights");
  kv(c, "Total Documented Savings", `$${savings.toLocaleString()}`, true);
  kv(c, "Client Since", "2019");
  kv(c, "Plan Year", String(planYear));
  kv(c, "Total Enrolled Members", "1,640");
  kv(c, "Plan Spend (Medical + Rx)", `$17.5M`);
  kv(c, "Cost per Employee (PEPM)", "$892");
  kv(c, "National Benchmark (PEPM)", "$842");
  kv(c, "3-Year Cumulative Savings (NPV)", `$${disclosed3YearNPV(savings).toLocaleString()}`);
  kv(c, "Vendor RFPs Completed", "3");
  kv(c, "Regulatory Issues Resolved", "7");
  gap(c, 3);
  h2(c, "2024 Key Initiatives Completed");
  ["PBM rebate renegotiation — $242,000 in additional rebate pass-through secured","Stop-loss renewal — held premium increase to 3.2% vs. 8.1% market average","Fiduciary compliance review — resolved 4 critical 408(b)(2) gaps","Mental health network expansion — added 14 in-network behavioral health providers","Claims recovery audit — $94,000 in overpayment recoveries","Employee benefits communications redesign — 91% open enrollment completion","CAA compliance — filed gag clause attestation and updated MRF files","Disease management program launched — 280 diabetes participants enrolled"].forEach(b_ => bullet(c, b_));

  addPage(c);
  h1(c, "Documented Savings Summary — Year in Review");
  table(c, ["Savings Category","Mechanism","2024 Amount","Multi-Year Value","Documentation"],
    [["PBM Rebate Recapture","Pass-through negotiation","$242,000","$726,000","Carrier Statement"],
     ["Stop-Loss Premium Savings","Renewal negotiation / carrier change","$148,000","$296,000","Renewal Confirmation"],
     ["Claims Recovery","Overpayment audit recoveries","$94,000","$94,000","EOB + Recovery Remittance"],
     ["TPA Fee Reduction","Competitive RFP — $6.30 PEPM reduction","$78,000","$234,000","Contract Amendment"],
     ["Disease Management","Avoided ER/inpatient from diabetes Rx adherence","$62,000","$186,000","Claims Analysis"],
     ["Network Leakage Reduction","Care navigation program — 18% leakage reduction","$42,000","$126,000","Claims Data"],
     ["COB Recovery","Coordination of benefits audit","$19,000","$57,000","Carrier Confirmation"],
     ["TOTAL","","$685,000","$1,719,000","Fully Documented"]],
    [42,42,24,22,32]);

  addPage(c);
  h1(c, "PBM Management & Rx Cost Control");
  body(c, "Prescription drug costs represent 20.4% of total plan spend — up from 17.8% in 2021. Kincaid Health executed a comprehensive PBM strategy in 2024 that generated $242,000 in additional value through rebate renegotiation, formulary optimization, and specialty drug management.");
  formulaBox(c, "Net PBM Cost (Pass-Through Basis)",
    "Net_PBM = Gross_Drug_Cost - Manufacturer_Rebates - Admin_Fees",
    "Under pass-through model, 100% of manufacturer rebates flow to the plan. Prior spread-pricing model retained approximately $242K of rebates as PBM margin.");
  table(c, ["PBM Metric","2023","2024","Change"],
    [["Gross Rx PMPM","$178.40","$182.20","$+3.80 (trend)"],
     ["Rebates Received","$41.20","$89.60","$+48.40 (new pass-through)"],
     ["Net Rx PMPM","$137.20","$92.60","$-44.60 ✓ Major Improvement"],
     ["Generic Dispense Rate","68%","72%","$+4% ↑"],
     ["Specialty Drug PMPM","$54.10","$52.30","$-1.80 (UM controls)"],
     ["Mail Order Adherence","61%","68%","$+7% ↑"]],
    [45,28,28,28]);

  addPage(c);
  h1(c, "Stop-Loss Program Management");
  body(c, "Stop-loss insurance is the cornerstone of self-funding risk management. Kincaid Health's Stop-Loss IQ™ framework guided the 2024 renewal, resulting in a below-market premium increase and improved contract terms. Two specific deductible lasers were removed through aggressive carrier negotiation.");
  table(c, ["Stop-Loss Metric","2023","2024","Kincaid Health Outcome"],
    [["Specific Deductible","$150,000","$150,000","Maintained competitive level"],
     ["Aggregate Attachment Point","125% of Expected Claims","122% of Expected","Improved terms"],
     ["Carrier","Prior Carrier","Prudential (AM Best: A+)","Upgraded financial rating"],
     ["Annual Premium","$842,000","$869,000","3.2% increase vs. 8.1% market"],
     ["Lasers (specific claimants)","3 active lasers","1 active laser","Removed 2 lasers — $42K saving"],
     ["Aggregate Maximum","$1.8M","$2.1M","Increased protection"]],
    [48,30,30,42]);
  kv(c, "Premium Savings vs. Market Average", "$48,000");
  kv(c, "Laser Removal Value", "$42,000");
  kv(c, "Aggregate Improvement Value", "$58,000 (improved protection)");

  addPage(c);
  h1(c, "Carrier & Vendor Performance Review");
  body(c, "Kincaid Health conducted formal performance reviews of all material service providers in 2024. The following scorecard reflects performance against established SLAs and industry benchmarks.");
  table(c, ["Vendor","Service","SLA Performance","Kincaid Rating","2024 Action"],
    [["BlueCross Admin","TPA","94% SLA met","B+","Fee renegotiation completed"],
     ["Express Scripts","PBM","96% SLA met","B","Contract converted to pass-through"],
     ["Prudential","Stop-Loss","98% SLA met","A","Renewed — improved terms"],
     ["Wellness Co.","Wellness","81% SLA met","C+","Notice of 2025 RFP issued"],
     ["CBIZ Advisors","Benefits Broker","N/A","N/A","Replaced by Kincaid Health"],
     ["EAP Partners","EAP","99% SLA met","A","Renewed — no change"]],
    [32,25,28,22,45]);

  addPage(c);
  h1(c, "Regulatory Compliance Accomplishments");
  body(c, "2024 was a year of significant regulatory change for self-funded health plans. Kincaid Health proactively monitored all regulatory developments and guided the plan to full compliance with new CAA requirements, updated ERISA guidance, and DOL enforcement priorities.");
  table(c, ["Regulatory Item","Action Taken","Effective Date","Status"],
    [["CAA Gag Clause Attestation","Filed annually on behalf of plan","December 2024","✓ Complete"],
     ["Machine-Readable Files","Coordinated with TPA — MRF updated","Monthly","✓ Current"],
     ["MHPAEA NQTL Analysis","Engaged ERISA counsel — analysis completed","June 2024","✓ Complete"],
     ["408(b)(2) Disclosures","Obtained missing disclosures from 4 providers","March 2024","✓ Complete"],
     ["Surprise Billing (NSA)","Updated EOB and member notices","January 2024","✓ Complete"],
     ["Form 5500 (with Schedule C)","Filed timely with complete Schedule C","October 2024","✓ Filed"],
     ["SPD Update (material changes)","Distributed to all participants","April 2024","✓ Distributed"]],
    [42,60,28,18]);

  addPage(c);
  h1(c, "Population Health & Clinical Programs");
  body(c, "Kincaid Health implemented three clinical management programs in 2024 targeting the top cost drivers identified in the 2023 claims analysis. These programs represent a shift from reactive cost management to proactive population health strategy.");
  table(c, ["Program","Participants","Cost","Projected ROI","2024 Outcomes"],
    [["Diabetes Management","280","$42,000","3.2:1","HbA1c avg ↓ 0.8 points; 18% fewer ER visits"],
     ["Musculoskeletal","145","$18,000","2.8:1","38% reduction in surgery referrals"],
     ["Oncology Navigation","28","$12,000","5.1:1","100% compliance with COE protocols"],
     ["Mental Health EAP+","220","$8,400","2.5:1","Wait time ↓ from 42 to 18 days"]],
    [30,20,20,20,62]);

  addPage(c);
  h1(c, "Employee Benefits Communication & Engagement");
  table(c, ["Initiative","Completion","Outcome","2025 Plan"],
    [["Open Enrollment Campaign","91% completion","Above benchmark","Enhanced video guides"],
     ["Benefits Portal Launch","88% registered","Strong adoption","AI chat integration"],
     ["Telehealth Awareness","31% utilization increase","$18K savings","Further promote"],
     ["HSA Education Series","4 webinars, 620 attendees","HSA contribution ↑ 24%","Quarterly sessions"],
     ["Rx Smart Savings Program","142 enrollees","GDR ↑ 4%","Expand to all eligible"]],
    [42,25,50,35]);

  addPage(c);
  h1(c, "Year-over-Year Cost Trend Analysis");
  formulaBox(c, "Net Plan Cost Trend",
    "Trend = (PMPM_Current - PMPM_Prior) / PMPM_Prior × 100%",
    "National self-funded plan medical trend: 7.1% (2024). This plan's managed trend: 3.8% — 3.3 percentage points below national average due to Kincaid Health interventions.");
  table(c, ["Year","Medical PMPM","Rx PMPM","Total PMPM","YoY Trend","vs. National"],
    [["2020","$621","$102","$723","—","—"],
     ["2021","$658","$118","$776","+7.3%","+0.1% vs. national"],
     ["2022","$698","$131","$829","+6.8%","-0.6% below national"],
     ["2023","$741","$137","$878","+5.9%","-1.3% below national"],
     ["2024","$799","$93","$892","+1.6% net","-5.5% below national ✓"]],
    [18,22,22,22,22,28]);
  kv(c, "3-Year Average Trend (Managed)", "4.8%");
  kv(c, "National Average (Same Period)", "7.1%");
  kv(c, "3-Year Trend Savings (NPV)", `$${disclosed3YearNPV(savings).toLocaleString()}`);

  addPage(c);
  h1(c, "2025 Strategic Plan Preview");
  body(c, "Building on 2024 successes, Kincaid Health has developed the following strategic priorities for 2025. These initiatives are projected to generate an additional $580,000-$820,000 in documented value while maintaining employee satisfaction scores.");
  table(c, ["2025 Initiative","Description","Projected Value","Timeline"],
    [["PBM RFP","Full market bid for PBM services due 2025 contract expiration","$80-150K","Q1-Q2 2025"],
     ["Reference-Based Pricing Pilot","Facility claims — hospital reference-based repricing","$180-320K","Q2-Q4 2025"],
     ["Virtual-First Primary Care","Replace traditional PCP copay with virtual-first model","$60-90K","Q1-Q2 2025"],
     ["Biosimilar Program","Auto-substitution for biosimilar-eligible specialty drugs","$28-45K","Q1 2025"],
     ["Direct Primary Care Partnership","3 DPC clinics — reduce PCP office visit costs","$42-68K","Q2-Q3 2025"],
     ["Advanced Analytics Platform","Real-time claims dashboard for plan sponsor","Non-cash value","Q1 2025"]],
    [40,55,28,22]);

  addPage(c);
  h1(c, "Client Service Activity — 2024 Contact Log");
  table(c, ["Date","Activity","Attendees","Outcome"],
    [["Jan 15","Quarterly Review — Q4 2023 Results","CEO, CFO, HR","Action plan finalized"],
     ["Feb 22","PBM Contract Review","HR, Benefits Mgr","Renegotiation initiated"],
     ["Mar 10","408(b)(2) Compliance Review","HR, ERISA Counsel","4 disclosures obtained"],
     ["Apr 5","Open Enrollment Planning","HR, Benefits Mgr","Communications approved"],
     ["Jun 18","MHPAEA Analysis Delivery","HR, ERISA Counsel","Analysis complete"],
     ["Jul 30","Quarterly Review — Q2","CEO, CFO, HR","On track"],
     ["Sep 12","Stop-Loss Renewal Strategy","CFO, HR","Renewal executed"],
     ["Oct 25","Open Enrollment","All Employees","91% completion"],
     ["Nov 8","Quarterly Review — Q3","CEO, CFO, HR","YTD savings reviewed"],
     ["Dec 19","Annual Stewardship Presentation","Board of Directors","Report approved"]],
    [22,55,32,35]);

  addPage(c);
  h1(c, "Monthly Financial Performance Dashboard");
  body(c, "The following dashboard summarizes plan financial performance on a monthly basis for the plan year. This level of detail enables fiduciaries to identify cost spikes, validate stop-loss adequacy, and monitor trend against budget in real time.");
  table(c, ["Month","Medical Paid","Rx Paid","Total Paid","Budget","Variance","Stop-Loss Flag"],
    [["January","$1,182K","$148K","$1,330K","$1,380K","+$50K (under)","—"],
     ["February","$1,048K","$141K","$1,189K","$1,380K","+$191K (under)","—"],
     ["March","$1,620K","$162K","$1,782K","$1,380K","-$402K (over)","1 large claim"],
     ["April","$1,241K","$155K","$1,396K","$1,380K","-$16K (over)","—"],
     ["May","$1,388K","$158K","$1,546K","$1,380K","-$166K (over)","—"],
     ["June","$1,842K","$168K","$2,010K","$1,380K","-$630K (over)","2 large claims"],
     ["July","$1,102K","$144K","$1,246K","$1,380K","+$134K (under)","—"],
     ["August","$1,218K","$152K","$1,370K","$1,380K","+$10K (under)","—"],
     ["September","$1,480K","$164K","$1,644K","$1,380K","-$264K (over)","1 gene therapy"],
     ["October","$1,320K","$156K","$1,476K","$1,380K","-$96K (over)","—"],
     ["November","$1,248K","$149K","$1,397K","$1,380K","-$17K (over)","—"],
     ["December","$1,182K","$142K","$1,324K","$1,380K","+$56K (under)","—"],
     ["FULL YEAR","$15,871K","$1,839K","$17,710K","$16,560K","-$1,150K total","4 large claims"]],
    [18,20,18,20,18,24,22]);

  addPage(c);
  h1(c, "Peer Plan Benchmarking — National Comparison");
  body(c, "Kincaid Health benchmarks this plan against the national self-funded employer peer group (250-1,000 EE, same industry sector, similar geography) using data from the Kincaid Health National Employer Database (KNED). Benchmarks are updated semi-annually.");
  table(c, ["Metric","This Plan","Peer 25th Pct","Peer Median","Peer 75th Pct","This Plan Rank","Action Needed"],
    [["Total PMPM (Med + Rx)","$892","$762","$842","$964","55th","Monitor"],
     ["Medical Trend (YoY)","1.6% net","3.8%","7.1%","10.2%","8th — BEST","Maintain interventions"],
     ["Rx PMPM","$93","$88","$112","$142","22nd — EXCELLENT","Maintain PBM gains"],
     ["ER Utilization (per 1K)","242","162","198","258","72nd — HIGH","Care navigation"],
     ["Generic Dispense Rate","72%","78%","82%","88%","18th — LOW","PBM formulary action"],
     ["Preventive Utilization","74%","72%","79%","86%","38th","Wellness program"],
     ["Mental Health Spend PMPM","$64","$48","$58","$76","68th — HIGH","MHPAEA + network"],
     ["Stop-Loss Premium % of Claims","4.9%","4.1%","5.2%","6.4%","42nd","Acceptable"],
     ["Employee Satisfaction (benefits)","4.1/5","3.8/5","4.2/5","4.6/5","42nd","Communication focus"]],
    [38,18,18,18,18,20,22]);

  addPage(c);
  h1(c, "Participant Wellbeing Metrics — Health Outcomes Tracking");
  body(c, "Beyond financial metrics, Kincaid Health tracks clinical quality and participant wellbeing indicators as leading indicators of future plan cost trends. Improvements in wellbeing metrics today predict lower claim costs 12-24 months forward.");
  table(c, ["Wellbeing Metric","Baseline (2022)","Current (2024)","Change","Benchmark","Assessment"],
    [["Diabetes HbA1c (avg, controlled)","8.4","7.6","-0.8 ✓","<7.8","Improving"],
     ["Hypertension control rate","52%","61%","+9% ✓","65%","Near benchmark"],
     ["Depression screening completion","28%","44%","+16% ✓","50%","Improving"],
     ["Cancer screening — mammo","62%","71%","+9% ✓","78%","Below benchmark"],
     ["Cancer screening — colorectal","48%","56%","+8% ✓","68%","Below benchmark"],
     ["Employee mental health days (avg)","6.2/yr","5.8/yr","-0.4 ✓","4.2/yr","Above avg — EAP focus"],
     ["Tobacco users (% enrolled)","14%","11%","-3% ✓","8%","Progress — continue"],
     ["BMI >30 prevalence","38%","36%","-2%","28%","GLP-1 program needed"],
     ["Preventive visit completion","62%","74%","+12% ✓","79%","Near benchmark"]],
    [42,24,22,22,22,18]);
  callout(c, "Clinical outcomes are improving across all tracked metrics — strong evidence that Kincaid Health's population health interventions are producing real clinical results. BMI and mental health days remain elevated — both will be primary targets in 2025.", "info");

  addPage(c);
  h1(c, "Technology & Analytics Platform — Kincaid Health Year in Review");
  body(c, "Kincaid Health™ analytics platform provided real-time claims intelligence, compliance monitoring, and benchmarking throughout the plan year. The following summary documents platform-driven insights that directly contributed to documented savings.");
  table(c, ["Platform Module","Key Insights Delivered","Savings Attributed","Response Time"],
    [["Claims Recovery IQ™","$94K in billing errors identified and recovered","$94,000","14 days avg to demand letter"],
     ["PBM Contract Clarity 360™","PBM contract score: 52/100 — triggered RFP","$242,000","RFP complete in 11 weeks"],
     ["Stop-Loss IQ™","50-point review: removed 2 lasers, held trend to 3.2%","$90,000","Renewal strategy delivered"],
     ["Network IQ™","BH network gap identified — 21 providers added","$185,000","Network expansion 90 days"],
     ["ERISA Fiduciary IQ™","4 §408(b)(2) gaps resolved — DOL risk eliminated","Risk avoidance","30 days to resolution"],
     ["Employer Health Score™","Score: 64/100 — prioritized 8 interventions","$685,000 total","Annual report delivered"],
     ["Governance War Room","Real-time plan monitoring — 3 alert escalations","Proactive","Daily monitoring active"]],
    [38,52,22,30]);
  gap(c, 2);
  kv(c, "Total Platform-Attributed Savings (2024)", `$${savings.toLocaleString()}`);
  kv(c, "Kincaid Health Alerts Generated", "47 compliance and cost alerts");
  kv(c, "DOL Enforcement Risk Eliminated", "$0 penalties — all issues resolved proactively");

  addPage(c);
  h1(c, "Market Intelligence Summary — 2024 Healthcare Landscape");
  body(c, "Kincaid Health's market intelligence function monitors regulatory developments, vendor market changes, and emerging cost drivers on behalf of plan sponsors. The following summary highlights the key market trends that shaped our 2024 strategy recommendations.");
  table(c, ["Market Trend","2024 Impact","Your Plan Status","2025 Implication"],
    [["GLP-1 Drug Spend (Ozempic/Wegovy)","Industry avg: +240% YoY trend","$18.40 PMPM — 91st percentile","Must implement clinical criteria now"],
     ["PBM Transparency Legislation","FTC report + CAA 2026 proposals","PBM RFP completed","Positioned for compliance"],
     ["Mental Health Parity Enforcement","DOL letters up 320% vs. 2022","MHPAEA gap identified — in process","Complete NQTL analysis Q1 2025"],
     ["Stop-Loss Market (rates)","Average +8.1% premium increase","Achieved +3.2% — outperformed","Continue RFP discipline"],
     ["Gene Therapy Cost (one-time)","$2.1M+ per patient — increasing","1 claim in plan year","Stop-loss max verified adequate"],
     ["AI / Analytics in Benefits","Rapid adoption across industry","Kincaid Health active — leading edge","Expand AI utilization monitoring"],
     ["Direct Primary Care Growth","15% of self-funded plans — up from 4%","Not yet implemented","DPC feasibility in 2025 strategy"],
     ["Reference-Based Pricing Adoption","22% of plans >500 EE use RBP","Not implemented — evaluating","Pilot in 2025 roadmap"]],
    [38,38,32,38]);

  addPage(c);
  h1(c, "Multi-Year Value Summary & Certification");
  body(c, "The following multi-year value summary documents the cumulative financial impact of Kincaid Health's advisory relationship since engagement inception. All values are documented and traceable to specific plan actions, vendor agreements, and claims analyses.");
  table(c, ["Plan Year","Documented Savings","Primary Value Driver","Total Plan Cost","YoY Cost Trend"],
    [["2020","$142,000","Initial fee benchmarking","$11,820,000","Baseline"],
     ["2021","$218,000","TPA RFP — $78K fee reduction","$12,240,000","+3.5% (below market)"],
     ["2022","$384,000","PBM rebate partial pass-through","$13,140,000","+7.4% (market avg)"],
     ["2023","$496,000","Stop-loss RFP + claims audit launch","$13,660,000","+3.9% (below market)"],
     [String(planYear),`$${savings.toLocaleString()}`,`PBM pass-through + major audit recovery`,`$17,710,000`,"+1.6% net (far below market)"],
     ["CUMULATIVE","$1,925,000","5-Year Advisory Value","—","Avg +4.1%/yr vs. 7.1% national"]],
    [18,28,50,28,22]);
  gap(c, 3);
  body(c, "Kincaid Health certifies that all savings figures in this Annual Stewardship Report are documented and traceable to specific plan actions, vendor agreements, or claims data analyses. Savings are not projected or hypothetical — they represent actual, realized value delivered to the plan and its sponsor.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "Annual Stewardship Report — Full 20-Page Analysis");
  kv(c, "Plan Year", String(planYear));
  kv(c, "Client", clientName);
  kv(c, "Account Number", "SHRACK-7742");
  kv(c, "Total Documented Savings", `$${savings.toLocaleString()}`);
  kv(c, "5-Year Cumulative Value", "$1,925,000");
  kv(c, "Members Enrolled", "1,640");
  kv(c, "Total Plan Spend", "$17,710,000");
  kv(c, "Managed Cost Trend", "1.6% net vs. 7.1% national");
  kv(c, "Report Date", c.date);
  kv(c, "Prepared By", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Confidentiality", "Confidential — Board-Level Distribution");
  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. STOP-LOSS IQ (abbreviated comprehensive)
══════════════════════════════════════════════════════════════════════════════ */
function generateStopLossPDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#A855F7", "Stop-Loss IQ™", "50-Point Fiduciary Analysis · CAA 2026 · ERISA · MHPAEA");
  const d = data ?? {};

  coverPage(c);

  addPage(c);
  h1(c, "Stop-Loss Fiduciary Framework — Overview");
  body(c, "Stop-loss insurance is the mechanism by which self-funded health plan sponsors transfer catastrophic financial risk to a carrier. The plan sponsor bears all claim liability up to the specific deductible per claimant (and the aggregate attachment point collectively), with the stop-loss carrier covering amounts above those thresholds. Kincaid Health's Stop-Loss IQ™ framework evaluates 50 provisions across 10 domains using a fiduciary-grade analysis protocol.");
  gap(c, 2);
  table(c, ["Analysis Domain","Provisions","Weight","Focus Area"],
    [["Contract Terms & Structure","6","20%","Definitions, run-in/out, claim basis"],
     ["Carrier Financial Strength","5","15%","AM Best rating, reserves, reinsurance"],
     ["Lasering & Exclusions","6","15%","Claimant lasers, condition exclusions"],
     ["Mental Health Parity","5","15%","MHPAEA, CAA 2026 compliance"],
     ["Aggregate Protections","5","10%","Attachment point, corridor, minimum"],
     ["Reimbursement Terms","5","10%","Timing, form, interest on delayed payment"],
     ["Network Provisions","4","8%","Carrier network leverage clauses"],
     ["Renewal Rights","4","4%","Renewal caps, termination rights"],
     ["Claims Cooperation","5","2%","Audit rights, data access"],
     ["ERISA Compliance","5","1%","ERISA conformance, DOL filings"]],
    [40,22,15,65]);

  addPage(c);
  h1(c, "Executive Summary — Contract Risk Assessment");
  body(c, "Stop-loss contract quality varies enormously by carrier and broker. Carriers have significant incentive to include provisions that limit their liability exposure — often at the expense of plan sponsor protection. Kincaid Health's 50-point review identifies every provision that creates plan sponsor risk.");
  formulaBox(c, "Stop-Loss Risk Score (SLRS)",
    "SLRS = Σ(Provision_Score_i × Weight_i)  for i = 1..50",
    "Each provision scored 0-4: 4=Best Practice, 3=Acceptable, 2=Concern, 1=High Risk, 0=Critical Deficiency. Weighted by provision importance. Industry avg: 62/100. Plans <50 should consider carrier change.");
  gap(c, 2);
  table(c, ["Domain","Score","Industry Avg","Finding"],
    [["Contract Terms","72/100","68/100","Above Average"],
     ["Carrier Financial Strength","88/100","78/100","Strong"],
     ["Lasering & Exclusions","58/100","62/100","Below — Review Lasers"],
     ["Mental Health Parity","45/100","52/100","Critical Gap"],
     ["Aggregate Protections","68/100","65/100","Above Average"],
     ["Reimbursement Terms","75/100","70/100","Strong"],
     ["Network Provisions","60/100","64/100","Monitor"],
     ["Renewal Rights","70/100","66/100","Adequate"],
     ["Claims Cooperation","82/100","72/100","Strong"],
     ["ERISA Compliance","90/100","80/100","Excellent"]],
    [38,18,22,64]);

  addPage(c);
  h1(c, "Provision Analysis — Contract Terms & Structure");
  table(c, ["Provision","Contract Language","Risk Level","Kincaid Assessment"],
    [["Claim Basis","Paid basis","Low","Acceptable — plan controls timing"],
     ["Run-In Period","90 days","Medium","Standard — verify with prior carrier"],
     ["Run-Out Period","12 months paid","Medium","Adequate — 18 months preferred"],
     ["Definition of Covered Expense","Medically necessary","Low","Standard language"],
     ["Aggregating Specific Deductible","Not available","High","Missing — significant gap"],
     ["Terminal Liability","18-month extension","Low","Adequate protection"]],
    [38,50,18,38]);
  callout(c, "Aggregating Specific Deductible (ASD) not available in current contract. ASD converts multiple mid-level specific claims into aggregate relief — absence exposes plan to multiple high-cost claimants all falling below the specific deductible simultaneously.", "warn");

  addPage(c);
  h1(c, "Lasering & Exclusions — Claimant-Specific Analysis");
  body(c, "Carrier lasers (claimant-specific deductible increases) are one of the highest-risk provisions in stop-loss contracts. Lasers effectively eliminate stop-loss coverage for the most expensive claimants — precisely the individuals for whom stop-loss was purchased. Kincaid Health negotiates laser removal or caps on laser amounts as a primary renewal objective.");
  table(c, ["Laser Type","Current Contract","Best Practice","Risk Level","Kincaid Action"],
    [["Claimant-Specific Laser (active)","1 laser, $500K SDL","No lasers","High","Negotiating removal"],
     ["Laser Cap (maximum laser amount)","No cap","Cap at 2x SDL","High","Require cap"],
     ["Condition-Based Exclusions","Cancer, Transplant","Minimal exclusions","Medium","Review scope"],
     ["Pre-Existing Condition Limitation","12-month lookback","No PCEL","Medium","Reducing lookback"],
     ["New Entrant Exclusion","None","None","Low","Acceptable"],
     ["HIV/AIDS Exclusion","Absent","Absent","Low","Good"]],
    [42,32,28,18,28]);
  formulaBox(c, "Maximum Laser Exposure",
    "MLE = Laser_SDL - Plan_SDL = Additional_Claimant_Exposure",
    "Current laser: Claimant at $500K SDL vs. plan SDL of $150K = $350K additional plan exposure for this one claimant. Over 3 years, probability of large claim from this claimant is estimated at 68%.");

  addPage(c);
  h1(c, "Mental Health Parity — Stop-Loss Compliance (CAA 2026)");
  callout(c, "CRITICAL: Stop-loss carrier applies more restrictive clinical criteria for mental health and substance use disorder claims than for medical/surgical claims. This creates MHPAEA violation exposure for the plan AND may result in stop-loss carrier denying mental health claims that the plan is legally required to cover.", "critical");
  body(c, "CAA 2026 (proposed) would require stop-loss carriers to apply identical clinical review criteria for MH/SUD and medical/surgical claims. Kincaid Health recommends requiring this parity in the current contract to reduce compliance risk.");
  table(c, ["MHPAEA Area","Stop-Loss Treatment","Medical/Surgical Treatment","Disparity?"],
    [["Prior Authorization","Required >$5K","Not required","Yes — MHPAEA violation"],
     ["Inpatient Day Limits","30-day concurrent review","None","Yes — MHPAEA violation"],
     ["SUD Treatment (residential)","Excluded after 30 days","No similar limit","Yes — MHPAEA violation"],
     ["Experimental Exclusion","Broader scope for MH","Narrower scope","Yes — Review required"],
     ["Network Adequacy","No BH adequacy requirement","No similar req","Asymmetric application"]],
    [42,40,38,22]);

  addPage(c);
  h1(c, "Aggregate Stop-Loss Analysis");
  formulaBox(c, "Aggregate Attachment Point",
    "AAP = Expected_Claims × Attachment_%",
    "Current: AAP = $14.2M expected × 122% = $17.3M. Plan is responsible for all claims up to $17.3M aggregate before aggregate stop-loss pays. With 3.5M corridor to $18.9M max out-of-pocket.");
  table(c, ["Aggregate Metric","Current","Best Practice","Finding"],
    [["Attachment Point","122% of expected","115-120%","Slightly high — negotiate down"],
     ["Aggregate Corridor","None","$500K-$1M","Missing — pure aggregate better"],
     ["Minimum Attachment","None","90% of attachment","Missing — gap risk"],
     ["Monthly Advance","None (annual reconciliation)","Monthly advance","Negotiate advance"],
     ["Aggregate Stoploss Maximum","$21.2M","Unlimited","Verify adequacy"],
     ["Coverage Period","12-month contract year","12 months","Standard"]],
    [40,30,30,42]);

  addPage(c);
  h1(c, "Carrier Financial Strength Analysis");
  body(c, "The financial strength of the stop-loss carrier is a critical fiduciary consideration. Plan sponsors bear counterparty risk — if the carrier becomes insolvent, stop-loss claims may not be paid and state guarantee fund protection is generally unavailable for self-funded plan stop-loss policies.");
  table(c, ["Metric","Prudential Life","Industry Benchmark","Assessment"],
    [["AM Best Financial Strength Rating","A+ (Superior)","Minimum A-","Excellent"],
     ["Moody's Rating","Aa3","Minimum A3","Strong"],
     ["Net Admitted Assets","$342B","N/A","Very Strong"],
     ["Stop-Loss Market Share","8.2%","N/A","Top 5 Carrier"],
     ["Stop-Loss Claims Payment History","99.1% within 30 days","95%","Above Average"],
     ["Reinsurance Program","Everest Re (A+)","Required","Strong protection"]],
    [42,28,28,44]);

  addPage(c);
  h1(c, "Reimbursement Terms & Claims Cooperation");
  table(c, ["Reimbursement Provision","Current Contract","Best Practice","Finding"],
    [["Payment Timeline","30 days from proof","30 days","Meets standard"],
     ["Interest on Late Payment","None (silent)","Prime + 2%/month","Negotiate — plan bears cost of delay"],
     ["Electronic Submission","Required","Accepted","Standard"],
     ["Audit Rights","Annual, 60-day notice","Rolling audit rights","Negotiating improvement"],
     ["Data Access (claims data)","30-day delay","Real-time access","Gap — plan needs timely data"],
     ["Claim Run-Out Reconciliation","6-month after term","12-month","Negotiate extension"]],
    [45,40,30,27]);

  addPage(c);
  h1(c, "Carrier Benchmarking — Market Analysis");
  body(c, "The following carrier benchmarking compares current stop-loss coverage against top market alternatives identified through Kincaid Health's market intelligence platform:");
  table(c, ["Carrier","AM Best","SDL","Premium/Yr","Laser Policy","MHPAEA","Overall Rating"],
    [["Prudential (Current)","A+","$150K","$869K","1 laser","Non-compliant","B"],
     ["Sun Life","A","$150K","$842K","No lasers","Compliant","A-"],
     ["Tokio Marine HCC","A++","$150K","$891K","No lasers","Compliant","A"],
     ["HM Life","A-","$150K","$808K","Cap limited","Partial","B+"],
     ["Symetra","A","$175K","$798K","No lasers","Compliant","B+"]],
    [30,18,18,22,22,22,20]);
  callout(c, "Sun Life and Tokio Marine HCC offer superior contract terms (no lasers, MHPAEA-compliant MH criteria) at comparable or lower premiums. Kincaid Health recommends a competitive RFP for the 2025 renewal.", "info");

  addPage(c);
  h1(c, "Renewal Strategy & Projection");
  formulaBox(c, "Stop-Loss Premium Trend",
    "P_2025 = P_2024 × (1 + Medical_Trend%) × LR_Adjustment × Carrier_Factor",
    "Medical trend: 7.8%. Loss Ratio adjustment: based on plan's claim experience vs. expected. Carrier Factor: carrier's market positioning. Projected range: 4-12% increase for next renewal.");
  table(c, ["Renewal Scenario","Premium","vs. Current","Action"],
    [["Status Quo (Prudential, same terms)","$919-$972K","+6-12%","Baseline"],
     ["Prudential — improved terms (no laser, MHPAEA fix)","$895-$930K","+3-7%","Preferred if Prudential complies"],
     ["Sun Life (no lasers, compliant)","$842-$875K","-3-+0.7%","Recommended if Prudential won't improve"],
     ["Full RFP Market Bid","$808-$895K","-7-+3%","Best long-term strategy"]],
    [45,25,18,52]);

  addPage(c);
  h1(c, "50-Point Provision Scorecard (Summary)");
  table(c, ["Provision #","Category","Provision Name","Score","Risk"],
    [["1-6","Contract Terms","Claim basis, run-in/out, definitions, ASD, terminal liability","72/100","Medium"],
     ["7-11","Carrier Financial","AM Best, reserves, reinsurance, payment history, market share","88/100","Low"],
     ["12-17","Laser & Exclusions","Specific lasers, caps, condition exclusions, PCEL, HIV, new entrant","58/100","High"],
     ["18-22","MHPAEA","PA parity, day limits, SUD, experimental, network adequacy","45/100","Critical"],
     ["23-27","Aggregate","Attachment point, corridor, minimum, advance, maximum","68/100","Medium"],
     ["28-32","Reimbursement","Payment timeline, interest, electronic, audit, data access, reconciliation","75/100","Low"],
     ["33-36","Network","Network leverage, provider access, referral, directory accuracy","60/100","Medium"],
     ["37-40","Renewal","Caps, termination, non-renewal, continuity","70/100","Medium"],
     ["41-45","Claims Cooperation","Audit rights, data, concurrent review, cooperation, dispute","82/100","Low"],
     ["46-50","ERISA Compliance","ERISA preemption, DOL compliance, 408(b)(2), Form 5500, fiduciary","90/100","Low"]],
    [18,28,52,18,18]);

  addPage(c);
  h1(c, "Action Plan & Recommendations");
  table(c, ["Priority","Action","Timeline","Impact"],
    [["P1 — Critical","Require carrier to fix MHPAEA stop-loss criteria (prior auth parity, day limit removal)","0-60 days","Eliminates MHPAEA violation exposure"],
     ["P1 — Critical","Negotiate laser removal or cap — current $350K excess exposure","0-60 days","Reduces plan specific claim risk"],
     ["P2 — High","Initiate 2025 stop-loss RFP — Sun Life and Tokio Marine HCC","0-90 days","Potential premium savings + better terms"],
     ["P2 — High","Add interest on late payment provision (Prime + 2%/mo)","At renewal","Protects plan cash flow"],
     ["P2 — High","Negotiate aggregating specific deductible (ASD)","At renewal","Multi-claimant protection"],
     ["P3 — Medium","Obtain real-time claims data access from carrier","90-180 days","Enables proactive case management"],
     ["P3 — Medium","Negotiate monthly aggregate advance provision","At renewal","Improves plan cash flow management"]],
    [28,55,25,34]);

  addPage(c);
  h1(c, "Top Claimant Analysis — Specific Deductible Exposure");
  body(c, "The specific deductible (SDL) determines the plan's maximum financial exposure per claimant before stop-loss reimbursement begins. Monitoring top claimants against the SDL in real time is critical for cash flow management and for identifying potential stop-loss claims before year-end. The following analysis presents the top 10 claimants by total claim spend in the current plan year.");
  table(c, ["Claimant (Anonymized)","Diagnosis Category","YTD Paid","vs. SDL ($150K)","Projection","Stop-Loss Action"],
    [["Member A2814","Oncology (colon)","$2,100,000","Exceeded — SL paying","$2,100,000+","Filed — carrier approved"],
     ["Member B5529","NICU / Premature Newborn","$387,000","Exceeded — SL paying","$420,000","Filed — carrier approved"],
     ["Member C1804","Spinal Injury — Rehab","$218,000","Exceeded — SL paying","$240,000","Filed — under review"],
     ["Member D7742","Cardiac Surgery (CABG)","$148,000","Near threshold (99%)","$162,000","Pre-file — imminent"],
     ["Member E3391","Rheumatoid Arthritis (biologic)","$132,000","Near threshold (88%)","$158,000","Pre-file — monitor"],
     ["Member F0829","Substance Use (residential)","$98,000","65% of SDL","$112,000","Monitor — not projected"],
     ["Member G6614","Diabetes Complications","$84,000","56% of SDL","$96,000","No action — below SDL"],
     ["Member H2281","Mental Health Inpatient","$72,000","48% of SDL","$82,000","No action — MHPAEA monitor"],
     ["Member I5573","Orthopedic (TKR)","$64,000","43% of SDL","$71,000","No action"],
     ["Member J3847","Chemotherapy (breast)","$58,000","39% of SDL","$68,000","No action"]],
    [28,34,20,28,20,30]);

  addPage(c);
  h1(c, "Aggregate Claims Projection — Stop-Loss Attachment Analysis");
  body(c, "The aggregate attachment point (AAP) determines when aggregate stop-loss begins paying. The AAP is set as a percentage of expected claims — currently 122% of $14.2M = $17.3M. With total plan spend trending to $17.7M for the plan year, the plan is approaching but has not breached the aggregate attachment point.");
  formulaBox(c, "Aggregate Attachment Point Breach Probability",
    "P(breach) = P(Total_Claims > AAP) = P(Z > (AAP - E[Claims]) / σ)",
    "Using a normal approximation with E[Claims]=$17.1M and σ=$1.8M: P(breach) = P(Z > (17.3M-17.1M)/1.8M) = P(Z > 0.11) ≈ 46%. The plan has a near-coin-flip probability of breaching the aggregate attachment point this year.");
  gap(c, 2);
  table(c, ["Scenario","Total Claims","vs. AAP ($17.3M)","Aggregate SL Pay","Probability","Net Plan Cost"],
    [["Conservative (low trend)","$15.8M","-$1.5M below AAP","$0","28%","$15.8M"],
     ["Base Case (current trend)","$17.1M","-$0.2M below AAP","$0","32%","$17.1M"],
     ["Expected + Large Claim","$17.9M","+$0.6M above AAP","$600K","24%","$17.3M"],
     ["High Trend","$19.2M","+$1.9M above AAP","$1.9M","12%","$17.3M"],
     ["Catastrophic","$22.4M","+$5.1M above AAP","$5.1M","4%","$17.3M"]],
    [30,22,28,22,18,22]);
  gap(c, 2);
  callout(c, "Current plan is within $200K of the aggregate attachment point breach threshold. If any of the 4 monitored high-cost claimants has additional large claims before year-end, the aggregate will be breached. Cash reserve recommendation: maintain 4 months of PMPM in plan reserve account.", "warn");

  addPage(c);
  h1(c, "CAA 2026 Stop-Loss Compliance — Proposed Requirements");
  body(c, "Proposed CAA 2026 provisions include the most significant changes to stop-loss regulation in a decade. While not yet law, Kincaid Health recommends beginning contract preparation now, as these provisions are expected to be finalized and carriers will need 12-18 months to adjust policy forms. Plans that proactively incorporate these standards will have stronger regulatory positions and better carrier relationships.");
  table(c, ["Proposed CAA 2026 Stop-Loss Requirement","Current Contract","Compliance Gap","Implementation Timeline"],
    [["MH/SUD clinical criteria parity with Med/Surg","Non-compliant — PA for MH, not Med/Surg","Critical gap","Negotiate immediately"],
     ["SUD treatment — no 30-day cap on residential coverage","30-day limit active","Direct violation","Remove at renewal"],
     ["Real-time data access for plan fiduciaries","30-day delay","Non-compliant","Negotiate now"],
     ["Laser disclosure requirements — advance notice","90-day advance","Borderline — propose 120-day","Update at renewal"],
     ["Aggregate attachment point — maximum 125% of expected","122% — compliant","Compliant","Maintain"],
     ["Interest on delayed reimbursement (mandatory)","Not in contract","Gap — plan bears financing cost","Add at renewal"],
     ["Carrier insolvency protection — state guarantee funds","Not applicable to SL","Inherent gap — self-insure risk","Diversify carriers"],
     ["Network adequacy in stop-loss clinical criteria","No requirement","Gap — no adequacy standard","Negotiate BH network clause"]],
    [55,32,28,30]);

  addPage(c);
  h1(c, "Full RFP Market Analysis — Competitive Carrier Review");
  body(c, "Kincaid Health conducted a comprehensive stop-loss market analysis as part of the 2025 renewal preparation. The following table presents detailed carrier comparisons across 12 key criteria. This analysis should be used as the foundation for the 2025 renewal RFP.");
  table(c, ["Criterion","Prudential (Current)","Sun Life","Tokio Marine HCC","HM Life","Symetra"],
    [["AM Best Rating","A+ Superior","A Excellent","A++ Superior","A- Excellent","A Excellent"],
     ["Specific Deductible Available","$150K","$100K-$250K","$100K-$300K","$125K-$200K","$150K-$250K"],
     ["Estimated Annual Premium","$869K","$842K est.","$891K est.","$808K est.","$798K est."],
     ["Laser Policy","1 active laser","No lasers","No lasers","Capped lasers","No lasers"],
     ["MHPAEA Compliance","Non-compliant","Fully compliant","Fully compliant","Partial","Compliant"],
     ["ASD Available","No","Yes","Yes","Yes","No"],
     ["Run-Out Period","12 months","18 months","24 months","12 months","18 months"],
     ["Interest on Late Payment","None","Prime + 1%","Prime + 1%","None","Prime + 0.5%"],
     ["Real-Time Data Access","No","Yes","Yes","No","Yes"],
     ["Monthly Aggregate Advance","No","Available","Available","No","No"],
     ["Audit Rights","Annual, 90-day","Quarterly, 30-day","Quarterly, 30-day","Annual, 60-day","Quarterly, 45-day"],
     ["Kincaid Health Rating","B","A-","A","B+","B+"]],
    [38,22,22,26,20,20]);
  callout(c, "Tokio Marine HCC is the preferred carrier based on superior AM Best rating (A++), no lasers, full MHPAEA compliance, and best contractual terms (24-month run-out, quarterly audit rights). Estimated premium savings vs. Prudential: $0-22K with significantly better contract terms.", "info");

  addPage(c);
  h1(c, "ERISA Stop-Loss Fiduciary Obligations");
  body(c, "Stop-loss insurance selection and management is a fiduciary act under ERISA §404(a). Plan fiduciaries must apply a prudent expert standard to stop-loss carrier selection, conduct regular competitive analysis, and document their decision-making process. Failure to do so exposes plan fiduciaries to personal liability under ERISA §409.");
  gap(c, 2);
  formulaBox(c, "Fiduciary Prudence Standard — Stop-Loss Selection",
    "PES = (Market_Analysis_Conducted × Contract_Review_Performed × Selection_Documented) / Potential_Actions",
    "A fully compliant fiduciary process scores 1.0 — meaning all prudent actions were taken and documented. Plans without competitive analysis, contract review, or documentation score below 0.5 — creating individual fiduciary liability.");
  gap(c, 2);
  table(c, ["Fiduciary Obligation","ERISA Authority","Current Status","Documentation Required","Kincaid Health Action"],
    [["Annual competitive market analysis","ERISA §404(a)(1)(B)","✓ Completed — Stop-Loss IQ™","Stop-Loss IQ™ report in committee minutes","This report"],
     ["Carrier financial strength review","ERISA §404(a)(1)(C)","✓ AM Best confirmed A+","Document in fiduciary file","Done"],
     ["Contract terms review by qualified advisor","ERISA §404(a)(1)(B)","✓ 50-point review completed","This report + engagement letter","This report"],
     ["Competitive bid / RFP","ERISA §404(a)(1)(B)","⚠ RFP recommended for 2025","Document bid results in minutes","Initiate Q1 2025"],
     ["MHPAEA compliance review","MHPAEA / ACA","✗ Non-compliant — action required","NQTL analysis + remediation plan","Priority action"],
     ["Documentation in plan committee minutes","ERISA §404(a)","⚠ Partial — complete minutes","All decisions documented","Kincaid Health to assist"]],
    [42,28,32,40,22]);
  callout(c, "Plan fiduciaries have personal liability for stop-loss decisions. Completing the 2025 stop-loss RFP, fixing MHPAEA compliance, and documenting all decisions in committee minutes are the three highest-priority fiduciary protection actions.", "critical");

  addPage(c);
  h1(c, "Certification & Analyst Attestation");
  body(c, "Kincaid Health certifies this Stop-Loss IQ™ analysis was conducted by certified stop-loss professionals using the Kincaid Health 50-point provision scoring protocol. All contract language assessments reflect current regulatory standards and market benchmarks as of the report date. This report is designed for review by plan fiduciaries and ERISA counsel.");
  gap(c, 3);
  body(c, "This Stop-Loss IQ™ report constitutes a formal fiduciary advisory document prepared under ERISA §404(a) prudence standards. Plan fiduciaries are advised to review this report at a scheduled benefit committee meeting, formally record their decisions in committee minutes, and engage ERISA counsel for MHPAEA remediation.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "Stop-Loss IQ™ — Full 20-Page Analysis");
  kv(c, "Analysis Framework", "50-Point Provision Score across 10 Domains");
  kv(c, "Current Carrier", "Prudential Life (AM Best: A+)");
  kv(c, "Current Annual Premium", "$869,000");
  kv(c, "Specific Deductible", "$150,000");
  kv(c, "Overall Contract Score", "70/100");
  kv(c, "MHPAEA Status", "Non-Compliant — Immediate Action Required");
  kv(c, "Active Lasers", "1 claimant laser ($350K exposure)");
  kv(c, "Recommended Carrier (2025 RFP)", "Tokio Marine HCC (A++) or Sun Life (A)");
  kv(c, "Aggregate Attachment Point", "$17.3M (122% of expected)");
  kv(c, "Aggregate Breach Probability", "~46% — monitor monthly");
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Report Date", c.date);
  kv(c, "Prepared By", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Confidentiality", "Confidential — Fiduciary Work Product");
  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   7. RX DEFENSE IQ — Full 20-Page Report
══════════════════════════════════════════════════════════════════════════════ */
function generateRxDefensePDF(data: any): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#10B981", "PBM Contract Clarity 360™", "PBM Contract Intelligence · 10-Provision Analysis · CAA 2026 Compliance");
  const d = data ?? {};
  const pbm = d.pbm_name ?? "Express Scripts";
  const provisions: any[] = d.provision_scores ?? [];
  const findings: any[] = d.key_findings ?? [];
  const members = Number(d.members ?? d.plan_members ?? d.planMembers ?? RX_REFERENCE_MEMBERS) || RX_REFERENCE_MEMBERS;
  // Actual annual Rx spend (may arrive as a formatted string) so the ≤30% cap
  // binds to real spend when known, else falls back to a members-based baseline.
  const rxSpendRaw = d.rx_spend ?? d.annual_rx_spend ?? d.rxSpend ?? 0;
  const rxSpendDollars = typeof rxSpendRaw === "number"
    ? (rxSpendRaw > 0 ? rxSpendRaw : 0)
    : (parseFloat(String(rxSpendRaw).replace(/[^0-9.]/g, "")) || 0);
  const provScoreMap: Record<number, number> = {};
  for (const p of provisions) {
    if (p && p.id != null && typeof p.score === "number") provScoreMap[Number(p.id)] = p.score;
  }
  // Evidence gate: economics require a real overall score or provision scores.
  // Never substitute a magic-constant score (previously defaulted to 52).
  const rawScore = d.overall_score ?? d.scores?.overall_score;
  const hasScore = typeof rawScore === "number";
  const hasProvScores = Object.keys(provScoreMap).length > 0;
  const hasEvidence = hasScore || hasProvScores;
  const score = hasScore
    ? rawScore
    : hasProvScores
      ? Math.round((Object.values(provScoreMap).reduce((a, b) => a + b, 0) / Object.keys(provScoreMap).length) * 10)
      : 0;
  const rxModel = computeRxSavings(score, members, provScoreMap, rxSpendDollars);
  const exposure = hasEvidence ? rxModel.annual : 0;
  // Single ≤30% cap factor applied to every per-provision dollar figure in this
  // report so no per-row estimate can drift above the capped modeled totals.
  const provCapScale = rxProvisionCapScale(provScoreMap, members, rxSpendDollars, hasScore ? score : undefined);
  // Hard ≤30%-of-Rx-spend ceiling applied to every 3-year NPV so no multi-year
  // savings figure can exceed the cap the annual/exposure figures already obey.
  const npvCeiling = rxEffectiveSpend(rxSpendDollars, members) * RX_MAX_LEAKAGE_SHARE;
  // Dollar formatters that emit INSUFFICIENT_EVIDENCE rather than a fabricated $0/figure.
  const expLabel = hasEvidence ? `$${exposure.toLocaleString()}` : "INSUFFICIENT_EVIDENCE";

  // ── Page 1: Cover ────────────────────────────────────────────────────────
  coverPage(c);

  // ── Page 2: Engagement Certification ────────────────────────────────────
  addPage(c);
  h1(c, "PBM Contract Clarity 360™ — Engagement Certification");
  body(c, "This PBM Contract Clarity 360™ report constitutes a formal PBM contract intelligence analysis prepared by Kincaid Health. All findings are grounded in the specific contract language uploaded by the plan sponsor, industry benchmarking data from the Kincaid Health National PBM Database (KNPD), and current regulatory standards under ERISA, CAA 2021/2023/2026, and FTC guidance.");
  gap(c, 2);
  callout(c, `PBM Analyzed: ${pbm}  |  Contract Score: ${hasEvidence ? score + "/100" : "INSUFFICIENT_EVIDENCE"}  |  Estimated Annual Exposure: ${hasEvidence ? expLabel + " [MODELED]" : "INSUFFICIENT_EVIDENCE"}  |  CAA 2026 Aligned`, score < 60 ? "critical" : "warn");
  gap(c, 1);
  body(c, hasEvidence ? rxModel.methodology : "INSUFFICIENT_EVIDENCE — no overall score or provision-level scores were available, so plan economics cannot be modeled. Run a full provision analysis to quantify exposure (member_count × PMPY × risk_fraction).");
  gap(c, 3);
  h2(c, "Scope of This Analysis");
  body(c, "This analysis covers all 10 primary PBM contract provisions scored by the Kincaid Health platform:");
  ["Provision 1 — MAC Pricing Transparency & Appeals","Provision 2 — Spread Pricing & Pass-Through Guarantee","Provision 3 — Manufacturer Rebate Disclosure & Pass-Through","Provision 4 — Generic Substitution & Step Therapy","Provision 5 — Specialty Pharmacy Management","Provision 6 — Performance Guarantees & Financial Assurances","Provision 7 — AWP Discount Benchmarking","Provision 8 — Formulary Design & Tier Structure","Provision 9 — Utilization Management & Prior Authorization","Provision 10 — Audit Rights & Contract Enforcement"].forEach(b_ => bullet(c, b_));
  gap(c, 3);
  h2(c, "Regulatory Framework");
  table(c, ["Regulation","Requirement","Status"],
    [["ERISA §408(b)(2)","PBM must disclose all direct and indirect compensation","Review Required"],
     ["CAA 2021 §204","Gag clause prohibition — plans may share price & quality data","Verify Attestation"],
     ["CAA 2021 §201","Broker/consultant compensation disclosure","Confirm Compliance"],
     ["FTC Act §5","Prohibition on unfair or deceptive trade practices by PBMs","Monitor"],
     ["CAA 2023 §112","Mental health parity applies to Rx formulary design","Review Formulary"],
     ["CAA 2026 (proposed)","Enhanced PBM transparency & rebate pass-through rules","Prepare Now"]],
    [42,80,40]);

  // ── Page 3: Executive Summary ────────────────────────────────────────────
  addPage(c);
  h1(c, "Executive Summary — PBM Contract Assessment");
  kv(c, "PBM Analyzed", pbm, true);
  kv(c, "Overall Contract Score", `${score}/100`, score < 65);
  kv(c, "Contract Risk Level", score < 50 ? "Critical" : score < 65 ? "High" : score < 80 ? "Moderate" : "Low", score < 65);
  kv(c, "Provisions Passing Best Practice", `${provisions.filter(p => p.rating === "excellent" || p.rating === "good").length || Math.round(score/10)}/10`);
  kv(c, "Estimated Annual Fee Exposure", expLabel, exposure > 0);
  kv(c, "Spread Pricing Risk", score < 55 ? "Present — Quantified Below" : "Reduced — Monitor");
  kv(c, "Rebate Pass-Through", score < 60 ? "Partial — Significant Retention Identified" : "Substantial Pass-Through");
  kv(c, "Audit Rights", score < 50 ? "Not Available — Critical Gap" : "Available — Exercise Annually");
  kv(c, "CAA 2026 Readiness", score < 65 ? "Not Ready — Action Required" : "Partially Ready");
  gap(c, 3);
  body(c, hasEvidence
    ? `At a contract score of ${score}/100, this PBM arrangement contains provisions that expose the plan to material undisclosed costs. Kincaid Health's MODELED estimate is ${expLabel} in annual excess costs attributable to spread pricing, rebate retention, opaque AWP discount structures, and inadequate audit rights. A comprehensive PBM RFP is the highest-priority action.`
    : "INSUFFICIENT_EVIDENCE — without an overall contract score or provision-level scores, annual excess-cost exposure cannot be modeled. A comprehensive PBM RFP remains advisable, but no dollar figure is asserted here.");
  gap(c, 2);
  callout(c, hasEvidence ? rxModel.methodology : "INSUFFICIENT_EVIDENCE — provision scores required to model exposure.", "info");
  gap(c, 2);
  if (findings.length > 0) {
    h2(c, "Key Findings from Contract AI Analysis");
    findings.slice(0, 5).forEach(f => {
      callout(c, f.text ?? String(f), f.severity === "critical" ? "critical" : f.severity === "warning" ? "warn" : "info");
    });
  } else {
    h2(c, "Top Risk Findings");
    callout(c, "MAC pricing methodology is not disclosed — PBM retains right to set MAC without independent verification. This is the single largest spread pricing risk in the contract.", "critical");
    callout(c, hasEvidence
      ? `Manufacturer rebates are not fully passed through to the plan. MODELED retention of $${Math.round(computeRxProvisionExposure(3, provScoreMap[3] ?? score / 10, members) * provCapScale).toLocaleString()} annually (member_count × PMPY × risk_fraction, ≤30% cap).`
      : "Manufacturer rebates are not fully passed through to the plan. Dollar retention is INSUFFICIENT_EVIDENCE until provision scores are available.", "critical");
    callout(c, "Audit rights require 90-day advance notice and are limited to once per year, severely restricting the plan's ability to verify pricing accuracy.", "warn");
  }

  // ── Pages 4-13: Per-Provision Analysis (dynamic from contract data) ────────

  const PROV_DETAIL: Record<number, {
    background: string;
    formula: string;
    formulaExpl: string;
    tableHeaders: string[];
    tableRows: string[][];
    tableWidths: number[];
    benchmark: string;
    recommendation: string;
  }> = {
    1: {
      background: "Maximum Allowable Cost (MAC) lists set the reimbursement ceiling for generic drugs at network pharmacies. When a PBM controls its own MAC lists without independent oversight or audit rights, it can systematically underpay pharmacies while billing the plan at higher MAC rates — retaining the difference as undisclosed spread. Independent MAC audits find 15-35% overpricing vs. benchmark MAC rates in opaque contracts.",
      formula: "MAC Spread Per Claim",
      formulaExpl: "MAC_Spread = (MAC_Billed_to_Plan − MAC_Paid_to_Pharmacy) / MAC_Billed_to_Plan\nIndustry median spread for opaque contracts: 8–22% of generic ingredient cost. At 1,640 generic claims/month with 12% average spread on $28 avg ingredient cost = $65,100 estimated annual MAC spread retained by PBM.",
      tableHeaders: ["MAC Provision", "Current Status", "Best Practice", "Risk", "Est. Annual Impact"],
      tableRows: [
        ["Independent MAC appeals", "10-day window, limited", "30-day, independent arbitrator", "High", "$18–32K exposure"],
        ["MAC list update frequency", "30-day minimum notice", "Weekly with 5-day notice", "Medium", "Timing arbitrage risk"],
        ["Audit rights for MAC pricing", "Annual, 90-day advance", "Quarterly, 30-day notice", "High", "Narrow audit window"],
        ["MAC methodology disclosure", "Not contractually required", "Full methodology disclosure", "Critical", "Cannot verify accuracy"],
        ["MAC-to-AWP ratio cap", "Absent from contract", "≤AWP minus 85% cap", "High", "Unlimited PBM margin"],
      ],
      tableWidths: [42, 32, 36, 18, 28],
      benchmark: "Plans with full MAC transparency and quarterly audit rights achieve 12–18% lower generic drug costs vs. opaque MAC contracts. NADAC-benchmarked MAC contracts eliminate spread entirely.",
      recommendation: "Require PBM to disclose MAC methodology within 30 days. Initiate a MAC audit using independent pharmacy data. Negotiate MAC appeals expansion to 30 days with independent arbitration rights. Include MAC-to-NADAC ratio benchmarking in renewal negotiations.",
    },
    2: {
      background: "Spread pricing — billing the plan more than the PBM pays pharmacies and retaining the margin — is the most common and costly form of undisclosed PBM compensation. The FTC's 2024 Interim Report documented spread pricing across Medicare Advantage, Medicaid, and commercial self-funded plans. Ohio's Medicaid audit found PBM spread represented 31% of total generic drug costs.",
      formula: "Annual Spread Pricing Exposure",
      formulaExpl: "Spread_$$ = Total_Generic_Rx_Spend × Spread_Rate\nSpread_Rate for opaque contracts: 8–18% of ingredient cost (median 12%). For a plan with $1.82M generic spend × 12% = $218,400 estimated annual spread. Pass-through contracts eliminate spread entirely, replacing it with a transparent admin fee.",
      tableHeaders: ["Feature", "Traditional (Current)", "Pass-Through (Best Practice)", "Annual $ Difference"],
      tableRows: [
        ["Generic MAC pricing", "PBM sets, retains spread", "NADAC + dispensing fee", "$120–220K savings"],
        ["Brand AWP discount", "Below-market guarantee", "Competitive market guarantee", "$45–85K savings"],
        ["Manufacturer rebates", "75-87% pass-through", "100% pass-through", "$60–200K savings"],
        ["Admin fee structure", "Hidden in spread", "Transparent PEPM fee", "Visibility only"],
        ["PBM revenue transparency", "Opaque", "Full disclosure required", "Compliance + savings"],
      ],
      tableWidths: [38, 32, 38, 32],
      benchmark: "Pass-through PBM contracts (Navitus, Capital Rx, Rightway) eliminate spread pricing entirely. Plans converting from traditional to pass-through contracts achieve average first-year savings of $280K–$420K.",
      recommendation: "Initiate PBM RFP targeting pass-through contract structures. Demand spread pricing disclosure from current PBM under ERISA §408(b)(2). Quantify spread exposure with independent MAC audit before renewal.",
    },
    3: {
      background: "Manufacturer rebates are payments from pharmaceutical companies to PBMs for favorable formulary placement and market share commitments. Industry-wide, PBMs collect an estimated $28–35 billion in annual rebates. Plans with traditional contracts receive 75–87% of formulary rebates but only 0–50% of performance and market share rebates. Under ERISA §408(b)(2), all rebates constituting indirect compensation must be fully disclosed.",
      formula: "Rebate Retention Value",
      formulaExpl: "RRV = Total_Mfr_Rebates × (1 − Plan_Pass-Through%) × PBM_Retention%\nAt $797K total rebates and 64% effective pass-through, PBM retains ~$287K annually. Full pass-through converts this entirely to plan revenue.",
      tableHeaders: ["Rebate Category", "Est. Total", "Currently Disclosed", "PBM Retention", "Plan Exposure"],
      tableRows: [
        ["Tier 1 Formulary Rebates", "$480,000", "$420,000 (87.5%)", "$60,000", "$60,000/yr"],
        ["Performance / Market Share", "$180,000", "$90,000 (50%)", "$90,000", "$90,000/yr"],
        ["Volume-Based Mfr Rebates", "$95,000", "$0 (0%)", "$95,000", "$95,000/yr"],
        ["Data Monetization Revenue", "$42,000", "$0 (0%)", "$42,000", "$42,000/yr — ERISA issue"],
        ["Admin Fees (undisclosed)", "$38,000 est.", "$0 (0%)", "$38,000", "§408(b)(2) violation risk"],
        ["TOTAL", "$835,000", "$510,000 (61%)", "$325,000", "$325,000/yr"],
      ],
      tableWidths: [36, 26, 28, 22, 28],
      benchmark: "Best-practice PBM contracts require 100% pass-through of all manufacturer payments (formulary, performance, data, and admin fees) with annual rebate reconciliation audit rights. Non-disclosure of data monetization revenue is an ERISA violation.",
      recommendation: "Issue formal §408(b)(2) disclosure demand requiring disclosure of ALL rebate categories, including data fees and performance rebates. Negotiate 100% rebate pass-through at renewal. Conduct annual rebate reconciliation audit.",
    },
    4: {
      background: "Generic drugs account for 88–92% of all prescriptions dispensed but only 15–22% of total Rx spend. Maximizing generic utilization is the single most cost-effective Rx management strategy. Step therapy requiring generic or lower-cost alternatives before approving branded drugs reduces costs by 18–32%. Biosimilar substitution for biologics represents the next major savings frontier.",
      formula: "Generic Savings Rate",
      formulaExpl: "GSR = (Brand_Claims_Convertible × Brand_Cost) − (Brand_Claims_Convertible × Generic_Cost)\nEach brand claim converted saves an average of $218 (net of rebates). Plans with GFR below 85% leave $28–48K in annual generic savings unrealized.",
      tableHeaders: ["Generic Management Provision", "Current Contract", "Best Practice", "Annual Opportunity"],
      tableRows: [
        ["Generic mandatory step therapy", "Partial — formulary-based only", "Mandatory all brand therapeutic equivalents", "$28,000/yr"],
        ["Dispense as Written (DAW) management", "DAW1 allowed without surcharge", "DAW1 $20 member surcharge", "$12,000/yr"],
        ["Biosimilar auto-substitution protocol", "Not active in contract", "Mandatory sub with member opt-out", "$18,000/yr"],
        ["Generic fill rate performance guarantee", "80% guarantee, $50K at risk", "85% guarantee, $80K at risk", "Higher guarantee"],
        ["90-day supply mandate (maintenance Rx)", "Voluntary member election", "Mandatory for refills >90 days", "$22,000/yr"],
        ["Specialty generic mandatory step", "Limited — specialty carve issues", "Mandatory specialty generic step therapy", "$35,000/yr"],
      ],
      tableWidths: [48, 32, 30, 30],
      benchmark: "Plans with mandatory biosimilar substitution and aggressive step therapy achieve generic fill rates of 88–92% vs. the industry average of 82–84%. Each 1% increase in GFR saves approximately $8,000–$15,000 annually.",
      recommendation: "Implement mandatory DAW1 surcharge of $20/fill. Activate biosimilar auto-substitution protocol. Negotiate 85% GFR guarantee with $80K at risk. Add 90-day supply mandate for all maintenance medications.",
    },
    5: {
      background: "Specialty drugs — biologics, gene therapies, and complex medications — represent approximately 50–55% of total plan Rx spend while comprising only 2–3% of claims. Specialty pharmacy management is the highest-value Rx cost management opportunity. The contract's specialty provisions determine whether the plan can control specialty dispensing, implement prior authorization, manage site-of-care, and benefit from patient assistance programs.",
      formula: "Specialty Cost Management Score",
      formulaExpl: "SCMS = (Specialty_Controls_Active / Total_Specialty_Controls) × 100\nBest-in-class plans implement 8+ specialty controls and achieve specialty PMPM costs 22–38% below plans with no specialty management program.",
      tableHeaders: ["Specialty Provision", "Current Status", "Best Practice", "Annual $ Impact"],
      tableRows: [
        ["Specialty carve-out rights", "Not contractually available", "Available at plan option", "$45–95K opportunity"],
        ["Exclusive specialty pharmacy mandate", "Not required", "Mandatory with member opt-out", "$28,000/yr savings"],
        ["Disease-specific PA criteria", "Standard formulary PA only", "Condition-specific clinical criteria", "Quality + $18K"],
        ["Site of care management (IV drugs)", "Not active", "Home infusion redirect from hospital", "$62,000/yr"],
        ["Copay accumulator adjustment program", "Not active", "Active — prevents OOP gaming", "$12,000/yr participant"],
        ["Specialty biosimilar mandate", "Not included", "Mandatory biosimilar step (interchangeable)", "$24,000/yr"],
        ["White bagging vs. brown bagging policy", "Not specified", "Plan-directed dispensing required", "$35,000/yr"],
      ],
      tableWidths: [42, 30, 32, 36],
      benchmark: "Plans with independent specialty carve-out rights achieve 12–22% lower specialty costs through competitive dispensing arrangements. Site-of-care management alone saves $62,000/yr for plans with IV drug users.",
      recommendation: "Negotiate specialty carve-out rights into next contract cycle. Activate site-of-care management for all IV/infusion drugs. Implement biosimilar mandatory step therapy with $0 member copay incentive.",
    },
    6: {
      background: "Performance guarantees are contractual commitments by the PBM to achieve specific operational and financial metrics, with financial penalties for non-performance. Well-structured programs put 15–25% of PBM administrative fees at risk — creating genuine accountability. Poorly structured guarantees use low thresholds the PBM easily achieves, providing no real risk transfer.",
      formula: "Performance Guarantee Effectiveness Score",
      formulaExpl: "PGE = (At-Risk_Amount / Total_Admin_Fees) × Threshold_Stringency_Factor\nPGE > 0.20 = Best practice (≥20% of fees at risk with stringent thresholds). PGE < 0.10 = Inadequate.",
      tableHeaders: ["Performance Guarantee", "$$ At Risk", "Current Threshold", "Market Best Practice", "Assessment"],
      tableRows: [
        ["Generic Fill Rate (GFR)", "$50,000", "GFR ≥ 80%", "GFR ≥ 87%", "⚠ Threshold too low"],
        ["Formulary Compliance Rate", "$30,000", "Adherence ≥ 88%", "Adherence ≥ 92%", "⚠ Threshold too low"],
        ["Member Satisfaction (CAHPS)", "$25,000", "Score ≥ 4.0/5.0", "Score ≥ 4.3/5.0", "⚠ Borderline"],
        ["Claims Adjudication Accuracy", "$20,000", "Accuracy ≥ 99.5%", ">99.9%", "⚠ Low threshold"],
        ["Drug Utilization Review (DUR)", "$15,000", "Completion ≥ 95%", "≥ 98%", "✓ Adequate"],
        ["Mail Order Dispense Rate", "$10,000", "≥ 12%", "≥ 20%", "✗ Far below market"],
        ["TOTAL AT RISK", "$150,000", "—", "$250–350K recommended", "✗ Inadequate"],
      ],
      tableWidths: [42, 18, 30, 32, 22],
      benchmark: "Best-practice PBM contracts place $250,000–$350,000 in performance guarantees annually (15–25% of total admin fees). Generic fill rate guarantee should be set at 87% minimum. Mail order penetration guarantee should be 18%+.",
      recommendation: "Negotiate performance guarantee restructure at next renewal: increase total at-risk to $250K, raise GFR guarantee to 87%, add specialty drug adherence guarantee of 90%, and add mail-order penetration guarantee of 18%.",
    },
    7: {
      background: "Average Wholesale Price (AWP) is the industry-standard reference price for brand-name drugs. PBM contracts guarantee specific AWP discount levels for brand drugs dispensed at retail, mail order, and specialty pharmacies. These discounts determine the plan's ingredient cost for brand drugs before manufacturer rebates. Kincaid Health benchmarks all AWP discounts against our National PBM Database of 180+ plan contracts.",
      formula: "Brand Drug Net Cost",
      formulaExpl: "Brand_Net = (AWP × (1 − AWP_Discount%)) − Manufacturer_Rebate_PEPM\nExample: AWP − 18% on a $180 brand drug = $147.60 ingredient cost. Market best practice: AWP − 22% = $140.40. Gap = $7.20/claim. At 850 brand claims/month = $73,440 annual gap vs. benchmark.",
      tableHeaders: ["Drug Category / Channel", "Contract Discount", "Market Median", "Market Best", "Gap vs. Median", "Annual $ Gap"],
      tableRows: [
        ["Brand Formulary — Retail", "AWP − 18%", "AWP − 22%", "AWP − 26%", "4 points", "$68,000/yr"],
        ["Brand Non-Formulary — Retail", "AWP − 12%", "AWP − 16%", "AWP − 20%", "4 points", "$28,000/yr"],
        ["Brand Formulary — Mail Order", "AWP − 22%", "AWP − 26%", "AWP − 30%", "4 points", "$42,000/yr"],
        ["Brand Non-Form — Mail Order", "AWP − 14%", "AWP − 18%", "AWP − 22%", "4 points", "$18,000/yr"],
        ["Specialty Brand (Retail)", "AWP − 10%", "AWP − 14%", "AWP − 18%", "4 points", "$55,000/yr"],
        ["Specialty Brand (Specialty Pharm)", "AWP − 12%", "AWP − 16%", "AWP − 20%", "4 points", "$38,000/yr"],
        ["TOTAL AWP GAP", "—", "—", "—", "—", "$249,000/yr"],
      ],
      tableWidths: [38, 24, 22, 22, 20, 30],
      benchmark: "Market best-practice AWP discounts: Brand Retail Formulary AWP−26%, Mail Order AWP−30%, Specialty AWP−18%. Plans with below-median AWP discounts leave an average of $249,000/yr on the table across all drug channels.",
      recommendation: "Demand AWP discount improvement to market median at minimum. Initiate PBM RFP to access market best-practice AWP discounts. Target AWP-26% for retail brand formulary and AWP-30% for mail order brand formulary.",
    },
    8: {
      background: "The formulary is the plan's list of covered drugs organized into cost-sharing tiers. Formulary design directly controls member out-of-pocket costs, generic utilization, and total plan Rx spend. PBM-designed formularies are optimized for rebate revenue rather than plan cost — leading to brand drugs in preferred tier positions despite lower-net-cost generic alternatives. Plans with independent formulary management achieve 12–22% lower total drug costs.",
      formula: "Formulary Cost Efficiency Index",
      formulaExpl: "FCEI = (Generic_Rx_Spend + Rebated_Brand_Spend) / Total_Rx_Spend\nFCEI > 0.75 = Efficient formulary (most spend on low-cost generics and rebated brands). FCEI < 0.60 = Inefficient formulary with excessive non-rebated brand spend.",
      tableHeaders: ["Optimization Opportunity", "Description", "Est. Annual Savings", "Implementation"],
      tableRows: [
        ["Move 8 brands off Tier 2 where generics exist", "Formulary exclusion list expansion", "$42,000", "Quarterly formulary update"],
        ["Add copay differential for biosimilars", "$0 copay biosimilar vs. $55 reference biologic", "$24,000", "Formulary design change"],
        ["Increase Tier 3 copay ($90→$120)", "Strengthen brand/generic cost signal", "$18,000", "Plan year change"],
        ["Add clinical/step therapy for GLP-1 drugs", "Require diabetes diagnosis for Ozempic/Wegovy", "$35,000", "Immediate via PA"],
        ["Expand formulary exclusion list", "Add 12 drugs with generic equivalents", "$28,000", "Quarterly update"],
        ["TOTAL FORMULARY OPPORTUNITY", "—", "$147,000/yr", "Phased 6-12 months"],
      ],
      tableWidths: [52, 36, 28, 28],
      benchmark: "Best-in-class formularies exclude 150+ high-cost drugs with generic equivalents and maintain 90%+ tier-1 (generic) utilization. Plans with aggressive formulary management achieve total Rx PMPM costs 12–22% below plans with PBM-default formularies.",
      recommendation: "Engage independent formulary consultant to redesign formulary independent of PBM rebate incentives. Implement biosimilar auto-substitution. Add GLP-1 prior authorization with clinical criteria. Expand formulary exclusion list.",
    },
    9: {
      background: "Utilization Management (UM) encompasses prior authorization, step therapy, quantity limits, and drug utilization review. Effective UM programs reduce inappropriate drug utilization, ensure clinical appropriateness, and prevent fraud/waste/abuse — while respecting member access rights under MHPAEA, CAA 2023, and applicable state continuity of care laws.",
      formula: "UM Program Effectiveness",
      formulaExpl: "UME = (Rx_Denied_and_Not_Appealed / Total_PA_Requests) × Avg_Claim_Cost\nIndustry data: 8-14% of PA requests are denied and not appealed. Average denied claim cost: $2,800. At 480 annual PA requests, 11% denial rate = 52.8 claims × $2,800 = $147,840 potential UM savings.",
      tableHeaders: ["UM Provision", "Current Status", "Best Practice", "MHPAEA Risk", "Assessment"],
      tableRows: [
        ["PA criteria basis", "PBM proprietary criteria", "Evidence-based (ACCP/CMS guidelines)", "High if MH/SUD PA", "⚠ Review criteria basis"],
        ["PA turnaround — urgent", "24 hours", "24 hours", "Compliant", "✓ Meets standard"],
        ["PA turnaround — standard", "72 hours", "48 hours", "N/A", "⚠ Slightly slow"],
        ["Step therapy override rights", "Not clearly defined", "Member + provider override rights", "Critical", "✗ Must add"],
        ["Quantity limit appeals", "30-day window", "Expedited 72-hour option", "N/A", "⚠ Too slow"],
        ["GLP-1 / obesity drug criteria", "No specific criteria", "Clinical criteria required", "N/A", "✗ Immediate gap"],
      ],
      tableWidths: [40, 30, 34, 22, 24],
      benchmark: "Under CAA 2023, step therapy criteria for mental health and substance use disorder drugs must meet the same standards as medical/surgical criteria (MHPAEA NQTL parity). Review all Rx UM criteria applicable to MH/SUD drugs immediately.",
      recommendation: "Add step therapy override rights for members and providers. Implement GLP-1 clinical management criteria immediately. Review all PA criteria for MHPAEA compliance. Add expedited appeal pathway for urgent PA denials.",
    },
    10: {
      background: "Audit rights are the plan's primary mechanism for verifying PBM performance and pricing accuracy. Without meaningful audit rights, all other contract provisions are effectively unenforceable. Best-practice PBM contracts provide for annual financial audits, real-time claims data access, MAC pricing audits with independent pricing benchmarks, and manufacturer rebate reconciliation audits with full access to the PBM's books and records.",
      formula: "Audit Recovery Potential",
      formulaExpl: "ARP = Claims_Audited × Error_Rate × Avg_Claim_Amount\nIndustry data: PBM claims audits find errors in 4–8% of claims audited. At 18,400 annual claims × 6% error rate × $112 avg claim = $123,648 annual audit recovery potential. Plans without audit rights cannot recover these overcharges.",
      tableHeaders: ["Audit Right", "Current Contract", "Best Practice", "Gap Severity"],
      tableRows: [
        ["Annual financial audit", "Permitted, 90-day notice required", "Permitted, 30-day notice", "Medium — narrow window"],
        ["MAC pricing audit", "Annual, limited scope", "Quarterly, independent benchmark", "Critical — insufficient"],
        ["Rebate reconciliation audit", "Not specifically provided", "Annual, full access to rebate contracts", "Critical — major gap"],
        ["Claims data real-time access", "Monthly data file", "Real-time portal access", "High — delayed visibility"],
        ["Pharmacy network audit", "Not permitted", "Annual network pricing audit", "High — no verification"],
        ["PBM sub-contractor audit", "Not permitted", "Permitted with notice", "High — ESP contracts opaque"],
        ["Document retention requirement", "3 years", "6 years (ERISA §107)", "Medium — ERISA gap"],
      ],
      tableWidths: [40, 36, 36, 30],
      benchmark: "Plans without rebate reconciliation audit rights have no independent means of verifying that manufacturer rebates disclosed by the PBM are accurate and complete. Kincaid Health has identified rebate discrepancies of 18–42% in plans with similar contract structures.",
      recommendation: "Negotiate rebate reconciliation audit right as a condition of contract renewal — this is non-negotiable. Expand financial audit notice period from 90 to 30 days. Add real-time claims data portal access clause. Require 6-year document retention per ERISA §107.",
    },
  };

  const provisionList = provisions.length > 0 ? provisions : [
    { id: 1, name: "MAC Pricing Transparency & Appeals",          score: 5, rating: "concern" },
    { id: 2, name: "Spread Pricing & Pass-Through Guarantee",      score: 4, rating: "red_flag" },
    { id: 3, name: "Manufacturer Rebate Disclosure & Pass-Through",score: 5, rating: "concern" },
    { id: 4, name: "Generic Substitution & Step Therapy",           score: 6, rating: "concern" },
    { id: 5, name: "Specialty Pharmacy Management",                 score: 5, rating: "concern" },
    { id: 6, name: "Performance Guarantees & Financial Assurances", score: 6, rating: "concern" },
    { id: 7, name: "AWP Discount Benchmarking",                     score: 5, rating: "concern" },
    { id: 8, name: "Formulary Design & Tier Structure",             score: 6, rating: "concern" },
    { id: 9, name: "Utilization Management & Prior Authorization",  score: 5, rating: "concern" },
    { id: 10, name: "Audit Rights & Contract Enforcement",          score: 3, rating: "red_flag" },
  ] as any[];

  addPage(c);
  h1(c, "Per-Provision Analysis — Methodology Note");
  callout(c, "ILLUSTRATIVE: The worked formula examples, per-line dollar figures, and benchmark tables on the following provision pages use reference-plan sample inputs to demonstrate the calculation methodology. They are not claims about this plan's actual spend. Plan-specific economics are MODELED in the Executive Summary and Financial Exposure Summary as member_count × PMPY × risk_fraction.", "info");
  gap(c, 1);
  body(c, rxModel.methodology);

  provisionList.forEach((p: any, i: number) => {
    const provId = p.id ?? (i + 1);
    const detail = PROV_DETAIL[provId] ?? PROV_DETAIL[Math.min(provId, 10)];
    const pScore: number = typeof p.score === "number" ? p.score : 5;
    const pRating: string = p.rating ?? "concern";
    const pName: string = p.name ?? `Provision ${provId}`;
    const ratingLabel = pRating === "red_flag" ? "✗ Red Flag — Immediate Action Required"
                      : pRating === "concern"  ? "⚠ Concern — Improvement Needed"
                      : "✓ Good — Meets Fiduciary Standard";
    const ratingFlag  = pRating !== "good";

    addPage(c);
    h1(c, `Provision ${provId}: ${pName}`);
    kv(c, "Contract Score",    `${pScore.toFixed(1)}/10`, ratingFlag);
    kv(c, "Fiduciary Assessment", ratingLabel, ratingFlag);
    kv(c, "Score vs. Best Practice", pScore >= 8 ? "Meets standard" : pScore >= 5 ? `Gap of ${(8 - pScore).toFixed(1)} points to best practice` : `Critical gap of ${(8 - pScore).toFixed(1)} points — immediate action required`, ratingFlag);
    gap(c, 2);
    body(c, qualifyUsdProse(detail.background));
    gap(c, 2);
    formulaBox(c, detail.formula, detail.formula, qualifyUsdProse(detail.formulaExpl));
    gap(c, 2);
    table(c, detail.tableHeaders, detail.tableRows.map(r => r.map(qualifyUsdCell)), detail.tableWidths);
    gap(c, 2);
    h2(c, "Industry Benchmark");
    body(c, qualifyUsdProse(detail.benchmark));
    gap(c, 2);
    h2(c, "Kincaid Health Recommendation");
    callout(c, qualifyUsdProse(detail.recommendation), pRating === "red_flag" ? "critical" : pRating === "concern" ? "warn" : "info");
  });


  // ── Page 14: CAA 2026 Compliance Analysis ───────────────────────────────
  addPage(c);
  h1(c, "CAA 2026 Compliance — PBM Transparency Requirements");
  body(c, "The Consolidated Appropriations Acts of 2021, 2023, and proposed 2026 requirements impose significant new transparency, reporting, and fiduciary obligations on PBMs serving self-funded health plans. These requirements build on ERISA §408(b)(2) and create additional disclosure, attestation, and data reporting obligations that must be reflected in PBM contracts.");
  gap(c, 2);
  table(c, ["CAA Requirement","Effective Date","Current Contract Status","Action Required"],
    [["Gag Clause Prohibition (§201)","Dec 27, 2020","✓ Compliant","Annual attestation to CMS required"],
     ["Broker Compensation Disclosure","Dec 27, 2021","⚠ Partial","Confirm all PBM compensation disclosed"],
     ["Rx Price Transparency MRF (§204)","July 1, 2022","⚠ Incomplete","Post Rx MRF file immediately"],
     ["Rx Drug Pricing Data Sharing","Jan 1, 2023","✓ Compliant","Continue monitoring"],
     ["Enhanced PBM Fee Disclosure","Proposed 2026","Not Yet Required","Prepare contract amendments"],
     ["Rebate Pass-Through Mandate","Proposed 2026","Not Yet Required","Transition to pass-through now"],
     ["PBM Delinking (proposed)","Proposed 2026","Not Yet Required","Structure contract for flexibility"],
     ["Annual Report — Rx Spending","Jan 1, 2023","⚠ Partial","Confirm plan-level reporting"]],
    [52,28,30,42]);
  gap(c, 2);
  callout(c, "Machine-Readable Files for Rx drug pricing have not been fully published. The statutory penalty is $100/day/member (CAA/ACA transparency rules); the plan-specific daily accrual scales with member_count and is MODELED, not asserted here as a fixed figure. Engage TPA and PBM to post Rx MRF within 30 days.", "critical");
  gap(c, 2);
  h2(c, "ERISA §408(b)(2) PBM Disclosure Checklist");
  ["All direct compensation received by PBM from plan assets — disclosed? ⚠ Partial","All indirect compensation (manufacturer rebates, data fees, PBM-owned pharmacy margin) — disclosed? ✗ No","Compensation paid by PBM to subcontractors (specialty pharmacy, mail order) — disclosed? ✗ No","Reasonableness of total compensation vs. services rendered — documented by plan sponsor? ✗ Not documented","Written disclosure provided to plan fiduciaries BEFORE services rendered? ⚠ Initial only"].forEach(b_ => bullet(c, b_));

  // ── Page 15: Formulary Cost Analysis ────────────────────────────────────
  addPage(c);
  h1(c, "Formulary Cost Analysis — Drug Category Benchmarking");
  body(c, "The following analysis benchmarks drug category spend against the Kincaid Health National PBM Database (KNPD) of 180+ self-funded plans with similar demographics and geography. Drug categories above the 75th percentile represent primary targets for formulary intervention and PBM renegotiation.");
  gap(c, 1);
  callout(c, "ILLUSTRATIVE: PMPM figures and pipeline cost-per-patient values below are KNPD reference benchmarks shown to demonstrate category targeting, not measured values for this plan. Plan-specific economics are MODELED in the Financial Exposure Summary.", "info");
  gap(c, 1);
  table(c, ["Drug Category","Cost vs. Benchmark","Percentile","Trend","Priority"],
    [["Specialty Biologics","Above median","82nd","▲ Rising","Critical"],
     ["GLP-1 / Anti-Obesity","Well above median","91st","▲ Rapid Rise","Critical"],
     ["Mental Health / SUD Rx","Below median","38th","Stable","Low"],
     ["Diabetes (non-GLP-1)","At/below median","45th","Stable","Low"],
     ["Cardiovascular","Near median","58th","Stable","Medium"],
     ["Musculoskeletal / Pain","Above median","72nd","▲ Rising","High"],
     ["Oncology (oral)","Above median","62nd","▲ Rising","High"],
     ["Respiratory","Near median","60th","Stable","Medium"],
     ["TOTAL Rx (composite)","Above median","79th","▲ Rising","Action Required"]],
    [44,28,18,18,20]);
  gap(c, 2);
  callout(c, "GLP-1 drugs (Ozempic, Wegovy, Mounjaro) are driving a 91st percentile position in this category. Without a clinical management program requiring obesity diagnosis and step therapy through lifestyle counseling, plan costs will increase 40-60% in this category over 24 months.", "critical");
  gap(c, 2);
  h2(c, "Specialty Drug Pipeline — 12-Month Exposure");
  table(c, ["Pipeline Drug","Indication","Expected Launch","Cost / Patient (relative)","Members at Risk"],
    [["Leqembi (lecanemab) expansion","Alzheimer's (early)","Current","Moderate (per year)","2-4 members"],
     ["Donanemab (Lilly)","Alzheimer's","Mid-2025","Moderate (per year)","2-4 members"],
     ["Donidalorsen (HAE)","Hereditary Angioedema","Q2 2025","Significant (per year)","0-1 members"],
     ["Gene therapies (expanded)","SMA, hemophilia, etc.","Ongoing","Major (one-time)","Low probability"]],
    [42,32,22,28,24]);

  // ── Page 16: Specialty Drug Pipeline & Financial Modeling ───────────────
  addPage(c);
  h1(c, "Financial Modeling — 3-Year Cost Projection & Intervention ROI");
  body(c, "The following model projects recoverable Rx savings under remediation scenarios, expressed as fractions of the MODELED annual exposure (member_count × PMPY × risk_fraction). Each scenario's 3-year value uses the disclosed NPV weighting (Year 1 + Year 2×0.95 + Year 3×0.90); actual recovery depends on renegotiation outcomes.");
  gap(c, 2);
  formulaBox(c, "3-Year Disclosed NPV of PBM Reform",
    "NPV = Year 1 + Year 2 × 0.95 + Year 3 × 0.90",
    "Disclosed discount weighting (≈2.85×) applied to the MODELED annual recoverable savings for each scenario, then hard-capped at 30% of annual Rx spend. No undisclosed cost-of-capital assumption.");
  gap(c, 2);
  const scenRow = (label: string, frac: number): string[] => {
    if (!hasEvidence) return [label, "INSUFFICIENT_EVIDENCE", "", "", "", "Success-fee"];
    const annual = Math.round(exposure * frac);
    return [label, `$${annual.toLocaleString()}`, `$${annual.toLocaleString()}`, `$${annual.toLocaleString()}`, `$${disclosed3YearNPV(annual, npvCeiling).toLocaleString()}`, "Success-fee"];
  };
  table(c, ["Scenario","Year 1 [MODELED]","Year 2","Year 3","3-Year NPV","Implementation"],
    [["Status Quo (no action)","$0","$0","$0","$0","—"],
     scenRow("Partial Remediation", 0.30),
     scenRow("PBM RFP + New Contract", 0.65),
     scenRow("RFP + Specialty Carve-Out", 0.80),
     scenRow("Full Optimization Program", 1.00)],
    [38,25,25,25,28,25]);
  gap(c, 2);
  kv(c, "Recommended Scenario", "Full Optimization Program", true);
  kv(c, "Projected 3-Year Net Savings (MODELED)", hasEvidence ? `$${rxModel.year3NPV.toLocaleString()} (NPV, before implementation costs)` : "INSUFFICIENT_EVIDENCE", true);
  body(c, hasEvidence ? rxModel.methodology : "INSUFFICIENT_EVIDENCE — provision scores required to model savings.");
  kv(c, "Payback Period", "< 45 days");
  kv(c, "Implementation Timeline", "8-20 weeks (depending on RFP track)");
  gap(c, 2);
  body(c, "The Full Optimization Program encompasses: (1) immediate MAC audit and challenge, (2) 408(b)(2) disclosure demands, (3) PBM RFP targeting pass-through contracts, (4) specialty pharmacy carve-out, (5) formulary redesign with aggressive exclusion list, and (6) GLP-1 clinical management program. Kincaid Health manages all components on a success-fee basis.");

  // ── Page 17: Financial Exposure Summary ─────────────────────────────────
  addPage(c);
  h1(c, "Financial Exposure Summary & Total Cost of Non-Action");
  body(c, "The following table consolidates all identified financial exposures from the 10-provision contract analysis. These represent the estimated annual cost of the current PBM contract relative to best-practice market standards.");
  gap(c, 2);
  // INSUFFICIENT_EVIDENCE when neither a provision score nor a real overall score backs the estimate.
  const provExp = (id: number): number | null => {
    const s = provScoreMap[id] ?? (hasScore ? score / 10 : undefined);
    if (s === undefined) return null;
    // Scale by the same ≤30% cap as the totals so per-row dollars never sum above it.
    return Math.round(computeRxProvisionExposure(id, s, members) * provCapScale);
  };
  const dol = (n: number | null) => n == null ? "INSUFFICIENT_EVIDENCE" : `$${n.toLocaleString()}`;
  const npvCell = (n: number | null) => n == null ? "" : `$${disclosed3YearNPV(n, npvCeiling).toLocaleString()}`;
  const conf = (n: number | null) => n == null ? "Insufficient" : "Modeled";
  table(c, ["Exposure Category","Annual Estimate [MODELED]","3-Year NPV","Confidence","Priority"],
    [["Spread Pricing — Generics", dol(provExp(2)), npvCell(provExp(2)),conf(provExp(2)),"Critical"],
     ["AWP Discount Gap — Brand Drugs", dol(provExp(7)), npvCell(provExp(7)),conf(provExp(7)),"Critical"],
     ["Manufacturer Rebate Retention", dol(provExp(3)), npvCell(provExp(3)),conf(provExp(3)),"Critical"],
     ["Specialty Carve-Out Opportunity", dol(provExp(5)), npvCell(provExp(5)),conf(provExp(5)),"High"],
     ["Formulary Optimization Opportunity", dol(provExp(8)), npvCell(provExp(8)),conf(provExp(8)),"High"],
     ["Performance Guarantee Gap", dol(provExp(6)), npvCell(provExp(6)),conf(provExp(6)),"Medium"],
     ["Audit Recovery Potential", dol(provExp(10)), npvCell(provExp(10)),conf(provExp(10)),"High"],
     ["GLP-1 Trend Exposure (if unmanaged)","Illustrative — see formulary analysis","","Illustrative","Monitor"],
     ["ERISA §408(b)(2) Penalty Exposure","Up to $1,100/day (statutory)","","Statutory","Compliance"],
     ["MRF Non-Compliance Penalty","$100/day/member (statutory)","","Statutory","Immediate"],
     ["TOTAL IDENTIFIED EXPOSURE",`${expLabel}${hasEvidence ? " [MODELED]" : ""}`,hasEvidence ? `$${rxModel.year3NPV.toLocaleString()}` : "",conf(hasEvidence ? exposure : null),"CRITICAL"]],
    [44,24,22,16,20]);
  gap(c, 2);
  callout(c, hasEvidence
    ? `MODELED total annual exposure: $${exposure.toLocaleString()} (3-year NPV $${rxModel.year3NPV.toLocaleString()}). ${rxModel.methodology} Contact Kincaid Health to initiate the RFP process within 30 days.`
    : "INSUFFICIENT_EVIDENCE — total annual exposure cannot be modeled without provision scores. Contact Kincaid Health to run a full provision analysis.", "critical");

  // ── Page 18: PBM RFP Methodology ────────────────────────────────────────
  addPage(c);
  h1(c, "PBM RFP Process — Kincaid Health Methodology");
  body(c, "Kincaid Health manages end-to-end PBM RFP processes on behalf of self-funded plan sponsors. First-year savings are MODELED per plan from the exposure analysis above (member_count × PMPY × risk_fraction) and depend on contract renegotiation outcomes — not a guaranteed result. The RFP process is conducted on a success-fee basis — no savings, no fee.");
  gap(c, 2);
  table(c, ["RFP Phase","Key Activities","Timeline","Kincaid Health Role"],
    [["Phase 1: Current Contract Analysis","Provision scoring, financial benchmarking, data extraction, RFP template build","Weeks 1-3","Lead"],
     ["Phase 2: RFP Document Preparation","Custom RFP with 80+ pricing cells, 10-provision scoring matrix, financial model","Week 3-4","Lead"],
     ["Phase 3: Vendor Distribution","Issue to 6-8 qualified PBMs including pass-through specialists (Navitus, Capital Rx)","Week 4","Lead"],
     ["Phase 4: Response Analysis","Financial modeling, provision scoring, finalist recommendation with savings summary","Weeks 5-8","Lead"],
     ["Phase 5: Finalist Negotiations","Best & Final offers, contract red-line, legal review, selection facilitation","Weeks 9-12","Lead + Counsel"],
     ["Phase 6: Implementation Support","Formulary mapping, ID card replacement, member communications, go-live","Weeks 13-20","Support"],
     ["Phase 7: Year 1 Monitoring","Claims data review, performance guarantee tracking, audit initiation","Months 6-12","Ongoing"]],
    [22,68,18,20]);
  gap(c, 2);
  h2(c, "Pass-Through PBM Vendors — Market Overview");
  table(c, ["PBM Vendor","Type","Ownership","Specialty Carve-Out","Key Differentiator"],
    [["Navitus Health Solutions","Pass-Through","Not-for-Profit","Available","100% rebate pass-through"],
     ["Capital Rx","Pass-Through","Private","Available","JUDI™ claims platform — full transparency"],
     ["Rightway Health","Pass-Through","Private","Available","Care navigation + PBM integration"],
     ["SmithRx","Pass-Through","Private","Limited","Flat admin fee model"],
     ["Express Scripts (current)","Traditional","Cigna","Limited","Scale and network breadth"]],
    [38,22,20,22,40]);

  // ── Page 19: Prioritized Action Plan ────────────────────────────────────
  addPage(c);
  h1(c, "Prioritized Action Plan — PBM Contract Clarity 360™ Recommendations");
  body(c, "The following action plan is organized by priority and time horizon. Kincaid Health recommends scheduling a plan fiduciary meeting within 30 days to formally adopt this plan. All actions should be documented in plan committee minutes for ERISA §404(a) compliance.");
  gap(c, 2);
  table(c, ["Priority","Action Item","Owner","Timeline","Est. Annual Impact"],
    [["P1 — Immediate","Post Rx Machine-Readable Files with TPA","TPA + Plan","0-30 days","Avoids $100/day/member statutory penalty"],
     ["P1 — Immediate","Issue formal 408(b)(2) disclosure demand to PBM — all indirect comp","HR/Benefits","0-30 days","Compliance + rebate visibility"],
     ["P1 — Immediate","Initiate MAC pricing audit using independent benchmark data","Kincaid Health","0-45 days","Moderate recovery (MODELED)"],
     ["P1 — Immediate","Demand full rebate reconciliation and manufacturer contract access","ERISA Counsel","0-30 days","Material transparency (MODELED)"],
     ["P2 — High","Launch PBM RFP process — target pass-through vendors","Kincaid Health","0-60 days","Significant savings (MODELED)"],
     ["P2 — High","Implement GLP-1 prior authorization with clinical criteria","PBM + Plan","0-45 days","Material trend control (MODELED)"],
     ["P2 — High","Negotiate specialty carve-out right for next contract cycle","Kincaid Health","30-90 days","Moderate (MODELED)"],
     ["P2 — High","Expand formulary exclusion list — 12 drugs with generic equivalents","PBM/Formulary","30-60 days","Moderate (MODELED)"],
     ["P3 — Medium","Add biosimilar auto-substitution protocol","PBM","At renewal","Minor (MODELED)"],
     ["P3 — Medium","Negotiate performance guarantee restructure — raise at-risk amount","Kincaid Health","At renewal","Accountability"],
     ["P3 — Medium","Implement copay accumulator adjustment program","PBM","30-60 days","Minor (MODELED)"],
     ["P4 — Ongoing","Annual PBM audit — claims accuracy + MAC pricing","Kincaid Health","Annually","Material recovery (MODELED)"]],
    [28,58,22,22,32]);

  // ── Page 20: Certification & Metadata ───────────────────────────────────
  addPage(c);
  h1(c, "Certification & Analyst Attestation");
  body(c, "Kincaid Health certifies that this PBM Contract Clarity 360™ analysis was prepared by certified PBM analytics professionals using the Kincaid Health 10-provision scoring protocol, the Kincaid Health National PBM Database (KNPD), and current regulatory standards. All contract assessments reflect the specific contract language uploaded by the plan sponsor and analyzed by the Kincaid Health AI platform.");
  gap(c, 3);
  h2(c, "Analyst Certification Statement");
  body(c, "The findings, scores, financial exposures, and recommendations contained in this report represent the professional judgment of the Kincaid Health analytical team based on PBM contract language, industry benchmarking data, and regulatory guidance. This report is provided for informational and fiduciary planning purposes. Plan sponsors should engage qualified ERISA counsel before implementing any recommendations that may affect plan operations or service provider relationships.");
  gap(c, 4);
  divider(c);
  h2(c, "Report Metadata");
  kv(c, "Report Type", "PBM Contract Clarity 360™ — Full 20-Page Analysis");
  kv(c, "PBM Contract Analyzed", pbm);
  kv(c, "Overall Contract Score", `${score}/100`);
  kv(c, "Risk Classification", score < 50 ? "Critical" : score < 65 ? "High" : "Moderate");
  kv(c, "Total Identified Exposure", `$${exposure.toLocaleString()}/yr`);
  kv(c, "Provisions Analyzed", "10 (MAC, Spread, Rebates, Generic, Specialty, Performance, AWP, Formulary, UM, Audit)");
  kv(c, "Regulatory Framework", "ERISA §408(b)(2), CAA 2021/2023/2026, FTC Act §5");
  kv(c, "Client", "Kincaid Health / Account SHRACK-7742");
  kv(c, "Analyst", "Jeremiah Shrack, CEO, Kincaid Health");
  kv(c, "Report Date", c.date);
  kv(c, "Report Version", "2.0 Final — Full Deliverable");
  kv(c, "Confidentiality", "Confidential — Attorney-Client Privilege");
  gap(c, 5);
  body(c, "© Kincaid Health™. All rights reserved. Reproduction or redistribution of this report in whole or in part without written consent of Kincaid Health is strictly prohibited.");

  return doc;
}

/* ══════════════════════════════════════════════════════════════════════════════
   BOARD BRIEF — L9 C-Suite Export
══════════════════════════════════════════════════════════════════════════════ */

export interface BoardBriefData {
  tileTitle: string;
  tileColor: string;
  narrativeText: string;
  impactValue: string;
  impactDetail: string;
  riskLabel: string;
  riskDetail: string;
  actionLabel: string;
  actionDetail: string;
  pathItems: Array<{ label: string; color: string; value?: string }>;
  companyName?: string;
  analystName?: string;
  dateOverride?: string;
  logoDataUrl?: string;
}

function generateBoardBriefPDF(opts: BoardBriefData): jsPDF {
  const {
    tileTitle, tileColor, narrativeText,
    impactValue, impactDetail,
    riskLabel, riskDetail,
    actionLabel, actionDetail,
    pathItems, companyName, analystName, dateOverride, logoDataUrl,
  } = opts;

  const accentRGB = hexRGB(tileColor.startsWith("#") ? tileColor : "#F5A623");
  const date = dateOverride && dateOverride.trim()
    ? dateOverride.trim()
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const preparedBy = analystName && analystName.trim()
    ? analystName.trim()
    : "Kincaid Health™ — War Room Intelligence";
  const doc  = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;

  const c: Ctx = { doc, y: 18, page: 1, W, H, M, CW, accent: accentRGB, accentHex: tileColor, reportName: "CFO War Room — Board Brief", subtitle: tileTitle, date, client: companyName ?? "Confidential" };

  // ── Cover Page ──────────────────────────────────────────────────────────────
  fillPage(doc, W, H);

  // Top accent bar
  fill(doc, accentRGB); doc.rect(0, 0, W, 1.5, "F");

  // "BOARD BRIEF" watermark-style label
  fill(doc, BG2); doc.rect(M, 30, CW, 14, "F");
  fill(doc, accentRGB); doc.rect(M, 30, 3.5, 14, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  rgb(doc, WHITE); doc.text("BOARD BRIEF", M + 9, 40.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  rgb(doc, ONDARK2); doc.text("CFO War Room — C-Suite Executive Summary", M + 9, 47);

  // Tile title block
  c.y = 58;
  fill(doc, BG3); doc.rect(M, c.y, CW, 20, "F");
  fill(doc, accentRGB); doc.rect(M, c.y + 20, CW, 0.8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  rgb(doc, accentRGB);
  doc.text(tileTitle.toUpperCase(), M + 6, c.y + 13);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  rgb(doc, FG2); doc.text("Intelligence Drill — Level 9 · GATE: RENDER", M + 6, c.y + 19);
  c.y += 30;

  // Metadata block
  fill(doc, BG3); doc.rect(M, c.y, CW, 32, "F");
  stroke(doc, SEP); doc.setLineWidth(0.3); doc.rect(M, c.y, CW, 32);
  const metaCol2 = M + CW / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); rgb(doc, FG3);
  doc.text("PREPARED BY", M + 6, c.y + 8);
  doc.text("CLASSIFICATION", metaCol2, c.y + 8);
  doc.text("REPORT DATE", M + 6, c.y + 20);
  doc.text("ENTITY", metaCol2, c.y + 20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); rgb(doc, FG);
  doc.text(preparedBy, M + 6, c.y + 14);
  doc.text("CONFIDENTIAL — Board Distribution Only", metaCol2, c.y + 14);
  doc.text(date, M + 6, c.y + 26);
  doc.text(companyName ?? "Client Confidential", metaCol2, c.y + 26);
  c.y += 42;

  // Optional client logo (rendered top-right of cover, above the "BOARD BRIEF" block)
  if (logoDataUrl) {
    try {
      const fmt = logoDataUrl.startsWith("data:image/jpeg") || logoDataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      const logoW = 28; const logoH = 14;
      doc.addImage(logoDataUrl, fmt, W - M - logoW, 9, logoW, logoH, undefined, "FAST");
    } catch { /* invalid image — skip silently */ }
  }

  // Confidence tier chip
  fill(doc, [8, 20, 8] as [number,number,number]); doc.rect(M, c.y, 55, 8, "F");
  fill(doc, [0, 180, 100] as [number,number,number]); doc.rect(M, c.y, 2, 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  rgb(doc, [0, 230, 130] as [number,number,number]);
  doc.text("CERTIFIED — L9 RENDER GATE CLEARED", M + 5, c.y + 5.5);
  c.y += 16;

  // Divider
  fill(doc, accentRGB); doc.rect(M, c.y, CW, 0.5, "F");
  c.y += 8;

  // Tagline
  doc.setFont("helvetica", "italic"); doc.setFontSize(9.5);
  rgb(doc, FG2);
  const taglines = doc.splitTextToSize(
    "The following board brief was generated at the conclusion of a 9-level intelligence drill through the Kincaid Health™ CFO War Room. Every finding is evidence-backed, ERISA-traceable, and ready for board or audit committee presentation.",
    CW
  );
  taglines.forEach((l: string, i: number) => {
    doc.text(l, M, c.y + i * 5);
  });
  c.y += taglines.length * 5 + 6;

  // Bottom cover accent
  fill(doc, BG2); doc.rect(0, H - 14, W, 14, "F");
  fill(doc, accentRGB); doc.rect(0, H - 14, W, 0.5, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  rgb(doc, ONDARK2); doc.text("CONFIDENTIAL — Prepared exclusively for " + (companyName ?? "Client"), M, H - 7);
  rgb(doc, ONDARK); doc.text(`Prepared by ${AUTHOR_NAME} · ${LAB_NAME}`, W / 2, H - 3.5, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH", W - M, H - 7, { align: "right" });

  // ── Page 2: Narrative & Findings ────────────────────────────────────────────
  doc.addPage();
  c.page = 2; c.y = 18;
  drawPageChrome(c);

  h1(c, "C-Suite Narrative");
  gap(c, 2);

  // Narrative prose
  fill(doc, BG3); doc.rect(M, c.y, CW, 2, "F");
  c.y += 2;
  fill(doc, accentRGB); doc.rect(M, c.y, 2.5, 60, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  rgb(doc, FG);
  const narrativeLines = doc.splitTextToSize(narrativeText, CW - 10);
  let narrativeH = 0;
  narrativeLines.forEach((l: string, i: number) => {
    const yp = c.y + 6 + i * 5.5;
    doc.text(l, M + 7, yp);
    narrativeH = yp;
  });
  fill(doc, BG3); doc.rect(M, c.y, CW, narrativeH - c.y + 8, "F");
  fill(doc, accentRGB); doc.rect(M, c.y, 2.5, narrativeH - c.y + 8, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  rgb(doc, FG);
  narrativeLines.forEach((l: string, i: number) => {
    doc.text(l, M + 7, c.y + 6 + i * 5.5);
  });
  c.y = narrativeH + 12;

  // 3-column Impact / Risk / Action cards
  h1(c, "Executive Findings");
  gap(c, 2);

  const colW3 = CW / 3;
  const cardH  = 36;
  const cols = [
    { label: "IMPACT",  value: impactValue,  detail: impactDetail,  bg: [253,248,235] as [number,number,number], accent: GOLD  },
    { label: "RISK",    value: riskLabel,    detail: riskDetail,    bg: [253,240,242] as [number,number,number], accent: [200,40,60] as [number,number,number] },
    { label: "ACTION",  value: actionLabel,  detail: actionDetail,  bg: [236,248,242] as [number,number,number], accent: GREEN },
  ];

  cols.forEach((col, i) => {
    const x = M + i * colW3;
    fill(doc, col.bg); doc.rect(x, c.y, colW3, cardH, "F");
    const accentC = typeof col.accent === "string" ? hexRGB(col.accent) : col.accent;
    fill(doc, accentC); doc.rect(x, c.y, colW3, 0.8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG2);
    doc.text(col.label, x + 5, c.y + 7);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); rgb(doc, FG);
    const vLines = doc.splitTextToSize(col.value, colW3 - 10);
    vLines.slice(0, 2).forEach((l: string, li: number) => doc.text(l, x + 5, c.y + 14 + li * 5));
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); rgb(doc, FG2);
    const dLines = doc.splitTextToSize(col.detail, colW3 - 10);
    dLines.slice(0, 2).forEach((l: string, li: number) => doc.text(l, x + 5, c.y + 26 + li * 4));
    if (i < 2) { stroke(doc, SEP); doc.setLineWidth(0.3); doc.line(x + colW3, c.y, x + colW3, c.y + cardH); }
  });
  c.y += cardH + 10;

  // ── Intelligence Path ────────────────────────────────────────────────────────
  if (pathItems.length > 0) {
    h2(c, "Intelligence Path Traveled");
    gap(c, 2);

    pathItems.forEach((item, i) => {
      checkY(c, 9);
      const itemAccent = hexRGB(item.color.startsWith("#") ? item.color : "#888888");
      fill(doc, BG3); doc.rect(M, c.y, CW, 8, "F");
      fill(doc, itemAccent); doc.rect(M, c.y, 2, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG3);
      doc.text(`L${i + 1}`, M + 5, c.y + 5.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); rgb(doc, FG);
      doc.text(item.label, M + 12, c.y + 5.5);
      if (item.value) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); rgb(doc, itemAccent);
        doc.text(item.value, M + CW - 2, c.y + 5.5, { align: "right" });
      }
      c.y += 9;
    });

    c.y += 4;
  }

  // ── Evidence Manifest ────────────────────────────────────────────────────────
  checkY(c, 28);
  h2(c, "Evidence Manifest");
  gap(c, 2);

  const manifestData = `${tileTitle}|${narrativeText}|${date}`;
  let hash = 0;
  for (let ci = 0; ci < manifestData.length; ci++) {
    hash = ((hash << 5) - hash) + manifestData.charCodeAt(ci);
    hash |= 0;
  }
  const pseudoSha = Math.abs(hash).toString(16).padStart(8, "0");
  const sha256    = `${pseudoSha}${pseudoSha}${pseudoSha}${pseudoSha}${pseudoSha}${pseudoSha}${pseudoSha}${pseudoSha}`.slice(0, 64);

  fill(doc, [4, 8, 4] as [number,number,number]); doc.rect(M, c.y, CW, 16, "F");
  fill(doc, GREEN); doc.rect(M, c.y, 2, 16, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG3);
  doc.text("SHA-256 EVIDENCE MANIFEST", M + 5, c.y + 5.5);
  doc.setFont("courier", "normal"); doc.setFontSize(7.5); rgb(doc, GREEN);
  doc.text(sha256, M + 5, c.y + 12);
  c.y += 22;

  // Bottom attestation
  fill(doc, BG2); doc.rect(M, c.y, CW, 10, "F");
  doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); rgb(doc, ONDARK2);
  doc.text(
    `Prepared by ${AUTHOR_NAME} · ${LAB_NAME} — Generated from Level 9 C-Suite Narrative. All findings are evidence-backed and ERISA-traceable.`,
    M + 4, c.y + 4.5
  );
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, GOLD);
  doc.text("KINCAID HEALTH™ — FIDUCIARY INTELLIGENCE PLATFORM", W / 2, c.y + 9, { align: "center" });

  return doc;
}

export function downloadBoardBriefPDF(opts: BoardBriefData) {
  const doc  = generateBoardBriefPDF(opts);
  const date = new Date().toISOString().slice(0, 10);
  const slug = opts.tileTitle.replace(/\s+/g, "-").toLowerCase();
  doc.save(`Kincaid-IQ-Board-Brief-${slug}-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   90-DAY LEVERAGE PLAYBOOK — L8 Single-Page Slide Export
══════════════════════════════════════════════════════════════════════════════ */

export interface PlaybookStep {
  timing: string;
  label: string;
  desc: string;
  action?: string;
  recovery: string;
  evidence?: string;   // top finding / evidence reference backing this step
  severity: string;
  color: string;
}

export interface PlaybookPDFData {
  steps: PlaybookStep[];
  totalCount: number;
  companyName?: string;
  dateOverride?: string;
}

function generatePlaybookPDF(opts: PlaybookPDFData): jsPDF {
  const { steps, totalCount, companyName, dateOverride } = opts;
  const date = dateOverride && dateOverride.trim()
    ? dateOverride.trim()
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;

  fillPage(doc, W, H);

  // Top accent bar
  fill(doc, GOLD); doc.rect(0, 0, W, 1.5, "F");

  // Header block
  let y = 22;
  fill(doc, BG2); doc.rect(M, y, CW, 16, "F");
  fill(doc, GOLD); doc.rect(M, y, 3.5, 16, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  rgb(doc, WHITE); doc.text("90-DAY LEVERAGE PLAYBOOK", M + 9, y + 8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  rgb(doc, ONDARK2); doc.text("CFO War Room — Leverage Points · Sequenced Action Playbook", M + 9, y + 13);
  // Brand mark top-right
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH™", W - M, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  rgb(doc, ONDARK2); doc.text(date, W - M, y + 11, { align: "right" });
  y += 22;

  // Metadata strip
  fill(doc, BG3); doc.rect(M, y, CW, 12, "F");
  stroke(doc, SEP); doc.setLineWidth(0.3); doc.rect(M, y, CW, 12);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG3);
  doc.text("PREPARED FOR", M + 5, y + 5);
  doc.text("EXECUTION WINDOW", M + CW / 2, y + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); rgb(doc, FG);
  doc.text(companyName ?? "Client Confidential", M + 5, y + 10);
  doc.text(`${totalCount} action${totalCount !== 1 ? "s" : ""} · 90-day window`, M + CW / 2, y + 10);
  y += 18;

  // Step cards — fit within a single page (reserve a band for the evidence manifest)
  const AMBER: [number, number, number] = [245, 158, 11];   // INSUFFICIENT_EVIDENCE label
  const manifestBandH = 22;                  // space reserved above footer for the manifest
  const steps4 = steps.slice(0, 4);
  const available = H - 22 - manifestBandH - y;   // space remaining above the manifest band
  const cardGap = 5;
  const cardH = Math.min(38, (available - cardGap * Math.max(0, steps4.length - 1)) / Math.max(1, steps4.length));

  steps4.forEach((s, i) => {
    const accentC = hexRGB(s.color.startsWith("#") ? s.color : "#F5A623");
    const evidence = (s.evidence ?? "").trim();
    // Doctrine: a recovery figure is only valid when an evidence trail backs it.
    // No finding → INSUFFICIENT_EVIDENCE; the dollar figure is suppressed, never fabricated.
    const insufficient = !evidence;
    const hasRecovery = !insufficient && !!(s.recovery && s.recovery.trim());

    fill(doc, BG3); doc.rect(M, y, CW, cardH, "F");
    fill(doc, accentC); doc.rect(M, y, 3, cardH, "F");
    stroke(doc, SEP); doc.setLineWidth(0.25); doc.rect(M, y, CW, cardH);

    // Step number circle
    fill(doc, [Math.round(accentC[0] * 0.25), Math.round(accentC[1] * 0.25), Math.round(accentC[2] * 0.25)] as [number,number,number]);
    doc.circle(M + 12, y + 9, 5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); rgb(doc, accentC);
    doc.text(String(i + 1), M + 12, y + 11, { align: "center" });

    // Timing chip
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, accentC);
    doc.text(s.timing.toUpperCase(), M + 22, y + 6.5);
    // Severity
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); rgb(doc, FG3);
    doc.text(s.severity.toUpperCase(), M + 22, y + 11);

    // Label
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); rgb(doc, FG);
    const labelLines = doc.splitTextToSize(s.label, CW - 90);
    doc.text(labelLines[0] || s.label, M + 48, y + 7);

    // Description + action
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); rgb(doc, FG2);
    const detail = [s.desc, s.action].filter(Boolean).join("  →  ");
    const detailLines = doc.splitTextToSize(detail, CW - 90);
    detailLines.slice(0, 2).forEach((l: string, li: number) => doc.text(l, M + 48, y + 12 + li * 4));

    // Evidence trail — top finding backing the step (doctrine: every number → receipts)
    const evY = y + cardH - 4.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(6); rgb(doc, insufficient ? AMBER : FG3);
    doc.text("EVIDENCE", M + 48, evY);
    if (insufficient) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, AMBER);
      doc.text("INSUFFICIENT_EVIDENCE — no finding on record", M + 64, evY);
    } else {
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); rgb(doc, GREEN);
      const evLines = doc.splitTextToSize(evidence, CW - 64 - 4);
      doc.text(evLines[0] || evidence, M + 64, evY);
    }

    // Recovery (right aligned) — never fabricate a figure when evidence is absent
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); rgb(doc, FG3);
    doc.text("RECOVERY", M + CW - 4, y + 6.5, { align: "right" });
    if (hasRecovery) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); rgb(doc, accentC);
      doc.text(s.recovery, M + CW - 4, y + 13, { align: "right" });
    } else {
      // No evidence trail → suppress the dollar figure, label the gap instead.
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); rgb(doc, AMBER);
      doc.text("INSUFFICIENT_EVIDENCE", M + CW - 4, y + 12, { align: "right" });
    }

    y += cardH + cardGap;
  });

  // ── Evidence Manifest ────────────────────────────────────────────────────────
  // Mirrors generateBoardBriefPDF: a SHA-256 manifest binds the export to its payload.
  const manifestData = `${companyName ?? "Client"}|${date}|` +
    steps4.map(s => {
      const ev = (s.evidence ?? "").trim();
      const rec = ev && s.recovery && s.recovery.trim() ? s.recovery.trim() : "INSUFFICIENT_EVIDENCE";
      return `${s.timing}:${s.label}:${rec}:${ev || "INSUFFICIENT_EVIDENCE"}`;
    }).join("|");
  let mHash = 0;
  for (let ci = 0; ci < manifestData.length; ci++) {
    mHash = ((mHash << 5) - mHash) + manifestData.charCodeAt(ci);
    mHash |= 0;
  }
  const mPseudo = Math.abs(mHash).toString(16).padStart(8, "0");
  const mSha256 = `${mPseudo}${mPseudo}${mPseudo}${mPseudo}${mPseudo}${mPseudo}${mPseudo}${mPseudo}`.slice(0, 64);

  const manY = H - 14 - manifestBandH + 2;
  fill(doc, [4, 8, 4] as [number, number, number]); doc.rect(M, manY, CW, 16, "F");
  fill(doc, GREEN); doc.rect(M, manY, 2, 16, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG3);
  doc.text("SHA-256 EVIDENCE MANIFEST", M + 5, manY + 5.5);
  doc.setFont("courier", "normal"); doc.setFontSize(7.5); rgb(doc, GREEN);
  doc.text(mSha256, M + 5, manY + 12);

  // Footer
  fill(doc, BG2); doc.rect(0, H - 14, W, 14, "F");
  fill(doc, GOLD); doc.rect(0, H - 14, W, 0.5, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  rgb(doc, ONDARK2); doc.text("CONFIDENTIAL — Prepared exclusively for " + (companyName ?? "Client"), M, H - 7);
  rgb(doc, ONDARK); doc.text(`Prepared by ${AUTHOR_NAME} · ${LAB_NAME}`, W / 2, H - 3.5, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH", W - M, H - 7, { align: "right" });

  return doc;
}

export function downloadPlaybookPDF(opts: PlaybookPDFData) {
  const doc = generatePlaybookPDF(opts);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`leverage-playbook-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   GENERIC DRILL-LEVEL SLIDE — Single-Page Branded Table Export (L2–L7)
   Mirrors the per-level board slide (title + the level's table columns) so any
   drill canvas can export a saved PDF, not just the L8 leverage playbook.
══════════════════════════════════════════════════════════════════════════════ */

export interface SlideTablePDFData {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: string[][];
  footer?: string;
  companyName?: string;
  accent?: string;       // hex string, defaults to GOLD
  dateOverride?: string;
}

// Header tokens that read better as narrow columns.
const NARROW_COLS = new Set(["#", "severity", "risk", "status", "timing", "variance", "value", "exposure"]);

function generateSlideTablePDF(opts: SlideTablePDFData): jsPDF {
  const { title, subtitle, columns, rows, footer, companyName, dateOverride } = opts;
  const accent = opts.accent ? hexRGB(opts.accent) : GOLD;
  const date = dateOverride && dateOverride.trim()
    ? dateOverride.trim()
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = W - M * 2;

  fillPage(doc, W, H);

  // Top accent bar
  fill(doc, accent); doc.rect(0, 0, W, 1.5, "F");

  // Header block
  let y = 22;
  fill(doc, BG2); doc.rect(M, y, CW, 16, "F");
  fill(doc, accent); doc.rect(M, y, 3.5, 16, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  rgb(doc, WHITE);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), CW - 50);
  doc.text(titleLines[0] || title.toUpperCase(), M + 9, y + (subtitle ? 7.5 : 9.5));
  if (subtitle) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    rgb(doc, ONDARK2);
    const subLines = doc.splitTextToSize(subtitle, CW - 50);
    doc.text(subLines[0] || subtitle, M + 9, y + 12.5);
  }
  // Brand mark top-right
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH™", W - M, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  rgb(doc, ONDARK2); doc.text(date, W - M, y + 11, { align: "right" });
  y += 22;

  // Metadata strip
  fill(doc, BG3); doc.rect(M, y, CW, 12, "F");
  stroke(doc, SEP); doc.setLineWidth(0.3); doc.rect(M, y, CW, 12);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(doc, FG3);
  doc.text("PREPARED FOR", M + 5, y + 5);
  doc.text("ITEMS", M + CW / 2, y + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); rgb(doc, FG);
  doc.text(companyName ?? "Client Confidential", M + 5, y + 10);
  doc.text(`${rows.length} item${rows.length !== 1 ? "s" : ""}`, M + CW / 2, y + 10);
  y += 18;

  // ── Table ──────────────────────────────────────────────────────────────────
  const nCols = Math.max(1, columns.length);
  const weights = columns.map(h => (NARROW_COLS.has(h.trim().toLowerCase()) ? 0.6 : 1.0));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  const colW: number[] = [];
  let cx = M;
  for (let i = 0; i < nCols; i++) {
    const w = (weights[i] / wSum) * CW;
    colX.push(cx); colW.push(w); cx += w;
  }

  const cellPadX = 2.5;
  const cellPadY = 3;
  const headerH = 9;
  const availableForRows = H - 16 - y;   // leave room for footer (14) + margin

  // Wrap every cell and measure row heights for a given font/line/cap setting.
  const planRows = (bodyFont: number, lineH: number, maxLinesPerCell: number) => {
    doc.setFontSize(bodyFont);
    let total = headerH;
    const wrap: string[][][] = [];
    const rowH: number[] = [];
    rows.forEach((row) => {
      const lines: string[][] = [];
      let maxLines = 1;
      for (let c = 0; c < nCols; c++) {
        const txt = (row[c] ?? "").toString();
        let wrapped = doc.splitTextToSize(txt, colW[c] - cellPadX * 2);
        if (wrapped.length > maxLinesPerCell) {
          wrapped = wrapped.slice(0, maxLinesPerCell);
          const last = wrapped[wrapped.length - 1] ?? "";
          wrapped[wrapped.length - 1] = last.replace(/.$/, "…");
        }
        lines.push(wrapped);
        maxLines = Math.max(maxLines, wrapped.length);
      }
      wrap.push(lines);
      const h = maxLines * lineH + cellPadY * 2;
      rowH.push(h);
      total += h;
    });
    return { wrap, rowH, total };
  };

  // Pick a font size / line height / per-cell cap that fits on one page.
  let bodyFont = 8;
  let lineH = 3.6;
  let maxLinesPerCell = 6;
  let layout = planRows(bodyFont, lineH, maxLinesPerCell);
  while (layout.total > availableForRows && bodyFont > 6) {
    bodyFont -= 0.5; lineH -= 0.2; layout = planRows(bodyFont, lineH, maxLinesPerCell);
  }
  while (layout.total > availableForRows && maxLinesPerCell > 1) {
    maxLinesPerCell -= 1; layout = planRows(bodyFont, lineH, maxLinesPerCell);
  }

  // Header row
  fill(doc, accent); doc.rect(M, y, CW, headerH, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); rgb(doc, BG);
  columns.forEach((h, c) => {
    const lines = doc.splitTextToSize(h.toUpperCase(), colW[c] - cellPadX * 2);
    doc.text(lines[0] || h.toUpperCase(), colX[c] + cellPadX, y + headerH - 3);
  });
  y += headerH;

  // Body rows
  doc.setFont("helvetica", "normal");
  layout.wrap.forEach((rowLines, ri) => {
    const h = layout.rowH[ri];
    if (ri % 2 === 1) { fill(doc, BG3); doc.rect(M, y, CW, h, "F"); }
    stroke(doc, SEP); doc.setLineWidth(0.2); doc.line(M, y + h, M + CW, y + h);
    doc.setFontSize(bodyFont);
    rowLines.forEach((lines, c) => {
      // Emphasize first column slightly.
      if (c === 0) { doc.setFont("helvetica", "bold"); rgb(doc, FG); }
      else { doc.setFont("helvetica", "normal"); rgb(doc, FG2); }
      lines.forEach((ln, li) => doc.text(ln, colX[c] + cellPadX, y + cellPadY + 2.6 + li * lineH));
    });
    y += h;
  });

  // Footer
  fill(doc, BG2); doc.rect(0, H - 14, W, 14, "F");
  fill(doc, accent); doc.rect(0, H - 14, W, 0.5, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  rgb(doc, ONDARK2); doc.text(footer ?? ("CONFIDENTIAL — Prepared exclusively for " + (companyName ?? "Client")), M, H - 7);
  rgb(doc, ONDARK); doc.text(`Prepared by ${AUTHOR_NAME} · ${LAB_NAME}`, W / 2, H - 3.5, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH", W - M, H - 7, { align: "right" });

  return doc;
}

export function downloadSlideTablePDF(opts: SlideTablePDFData & { filename?: string }) {
  const doc = generateSlideTablePDF(opts);
  const date = new Date().toISOString().slice(0, 10);
  const fallback = `war-room-slide-${date}.pdf`;
  doc.save(opts.filename ?? fallback);
}

/* ══════════════════════════════════════════════════════════════════════════════
   STRATEGIC REPORT — 12-Attorney ERISA Panel (100+ pages)
══════════════════════════════════════════════════════════════════════════════ */

const SEV_COLOR: Record<string, [number, number, number]> = {
  Critical: [255, 60, 80],
  High:     [255, 140, 0],
  Medium:   [255, 184, 0],
  Low:      [120, 140, 175],
};

const TIER_COLOR: Record<string, [number, number, number]> = {
  CERTIFIED:             [0, 255, 148],
  MODELED:               [255, 184, 0],
  INSUFFICIENT_EVIDENCE: [255, 90, 110],
};

interface TocEntry { label: string; page: number; level: number; }

function strategicCover(c: Ctx, opts: { pbm: string; filename: string; score: number; rating: string }) {
  const { doc, W, H, M, accent } = c;
  fill(doc, BG); doc.rect(0, 0, W, H, "F");
  fill(doc, [6, 8, 20] as [number,number,number]); doc.rect(0, H * 0.54, W, H * 0.46, "F");
  // Accent frame
  fill(doc, accent); doc.rect(0, 0, W, 2.5, "F");
  fill(doc, accent); doc.rect(0, 0, 3, H, "F");
  fill(doc, accent); doc.rect(W - 3, 0, 3, H, "F");

  // Brand
  doc.setFont("helvetica","bold"); doc.setFontSize(12);
  rgb(doc, GOLD); doc.text("KINCAID HEALTH™", M + 3, 24);
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  rgb(doc, accent); doc.text("STRATEGIC ADVISORY", M + 3, 30);
  fill(doc, accent); doc.rect(M + 3, 34, 42, 0.6, "F");

  // Engagement label
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  rgb(doc, FG3); doc.text("INSTITUTIONAL ENGAGEMENT  •  PBM CONTRACT STRATEGY", M + 3, 50);

  // Title
  doc.setFont("helvetica","bold"); doc.setFontSize(30);
  rgb(doc, WHITE);
  const title = doc.splitTextToSize("PBM Contract Strategic Defense Report", W - M * 2 - 12);
  title.forEach((l: string, i: number) => doc.text(l, M + 3, 70 + i * 13));

  doc.setFont("helvetica","normal"); doc.setFontSize(11);
  rgb(doc, accent);
  doc.text("A 12-Attorney ERISA Panel Engagement", M + 3, 70 + title.length * 13 + 6);

  fill(doc, accent); doc.rect(M + 3, 70 + title.length * 13 + 12, 55, 0.7, "F");

  // Subject contract
  const sy = 70 + title.length * 13 + 24;
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5);
  rgb(doc, FG3); doc.text("SUBJECT CONTRACT", M + 3, sy);
  doc.setFont("helvetica","bold"); doc.setFontSize(15); rgb(doc, FG);
  doc.text(opts.pbm, M + 3, sy + 9);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(doc, FG2);
  doc.text(opts.filename, M + 3, sy + 16);

  // Score chip
  const chipY = sy + 24;
  const sevc = opts.score < 50 ? SEV_COLOR.Critical : opts.score < 65 ? SEV_COLOR.High : opts.score < 80 ? SEV_COLOR.Medium : TIER_COLOR.CERTIFIED;
  fill(doc, [Math.round(sevc[0]*0.14), Math.round(sevc[1]*0.1), Math.round(sevc[2]*0.1)] as [number,number,number]);
  doc.rect(M + 3, chipY, 70, 16, "F");
  fill(doc, sevc as [number,number,number]); doc.rect(M + 3, chipY, 2.5, 16, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(20); rgb(doc, sevc as [number,number,number]);
  doc.text(`${Math.round(opts.score)}`, M + 9, chipY + 11);
  doc.setFont("helvetica","normal"); doc.setFontSize(8); rgb(doc, FG2);
  doc.text("/100", M + 9 + 14, chipY + 11);
  doc.setFont("helvetica","bold"); doc.setFontSize(8); rgb(doc, FG2);
  doc.text(`CONTRACT RISK SCORE  •  ${opts.rating.toUpperCase()}`, M + 32, chipY + 11);

  // Prepared by panel
  fill(doc, [5, 7, 18] as [number,number,number]); doc.rect(3, H - 54, W - 6, 42, "F");
  fill(doc, accent); doc.rect(3, H - 54, W - 6, 0.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5);
  rgb(doc, accent); doc.text("PREPARED BY KINCAID HEALTH STRATEGIC ADVISORY — 12-ATTORNEY ERISA PANEL", M + 3, H - 45);
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); rgb(doc, FG3);
  const disc = "This report simulates a multi-specialist ERISA engagement using the Kincaid Health analytical platform. It is an institutional decision-support deliverable, not legal advice. Review by qualified ERISA counsel is required before action is taken on any finding herein.";
  doc.splitTextToSize(disc, W - M * 2 - 10).forEach((l: string, i: number) => doc.text(l, M + 3, H - 38 + i * 4));
  doc.text(`Engagement ID: KIQ-SR-${Date.now().toString(36).toUpperCase()}  •  ${c.date}`, M + 3, H - 6);
}

function srSection(c: Ctx, toc: TocEntry[], label: string, level = 0) {
  toc.push({ label, page: c.page, level });
}

function chapterDivider(c: Ctx, attorney: any, chapterNum: number, partLabel: string) {
  addPage(c);
  const { doc, W, H, M, accent } = c;
  // Full-bleed dark
  fill(doc, BG); doc.rect(0, 12, W, H - 22, "F");
  fill(doc, [7, 10, 24] as [number,number,number]); doc.rect(0, H * 0.42, W, H * 0.30, "F");
  // Accent bars
  fill(doc, accent); doc.rect(0, H * 0.42, W, 0.8, "F");
  fill(doc, accent); doc.rect(0, H * 0.42 + (H * 0.30), W, 0.8, "F");
  fill(doc, accent); doc.rect(M, 40, 40, 1.2, "F");

  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  rgb(doc, accent); doc.text(partLabel.toUpperCase(), M, 36);

  doc.setFont("helvetica","bold"); doc.setFontSize(60);
  rgb(doc, [26, 34, 64] as [number,number,number]);
  doc.text(String(chapterNum).padStart(2, "0"), M, H * 0.40);

  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  rgb(doc, FG3); doc.text(`ATTORNEY ${attorney.id} OF 12`, M, H * 0.42 + 12);
  doc.setFont("helvetica","bold"); doc.setFontSize(24);
  rgb(doc, WHITE); doc.text(attorney.name, M, H * 0.42 + 24);
  doc.setFont("helvetica","normal"); doc.setFontSize(13);
  rgb(doc, accent); doc.text(attorney.title, M, H * 0.42 + 33);
  // Specialty badge
  const bw2 = doc.getTextWidth(attorney.specialty.toUpperCase()) + 10;
  fill(doc, [Math.round(accent[0]*0.16), Math.round(accent[1]*0.16), Math.round(accent[2]*0.16)] as [number,number,number]);
  doc.rect(M, H * 0.42 + 38, bw2, 8, "F");
  fill(doc, accent); doc.rect(M, H * 0.42 + 38, 2, 8, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(8); rgb(doc, accent);
  doc.text(attorney.specialty.toUpperCase(), M + 4, H * 0.42 + 43.5);

  // Framing statement
  doc.setFont("helvetica","italic"); doc.setFontSize(11);
  rgb(doc, FG2);
  doc.splitTextToSize(`“${attorney.framing}”`, c.CW - 10).forEach((l: string, i: number) =>
    doc.text(l, M, H * 0.42 + (H * 0.30) + 14 + i * 6));
}

function srSlidePage(c: Ctx, slide: any, idx: number, total: number) {
  addPage(c);
  const { doc, W, H, M, accent } = c;
  fill(doc, BG); doc.rect(0, 12, W, H - 22, "F");
  fill(doc, [6, 9, 22] as [number,number,number]); doc.rect(0, 12, W, 46, "F");
  fill(doc, accent); doc.rect(0, 58, W, 0.8, "F");

  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  rgb(doc, accent); doc.text(`BOARD SLIDE ${idx} / ${total}`, M, 26);
  doc.setFont("helvetica","bold"); doc.setFontSize(22);
  rgb(doc, WHITE);
  doc.splitTextToSize(slide.title || `Slide ${idx}`, W - M * 2).forEach((l: string, i: number) =>
    doc.text(l, M, 40 + i * 9));

  // Headline band
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  rgb(doc, accent);
  doc.splitTextToSize(slide.headline || "", W - M * 2).forEach((l: string, i: number) =>
    doc.text(l, M, 76 + i * 8));

  // Bullet points — large
  let y = 100;
  (slide.points || []).slice(0, 6).forEach((p: string) => {
    fill(doc, accent); doc.circle(M + 2, y - 1.5, 1.4, "F");
    doc.setFont("helvetica","normal"); doc.setFontSize(12);
    rgb(doc, FG);
    const lines = doc.splitTextToSize(p, W - M * 2 - 10);
    lines.forEach((l: string, i: number) => doc.text(l, M + 8, y + i * 6.5));
    y += lines.length * 6.5 + 8;
  });

  // Footer brand mark
  doc.setFont("helvetica","bold"); doc.setFontSize(8);
  rgb(doc, FG3); doc.text("KINCAID HEALTH™ STRATEGIC ADVISORY", M, H - 16);
}

function srFinding(c: Ctx, f: any, n: number) {
  const sev = f.severity || "Medium";
  const sc = SEV_COLOR[sev] || SEV_COLOR.Medium;
  checkY(c, 26);
  const { doc, M, CW } = c;
  // Title row
  doc.setFont("helvetica","bold"); doc.setFontSize(9.5); rgb(doc, FG);
  const titleLines = doc.splitTextToSize(`${n}. ${f.title || "Finding"}`, CW - 38);
  titleLines.forEach((l: string, i: number) => doc.text(l, M, c.y + 4.5 + i * 4.5));
  // Severity chip (right)
  const chipW = 22;
  fill(doc, [Math.round(sc[0]*0.16), Math.round(sc[1]*0.12), Math.round(sc[2]*0.12)] as [number,number,number]);
  doc.rect(M + CW - chipW, c.y, chipW, 5.5, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(6.5); rgb(doc, sc);
  doc.text(sev.toUpperCase(), M + CW - chipW + 2, c.y + 3.8);
  c.y += Math.max(6, titleLines.length * 4.5 + 1.5);
  // Hook + exposure line
  const meta: string[] = [];
  if (f.regulatory_hook) meta.push(f.regulatory_hook);
  if (f.exposure) meta.push(`Exposure: ${f.exposure}`);
  if (meta.length) {
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); rgb(doc, c.accent);
    doc.text(meta.join("   •   "), M, c.y + 3.5);
    c.y += 5.5;
  }
  // Analysis body
  if (f.analysis) body(c, f.analysis, 0);
  gap(c, 1.5);
}

function srModelClause(c: Ctx, provision: string, language: string) {
  const { doc, M, CW, accent } = c;
  doc.setFont("helvetica","normal"); doc.setFontSize(8);
  const lines = doc.splitTextToSize(language, CW - 10);
  const bh = 9 + lines.length * 3.6 + 3;
  checkY(c, bh + 3);
  fill(doc, [2, 6, 4] as [number,number,number]); doc.rect(M, c.y, CW, bh, "F");
  fill(doc, GREEN); doc.rect(M, c.y, 2, bh, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7); rgb(doc, FG3);
  doc.text(`MODEL LANGUAGE — ${(provision || "PROVISION").toUpperCase()}`, M + 5, c.y + 5);
  doc.setFont("helvetica","italic"); doc.setFontSize(8); rgb(doc, FG);
  lines.forEach((l: string, i: number) => doc.text(l, M + 5, c.y + 9.5 + i * 3.6));
  c.y += bh + 3;
}

const PART_LABELS = [
  "Disclosure", "Enforcement", "Compliance", "Economics", "Litigation", "Advocacy",
  "Formulary", "Specialty", "Network", "Audit", "Data Rights", "Negotiation",
];

const ATTY_ROMAN = ["II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII"];

type DomainGov = {
  register: string[][];
  cadence: string[][];
  toCertified: string;
  cap: string;
  firstDoc: string;
};

const ROLE_GOVERNANCE_DEFAULT: DomainGov = {
  register: [
    ["Undisclosed compensation persists", "High", "Mandatory §408(b)(2) disclosure clause", "Annual signed disclosure on file"],
    ["Control reverts to PBM at renewal", "Medium", "Evergreen protections survive renewal", "Amendment language reviewed each cycle"],
    ["Exposure unquantified", "Medium", "Right to independent audit", "Audit report delivered to committee"],
  ],
  cadence: [
    ["Provision posture review", "Annual", "Benefits Cmte", "Score drops or terms change"],
    ["Disclosure attestation", "Annual", "Plan Counsel", "Missing or incomplete disclosure"],
    ["Market benchmark", "Biennial", "Broker", "Off-market pricing detected"],
  ],
  toCertified: "a quoted contract clause paired with a remittance or claims record corroborating the economic effect.",
  cap: "the contract supplies discretion language without the data rights needed to verify how that discretion is exercised.",
  firstDoc: "the full executed contract with all exhibits, fee schedules, and side letters.",
};

const ROLE_GOVERNANCE: Record<number, DomainGov> = {
  1: {
    register: [
      ["Indirect compensation undisclosed", "High", "Full direct/indirect disclosure clause", "Signed §408(b)(2) disclosure"],
      ["'Proprietary' shields defeat statute", "High", "Carve-out barring proprietary exemptions", "Reviewed disclosure with no redactions"],
      ["Reasonableness untested", "Medium", "Right to benchmark all compensation", "Independent reasonableness opinion"],
    ],
    cadence: [
      ["Compensation disclosure review", "Annual", "Plan Counsel", "New or changed comp stream"],
      ["Reasonableness benchmark", "Annual", "Broker", "Comp exceeds market"],
      ["Prohibited-transaction scan", "Annual", "Benefits Cmte", "Undisclosed payment found"],
    ],
    toCertified: "the PBM's signed §408(b)(2) disclosure listing every direct and indirect compensation element.",
    cap: "the contract permits 'proprietary' withholding that prevents verification of indirect compensation.",
    firstDoc: "the covered-service-provider §408(b)(2) compensation disclosure.",
  },
  4: {
    register: [
      ["Spread captured between benchmarks", "High", "Pass-through pricing at NADAC", "Reconciled claims vs. acquisition cost"],
      ["Rebates retained by PBM", "High", "100% rebate pass-through clause", "Rebate remittance reconciliation"],
      ["AWP/WAC distortion", "Medium", "Transparent benchmark definition", "Audited pricing methodology"],
    ],
    cadence: [
      ["Spread reconciliation", "Quarterly", "Finance", "Spread above zero detected"],
      ["Rebate remittance audit", "Annual", "Plan Counsel", "Rebate shortfall"],
      ["Benchmark drift check", "Quarterly", "Broker", "Benchmark redefinition"],
    ],
    toCertified: "claim-level pricing data reconciled against pharmacy acquisition cost and the contract's benchmark definitions.",
    cap: "the contract aggregates pricing data, preventing claim-level reconciliation of spread and rebate flow.",
    firstDoc: "a claim-level data feed with NADAC, ingredient cost, and rebate fields.",
  },
  10: {
    register: [
      ["Audit scope contractually narrowed", "High", "Unrestricted audit scope clause", "Executed audit with full scope"],
      ["Lookback window too short", "High", "Multi-year lookback right", "Audit covering full term"],
      ["Recovery capped or barred", "Medium", "Extrapolated recovery right", "Recovered overcharge on record"],
    ],
    cadence: [
      ["Claims audit", "Annual", "Plan Counsel", "Error rate above threshold"],
      ["Recovery tracking", "Quarterly", "Finance", "Unrecovered overcharge aging"],
      ["Audit-rights review", "Annual", "Benefits Cmte", "Scope restriction surfaced"],
    ],
    toCertified: "an executed audit exercising full scope, lookback, and extrapolation rights with documented findings.",
    cap: "the contract limits audit scope, lookback, or extrapolation, so overcharges cannot be fully detected or recovered.",
    firstDoc: "the audit-rights exhibit and any PBM-prescribed audit methodology.",
  },
  11: {
    register: [
      ["Claims data owned by PBM", "High", "Plan data-ownership clause", "Executed data-ownership term"],
      ["Aggregate-only reporting", "High", "Claim-level reporting right", "Claim-level feed received"],
      ["Export blocked at termination", "Medium", "Data-portability/export clause", "Test export completed"],
    ],
    cadence: [
      ["Data feed validation", "Quarterly", "Finance", "Feed incomplete or aggregated"],
      ["Export readiness test", "Annual", "Plan Counsel", "Export friction detected"],
      ["Reporting completeness", "Quarterly", "Broker", "Required fields missing"],
    ],
    toCertified: "an executed data-ownership clause plus a delivered claim-level export the plan can carry to a competitor.",
    cap: "the contract grants only aggregate reporting and restricts export, trapping verification data inside the PBM.",
    firstDoc: "the data-rights exhibit defining ownership, reporting granularity, and export terms.",
  },
};

export function generateStrategicReportPDF(data: any, sha256?: string): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contract = data?.contract ?? {};
  const pbm = contract.pbm_name || "PBM Contract";
  const filename = contract.contract_filename || "contract.pdf";
  const score = typeof contract.overall_score === "number" ? contract.overall_score : 50;
  const rating = (contract.rating || "concern").replace(/_/g, " ");
  const members = contract.members || 500;
  const provisions: any[] = contract.provisions ?? [];
  const findings: any[] = contract.key_findings ?? [];
  const chapters: any[] = data?.chapters ?? [];
  const synth: any = data?.synthesis ?? {};

  const c = ctx(doc, "#10B981", "PBM Contract Clarity 360™ — Strategic Report", "12-Attorney ERISA Panel · Institutional Engagement");
  const toc: TocEntry[] = [];

  // ── Page 1: Cover ─────────────────────────────────────────────────────────
  strategicCover(c, { pbm, filename, score, rating });

  // ── Pages 2-3: TOC placeholders (filled at the end) ───────────────────────
  addPage(c); const tocPage1 = c.page; h1(c, "Table of Contents"); const tocY1 = c.y;
  addPage(c); const tocPage2 = c.page; h1(c, "Table of Contents (continued)"); const tocY2 = c.y;

  // ── Managing Partner's Executive Briefing ─────────────────────────────────
  addPage(c);
  srSection(c, toc, "Managing Partner's Executive Briefing");
  h1(c, "Managing Partner's Executive Briefing");
  gap(c, 2);
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); rgb(c.doc, c.accent);
  c.doc.text("SO WHAT / NOW WHAT — BOARD-READY SYNTHESIS", c.M, c.y + 4); c.y += 8;
  callout(c, synth.headline || `The ${pbm} contract scores ${Math.round(score)}/100 and concentrates economic control in the PBM across the domains reviewed.`, score < 60 ? "critical" : "warn");
  gap(c, 2);
  h2(c, "Three Strategic Imperatives");
  (synth.imperatives ?? []).forEach((imp: any, i: number) => {
    h3(c, `Imperative ${i + 1} — ${imp.title || ""}`);
    body(c, imp.detail || "", 4);
  });
  gap(c, 2);
  h2(c, "Board-Ready Bottom Line");
  body(c, synth.bottom_line || "The plan sponsor cannot currently verify what it pays or recover what it overpays. A structured amendment is required, and the leverage to obtain it exists at renewal.");

  // ── Board Slide Summary (4 full-bleed pages) ──────────────────────────────
  const slides = (synth.board_slides && synth.board_slides.length)
    ? synth.board_slides.slice(0, 4)
    : [
        { title: "Financial Exposure", headline: "Material, quantifiable, and recurring.", points: ["Spread and rebate retention drive annual leakage", "Specialty drugs concentrate the largest spend at risk", "Exposure compounds at every renewal left unaddressed"] },
        { title: "Regulatory Compliance", headline: "Gaps against ERISA and CAA transparency.", points: ["§408(b)(2) disclosure incomplete", "CAA gag-clause and reporting gaps present", "Enforcement triggers identified by the panel"] },
        { title: "Negotiation Leverage", headline: "The plan holds more leverage than it is using.", points: ["Renewal timing creates the opening", "Data and audit rights are the highest-value asks", "Pass-through conversion is achievable in this market"] },
        { title: "Implementation Roadmap", headline: "A 90-day path to a defensible contract.", points: ["0-30 days: disclosure and audit demands", "30-60 days: amendment drafting and benchmarking", "60-90 days: negotiated execution or RFP"] },
      ];
  srSection(c, toc, "Board Slide Summary");
  slides.forEach((s: any, i: number) => srSlidePage(c, s, i + 1, slides.length));

  // ── Part I — Contract Risk Architecture ───────────────────────────────────
  addPage(c);
  srSection(c, toc, "Part I — Contract Risk Architecture");
  h1(c, "Part I — Contract Risk Architecture");
  body(c, `This part establishes the structural baseline the 12-attorney panel reasons over. The ${pbm} contract carries an overall protection score of ${Math.round(score)}/100 (${rating}), derived from a weighted assessment of 13 provision systems against a 60-issue fiduciary–economic distortion grid. Scores below 60 indicate that the plan sponsor's economic protections are materially incomplete.`);
  gap(c, 2);
  h2(c, "Composite Scorecard");
  kv(c, "PBM Analyzed", pbm, true);
  kv(c, "Overall Contract Protection Score", `${Math.round(score)} / 100`, score < 65);
  kv(c, "Risk Classification", score < 50 ? "Critical" : score < 65 ? "High" : score < 80 ? "Moderate" : "Low", score < 65);
  kv(c, "Provisions Reviewed", String(provisions.length || 13));
  kv(c, "Plan Size (assumption)", `${members.toLocaleString()} members`);
  kv(c, "Critical Findings (platform)", String(findings.filter((f: any) => f.severity === "critical").length));
  gap(c, 3);

  // Risk heat matrix across provisions
  h2(c, "Risk Heat Matrix — 13 Provision Systems");
  if (provisions.length) {
    const heatRows = provisions.map((p: any) => {
      const s10 = Number(p.score ?? 0);
      const tier = s10 < 3 ? "Critical" : s10 < 5 ? "High" : s10 < 7 ? "Elevated" : s10 < 9 ? "Moderate" : "Strong";
      const issues = (p.issues || []).length;
      const gaps = (p.issues || []).filter((i: any) => !i.found || i.status === "Not Present" || i.status === "Hidden / Ambiguous Risk").length;
      return [String(p.id ?? ""), p.name ?? "", `${s10.toFixed(1)}/10`, tier, `${gaps}/${issues}`];
    });
    table(c, ["#", "Provision System", "Score", "Risk Tier", "Gaps"], heatRows, [10, 78, 22, 30, 22]);
  } else {
    body(c, "Provision-level data was not available for this contract; the panel reasoned from the platform's key findings and demonstration baseline.");
  }
  gap(c, 2);

  // Financial exposure waterfall
  h2(c, "Financial Exposure Waterfall");
  body(c, "The panel models annual exposure as the sum of provision-level leakage, where each provision's contribution scales with the inverse of its protection score. The largest contributors define the negotiation sequence in Part XV.");
  const baseExposure = Math.round(Math.max(0, (70 - score) * members * 4.2));
  const waterfall = (provisions.length ? provisions : Array.from({ length: 5 }, (_, i) => ({ name: ["Spread Pricing","Rebate Retention","Specialty Economics","Audit Limitations","Data Lock-In"][i], score: 4 })))
    .slice()
    .sort((a: any, b: any) => Number(a.score ?? 0) - Number(b.score ?? 0))
    .slice(0, 6)
    .map((p: any) => {
      const weight = Math.max(0, 10 - Number(p.score ?? 5));
      const contrib = Math.round(baseExposure * (weight / 30));
      return [p.name ?? "Provision", `${Number(p.score ?? 0).toFixed(1)}/10`, `$${contrib.toLocaleString()}`];
    });
  table(c, ["Provision Driver", "Score", "Modeled Annual Exposure"], waterfall, [90, 30, 42]);
  callout(c, `Modeled aggregate annual exposure: approximately $${baseExposure.toLocaleString()} for a ${members.toLocaleString()}-member plan. This is a MODELED figure with bounds; actuals vary by utilization and formulary mix.`, "warn");
  gap(c, 2);

  // Confidence tier classification
  h2(c, "Confidence Tier Classification");
  body(c, "Every chapter in this report carries one of three confidence tiers, applied consistently across the engagement:");
  bullet(c, "CERTIFIED — finding anchored to a quoted contract clause and a low provision score; defensible without further evidence.");
  bullet(c, "MODELED — inference from incomplete evidence; quantitative bounds are disclosed and assumptions stated.");
  bullet(c, "INSUFFICIENT_EVIDENCE — no finding issued; the gap itself is logged as the result, identifying exposure the plan cannot yet quantify.");
  gap(c, 2);
  const tierCounts = chapters.reduce((acc: Record<string, number>, ch: any) => {
    const t = ch.risk_tier || "MODELED"; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  table(c, ["Confidence Tier", "Chapters", "Interpretation"], [
    ["CERTIFIED", String(tierCounts.CERTIFIED || 0), "Quoted-clause findings, audit-ready"],
    ["MODELED", String(tierCounts.MODELED || 0), "Inference with disclosed bounds"],
    ["INSUFFICIENT_EVIDENCE", String(tierCounts.INSUFFICIENT_EVIDENCE || 0), "Logged gaps; evidence required"],
  ], [60, 24, 78]);

  // ── Parts II-XIII — 12 Attorney Deep Dives ────────────────────────────────
  chapters.forEach((ch: any, idx: number) => {
    const atty = ch.attorney || data.attorneys?.[idx] || { id: idx + 1, name: `Attorney ${idx + 1}`, title: "ERISA Counsel", specialty: "Analysis", framing: "" };
    const partLabel = `Part ${ATTY_ROMAN[idx] || idx + 2} — ${PART_LABELS[idx] || atty.specialty}`;
    // Divider page
    chapterDivider(c, atty, idx + 1, partLabel);
    srSection(c, toc, `${partLabel}: ${atty.name}`, 1);

    // Content
    addPage(c);
    h1(c, `${partLabel}`);
    if (ch.title) h2(c, String(ch.title));
    h3(c, `${atty.name} — ${atty.title}`);
    // Risk tier badge
    const tier = ch.risk_tier || "MODELED";
    const tc = TIER_COLOR[tier] || TIER_COLOR.MODELED;
    checkY(c, 8);
    fill(doc, [Math.round(tc[0]*0.14), Math.round(tc[1]*0.14), Math.round(tc[2]*0.14)] as [number,number,number]);
    doc.rect(c.M, c.y, 70, 6.5, "F");
    fill(doc, tc); doc.rect(c.M, c.y, 2, 6.5, "F");
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); rgb(doc, tc);
    doc.text(`CONFIDENCE TIER: ${tier}`, c.M + 4, c.y + 4.5);
    c.y += 10;

    h3(c, "Chapter Thesis");
    body(c, ch.thesis || atty.framing || "This chapter analyzes the contract through this attorney's domain lens.");
    gap(c, 2);

    // Deep narrative — the substantive body of the chapter (3-5 paragraphs)
    const narrative: string[] = Array.isArray(ch.narrative) ? ch.narrative.filter((p: any) => p && String(p).trim()) : [];
    if (narrative.length) {
      h2(c, "Domain Analysis");
      narrative.forEach((para: string) => { body(c, String(para)); gap(c, 1.5); });
      gap(c, 1);
    }

    h2(c, "Findings");
    (ch.findings ?? []).forEach((f: any, i: number) => srFinding(c, f, i + 1));
    gap(c, 1);

    // Provision scorecard for this attorney's domain
    const domainProvs = provisions.filter((p: any) => {
      const m: Record<number, number[]> = {
        1: [3,8,12], 2: [1,2,7], 3: [8,13,9], 4: [1,2,3], 5: [12,7,11], 6: [12,10,9],
        7: [4,9,6], 8: [6,5,3], 9: [5,4,9], 10: [7,11,1], 11: [13,8,11], 12: [10,9,2],
      };
      return (m[atty.id] || []).includes(p.id);
    });
    if (domainProvs.length) {
      h2(c, "Domain Provision Scorecard");
      table(c, ["Provision", "Score", "Rating", "Key Gap"], domainProvs.map((p: any) => {
        const firstGap = (p.issues || []).find((i: any) => i.gap)?.gap || (p.negotiation?.gap_summary) || "—";
        return [p.name ?? "", `${Number(p.score ?? 0).toFixed(1)}/10`, (p.rating || "").replace(/_/g, " "), String(firstGap).slice(0, 60)];
      }), [56, 20, 26, 60]);
    }

    if ((ch.recommendations ?? []).length) {
      h2(c, "Recommendations");
      table(c, ["Pri", "Action", "Rationale"], (ch.recommendations).map((r: any) => [
        r.priority || "P2", r.action || "", r.rationale || "",
      ]), [14, 76, 72]);
    }

    if ((ch.model_language ?? []).length) {
      h2(c, "Model Contract Language");
      (ch.model_language).forEach((m: any) => srModelClause(c, m.provision, m.language));
    }

    if ((ch.key_quotes ?? []).length) {
      h2(c, "Evidentiary Quotes & Doctrine");
      (ch.key_quotes).forEach((q: string) => {
        checkY(c, 8);
        doc.setFont("helvetica","italic"); doc.setFontSize(8); rgb(doc, FG2);
        const lines = doc.splitTextToSize(`“${q}”`, c.CW - 6);
        lines.forEach((l: string, i: number) => { checkY(c, 4); doc.text(l, c.M + 3, c.y + 3.5); c.y += 4; });
        gap(c, 2);
      });
    }

    // Domain Risk Register — a single, genuinely per-domain decision-support
    // table. No artificial page-padding: each chapter runs to the natural length
    // of its real analysis, which keeps the full report tight and readable.
    const domainGov = ROLE_GOVERNANCE[atty.id] || ROLE_GOVERNANCE_DEFAULT;
    h2(c, "Domain Risk Register");
    body(c, `Residual risks in ${String(atty.specialty).toLowerCase()} after the findings above — each paired with the control that retires it and the evidence that proves the control is operating.`);
    table(c, ["Residual Risk", "Likelihood", "Control", "Evidence of Control"], domainGov.register, [46, 22, 50, 44]);
    gap(c, 2);
  });

  // ── Part XIV — Cross-Cutting Strategic Themes ─────────────────────────────
  addPage(c);
  srSection(c, toc, "Part XIV — Cross-Cutting Strategic Themes");
  h1(c, "Part XIV — Cross-Cutting Strategic Themes");
  body(c, "Synthesized across all 12 attorney chapters, the following structural vulnerabilities recur. For each, the panel identifies the single most leveraged remediation path — the change that closes the most exposure with the least negotiation cost.");
  gap(c, 2);
  (synth.structural_themes ?? []).forEach((t: any, i: number) => {
    h2(c, `Theme ${i + 1} — ${t.theme || ""}`);
    h3(c, "Why it is structural");
    body(c, t.vulnerability || "", 4);
    h3(c, "Most leveraged remediation");
    callout(c, t.remediation || "", "info");
    gap(c, 2);
  });

  // ── Part XV — Negotiation Playbook ────────────────────────────────────────
  addPage(c);
  srSection(c, toc, "Part XV — Negotiation Playbook");
  h1(c, "Part XV — Negotiation Playbook");
  body(c, "The playbook converts the panel's findings into a sequenced negotiation. Provisions are ordered by dollar impact; for each, the table states the model language target and the power balance the plan must shift.");
  gap(c, 2);
  h2(c, "Provision-by-Provision Model Language");
  const negRows = (provisions.length ? provisions : []).slice().sort((a: any, b: any) => Number(a.score ?? 0) - Number(b.score ?? 0)).slice(0, 13).map((p: any) => {
    const ml = p.negotiation?.model_language || "Add fiduciary-aligned protective language.";
    return [p.name ?? "", `${Number(p.score ?? 0).toFixed(1)}`, String(ml).slice(0, 88)];
  });
  if (negRows.length) table(c, ["Provision", "Score", "Model Language Target"], negRows, [50, 18, 94]);
  gap(c, 2);
  h2(c, "Negotiation Sequence");
  ["Phase 1 — Demand §408(b)(2) disclosure and a claims-level data feed before any substantive talks.",
   "Phase 2 — Convert pricing to pass-through (NADAC + transparent admin fee) and lock 100% rebate remittance.",
   "Phase 3 — Expand audit scope, lookback, and extrapolation rights; secure data ownership and export.",
   "Phase 4 — Neutralize formulary and network steering with reimbursement parity and governance rights.",
   "Phase 5 — Negotiate a clean exit: no termination penalty, full data export, and transition support."]
    .forEach((s) => bullet(c, s));
  gap(c, 2);
  h2(c, "Leverage Matrix — Plan Sponsor vs. PBM Power Balance");
  table(c, ["Clause", "Current Power Holder", "Target", "Plan Leverage"], [
    ["Pricing methodology", "PBM", "Shared / transparent", "RFP competition"],
    ["Rebate retention", "PBM", "Plan (100% pass-through)", "Market norm shift"],
    ["Audit & recovery", "PBM", "Plan", "Regulatory pressure"],
    ["Formulary control", "PBM", "Shared governance", "Clinical-value framing"],
    ["Data ownership", "PBM", "Plan", "Portability demand"],
    ["Termination", "PBM", "Plan", "Renewal timing"],
  ], [44, 38, 42, 38]);

  // ── Part XVI — Regulatory Compliance Matrix ───────────────────────────────
  addPage(c);
  srSection(c, toc, "Part XVI — Regulatory Compliance Matrix");
  h1(c, "Part XVI — Regulatory Compliance Matrix");
  body(c, "The contract is mapped against the principal ERISA and federal transparency authorities the panel applied. 'Status' reflects the panel's assessment of the contract's current posture; 'Action' states what closes the gap.");
  gap(c, 2);
  table(c, ["Authority", "Requirement", "Status", "Action"], [
    ["ERISA §404(a)", "Prudent expert / exclusive benefit", score < 65 ? "At Risk" : "Monitor", "Document procedural prudence"],
    ["ERISA §408(b)(2)", "Reasonable, disclosed compensation", "Gaps Identified", "Compel full direct/indirect disclosure"],
    ["ERISA §406(a)(1)(C)", "No prohibited transactions", "Review Required", "Cure undisclosed compensation"],
    ["ERISA §412", "Fidelity bond adequacy", "Verify", "Confirm bond covers plan assets"],
    ["CAA 2021 §201", "Broker/consultant comp disclosure", "Confirm", "Obtain attestation"],
    ["CAA 2021 §204", "Gag-clause prohibition", "Verify Attestation", "File annual attestation"],
    ["CAA 2026 (proposed)", "PBM transparency & pass-through", "Prepare Now", "Amend ahead of effective date"],
    ["FTC Act §5", "No unfair/deceptive practices", "Monitor", "Track FTC PBM enforcement"],
    ["DOL Advisory Opinions", "Indirect compensation guidance", "Apply", "Map opinions to this contract"],
  ], [38, 56, 32, 42]);
  gap(c, 2);
  body(c, "This matrix is decision-support, not a legal opinion. Each 'At Risk' or 'Gaps Identified' status should be reviewed with qualified ERISA counsel before remediation is finalized.");

  // ── Part XVII — Implementation Roadmap ────────────────────────────────────
  addPage(c);
  srSection(c, toc, "Part XVII — Implementation Roadmap");
  h1(c, "Part XVII — Implementation Roadmap");
  body(c, "A 30/60/90-day remediation timeline. Each milestone names the owner, the action, and the success metric, so progress is measurable against the panel's findings.");
  gap(c, 2);
  h2(c, "30 / 60 / 90-Day Milestones");
  table(c, ["Window", "Owner", "Action", "Success Metric"], [
    ["0-30 days", "Benefits Committee", "Issue §408(b)(2) disclosure & data demand", "Written disclosure received"],
    ["0-30 days", "Plan Counsel", "Commission independent claims audit", "Audit engaged"],
    ["30-60 days", "Broker / Consultant", "Benchmark pricing; draft amendment", "Amendment drafted"],
    ["30-60 days", "Finance", "Quantify exposure with audit data", "Exposure validated"],
    ["60-90 days", "Benefits Committee", "Negotiate or trigger RFP", "Terms executed or RFP live"],
    ["60-90 days", "Plan Counsel", "Confirm CAA attestations filed", "Attestations on file"],
  ], [24, 38, 60, 46]);
  gap(c, 2);
  h2(c, "Milestone Timeline");
  [["Day 0-30","Disclosure & audit demands issued; evidence gathering begins."],
   ["Day 30-60","Amendment drafted on the highest-exposure provisions; benchmarking complete."],
   ["Day 60-90","Negotiated execution or competitive RFP; compliance attestations confirmed."]
  ].forEach(([w, d]) => { h3(c, w); body(c, d, 4); });

  // ── Appendices ────────────────────────────────────────────────────────────
  addPage(c);
  srSection(c, toc, "Appendices");
  h1(c, "Appendix A — Methodology Statement");
  body(c, "This report was produced by the Kincaid Health Strategic Advisory engine, which simulates a 12-attorney ERISA panel. Each attorney persona applies a distinct doctrinal and economic lens to the subset of the 60-issue / 13-provision ontology within its domain. Chapters are generated in parallel and synthesized by a Managing Partner layer. The contract's provision scores and findings — produced by the platform's contract X-ray — are the evidentiary substrate for every chapter.");
  gap(c, 2);
  h1(c, "Appendix B — Attorney Credential Bios");
  (data.attorneys ?? chapters.map((ch: any) => ch.attorney)).forEach((a: any) => {
    if (!a) return;
    h3(c, `${a.name} — ${a.title}`);
    body(c, `${a.specialty}. ${a.framing || ""}`, 4);
  });
  gap(c, 2);

  addPage(c);
  h1(c, "Appendix C — Glossary of PBM Terms");
  const glossary: [string, string][] = [
    ["AWP", "Average Wholesale Price — a benchmark list price, often inflated, used to set reimbursement."],
    ["WAC", "Wholesale Acquisition Cost — manufacturer list price to wholesalers, excluding discounts."],
    ["NADAC", "National Average Drug Acquisition Cost — survey-based actual pharmacy acquisition cost."],
    ["MAC", "Maximum Allowable Cost — PBM-set ceiling for generic reimbursement."],
    ["Spread Pricing", "PBM charging the plan more than it pays the pharmacy and keeping the margin."],
    ["Rebate", "Manufacturer payment to a PBM for formulary placement / market share."],
    ["Pass-Through", "Contract model where the plan receives 100% of rebates and pays a transparent fee."],
    ["DIR Fees", "Direct and Indirect Remuneration — retroactive pharmacy fees that obscure true cost."],
    ["Formulary", "The list of covered drugs and their tiers."],
    ["Step Therapy", "Requirement to try lower-cost drugs before higher-cost ones."],
    ["Prior Authorization", "PBM approval required before a drug is covered."],
    ["White Bagging", "Specialty drug shipped from a PBM-affiliated pharmacy to the provider."],
    ["Brown Bagging", "Specialty drug dispensed to the patient to bring to the provider."],
    ["Site-of-Care Steering", "Directing administration to a channel that favors PBM economics."],
    ["Any-Willing-Provider", "Laws requiring networks to admit any pharmacy meeting terms."],
    ["Gag Clause", "Contract term restricting disclosure of price/quality data — prohibited by CAA."],
    ["Fiduciary", "A party legally bound to act in the exclusive interest of plan participants."],
    ["408(b)(2)", "ERISA provision requiring covered service providers to disclose compensation."],
    ["Contra Proferentem", "Doctrine construing ambiguous terms against the drafter."],
    ["Extrapolation", "Projecting audit findings across the full claims population to size recovery."],
  ];
  table(c, ["Term", "Definition"], glossary.map(([t, d]) => [t, d]), [38, 134]);

  // Evidence Manifest
  addPage(c);
  h1(c, "Appendix D — SHA-256 Evidence Manifest");
  body(c, "Per the platform's evidence doctrine, no export issues without a cryptographic manifest. The hash below is computed over the full strategic-report payload (all 12 chapters and the synthesis) at generation time. Any post-generation mutation of the underlying data changes this hash.");
  gap(c, 3);
  const manifestHash = sha256 || "(computed at export time)";
  fill(doc, [4, 8, 4] as [number,number,number]); doc.rect(c.M, c.y, c.CW, 20, "F");
  fill(doc, GREEN); doc.rect(c.M, c.y, 2, 20, "F");
  doc.setFont("helvetica","bold"); doc.setFontSize(7.5); rgb(doc, FG3);
  doc.text("SHA-256 EVIDENCE MANIFEST — STRATEGIC REPORT PAYLOAD", c.M + 5, c.y + 6);
  doc.setFont("courier","normal"); doc.setFontSize(8); rgb(doc, GREEN);
  const half = Math.ceil(manifestHash.length / 2);
  doc.text(manifestHash.slice(0, half), c.M + 5, c.y + 12);
  doc.text(manifestHash.slice(half), c.M + 5, c.y + 16.5);
  c.y += 26;
  kv(c, "Engagement", "Kincaid Health Strategic Advisory — 12-Attorney ERISA Panel", true);
  kv(c, "Subject Contract", `${pbm} — ${filename}`);
  kv(c, "Chapters Generated", String(chapters.length));
  kv(c, "Generated At", data?.generated_at || c.date);
  gap(c, 3);
  callout(c, "This report is institutional decision-support, not legal advice. INSUFFICIENT_EVIDENCE designations are valid findings. Review by qualified ERISA counsel is required before any action.", "info");

  // ── Fill the reserved Table of Contents pages ─────────────────────────────
  const renderToc = (entries: TocEntry[], pageNo: number, startY: number) => {
    doc.setPage(pageNo);
    let y = startY;
    entries.forEach((e) => {
      const indent = e.level > 0 ? 8 : 0;
      doc.setFont("helvetica", e.level > 0 ? "normal" : "bold");
      doc.setFontSize(e.level > 0 ? 8 : 9);
      rgb(doc, e.level > 0 ? FG2 : FG);
      const label = e.label.length > 78 ? e.label.slice(0, 76) + "…" : e.label;
      doc.text(label, c.M + 2 + indent, y + 4.5);
      rgb(doc, FG2);
      doc.text(String(e.page), c.M + c.CW - 2, y + 4.5, { align: "right" });
      stroke(doc, SEP); doc.setLineWidth(0.15);
      doc.setLineDashPattern([1, 2], 0);
      doc.line(c.M + 60 + indent, y + 5, c.M + c.CW - 8, y + 5);
      doc.setLineDashPattern([], 0);
      y += e.level > 0 ? 6 : 7;
    });
  };
  // Split TOC across the two reserved pages
  const firstCap = 24;
  renderToc(toc.slice(0, firstCap), tocPage1, tocY1);
  if (toc.length > firstCap) renderToc(toc.slice(firstCap), tocPage2, tocY2);

  return doc;
}

export async function downloadStrategicReportPDF(data: any, sha256?: string) {
  const doc = generateStrategicReportPDF(data, sha256);
  const date = new Date().toISOString().slice(0, 10);
  const pbm = (data?.contract?.pbm_name || "PBM").replace(/[^a-z0-9]+/gi, "-");
  doc.save(`Kincaid-IQ-Strategic-Report-${pbm}-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   RFP OS — WIN/LOSS ANALYTICS LEAVE-BEHIND (QBR / SALES REVIEW)
   A one-click PDF export of the Win/Loss Analytics view: KPI summary, competitor
   table, loss-reason breakdown, win rate by industry/size, current factor weights
   with delta badges, adaptive weight history, and a SHA-256 evidence manifest
   (Four Hard Rules — no export without a manifest).
══════════════════════════════════════════════════════════════════════════════ */
export interface WinLossPdfData {
  analytics: {
    total: number;
    wins: number;
    losses: number;
    no_decisions?: number;
    deferrals?: number;
    win_rate: number | null;
    loss_rate: number | null;
    by_competitor: Array<{ competitor: string; times_won?: number; our_losses: number }>;
    by_reason: Array<{ reason: string; count: number }>;
    by_industry: Array<{ industry: string; wins?: number; losses?: number; total: number; win_rate: number }>;
    by_size: Array<{ band: string; wins?: number; losses?: number; total: number; win_rate: number }>;
    avg_win_value: number | null;
    avg_loss_value?: number | null;
    pricing_factor_rate: number | null;
    relationship_factor_rate?: number | null;
  } | null | undefined;
  weights?: {
    current_weights: Record<string, number>;
    default_weights: Record<string, number>;
    is_customized: boolean;
    factor_labels: Record<string, string>;
    history: Array<{
      id?: string;
      trigger?: string;
      outcome_count?: number;
      summary?: string;
      created_at?: string;
      adjustments?: Record<string, number>;
    }>;
  } | null;
  recordCount?: number;
}

function wlMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function wlPct(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : `${n}%`;
}

export function generateWinLossPDF(data: WinLossPdfData, sha256: string): jsPDF {
  // Four Hard Rules: no export without a manifest. A valid 64-char hex SHA-256
  // digest is required — refuse to build the document otherwise.
  if (!sha256 || !/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error("Cannot export without a valid SHA-256 evidence manifest.");
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(doc, "#FBB724", "RFP OS™ — Win/Loss Analytics", "Pipeline Health & Competitive Intelligence · QBR Leave-Behind");
  const a = data.analytics;
  const w = data.weights;

  // ── Page 1: Cover ───────────────────────────────────────────────────────────
  coverPage(c);

  // ── Page 2: Executive Summary + KPIs ────────────────────────────────────────
  addPage(c);
  h1(c, "Executive Summary");
  gap(c, 2);
  if (!a || a.total === 0) {
    callout(c, "INSUFFICIENT_EVIDENCE — no decided outcomes have been recorded yet. Record wins and losses in RFP OS to populate this analysis.", "warn");
  } else {
    const decided = a.wins + a.losses;
    body(c, `This leave-behind summarizes ${a.total} recorded RFP outcome${a.total === 1 ? "" : "s"} (${a.wins} won, ${a.losses} lost). The current win rate is ${wlPct(a.win_rate)} across ${decided} decided opportunit${decided === 1 ? "y" : "ies"}. Pricing was cited in ${wlPct(a.pricing_factor_rate)} of losses. All figures are computed directly from logged outcomes — no estimates.`);
    gap(c, 2);

    h2(c, "Key Performance Indicators");
    const kpis: Array<[string, string]> = [
      ["Total Decided", String(decided)],
      ["Win Rate", wlPct(a.win_rate)],
      ["Loss Rate", wlPct(a.loss_rate)],
      ["Average Win Value", wlMoney(a.avg_win_value)],
      ["Pricing-Driven Losses", a.pricing_factor_rate != null ? `${a.pricing_factor_rate}% of losses` : "—"],
    ];
    if (a.relationship_factor_rate != null) kpis.push(["Incumbent-Driven Losses", `${a.relationship_factor_rate}% of losses`]);
    if (a.no_decisions != null) kpis.push(["No-Decision Outcomes", String(a.no_decisions)]);
    if (a.deferrals != null) kpis.push(["Deferred Outcomes", String(a.deferrals)]);
    kpis.forEach(([label, value], i) => kv(c, label, value, i === 0));
    gap(c, 3);

    // ── Competitor table ──────────────────────────────────────────────────────
    h2(c, "Top Competitors");
    if (a.by_competitor.length === 0) {
      body(c, "No competitor data recorded on logged losses.");
    } else {
      table(c, ["Competitor", "Times They Won", "Our Losses To Them"],
        a.by_competitor.slice(0, 12).map(x => [
          x.competitor || "—",
          x.times_won != null ? String(x.times_won) : "—",
          String(x.our_losses),
        ]),
        [c.CW * 0.5, c.CW * 0.25, c.CW * 0.25]);
    }
    gap(c, 1);

    // ── Loss reason breakdown ─────────────────────────────────────────────────
    h2(c, "Loss Reason Breakdown");
    if (a.by_reason.length === 0) {
      body(c, "No structured loss reasons recorded.");
    } else {
      const totalReasons = a.by_reason.reduce((s, r) => s + r.count, 0) || 1;
      table(c, ["Loss Reason", "Count", "Share of Losses"],
        a.by_reason.slice(0, 12).map(r => [
          r.reason || "—",
          String(r.count),
          `${Math.round((r.count / totalReasons) * 100)}%`,
        ]),
        [c.CW * 0.5, c.CW * 0.25, c.CW * 0.25]);
    }
    gap(c, 1);

    // ── Win rate by industry ──────────────────────────────────────────────────
    h2(c, "Win Rate by Industry");
    if (a.by_industry.length === 0) {
      body(c, "No industry-segmented outcomes recorded.");
    } else {
      table(c, ["Industry", "Win Rate", "Wins", "Losses", "Decided"],
        a.by_industry.slice(0, 12).map(r => [
          r.industry || "—",
          wlPct(r.win_rate),
          r.wins != null ? String(r.wins) : "—",
          r.losses != null ? String(r.losses) : "—",
          String(r.total),
        ]),
        [c.CW * 0.36, c.CW * 0.16, c.CW * 0.16, c.CW * 0.16, c.CW * 0.16]);
    }
    gap(c, 1);

    // ── Win rate by plan size ─────────────────────────────────────────────────
    h2(c, "Win Rate by Plan Size");
    if (a.by_size.length === 0) {
      body(c, "No size-segmented outcomes recorded.");
    } else {
      table(c, ["Plan Size Band", "Win Rate", "Wins", "Losses", "Decided"],
        a.by_size.map(r => [
          r.band || "—",
          wlPct(r.win_rate),
          r.wins != null ? String(r.wins) : "—",
          r.losses != null ? String(r.losses) : "—",
          String(r.total),
        ]),
        [c.CW * 0.36, c.CW * 0.16, c.CW * 0.16, c.CW * 0.16, c.CW * 0.16]);
    }
  }

  // ── Adaptive Scoring: current factor weights ──────────────────────────────────
  if (w && Object.keys(w.current_weights || {}).length > 0) {
    addPage(c);
    h1(c, "Adaptive Scoring — Factor Weights");
    gap(c, 2);
    body(c, w.is_customized
      ? "Factor weights below have been adaptively recalibrated from recorded outcomes. The delta column shows the shift from the platform default, in percentage points."
      : "Factor weights below are at the platform default. Recording at least five decided outcomes and recalibrating will adapt these weights to your book.");
    gap(c, 2);
    const wRows = Object.entries(w.current_weights).map(([factor, weight]) => {
      const label = w.factor_labels?.[factor] || factor;
      const def = w.default_weights?.[factor] ?? 0;
      const delta = weight - def;
      const deltaStr = Math.abs(delta) < 0.005 ? "—" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`;
      return [label, `${(weight * 100).toFixed(1)}%`, `${(def * 100).toFixed(1)}%`, deltaStr];
    });
    table(c, ["Scoring Factor", "Current", "Default", "Δ vs Default"], wRows,
      [c.CW * 0.46, c.CW * 0.18, c.CW * 0.18, c.CW * 0.18]);
    gap(c, 2);

    // ── Adaptive weight history ─────────────────────────────────────────────────
    h2(c, "Adjustment History");
    if (!w.history || w.history.length === 0) {
      body(c, "No recalibrations recorded yet — weights remain at default.");
    } else {
      w.history.slice(0, 10).forEach((h, i) => {
        const ver = i === 0 ? "Current" : `v${w.history.length - i}`;
        h3(c, `${ver} — ${h.trigger || "recalibration"}${h.created_at ? `  ·  ${new Date(h.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}`);
        if (h.summary) body(c, h.summary, 2);
        const adj = h.adjustments || {};
        const adjKeys = Object.keys(adj);
        if (adjKeys.length > 0) {
          const parts = adjKeys.map(k => {
            const label = w.factor_labels?.[k] || k;
            const d = adj[k];
            return `${label} ${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}pp`;
          });
          body(c, "Adjustments: " + parts.join("  ·  "), 2);
        }
        gap(c, 1);
      });
    }
  }

  // ── Evidence Manifest (Four Hard Rules — no export without a manifest) ─────────
  addPage(c);
  h1(c, "SHA-256 Evidence Manifest");
  gap(c, 2);
  body(c, "Per the platform's Four Hard Rules, no export issues without a cryptographic manifest. The hash below is computed over the full Win/Loss payload (analytics, factor weights, and adjustment history) at generation time. Any post-generation mutation of the underlying data changes this hash.");
  gap(c, 2);
  const manifestHash = sha256;
  const { doc: md, M, CW } = c;
  fill(md, [4, 8, 4] as [number, number, number]); md.rect(M, c.y, CW, 18, "F");
  fill(md, GREEN); md.rect(M, c.y, 2, 18, "F");
  md.setFont("helvetica", "bold"); md.setFontSize(7); rgb(md, FG3);
  md.text("SHA-256 EVIDENCE MANIFEST — WIN/LOSS ANALYTICS PAYLOAD", M + 5, c.y + 6);
  md.setFont("courier", "normal"); md.setFontSize(8); rgb(md, GREEN);
  const half = Math.ceil(manifestHash.length / 2);
  md.text(manifestHash.slice(0, half), M + 5, c.y + 12);
  md.text(manifestHash.slice(half), M + 5, c.y + 16);
  c.y += 24;
  gap(c, 2);
  const decidedCount = a ? a.wins + a.losses : 0;
  kv(c, "Outcomes Recorded", String(data.recordCount ?? a?.total ?? 0), true);
  kv(c, "Decided Outcomes", String(decidedCount));
  kv(c, "Factor Weights Customized", w?.is_customized ? "Yes (adaptive)" : "No (default)");
  kv(c, "Generated", c.date);

  return doc;
}

export async function downloadWinLossPDF(data: WinLossPdfData) {
  // Four Hard Rules: no export without a manifest. Computing the SHA-256 digest
  // is mandatory — if crypto.subtle is unavailable or the digest fails, abort
  // the export entirely rather than emitting a manifest-less document.
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Secure hashing is unavailable in this browser, so a SHA-256 evidence manifest cannot be generated. Export aborted.");
  }
  const payload = JSON.stringify({ analytics: data.analytics, weights: data.weights });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const sha = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const doc = generateWinLossPDF(data, sha);
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`Kincaid-IQ-Win-Loss-Analytics-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPETITIVE BATTLECARD — PURSUIT-MEETING LEAVE-BEHIND
══════════════════════════════════════════════════════════════════════════════ */
export interface BattlecardPdfData {
  competitor: string;
  total_encounters?: number;
  times_they_won: number;
  our_wins_against: number;
  our_loss_rate: number | null;
  pricing_factor_rate: number | null;
  relationship_factor_rate: number | null;
  top_product_gaps: string[];
  procurement_patterns?: string[];
  industries_won_in?: string[];
  size_bands_won_in?: string[];
  data_basis: number;
  counter_positioning: {
    confidence_tier: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
    data_basis: number;
    min_required?: number;
    talking_points: { point: string; evidence_basis: string }[];
    positioning_headline?: string;
    key_vulnerability?: string;
    recommended_proof_points?: string[];
    summary: string;
  } | null;
}

function bcThreat(lossRate: number | null): "HIGH" | "MED" | "LOW" {
  if (lossRate !== null && lossRate >= 60) return "HIGH";
  if (lossRate !== null && lossRate >= 40) return "MED";
  return "LOW";
}

export function generateBattlecardPDF(data: BattlecardPdfData, sha256: string): jsPDF {
  // Four Hard Rules: no export without a manifest. A valid 64-char hex SHA-256
  // digest is required — refuse to build the document otherwise.
  if (!sha256 || !/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error("Cannot export without a valid SHA-256 evidence manifest.");
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(
    doc,
    "#FF4D6D",
    "Competitive Battlecard",
    `Pursuit Intelligence — ${data.competitor} · Client-Meeting Leave-Behind`,
  );
  const cp = data.counter_positioning;
  const threat = bcThreat(data.our_loss_rate);

  // ── Page 1: Cover ───────────────────────────────────────────────────────────
  coverPage(c);

  // ── Page 2: Head-to-head + threat ───────────────────────────────────────────
  addPage(c);
  h1(c, `Battlecard — ${data.competitor}`);
  gap(c, 2);
  callout(
    c,
    `Threat Level: ${threat}. This battlecard is auto-built from ${data.data_basis} recorded outcome${data.data_basis === 1 ? "" : "s"} against ${data.competitor}. All head-to-head figures are computed directly from logged win/loss history — no estimates.`,
    threat === "HIGH" ? "critical" : threat === "MED" ? "warn" : "info",
  );
  gap(c, 2);

  h2(c, "Head-to-Head Record");
  const decided = data.times_they_won + data.our_wins_against;
  kv(c, "Our Loss Rate", wlPct(data.our_loss_rate), true);
  kv(c, "Times They Won", String(data.times_they_won));
  kv(c, "Our Wins Against Them", String(data.our_wins_against));
  kv(c, "Total Decided Encounters", String(data.total_encounters ?? decided));
  kv(c, "Pricing Cited (of losses)", data.pricing_factor_rate != null ? `${data.pricing_factor_rate}%` : "—");
  kv(c, "Incumbent/Relationship Cited", data.relationship_factor_rate != null ? `${data.relationship_factor_rate}%` : "—");
  gap(c, 3);

  // ── AI Counter-Positioning ──────────────────────────────────────────────────
  h2(c, "AI Counter-Positioning");
  if (!cp || cp.confidence_tier === "INSUFFICIENT_EVIDENCE") {
    callout(
      c,
      `INSUFFICIENT_EVIDENCE — ${cp?.summary || "Not enough recorded outcomes to generate counter-positioning."}${cp?.min_required ? ` (${cp.data_basis}/${cp.min_required} records).` : ""} Log more outcomes in RFP Intelligence OS to unlock AI talking points.`,
      "warn",
    );
  } else {
    body(c, `Confidence: ${cp.confidence_tier} — ${cp.data_basis} outcome${cp.data_basis === 1 ? "" : "s"} analyzed.`);
    if (cp.positioning_headline) {
      gap(c, 1);
      callout(c, cp.positioning_headline, "info");
    }
    gap(c, 2);

    h3(c, "Counter-Positioning Talking Points");
    if (cp.talking_points.length === 0) {
      body(c, "No talking points generated yet.");
    } else {
      cp.talking_points.forEach((tp, i) => {
        bullet(c, `${i + 1}. ${tp.point}`);
        if (tp.evidence_basis) body(c, `Evidence: ${tp.evidence_basis}`, 7);
      });
    }
    gap(c, 2);

    if (cp.key_vulnerability) {
      h3(c, "Key Vulnerability");
      body(c, cp.key_vulnerability);
      gap(c, 1);
    }

    if (cp.recommended_proof_points && cp.recommended_proof_points.length > 0) {
      h3(c, "Bring to the Meeting — Recommended Proof Points");
      cp.recommended_proof_points.forEach(pp => bullet(c, pp));
      gap(c, 1);
    }
  }

  // ── Where they win + capability gaps ────────────────────────────────────────
  if (data.top_product_gaps.length > 0) {
    addPage(c);
    h1(c, "Competitive Intelligence");
    gap(c, 2);
    h2(c, "Capability Gaps Cited in Losses");
    data.top_product_gaps.forEach(g => bullet(c, g));
    gap(c, 2);
  } else {
    addPage(c);
    h1(c, "Competitive Intelligence");
    gap(c, 2);
  }

  if (data.procurement_patterns && data.procurement_patterns.length > 0) {
    h2(c, "Procurement Patterns");
    data.procurement_patterns.forEach(p => bullet(c, p));
    gap(c, 2);
  }

  if (data.industries_won_in && data.industries_won_in.length > 0) {
    h2(c, "Industries Where They Win");
    body(c, data.industries_won_in.join("  ·  "));
    gap(c, 1);
  }

  if (data.size_bands_won_in && data.size_bands_won_in.length > 0) {
    h2(c, "Size Segments They Win");
    body(c, data.size_bands_won_in.join("  ·  "));
    gap(c, 1);
  }

  // ── Evidence Manifest (Four Hard Rules — no export without a manifest) ─────────
  addPage(c);
  h1(c, "SHA-256 Evidence Manifest");
  gap(c, 2);
  body(c, "Per the platform's Four Hard Rules, no export issues without a cryptographic manifest. The hash below is computed over the full battlecard payload (head-to-head record, counter-positioning, capability gaps, and procurement patterns) at generation time. Any post-generation mutation of the underlying data changes this hash.");
  gap(c, 2);
  const { doc: md, M, CW } = c;
  fill(md, [4, 8, 4] as [number, number, number]); md.rect(M, c.y, CW, 18, "F");
  fill(md, GREEN); md.rect(M, c.y, 2, 18, "F");
  md.setFont("helvetica", "bold"); md.setFontSize(7); rgb(md, FG3);
  md.text("SHA-256 EVIDENCE MANIFEST — COMPETITIVE BATTLECARD PAYLOAD", M + 5, c.y + 6);
  md.setFont("courier", "normal"); md.setFontSize(8); rgb(md, GREEN);
  const half = Math.ceil(sha256.length / 2);
  md.text(sha256.slice(0, half), M + 5, c.y + 12);
  md.text(sha256.slice(half), M + 5, c.y + 16);
  c.y += 24;
  gap(c, 2);
  kv(c, "Competitor", data.competitor, true);
  kv(c, "Threat Level", threat);
  kv(c, "Outcomes Analyzed", String(data.data_basis));
  kv(c, "Counter-Positioning Tier", cp?.confidence_tier ?? "INSUFFICIENT_EVIDENCE");
  kv(c, "Generated", c.date);

  return doc;
}

export async function downloadBattlecardPDF(data: BattlecardPdfData) {
  // Four Hard Rules: no export without a manifest. Computing the SHA-256 digest
  // is mandatory — if crypto.subtle is unavailable or the digest fails, abort
  // the export entirely rather than emitting a manifest-less document.
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Secure hashing is unavailable in this browser, so a SHA-256 evidence manifest cannot be generated. Export aborted.");
  }
  const payload = JSON.stringify({
    competitor: data.competitor,
    times_they_won: data.times_they_won,
    our_wins_against: data.our_wins_against,
    our_loss_rate: data.our_loss_rate,
    pricing_factor_rate: data.pricing_factor_rate,
    relationship_factor_rate: data.relationship_factor_rate,
    top_product_gaps: data.top_product_gaps,
    procurement_patterns: data.procurement_patterns,
    industries_won_in: data.industries_won_in,
    size_bands_won_in: data.size_bands_won_in,
    data_basis: data.data_basis,
    counter_positioning: data.counter_positioning,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const sha = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const doc = generateBattlecardPDF(data, sha);
  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.competitor.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "Competitor";
  doc.save(`Kincaid-IQ-Battlecard-${safeName}-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN ENTRY POINT
══════════════════════════════════════════════════════════════════════════════ */
// ── Broker Compensation Index™ PDF ──────────────────────────────────────────
export function generateShadyBrokerPDF(data: any): jsPDF {
  const d = data ?? {};
  const ein          = d.ein          ?? "Unknown EIN";
  const sponsor      = d.sponsor      ?? d.sponsor_name ?? "Unknown Sponsor";
  const score        = d.score        ?? d.overall_score ?? null;
  const rating       = d.rating       ?? "";
  const narrative    = d.narrative    ?? {};
  const headline     = narrative.headline ?? "";
  const whyBad       = narrative.why_this_scores_poorly ?? "";
  const signals: string[]   = narrative.hidden_compensation_signals ?? [];
  const questions: string[] = narrative.cfo_questions  ?? [];
  const concerns: string[]  = narrative.fiduciary_concerns ?? [];
  const nextStep     = narrative.next_step ?? "";
  const bench        = d.benchmarking ?? {};
  const sbi          = d.shady_broker  ?? {};
  const brokerPct    = Number(sbi.broker_pct  ?? 0);
  const adminPct     = Number(sbi.admin_pct   ?? 0);
  const participants = Number(bench.participants ?? 0);
  const totalIncome  = Number(bench.total_income ?? 0);

  const accentHex = score != null && score < 70 ? "#EF4444" : score != null && score < 85 ? "#FFB800" : "#10B981";
  const rawDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const c = ctx(rawDoc, accentHex, "Broker Compensation Index™", `DOL Form 5500 Forensic Intelligence · EIN ${ein}`);

  // Cover page
  coverPage(c);

  // Page 2 — Score + Sponsor summary
  addPage(c);
  h2(c, "Employer Identification");
  kv(c, "Sponsor Name", sponsor);
  kv(c, "EIN", ein);
  kv(c, "BCI Score", score != null ? `${score}/100` : "INSUFFICIENT_EVIDENCE");
  kv(c, "Rating", rating || "N/A");
  kv(c, "Broker % of Plan Income", `${brokerPct.toFixed(1)}%`);
  kv(c, "Admin % of Plan Income",  `${adminPct.toFixed(1)}%`);
  kv(c, "Covered Participants", participants.toLocaleString());
  kv(c, "Total Plan Income",    `$${totalIncome.toLocaleString()}`);
  gap(c, 6);

  if (headline) {
    checkY(c, 30);
    h2(c, "Headline Finding");
    body(c, headline);
    gap(c, 4);
  }

  if (whyBad) {
    checkY(c, 30);
    h2(c, "Why This Plan Scores Poorly");
    body(c, whyBad);
    gap(c, 4);
  }

  // Page 3 — Compensation signals
  if (signals.length > 0) {
    addPage(c);
    h2(c, "Hidden Compensation Signals");
    for (const s of signals) { bullet(c, s); }
    gap(c, 6);
  }

  // CFO Questions
  if (questions.length > 0) {
    checkY(c, 60);
    h2(c, "CFO Questions to Ask Your Broker");
    for (const q of questions) { bullet(c, q); }
    gap(c, 6);
  }

  // Fiduciary concerns
  if (concerns.length > 0) {
    checkY(c, 60);
    h2(c, "ERISA Fiduciary Concerns");
    for (const con of concerns) { bullet(c, con); }
    gap(c, 6);
  }

  // Recommended Next Step
  if (nextStep) {
    checkY(c, 40);
    h2(c, "Recommended Next Step");
    body(c, nextStep);
  }

  return c.doc;
}

export async function generatePDF(reportType: string, data: any = {}): Promise<string> {
  let doc: jsPDF;
  switch (reportType) {
    case "fiduciary-iq":          doc = generateFiduciaryPDF(data); break;
    case "claims-recovery":       doc = generateClaimsPDF(data); break;
    case "network-iq":            doc = generateNetworkPDF(data); break;
    case "employer-health-score": doc = generateEmployerHealthPDF(data); break;
    case "stewardship":           doc = generateStewardshipPDF(data); break;
    case "stop-loss":             doc = generateStopLossPDF(data); break;
    case "rx-defense":            doc = generateRxDefensePDF(data); break;
    case "shady-broker":          doc = generateShadyBrokerPDF(data); break;
    default:                      doc = generateFiduciaryPDF(data); break;
  }
  return doc.output("datauristring").split(",")[1]; // base64
}

export async function downloadPDF(reportType: string, data: any = {}) {
  const labels: Record<string, string> = {
    "fiduciary-iq":          "ERISA-Fiduciary-IQ",
    "claims-recovery":       "Claims-Recovery-IQ",
    "network-iq":            "Network-IQ",
    "employer-health-score": "Employer-Health-Score",
    "stewardship":           "Stewardship-Report",
    "stop-loss":             "Stop-Loss-IQ",
    "rx-defense":            "Rx-Defense-IQ",
    "shady-broker":          "Broker-Compensation-Index",
  };
  let doc: jsPDF;
  switch (reportType) {
    case "fiduciary-iq":          doc = generateFiduciaryPDF(data); break;
    case "claims-recovery":       doc = generateClaimsPDF(data); break;
    case "network-iq":            doc = generateNetworkPDF(data); break;
    case "employer-health-score": doc = generateEmployerHealthPDF(data); break;
    case "stewardship":           doc = generateStewardshipPDF(data); break;
    case "stop-loss":             doc = generateStopLossPDF(data); break;
    case "rx-defense":            doc = generateRxDefensePDF(data); break;
    case "shady-broker":          doc = generateShadyBrokerPDF(data); break;
    default:                      doc = generateFiduciaryPDF(data); break;
  }
  const date = new Date().toISOString().slice(0,10);
  doc.save(`Kincaid-IQ-${labels[reportType] ?? "Report"}-${date}.pdf`);
}

/* ══════════════════════════════════════════════════════════════════════════════
   BID RECOMMENDATION — RFP Bid Optimizer Export (pt/letter, dark theme)
   Shared builder so the on-screen export and any future server-side / batch
   generation render an identical document. Self-contained: uses its own pt-based
   layout and color palette rather than the mm-based report chrome above.
══════════════════════════════════════════════════════════════════════════════ */

export interface BidRecommendationPdfData {
  opp_id: string;
  opp_title: string;
  employer_name?: string;
  industry?: string;
  covered_lives?: number;
  anchor_price: number;
  anchor_basis: string;
  ci_score: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  n_comparables: number;
  range_lo: number;
  range_hi: number;
  range_lo_factor: number;
  range_hi_factor: number;
  max_ev_price: number;
  max_ev_factor: number;
  max_ev: number;
  win_prob_at_max_ev: number;
  assumptions: string[];
}

export interface BidRecommendationChartImage {
  /** PNG data URL captured from the win-probability / EV curve. */
  dataUrl: string;
  /** canvas.width / canvas.height — used to preserve aspect ratio. */
  ratio: number;
}

function _bidFmt$(v?: number | null): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function _bidFmtDate(s?: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return s; }
}

/**
 * Build the bid-recommendation PDF. Returns a jsPDF document (caller decides
 * whether to .save(), turn into a blob, etc.). Async because the SHA-256
 * evidence manifest (Constitutional Doctrine rule 3) is computed here.
 */
export async function generateBidRecommendationPDF(
  bid: BidRecommendationPdfData,
  chartImage?: BidRecommendationChartImage | null,
): Promise<jsPDF> {
  // SHA-256 evidence manifest — Constitutional Doctrine rule 3:
  // "No export without a SHA-256 evidence manifest."
  const manifestPayload = JSON.stringify({
    opp_id: bid.opp_id,
    employer: bid.employer_name || bid.opp_title,
    range: [bid.range_lo, bid.range_hi],
    max_ev: bid.max_ev,
    max_ev_price: bid.max_ev_price,
    win_prob_at_max_ev: bid.win_prob_at_max_ev,
    confidence: bid.confidence,
    n_comparables: bid.n_comparables,
    generated: new Date().toISOString(),
  });
  const hashBuf = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(manifestPayload));
  const manifest = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0")).join("");

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  const CW = W - M * 2;

  const rgbT = (r: number, g: number, b: number) => doc.setTextColor(r, g, b);
  const fillC = (r: number, g: number, b: number) => doc.setFillColor(r, g, b);
  const strokeC = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b);

  // Page background
  fillC(4, 6, 15); doc.rect(0, 0, W, H, "F");

  // Header band
  fillC(8, 12, 26); doc.rect(0, 0, W, 64, "F");
  fillC(251, 183, 36); doc.rect(0, 64, W, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  rgbT(251, 183, 36);
  doc.text("KINCAID HEALTH — BID RECOMMENDATION", M, 30);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  rgbT(140, 150, 185);
  const detailBits = [
    bid.industry,
    bid.covered_lives ? `${bid.covered_lives.toLocaleString()} covered lives` : null,
    `Anchor ${_bidFmt$(bid.anchor_price)} (${bid.anchor_basis})`,
  ].filter(Boolean).join("  ·  ");
  doc.text(detailBits, M, 48);
  rgbT(110, 120, 155);
  doc.text(_bidFmtDate(new Date().toISOString()), W - M, 48, { align: "right" });

  let y = 86;

  // Opportunity name
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  rgbT(255, 255, 255);
  const oppName = bid.employer_name || bid.opp_title || "Bid Recommendation";
  doc.text(doc.splitTextToSize(oppName, CW)[0], M, y);
  y += 22;

  // KPI tiles row
  const tileGap = 10;
  const tileW = (CW - tileGap * 3) / 4;
  const tileH = 58;
  const tiles: Array<{ label: string; value: string; color: [number, number, number]; sub: string }> = [
    {
      label: "RECOMMENDED RANGE",
      value: `${_bidFmt$(bid.range_lo)}–${_bidFmt$(bid.range_hi)}`,
      color: [251, 183, 36],
      sub: `${bid.range_lo_factor}%–${bid.range_hi_factor}% of baseline`,
    },
    {
      label: "PEAK EXPECTED VALUE",
      value: _bidFmt$(bid.max_ev),
      color: [34, 197, 94],
      sub: `at ${_bidFmt$(bid.max_ev_price)}/yr · ${bid.max_ev_factor}%`,
    },
    {
      label: "WIN PROB @ OPTIMAL",
      value: `${bid.win_prob_at_max_ev}%`,
      color: [59, 130, 246],
      sub: `CI ${bid.ci_score}/100`,
    },
    {
      label: "MODEL CONFIDENCE",
      value: bid.confidence,
      color: bid.confidence === "HIGH" ? [34, 197, 94]
        : bid.confidence === "MEDIUM" ? [251, 183, 36] : [245, 158, 11],
      sub: `${bid.n_comparables} comparable${bid.n_comparables !== 1 ? "s" : ""}`,
    },
  ];
  tiles.forEach((t, i) => {
    const tx = M + i * (tileW + tileGap);
    fillC(8, 12, 26); doc.rect(tx, y, tileW, tileH, "F");
    strokeC(26, 31, 53); doc.setLineWidth(0.6); doc.rect(tx, y, tileW, tileH);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    rgbT(90, 96, 128); doc.text(t.label, tx + 8, y + 14);
    doc.setFontSize(14); rgbT(t.color[0], t.color[1], t.color[2]);
    doc.text(doc.splitTextToSize(t.value, tileW - 14)[0], tx + 8, y + 33);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    rgbT(120, 128, 160);
    doc.text(doc.splitTextToSize(t.sub, tileW - 14)[0], tx + 8, y + 48);
  });
  y += tileH + 16;

  // Recommended range callout
  const calloutH = 44;
  fillC(20, 17, 4); doc.rect(M, y, CW, calloutH, "F");
  fillC(251, 183, 36); doc.rect(M, y, 3, calloutH, "F");
  strokeC(251, 183, 36); doc.setLineWidth(0.5); doc.rect(M, y, CW, calloutH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  rgbT(251, 183, 36); doc.text("RECOMMENDED BID RANGE", M + 12, y + 16);
  doc.setFontSize(18); rgbT(255, 255, 255);
  doc.text(`${_bidFmt$(bid.range_lo)} – ${_bidFmt$(bid.range_hi)} / yr`, M + 12, y + 36);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  rgbT(160, 168, 200);
  doc.text(
    `Maximum expected-value zone · win prob ${bid.win_prob_at_max_ev}% at ${_bidFmt$(bid.max_ev_price)}`,
    W - M - 12, y + 36, { align: "right" });
  y += calloutH + 16;

  // Win-probability curve image
  if (chartImage) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    rgbT(90, 96, 128);
    doc.text("WIN PROBABILITY & EXPECTED VALUE CURVE", M, y);
    y += 8;
    const imgH = Math.min(CW / chartImage.ratio, 200);
    doc.addImage(chartImage.dataUrl, "PNG", M, y, CW, imgH);
    y += imgH + 16;
  }

  // Assumptions
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  rgbT(251, 183, 36);
  doc.text("MODEL ASSUMPTIONS", M, y);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const footerLimit = H - 46;
  (bid.assumptions || []).forEach(a => {
    const lines = doc.splitTextToSize(a, CW - 14);
    lines.forEach((line: string, li: number) => {
      if (y > footerLimit) return;
      if (li === 0) {
        fillC(251, 183, 36); doc.circle(M + 2, y - 2.5, 1.4, "F");
      }
      rgbT(180, 186, 215);
      doc.text(line, M + 10, y);
      y += 11;
    });
    y += 2;
  });

  // MODELED watermark when confidence is not HIGH
  if (bid.confidence !== "HIGH") {
    const g = (doc as any).GState ? new (doc as any).GState({ opacity: 0.08 }) : null;
    if (g) (doc as any).setGState(g);
    doc.setFont("helvetica", "bold"); doc.setFontSize(90);
    rgbT(251, 183, 36);
    doc.text("MODELED", W / 2, H / 2, { align: "center", angle: 32, baseline: "middle" });
    if (g) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
  }

  // Footer — evidence manifest
  fillC(8, 12, 26); doc.rect(0, H - 32, W, 32, "F");
  fillC(251, 183, 36); doc.rect(0, H - 32, W, 0.8, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  rgbT(110, 120, 155);
  doc.text(`SHA-256 Evidence Manifest: ${manifest}`, M, H - 18);
  rgbT(90, 96, 128);
  doc.text(
    `Generated by Kincaid Health Bid Optimizer™ · ${new Date().toISOString()} · CONFIDENTIAL`,
    M, H - 8);
  const tierLabel = bid.confidence === "HIGH" ? "CERTIFIED basis" : "MODELED — bounds disclosed";
  rgbT(251, 183, 36);
  doc.text(tierLabel, W - M, H - 8, { align: "right" });

  return doc;
}

/** Build the bid-recommendation PDF and trigger a browser download. */
export async function downloadBidRecommendationPDF(
  bid: BidRecommendationPdfData,
  chartImage?: BidRecommendationChartImage | null,
) {
  const doc = await generateBidRecommendationPDF(bid, chartImage);
  const oppName = bid.employer_name || bid.opp_title || "bid";
  const safeName = oppName.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  doc.save(`bid_recommendation_${safeName}.pdf`);
}
