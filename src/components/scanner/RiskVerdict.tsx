import type { RiskScoreResult } from "@/lib/types";
import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

interface RiskVerdictProps {
  riskScore: RiskScoreResult;
}

export function RiskVerdict({ riskScore }: RiskVerdictProps) {
  const { compositeScore, riskLevel, breakdown, thresholds } = riskScore;

  const config = {
    green: {
      color: "text-risk-green",
      bg: "bg-risk-green/10",
      border: "border-risk-green/30",
      glow: "shadow-[0_0_30px_rgba(53,208,166,0.15)]",
      icon: CheckCircle2,
      label: "AUTO-CLEAR",
      desc: "Document passes all checks. No manual review needed.",
    },
    yellow: {
      color: "text-risk-yellow",
      bg: "bg-risk-yellow/10",
      border: "border-risk-yellow/30",
      glow: "shadow-[0_0_30px_rgba(242,184,75,0.15)]",
      icon: AlertTriangle,
      label: "MANUAL REVIEW",
      desc: "Some checks raised warnings. Flagged for human inspection.",
    },
    red: {
      color: "text-risk-red",
      bg: "bg-risk-red/10",
      border: "border-risk-red/30",
      glow: "shadow-[0_0_30px_rgba(239,93,93,0.15)]",
      icon: ShieldAlert,
      label: "FLAGGED",
      desc: "High risk detected. Document flagged for investigation.",
    },
  };

  const c = config[riskLevel];
  const Icon = c.icon;

  return (
    <div className={`rounded-2xl border ${c.border} ${c.glow} bg-scanner-surface/80 p-6 backdrop-blur-sm`}>
      <div className="flex items-start gap-4">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${c.bg}`}>
          <Icon className={`size-6 ${c.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className={`text-lg font-bold ${c.color}`}>{c.label}</h3>
            <span className={`rounded-md ${c.bg} px-2.5 py-0.5 text-xs font-bold ${c.color}`}>
              Score: {compositeScore}/100
            </span>
          </div>
          <p className="mt-1 text-sm text-scanner-muted">{c.desc}</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-scanner-bg">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${
              riskLevel === "green"
                ? "bg-risk-green"
                : riskLevel === "yellow"
                ? "bg-risk-yellow"
                : "bg-risk-red"
            }`}
            style={{ width: `${compositeScore}%` }}
          />
          {/* Threshold markers */}
          <div
            className="absolute top-0 h-full w-px bg-scanner-muted/50"
            style={{ left: `${thresholds.greenMax}%` }}
          />
          <div
            className="absolute top-0 h-full w-px bg-scanner-muted/50"
            style={{ left: `${thresholds.yellowMax}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-scanner-muted">
          <span>0 — Green</span>
          <span>{thresholds.greenMax} — Yellow</span>
          <span>{thresholds.yellowMax} — Red</span>
          <span>100</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="mt-5 rounded-xl bg-scanner-bg/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanner-muted mb-2">
          Score Breakdown
        </p>
        <div className="space-y-1.5">
          {breakdown.filter(Boolean).map((line, i) => (
            <p key={i} className="text-xs text-scanner-text/80 font-mono leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
