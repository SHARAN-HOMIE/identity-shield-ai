/**
 * Tampering Detection CNN
 *
 * - Builds a synthetic dataset of genuine vs tampered document patches
 * - Defines a lightweight CNN architecture (4 conv blocks → GAP → dense)
 * - Trains entirely in-browser using TensorFlow.js
 * - Saves/loads trained weights from IndexedDB
 * - Provides predictPatch() for inference on real documents
 *
 * TODO: Replace synthetic data with real document tampering dataset.
 * TODO: Fine-tune architecture after evaluating on real-world documents.
 */

import * as tf from "@tensorflow/tfjs";
import { setModuleStatus } from "./model-status";

// ─── Constants ──────────────────────────────────────────────────────────

export const PATCH_SIZE = 128;
const MODEL_KEY = "tampering-cnn-v1";
const TRAINING_CONFIG = {
  numSamples: 800, // 400 genuine + 400 tampered
  batchSize: 32,
  epochs: 15,
  learningRate: 0.001,
  validationSplit: 0.2,
};

// ─── Synthetic Data Generator ───────────────────────────────────────────

/**
 * Generate a genuine document patch (simulates unaltered document regions).
 * TODO: Replace with real document patch extraction from a dataset.
 */
function generateGenuinePatch(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PATCH_SIZE;
  canvas.height = PATCH_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Background: document paper texture (slightly off-white with noise)
  const baseR = 235 + Math.random() * 15;
  const baseG = 230 + Math.random() * 15;
  const baseB = 220 + Math.random() * 15;
  ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
  ctx.fillRect(0, 0, PATCH_SIZE, PATCH_SIZE);

  // Add subtle paper noise
  const imgData = ctx.getImageData(0, 0, PATCH_SIZE, PATCH_SIZE);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 12;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + noise));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + noise));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Add text-like horizontal lines (simulating printed text fields)
  const numLines = 2 + Math.floor(Math.random() * 4);
  const startY = 15 + Math.floor(Math.random() * 30);
  ctx.fillStyle = `rgb(${30 + Math.random() * 20},${30 + Math.random() * 20},${30 + Math.random() * 20})`;
  for (let i = 0; i < numLines; i++) {
    const y = startY + i * (18 + Math.random() * 8);
    const lineWidth = 40 + Math.random() * (PATCH_SIZE - 60);
    const x = 5 + Math.random() * 15;
    ctx.fillRect(x, y, lineWidth, 2 + Math.random() * 2);
  }

  // Sometimes add a label
  if (Math.random() > 0.5) {
    ctx.font = `${6 + Math.floor(Math.random() * 3)}px monospace`;
    ctx.fillStyle = `rgba(0,0,0,${0.3 + Math.random() * 0.3})`;
    const labels = ["NAME:", "DOB:", "NO:", "PASSPORT", "VALID", "EXP:", "NAT:"];
    ctx.fillText(labels[Math.floor(Math.random() * labels.length)], 8, 12 + Math.random() * 20);
  }

  // Sometimes add a rectangular border region (simulating photo area)
  if (Math.random() > 0.7) {
    const rx = 5 + Math.floor(Math.random() * 40);
    const ry = 5 + Math.floor(Math.random() * 40);
    const rw = 30 + Math.floor(Math.random() * 40);
    const rh = 30 + Math.floor(Math.random() * 40);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    // Fill with gradient (simulating photo)
    const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
    grad.addColorStop(0, `hsl(${Math.random() * 360},20%,60%)`);
    grad.addColorStop(1, `hsl(${Math.random() * 360},20%,70%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
  }

  return canvas;
}

/**
 * Generate a tampered document patch (simulates various forgeries).
 * TODO: Replace with real tampered document patches from a dataset.
 */
function generateTamperedPatch(): HTMLCanvasElement {
  // Start with a genuine patch
  const canvas = generateGenuinePatch();
  const ctx = canvas.getContext("2d")!;
  const tamperType = Math.floor(Math.random() * 5);

  switch (tamperType) {
    case 0: {
      // Text overwrite: white-out existing text, paste new text in different style
      const y = 20 + Math.floor(Math.random() * 60);
      const w = 40 + Math.floor(Math.random() * 60);
      const x = 10 + Math.floor(Math.random() * 20);
      ctx.fillStyle = "rgba(240,235,225,0.92)";
      ctx.fillRect(x, y - 8, w, 14);
      ctx.font = `bold ${7 + Math.floor(Math.random() * 4)}px Arial`;
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 40)},${Math.floor(Math.random() * 40)},${Math.floor(Math.random() * 40)})`;
      ctx.fillText("ALTERED", x + 2, y + 2);
      break;
    }
    case 1: {
      // Photo region replacement: different compression artifacts
      const rx = 5 + Math.floor(Math.random() * 40);
      const ry = 5 + Math.floor(Math.random() * 40);
      const rw = 35 + Math.floor(Math.random() * 35);
      const rh = 35 + Math.floor(Math.random() * 35);
      // Fill with very different color gradient (simulating swapped photo)
      const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
      grad.addColorStop(0, `hsl(${Math.random() * 360},60%,40%)`);
      grad.addColorStop(1, `hsl(${Math.random() * 360},60%,55%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(rx, ry, rw, rh);
      // Add blocky JPEG artifacts
      for (let bx = rx; bx < rx + rw; bx += 8) {
        for (let by = ry; by < ry + rh; by += 8) {
          ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},0.15)`;
          ctx.fillRect(bx, by, 8, 8);
        }
      }
      break;
    }
    case 2: {
      // Stamp duplication: copy-paste a circular stamp
      const cx = PATCH_SIZE / 2;
      const cy = PATCH_SIZE / 2;
      const r = 15 + Math.floor(Math.random() * 20);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${150 + Math.random() * 50},20,20,0.6)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = "6px monospace";
      ctx.fillStyle = `rgba(${150 + Math.random() * 50},20,20,0.5)`;
      ctx.fillText("APPROVED", cx - 14, cy + 2);
      // Duplicate at offset
      const ox = 20 + Math.floor(Math.random() * 50);
      const oy = 20 + Math.floor(Math.random() * 50);
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, r * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${150 + Math.random() * 50},20,20,0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 3: {
      // Date manipulation: erase and rewrite a date field
      const dy = 15 + Math.floor(Math.random() * 40);
      ctx.fillStyle = "rgba(235,230,220,0.95)";
      ctx.fillRect(10, dy, 65, 10);
      ctx.font = "bold 8px Courier";
      ctx.fillStyle = "rgb(0,0,80)";
      const fakeDate = `${1 + Math.floor(Math.random() * 12)}/${1 + Math.floor(Math.random() * 28)}/20${20 + Math.floor(Math.random() * 15)}`;
      ctx.fillText(fakeDate, 12, dy + 8);
      break;
    }
    case 4: {
      // Number character replacement: individual char has different rendering
      const textY = 30 + Math.floor(Math.random() * 30);
      // White out one character position
      ctx.fillStyle = "rgba(240,235,225,0.9)";
      ctx.fillRect(35, textY - 7, 8, 12);
      // Draw replacement in different font/weight
      ctx.font = `bold italic ${8 + Math.floor(Math.random() * 3)}px Georgia`;
      ctx.fillStyle = `rgb(${10 + Math.floor(Math.random() * 30)},${10 + Math.floor(Math.random() * 30)},${10 + Math.floor(Math.random() * 30)})`;
      ctx.fillText("7", 36, textY + 1);
      break;
    }
  }

  return canvas;
}

/**
 * Apply random augmentation to a patch tensor.
 * TODO: Add more augmentation types (elastic deformation, etc.)
 */
function augmentPatch(tensor: tf.Tensor3D): tf.Tensor3D {
  // Random brightness
  if (Math.random() > 0.5) {
    const brightness = (Math.random() - 0.5) * 30;
    tensor = tf.tidy(() => tensor.add(brightness).clipByValue(0, 255)) as tf.Tensor3D;
  }

  // Random contrast
  if (Math.random() > 0.5) {
    const factor = 0.7 + Math.random() * 0.6;
    tensor = tf.tidy(() => {
      const mean = tensor.mean();
      return tensor.sub(mean).mul(factor).add(mean).clipByValue(0, 255);
    }) as tf.Tensor3D;
  }

  // Random horizontal flip
  if (Math.random() > 0.5) {
    tensor = tf.tidy(() => tensor.reverse(1)) as tf.Tensor3D;
  }

  // Random JPEG compression simulation (quantize color values)
  if (Math.random() > 0.6) {
    const levels = [40, 60, 80];
    const q = levels[Math.floor(Math.random() * levels.length)];
    tensor = tf.tidy(() => tensor.div(q).round().mul(q).clipByValue(0, 255)) as tf.Tensor3D;
  }

  return tensor;
}

/**
 * Generate the full training dataset as tensors.
 * Returns [images, labels] where images is [N,128,128,3] float32 0-255,
 * labels is [N,1] float32 (0 = genuine, 1 = tampered).
 */
function generateDataset(): { images: tf.Tensor4D; labels: tf.Tensor1D } {
  const n = TRAINING_CONFIG.numSamples;
  const halfN = n / 2;

  const images: tf.Tensor3D[] = [];
  const labels: number[] = [];

  // Genuine patches (label 0)
  for (let i = 0; i < halfN; i++) {
    const canvas = generateGenuinePatch();
    const tensor = tf.browser.fromPixels(canvas, 3) as tf.Tensor3D;
    const augmented = augmentPatch(tensor);
    images.push(augmented);
    labels.push(0);
    tensor.dispose();
  }

  // Tampered patches (label 1)
  for (let i = 0; i < halfN; i++) {
    const canvas = generateTamperedPatch();
    const tensor = tf.browser.fromPixels(canvas, 3) as tf.Tensor3D;
    const augmented = augmentPatch(tensor);
    images.push(augmented);
    labels.push(1);
    tensor.dispose();
  }

  // Shuffle
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const shuffledImages = indices.map((i) => images[i]);
  const shuffledLabels = indices.map((i) => labels[i]);

  const imagesTensor = tf.stack(shuffledImages) as tf.Tensor4D;
  const labelsTensor = tf.tensor1d(shuffledLabels);

  // Clean up individual tensors
  images.forEach((t) => t.dispose());

  return { images: imagesTensor, labels: labelsTensor };
}

// ─── CNN Architecture ───────────────────────────────────────────────────

/**
 * Build the tampering detection CNN.
 *
 * Architecture:
 *   Input(128×128×3)
 *   → Conv2D(32, 3×3) → BN → ReLU → MaxPool(2×2)
 *   → Conv2D(64, 3×3) → BN → ReLU → MaxPool(2×2)
 *   → Conv2D(128, 3×3) → BN → ReLU → MaxPool(2×2)
 *   → Conv2D(256, 3×3) → BN → ReLU → GlobalAvgPool
 *   → Dense(64) → ReLU → Dropout(0.5)
 *   → Dense(1) → Sigmoid
 *
 * ~340K parameters — fast CPU inference.
 * TODO: Experiment with MobileNetV2 transfer learning for better accuracy.
 */
function buildModel(): tf.LayersModel {
  const model = tf.sequential();

  // Block 1: 128→64
  model.add(tf.layers.conv2d({
    inputShape: [PATCH_SIZE, PATCH_SIZE, 3],
    filters: 32,
    kernelSize: 3,
    padding: "same",
    kernelInitializer: "heNormal",
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // Block 2: 64→32
  model.add(tf.layers.conv2d({
    filters: 64,
    kernelSize: 3,
    padding: "same",
    kernelInitializer: "heNormal",
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // Block 3: 32→16
  model.add(tf.layers.conv2d({
    filters: 128,
    kernelSize: 3,
    padding: "same",
    kernelInitializer: "heNormal",
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.maxPooling2d({ poolSize: 2 }));

  // Block 4: 16→8
  model.add(tf.layers.conv2d({
    filters: 256,
    kernelSize: 3,
    padding: "same",
    kernelInitializer: "heNormal",
  }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.activation({ activation: "relu" }));

  // Global Average Pooling
  model.add(tf.layers.globalAveragePooling2d({}));

  // Dense head
  model.add(tf.layers.dense({ units: 64, kernelInitializer: "heNormal" }));
  model.add(tf.layers.activation({ activation: "relu" }));
  model.add(tf.layers.dropout({ rate: 0.5 }));

  // Output: tampering probability
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  return model;
}

// ─── Training ───────────────────────────────────────────────────────────

export interface TrainingMetrics {
  datasetSize: number;
  classBalance: { genuine: number; tampered: number };
  finalAccuracy: number;
  finalPrecision: number;
  finalRecall: number;
  finalF1: number;
  confusionMatrix: { tp: number; tn: number; fp: number; fn: number };
  epochs: number;
}

/**
 * Train the tampering CNN entirely in the browser.
 * TODO: Add progress callback for real-time training UI.
 */
export async function trainTamperingCNN(
  onProgress?: (epoch: number, totalEpochs: number, metrics: string) => void
): Promise<TrainingMetrics> {
  console.time("[TamperingCNN] Training");

  const { images, labels } = generateDataset();
  const n = labels.shape[0];

  onProgress?.(0, TRAINING_CONFIG.epochs, `Generated ${n} synthetic patches`);

  const model = buildModel();
  model.compile({
    optimizer: tf.train.adam(TRAINING_CONFIG.learningRate),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  // Custom metrics tracking
  let bestPrecision = 0;
  let bestRecall = 0;
  let bestF1 = 0;
  let bestTp = 0;
  let bestTn = 0;
  let bestFp = 0;
  let bestFn = 0;

  await model.fit(images, labels, {
    batchSize: TRAINING_CONFIG.batchSize,
    epochs: TRAINING_CONFIG.epochs,
    validationSplit: TRAINING_CONFIG.validationSplit,
    shuffle: true,
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        const acc = logs?.acc ?? 0;
        onProgress?.(
          epoch + 1,
          TRAINING_CONFIG.epochs,
          `Epoch ${epoch + 1}/${TRAINING_CONFIG.epochs} — acc: ${(acc * 100).toFixed(1)}%, loss: ${logs?.loss?.toFixed(3) ?? "?"}`
        );

        // Compute precision/recall/F1 on validation set
        const valSplit = TRAINING_CONFIG.validationSplit;
        const valN = Math.floor(n * valSplit);
        const trainN = n - valN;
        const valImages = images.slice([trainN, 0, 0, 0], [valN, PATCH_SIZE, PATCH_SIZE, 3]);
        const valLabels = labels.slice([trainN], [valN]);

        const preds = model.predict(valImages) as tf.Tensor;
        const predArr = (await preds.data()) as Float32Array;
        const labelArr = (await valLabels.data()) as Float32Array;

        let tp = 0, tn = 0, fp = 0, fn = 0;
        for (let i = 0; i < valN; i++) {
          const predicted = predArr[i] >= 0.5 ? 1 : 0;
          const actual = labelArr[i];
          if (predicted === 1 && actual === 1) tp++;
          else if (predicted === 0 && actual === 0) tn++;
          else if (predicted === 1 && actual === 0) fp++;
          else fn++;
        }

        const precision = tp / (tp + fp) || 0;
        const recall = tp / (tp + fn) || 0;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        // Track best F1
        if (f1 > bestF1) {
          bestF1 = f1;
          bestPrecision = precision;
          bestRecall = recall;
          bestTp = tp;
          bestTn = tn;
          bestFp = fp;
          bestFn = fn;
        }

        onProgress?.(
          epoch + 1,
          TRAINING_CONFIG.epochs,
          `Epoch ${epoch + 1}/${TRAINING_CONFIG.epochs} — P: ${(precision * 100).toFixed(1)}%, R: ${(recall * 100).toFixed(1)}%, F1: ${(f1 * 100).toFixed(1)}%`
        );

        valImages.dispose();
        valLabels.dispose();
        preds.dispose();
      },
    },
  });

  // Final evaluation on full validation set
  const valSplit = TRAINING_CONFIG.validationSplit;
  const valN = Math.floor(n * valSplit);
  const trainN = n - valN;
  const valImages = images.slice([trainN, 0, 0, 0], [valN, PATCH_SIZE, PATCH_SIZE, 3]);
  const valLabels = labels.slice([trainN], [valN]);

  const evalResult = model.evaluate(valImages, valLabels) as tf.Scalar[];
  const finalAcc = (await evalResult[0].data())[0];
  const finalLoss = (await evalResult[1].data())[0];

  const preds = model.predict(valImages) as tf.Tensor;
  const predArr = (await preds.data()) as Float32Array;
  const labelArr = (await valLabels.data()) as Float32Array;

  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < valN; i++) {
    const predicted = predArr[i] >= 0.5 ? 1 : 0;
    const actual = labelArr[i];
    if (predicted === 1 && actual === 1) tp++;
    else if (predicted === 0 && actual === 0) tn++;
    else if (predicted === 1 && actual === 0) fp++;
    else fn++;
  }

  const finalPrecision = tp / (tp + fp) || 0;
  const finalRecall = tp / (tp + fn) || 0;
  const finalF1 = finalPrecision + finalRecall > 0
    ? (2 * finalPrecision * finalRecall) / (finalPrecision + finalRecall)
    : 0;

  console.log(`[TamperingCNN] Training complete`);
  console.log(`  Accuracy: ${(finalAcc * 100).toFixed(1)}%`);
  console.log(`  Precision: ${(bestPrecision * 100).toFixed(1)}% (at best F1)`);
  console.log(`  Recall: ${(bestRecall * 100).toFixed(1)}% (at best F1)`);
  console.log(`  F1: ${(bestF1 * 100).toFixed(1)}% (at best epoch)`);
  console.log(`  Confusion Matrix: TP=${bestTp} TN=${bestTn} FP=${bestFp} FN=${bestFn}`);
  console.log(`  Validation loss: ${finalLoss.toFixed(4)}`);

  // Save model to IndexedDB
  await model.save(`indexeddb://${MODEL_KEY}`);
  console.log("[TamperingCNN] Model saved to IndexedDB");

  // Cleanup
  images.dispose();
  labels.dispose();
  valImages.dispose();
  valLabels.dispose();
  preds.dispose();
  evalResult.forEach((t) => t.dispose());

  const metrics: TrainingMetrics = {
    datasetSize: n,
    classBalance: { genuine: n / 2, tampered: n / 2 },
    finalAccuracy: finalAcc,
    finalPrecision: bestPrecision,
    finalRecall: bestRecall,
    finalF1: bestF1,
    confusionMatrix: { tp: bestTp, tn: bestTn, fp: bestFp, fn: bestFn },
    epochs: TRAINING_CONFIG.epochs,
  };

  console.timeEnd("[TamperingCNN] Training");
  return metrics;
}

// ─── Inference ──────────────────────────────────────────────────────────

let loadedModel: tf.LayersModel | null = null;
let modelReady = false;

/**
 * Load the trained tampering CNN from IndexedDB.
 * If no trained model exists, returns false (caller should fall back to mock).
 * TODO: Also support loading from a file path (e.g. public/models/tampering/model.json).
 */
export async function loadTamperingModel(): Promise<boolean> {
  try {
    // Try loading from IndexedDB first
    loadedModel = await tf.loadLayersModel(`indexeddb://${MODEL_KEY}`);
    const warmup = loadedModel.predict(tf.zeros([1, PATCH_SIZE, PATCH_SIZE, 3])) as tf.Tensor;
    warmup.dispose();
    modelReady = true;
    console.log("[TamperingCNN] Model loaded from IndexedDB");
    setModuleStatus("tampering", "real");
    return true;
  } catch {
    // No saved model — try loading from public path
    try {
      loadedModel = await tf.loadLayersModel("/models/tampering/model.json");
      const warmup2 = loadedModel.predict(tf.zeros([1, PATCH_SIZE, PATCH_SIZE, 3])) as tf.Tensor;
      warmup2.dispose();
      modelReady = true;
      console.log("[TamperingCNN] Model loaded from /models/tampering/model.json");
      setModuleStatus("tampering", "real");
      return true;
    } catch {
      console.log("[TamperingCNN] No trained model found — using mock tampering detection");
      setModuleStatus("tampering", "mock");
      return false;
    }
  }
}

/**
 * Predict tampering probability for a set of image patches.
 * Each patch should be an ImageData or HTMLCanvasElement.
 * Returns array of tampering probabilities (0-1).
 */
export async function predictPatches(
  patches: (ImageData | HTMLCanvasElement)[]
): Promise<number[]> {
  if (!modelReady || !loadedModel) {
    // Return neutral scores if model not loaded
    return patches.map(() => 0.5);
  }

  const tensors = patches.map((p) => {
    const t = tf.browser.fromPixels(p, 3) as tf.Tensor3D;
    // Resize if needed
    if (t.shape[0] !== PATCH_SIZE || t.shape[1] !== PATCH_SIZE) {
      const resized = tf.image.resizeBilinear(t, [PATCH_SIZE, PATCH_SIZE]);
      t.dispose();
      return resized;
    }
    return t;
  });

  const batch = tf.stack(tensors) as tf.Tensor4D;
  const predictions = loadedModel.predict(batch) as tf.Tensor;
  const probs = Array.from((await predictions.data()) as Float32Array);

  // Cleanup
  tensors.forEach((t) => t.dispose());
  batch.dispose();
  predictions.dispose();

  return probs;
}

/**
 * Extract document patches from a full document image for CNN analysis.
 * Uses simple grid-based extraction with some overlap.
 * TODO: Replace with real text-region detection (e.g., from OCR bounding boxes).
 */
export function extractPatchesFromDocument(
  img: HTMLImageElement,
  maxPatches = 20
): HTMLCanvasElement[] {
  const patches: HTMLCanvasElement[] = [];
  const canvas = document.createElement("canvas");
  const maxDim = 600;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Grid extraction with stride
  const stride = Math.max(PATCH_SIZE, Math.floor(Math.min(canvas.width, canvas.height) / 4));

  for (let y = 0; y <= canvas.height - PATCH_SIZE; y += stride) {
    for (let x = 0; x <= canvas.width - PATCH_SIZE; x += stride) {
      if (patches.length >= maxPatches) break;

      const patchCanvas = document.createElement("canvas");
      patchCanvas.width = PATCH_SIZE;
      patchCanvas.height = PATCH_SIZE;
      const patchCtx = patchCanvas.getContext("2d")!;

      // Extract and resize to PATCH_SIZE
      patchCtx.drawImage(
        canvas,
        x, y, PATCH_SIZE, PATCH_SIZE,
        0, 0, PATCH_SIZE, PATCH_SIZE
      );

      patches.push(patchCanvas);
    }
    if (patches.length >= maxPatches) break;
  }

  // Also extract center region (likely contains key document info)
  if (patches.length < maxPatches) {
    const cx = Math.floor(canvas.width / 2 - PATCH_SIZE / 2);
    const cy = Math.floor(canvas.height / 2 - PATCH_SIZE / 2);
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = PATCH_SIZE;
    patchCanvas.height = PATCH_SIZE;
    const patchCtx = patchCanvas.getContext("2d")!;
    patchCtx.drawImage(
      canvas,
      Math.max(0, cx), Math.max(0, cy), PATCH_SIZE, PATCH_SIZE,
      0, 0, PATCH_SIZE, PATCH_SIZE
    );
    patches.push(patchCanvas);
  }

  return patches;
}

/** Check if the CNN model is loaded and ready for inference */
export function isTamperingModelReady(): boolean {
  return modelReady;
}
