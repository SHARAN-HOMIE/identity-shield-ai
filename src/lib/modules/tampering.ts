/**
 * Module 3 — Tampering Detection (Upgraded)
 *
 * Combines:
 *   1. Real CNN patch classification (from trained tampering CNN)
 *   2. Error Level Analysis (ELA heatmap)
 *   3. Metadata / EXIF analysis
 *   4. Copy-move forgery detection
 *
 * Falls back to mock mode if the trained CNN is not available.
 * All existing ELA/metadata/copy-move logic is retained and weighted
 * alongside the CNN scores.
 *
 * TODO: Replace with ensemble of trained tampering models.
 * TODO: Add real SIFT/SuperPoint for copy-move detection.
 */

import type {
  TamperingResult,
  TamperingSubCheck,
} from "../types";
import {
  loadTamperingModel,
  predictPatches,
  extractPatchesFromDocument,
  isTamperingModelReady,
} from "../tampering-cnn";
import { setModuleStatus } from "../model-status";

// ─── Error Level Analysis (ELA) ─────────────────────────────────────────

/**
 * Compute Error Level Analysis: re-compress the image at a known JPEG quality,
 * compute the pixel difference, and return both the heatmap and a score.
 * TODO: Replace with trained ELA model for more accurate tampering detection.
 */
async function computeELA(
  imageDataUrl: string,
  quality = 75
): Promise<{ heatmap: string; score: number; details: string }> {
  const img = await loadImage(imageDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const recompressedDataUrl = canvas.toDataURL("image/jpeg", quality / 100);
  const recompressedImg = await loadImage(recompressedDataUrl);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(recompressedImg, 0, 0);
  const recompressedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const diffData = ctx.createImageData(canvas.width, canvas.height);
  let totalDiff = 0;
  const diffValues: number[] = [];

  for (let i = 0; i < originalData.data.length; i += 4) {
    const rDiff = Math.abs(originalData.data[i] - recompressedData.data[i]);
    const gDiff = Math.abs(originalData.data[i + 1] - recompressedData.data[i + 1]);
    const bDiff = Math.abs(originalData.data[i + 2] - recompressedData.data[i + 2]);
    const avgDiff = (rDiff + gDiff + bDiff) / 3;

    totalDiff += avgDiff;
    diffValues.push(avgDiff);

    const scaled = Math.min(255, avgDiff * 5);
    diffData.data[i] = scaled;
    diffData.data[i + 1] = scaled * 0.3;
    diffData.data[i + 2] = scaled * 0.1;
    diffData.data[i + 3] = 255;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(diffData, 0, 0);

  const heatmap = canvas.toDataURL("image/png");

  const pixelCount = diffValues.length;
  const avgDiff = totalDiff / pixelCount;
  const variance =
    diffValues.reduce((sum, v) => sum + Math.pow(v - avgDiff, 2), 0) / pixelCount;
  const stdDev = Math.sqrt(variance);

  const score = Math.min(100, Math.round(stdDev * 2.5));

  const details = avgDiff < 2
    ? "Very low error levels — image appears uniformly compressed (likely original)"
    : avgDiff < 5
    ? "Low error levels — minor compression artifacts detected"
    : avgDiff < 15
    ? "Moderate error levels — some regions show higher compression error (possible edits)"
    : "High error levels — significant pixel differences in some regions (likely tampered)";

  return { heatmap, score, details };
}

// ─── Metadata / EXIF Check ──────────────────────────────────────────────

async function analyzeMetadata(
  file: File
): Promise<{ flags: string[]; score: number; details: string }> {
  const flags: string[] = [];
  let score = 0;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);

    const isJPEG = view.getUint16(0) === 0xffd8;
    const hasEXIF = isJPEG && view.getUint16(2) === 0xffe1;

    if (!hasEXIF) {
      if (isJPEG) {
        flags.push("JPEG image has no EXIF metadata — metadata may have been stripped");
        score += 25;
      } else {
        flags.push("Non-JPEG format — EXIF analysis limited");
        score += 5;
      }
    }

    const fileName = file.name.toLowerCase();
    if (fileName.includes("edit") || fileName.includes("copy") || fileName.includes("modified")) {
      flags.push(`Filename "${file.name}" suggests the file may be a copy or edit`);
      score += 15;
    }

    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 10) {
      flags.push("Unusually small file size — may be a thumbnail or low-quality image");
      score += 10;
    }

    if (hasEXIF) {
      try {
        const exifOffset = 4;
        const segmentLength = view.getUint16(exifOffset + 2);
        const exifBytes = new Uint8Array(arrayBuffer, exifOffset, segmentLength);
        const exifString = new TextDecoder("ascii", { fatal: false }).decode(exifBytes);

        const editingSoftware = [
          "photoshop", "gimp", "paint.net", "lightroom",
          "capture one", "affinity", "snapseed", "pixlr",
          "canva", "remove.bg", "removing",
        ];

        for (const sw of editingSoftware) {
          if (exifString.toLowerCase().includes(sw)) {
            flags.push(`Editing software detected in metadata: "${sw}"`);
            score += 20;
          }
        }

        if (exifString.includes("20") && exifString.includes(":")) {
          const dateMatch = exifString.match(/(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
          if (dateMatch) {
            const year = parseInt(dateMatch[1]);
            const now = new Date();
            if (year > now.getFullYear() + 5) {
              flags.push(`Suspicious timestamp: ${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]} (far future)`);
              score += 10;
            }
            if (year < 1990) {
              flags.push(`Suspicious timestamp: ${dateMatch[1]} (before 1990)`);
              score += 10;
            }
          }
        }

        if (segmentLength < 50) {
          flags.push("Minimal EXIF data — most metadata fields are empty or missing");
          score += 10;
        }
      } catch {
        flags.push("Could not fully parse EXIF data — format may be non-standard");
        score += 5;
      }
    }

    if (!isJPEG) {
      const isPNG = view.getUint16(0) === 0x8950;
      if (isPNG) {
        flags.push("PNG format — may be a screenshot rather than a scan/photo");
        score += 10;
      }
    }
  } catch {
    flags.push("Could not read file metadata — file may be corrupted");
    score += 15;
  }

  score = Math.min(100, score);
  const details = flags.length === 0
    ? "No metadata anomalies detected"
    : `${flags.length} metadata flag(s) raised`;

  return { flags, score, details };
}

// ─── Copy-Move Forgery Detection ────────────────────────────────────────

async function detectCopyMove(
  imageDataUrl: string
): Promise<{ score: number; details: string }> {
  const img = await loadImage(imageDataUrl);
  const blockSize = 16;
  const canvas = document.createElement("canvas");

  const maxDim = 400;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blocks: { x: number; y: number; hash: string }[] = [];

  for (let y = 0; y < canvas.height - blockSize; y += blockSize) {
    for (let x = 0; x < canvas.width - blockSize; x += blockSize) {
      let rSum = 0, gSum = 0, bSum = 0;
      let rGradX = 0, gGradX = 0;
      const pixels = blockSize * blockSize;

      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((y + dy) * canvas.width + (x + dx)) * 4;
          rSum += imageData.data[idx];
          gSum += imageData.data[idx + 1];
          bSum += imageData.data[idx + 2];

          if (dx < blockSize - 1) {
            rGradX += Math.abs(imageData.data[idx] - imageData.data[idx + 4]);
            gGradX += Math.abs(imageData.data[idx + 1] - imageData.data[idx + 5]);
          }
        }
      }

      const hash = `${Math.round(rSum / pixels)},${Math.round(gSum / pixels)},${Math.round(bSum / pixels)},${Math.round(rGradX / pixels)},${Math.round(gGradX / pixels)}`;
      blocks.push({ x, y, hash });
    }
  }

  const hashBlocks = new Map<string, { x: number; y: number }[]>();
  for (const block of blocks) {
    const existing = hashBlocks.get(block.hash) || [];
    existing.push({ x: block.x, y: block.y });
    hashBlocks.set(block.hash, existing);
  }

  let duplicatePairs = 0;
  for (const [, blockList] of hashBlocks) {
    if (blockList.length > 1) {
      for (let i = 0; i < blockList.length; i++) {
        for (let j = i + 1; j < blockList.length; j++) {
          const dist = Math.sqrt(
            Math.pow(blockList[i].x - blockList[j].x, 2) +
            Math.pow(blockList[i].y - blockList[j].y, 2)
          );
          if (dist > blockSize * 3) {
            duplicatePairs++;
          }
        }
      }
    }
  }

  const totalBlocks = blocks.length;
  const suspiciousRatio = totalBlocks > 0 ? duplicatePairs / totalBlocks : 0;
  const score = Math.min(100, Math.round(suspiciousRatio * 500));

  const details = score < 10
    ? "No significant duplicated regions detected"
    : score < 30
    ? `Minor region similarity detected (${duplicatePairs} suspicious duplicate block pairs) — could be natural repetition`
    : `Significant region similarity detected (${duplicatePairs} suspicious duplicate block pairs) — possible copy-move forgery`;

  return { score, details };
}

// ─── CNN Patch Classification ───────────────────────────────────────────

/**
 * Run the trained tampering CNN on document patches.
 * Falls back to neutral scores if model is not loaded.
 * TODO: Replace with real patch extraction using OCR bounding boxes.
 */
async function runCNNAnalysis(
  imageDataUrl: string
): Promise<{ score: number; details: string; patchCount: number }> {
  // Ensure model is loaded (first call triggers load)
  if (!isTamperingModelReady()) {
    await loadTamperingModel();
  }

  if (!isTamperingModelReady()) {
    return {
      score: 50, // Neutral score in mock mode
      details: "CNN model not available — using mock tampering detection",
      patchCount: 0,
    };
  }

  const img = await loadImage(imageDataUrl);
  const patches = extractPatchesFromDocument(img);

  if (patches.length === 0) {
    return {
      score: 0,
      details: "No patches extracted for CNN analysis",
      patchCount: 0,
    };
  }

  const probabilities = await predictPatches(patches);

  // Average tampering probability across all patches
  const avgProb = probabilities.reduce((s, p) => s + p, 0) / probabilities.length;
  const maxProb = Math.max(...probabilities);

  // Score: map average probability to 0-100
  // Use a combination of average and max to catch localized tampering
  const score = Math.min(100, Math.round((avgProb * 0.6 + maxProb * 0.4) * 100));

  const highConfCount = probabilities.filter((p) => p > 0.7).length;

  const details = highConfCount > 0
    ? `CNN detected tampering in ${highConfCount}/${patches.length} patches (avg confidence: ${(avgProb * 100).toFixed(1)}%, max: ${(maxProb * 100).toFixed(1)}%)`
    : `CNN analysis: no high-confidence tampering detected across ${patches.length} patches (avg: ${(avgProb * 100).toFixed(1)}%)`;

  return { score, details, patchCount: patches.length };
}

// ─── Main Tampering Detection Function ──────────────────────────────────

/**
 * Run all tampering detection sub-checks including real CNN and produce composite score.
 * Falls back gracefully per-module if models are unavailable.
 */
export async function detectTampering(
  file: File,
  imageDataUrl: string
): Promise<TamperingResult> {
  const startTime = performance.now();

  // Run all sub-checks in parallel
  const [elaResult, metadataResult, copyMoveResult, cnnResult] = await Promise.all([
    computeELA(imageDataUrl),
    analyzeMetadata(file),
    detectCopyMove(imageDataUrl),
    runCNNAnalysis(imageDataUrl),
  ]);

  // Build sub-check results
  const subChecks: TamperingSubCheck[] = [
    {
      name: "Error Level Analysis",
      description: "Recompress image and compare pixel differences to detect edits",
      score: elaResult.score,
      details: elaResult.details,
      evidence: elaResult.heatmap,
    },
    {
      name: "CNN Patch Classification",
      description: "Deep learning analysis of document patches for tampering artifacts",
      score: cnnResult.score,
      details: cnnResult.details,
    },
    {
      name: "Metadata / EXIF Analysis",
      description: "Check image metadata for editing software signatures and anomalies",
      score: metadataResult.score,
      details: metadataResult.details,
    },
    {
      name: "Copy-Move Forgery Detection",
      description: "Detect duplicated regions that may indicate copy-paste forgery",
      score: copyMoveResult.score,
      details: copyMoveResult.details,
    },
  ];

  // Weighted composite score
  // CNN gets highest weight when real model is loaded, otherwise fallback weights
  const cnnAvailable = isTamperingModelReady();

  const weights = cnnAvailable
    ? { ela: 0.25, cnn: 0.35, metadata: 0.15, copyMove: 0.25 }
    : { ela: 0.45, cnn: 0, metadata: 0.20, copyMove: 0.35 };

  const overallScore = Math.round(
    elaResult.score * weights.ela +
    cnnResult.score * weights.cnn +
    metadataResult.score * weights.metadata +
    copyMoveResult.score * weights.copyMove
  );

  const metadataFlags = metadataResult.flags;

  if (!cnnAvailable) {
    metadataFlags.push("⚠ CNN model not loaded — tampering score uses ELA/metadata/copy-move only");
  }

  return {
    overallScore: Math.min(100, overallScore),
    subChecks,
    elaHeatmap: elaResult.heatmap,
    metadataFlags,
    processingTime: Math.round(performance.now() - startTime),
  };
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
