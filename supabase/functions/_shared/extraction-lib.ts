// Shared extraction library for AI order extraction

// Color normalization dictionary (Turkish-aware)
export const colorsDict: Record<string, string> = {
  "bej": "BEIGE",
  "beige": "BEIGE",
  "kahverengi": "BROWN",
  "kahverengı": "BROWN",
  "brown": "BROWN",
  "siyah": "BLACK",
  "black": "BLACK",
  "lacivert": "NAVY",
  "lacıvert": "NAVY",
  "koyu lacivert": "DARK NAVY",
  "koyu lacıvert": "DARK NAVY",
  "navy": "NAVY",
  "marine": "MARINE",
  "gri": "GREY",
  "grı": "GREY",
  "grey": "GREY",
  "gray": "GREY",
  "gümüş": "SILVER GREY",
  "gumus": "SILVER GREY",
  "silver": "SILVER GREY",
  "silver grey": "SILVER GREY",
  "kum": "SANDSTONE",
  "sandstone": "SANDSTONE",
  "beyaz": "WHITE",
  "white": "WHITE",
  "lovat": "LOVAT",
  "mavi": "BLUE",
  "blue": "BLUE",
  "yeşil": "GREEN",
  "yesil": "GREEN",
  "green": "GREEN",
  "kırmızı": "RED",
  "kirmizi": "RED",
  "red": "RED",
  "turuncu": "ORANGE",
  "orange": "ORANGE",
  "sarı": "YELLOW",
  "sari": "YELLOW",
  "yellow": "YELLOW",
  "pembe": "PINK",
  "pink": "PINK",
  "mor": "PURPLE",
  "purple": "PURPLE",
  // Additional TR colors
  "haki": "KHAKI",
  "hakı": "KHAKI",
  "khaki": "KHAKI",
  "fume": "SMOKED",
  "fumé": "SMOKED",
  "smoked": "SMOKED",
  "kul": "ASH",
  "ash": "ASH",
};

// Quality patterns (regex-based recognition)
export const qualityPatterns = [
  /\bV-?\s?(\d{3,5})\b/i,           // V710, V-710, V 710
  /\bKS?20\b/i,                     // KS20, K520
  /\bSU\d{3}\.\d{3}\b/i,            // SU200.029
  /\bKDB\d{2}\.\d{5}\b/i,           // KDB02.01967
  /\b([A-ZŞÇİÖÜ]{1,3}\d{2,5})\b/,   // V710, SU200, etc.
  /\b([A-ZŞÇİÖÜ]{2,}\s?\d{2,})\b/,  // Brand + series pattern
];

// Enhanced interfaces
export interface ParsedLine {
  quality: string | null;
  color: string | null;
  meters: number | null;
  source_row: string;
  extraction_status: 'ok' | 'needs_review' | 'missing';
  resolution_source?: 'deterministic' | 'llm';
  conflict_info?: {
    detected_label: string;
    detected_code: string;
    possible_qualities: string[];
  };
}

export interface DBValidationContext {
  qualities: Record<string, { code: string; aliases: string[] }>;
  colorsByQuality: Record<string, Array<{ label: string; code: string | null }>>;
  colorCodeToQualities: Record<string, string[]>;
}

// Noise tokens to remove
const noiseTokens = /\b(ASTAR|%100|TWILL|VISCOSE|VISKOS|GRUP|GROUP|PONGE|PLAIN)\b/gi;

/**
 * Normalize Turkish characters and case, remove noise
 */
export function normalizeTurkish(text: string): string {
  return text
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .replace(noiseTokens, '') // Remove noise
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim()
    .toUpperCase();
}

/**
 * Parse meters expression with sum/multiply support
 * Handles: "10 MT", "10 + 20", "2x10", "10 + 2x5"
 */
export function parseMetersExpression(text: string): number | null {
  text = text.trim().toUpperCase();
  
  // Simple meter extraction first
  const simpleMatch = text.match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s*(?:MT|M|METRE|METER)?/i);
  
  // Check for sum/multiply expressions
  const hasSumOrMultiply = /[\+\*xX]/.test(text);
  
  if (!hasSumOrMultiply && simpleMatch) {
    // Simple case: just a number
    let wholeNumber = simpleMatch[1].replace(/\./g, '');
    const decimal = simpleMatch[2] || '0';
    const result = parseFloat(`${wholeNumber}.${decimal}`);
    return isNaN(result) || result <= 0 ? null : result;
  }
  
  // Parse complex expressions
  let total = 0;
  
  // Handle multiplication (2x10, 2*10)
  const multiplyMatches = text.matchAll(/(\d+(?:,\d+)?)\s*[xX\*]\s*(\d+(?:,\d+)?)/g);
  for (const match of multiplyMatches) {
    const a = parseFloat(match[1].replace(',', '.'));
    const b = parseFloat(match[2].replace(',', '.'));
    total += a * b;
    // Remove from text to avoid double counting
    text = text.replace(match[0], '');
  }
  
  // Handle addition
  const additionMatches = text.matchAll(/(\d+(?:,\d+)?)\s*\+\s*(\d+(?:,\d+)?)/g);
  for (const match of additionMatches) {
    const a = parseFloat(match[1].replace(',', '.'));
    const b = parseFloat(match[2].replace(',', '.'));
    total += a + b;
    text = text.replace(match[0], '');
  }
  
  // If no operations found, try simple number
  if (total === 0) {
    const numbers = text.match(/(\d+(?:,\d+)?)/g);
    if (numbers && numbers.length > 0) {
      total = parseFloat(numbers[0].replace(',', '.'));
    }
  }
  
  return total > 0 ? total : null;
}

/**
 * Extract quality from text using patterns
 */
export function extractQuality(text: string): string | null {
  const normalized = normalizeTurkish(text);
  
  for (const pattern of qualityPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      // Return the captured group or the whole match
      return (match[1] || match[0]).trim().replace(/\s+/g, '');
    }
  }
  
  return null;
}

/**
 * Extract and normalize color from text
 */
export function extractColor(text: string): string | null {
  const normalized = normalizeTurkish(text.toLowerCase());
  
  // First, check for numeric color codes (e.g., 1463, 1522)
  const numericColorMatch = text.match(/\b(\d{4})\b/);
  if (numericColorMatch) {
    return numericColorMatch[1];
  }
  
  // Check dictionary for known colors
  for (const [key, value] of Object.entries(colorsDict)) {
    if (normalized.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Try to find any color-like word
  const colorWords = normalized.match(/\b([a-z]{3,})\b/g);
  if (colorWords) {
    for (const word of colorWords) {
      if (colorsDict[word]) {
        return colorsDict[word];
      }
    }
  }
  
  return null;
}

/**
 * Deterministic extraction from raw text
 * Returns array of parsed lines with quality, color, meters
 */
export function deterministicExtract(rawText: string): ParsedLine[] {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const results: ParsedLine[] = [];
  
  for (const line of lines) {
    // Skip very short lines (likely headers or noise)
    if (line.trim().length < 10) continue;
    
    // Skip lines that look like headers
    if (/^(sira|no|kalite|quality|renk|color|metre|meter)/i.test(line.trim())) continue;
    
    const quality = extractQuality(line);
    const color = extractColor(line);
    const meters = parseMeters(line);
    
    // Determine status
    let status: 'ok' | 'needs_review' | 'missing' = 'ok';
    if (!quality || !color || !meters) {
      status = 'needs_review';
    }
    if (!quality && !color && !meters) {
      status = 'missing';
    }
    
    // Only add lines that have at least one field
    if (quality || color || meters) {
      results.push({
        quality,
        color,
        meters,
        source_row: line.trim().substring(0, 200), // Limit source row length
        extraction_status: status,
      });
    }
  }
  
  return results;
}

/**
 * Merge deterministic results with LLM results
 * LLM results take precedence for fields marked as needs_review
 */
export function mergeDeterministicAndLLM(
  detRows: ParsedLine[],
  llmRows: ParsedLine[]
): ParsedLine[] {
  if (!llmRows || llmRows.length === 0) return detRows;
  
  const merged: ParsedLine[] = [];
  
  for (let i = 0; i < detRows.length; i++) {
    const det = detRows[i];
    const llm = llmRows[i]; // Assume same order
    
    if (!llm) {
      merged.push(det);
      continue;
    }
    
    // Use LLM values if deterministic extraction failed
    merged.push({
      quality: det.quality || llm.quality,
      color: det.color || llm.color,
      meters: det.meters || llm.meters,
      source_row: det.source_row,
      extraction_status: 
        (det.quality || llm.quality) && 
        (det.color || llm.color) && 
        (det.meters || llm.meters)
          ? 'ok'
          : 'needs_review',
    });
  }
  
  return merged;
}

/**
 * Validate and clean a parsed line
 */
export function validateLine(line: ParsedLine): boolean {
  if (!line.quality || !line.color || !line.meters) return false;
  if (line.meters <= 0) return false;
  if (line.quality.length < 2) return false;
  if (line.color.length < 2) return false;
  return true;
}
