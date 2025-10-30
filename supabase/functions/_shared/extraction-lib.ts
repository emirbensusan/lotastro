// Shared extraction library for AI order extraction

// PHASE 1D: Expanded Color normalization dictionary (Turkish + English)
export const colorsDict: Record<string, string> = {
  // Basic colors
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
  "dark navy": "DARK NAVY",
  "navy": "NAVY",
  "marine": "MARINE",
  "gri": "GREY",
  "grı": "GREY",
  "grey": "GREY",
  "gray": "GREY",
  "smoke grey": "SMOKE GREY",
  "gümüş": "SILVER GREY",
  "gumus": "SILVER GREY",
  "silver": "SILVER GREY",
  "silver grey": "SILVER GREY",
  "kum": "SANDSTONE",
  "sandstone": "SANDSTONE",
  "beyaz": "WHITE",
  "white": "WHITE",
  "ivory": "IVORY",
  "fildişi": "IVORY",
  "fildisi": "IVORY",
  "lovat": "LOVAT",
  "mavi": "BLUE",
  "blue": "BLUE",
  "dark blue": "DARK BLUE",
  "koyu mavi": "DARK BLUE",
  "yeşil": "GREEN",
  "yesil": "GREEN",
  "green": "GREEN",
  "spring green": "SPRING GREEN",
  "military green": "MILITARY GREEN",
  "kırmızı": "RED",
  "kirmizi": "RED",
  "red": "RED",
  "bright red": "BRIGHT RED",
  "turuncu": "ORANGE",
  "orange": "ORANGE",
  "sarı": "YELLOW",
  "sari": "YELLOW",
  "yellow": "YELLOW",
  "pembe": "PINK",
  "pink": "PINK",
  "fade pink": "FADE PINK",
  "mor": "PURPLE",
  "purple": "PURPLE",
  "plum": "PLUM",
  "aubergine": "AUBERGINE",
  
  // Khaki/Tan family
  "haki": "KHAKI",
  "hakı": "KHAKI",
  "khaki": "KHAKI",
  "yorkshire khaki": "YORKSHIRE KHAKI",
  "fume": "SMOKED",
  "fumé": "SMOKED",
  "smoked": "SMOKED",
  "kul": "ASH",
  "ash": "ASH",
  
  // Browns and neutrals
  "dark brown": "DARK BROWN",
  "koyu kahve": "DARK BROWN",
  "dark chocolate": "DARK CHOCOLATE",
  "chocolate": "CHOCOLATE",
  "çikolata": "CHOCOLATE",
  "york brown": "YORK BROWN",
  "bark": "BARK",
  "tobacco": "TOBACCO",
  "tabacco": "TOBACCO",
  
  // Creams and off-whites
  "cream": "CREAM",
  "krem": "CREAM",
  "cafe cream": "CAFE CREAM",
  "cafe creme": "CAFE CREAM",
  "devon cream": "DEVON CREAM",
  "winter white": "WINTER WHITE",
  "new cream": "NEW CREAM",
  "off white": "OFF WHITE",
  
  // Greys
  "charcoal": "CHARCOAL",
  "pewter": "PEWTER",
  
  // Other specific colors
  "champagne": "CHAMPAGNE",
  "şampanya": "CHAMPAGNE",
  "mustang": "MUSTANG",
  "vizon": "MINK",
  "mink": "MINK",
  "deve tüyü": "CAMEL",
  "deve tuyu": "CAMEL",
  "camel": "CAMEL",
  "portwine": "PORTWINE",
  "port wine": "PORTWINE",
  "burgundy": "BURGUNDY",
  "willow": "WILLOW",
  "sage": "SAGE",
  "onyx": "ONYX",
  "fossil": "FOSSIL",
  "quil": "QUIL",
  "dark quil": "DARK QUIL",
  "new taupe": "NEW TAUPE",
  "taupe": "TAUPE",
  "dried herb": "DRIED HERB",
  "herb": "HERB",
  "gold": "GOLD",
  "red pinecone": "RED PINECONE",
  "blush": "BLUSH",
  "poplar": "POPLAR",
  "porringe": "PORRINGE",
  "meleagris": "MELEAGRIS",
  "congo": "CONGO",
  "halifax": "HALIFAX",
  "meluliere": "MELULIERE",
  "spruce": "SPRUCE",
  "dark beige": "DARK BEIGE",
  "koyu bej": "DARK BEIGE",
  "dark walnut": "DARK WALNUT",
  "walnut": "WALNUT",
  "dark bottle": "DARK BOTTLE",
  "deep black": "DEEP BLACK",
};

// PHASE 1C: Expanded Quality patterns (regex-based recognition)
export const qualityPatterns = [
  // V family: V710, VC710, V1744, V935, VC1125F, V6218
  /\b(VC?\d{3,5}[A-Z]?)\b/i,
  // SU family: SU203, SU755, SU910, SU200.029
  /\b(SU\s?\d{3,4}[A-Z]?)\b/i,
  // P family: P200, P203, P755, P777, P777W, P002, P508
  /\b(P\d{3,4}[A-Z]?)\b/i,
  // A family: A311, A800, A900
  /\b(A\d{3,4})\b/i,
  // K family: K600
  /\b(K\d{3,4})\b/i,
  // Complex patterns with dots: KDB02.01967
  /\b(KDB\d{2}\.\d{5})\b/i,
  // Generic pattern for any quality code
  /\b([A-ZŞÇİÖÜ]{1,3}\d{2,5}[A-Z]?)\b/,
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
 * PHASE 1B: Enhanced meter parsing with Turkish format support
 * Handles:
 * - Turkish thousands: "110,000 Metre" → 110000, "1.720 MT" → 1720
 * - Turkish decimals: "10,5 mt" → 10.5
 * - Sum/multiply: "10 + 20", "2x10", "10 + 2x5"
 * - Punctuation variants: "– 15 metre", "= 10 mt"
 */
export function parseMetersExpression(text: string): number | null {
  if (!text || typeof text !== 'string') return null;
  
  const original = text;
  let normalized = normalizeTurkish(text);
  
  console.log(`[parseMetersExpression] Original: "${original}"`);
  
  // Remove color code tokens FIRST to prevent confusion
  const colorCodePattern = /\b[A-Z][A-Z]?\d{2,4}\b/g;
  normalized = normalized.replace(colorCodePattern, '').replace(/\s+/g, ' ').trim();
  console.log(`[parseMetersExpression] After removing color codes: "${normalized}"`);
  
  // Check for sum/multiply expressions first
  const hasSumOrMultiply = /[\+\*xX]/.test(normalized);
  
  if (hasSumOrMultiply) {
    let total = 0;
    let foundExpression = false;
    let workingText = normalized;
    
    // Handle multiplication (2x10, 2*10)
    const multiplyMatches = [...workingText.matchAll(/(\d+(?:[.,]\d+)?)\s*[xX\*]\s*(\d+(?:[.,]\d+)?)/g)];
    for (const match of multiplyMatches) {
      const a = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      const b = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
      total += a * b;
      foundExpression = true;
      workingText = workingText.replace(match[0], ' ');
    }
    
    // Handle addition
    const additionMatches = [...workingText.matchAll(/(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)/g)];
    for (const match of additionMatches) {
      const a = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      const b = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
      total += a + b;
      foundExpression = true;
      workingText = workingText.replace(match[0], ' ');
    }
    
    if (foundExpression && total > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${total} (expression)`);
      return total;
    }
  }
  
  // Prefer numbers with explicit units: MT, M, METRE, METER
  // Handle punctuation before units: "– 15 metre", "= 10 mt"
  const unitMatch = normalized.match(/[–=\-:]?\s*(\d+(?:[.,]\d+)?)\s*(?:MT|M|METRE|METER)\b/i);
  if (unitMatch) {
    const numStr = unitMatch[1];
    // Turkish format detection
    let result: number;
    
    if (/^\d+,\d{3,}$/.test(numStr)) {
      // e.g., "110,000" → 110000 (thousands)
      result = parseFloat(numStr.replace(',', ''));
    } else if (/^\d+\.\d{3,}$/.test(numStr)) {
      // e.g., "1.720" → 1720 (thousands)
      result = parseFloat(numStr.replace('.', ''));
    } else if (/^\d+[.,]\d{1,2}$/.test(numStr)) {
      // e.g., "10,5" or "10.5" → 10.5 (decimal)
      result = parseFloat(numStr.replace(',', '.'));
    } else {
      // Plain number
      result = parseFloat(numStr.replace(',', '.'));
    }
    
    if (!isNaN(result) && result > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${result} (with unit)`);
      return result;
    }
  }
  
  // Fallback: extract last standalone number
  const allNumbers = [...normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\b/g)];
  if (allNumbers.length > 0) {
    const lastMatch = allNumbers[allNumbers.length - 1];
    const numStr = lastMatch[1];
    
    // Apply Turkish format detection
    let result: number;
    if (/^\d+,\d{3,}$/.test(numStr)) {
      result = parseFloat(numStr.replace(',', ''));
    } else if (/^\d+\.\d{3,}$/.test(numStr)) {
      result = parseFloat(numStr.replace('.', ''));
    } else if (/^\d+[.,]\d{1,2}$/.test(numStr)) {
      result = parseFloat(numStr.replace(',', '.'));
    } else {
      result = parseFloat(numStr);
    }
    
    if (!isNaN(result) && result > 0) {
      console.log(`[parseMetersExpression] "${original}" -> ${result} (last number)`);
      return result;
    }
  }
  
  console.log(`[parseMetersExpression] "${original}" -> null (no valid number)`);
  return null;
}

/**
 * PHASE 1C: Extract quality from text using expanded patterns
 * Normalizes VC### to V### for consistency
 */
export function extractQuality(text: string): string | null {
  const normalized = normalizeTurkish(text);
  
  for (const pattern of qualityPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      let quality = (match[1] || match[0]).trim().replace(/\s+/g, '');
      
      // Normalize VC### to V### (e.g., VC710 → V710)
      if (/^VC\d+/.test(quality)) {
        quality = quality.replace(/^VC/, 'V');
        console.log(`[extractQuality] Normalized ${match[0]} to ${quality}`);
      }
      
      return quality;
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
 * PHASE 1E & 1F: Deterministic extraction with context-aware grouping and noise filtering
 * Returns array of parsed lines with quality, color, meters
 */
export function deterministicExtract(rawText: string, dbContext?: DBValidationContext): ParsedLine[] {
  const lines = rawText.split('\n').filter(line => line.trim().length > 0);
  const results: ParsedLine[] = [];
  
  // PHASE 1F: Noise detection patterns
  const noisePatterns = [
    /\b(merhaba|iyi çalışmalar|selam|günaydın)\b/i,  // Greetings
    /\b(eur|usd|tl|euro|dolar|€|\$)\b/i,              // Prices
    /\b(peşin|pesin|vade|kdv|fiyat)\b/i,              // Payment terms
    /\b(onaylanmıştır|onaylanmıştır|varmi|var mı|bakalım|hazırlayın)\b/i,  // Questions/confirmations
    /^[\d\-]+$/,                                       // Pure IDs without context
    /sipariş|siparis|rica|talep|numune|model için/i, // Order context without data
  ];
  
  const isNoiseLine = (text: string): boolean => {
    return noisePatterns.some(pattern => pattern.test(text));
  };
  
  // PHASE 1E: Context-aware grouping state
  let currentQuality: string | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip very short lines
    if (trimmed.length < 5) continue;
    
    // Skip header lines
    if (/^(sira|no|kalite|quality|renk|color|metre|meter|fiş|tarih|cari)/i.test(trimmed)) continue;
    
    // PHASE 1F: Skip noise lines
    if (isNoiseLine(trimmed)) {
      console.log(`[deterministicExtract] Skipping noise line: "${trimmed.substring(0, 50)}"`);
      continue;
    }
    
    let quality = extractQuality(line);
    let color = extractColor(line);
    const meters = parseMetersExpression(line);
    let needsReview = false;
    let conflictInfo: ParsedLine['conflict_info'] | undefined;
    
    // PHASE 1E: Context-aware grouping logic
    // Detect if this line is a quality header (has quality, no meters, short line)
    const isHeader = quality && !meters && trimmed.length < 50 && !/[•\-–:=]/.test(trimmed.substring(0, 5));
    
    if (isHeader) {
      // This is a header line, set context for subsequent lines
      currentQuality = quality;
      console.log(`[deterministicExtract] Quality header detected: "${quality}"`);
      continue; // Don't add header as a data row
    }
    
    // If line starts with bullet/dash and no quality extracted, inherit currentQuality
    const isBullet = /^[\s]*[•\-–:=]/.test(trimmed);
    if (isBullet && !quality && currentQuality) {
      quality = currentQuality;
      console.log(`[deterministicExtract] Inherited quality "${quality}" from context for bullet line`);
    }
    
    // Reset context on section breaks (empty conceptual break or long ID lines)
    if (!quality && !color && !meters) {
      currentQuality = null;
    }
    
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
    
    // Track which fields came from LLM
    const usedLLMQuality = !det.quality && llm.quality;
    const usedLLMColor = !det.color && llm.color;
    const usedLLMMeters = !det.meters && llm.meters;
    
    const finalQuality = det.quality || llm.quality;
    const finalColor = det.color || llm.color;
    const finalMeters = det.meters || llm.meters;
    
    const finalStatus = (finalQuality && finalColor && finalMeters) ? 'ok' : 'needs_review';
    
    // Log LLM contribution
    if (usedLLMQuality || usedLLMColor || usedLLMMeters) {
      const llmFields = [];
      if (usedLLMQuality) llmFields.push(`Q:${llm.quality}`);
      if (usedLLMColor) llmFields.push(`C:${llm.color}`);
      if (usedLLMMeters) llmFields.push(`M:${llm.meters}`);
      
      console.log(
        `[mergeDeterministicAndLLM] Line ${i + 1}: LLM filled [${llmFields.join(', ')}] -> ` +
        `FINAL Q:${finalQuality || 'null'} C:${finalColor || 'null'} M:${finalMeters || 'null'} Status:${finalStatus}`
      );
    }
    
    // Use LLM values if deterministic extraction failed
    merged.push({
      quality: finalQuality,
      color: finalColor,
      meters: finalMeters,
      source_row: det.source_row,
      extraction_status: finalStatus,
      resolution_source: (usedLLMQuality || usedLLMColor || usedLLMMeters) ? 'llm' : 'deterministic',
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
