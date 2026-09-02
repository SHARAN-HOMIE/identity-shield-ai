/**
 * Scanning Pipeline Orchestrator
 *
 * Runs all 5 modules in sequence and produces a unified ScanResult.
 * Each module is called independently so they can be parallelized
 * or skipped individually in future versions.
 */

import type { ScanResult } from "./types";
import { runOCR } from "./modules/ocr";
import { validateDocument } from "./modules/validation";
import { detectTampering } from "./modules/tampering";
import { verifyFace } from "./modules/face-verify";
import { computeRiskScore } from "./modules/risk-score";

export type PipelineProgress = {
  module: string;
  status: "running" | "complete" | "error";
  message: string;
};

/**
 * Run the full 5-module screening pipeline on an uploaded document.
 *
 * @param file - The uploaded document image
 * @param livePhotoDataUrl - Optional live photo for face verification
 * @param onProgress - Callback for progress updates
 * @returns Complete scan result with all module outputs
 */
export async function runPipeline(
  file: File,
  livePhotoDataUrl?: string | null,
  onProgress?: (progress: PipelineProgress) => void
): Promise<ScanResult> {
  const startTime = performance.now();
  const fileDataUrl = await fileToDataURL(file);

  // Module 1: OCR Extraction
  onProgress?.({ module: "OCR Extraction", status: "running", message: "Analyzing document text..." });
  const ocr = await runOCR(file);
  onProgress?.({ module: "OCR Extraction", status: "complete", message: `Extracted ${Object.keys(ocr.fields).length} fields (${ocr.confidence}% confidence)` });

  // Module 2: Document Validation
  onProgress?.({ module: "Document Validation", status: "running", message: "Running validation checks..." });
  const validation = await validateDocument(ocr);
  onProgress?.({ module: "Document Validation", status: "complete", message: `${validation.passRate}% pass rate — ${validation.checks.length} checks completed` });

  // Module 3: Tampering Detection
  onProgress?.({ module: "Tampering Detection", status: "running", message: "Computing ELA and metadata analysis..." });
  const tampering = await detectTampering(file, fileDataUrl);
  onProgress?.({ module: "Tampering Detection", status: "complete", message: `Tampering score: ${tampering.overallScore}/100` });

  // Module 4: Face Verification
  onProgress?.({ module: "Face Verification", status: "running", message: "Comparing document photo with live capture..." });
  let faceVerification;
  if (livePhotoDataUrl) {
    faceVerification = await verifyFace(fileDataUrl, livePhotoDataUrl);
  } else {
    faceVerification = {
      matchScore: 0,
      documentFaceDetected: false,
      liveFaceDetected: false,
      verdict: "insufficient_data" as const,
      processingTime: 0,
      details: "No live photo provided — face verification skipped",
    };
  }
  onProgress?.({ module: "Face Verification", status: "complete", message: faceVerification.details });

  // Module 5: Risk Scoring
  onProgress?.({ module: "Risk Scoring", status: "running", message: "Computing composite risk score..." });
  const riskScore = computeRiskScore(ocr, validation, tampering, faceVerification);
  onProgress?.({ module: "Risk Scoring", status: "complete", message: `Risk level: ${riskScore.riskLevel.toUpperCase()} (score: ${riskScore.compositeScore})` });

  const totalTime = Math.round(performance.now() - startTime);

  return {
    id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    timestamp: Date.now(),
    documentType: ocr.detectedType,
    fileName: file.name,
    originalImage: fileDataUrl,
    ocr,
    validation,
    tampering,
    faceVerification,
    riskScore,
    totalTime,
  };
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
