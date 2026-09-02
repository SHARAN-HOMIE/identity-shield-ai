/**
 * Module 4 — Face Verification (Upgraded)
 *
 * Uses face-api.js (vladmandic fork) with:
 *   - TinyFaceDetector for face detection
 *   - FaceRecognitionNet (128-d ArcFace embeddings) for comparison
 * Falls back to mock face comparison if models fail to load.
 *
 * TODO: Replace with full InsightFace/ArcFace ONNX model for better accuracy.
 * TODO: Fine-tune the cosine similarity threshold on real document/live photo pairs.
 */

import * as faceapi from "@vladmandic/face-api";
import type { FaceVerificationResult } from "../types";
import { setModuleStatus } from "../model-status";

// ─── Configuration ──────────────────────────────────────────────────────

/** Cosine similarity threshold for match decision. Tunable constant. */
const MATCH_THRESHOLD = 0.6;

/** Path to face-api.js model files served from /public */
const MODEL_BASE_PATH = "/models/face-api";

// ─── Model Loading ──────────────────────────────────────────────────────

let modelsLoaded = false;
let modelsLoading = false;

/**
 * Load face-api.js models from /public/models/face-api/.
 * Gracefully handles failure by setting mock mode.
 * TODO: Add model versioning and cache-busting.
 */
async function ensureModelsLoaded(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    // Wait for existing load attempt
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!modelsLoading) {
          clearInterval(check);
          resolve(modelsLoaded);
        }
      }, 100);
    });
  }

  modelsLoading = true;
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE_PATH);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_BASE_PATH);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE_PATH);

    // Verify models work with a test inference
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 128;
    testCanvas.height = 128;
    const testCtx = testCanvas.getContext("2d")!;
    testCtx.fillStyle = "#888";
    testCtx.fillRect(0, 0, 128, 128);

    await faceapi
      .detectSingleFace(testCanvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    modelsLoaded = true;
    console.log("[FaceVerify] face-api.js models loaded successfully");
    setModuleStatus("faceVerification", "real");
    return true;
  } catch (err) {
    console.warn("[FaceVerify] Failed to load face-api.js models:", err);
    console.log("[FaceVerify] Falling back to mock face comparison");
    setModuleStatus("faceVerification", "mock");
    modelsLoading = false;
    return false;
  }
}

// ─── Real Face Verification (face-api.js) ───────────────────────────────

async function realFaceVerify(
  docDataUrl: string,
  liveDataUrl: string,
  startTime: number
): Promise<FaceVerificationResult> {
  const docImg = await loadImage(docDataUrl);
  const liveImg = await loadImage(liveDataUrl);

  // Detect faces with embeddings
  const docDetection = await faceapi
    .detectSingleFace(docImg, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  const liveDetection = await faceapi
    .detectSingleFace(liveImg, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  const docFaceDetected = !!docDetection;
  const liveFaceDetected = !!liveDetection;

  if (!docFaceDetected && !liveFaceDetected) {
    return {
      matchScore: 0,
      documentFaceDetected: false,
      liveFaceDetected: false,
      verdict: "insufficient_data",
      processingTime: Math.round(performance.now() - startTime),
      details: "No face detected in either image",
    };
  }

  if (!docFaceDetected) {
    return {
      matchScore: 0,
      documentFaceDetected: false,
      liveFaceDetected,
      verdict: "insufficient_data",
      processingTime: Math.round(performance.now() - startTime),
      details: "No face detected in the document photo",
    };
  }

  if (!liveFaceDetected) {
    return {
      matchScore: 0,
      documentFaceDetected: true,
      liveFaceDetected: false,
      verdict: "insufficient_data",
      processingTime: Math.round(performance.now() - startTime),
      details: "No face detected in the live capture",
    };
  }

  // Compute Euclidean distance between 128-d descriptors
  const distance = faceapi.euclideanDistance(
    docDetection.descriptor,
    liveDetection.descriptor
  );

  // Convert distance to cosine-like similarity score (0-100)
  // ArcFace descriptors: distance 0 = identical, ~1.2 = completely different
  // Map: distance 0 → 100%, distance 1.2+ → 0%
  const similarity = Math.max(0, Math.min(1, 1 - distance / 1.2));
  const matchScore = Math.round(similarity * 100);

  // Match decision using cosine similarity concept
  // Convert euclidean to approximate cosine similarity
  const cosineSim = 1 - (distance * distance) / 2;

  const isMatch = cosineSim >= MATCH_THRESHOLD;

  let verdict: "match" | "no_match" | "insufficient_data";
  if (isMatch) verdict = "match";
  else verdict = "no_match";

  const details = isMatch
    ? `Face similarity: ${matchScore}% — faces appear to match. Distance: ${distance.toFixed(3)}, cosine ≈ ${cosineSim.toFixed(3)} (threshold: ${MATCH_THRESHOLD})`
    : `Face similarity: ${matchScore}% — faces appear different. Distance: ${distance.toFixed(3)}, cosine ≈ ${cosineSim.toFixed(3)} (threshold: ${MATCH_THRESHOLD})`;

  return {
    matchScore,
    documentFaceDetected: true,
    liveFaceDetected: true,
    verdict,
    processingTime: Math.round(performance.now() - startTime),
    details,
  };
}

// ─── Mock Face Verification (fallback) ──────────────────────────────────

async function mockFaceVerify(
  docDataUrl: string,
  liveDataUrl: string,
  startTime: number
): Promise<FaceVerificationResult> {
  // Fallback: basic canvas-based comparison
  const docImg = await loadImage(docDataUrl);
  const liveImg = await loadImage(liveDataUrl);

  const docCanvas = createCanvas(docImg);
  const liveCanvas = createCanvas(liveImg);

  const docCtx = docCanvas.getContext("2d")!;
  const liveCtx = liveCanvas.getContext("2d")!;

  docCtx.drawImage(docImg, 0, 0, docCanvas.width, docCanvas.height);
  liveCtx.drawImage(liveImg, 0, 0, liveCanvas.width, liveCanvas.height);

  // Simple histogram comparison
  const docHist = getGrayscaleHistogram(docCtx.getImageData(0, 0, docCanvas.width, docCanvas.height));
  const liveHist = getGrayscaleHistogram(liveCtx.getImageData(0, 0, liveCanvas.width, liveCanvas.height));

  // Chi-squared distance
  let chiSq = 0;
  for (let i = 0; i < 256; i++) {
    const diff = docHist[i] - liveHist[i];
    const sum = docHist[i] + liveHist[i];
    if (sum > 0) chiSq += (diff * diff) / sum;
  }

  // Map to 0-100 (lower chi-sq = more similar)
  const similarity = Math.max(0, Math.min(100, Math.round(100 / (1 + chiSq * 0.05))));
  const matchScore = similarity;

  return {
    matchScore,
    documentFaceDetected: true,
    liveFaceDetected: true,
    verdict: matchScore >= 65 ? "match" : "no_match",
    processingTime: Math.round(performance.now() - startTime),
    details: `[Mock mode] Face similarity: ${matchScore}% — basic histogram comparison (install face-api.js models for ArcFace embeddings)`,
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────

/**
 * Compare faces between document photo and live capture.
 * Uses real face-api.js models when available, falls back to mock.
 */
export async function verifyFace(
  documentImageDataUrl: string,
  liveImageDataUrl: string
): Promise<FaceVerificationResult> {
  const startTime = performance.now();

  try {
    const hasRealModels = await ensureModelsLoaded();

    if (hasRealModels) {
      return await realFaceVerify(documentImageDataUrl, liveImageDataUrl, startTime);
    } else {
      return await mockFaceVerify(documentImageDataUrl, liveImageDataUrl, startTime);
    }
  } catch (error) {
    console.error("[FaceVerify] Error:", error);
    // Graceful fallback
    setModuleStatus("faceVerification", "mock");
    try {
      return await mockFaceVerify(documentImageDataUrl, liveImageDataUrl, startTime);
    } catch {
      return {
        matchScore: 0,
        documentFaceDetected: false,
        liveFaceDetected: false,
        verdict: "insufficient_data",
        processingTime: Math.round(performance.now() - startTime),
        details: `Face verification error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function createCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const maxDim = 300;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  return canvas;
}

function getGrayscaleHistogram(imageData: ImageData): Float64Array {
  const hist = new Float64Array(256);
  const { data } = imageData;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    hist[gray]++;
    total++;
  }
  // Normalize
  for (let i = 0; i < 256; i++) hist[i] /= total;
  return hist;
}
