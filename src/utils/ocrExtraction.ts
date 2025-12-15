/**
 * OCR Field Extraction Utilities
 * Shared patterns for extracting quality, color, lot number, and meters from OCR text
 */

// Regex patterns for field extraction
export const PATTERNS = {
  quality: [
    /(?:QUALITY|KALITE|KAL[İI]TE|QUAL[İI]TY)[\s:]*([A-Z0-9\-\.\/]+)/i,
    /\b([A-Z]{1,3}[\-\s]?\d{2,4}(?:[A-Z]{0,2})?)\b/i,
    /\b([A-Z]\d{3,4})\b/,
    /\b(\d{4,5}[A-Z]{0,2})\b/,
  ],
  color: [
    /(?:COLOR|COLOUR|RENK|COL|CLR)[\s:]*([A-Z0-9\s\-\/\.]+?)(?=\s*(?:LOT|PART|MT|M\.|METRE|$))/i,
    /(?:COLOR|COLOUR|RENK)[\s:]*([A-Z]+[\s\-]?[0-9]+|[0-9]+[\s\-]?[A-Z]+)/i,
    /(?:COLOR|COLOUR|RENK)[\s:]*([A-Z]{2,})/i,
  ],
  lotNumber: [
    /(?:LOT|PARTI|PART[İI]|BATCH|LOT\s*(?:NO|NUMBER|NUMARASI))[\s:\.#]*([A-Z0-9\-\/\.]+)/i,
    /\b(?:LOT|PARTI|BATCH)[\s#:]*(\d{3,}[A-Z]?)\b/i,
    /\bL[\s\-]?(\d{4,})\b/i,
  ],
  meters: [
    /(\d+[\.,]?\d*)\s*(?:MT|M\.|METRE|METER|METERS|M(?:\s|$))/i,
    /(?:LENGTH|UZUNLUK|BOY)[\s:]*(\d+[\.,]?\d*)/i,
    /(?:MT|M\.)[\s:]*(\d+[\.,]?\d*)/i,
    /\b(\d{2,5})\s*(?:MT|M\.?)\b/i,
  ],
};

export interface ExtractedField {
  value: string | null;
  confidence: number;
}

export interface ExtractedMeters {
  value: number | null;
  confidence: number;
}

export interface OCRExtractedData {
  quality: string | null;
  qualityConfidence: number;
  color: string | null;
  colorConfidence: number;
  lotNumber: string | null;
  lotNumberConfidence: number;
  meters: number | null;
  metersConfidence: number;
}

export interface OCRConfidence {
  overallScore: number;
  level: 'high' | 'medium' | 'low';
}

/**
 * Extract a single field from text using regex patterns
 */
export function extractField(text: string, patterns: RegExp[]): ExtractedField {
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match && match[1]) {
      const value = match[1].trim().toUpperCase();
      // Higher confidence for earlier patterns (more specific)
      const confidence = Math.max(0.5, 1 - i * 0.15);
      return { value, confidence };
    }
  }
  return { value: null, confidence: 0 };
}

/**
 * Extract meters value with special handling for decimal separators
 */
export function extractMeters(text: string): ExtractedMeters {
  for (let i = 0; i < PATTERNS.meters.length; i++) {
    const match = text.match(PATTERNS.meters[i]);
    if (match && match[1]) {
      // Handle both comma and period as decimal separator
      const normalized = match[1].replace(',', '.');
      const value = parseFloat(normalized);
      if (!isNaN(value) && value > 0 && value < 100000) {
        const confidence = Math.max(0.5, 1 - i * 0.15);
        return { value, confidence };
      }
    }
  }
  return { value: null, confidence: 0 };
}

/**
 * Determine confidence level from score
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.85) return 'high';
  if (score >= 0.60) return 'medium';
  return 'low';
}

/**
 * Check if OCR result appears to be a valid label
 */
export function isValidLabel(text: string, fieldsExtracted: number): boolean {
  // Must have at least 2 fields and reasonable text length
  const hasMinFields = fieldsExtracted >= 2;
  const hasMinLength = text.length >= 10;
  const hasMaxLength = text.length <= 5000;
  const hasNumbers = /\d/.test(text);
  
  return hasMinFields && hasMinLength && hasMaxLength && hasNumbers;
}

/**
 * Extract all fields from OCR text
 */
export function extractAllFields(rawText: string): OCRExtractedData {
  const quality = extractField(rawText, PATTERNS.quality);
  const color = extractField(rawText, PATTERNS.color);
  const lotNumber = extractField(rawText, PATTERNS.lotNumber);
  const meters = extractMeters(rawText);

  return {
    quality: quality.value,
    qualityConfidence: quality.confidence,
    color: color.value,
    colorConfidence: color.confidence,
    lotNumber: lotNumber.value,
    lotNumberConfidence: lotNumber.confidence,
    meters: meters.value,
    metersConfidence: meters.confidence,
  };
}

/**
 * Calculate overall confidence from extracted fields
 */
export function calculateOverallConfidence(extracted: OCRExtractedData, tesseractConfidence: number): OCRConfidence {
  const fieldConfidences = [
    extracted.qualityConfidence,
    extracted.colorConfidence,
    extracted.lotNumberConfidence,
    extracted.metersConfidence,
  ].filter(c => c > 0);

  const avgFieldConfidence = fieldConfidences.length > 0
    ? fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length
    : 0;

  // Weight tesseract confidence (0-100 scaled to 0-1) and field confidence
  const normalizedTesseract = tesseractConfidence / 100;
  const overallScore = (normalizedTesseract * 0.4) + (avgFieldConfidence * 0.6);

  return {
    overallScore,
    level: getConfidenceLevel(overallScore),
  };
}

/**
 * Count how many fields were successfully extracted
 */
export function countExtractedFields(extracted: OCRExtractedData): number {
  let count = 0;
  if (extracted.quality) count++;
  if (extracted.color) count++;
  if (extracted.lotNumber) count++;
  if (extracted.meters !== null && extracted.meters > 0) count++;
  return count;
}
