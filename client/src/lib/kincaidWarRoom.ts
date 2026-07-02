import { KincaidCommitEngine, Tile, TileKpi, boardPackGate } from "./kincaidCommitEngine";
import { contexts, inputs } from "./kincaidDemoData";

export type WarRoomResult = {
  tiles: Tile[];
  ledger: ReturnType<KincaidCommitEngine["getProofLedger"]>;
  boardPack: { allowed: boolean; reasons: string[] };
  fiduciaryPosture: {
    score: number;
    deterministicCoverage: number;
    evidenceFreshness: number;
    governanceCompliance: number;
  };
};

export function buildWarRoom(): WarRoomResult {
  const engine = new KincaidCommitEngine();

  function resolveKpi(key: keyof typeof contexts, trend?: string): TileKpi {
    const ctx = contexts[key];
    const input = inputs[key];
    try {
      const claim = engine.evaluateAndCommit(ctx, input);
      return engine.claimToTileKpi(ctx, claim, trend);
    } catch (error) {
      const reasonCode     = error instanceof Error ? error.message : "UNKNOWN_BLOCK";
      const freshnessStatus = reasonCode === "EVIDENCE_STALE" ? "RED" : "YELLOW";
      return engine.createBlockedKpi(ctx, input, reasonCode, input.verified_status, freshnessStatus);
    }
  }

  const populationPrimary = resolveKpi("POP_INDEX_PEER",          "+3.2 QoQ");
  const dragPrimary       = resolveKpi("CURRENT_EBITDA_DRAG",     "+9.1% YoY");
  const recoverableBase   = resolveKpi("RECOVERABLE_RANGE_BASE",  "Base case");
  const riskPrimary       = resolveKpi("EBITDA_AT_RISK_12M",      "+14.2% exposure");

  // Show recoverable as a range if allowed
  const recoverableDisplay: TileKpi = recoverableBase.policy.allowed
    ? { ...recoverableBase, display_value: `$840K – ${recoverableBase.display_value}` }
    : recoverableBase;

  const tiles: Tile[] = [
    {
      id: "population",
      title: "Population Health Index",
      primary: populationPrimary,
      supporting: [
        resolveKpi("MEMBER_MONTHS"),
        resolveKpi("RISK_CONCENTRATION_80_20"),
        resolveKpi("DISRUPTION_RATE"),
      ],
    },
    {
      id: "drag",
      title: "Current EBITDA Drag",
      primary: dragPrimary,
      supporting: [
        resolveKpi("ADMIN_FEE_PEPY"),
        resolveKpi("PBM_NET_COST_PER_RXMM"),
        resolveKpi("STOPLOSS_EFFICIENCY_INDEX"),
      ],
    },
    {
      id: "recoverable",
      title: "Recoverable EBITDA",
      primary: recoverableDisplay,
      supporting: [
        resolveKpi("GUARANTEE_ATTAINMENT"),
        resolveKpi("OVERBILLING_SIGNAL"),
      ],
    },
    {
      id: "risk",
      title: "EBITDA At Risk",
      primary: riskPrimary,
      supporting: [
        resolveKpi("CONTRACT_OPACITY_SCORE"),
        resolveKpi("VENDOR_COMP_LEAKAGE_RISK"),
      ],
    },
  ];

  const allKpis              = tiles.flatMap((t) => [t.primary, ...t.supporting]);
  const boardPack            = boardPackGate(allKpis, engine.ledger);
  const ledger               = engine.getProofLedger();
  const deterministicCoverage = 100;
  const evidenceFreshness    = (allKpis.filter((k) => k.policy.freshness_status === "GREEN").length / allKpis.length) * 100;
  const governanceCompliance  = (allKpis.filter((k) => k.policy.allowed).length / allKpis.length) * 100;
  const fiduciaryPostureScore = deterministicCoverage * 0.4 + evidenceFreshness * 0.35 + governanceCompliance * 0.25;

  return {
    tiles,
    ledger,
    boardPack,
    fiduciaryPosture: {
      score:                  Number(fiduciaryPostureScore.toFixed(1)),
      deterministicCoverage,
      evidenceFreshness:      Number(evidenceFreshness.toFixed(1)),
      governanceCompliance:   Number(governanceCompliance.toFixed(1)),
    },
  };
}

// Run once at module load — synchronous, < 1ms
export const WAR_ROOM = buildWarRoom();
