/**
 * Mock document registry database.
 *
 * TODO: Replace with a real government database connection (PostgreSQL, etc.)
 * when integrating with actual document verification systems.
 *
 * This mock database is used for:
 * - Validating document numbers against known valid documents
 * - Checking against blacklisted document numbers
 * - Providing sample data for demo/testing purposes
 */

import type { ModuleConfig } from "./types";

// ─── Module Configuration ──────────────────────────────────────────────────

export const MODULE_CONFIG: ModuleConfig = {
  modelPaths: {
    ocr: "", // TODO: replace with trained model path, e.g. "/models/ocr/paddleocr.onnx"
    tampering: "", // TODO: replace with trained model path
    faceVerification: "", // TODO: replace with ArcFace/FaceNet model path
  },
  databaseConnections: {
    validDocuments: "", // TODO: replace with real DB connection string
    blacklistedDocuments: "", // TODO: replace with real DB connection string
  },
  riskThresholds: {
    greenMax: 30, // composite score 0–30 = Green (auto-clear)
    yellowMax: 60, // composite score 31–60 = Yellow (manual review)
    // composite score 61–100 = Red (flagged)
    weights: {
      ocrConfidence: 0.15,
      validationPassRate: 0.25,
      tamperingScore: 0.30,
      faceMatchScore: 0.20,
      blacklistPenalty: 0.10,
    },
  },
};

// ─── Mock Valid Document Registry ──────────────────────────────────────────
// TODO: Replace with real government database lookup

interface ValidDocument {
  documentNumber: string;
  documentType: string;
  holderName: string;
  nationality: string;
  issuedDate: string;
  expiryDate: string;
}

export const VALID_DOCUMENTS: ValidDocument[] = [
  {
    documentNumber: "A12345678",
    documentType: "passport",
    holderName: "RAHUL SHARMA",
    nationality: "IND",
    issuedDate: "2020-01-15",
    expiryDate: "2030-01-14",
  },
  {
    documentNumber: "P98765432",
    documentType: "passport",
    holderName: "PRIYA PATEL",
    nationality: "IND",
    issuedDate: "2021-06-20",
    expiryDate: "2031-06-19",
  },
  {
    documentNumber: "DL1234567890",
    documentType: "driving_license",
    holderName: "AMIT KUMAR",
    nationality: "IND",
    issuedDate: "2019-03-10",
    expiryDate: "2029-03-09",
  },
  {
    documentNumber: "ID-2024-001234",
    documentType: "national_id",
    holderName: "NEHA GUPTA",
    nationality: "IND",
    issuedDate: "2022-09-01",
    expiryDate: "2032-08-31",
  },
  {
    documentNumber: "VIS-2024-5678",
    documentType: "visa",
    holderName: "JOHN SMITH",
    nationality: "USA",
    issuedDate: "2024-01-10",
    expiryDate: "2024-12-31",
  },
  {
    documentNumber: "PRM-2024-009876",
    documentType: "permit",
    holderName: "SARAH WILSON",
    nationality: "GBR",
    issuedDate: "2024-02-15",
    expiryDate: "2025-02-14",
  },
];

// ─── Mock Blacklisted Document Numbers ─────────────────────────────────────
// TODO: Replace with real government blacklist database

export const BLACKLISTED_DOCUMENTS: string[] = [
  "B12345678",
  "FAKE00001",
  "STLN-99999",
  "X00000000",
];

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Check if a document number is in the valid registry.
 * TODO: Replace with real database query.
 */
export function checkValidRegistry(
  documentNumber: string
): { found: boolean; record?: ValidDocument } {
  const normalized = documentNumber.replace(/\s/g, "").toUpperCase();
  const record = VALID_DOCUMENTS.find(
    (d) => d.documentNumber.replace(/\s/g, "").toUpperCase() === normalized
  );
  return { found: !!record, record };
}

/**
 * Check if a document number is blacklisted.
 * TODO: Replace with real blacklist database query.
 */
export function checkBlacklist(documentNumber: string): boolean {
  const normalized = documentNumber.replace(/\s/g, "").toUpperCase();
  return BLACKLISTED_DOCUMENTS.some(
    (b) => b.replace(/\s/g, "").toUpperCase() === normalized
  );
}

// ─── Audit Trail Storage ───────────────────────────────────────────────────
// TODO: Replace with Convex table or real database

import type { AuditEntry, ScanResult } from "./types";

const AUDIT_STORAGE_KEY = "docscreen_audit_trail";

/**
 * Save a scan result to the audit trail (localStorage).
 * TODO: Replace with Convex mutation or real database write.
 */
export function saveScanResult(result: ScanResult): void {
  const entry: AuditEntry = {
    id: result.id,
    timestamp: result.timestamp,
    documentType: result.documentType,
    fileName: result.fileName,
    riskLevel: result.riskScore.riskLevel,
    compositeScore: result.riskScore.compositeScore,
    thumbnail: result.originalImage,
  };

  try {
    const existing = getAuditTrail();
    existing.unshift(entry);
    // Keep last 100 entries
    localStorage.setItem(
      AUDIT_STORAGE_KEY,
      JSON.stringify(existing.slice(0, 100))
    );
  } catch {
    console.warn("[AuditTrail] Failed to save to localStorage");
  }
}

/**
 * Get all audit trail entries.
 * TODO: Replace with Convex query or real database read.
 */
export function getAuditTrail(): AuditEntry[] {
  try {
    const data = localStorage.getItem(AUDIT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Get a specific scan result by ID (full result including images).
 * TODO: Replace with Convex query or real database read.
 */
export function getScanResult(id: string): ScanResult | null {
  try {
    const data = localStorage.getItem(`docscreen_scan_${id}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Store a full scan result for later retrieval.
 * TODO: Replace with secure file storage + database metadata.
 */
export function storeScanResult(result: ScanResult): void {
  try {
    localStorage.setItem(
      `docscreen_scan_${result.id}`,
      JSON.stringify(result)
    );
    saveScanResult(result);
  } catch {
    console.warn("[AuditTrail] Failed to store full scan result");
  }
}

/**
 * Clear the entire audit trail.
 */
export function clearAuditTrail(): void {
  try {
    const entries = getAuditTrail();
    entries.forEach((e) => {
      localStorage.removeItem(`docscreen_scan_${e.id}`);
    });
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // silent
  }
}
