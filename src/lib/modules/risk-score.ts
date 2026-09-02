/**
 * Module 5 — Risk Scoring
 *
 * Combines outputs from all four upstream modules into a single
 * composite risk score with a Green/Yellow/Red verdict.
 *
 * TODO: Replace with trained risk classifier (logistic regression / neural net).
 * Currently uses weighted scoring with configurable thresholds.
 */

import type {
  OCRResult,
  ValidationResult,
  TamperingResult,
  FaceVerificationResult,
  RiskScoreResult,
  RiskFactors,
} from "../types";
import { MODULE_CONFIG } from "../mock-db";

/**
 * Compute the final composite risk score from all module outputs.
 * TODO: Replace with trained risk classifier model.
 */
export function computeRiskScore(
  ocr: OCRResult,
  validation: ValidationResult,
  tampering: TamperingResult,
  faceVerification: FaceVerificationResult
): RiskScoreResult {
  const weights = MODULE_CONFIG.riskThresholds.weights;
  const { greenMax, yellowMax } = MODULE_CONFIG.riskThresholds;

  // ─── Factor Scores (all normalized to 0-1 where 1 = risky) ────────

  // OCR confidence: low confidence = higher risk
  const ocrRisk = 1 - ocr.confidence / 100;

  // Validation pass rate: low pass rate = higher risk
  const validationRisk = 1 - validation.passRate / 100;

  // Tampering score: already 0-100 (high = more tampering = more risky)
  const tamperingRisk = tampering.overallScore / 100;

  // Face match: low match = higher risk
  const faceRisk =
    faceVerification.verdict === "insufficient_data"
      ? 0.3 // Moderate risk when no face data
      : 1 - faceVerification.matchScore / 100;

  // Blacklist: binary risk factor
  const blacklistRisk = validation.blacklistHit ? 1 : 0;

  // ─── Composite Score ──────────────────────────────────────────────

  const compositeScore = Math.round(
    ocrRisk * weights.ocrConfidence * 100 +
    validationRisk * weights.validationPassRate * 100 +
    tamperingRisk * weights.tamperingScore * 100 +
    faceRisk * weights.faceMatchScore * 100 +
    blacklistRisk * weights.blacklistPenalty * 100
  );

  const clampedScore = Math.max(0, Math.min(100, compositeScore));

  // ─── Risk Classification ──────────────────────────────────────────

  let riskLevel: "green" | "yellow" | "red";
  if (clampedScore <= greenMax) {
    riskLevel = "green";
  } else if (clampedScore <= yellowMax) {
    riskLevel = "yellow";
  } else {
    riskLevel = "red";
  }

  // ─── Human-Readable Breakdown ────────────────────────────────────

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
  breakdown.push(`Verdict: ${riskLevel.toUpperCase()} (${clampedScore <= greenMax ? "Auto-clear" : clampedScore <= yellowMax ? "Manual review required" : "Flagged for investigation"})`);

  const factors: RiskFactors = {
    ocrConfidence: ocr.confidence,
    validationPassRate: validation.passRate,
    tamperingScore: tampering.overallScore,
    faceMatchScore: faceVerification.matchScore,
    blacklistHit: validation.blacklistHit,
  };

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
