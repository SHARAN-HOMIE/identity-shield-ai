/**
 * Module 3 — Tampering Detection
 *
 * Core feature of the system. Produces visual evidence (ELA heatmap)
 * alongside quantitative tampering scores.
 *
 * TODO: Replace with trained tampering detection model (e.g., XceptionNet).
 * TODO: Replace ORB keypoints with real SIFT/SuperPoint model for copy-move.
 * Currently uses rule-based ELA diffing and basic canvas analysis.
 */

import type {
  TamperingResult,
  TamperingSubCheck,
} from "../types";

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

  // Get original pixel data
  const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Re-compress at specified quality
  const recompressedDataUrl = canvas.toDataURL("image/jpeg", quality / 100);
  const recompressedImg = await loadImage(recompressedDataUrl);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(recompressedImg, 0, 0);
  const recompressedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Compute difference
  const diffData = ctx.createImageData(canvas.width, canvas.height);
  let totalDiff = 0;
  let maxDiff = 0;
  const diffValues: number[] = [];

  for (let i = 0; i < originalData.data.length; i += 4) {
    const rDiff = Math.abs(originalData.data[i] - recompressedData.data[i]);
    const gDiff = Math.abs(originalData.data[i + 1] - recompressedData.data[i + 1]);
    const bDiff = Math.abs(originalData.data[i + 2] - recompressedData.data[i + 2]);
    const avgDiff = (rDiff + gDiff + bDiff) / 3;

    totalDiff += avgDiff;
    if (avgDiff > maxDiff) maxDiff = avgDiff;
    diffValues.push(avgDiff);

    // ELA heatmap: brighter = more error = more likely tampered
    // Scale for visibility
    const scaled = Math.min(255, avgDiff * 5);
    diffData.data[i] = scaled;     // R
    diffData.data[i + 1] = scaled * 0.3; // G (suppress green for red-ish tint)
    diffData.data[i + 2] = scaled * 0.1; // B
    diffData.data[i + 3] = 255;    // A
  }

  // Draw heatmap
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(diffData, 0, 0);

  const heatmap = canvas.toDataURL("image/png");

  // Calculate tampering score from ELA
  const pixelCount = diffValues.length;
  const avgDiff = totalDiff / pixelCount;

  // Calculate standard deviation of differences
  const variance =
    diffValues.reduce((sum, v) => sum + Math.pow(v - avgDiff, 2), 0) / pixelCount;
  const stdDev = Math.sqrt(variance);

  // Higher std dev means some areas differ much more (likely tampered regions)
  // Score: 0 (uniform = clean) to 100 (highly variable = tampered)
  let score: string | number = Math.min(100, Math.round(stdDev * 2.5));

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

/**
 * Analyze image metadata for signs of editing.
 * TODO: Replace with comprehensive metadata database and trained classifier.
 */
async function analyzeMetadata(
  file: File
): Promise<{ flags: string[]; score: number; details: string }> {
  const flags: string[] = [];
  let score = 0;

  try {
    // Read raw EXIF data from the file
    const arrayBuffer = await file.arrayBuffer();
    const view = new DataView(arrayBuffer);

    // Check for JPEG EXIF marker (FF E1)
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

    // Read file name for suspicious patterns
    const fileName = file.name.toLowerCase();
    if (fileName.includes("edit") || fileName.includes("copy") || fileName.includes("modified")) {
      flags.push(`Filename "${file.name}" suggests the file may be a copy or edit`);
      score += 15;
    }

    // Check file size anomalies
    const fileSizeKB = file.size / 1024;
    if (fileSizeKB < 10) {
      flags.push("Unusually small file size — may be a thumbnail or low-quality image");
      score += 10;
    }

    // For JPEG, try to read basic EXIF segments
    if (hasEXIF) {
      try {
        // Read EXIF header
        const exifOffset = 4;
        const exifByteOrder = view.getUint16(exifOffset);
        const isLittleEndian = exifByteOrder === 0x4949;

        // Try to find Software tag (0x0131) and DateTime (0x0132)
        const segmentLength = view.getUint16(exifOffset + 2);
        const exifEnd = exifOffset + 2 + segmentLength;

        // Search for common editing software signatures
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

        // Check for timestamp at offset — if very old or future
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

    // Check if it's a PNG (often created by screenshot tools)
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

  const details =
    flags.length === 0
      ? "No metadata anomalies detected"
      : `${flags.length} metadata flag(s) raised`;

  return { flags, score, details };
}

// ─── Basic Region Analysis (Copy-Move Forgery Detection) ────────────────

/**
 * Basic keypoint-matching for copy-move forgery detection.
 * TODO: Replace with ORB/SIFT/SuperPoint real keypoint detection model.
 * Currently uses a block-based similarity approach.
 */
async function detectCopyMove(
  imageDataUrl: string
): Promise<{ score: number; details: string }> {
  const img = await loadImage(imageDataUrl);
  const blockSize = 16; // Block size for comparison
  const canvas = document.createElement("canvas");

  // Scale down for performance
  const maxDim = 400;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const blocks: { x: number; y: number; hash: string }[] = [];

  // Extract block hashes (simple average color + gradient)
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

          // Horizontal gradient
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

  // Count duplicate hashes (blocks that look identical)
  const hashCounts = new Map<string, number>();
  for (const block of blocks) {
    hashCounts.set(block.hash, (hashCounts.get(block.hash) || 0) + 1);
  }

  // Find suspicious duplicates (same hash but different positions)
  let duplicatePairs = 0;
  const hashBlocks = new Map<string, { x: number; y: number }[]>();
  for (const block of blocks) {
    const existing = hashBlocks.get(block.hash) || [];
    existing.push({ x: block.x, y: block.y });
    hashBlocks.set(block.hash, existing);
  }

  for (const [, blockList] of hashBlocks) {
    if (blockList.length > 1) {
      // Check that blocks are not adjacent (adjacent blocks naturally look similar)
      for (let i = 0; i < blockList.length; i++) {
        for (let j = i + 1; j < blockList.length; j++) {
          const dist = Math.sqrt(
            Math.pow(blockList[i].x - blockList[j].x, 2) +
            Math.pow(blockList[i].y - blockList[j].y, 2)
          );
          if (dist > blockSize * 3) {
            // Distant blocks with same appearance — suspicious
            duplicatePairs++;
          }
        }
      }
    }
  }

  const totalBlocks = blocks.length;
  const suspiciousRatio = totalBlocks > 0 ? duplicatePairs / totalBlocks : 0;

  // Score: 0 (no duplicates) to 100 (many suspicious duplicates)
  const score = Math.min(100, Math.round(suspiciousRatio * 500));

  const details =
    score < 10
      ? "No significant duplicated regions detected"
      : score < 30
      ? `Minor region similarity detected (${duplicatePairs} suspicious duplicate block pairs) — could be natural repetition`
      : `Significant region similarity detected (${duplicatePairs} suspicious duplicate block pairs) — possible copy-move forgery`;

  return { score, details };
}

// ─── Main Tampering Detection Function ──────────────────────────────────

/**
 * Run all tampering detection sub-checks and produce a composite score.
 * TODO: Replace with trained tampering detection ensemble model.
 */
export async function detectTampering(
  file: File,
  imageDataUrl: string
): Promise<TamperingResult> {
  const startTime = performance.now();

  // Run sub-checks in parallel where possible
  const [elaResult, metadataResult, copyMoveResult] = await Promise.all([
    computeELA(imageDataUrl),
    analyzeMetadata(file),
    detectCopyMove(imageDataUrl),
  ]);

  // Build sub-check results
  const subChecks: TamperingSubCheck[] = [
    {
      name: "Error Level Analysis",
      description: "Recompress image and compare pixel differences to detect edits",
      score: typeof elaResult.score === "string" ? parseInt(elaResult.score as string) : elaResult.score as number,
      details: elaResult.details,
      evidence: elaResult.heatmap,
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

  // Composite score: weighted average
  const weights = { ela: 0.50, metadata: 0.20, copyMove: 0.30 };
  const overallScore = Math.round(
    (typeof elaResult.score === "string" ? parseInt(elaResult.score as string) : elaResult.score as number) * weights.ela +
    metadataResult.score * weights.metadata +
    copyMoveResult.score * weights.copyMove
  );

  const metadataFlags = metadataResult.flags;

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
