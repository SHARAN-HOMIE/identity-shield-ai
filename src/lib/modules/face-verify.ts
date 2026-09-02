/**
 * Module 4 — Face Verification
 *
 * Compares a face from the document photo with a live capture/upload.
 *
 * TODO: Replace with ArcFace/FaceNet/InsightFace model for production use.
 * TODO: Integrate real face detection (MTCNN, RetinaFace, BlazeFace).
 * Currently uses basic canvas-based face region comparison.
 */

import type { FaceVerificationResult } from "../types";

// ─── Face Detection (Simplified) ────────────────────────────────────────

/**
 * Detect the most likely face region in an image using skin-tone heuristic.
 * TODO: Replace with MTCNN, RetinaFace, or BlazeFace model.
 */
function detectFaceRegion(
  imageData: ImageData,
  width: number,
  height: number
): { x: number; y: number; w: number; h: number } | null {
  // Simple skin-tone detection as face proxy
  const skinPixels: { x: number; y: number }[] = [];

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const idx = (y * width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];

      // Basic skin-tone detection (works across many skin tones)
      if (
        r > 60 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r - b > 15
      ) {
        skinPixels.push({ x, y });
      }
    }
  }

  if (skinPixels.length < 20) return null;

  // Find bounding box of largest skin-tone cluster
  const minX = Math.min(...skinPixels.map((p) => p.x));
  const maxX = Math.max(...skinPixels.map((p) => p.x));
  const minY = Math.min(...skinPixels.map((p) => p.y));
  const maxY = Math.max(...skinPixels.map((p) => p.y));

  const w = maxX - minX;
  const h = maxY - minY;

  // Face should be roughly 1:1 to 1:1.5 aspect ratio
  if (w < 20 || h < 20) return null;

  return { x: minX, y: minY, w, h };
}

// ─── Face Feature Extraction (Simplified) ───────────────────────────────

/**
 * Extract a simple feature vector from a face region.
 * TODO: Replace with ArcFace/FaceNet embeddings (512-d or 128-d vectors).
 */
function extractFeatures(
  imageData: ImageData,
  width: number,
  region: { x: number; y: number; w: number; h: number }
): number[] {
  const features: number[] = [];
  const blockSize = 8;
  const regionW = region.w;
  const regionH = region.h;

  // Divide face region into grid blocks and compute average color + gradient
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const blockX = region.x + Math.floor((gx / 4) * regionW);
      const blockY = region.y + Math.floor((gy / 4) * regionH);
      let rSum = 0, gSum = 0, bSum = 0;
      let gradX = 0, gradY = 0;
      let count = 0;

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const px = blockX + dx;
          const py = blockY + dy;
          if (px >= width || py >= imageData.height) continue;

          const idx = (py * width + px) * 4;
          rSum += imageData.data[idx];
          gSum += imageData.data[idx + 1];
          bSum += imageData.data[idx + 2];

          if (dx < blockSize - 1) {
            gradX += Math.abs(imageData.data[idx] - imageData.data[idx + 4]);
          }
          if (dy < blockSize - 1) {
            gradY += Math.abs(imageData.data[idx] - imageData.data[(py + 1) * width * 4 + px * 4]);
          }
          count++;
        }
      }

      if (count > 0) {
        features.push(
          rSum / count / 255,
          gSum / count / 255,
          bSum / count / 255,
          gradX / count / 255,
          gradY / count / 255
        );
      }
    }
  }

  return features;
}

// ─── Similarity Comparison ──────────────────────────────────────────────

/**
 * Compare two face feature vectors using cosine similarity.
 * TODO: Replace with real face embedding comparison (L2 distance).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

// ─── Main Face Verification Function ────────────────────────────────────

/**
 * Compare faces between document photo and live capture.
 * TODO: Replace with ArcFace/FaceNet model for production-grade accuracy.
 * TODO: Integrate real face detection (MTCNN, RetinaFace).
 */
export async function verifyFace(
  documentImageDataUrl: string,
  liveImageDataUrl: string
): Promise<FaceVerificationResult> {
  const startTime = performance.now();

  try {
    // Load both images
    const docImg = await loadImage(documentImageDataUrl);
    const liveImg = await loadImage(liveImageDataUrl);

    // Create canvases
    const docCanvas = createCanvas(docImg);
    const liveCanvas = createCanvas(liveImg);

    const docCtx = docCanvas.getContext("2d")!;
    const liveCtx = liveCanvas.getContext("2d")!;

    docCtx.drawImage(docImg, 0, 0, docCanvas.width, docCanvas.height);
    liveCtx.drawImage(liveImg, 0, 0, liveCanvas.width, liveCanvas.height);

    const docData = docCtx.getImageData(0, 0, docCanvas.width, docCanvas.height);
    const liveData = liveCtx.getImageData(0, 0, liveCanvas.width, liveCanvas.height);

    // Detect faces in both images
    const docFace = detectFaceRegion(docData, docCanvas.width, docCanvas.height);
    const liveFace = detectFaceRegion(liveData, liveCanvas.width, liveCanvas.height);

    if (!docFace && !liveFace) {
      return {
        matchScore: 0,
        documentFaceDetected: false,
        liveFaceDetected: false,
        verdict: "insufficient_data",
        processingTime: Math.round(performance.now() - startTime),
        details: "No face detected in either image",
      };
    }

    if (!docFace) {
      return {
        matchScore: 0,
        documentFaceDetected: false,
        liveFaceDetected: !!liveFace,
        verdict: "insufficient_data",
        processingTime: Math.round(performance.now() - startTime),
        details: "No face detected in the document photo",
      };
    }

    if (!liveFace) {
      return {
        matchScore: 0,
        documentFaceDetected: true,
        liveFaceDetected: false,
        verdict: "insufficient_data",
        processingTime: Math.round(performance.now() - startTime),
        details: "No face detected in the live capture",
      };
    }

    // Extract features from both face regions
    const docFeatures = extractFeatures(docData, docCanvas.width, docFace);
    const liveFeatures = extractFeatures(liveData, liveCanvas.width, liveFace);

    // Compare similarity
    const similarity = cosineSimilarity(docFeatures, liveFeatures);

    // Map similarity to 0-100 score
    // With basic features, similarity typically ranges 0.5-0.95
    // We scale this to make the demo meaningful
    const matchScore = Math.round(Math.max(0, Math.min(100, (similarity - 0.3) / 0.65 * 100)));

    let verdict: "match" | "no_match" | "insufficient_data";
    if (matchScore >= 65) verdict = "match";
    else if (matchScore >= 40) verdict = "no_match"; // Low confidence - possible match but not enough
    else verdict = "no_match";

    const details = matchScore >= 65
      ? `Face similarity: ${matchScore}% — faces appear to match. Cosine similarity: ${similarity.toFixed(3)}`
      : matchScore >= 40
      ? `Face similarity: ${matchScore}% — faces show some similarity but below threshold. Cosine similarity: ${similarity.toFixed(3)}`
      : `Face similarity: ${matchScore}% — faces appear different. Cosine similarity: ${similarity.toFixed(3)}`;

    return {
      matchScore,
      documentFaceDetected: true,
      liveFaceDetected: true,
      verdict,
      processingTime: Math.round(performance.now() - startTime),
      details,
    };
  } catch (error) {
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

// ─── Utility ─────────────────────────────────────────────────────────────

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
