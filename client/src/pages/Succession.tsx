import { useState } from "react";
import { Layout } from "@/components/Layout";
import { successionData, formatCurrency } from "@/lib/mockData";
import { Shield, TrendingUp, Calendar, CheckCircle, Clock, AlertTriangle, Target } from "lucide-react";

const AREA_COLORS = ["#00A8FF","#00FF94","#FFB800","#A855F7","#FF4D6D","#00E5FF"];

function ReadinessRing({ score, color }: { score: number; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={72} height={72} className="flex-shrink-0">
      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
        strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={36} y={40} textAnchor="middle" fill={color} fontSize={13} fontWeight={700}>{score}</text>
    </svg>
  );
}

export default function Succession() {
  const [selectedHeir, setSelectedHeir] = useState(successionData.heirs[0].id);
  const heir = successionData.heirs.find(h => h.id === selectedHeir)!;

  return (
    <Layout>
      <div className="mb-8 animate-float-up">
        <p className="section-label mb-1">Family Office</p>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "hsl(var(--primary))" }}>
          Succession Readiness
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Next-generation trustee preparation, ownership transfer schedules, and readiness scoring</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {successionData.heirs.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelectedHeir(h.id)}
            className="metric-card text-left transition-all duration-200"
            style={{
              borderTop: `2px solid ${h.color}`,
              background: selectedHeir === h.id ? `rgba(${h.color.slice(1).match(/.{2}/g)!.map(hx=>parseInt(hx,16)).join(",")},0.06)` : undefined,
            }}
            data-testid={`card-heir-${h.id}`}>
            <div className="flex items-center gap-4">
              <ReadinessRing score={h.readinessScore} color={h.color} />
              <div>
                <p className="font-bold text-white text-lg">{h.name}</p>
                <p className="text-xs text-muted-foreground">{h.relation} · Age {h.age}</p>
                <p className="text-xs mt-1" style={{ color: h.color }}>Readiness: {h.readinessScore}/100</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Trustee eligible: {new Date(h.trusteeEligibility).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</p>
              </div>
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] text-muted-foreground mb-1">Next: {h.nextMilestone}</p>
              <div className="flex flex-wrap gap-1">
                {h.nominatedTrustee.map((t) => (
                  <span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: `${h.color}12`, color: h.color, border: `1px solid ${h.color}22` }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="metric-card" data-testid="card-readiness-areas">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${heir.color}12`, border: `1px solid ${heir.color}22` }}>
              <Target size={15} style={{ color: heir.color }} />
            </div>
            <div>
              <p className="font-bold text-white">{heir.name} — Readiness Areas</p>
              <p className="text-xs text-muted-foreground">6 core competency assessment</p>
            </div>
          </div>
          <div className="space-y-3">
            {heir.readinessAreas.map((area, i) => {
              const color = AREA_COLORS[i % AREA_COLORS.length];
              return (
                <div key={area.area}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-white">{area.area}</span>
                    <span className="text-xs font-bold" style={{ color }}>{area.score}/100</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${area.score}%`, background: color }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{area.notes}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="metric-card" data-testid="card-ownership-transfers">
          <p className="section-label mb-4">Ownership Transfer Schedule</p>
          <div className="space-y-3 mb-6">
            {heir.ownershipTransfer.map((t) => (
              <div key={t.entity} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-white">{t.entity}</p>
                  <span className="text-sm font-bold" style={{ color: heir.color }}>{t.pct}%</span>
                </div>
                <p className="text-xs text-muted-foreground">Scheduled transfer year: <span className="text-white font-semibold">{t.scheduledYear}</span></p>
              </div>
            ))}
          </div>
          <p className="section-label mb-3">Nominated Trustee Roles</p>
          <div className="space-y-2">
            {heir.nominatedTrustee.map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm">
                <Shield size={12} style={{ color: heir.color }} />
                <span className="text-white">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="metric-card" data-testid="card-succession-roadmap">
        <p className="section-label mb-4">Family Succession Roadmap</p>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="space-y-4 pl-10">
            {successionData.successionRoadmap.map((event, i) => (
              <div key={i} className="relative" data-testid={`roadmap-${i}`}>
                <div className={`absolute -left-6 w-3 h-3 rounded-full border-2`}
                  style={{
                    top: 4,
                    background: event.critical ? "#FFB800" : "#00A8FF",
                    borderColor: event.critical ? "#FFB800" : "#00A8FF",
                    boxShadow: event.critical ? "0 0 8px rgba(255,184,0,0.4)" : undefined,
                  }} />
                <div className="flex items-start gap-4">
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: event.critical ? "#FFB800" : "#00A8FF" }}>{event.year}</span>
                  <div>
                    <p className="text-sm text-white">{event.event}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold capitalize"
                        style={{
                          background: event.status === "upcoming" ? "rgba(255,77,109,0.08)" : "rgba(0,168,255,0.08)",
                          color: event.status === "upcoming" ? "#FF4D6D" : "#00A8FF",
                          border: `1px solid ${event.status === "upcoming" ? "rgba(255,77,109,0.2)" : "rgba(0,168,255,0.2)"}`,
                        }}>
                        {event.status}
                      </span>
                      {event.critical && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "#FFB800" }}>
                          <AlertTriangle size={8} /> Critical milestone
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
