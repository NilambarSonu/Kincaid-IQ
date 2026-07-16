import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldAlert, Building2, ArrowLeft, TrendingUp, MapPin, Users,
  DollarSign, ChevronRight, Loader2,
} from "lucide-react";

const NEON = {
  green: "#00FF94", gold: "#FFB800", red: "#FF4D6D",
  orange: "#FF6B1A", blue: "#00D4FF", purple: "#A855F7",
};

const RATING_COLOR: Record<string, string> = {
  excellent: NEON.green, good: "#A3E635", fair: NEON.gold,
  concern: NEON.orange, red_flag: NEON.red,
};

type Profile = {
  slug: string; carrier: string; sbi_score: number; rating: string;
  summary: {
    employers_touched: number; filings_analyzed: number;
    total_commissions: number; total_admin: number; total_income: number;
    lives_covered: number; avg_pct_income: number; year_range: string;
  };
  top_employers: { ein: string; sponsor: string; state: string; total_commissions: number; avg_pct_income: number }[];
  state_distribution: { state: string; employers: number }[];
  yearly: { year: number; employers: number; commissions: number; avg_pct_income: number }[];
};

const fmt$ = (n: number) =>
  n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(1)}B`
  : n >= 1_000_000   ? `$${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000       ? `$${(n / 1_000).toFixed(0)}K`
  : `$${n.toFixed(0)}`;

export default function SbiBrokerProfile() {
  const params = useParams();
  const slug = params.slug as string;

  const { data, isLoading, error } = useQuery<Profile>({
    queryKey: ["/api/shady-broker/broker", slug],
    queryFn: async () => {
      const r = await fetch(`/api/shady-broker/broker/${slug}`);
      if (!r.ok) throw new Error("Profile not found");
      return r.json();
    },
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center text-zinc-500" style={{ background: "#F8FAFC" }}>
      <Loader2 className="w-5 h-5 animate-spin mr-3" /> Loading broker profile…
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-zinc-500" style={{ background: "#F8FAFC" }}>
      <ShieldAlert className="w-10 h-10 mb-3" style={{ color: NEON.red }} />
      <div>Broker profile not found.</div>
      <Link href="/sbi" data-testid="link-sbi-back" className="mt-4 text-xs underline" style={{ color: NEON.gold }}>← Back to SBI</Link>
    </div>
  );

  const ratingColor = RATING_COLOR[data.rating] ?? NEON.gold;
  const maxYearComm = Math.max(...data.yearly.map(y => y.commissions), 1);
  const maxStateN = Math.max(...data.state_distribution.map(s => s.employers), 1);

  return (
    <div className="min-h-screen text-[var(--kiq-ink)]" style={{ background: "#F8FAFC" }}>
      <div className="sticky top-0 z-10 px-8 py-3 flex items-center justify-between"
        style={{ background: "rgba(3,3,8,0.85)", backdropFilter: "blur(12px)",
                 borderBottom: "1px solid #f1f5f9" }}>
        <Link href="/sbi" data-testid="link-back-sbi"
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-[var(--kiq-ink)]">
          <ArrowLeft className="w-3.5 h-3.5" /> BCI
        </Link>
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4" style={{ color: NEON.red }} />
          <span className="text-xs font-black tracking-tight">BROKER COMPENSATION INDEX™</span>
        </div>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden" style={{
        background: "linear-gradient(135deg, #000 0%, #1a0014 50%, #000 100%)",
        borderBottom: `1px solid ${ratingColor}40`,
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(ellipse at 80% 50%, ${ratingColor}15 0%, transparent 60%)`,
        }} />
        <div className="relative px-8 py-10 max-w-6xl mx-auto">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4" style={{ color: NEON.purple }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Broker Intelligence Profile</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter" data-testid="text-broker-name">{data.carrier}</h1>
              <p className="text-xs text-zinc-500 mt-2">
                {data.summary.employers_touched.toLocaleString()} employers · {data.summary.lives_covered.toLocaleString()} lives · {data.summary.year_range}
              </p>
            </div>
            <div className="text-right">
              <div className="text-7xl font-black leading-none" style={{ color: ratingColor, textShadow: `0 0 28px ${ratingColor}66` }}>
                {data.sbi_score}
              </div>
              <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: ratingColor }}>SBI · {data.rating.toUpperCase().replace("_"," ")}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8 pt-6"
            style={{ borderTop: "1px solid #f8fafc" }}>
            {[
              { label: "EMPLOYERS",     value: data.summary.employers_touched.toLocaleString(), color: NEON.blue, icon: Building2 },
              { label: "LIVES",         value: data.summary.lives_covered.toLocaleString(),     color: NEON.purple, icon: Users },
              { label: "TOTAL COMM",    value: fmt$(data.summary.total_commissions),            color: NEON.red, icon: DollarSign },
              { label: "TOTAL ADMIN",   value: fmt$(data.summary.total_admin),                  color: NEON.orange, icon: DollarSign },
              { label: "AVG % INCOME",  value: `${data.summary.avg_pct_income.toFixed(2)}%`,    color: NEON.gold, icon: TrendingUp },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label}>
                <div className="flex items-center gap-1.5 mb-1"><Icon className="w-3 h-3" style={{ color }} /></div>
                <div className="text-xl font-black" style={{ color }}>{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
        {/* Yearly trend */}
        <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-5">Commission Volume by Year</div>
          <div className="flex items-end gap-3 h-40">
            {data.yearly.map(y => {
              const h = Math.max(6, (y.commissions / maxYearComm) * 100);
              return (
                <div key={y.year} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="text-[10px] font-bold" style={{ color: NEON.gold }}>{fmt$(y.commissions)}</div>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, background: NEON.red, boxShadow: `0 0 12px ${NEON.red}55`, minHeight: 6 }} />
                  <div className="text-[10px] text-zinc-500">{y.year}</div>
                  <div className="text-[9px] text-zinc-600">{y.employers} ER</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Two columns: top employers + state distribution */}
        <div className="grid md:grid-cols-2 gap-5">
          <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
              style={{ borderBottom: "1px solid #f1f5f9" }}>
              Top Employer Plans (by commission)
            </div>
            <ul>
              {data.top_employers.slice(0, 12).map((e, i) => (
                <li key={e.ein} className="px-5 py-3 flex items-center gap-3 border-t hover:bg-[var(--kiq-surface)]/5"
                  style={{ borderColor: "#0F172A" }}>
                  <span className="w-5 text-right text-[10px] font-mono text-zinc-600">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-[var(--kiq-ink)] truncate" data-testid={`employer-${e.ein}`}>{e.sponsor}</div>
                    <div className="text-[10px] text-zinc-600">{e.state} · EIN {e.ein}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black" style={{ color: NEON.red }}>{fmt$(e.total_commissions)}</div>
                    <div className="text-[9px] text-zinc-600 uppercase tracking-widest">{e.avg_pct_income.toFixed(1)}%</div>
                  </div>
                  <Link href="/shady-broker-index"><ChevronRight className="w-3.5 h-3.5 text-zinc-700" /></Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500"
              style={{ borderBottom: "1px solid #f1f5f9" }}>
              <MapPin className="inline w-3 h-3 mr-1.5" /> State Footprint
            </div>
            <div className="p-5 space-y-2">
              {data.state_distribution.map(s => {
                const w = (s.employers / maxStateN) * 100;
                return (
                  <div key={s.state} className="flex items-center gap-3">
                    <div className="w-10 font-mono text-xs font-bold text-zinc-400">{s.state}</div>
                    <div className="flex-1 h-6 rounded relative overflow-hidden" style={{ background: "#ffffff" }}>
                      <div className="h-full" style={{ width: `${w}%`, background: NEON.blue, boxShadow: `0 0 8px ${NEON.blue}55` }} />
                      <div className="absolute inset-0 px-3 flex items-center justify-end">
                        <span className="text-[10px] font-bold text-[var(--kiq-ink)]">{s.employers}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="text-[10px] text-zinc-600 text-center pt-4">
          All metrics derived from DOL Form 5500 Schedule H filings. SBI scores are risk indicators, not legal conclusions.
        </div>
      </div>
    </div>
  );
}
