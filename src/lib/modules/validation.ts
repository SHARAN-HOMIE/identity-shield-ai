/**
 * Module 2 — Document Validation
 *
 * TODO: Replace mock database lookups with real government DB connections.
 * Currently uses rule-based checks and a local mock registry.
 */

import { setModuleStatus } from "../model-status";
import type {
  OCRResult,
  ValidationResult,
  ValidationCheck,
  CheckStatus,
} from "../types";
import { checkValidRegistry, checkBlacklist } from "../mock-db";

// ─── MRZ Checksum Re-implementation ─────────────────────────────────────

function mrzCheckDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    let charVal: number;
    const ch = value[i];
    if (ch === "<") charVal = 0;
    else if (ch >= "0" && ch <= "9") charVal = parseInt(ch, 10);
    else charVal = ch.charCodeAt(0) - 55;
    sum += charVal * weights[i % 3];
  }
  return sum % 10;
}

// ─── Individual Validation Checks ───────────────────────────────────────

function checkDocumentNumberFormat(ocr: OCRResult): ValidationCheck {
  const docNum = ocr.fields["Document Number"] || "";
  const hasValidFormat = docNum.length >= 5 && /^[A-Z0-9\-]+$/i.test(docNum);
  return {
    name: "Document Number Format",
    description: "Document number matches expected alphanumeric format",
    status: hasValidFormat ? "pass" : "fail",
    details: hasValidFormat
      ? `Document number "${docNum}" has valid format (${docNum.length} characters)`
      : `Document number "${docNum}" does not match expected format or is too short`,
  };
}

function checkMRZChecksums(ocr: OCRResult): ValidationCheck {
  if (!ocr.mrzDetected || !ocr.mrzData) {
    return {
      name: "MRZ Checksum",
      description: "Validate MRZ check digits for document number, DOB, and expiry",
      status: "unknown",
      details: "No MRZ detected — checksum validation skipped",
    };
  }

  const md = ocr.mrzData;
  let allValid = true;
  const details: string[] = [];

  // Validate document number checksum
  const docCheckLine = md.rawLine2.substring(0, 10);
  const docNum = docCheckLine.substring(0, 9);
  const docCheckDigit = parseInt(docCheckLine[9], 10);
  const docCalc = mrzCheckDigit(docNum);
  if (docCalc !== docCheckDigit) {
    allValid = false;
    details.push(`Doc number checksum FAIL (expected ${docCalc}, got ${docCheckDigit})`);
  } else {
    details.push("Doc number checksum PASS");
  }

  // Validate DOB checksum
  const dobCheckLine = md.rawLine2.substring(13, 20);
  const dob = dobCheckLine.substring(0, 6);
  const dobCheckDigit = parseInt(dobCheckLine[6], 10);
  const dobCalc = mrzCheckDigit(dob);
  if (dobCalc !== dobCheckDigit) {
    allValid = false;
    details.push(`DOB checksum FAIL (expected ${dobCalc}, got ${dobCheckDigit})`);
  } else {
    details.push("DOB checksum PASS");
  }

  // Validate expiry checksum
  const expCheckLine = md.rawLine2.substring(21, 28);
  const exp = expCheckLine.substring(0, 6);
  const expCheckDigit = parseInt(expCheckLine[6], 10);
  const expCalc = mrzCheckDigit(exp);
  if (expCalc !== expCheckDigit) {
    allValid = false;
    details.push(`Expiry checksum FAIL (expected ${expCalc}, got ${expCheckDigit})`);
  } else {
    details.push("Expiry checksum PASS");
  }

  return {
    name: "MRZ Checksum",
    description: "Validate MRZ check digits for document number, DOB, and expiry",
    status: allValid ? "pass" : "fail",
    details: details.join("; "),
  };
}

function checkExpiryDate(ocr: OCRResult): ValidationCheck {
  const expiryStr = ocr.fields["Date of Expiry"];
  if (!expiryStr) {
    return {
      name: "Expiry Date Check",
      description: "Verify the document has not expired",
      status: "unknown",
      details: "Expiry date not found in extracted fields",
    };
  }

  const expiry = new Date(expiryStr);
  const now = new Date();
  const isExpired = expiry < now;
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isExpired) {
    return {
      name: "Expiry Date Check",
      description: "Verify the document has not expired",
      status: "fail",
      details: `Document EXPIRED ${Math.abs(daysUntilExpiry)} days ago (expired ${expiryStr})`,
    };
  }

  if (daysUntilExpiry < 30) {
    return {
      name: "Expiry Date Check",
      description: "Verify the document has not expired",
      status: "warning",
      details: `Document expires soon: ${daysUntilExpiry} days remaining (expires ${expiryStr})`,
    };
  }

  return {
    name: "Expiry Date Check",
    description: "Verify the document has not expired",
    status: "pass",
    details: `Document is valid — expires in ${daysUntilExpiry} days (${expiryStr})`,
  };
}

function checkDateOfBirthPlausibility(ocr: OCRResult): ValidationCheck {
  const dobStr = ocr.fields["Date of Birth"];
  if (!dobStr) {
    return {
      name: "DOB Plausibility",
      description: "Verify date of birth is plausible for document type",
      status: "unknown",
      details: "Date of birth not found",
    };
  }

  const dob = new Date(dobStr);
  const now = new Date();
  const ageYears = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

  if (ageYears < 0 || ageYears > 120) {
    return {
      name: "DOB Plausibility",
      description: "Verify date of birth is plausible for document type",
      status: "fail",
      details: `Implausible age: ${Math.round(ageYears)} years (DOB: ${dobStr})`,
    };
  }

  if (ocr.detectedType === "passport" && ageYears < 16) {
    return {
      name: "DOB Plausibility",
      description: "Verify date of birth is plausible for document type",
      status: "warning",
      details: `Passport holder appears to be under 16 (${Math.round(ageYears)} years) — verify age requirement`,
    };
  }

  return {
    name: "DOB Plausibility",
    description: "Verify date of birth is plausible for document type",
    status: "pass",
    details: `Age ${Math.round(ageYears)} years is plausible for ${ocr.detectedType} document`,
  };
}

function checkCrossFieldConsistency(ocr: OCRResult): ValidationCheck {
  const fields = ocr.fields;
  const issues: string[] = [];

  // Check that given name and surname are different
  const givenName = fields["Given Name"] || "";
  const surname = fields["Surname"] || "";
  if (givenName && surname && givenName.toLowerCase() === surname.toLowerCase()) {
    issues.push("Given name and surname are identical");
  }

  // Check DOB < Expiry
  const dob = fields["Date of Birth"];
  const expiry = fields["Date of Expiry"];
  if (dob && expiry) {
    const dobDate = new Date(dob);
    const expDate = new Date(expiry);
    if (dobDate >= expDate) {
      issues.push("Date of birth is after or equal to expiry date");
    }
  }

  // Check that gender field exists and is valid
  const gender = fields["Gender"];
  if (gender && !["Male", "Female", "M", "F"].includes(gender)) {
    issues.push(`Invalid gender value: "${gender}"`);
  }

  // Check nationality format (should be 3-letter ISO code)
  const nationality = fields["Nationality"];
  if (nationality && nationality.length !== 3) {
    issues.push(`Nationality "${nationality}" is not a 3-letter code`);
  }

  if (issues.length === 0) {
    return {
      name: "Cross-Field Consistency",
      description: "Verify consistency between extracted fields",
      status: "pass",
      details: "All cross-field checks passed",
    };
  }

  return {
    name: "Cross-Field Consistency",
    description: "Verify consistency between extracted fields",
    status: issues.length >= 2 ? "fail" : "warning",
    details: issues.join("; "),
  };
}

function checkDatabaseLookup(ocr: OCRResult): ValidationCheck {
  const docNumber = ocr.fields["Document Number"];
  if (!docNumber) {
    return {
      name: "Database Lookup",
      description: "Check document number against valid registry and blacklist",
      status: "unknown",
      details: "No document number available for lookup",
    };
  }

  // Check blacklist first
  const isBlacklisted = checkBlacklist(docNumber);
  if (isBlacklisted) {
    return {
      name: "Database Lookup",
      description: "Check document number against valid registry and blacklist",
      status: "fail",
      details: `⚠️ BLACKLIST HIT: Document number "${docNumber}" is on the blacklist`,
    };
  }

  // Check valid registry
  // TODO: Replace with real government database query
  const registryResult = checkValidRegistry(docNumber);

  if (registryResult.found) {
    const rec = registryResult.record!;
    return {
      name: "Database Lookup",
      description: "Check document number against valid registry and blacklist",
      status: "pass",
      details: `Document "${docNumber}" found in valid registry — holder: ${rec.holderName}, issued: ${rec.issuedDate}, expires: ${rec.expiryDate}`,
    };
  }

  return {
    name: "Database Lookup",
    description: "Check document number against valid registry and blacklist",
    status: "warning",
    details: `Document "${docNumber}" not found in mock registry — may need real DB lookup`,
  };
}

function checkDocumentTypeConsistency(ocr: OCRResult): ValidationCheck {
  const type = ocr.detectedType;
  const fields = ocr.fields;

  // Check that extracted fields are reasonable for the detected type
  const hasPhoto =
    ocr.rawText.toLowerCase().includes("photo") ||
    ocr.rawText.toLowerCase().includes("photograph");

  if (type === "passport" && !hasPhoto) {
    return {
      name: "Document Type Consistency",
      description: "Verify extracted fields are consistent with detected document type",
      status: "warning",
      details: "Passport detected but no photo reference found in OCR text",
    };
  }

  return {
    name: "Document Type Consistency",
    description: "Verify extracted fields are consistent with detected document type",
    status: "pass",
    details: `Fields are consistent with detected type: ${type.replace("_", " ")}`,
  };
}

// ─── Main Validation Function ───────────────────────────────────────────

/**
 * Run all validation checks on extracted OCR data.
 * TODO: Replace with real database connections and trained validation models.
 */
export async function validateDocument(ocr: OCRResult): Promise<ValidationResult> {
  const startTime = performance.now();

  const checks: ValidationCheck[] = [
    checkDocumentNumberFormat(ocr),
    checkMRZChecksums(ocr),
    checkExpiryDate(ocr),
    checkDateOfBirthPlausibility(ocr),
    checkCrossFieldConsistency(ocr),
    checkDatabaseLookup(ocr),
    checkDocumentTypeConsistency(ocr),
  ];

  const passCount = checks.filter((c) => c.status === "pass").length;
  const passRate = Math.round((passCount / checks.length) * 100);

  const docNumber = ocr.fields["Document Number"] || "";

  // Validation is rule-based (not ML) — always "real" by design
  setModuleStatus("validation", "real");

  return {
    checks,
    passRate,
    blacklistHit: checkBlacklist(docNumber),
    validRegistryHit: checkValidRegistry(docNumber).found,
    processingTime: Math.round(performance.now() - startTime),
  };
}
