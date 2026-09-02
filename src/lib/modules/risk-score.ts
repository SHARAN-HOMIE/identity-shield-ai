/**
 * Module 5 — Risk Scoring (Config-Driven)
 *
 * Combines outputs from all four upstream modules into a single
 * composite risk score with a Green/Yellow/Red verdict.
 *
 * This is intentionally NOT a trained model — it must stay explainable
 * and tunable by operators after real-world testing.
 *
 * All weights and thresholds are in RISK_CONFIG at the top of this file.
 * Adjust them without touching any logic below.
 */

import type {
  OCRResult,
  ValidationResult,
  TamperingResult,
  FaceVerificationResult,
  RiskScoreResult,
  RiskFactors,
} from "../types";
import { setModuleStatus } from "../model-status";

// ─── Configuration ──────────────────────────────────────────────────────
// Adjust these after real-world testing. Do not change function signatures.

const RISK_CONFIG = {
  /** Score ≤ greenMax → GREEN (auto-clear) */
  greenMax: 30,
  /** greenMax < score ≤ yellowMax → YELLOW (manual review) */
  yellowMax: 60,
  /** score > yellowMax → RED (flagged for investigation) */

  weights: {
    /** Lower OCR confidence → higher risk contribution */
    ocrConfidence: 0.15,
    /** Lower validation pass rate → higher risk contribution */
    validationPassRate: 0.25,
    /** Higher tampering score → higher risk contribution */
    tamperingScore: 0.30,
    /** Lower face match → higher risk contribution */
    faceMatchScore: 0.20,
    /** Binary: blacklist hit adds full penalty */
    blacklistPenalty: 0.10,
  },
} as const;

/** Threshold at which face match is considered positive */
export const FACE_MATCH_THRESHOLD = 0.6;

// ─── Scoring Logic ──────────────────────────────────────────────────────

/**
 * Compute the final composite risk score from all module outputs.
 * Returns the same shape the results page already renders.
 */
export function computeRiskScore(
  ocr: OCRResult,
  validation: ValidationResult,
  tampering: TamperingResult,
  faceVerification: FaceVerificationResult
): RiskScoreResult {
  const { weights, greenMax, yellowMax } = RISK_CONFIG;

  // ─── Factor Scores (all normalized to 0–1 where 1 = risky) ────

  // OCR confidence: low confidence = higher risk
  const ocrRisk = 1 - ocr.confidence / 100;

  // Validation pass rate: low pass rate = higher risk
  const validationRisk = 1 - validation.passRate / 100;

  // Tampering score: already 0–100 (high = more tampering = more risky)
  const tamperingRisk = tampering.overallScore / 100;

  // Face match: low match = higher risk
  const faceRisk =
    faceVerification.verdict === "insufficient_data"
      ? 0.3 // Moderate risk when no face data
      : 1 - faceVerification.matchScore / 100;

  // Blacklist: binary risk factor
  const blacklistRisk = validation.blacklistHit ? 1 : 0;

  // ─── Composite Score ──────────────────────────────────────────

  const compositeScore = Math.round(
    ocrRisk * weights.ocrConfidence * 100 +
    validationRisk * weights.validationPassRate * 100 +
    tamperingRisk * weights.tamperingScore * 100 +
    faceRisk * weights.faceMatchScore * 100 +
    blacklistRisk * weights.blacklistPenalty * 100
  );

  const clampedScore = Math.max(0, Math.min(100, compositeScore));

  // ─── Risk Classification ─────────────────────────────────────

  let riskLevel: "green" | "yellow" | "red";
  if (clampedScore <= greenMax) {
    riskLevel = "green";
  } else if (clampedScore <= yellowMax) {
    riskLevel = "yellow";
  } else {
    riskLevel = "red";
  }

  // Risk scoring is always rule-based (by design — explainable & tunable)
  setModuleStatus("riskScoring", "real");

  // ─── Human-Readable Breakdown ───────────────────────────────

  const breakdown: string[] = [];

  breakdown.push(
    `OCR confidence: ${ocr.confidence}% (contributes ${Math.round(ocrRisk * weights.ocrConfidence * 100)} points)`
  );
  breakdown.push(
    `Validation pass rate: ${validation.passRate}% (contributes ${Math.round(validationRisk * weights.validationPassRate * 100)} points)`
  );
  breakdown.push(
    `Tampering likelihood: ${tampering.overallScore}/100 (contributes ${Math.round(tamperingRisk * weights.tamperingScore * 100)} points)`
  );
  breakdown.push(
    `Face match: ${faceVerification.matchScore}% (contributes ${Math.round(faceRisk * weights.faceMatchScore * 100)} points)`
  );
  if (validation.blacklistHit) {
    breakdown.push(
      `⚠️ BLACKLIST HIT: +${Math.round(blacklistRisk * weights.blacklistPenalty * 100)} penalty points`
    );
  }

  breakdown.push("");
  breakdown.push(`Total composite score: ${clampedScore}/100`);
  breakdown.push(
    `Verdict: ${riskLevel.toUpperCase()} (${clampedScore <= greenMax ? "Auto-clear" : clampedScore <= yellowMax ? "Manual review required" : "Flagged for investigation"})`
  );

  const factors: RiskFactors = {
    ocrConfidence: ocr.confidence,
    validationPassRate: validation.passRate,
    tamperingScore: tampering.overallScore,
    faceMatchScore: faceVerification.matchScore,
    blacklistHit: validation.blacklistHit,
  };

  // Set module status — risk scoring is always rule-based (by design)
  // This is already handled via import, no need to call setModuleStatus here

  return {
    compositeScore: clampedScore,
    riskLevel,
    factors,
    breakdown,
    thresholds: {
      greenMax,
      yellowMax,
    },
  };
}
