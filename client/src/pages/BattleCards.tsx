import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import {
  Swords, TrendingDown, Users, DollarSign, AlertTriangle,
  ChevronRight, X, Shield, Target, Zap, BarChart2,
  Brain, AlertCircle, CheckCircle2, ArrowRight, ExternalLink,
  Building2, Briefcase, RefreshCw, Download,
} from "lucide-react";
import { downloadBattlecardPDF } from "@/lib/pdfReports";
import { useToast } from "@/hooks/use-toast";

/* ─── PALETTE ─────────────────────────────────────────────────────────────── */
const GOLD   = "#FFB800";
const RED    = "#FF4D6D";
const GREEN  = "#00FF94";
const BLUE   = "#00D4FF";
const ORANGE = "#FF6B1A";
const PURPLE = "#A855F7";
const BG     = "#07080f";

/* ─── TYPES ──────────────────────────────────────────────────────────────── */
interface CounterPositioning {
  confidence_tier: "CERTIFIED" | "MODELED" | "INSUFFICIENT_EVIDENCE";
  data_basis: number;
  min_required?: number;
  talking_points: { point: string; evidence_basis: string }[];
  positioning_headline?: string;
  key_vulnerability?: string;
  recommended_proof_points?: string[];
  summary: string;
}

interface BattleCard {
  competitor: string;
  total_encounters: number;
  times_they_won: number;
  our_wins_against: number;
  our_loss_rate: number | null;
  pricing_factor_rate: number | null;
  relationship_factor_rate: number | null;
  top_product_gaps: string[];
  procurement_patterns: string[];
  industries_won_in: string[];
  size_bands_won_in: string[];
  recent_losses: {
    opportunity_id: string;
    employer_name: string | null;
    industry: string | null;
    participants: number | null;
    decision_date: string | null;
    contract_value: number | null;
    loss_reason: string | null;
    lessons_learned: string | null;
  }[];
  data_basis: number;
  counter_positioning: CounterPositioning | null;
}

interface BattleCardsListResponse {
  competitors: BattleCard[];
  total_outcomes: number;
  min_records_for_ai: number;
}

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */
function fmtPct(n: number | null) {
  return n === null ? "—" : `${n}%`;
}
function fmtMoney(n: number | null) {
  if (!n) return "—";
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
}
function tierColor(tier: string) {
  if (tier === "CERTIFIED") return GREEN;
  if (tier === "MODELED") return BLUE;
  return ORANGE;
}
function lossRateColor(rate: number | null) {
  if (rate === null) return "rgba(255,255,255,0.4)";
  if (rate >= 70) return RED;
  if (rate >= 50) return ORANGE;
  if (rate >= 30) return GOLD;
  return GREEN;
}

/* ─── EMPTY STATE ─────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 20, padding: 80, textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: "rgba(255,72,109,0.1)", border: "1px solid rgba(255,72,109,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Swords style={{ width: 32, height: 32, color: RED }} />
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "rgba(255,255,255,0.9)", marginBottom: 8 }}>
          No Competitor Data Yet
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 380, lineHeight: 1.7 }}>
          Battlecards are auto-built from your win/loss records. Log outcomes on opportunities in the{" "}
          <Link href="/rfp-intelligence" style={{ color: GOLD, textDecoration: "underline" }}>
            RFP Intelligence OS
          </Link>
          {" "}to populate competitor data.
        </div>
      </div>
    </div>
  );
}

/* ─── STAT PILL ──────────────────────────────────────────────────────────── */
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "10px 16px", borderRadius: 10,
      background: `${color}10`, border: `1px solid ${color}25`,
    }}>
      <span style={{ fontSize: 18, fontWeight: 900, color }}>{value}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>{label}</span>
    </div>
  );
}

/* ─── COMPETITOR SUMMARY CARD ─────────────────────────────────────────────── */
function CompetitorCard({ card, selected, onClick }: {
  card: BattleCard;
  selected: boolean;
  onClick: () => void;
}) {
  const lrColor = lossRateColor(card.our_loss_rate);
  const threat = card.our_loss_rate !== null && card.our_loss_rate >= 60 ? "HIGH" :
                 card.our_loss_rate !== null && card.our_loss_rate >= 40 ? "MED" : "LOW";
  const threatCol = threat === "HIGH" ? RED : threat === "MED" ? ORANGE : GREEN;

  return (
    <button
      onClick={onClick}
      data-testid={`battlecard-${card.competitor}`}
      style={{
        width: "100%", textAlign: "left", padding: 20, borderRadius: 16, cursor: "pointer",
        background: selected ? "rgba(255,72,109,0.08)" : "rgba(255,255,255,0.025)",
        border: selected ? `1px solid ${RED}40` : "1px solid rgba(255,255,255,0.07)",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: `${lrColor}15`, border: `1px solid ${lrColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Shield style={{ width: 18, height: 18, color: lrColor }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.competitor}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
              color: threatCol, background: `${threatCol}18`, border: `1px solid ${threatCol}30`,
              borderRadius: 3, padding: "1px 5px",
            }}>{threat} THREAT</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
              {card.total_encounters} encounter{card.total_encounters !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <ChevronRight style={{ width: 14, height: 14, color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: lrColor }}>{fmtPct(card.our_loss_rate)}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Our Loss Rate</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: ORANGE }}>{card.times_they_won}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Their Wins</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: GREEN }}>{card.our_wins_against}</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Our Wins</div>
        </div>
      </div>

      {card.top_product_gaps.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
          {card.top_product_gaps.slice(0, 3).map(g => (
            <span key={g} style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 4,
              background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)",
              color: PURPLE,
            }}>{g}</span>
          ))}
          {card.top_product_gaps.length > 3 && (
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>+{card.top_product_gaps.length - 3} more</span>
          )}
        </div>
      )}
    </button>
  );
}

/* ─── COUNTER POSITIONING PANEL ──────────────────────────────────────────── */
function CounterPositioningPanel({ cp }: { cp: CounterPositioning }) {
  const col = tierColor(cp.confidence_tier);

  if (cp.confidence_tier === "INSUFFICIENT_EVIDENCE") {
    return (
      <div style={{
        padding: 20, borderRadius: 14,
        background: "rgba(255,107,26,0.06)", border: "1px solid rgba(255,107,26,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertCircle style={{ width: 18, height: 18, color: ORANGE }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE }}>INSUFFICIENT_EVIDENCE</span>
          <span style={{
            fontSize: 8, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase",
            color: ORANGE, background: "rgba(255,107,26,0.15)", border: "1px solid rgba(255,107,26,0.3)",
            borderRadius: 3, padding: "1px 6px",
          }}>AI LOCKED</span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>
          {cp.summary}
        </p>
        {cp.min_required && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 2, background: ORANGE,
                width: `${Math.min(100, (cp.data_basis / cp.min_required) * 100)}%`,
                transition: "width 0.4s",
              }} />
            </div>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" }}>
              {cp.data_basis}/{cp.min_required} records
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: 16, borderRadius: 12,
        background: `${col}08`, border: `1px solid ${col}25`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Brain style={{ width: 14, height: 14, color: col }} />
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: col }}>
            {cp.confidence_tier}
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>· {cp.data_basis} outcome{cp.data_basis !== 1 ? "s" : ""} analyzed</span>
        </div>
        {cp.positioning_headline && (
          <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.5 }}>
            {cp.positioning_headline}
          </p>
        )}
      </div>

      {cp.talking_points.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
            Counter-Positioning Talking Points
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cp.talking_points.map((tp, i) => (
              <div key={i} style={{
                padding: 14, borderRadius: 12,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: `${GOLD}18`, border: `1px solid ${GOLD}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 900, color: GOLD,
                  }}>{i + 1}</div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.82)", margin: 0, lineHeight: 1.6 }}>
                    {tp.point}
                  </p>
                </div>
                {tp.evidence_basis && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 6, paddingLeft: 30 }}>
                    <CheckCircle2 style={{ width: 10, height: 10, color: GREEN, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>
                      {tp.evidence_basis}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {cp.key_vulnerability && (
        <div style={{
          padding: 14, borderRadius: 12,
          background: "rgba(255,72,109,0.06)", border: "1px solid rgba(255,72,109,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Target style={{ width: 12, height: 12, color: RED }} />
            <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", color: RED }}>Key Vulnerability</span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>{cp.key_vulnerability}</p>
        </div>
      )}

      {cp.recommended_proof_points && cp.recommended_proof_points.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
            Bring to the Meeting
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {cp.recommended_proof_points.map((pp, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <ArrowRight style={{ width: 12, height: 12, color: BLUE, flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{pp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── DETAIL DRAWER ───────────────────────────────────────────────────────── */
function BattleCardDetail({ competitor, onClose }: { competitor: string; onClose: () => void }) {
  const encoded = encodeURIComponent(competitor);
  const { data, isLoading, isError } = useQuery<BattleCard>({
    queryKey: ["/api/rfp/battlecards", competitor],
    queryFn: async () => {
      const res = await fetch(`/api/rfp/battlecards/${encoded}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load battlecard");
      return res.json();
    },
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 680, maxWidth: "95vw", height: "100vh", overflowY: "auto",
          background: "linear-gradient(180deg, #0d0f1e 0%, #08091a 100%)",
          border: "1px solid rgba(255,255,255,0.08)", borderRight: "none",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(13,15,30,0.96)", backdropFilter: "blur(12px)",
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "rgba(255,72,109,0.12)", border: "1px solid rgba(255,72,109,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Swords style={{ width: 20, height: 20, color: RED }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{competitor}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Competitive Battlecard</div>
          </div>
          <button onClick={onClose} data-testid="close-battlecard"
            style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer" }}>
            <X style={{ width: 16, height: 16, color: "rgba(255,255,255,0.5)" }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24 }}>
          {isLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 10 }}>
              <RefreshCw style={{ width: 18, height: 18, color: BLUE, animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Loading battlecard…</span>
            </div>
          )}
          {isError && (
            <div style={{ padding: 24, textAlign: "center", color: RED, fontSize: 13 }}>
              Failed to load battlecard data.
            </div>
          )}
          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              {/* Head-to-head stats */}
              <div>
                <SectionLabel>Head-to-Head Record</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
                  <StatPill label="Our Loss Rate" value={fmtPct(data.our_loss_rate)} color={lossRateColor(data.our_loss_rate)} />
                  <StatPill label="Their Wins" value={String(data.times_they_won)} color={ORANGE} />
                  <StatPill label="Our Wins" value={String(data.our_wins_against)} color={GREEN} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 10 }}>
                  <StatPill label="Pricing Factor" value={fmtPct(data.pricing_factor_rate)} color={RED} />
                  <StatPill label="Relationship Factor" value={fmtPct(data.relationship_factor_rate)} color={PURPLE} />
                </div>
              </div>

              {/* AI Counter-Positioning */}
              <div>
                <SectionLabel>AI Counter-Positioning</SectionLabel>
                <div style={{ marginTop: 12 }}>
                  {data.counter_positioning ? (
                    <CounterPositioningPanel cp={data.counter_positioning} />
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", padding: 16, textAlign: "center" }}>
                      Counter-positioning not available.
                    </div>
                  )}
                </div>
              </div>

              {/* Product Gaps */}
              {data.top_product_gaps.length > 0 && (
                <div>
                  <SectionLabel>Capability Gaps Cited in Losses</SectionLabel>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.top_product_gaps.map(g => (
                      <div key={g} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        borderRadius: 10, background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.18)",
                      }}>
                        <AlertTriangle style={{ width: 12, height: 12, color: PURPLE, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Procurement Patterns */}
              {data.procurement_patterns.length > 0 && (
                <div>
                  <SectionLabel>Procurement Patterns</SectionLabel>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.procurement_patterns.map((p, i) => (
                      <div key={i} style={{
                        padding: "10px 14px", borderRadius: 10,
                        background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
                        fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6,
                      }}>{p}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Where They Win */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {data.industries_won_in.length > 0 && (
                  <div>
                    <SectionLabel>Industries Where They Win</SectionLabel>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                      {data.industries_won_in.map(ind => (
                        <div key={ind} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Building2 style={{ width: 10, height: 10, color: GOLD }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{ind}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.size_bands_won_in.length > 0 && (
                  <div>
                    <SectionLabel>Size Segments Won</SectionLabel>
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                      {data.size_bands_won_in.map(s => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Users style={{ width: 10, height: 10, color: BLUE }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Losses */}
              {data.recent_losses.length > 0 && (
                <div>
                  <SectionLabel>Recent Losses Against Them</SectionLabel>
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.recent_losses.map((r, i) => (
                      <div key={i} style={{
                        padding: 14, borderRadius: 12,
                        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <Briefcase style={{ width: 12, height: 12, color: RED }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                            {r.employer_name || "Unknown Employer"}
                          </span>
                          {r.contract_value && (
                            <span style={{ fontSize: 10, color: GOLD, marginLeft: "auto" }}>
                              {fmtMoney(r.contract_value)}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {r.industry && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{r.industry}</span>
                          )}
                          {r.participants && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{r.participants.toLocaleString()} members</span>
                          )}
                          {r.decision_date && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{r.decision_date}</span>
                          )}
                        </div>
                        {r.lessons_learned && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.5)", fontStyle: "italic", lineHeight: 1.5 }}>
                            "{r.lessons_learned}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to log more outcomes */}
              <div style={{
                padding: 16, borderRadius: 12,
                background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <Zap style={{ width: 16, height: 16, color: GOLD, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>Improve this battlecard</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                    Log more outcomes in RFP Intelligence OS to strengthen counter-positioning.
                  </div>
                </div>
                <Link href="/rfp-intelligence" style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "6px 12px",
                    borderRadius: 8, background: `${GOLD}18`, border: `1px solid ${GOLD}30`,
                    color: GOLD, fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}>
                    Log Outcomes <ExternalLink style={{ width: 10, height: 10 }} />
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
      {children}
    </div>
  );
}

/* ─── INLINE BATTLECARD WIDGET ───────────────────────────────────────────── */
export function InlineBattleCard({ opportunityId }: { opportunityId: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery<{ competitor: string | null; battlecard: BattleCard | null }>({
    queryKey: ["/api/rfp/opportunities", opportunityId, "battlecard"],
    queryFn: async () => {
      const res = await fetch(`/api/rfp/opportunities/${opportunityId}/battlecard`, { credentials: "include" });
      if (!res.ok) return { competitor: null, battlecard: null };
      return res.json();
    },
    enabled: !!opportunityId,
  });

  if (isLoading || !data?.competitor) return null;

  const { competitor, battlecard } = data;

  // Competitor is known/tagged, but no outcomes have been logged yet, so no
  // battlecard could be built. Show a helpful hint instead of rendering nothing,
  // so reps know intel is unbuilt (not missing) and where to log outcomes.
  if (!battlecard || battlecard.total_encounters === 0) {
    return (
      <div
        data-testid={`inline-battlecard-empty-${opportunityId}`}
        style={{
          borderRadius: 12, padding: "12px 16px",
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10,
        }}
      >
        <Swords style={{ width: 14, height: 14, color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            Known Competitor: <span style={{ color: "rgba(255,255,255,0.85)" }}>{competitor}</span>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
            Not enough outcomes logged yet for {competitor} to build a battlecard.
          </div>
        </div>
        <Link href="/rfp-intelligence" style={{ textDecoration: "none" }}>
          <div
            data-testid={`link-log-outcomes-${opportunityId}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
              borderRadius: 8, background: `${GOLD}18`, border: `1px solid ${GOLD}30`,
              color: GOLD, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Log Outcomes <ExternalLink style={{ width: 10, height: 10 }} />
          </div>
        </Link>
      </div>
    );
  }

  const lrColor = lossRateColor(battlecard.our_loss_rate);

  return (
    <div style={{
      borderRadius: 12, overflow: "hidden",
      background: "rgba(255,72,109,0.06)", border: "1px solid rgba(255,72,109,0.2)",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        data-testid={`inline-battlecard-${opportunityId}`}
        style={{
          width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <Swords style={{ width: 14, height: 14, color: RED, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
            Known Competitor: <span style={{ color: RED }}>{competitor}</span>
          </span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginLeft: 8 }}>
            {fmtPct(battlecard.our_loss_rate)} loss rate against them
          </span>
        </div>
        <ChevronRight style={{
          width: 14, height: 14, color: "rgba(255,255,255,0.35)",
          transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.2s",
        }} />
      </button>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 12, marginBottom: 12 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: lrColor }}>{fmtPct(battlecard.our_loss_rate)}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Loss Rate</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>{battlecard.times_they_won}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Their Wins</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{battlecard.our_wins_against}</div>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Our Wins</div>
            </div>
          </div>

          {battlecard.top_product_gaps.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 6 }}>Common Gaps</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {battlecard.top_product_gaps.slice(0, 4).map(g => (
                  <span key={g} style={{
                    fontSize: 9, padding: "2px 7px", borderRadius: 4,
                    background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.2)",
                    color: PURPLE,
                  }}>{g}</span>
                ))}
              </div>
            </div>
          )}

          <Link href={`/battlecards?competitor=${encodeURIComponent(competitor)}`} style={{ textDecoration: "none" }}>
            <div
              data-testid={`link-full-battlecard-${opportunityId}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
                borderRadius: 8, background: "rgba(255,72,109,0.1)", border: "1px solid rgba(255,72,109,0.25)",
                color: RED, fontSize: 10, fontWeight: 700, cursor: "pointer",
              }}>
              Full Battlecard <ArrowRight style={{ width: 10, height: 10 }} />
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── MAIN PAGE ───────────────────────────────────────────────────────────── */
export default function BattleCards() {
  const search = useSearch();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery<BattleCardsListResponse>({
    queryKey: ["/api/rfp/battlecards"],
  });

  const competitors = data?.competitors ?? [];
  const totalOutcomes = data?.total_outcomes ?? 0;

  // Deeplink support: /battlecards?competitor=Name pre-selects the matching card.
  useEffect(() => {
    const param = new URLSearchParams(search).get("competitor");
    if (!param || competitors.length === 0) return;
    const match = competitors.find(
      c => c.competitor.toLowerCase() === param.toLowerCase(),
    );
    if (match) setSelected(match.competitor);
  }, [search, competitors]);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff" }}>
      {/* Header */}
      <div style={{
        padding: "28px 32px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "linear-gradient(180deg, rgba(255,72,109,0.05) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(255,72,109,0.12)", border: "1px solid rgba(255,72,109,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Swords style={{ width: 22, height: 22, color: RED }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-0.02em" }}>
              Competitive Battlecards
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              Per-competitor win/loss intelligence — auto-built from your outcome history
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            {totalOutcomes > 0 && (
              <div style={{
                padding: "8px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: GOLD, textAlign: "center" }}>{totalOutcomes}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total Outcomes</div>
              </div>
            )}
            {competitors.length > 0 && (
              <div style={{
                padding: "8px 16px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: BLUE, textAlign: "center" }}>{competitors.length}</div>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Competitors</div>
              </div>
            )}
          </div>
        </div>

        {/* Info bar */}
        <div style={{
          marginTop: 16, padding: "10px 16px", borderRadius: 10,
          background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.15)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <BarChart2 style={{ width: 14, height: 14, color: BLUE, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
            Battlecards update automatically as you log outcomes. AI counter-positioning requires ≥{data?.min_records_for_ai ?? 3} records per competitor.
            Log outcomes in{" "}
            <Link href="/rfp-intelligence" style={{ color: GOLD }}>RFP Intelligence OS</Link>.
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "28px 32px" }}>
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40 }}>
            <RefreshCw style={{ width: 18, height: 18, color: BLUE, animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Loading battlecards…</span>
          </div>
        )}

        {!isLoading && competitors.length === 0 && <EmptyState />}

        {competitors.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start" }}>
            {/* Competitor list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>
                Competitors ({competitors.length})
              </div>
              {competitors.map(card => (
                <CompetitorCard
                  key={card.competitor}
                  card={card}
                  selected={selected === card.competitor}
                  onClick={() => setSelected(selected === card.competitor ? null : card.competitor)}
                />
              ))}
            </div>

            {/* Right panel: detail or summary */}
            <div>
              {!selected && (
                <div style={{
                  padding: 48, borderRadius: 20, textAlign: "center",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <Swords style={{ width: 36, height: 36, color: "rgba(255,255,255,0.12)", margin: "0 auto 16px" }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                    Select a competitor
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                    Click any card on the left to view the full battlecard and AI counter-positioning.
                  </div>
                </div>
              )}

              {selected && (
                <SelectedCompetitorPanel
                  competitor={selected}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── SELECTED COMPETITOR PANEL (inline, not modal) ─────────────────────── */
function SelectedCompetitorPanel({ competitor, onClose }: { competitor: string; onClose: () => void }) {
  const encoded = encodeURIComponent(competitor);
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const { data, isLoading, isError } = useQuery<BattleCard>({
    queryKey: ["/api/rfp/battlecards", competitor],
    queryFn: async () => {
      const res = await fetch(`/api/rfp/battlecards/${encoded}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const handleExport = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      await downloadBattlecardPDF({
        competitor: data.competitor,
        total_encounters: data.total_encounters,
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
      toast({ title: "Battlecard exported", description: "PDF leave-behind saved with a SHA-256 evidence manifest." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Could not generate the PDF.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      borderRadius: 20, overflow: "hidden",
      background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: "rgba(255,72,109,0.12)", border: "1px solid rgba(255,72,109,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Shield style={{ width: 18, height: 18, color: RED }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{competitor}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Competitive Battlecard</div>
        </div>
        <button
          onClick={handleExport}
          disabled={!data || exporting}
          title={!data ? "Battlecard still loading" : "Download a PDF leave-behind with a SHA-256 evidence manifest"}
          data-testid="button-download-battlecard-pdf"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 12px", borderRadius: 8,
            background: (!data || exporting) ? "rgba(255,184,0,0.06)" : "rgba(255,184,0,0.1)",
            border: "1px solid rgba(255,184,0,0.25)",
            color: GOLD, fontSize: 11, fontWeight: 700,
            cursor: (!data || exporting) ? "not-allowed" : "pointer",
            opacity: (!data || exporting) ? 0.6 : 1,
          }}
        >
          {exporting
            ? <RefreshCw style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
            : <Download style={{ width: 13, height: 13 }} />}
          {exporting ? "Generating…" : "Download PDF"}
        </button>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
          <X style={{ width: 16, height: 16, color: "rgba(255,255,255,0.35)" }} />
        </button>
      </div>

      <div style={{ padding: 22, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
        {isLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 40, justifyContent: "center" }}>
            <RefreshCw style={{ width: 16, height: 16, color: BLUE, animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Building battlecard…</span>
          </div>
        )}
        {isError && (
          <div style={{ padding: 24, textAlign: "center", color: RED, fontSize: 13 }}>
            Failed to load battlecard data.
          </div>
        )}
        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              <StatPill label="Loss Rate" value={fmtPct(data.our_loss_rate)} color={lossRateColor(data.our_loss_rate)} />
              <StatPill label="Their Wins" value={String(data.times_they_won)} color={ORANGE} />
              <StatPill label="Our Wins" value={String(data.our_wins_against)} color={GREEN} />
              <StatPill label="Pricing %" value={fmtPct(data.pricing_factor_rate)} color={RED} />
              <StatPill label="Rel. %" value={fmtPct(data.relationship_factor_rate)} color={PURPLE} />
            </div>

            {/* Counter Positioning */}
            <div>
              <SectionLabel>AI Counter-Positioning</SectionLabel>
              <div style={{ marginTop: 12 }}>
                {data.counter_positioning ? (
                  <CounterPositioningPanel cp={data.counter_positioning} />
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", padding: 16, textAlign: "center" }}>
                    Counter-positioning not yet available.
                  </div>
                )}
              </div>
            </div>

            {/* Product Gaps */}
            {data.top_product_gaps.length > 0 && (
              <div>
                <SectionLabel>Capability Gaps Cited in Losses</SectionLabel>
                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {data.top_product_gaps.map(g => (
                    <span key={g} style={{
                      fontSize: 10, padding: "4px 10px", borderRadius: 6,
                      background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)",
                      color: PURPLE,
                    }}>{g}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Procurement Patterns */}
            {data.procurement_patterns.length > 0 && (
              <div>
                <SectionLabel>Procurement Patterns</SectionLabel>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.procurement_patterns.map((p, i) => (
                    <div key={i} style={{
                      padding: "9px 13px", borderRadius: 8,
                      background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.12)",
                      fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.6,
                    }}>{p}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Where They Win */}
            {(data.industries_won_in.length > 0 || data.size_bands_won_in.length > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {data.industries_won_in.length > 0 && (
                  <div>
                    <SectionLabel>Industries Where They Win</SectionLabel>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {data.industries_won_in.map(ind => (
                        <div key={ind} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Building2 style={{ width: 10, height: 10, color: GOLD }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{ind}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.size_bands_won_in.length > 0 && (
                  <div>
                    <SectionLabel>Size Segments Won</SectionLabel>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {data.size_bands_won_in.map(s => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Users style={{ width: 10, height: 10, color: BLUE }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Losses */}
            {data.recent_losses.length > 0 && (
              <div>
                <SectionLabel>Recent Losses Against Them</SectionLabel>
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.recent_losses.map((r, i) => (
                    <div key={i} style={{
                      padding: 12, borderRadius: 10,
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>
                          {r.employer_name || "Unknown Employer"}
                        </span>
                        {r.contract_value && (
                          <span style={{ fontSize: 10, color: GOLD, marginLeft: "auto" }}>
                            {fmtMoney(r.contract_value)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {r.industry && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{r.industry}</span>}
                        {r.participants && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{r.participants.toLocaleString()} members</span>}
                        {r.decision_date && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{r.decision_date}</span>}
                      </div>
                      {r.lessons_learned && (
                        <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.45)", fontStyle: "italic", lineHeight: 1.5 }}>
                          "{r.lessons_learned}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div style={{
              padding: 14, borderRadius: 10,
              background: "rgba(255,184,0,0.05)", border: "1px solid rgba(255,184,0,0.15)",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Zap style={{ width: 14, height: 14, color: GOLD, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                Log more outcomes in{" "}
                <Link href="/rfp-intelligence" style={{ color: GOLD }}>RFP Intelligence OS</Link>
                {" "}to improve counter-positioning accuracy.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
