/**
 * Module 1 — OCR Extraction
 *
 * TODO: Replace with trained PaddleOCR/EasyOCR model when available.
 * Currently uses Tesseract.js for general OCR and rule-based MRZ parsing.
 */

import type {
  OCRResult,
  MRZData,
  ExtractedFields,
  DocumentType,
} from "../types";
import { setModuleStatus } from "../model-status";

// ─── MRZ Parser (ICAO 9303 format for passports) ─────────────────────────

/** Calculate a check digit for MRZ fields */
function mrzCheckDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    let charVal: number;
    const ch = value[i];
    if (ch === "<") {
      charVal = 0;
    } else if (ch >= "0" && ch <= "9") {
      charVal = parseInt(ch, 10);
    } else {
      // Letters A-Z map to 10–35
      charVal = ch.charCodeAt(0) - 55;
    }
    sum += charVal * weights[i % 3];
  }
  return sum % 10;
}

/** Validate an MRZ check digit field (value + check digit) */
function validateMRZField(field: string, expectedCheckDigit: string): boolean {
  if (field.length < 1) return false;
  const calculated = mrzCheckDigit(field);
  return calculated.toString() === expectedCheckDigit;
}

/** Parse a 2-line passport MRZ (TD3 format: 44 chars per line) */
function parsePassportMRZ(line1: string, line2: string): MRZData | null {
  if (line1.length < 44 || line2.length < 44) return null;

  // Line 1: P<CTY<SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<
  const docType = line1.substring(0, 1);
  const issuingCountry = line1.substring(2, 5).replace(/</g, "");
  const namePart = line1.substring(5);
  const nameParts = namePart.split("<<");
  const lastName = nameParts[0]?.replace(/</g, " ").trim() || "";
  const firstName = nameParts[1]?.replace(/</g, " ").trim() || "";

  // Line 2: DOCNUM<CHECK<NAT<DOB<CHECK<SEX<EXP<CHECK<PERSONAL<RES<CHECK
  const docNumber = line2.substring(0, 9).replace(/</g, "");
  const docNumberCheck = line2.substring(9, 10);
  const nationality = line2.substring(10, 13).replace(/</g, "");
  const dob = line2.substring(13, 19);
  const dobCheck = line2.substring(19, 20);
  const gender = line2.substring(20, 21);
  const expiry = line2.substring(21, 27);
  const expiryCheck = line2.substring(27, 28);
  const personalNumber = line2.substring(28, 42).replace(/</g, "");
  const finalCheck = line2.substring(42, 43);

  // Validate checksums
  const docNumValid = validateMRZField(docNumber, docNumberCheck);
  const dobValid = validateMRZField(dob, dobCheck);
  const expiryValid = validateMRZField(expiry, expiryCheck);

  // Composite check: positions 0-9 + 13-19 + 21-42
  const compositeStr = line2.substring(0, 9) + line2.substring(13, 20) + line2.substring(21, 43);
  const finalValid = validateMRZField(compositeStr, finalCheck);

  if (!docNumValid && !dobValid && !expiryValid) {
    // If all checksums fail, likely not a valid MRZ
    return null;
  }

  return {
    documentNumber: docNumber,
    nationality: nationality,
    dateOfBirth: formatDate(dob),
    dateOfExpiry: formatDate(expiry),
    gender: gender === "M" ? "Male" : gender === "F" ? "Female" : gender,
    lastName: lastName,
    firstName: firstName,
    personalNumber: personalNumber,
    rawLine1: line1,
    rawLine2: line2,
  };
}

/** Parse a 3-line visa MRZ (TD1 format: 30 chars per line) */
function parseVisaMRZ(lines: string[]): MRZData | null {
  if (lines.length < 3 || lines[0].length < 30) return null;

  const docType = lines[0].substring(0, 1);
  const issuingCountry = lines[0].substring(2, 5).replace(/</g, "");
  const namePart = lines[0].substring(5);
  const nameParts = namePart.split("<<");
  const lastName = nameParts[0]?.replace(/</g, " ").trim() || "";
  const firstName = nameParts[1]?.replace(/</g, " ").trim() || "";

  const docNumber = lines[1].substring(0, 9).replace(/</g, "");
  const nationality = lines[1].substring(10, 13).replace(/</g, "");
  const dob = lines[1].substring(13, 19);
  const gender = lines[1].substring(20, 21);
  const expiry = lines[2].substring(0, 6);

  return {
    documentNumber: docNumber,
    nationality: nationality,
    dateOfBirth: formatDate(dob),
    dateOfExpiry: formatDate(expiry),
    gender: gender === "M" ? "Male" : gender === "F" ? "Female" : gender,
    lastName: lastName,
    firstName: firstName,
    personalNumber: "",
    rawLine1: lines[0],
    rawLine2: lines[1] + (lines[2] || ""),
  };
}

/** Format MRZ date (YYMMDD) to ISO string */
function formatDate(yymmdd: string): string {
  if (yymmdd.length !== 6) return yymmdd;
  const year = parseInt(yymmdd.substring(0, 2), 10);
  const month = yymmdd.substring(2, 4);
  const day = yymmdd.substring(4, 6);
  // MRZ dates: if year > 50, assume 19xx; otherwise 20xx
  const fullYear = year > 50 ? 1900 + year : 2000 + year;
  return `${fullYear}-${month}-${day}`;
}

// ─── Document Type Detection ─────────────────────────────────────────────

function detectDocumentType(text: string, mrzData: MRZData | null): DocumentType {
  const lower = text.toLowerCase();

  if (mrzData) {
    // MRZ detected — check line 1 format
    const firstChars = (mrzData.rawLine1 || "").substring(0, 2);
    if (firstChars === "P<") return "passport";
    if (firstChars === "V<") return "visa";
  }

  if (
    lower.includes("passport") ||
    lower.includes("republic of india") ||
    lower.includes("passport no")
  ) {
    return "passport";
  }
  if (lower.includes("visa") || lower.includes("visa no") || lower.includes("entry permit")) {
    return "visa";
  }
  if (
    lower.includes("driving licence") ||
    lower.includes("driving license") ||
    lower.includes("motor vehicle")
  ) {
    return "driving_license";
  }
  if (
    lower.includes("national identity") ||
    lower.includes("aadhaar") ||
    lower.includes("identity card") ||
    lower.includes("electors photo")
  ) {
    return "national_id";
  }
  if (lower.includes("permit") || lower.includes("work permit") || lower.includes("residence permit")) {
    return "permit";
  }

  return "national_id"; // Default fallback
}

// ─── Main OCR Function ───────────────────────────────────────────────────

/**
 * Run OCR extraction on an uploaded document image.
 * TODO: Replace with trained PaddleOCR model for better accuracy.
 * TODO: Integrate real MRZ parsing library for production use.
 */
export async function runOCR(file: File): Promise<OCRResult> {
  const startTime = performance.now();

  // Dynamically import Tesseract to avoid bundling issues
  const Tesseract = await import("tesseract.js");

  // Create image data URL for processing
  const imageDataUrl = await fileToDataURL(file);

  // Run Tesseract OCR
  const {
    data: { text, confidence },
  } = await Tesseract.recognize(imageDataUrl, "eng", {
    logger: () => {},
  });

  const rawText = text.trim();

  // Try to detect MRZ lines (sequences of 44+ chars with lots of < characters)
  const lines = rawText.split("\n").map((l: string) => l.trim()).filter(Boolean);
  let mrzDetected = false;
  let mrzData: MRZData | null = null;

  // Look for MRZ patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // MRZ lines are typically 44 chars (TD3) or 30 chars (TD1) with mostly uppercase + < chars
    const mrzPattern = /^[A-Z0-9<]{20,}$/;

    if (mrzPattern.test(line) && line.length >= 30) {
      // Check for TD3 (passport: 2 lines of 44)
      if (line.length >= 44) {
        const nextLine = lines[i + 1];
        if (nextLine && mrzPattern.test(nextLine) && nextLine.length >= 44) {
          mrzDetected = true;
          mrzData = parsePassportMRZ(line.substring(0, 44), nextLine.substring(0, 44));
          break;
        }
      }
      // Check for TD1 (visa: 3 lines of 30)
      if (line.length >= 30 && line.length <= 31) {
        const nextLines = lines.slice(i, i + 3);
        if (nextLines.length >= 3 && nextLines.every((l: string) => mrzPattern.test(l))) {
          mrzDetected = true;
          mrzData = parseVisaMRZ(nextLines.map((l: string) => l.substring(0, 30)));
          break;
        }
      }
    }
  }

  // Detect document type
  const detectedType = detectDocumentType(rawText, mrzData);

  // Extract structured fields based on detected type
  const fields = extractFields(rawText, detectedType, mrzData ?? undefined);

  const processingTime = performance.now() - startTime;

  // Set module status — using Tesseract.js (real OCR)
  // TODO: When PaddleOCR/EasyOCR ONNX is integrated, update to "real"
  setModuleStatus("ocr", "real");

  return {
    rawText,
    fields,
    confidence: Math.round(confidence),
    mrzDetected,
    mrzData: mrzData ?? undefined,
    detectedType,
    processingTime: Math.round(processingTime),
    warnings: mrzDetected
      ? []
      : ["No MRZ detected — document may not be machine-readable or image quality is low."],
  };
}

// ─── Field Extraction ────────────────────────────────────────────────────

function extractFields(
  rawText: string,
  docType: DocumentType,
  mrzData?: MRZData
): ExtractedFields {
  const fields: ExtractedFields = {};

  if (mrzData) {
    fields["Document Number"] = mrzData.documentNumber;
    fields["Given Name"] = mrzData.firstName;
    fields["Surname"] = mrzData.lastName;
    fields["Nationality"] = mrzData.nationality;
    fields["Date of Birth"] = mrzData.dateOfBirth;
    fields["Date of Expiry"] = mrzData.dateOfExpiry;
    fields["Gender"] = mrzData.gender;
    fields["Personal Number"] = mrzData.personalNumber;
  }

  // Supplement with regex-based field extraction from raw OCR text
  const patterns: Record<string, RegExp[]> = {
    "Document Number": [
      /passport\s*(?:no|number|#)\s*[:.]?\s*([A-Z0-9]+)/i,
      /visa\s*(?:no|number|#)\s*[:.]?\s*([A-Z0-9\-]+)/i,
      /(?:license|licence)\s*(?:no|number|#)\s*[:.]?\s*([A-Z0-9]+)/i,
      /id\s*(?:no|number|#)\s*[:.]?\s*([A-Z0-9\-]+)/i,
      /permit\s*(?:no|number|#)\s*[:.]?\s*([A-Z0-9\-]+)/i,
    ],
    "Given Name": [
      /(?:given\s*name|first\s*name|prenom)\s*[:.]?\s*([A-Z\s]+?)(?:\n|$)/i,
    ],
    "Surname": [
      /(?:surname|last\s*name|family\s*name|nom)\s*[:.]?\s*([A-Z\s]+?)(?:\n|$)/i,
    ],
    "Date of Birth": [
      /(?:date\s*of\s*birth|dob|birth\s*date|naissance)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    "Date of Expiry": [
      /(?:date\s*of\s*expiry|expiry\s*date|valid\s*until|validite)\s*[:.]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ],
    "Gender": [
      /(?:sex|gender|sexe)\s*[:.]?\s*(male|female|m|f)/i,
    ],
    "Nationality": [
      /(?:nationality|nationalite)\s*[:.]?\s*([A-Z\s]+?)(?:\n|$)/i,
    ],
    "Issuing Authority": [
      /(?:issued?\s*by|issuing\s*authority|ministry)\s*[:.]?\s*(.+?)(?:\n|$)/i,
    ],
    "Place of Birth": [
      /(?:place\s*of\s*birth|birthplace|lieu\s*de\s*naissance)\s*[:.]?\s*(.+?)(?:\n|$)/i,
    ],
  };

  for (const [fieldName, regexes] of Object.entries(patterns)) {
    // Skip if MRZ already provided this field
    if (fields[fieldName]) continue;

    for (const regex of regexes) {
      const match = rawText.match(regex);
      if (match && match[1]) {
        fields[fieldName] = match[1].trim();
        break;
      }
    }
  }

  return fields;
}

// ─── Utility ─────────────────────────────────────────────────────────────

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
