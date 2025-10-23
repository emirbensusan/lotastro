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
 * Handles: "10 MT", "10 + 20", "2x10", "10 + 2x5", "2x10 MT 20"
 * When an expression is found, ignores trailing standalone numbers (echo pattern)
 * CRITICAL: Remove color code tokens (E235, 1463, etc.) before parsing to avoid confusion
 */
export function parseMetersExpression(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  
  const original = text;
  const normalized = normalizeTurkish(text);
  
  console.log(`[parseMetersExpression] Original: "${original}"`);
  
  // CRITICAL: Remove color code tokens FIRST (e.g., E235, 1653, V710) to prevent misinterpretation
  const colorCodePattern = /\b[A-Z]?\d{3,4}\b/g;
  const textWithoutColorCodes = normalized.replace(colorCodePattern, '').replace(/\s+/g, ' ').trim();
  console.log(`[parseMetersExpression] After removing color codes: "${textWithoutColorCodes}"`);
  
  // Check for sum/multiply expressions first
  const hasSumOrMultiply = /[\+\*xX]/.test(textWithoutColorCodes);
  
  if (hasSumOrMultiply) {
    // Parse complex expressions
    let total = 0;
    let foundExpression = false;
    let workingText = textWithoutColorCodes;
    
    // Handle multiplication (2x10, 2*10)
    const multiplyMatches = [...workingText.matchAll(/(\d+(?:[.,]\d+)?)\s*[xX\*]\s*(\d+(?:[.,]\d+)?)/g)];
    for (const match of multiplyMatches) {
      const a = parseFloat(match[1].replace(',', '.'));
      const b = parseFloat(match[2].replace(',', '.'));
      total += a * b;
      foundExpression = true;
      // Remove from text to avoid double counting
      workingText = workingText.replace(match[0], ' ');
    }
    
    // Handle addition (must be after removing multiplications)
    const additionMatches = [...workingText.matchAll(/(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)/g)];
    for (const match of additionMatches) {
      const a = parseFloat(match[1].replace(',', '.'));
      const b = parseFloat(match[2].replace(',', '.'));
      total += a + b;
      foundExpression = true;
      workingText = workingText.replace(match[0], ' ');
    }
    
    // If we found an expression and got a valid total, return it
    // (ignoring any trailing standalone numbers which are likely echoes)
    if (foundExpression && total > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${total} (expression found, ignoring trailing numbers)`);
      return total;
    }
  }
  
  // Prefer numbers explicitly followed by unit (MT|M|METRE|METER)
  const unitMatch = textWithoutColorCodes.match(/(\d+(?:[.,]\d+)?)\s*(?:MT|M|METRE|METER)\b/i);
  if (unitMatch) {
    const result = parseFloat(unitMatch[1].replace(',', '.'));
    if (!isNaN(result) && result > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${result} (with unit)`);
      return result;
    }
  }
  
  // Fallback: extract last standalone number
  const allNumbers = [...textWithoutColorCodes.matchAll(/\b(\d+(?:[.,]\d+)?)\b/g)];
  if (allNumbers.length > 0) {
    const lastMatch = allNumbers[allNumbers.length - 1];
    const result = parseFloat(lastMatch[1].replace(',', '.'));
    if (!isNaN(result) && result > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${result} (last number)`);
      return result;
    }
  }
  
  console.log(`[parseMetersExpression] "${original}" -> null (no valid number found)`);
  return null;
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
  
  // First, check for numeric color codes (e.g., 1463, 1522, E235)
  const numericColorMatch = text.match(/\b([A-Z]?\d{3,4})\b/);
  if (numericColorMatch) {
    return numericColorMatch[1].toUpperCase();
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
 * Infer quality from color code when unique
 */
export function inferQualityFromColorCode(
  colorCode: string,
  dbContext: DBValidationContext
): { quality: string | null; ambiguous: boolean; candidates: string[] } {
  const candidates = dbContext.colorCodeToQualities[colorCode.toUpperCase()] || [];
  
  if (candidates.length === 0) {
    return { quality: null, ambiguous: false, candidates: [] };
  }
  
  if (candidates.length === 1) {
    return { quality: candidates[0], ambiguous: false, candidates };
  }
  
  // Multiple qualities have this color code - ambiguous
  return { quality: null, ambiguous: true, candidates };
}

/**
 * Deterministic extraction from raw text with DB validation
 * Returns array of parsed lines with quality, color, meters
 */
export function deterministicExtract(rawText: string, dbContext?: DBValidationContext): ParsedLine[] {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const results: ParsedLine[] = [];
  
  for (const line of lines) {
    // Skip very short lines (likely headers or noise)
    if (line.trim().length < 10) continue;
    
    // Skip lines that look like headers
    if (/^(sira|no|kalite|quality|renk|color|metre|meter)/i.test(line.trim())) continue;
    
    let quality = extractQuality(line);
    let color = extractColor(line);
    const meters = parseMetersExpression(line);
    let needsReview = false;
    let conflictInfo: ParsedLine['conflict_info'] | undefined;
    
    // CRITICAL: If extracted "quality" looks like a color code (e.g., E235), validate against DB
    if (quality && /^[A-Z]?\d{3,4}$/.test(quality)) {
      console.log(`[deterministicExtract] Quality ${quality} looks like a color code, checking DB...`);
      
      // If it's not a valid quality in DB, treat it as null to enable color-only inference
      if (dbContext) {
        const qualityValid = !!dbContext.qualities[quality] || 
          Object.values(dbContext.qualities).some(q => 
            q.aliases.some(a => a.toUpperCase() === quality.toUpperCase())
          );
        
        if (!qualityValid) {
          console.log(`[deterministicExtract] ${quality} not found as quality in DB, treating as null`);
          quality = null; // Not a valid quality - likely a color code misidentified
        } else {
          console.log(`[deterministicExtract] ${quality} confirmed as valid quality in DB`);
        }
      }
    }
    
    // Color-only inference: if no quality but color code detected, try inferring from DB
    if (!quality && color && dbContext) {
      console.log(`[deterministicExtract] No quality, attempting inference from color: ${color}`);
      const inferResult = inferQualityFromColorCode(color, dbContext);
      
      if (inferResult.quality) {
        // Unique match - use it
        quality = inferResult.quality;
        console.log(`[deterministicExtract] Inferred unique quality from color ${color}: ${quality}`);
      } else if (inferResult.ambiguous) {
        // Ambiguous - mark for review with candidates
        needsReview = true;
        conflictInfo = {
          detected_label: '',
          detected_code: color,
          possible_qualities: inferResult.candidates
        };
        console.log(`[deterministicExtract] Ambiguous color code ${color}, candidates: ${inferResult.candidates.join(', ')}`);
      } else {
        console.log(`[deterministicExtract] No quality inference possible for color ${color}`);
      }
    }
    
    // Validate quality against DB
    if (quality && dbContext) {
      const qualityValid = !!dbContext.qualities[quality] || 
        Object.values(dbContext.qualities).some(q => 
          q.aliases.some(a => a.toUpperCase() === quality?.toUpperCase())
        );
      
      if (!qualityValid) {
        console.warn(`[deterministicExtract] Quality ${quality} not found in DB`);
        needsReview = true;
      }
    }
    
    // Validate color against quality
    if (quality && color && dbContext) {
      const qualityColors = dbContext.colorsByQuality[quality] || [];
      const colorValid = qualityColors.some(c => 
        c.label.toUpperCase() === color?.toUpperCase() || 
        (c.code && c.code.toUpperCase() === color?.toUpperCase())
      );
      
      if (!colorValid) {
        console.log(`[deterministicExtract] Invalid Q+C combo: ${quality} + ${color}`);
        needsReview = true;
      }
    }
    
    // Determine status
    let status: 'ok' | 'needs_review' | 'missing' = needsReview ? 'needs_review' : 'ok';
    if (!quality || !color || !meters) {
      status = 'needs_review';
    }
    if (!quality && !color && !meters) {
      status = 'missing';
    }
    
    // Final state log for debugging
    console.log(
      `[deterministicExtract] Line: "${line.substring(0, 20)}..." -> ` +
      `Q:${quality || 'null'} C:${color || 'null'} M:${meters || 'null'} Status:${status}`
    );
    
    // Only add lines that have at least one field
    if (quality || color || meters) {
      results.push({
        quality,
        color,
        meters,
        source_row: line.trim().substring(0, 200), // Limit source row length
        extraction_status: status,
        resolution_source: 'deterministic',
        conflict_info: conflictInfo
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
