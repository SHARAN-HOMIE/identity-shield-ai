/**
 * Core types for the AI-Based Fake Identity & Document Screening System.
 *
 * All module interfaces are defined here so that real models/databases
 * can be swapped in later without changing consuming code.
 *
 * TODO: Replace mock types with real model output schemas when trained
 * models and government databases are integrated.
 */

// ─── Document Types ─────────────────────────────────────────────────────────

export type DocumentType = "passport" | "visa" | "national_id" | "driving_license" | "permit";

export type RiskLevel = "green" | "yellow" | "red";

export type CheckStatus = "pass" | "fail" | "warning" | "unknown";

// ─── OCR Module Types ───────────────────────────────────────────────────────

export interface ExtractedFields {
  [key: string]: string;
}

export interface OCRResult {
  /** Raw extracted text from the document */
  rawText: string;
  /** Structured fields extracted from the document */
  fields: ExtractedFields;
  /** Confidence of OCR extraction (0–100) */
  confidence: number;
  /** Whether MRZ was detected and parsed (for passports) */
  mrzDetected: boolean;
  /** MRZ zone data if detected */
  mrzData?: MRZData;
  /** The document type detected */
  detectedType: DocumentType;
  /** Processing time in ms */
  processingTime: number;
  /** Any warnings during extraction */
  warnings: string[];
}

export interface MRZData {
  documentNumber: string;
  nationality: string;
  dateOfBirth: string;
  dateOfExpiry: string;
  gender: string;
  lastName: string;
  firstName: string;
  personalNumber: string;
  rawLine1: string;
  rawLine2: string;
}

// ─── Validation Module Types ────────────────────────────────────────────────

export interface ValidationCheck {
  name: string;
  description: string;
  status: CheckStatus;
  details: string;
}

export interface ValidationResult {
  checks: ValidationCheck[];
  /** Overall pass rate: number of passing checks / total checks */
  passRate: number;
  /** Whether the document number is blacklisted */
  blacklistHit: boolean;
  /** Whether the document number was found in valid registry */
  validRegistryHit: boolean;
  /** Processing time in ms */
  processingTime: number;
}

// ─── Tampering Detection Module Types ──────────────────────────────────────

export interface TamperingSubCheck {
  name: string;
  description: string;
  score: number; // 0–100, higher = more likely tampered
  details: string;
  evidence?: string; // base64 image or description
}

export interface TamperingResult {
  /** Composite tampering likelihood score (0–100) */
  overallScore: number;
  /** Individual sub-check results */
  subChecks: TamperingSubCheck[];
  /** ELA heatmap as base64 data URL */
  elaHeatmap?: string;
  /** Metadata analysis results */
  metadataFlags: string[];
  /** Processing time in ms */
  processingTime: number;
}

// ─── Face Verification Module Types ────────────────────────────────────────

export interface FaceVerificationResult {
  /** Similarity score (0–100) */
  matchScore: number;
  /** Whether faces were detected in both images */
  documentFaceDetected: boolean;
  liveFaceDetected: boolean;
  /** Match verdict */
  verdict: "match" | "no_match" | "insufficient_data";
  /** Processing time in ms */
  processingTime: number;
  /** Details about the comparison */
  details: string;
}

// ─── Risk Scoring Module Types ─────────────────────────────────────────────

export interface RiskFactors {
  ocrConfidence: number;
  validationPassRate: number;
  tamperingScore: number;
  faceMatchScore: number;
  blacklistHit: boolean;
}

export interface RiskScoreResult {
  /** Final composite score (0–100) */
  compositeScore: number;
  /** Risk level classification */
  riskLevel: RiskLevel;
  /** Individual factor contributions */
  factors: RiskFactors;
  /** Human-readable breakdown */
  breakdown: string[];
  /** Thresholds used (for transparency) */
  thresholds: {
    greenMax: number;
    yellowMax: number;
    // red is above yellowMax
  };
}

// ─── Pipeline Result ────────────────────────────────────────────────────────

export interface ScanResult {
  id: string;
  timestamp: number;
  documentType: DocumentType;
  fileName: string;
  /** Original file as data URL for display */
  originalImage: string;
  ocr: OCRResult;
  validation: ValidationResult;
  tampering: TamperingResult;
  faceVerification: FaceVerificationResult;
  riskScore: RiskScoreResult;
  /** Total pipeline processing time in ms */
  totalTime: number;
}

// ─── Audit Trail Types ─────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  timestamp: number;
  documentType: DocumentType;
  fileName: string;
  riskLevel: RiskLevel;
  compositeScore: number;
  /** Thumbnail of the original document */
  thumbnail: string;
}

// ─── Config Types ──────────────────────────────────────────────────────────

export interface ModuleConfig {
  /**
   * TODO: Replace with real model file paths when trained models are available.
   * Example: "/models/ocr/paddleocr.onnx"
   */
  modelPaths: {
    ocr: string;
    tampering: string;
    faceVerification: string;
  };
  /**
   * TODO: Replace with real database connection strings.
   * Example: "postgresql://localhost:5432/document_registry"
   */
  databaseConnections: {
    validDocuments: string;
    blacklistedDocuments: string;
  };
  /** Risk scoring thresholds */
  riskThresholds: {
    greenMax: number;
    yellowMax: number;
    weights: {
      ocrConfidence: number;
      validationPassRate: number;
      tamperingScore: number;
      faceMatchScore: number;
      blacklistPenalty: number;
    };
  };
}
