import { AnimatePresence, motion } from "framer-motion";
import {
  X, ChevronRight, ChevronLeft, FileText, Shield,
  TrendingUp, TrendingDown, Hash, Building2, Calendar,
  ClipboardList, Layers, ArrowRight, SearchCheck,
  BookOpen, Scale, Receipt, AlertCircle, Fingerprint,
} from "lucide-react";
import { useDrillDown } from "@/hooks/useDrillDown";
import { DrillNode, EvidenceType } from "@/lib/drillDownData";

const LEVEL_COLORS = [
  "#00A8FF",
  "#FFB800",
  "#00FF94",
  "#A855F7",
  "#FF4D6D",
  "#00E5FF",
  "#F472B6",
];

const EVIDENCE_ICONS: Record<EvidenceType, typeof FileText> = {
  "broker-confirm": ClipboardList,
  "fund-statement": BookOpen,
  "appraisal": Building2,
  "valuation": Scale,
  "regulatory": Shield,
  "audit": SearchCheck,
  "legal": Scale,
  "tax": Receipt,
};

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  "broker-confirm": "Broker Confirmation",
  "fund-statement": "Fund Statement",
  "appraisal": "Property Appraisal",
  "valuation": "Valuation Report",
  "regulatory": "Regulatory Filing",
  "audit": "Audit Report",
  "legal": "Legal Document",
  "tax": "Tax Document",
};

function EvidenceCard({ node }: { node: DrillNode }) {
  const type = node.evidenceType ?? "audit";
  const Icon = EVIDENCE_ICONS[type];
  return (
    <div
      className="rounded-xl p-4 flex gap-4"
      style={{
        background: "rgba(0,255,148,0.04)",
        border: "1px solid rgba(0,255,148,0.15)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "rgba(0,255,148,0.08)", color: "#00FF94" }}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className="text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,255,148,0.1)", color: "#00FF94", border: "1px solid rgba(0,255,148,0.2)" }}
          >
            {EVIDENCE_LABELS[type]}
          </span>
          {node.date && (
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Calendar size={9} />
              {node.date}
            </span>
          )}
        </div>
        <p className="text-xs font-semibold text-white mb-1">{node.label}</p>
        {node.institution && (
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Issued by: <span className="text-white/70">{node.institution}</span>
          </p>
        )}
        {node.description && (
          <p className="text-[10px] leading-relaxed" style={{ color: "rgba(130,160,200,0.6)" }}>
            {node.description}
          </p>
        )}
        {node.refNumber && (
          <div className="mt-2 flex items-center gap-1.5">
            <Hash size={9} style={{ color: "rgba(0,255,148,0.5)" }} />
            <code
              className="text-[9px] font-mono"
              style={{ color: "rgba(0,255,148,0.7)" }}
            >
              {node.refNumber}
            </code>
          </div>
        )}
        {node.hash && (
          <div className="mt-1 flex items-center gap-1.5">
            <Fingerprint size={9} style={{ color: "rgba(130,160,200,0.4)" }} />
            <code className="text-[9px] font-mono" style={{ color: "rgba(130,160,200,0.4)" }}>
              SHA: {node.hash}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

function ChildCard({
  node,
  level,
  onClick,
}: {
  node: DrillNode;
  level: number;
  onClick: () => void;
}) {
  const accent = LEVEL_COLORS[level % LEVEL_COLORS.length];
  const hasChildren = node.children && node.children.length > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-all duration-200 group"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid rgba(255,255,255,0.06)`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = `${accent}08`;
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}28`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-white truncate">{node.label}</span>
            {node.badge && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${node.badgeAccent ?? accent}12`,
                  color: node.badgeAccent ?? accent,
                  border: `1px solid ${node.badgeAccent ?? accent}28`,
                }}
              >
                {node.badge}
              </span>
            )}
          </div>
          {node.value && (
            <p className="text-base font-bold mb-1" style={{ color: accent, fontFamily: "var(--font-display)" }}>
              {node.value}
            </p>
          )}
          {node.change !== undefined && (
            <p
              className="text-[10px] font-medium flex items-center gap-1"
              style={{ color: node.changePositive ? "#00FF94" : "#FF4D6D" }}
            >
              {node.changePositive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
              {node.change}
            </p>
          )}
          {node.meta && node.meta.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {node.meta.slice(0, 4).map((m) => (
                <div key={m.key} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground truncate">{m.key}:</span>
                  <span
                    className="text-[9px] font-semibold truncate"
                    style={{ color: m.positive === true ? "#00FF94" : m.positive === false ? "#FF4D6D" : "rgba(200,220,255,0.7)" }}
                  >
                    {m.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {hasChildren && (
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
            style={{ color: `${accent}60` }}
          >
            <ChevronRight size={14} />
          </div>
        )}
      </div>
    </button>
  );
}

export function DrillDownPanel() {
  const { state, drillInto, goBack, goToLevel, close } = useDrillDown();
  const { root, path, isOpen } = state;

  const currentLevel = path.length;
  const currentNode = path.length > 0 ? path[path.length - 1] : root;
  const accent = LEVEL_COLORS[currentLevel % LEVEL_COLORS.length];

  const children = currentLevel === 0
    ? root?.children ?? []
    : (path[path.length - 1]?.children ?? []);

  const evidenceChildren = children.filter((c) => c.isEvidence);
  const drillChildren = children.filter((c) => !c.isEvidence);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="dd-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={close}
          />

          {/* Panel */}
          <motion.div
            key="dd-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full z-50 flex flex-col w-full max-w-[520px]"
            style={{
              background: "rgba(3, 5, 28, 0.97)",
              backdropFilter: "blur(32px)",
              borderLeft: `1px solid ${accent}20`,
              boxShadow: `-12px 0 60px rgba(0,0,0,0.7), 0 0 40px ${accent}08`,
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 px-5 py-4 flex items-center gap-3"
              style={{ borderBottom: `1px solid ${accent}15`, background: `${accent}05` }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${accent}12`, color: accent }}
              >
                <Layers size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: `${accent}80` }}
                  >
                    Evidence Trail
                  </span>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${accent}14`, color: accent, border: `1px solid ${accent}25` }}
                  >
                    Level {currentLevel + 1} / 7
                  </span>
                </div>
              </div>
              <button
                onClick={close}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(130,160,200,0.6)" }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Breadcrumb */}
            {path.length > 0 && (
              <div
                className="flex-shrink-0 px-5 py-2 flex items-center gap-1 overflow-x-auto"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <button
                  onClick={() => goToLevel(0)}
                  className="text-[10px] text-muted-foreground hover:text-white transition-colors whitespace-nowrap"
                >
                  {root?.title}
                </button>
                {path.map((node, i) => (
                  <div key={node.id} className="flex items-center gap-1 min-w-0">
                    <ChevronRight size={9} className="text-muted-foreground flex-shrink-0" />
                    <button
                      onClick={() => goToLevel(i + 1)}
                      className="text-[10px] whitespace-nowrap hover:text-white transition-colors truncate max-w-[120px]"
                      style={{ color: i === path.length - 1 ? accent : "rgba(130,160,200,0.6)" }}
                    >
                      {node.label}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Current Node Header */}
            <div
              className="flex-shrink-0 px-5 py-5"
              style={{ borderBottom: `1px solid ${accent}10` }}
            >
              {currentLevel === 0 && root ? (
                <>
                  <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: `${accent}60` }}>
                    {root.subtitle}
                  </p>
                  <h2
                    className="text-2xl font-bold text-white mb-1"
                    style={{ fontFamily: "var(--font-display)", color: accent }}
                  >
                    {root.value ?? root.title}
                  </h2>
                  {root.change && (
                    <p
                      className="text-xs font-medium flex items-center gap-1 mb-2"
                      style={{ color: root.changePositive ? "#00FF94" : "#FF4D6D" }}
                    >
                      {root.changePositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {root.change}
                    </p>
                  )}
                  {root.description && (
                    <p className="text-[10px] leading-relaxed" style={{ color: "rgba(130,160,200,0.55)" }}>
                      {root.description}
                    </p>
                  )}
                </>
              ) : currentNode && 'label' in currentNode ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {currentNode.badge && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{
                          background: `${currentNode.badgeAccent ?? accent}12`,
                          color: currentNode.badgeAccent ?? accent,
                          border: `1px solid ${currentNode.badgeAccent ?? accent}25`,
                        }}
                      >
                        {currentNode.badge}
                      </span>
                    )}
                  </div>
                  <h2
                    className="text-xl font-bold text-white mb-1"
                    style={{ fontFamily: "var(--font-display)", color: accent }}
                  >
                    {currentNode.value ?? currentNode.label}
                  </h2>
                  {currentNode.change !== undefined && (
                    <p
                      className="text-xs font-medium flex items-center gap-1 mb-2"
                      style={{ color: currentNode.changePositive ? "#00FF94" : "#FF4D6D" }}
                    >
                      {currentNode.changePositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {currentNode.change}
                    </p>
                  )}
                  {currentNode.meta && currentNode.meta.length > 0 && (
                    <div
                      className="mt-2 p-3 rounded-xl grid grid-cols-2 gap-x-4 gap-y-1.5"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {currentNode.meta.map((m) => (
                        <div key={m.key}>
                          <span className="text-[9px] text-muted-foreground block">{m.key}</span>
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: m.positive === true ? "#00FF94" : m.positive === false ? "#FF4D6D" : "rgba(200,220,255,0.85)" }}
                          >
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-3">
              {/* Back button */}
              {path.length > 0 && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 text-xs font-medium mb-1 hover:opacity-80 transition-opacity"
                  style={{ color: `${accent}70` }}
                >
                  <ChevronLeft size={13} />
                  Back to {path.length > 1 ? path[path.length - 2].label : root?.title}
                </button>
              )}

              {/* Drill-down children */}
              {drillChildren.length > 0 && (
                <div className="space-y-2">
                  {drillChildren.length > 0 && (
                    <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: `${accent}50` }}>
                      {drillChildren[0]?.children?.length ? "Drill Deeper" : "Breakdown"}
                    </p>
                  )}
                  {drillChildren.map((child) => (
                    <ChildCard
                      key={child.id}
                      node={child}
                      level={currentLevel + 1}
                      onClick={() => {
                        if (child.children && child.children.length > 0) {
                          drillInto(child);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Evidence section */}
              {evidenceChildren.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px" style={{ background: "rgba(0,255,148,0.15)" }} />
                    <span
                      className="text-[9px] uppercase tracking-widest font-bold px-2"
                      style={{ color: "#00FF94" }}
                    >
                      Source Evidence
                    </span>
                    <div className="flex-1 h-px" style={{ background: "rgba(0,255,148,0.15)" }} />
                  </div>
                  <div className="space-y-2">
                    {evidenceChildren.map((ev) => (
                      <EvidenceCard key={ev.id} node={ev} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state — leaf node with no evidence yet */}
              {drillChildren.length === 0 && evidenceChildren.length === 0 && (
                <div
                  className="flex flex-col items-center justify-center py-12 text-center"
                  style={{ color: "rgba(130,160,200,0.3)" }}
                >
                  <AlertCircle size={28} className="mb-3" style={{ color: `${accent}30` }} />
                  <p className="text-xs font-medium">No further breakdown available</p>
                  <p className="text-[10px] mt-1">This is the most granular level for this data point.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)" }}
            >
              <div className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: "#00FF94" }}
                />
                <span className="text-[9px] font-medium" style={{ color: "rgba(0,255,148,0.6)" }}>
                  Immutable Evidence Trail · Kincaid RMC Record
                </span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full transition-all duration-200"
                    style={{
                      background: i <= currentLevel ? accent : "rgba(255,255,255,0.1)",
                      transform: i === currentLevel ? "scale(1.4)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
