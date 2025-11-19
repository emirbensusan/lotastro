// Shared extraction library for AI order extraction

// PHASE 1B: Intent Types
export type IntentType = 
  | 'order' 
  | 'sample_request' 
  | 'stock_inquiry' 
  | 'reservation' 
  | 'price_request' 
  | 'update' 
  | 'shipping' 
  | 'approval' 
  | 'noise';

export type QuantityUnit = 'MT' | 'KG' | 'TOP' | 'A4' | 'PIECE';

// PHASE 3B: Expanded Color normalization dictionary (Turkish + English)
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
  "light pink": "LIGHT PINK",
  "baby pink": "BABY PINK",
  "soft pink": "SOFT PINK",
  "mor": "PURPLE",
  "purple": "PURPLE",
  "plum": "PLUM",
  "aubergine": "AUBERGINE",
  
  // Khaki/Tan family
  "haki": "KHAKI",
  "hakı": "KHAKI",
  "khaki": "KHAKI",
  "yorkshire khaki": "YORKSHIRE KHAKI",
  "dull khaki": "DULL KHAKI",
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
  "bitter chocolate": "BITTER CHOCOLATE",
  "çikolata": "CHOCOLATE",
  "york brown": "YORK BROWN",
  "bark": "BARK",
  "tobacco": "TOBACCO",
  "tabacco": "TOBACCO",
  "dark walnut": "DARK WALNUT",
  "walnut": "WALNUT",
  "cold brown": "COLD BROWN",
  
  // Creams and off-whites
  "cream": "CREAM",
  "krem": "CREAM",
  "cafe cream": "CAFE CREAM",
  "cafe creme": "CAFE CREAM",
  "devon cream": "DEVON CREAM",
  "winter white": "WINTER WHITE",
  "new cream": "NEW CREAM",
  "off white": "OFF WHITE",
  "fresh cream": "FRESH CREAM",
  
  // Greys and metals
  "charcoal": "CHARCOAL",
  "pewter": "PEWTER",
  "dark grey": "DARK GREY",
  "graphite": "GRAPHITE",
  "antrasit": "ANTHRACITE",
  "anthracite": "ANTHRACITE",
  
  // Specific named colors
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
  "dark bottle": "DARK BOTTLE",
  "deep black": "DEEP BLACK",
  "vanilla ice": "VANILLA ICE",
  "dark green": "DARK GREEN",
  "royal navy": "ROYAL NAVY",
  "nouget": "NOUGET",
  "gravel": "GRAVEL",
  "scarlet": "SCARLET",
  "rifle": "RIFLE",
  "beetroot": "BEETROOT",
  "prune": "PRUNE",
  "steel": "STEEL",
  "midnight": "MIDNIGHT",
  "nordic": "NORDIC",
  "nordman": "NORDMAN",
  "bronze": "BRONZE",
  "donkey": "DONKEY",
  "mango": "MANGO",
  "damson": "DAMSON",
  "roebuck": "ROEBUCK",
  "barley": "BARLEY",
  "capuccino": "CAPUCCINO",
  "pistache": "PISTACHE",
  "wispa": "WISPA",
  "royal": "ROYAL",
  "conifer": "CONIFER",
  "fawn": "FAWN",
  "banana": "BANANA",
  "cafe": "CAFE",
  "cafe cream": "CAFE CREAM",
  "cream": "CREAM",
  "worstead": "WORSTEAD",
  "stone": "STONE",
  "skoni": "SKONI",
  "webber": "WEBBER",
  "desert": "DESERT",
  "stucco": "STUCCO",
  "haze": "HAZE",
  "bistre": "BISTRE",
  "apricot": "APRICOT",
};

// PHASE 1D: Expanded Quality patterns (regex-based recognition)
export const qualityPatterns = [
  // Descriptor-based patterns (e.g., "Polyester Twill P777", "Viscose Vual V710")
  /\b(?:Polyester\s+(?:Twill|Strech|Stretch|Diagonal|Tafetta|Japon))\s+(P\d{3,4}[A-Z]?)\b/i,
  /\b(?:Viscose\s+(?:Twill|Vual))\s+(V\d{3,4}[A-Z]?)\b/i,
  /\b(?:Toray\s+Tafetta)\s+(P\d{3,4}[A-Z]?|E-?\d{3})\b/i,
  /\b(?:Acetate\s+(?:Tafetta|Twill))\s+(A\d{3,4})\b/i,
  /\b(?:Ponge|Pongee)\s+(P\d{3,4}[A-Z]?)\b/i,
  /\b(?:Strech|Stretch)\s+(?:Twill|Ponge|Pongee)\s+(P\d{3,4}[A-Z]?)\b/i,
  // PHASE 4: E-code pattern (e.g., "POLYESTER E-123" or just "E-123")
  /\b(?:POLYESTER\s+)?(E[\-\s]?\d{3,4})\b/i,
  
  // V family: V710, VC710, V1744, V935, VC1125F, V6218
  /\b(VC?\d{3,5}[A-Z]?)\b/i,
  // SU family: SU203, SU755, SU910, SU200.029
  /\b(SU\s?\d{3,4}[A-Z]?)\b/i,
  // P family: P200, P203, P755, P777, P777W, P002, P508, P910, P845, P840, P672
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

// Noise tokens to remove (removed PONGE as it's a fabric type descriptor)
const noiseTokens = /\b(ASTAR|%100|TWILL|VISCOSE|VISKOS|GRUP|GROUP|PLAIN)\b/gi;

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
 * @param text - The text to extract color from
 * @param excludeQuality - Optional quality code to exclude from matching (prevents quality being extracted as color)
 */
export function extractColor(text: string, excludeQuality?: string): string | null {
  if (!text) return null;
  
  console.log(`[extractColor] Input: "${text}"`);
  
  // STEP 2: Remove quality codes FIRST to create clean working text
  let workingText = text;
  if (excludeQuality) {
    const escapedQuality = excludeQuality.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    workingText = workingText.replace(new RegExp(`\\b${escapedQuality}\\b`, 'gi'), '');
  }
  
  // Remove other quality patterns
  workingText = workingText
    .replace(/\b[PVAK]\d{3,4}\b/gi, '')
    .replace(/\bSU\s?\d{3,4}\b/gi, '')
    .replace(/\bE[\-\s]?\d{3,4}\b/gi, '')
    .trim();
  
  console.log(`[extractColor] Working text after quality removal: "${workingText}"`);
  
  // STEP 2: Check dictionary FIRST on clean working text
  const normalized = normalizeTurkish(workingText.toLowerCase());
  
  for (const [key, value] of Object.entries(colorsDict)) {
    const keyNorm = key.toLowerCase();
    if (normalized.includes(keyNorm)) {
      console.log(`[extractColor] Dictionary match: "${key}" → "${value}"`);
      
      // STEP 2: Find position in ORIGINAL working text (case-insensitive)
      const upperWorking = workingText.toUpperCase();
      const upperKey = key.toUpperCase();
      const colorNameIndex = upperWorking.indexOf(upperKey);
      
      if (colorNameIndex !== -1) {
        const afterColorName = workingText.substring(colorNameIndex + key.length);
        
        // STEP 2: Extract adjacent code with strict lookahead (4-6 digits, NOT followed by meter units)
        const adjacentCodeMatch = afterColorName.match(/^\s*[\-–:=]?\s*(\d{4,6})(?!\s*(?:MT|M\b|METRE|METER))/i);
        
        if (adjacentCodeMatch) {
          const code = adjacentCodeMatch[1];
          const result = `${value} ${code}`;
          console.log(`[extractColor] Dictionary + adjacent code: "${result}"`);
          return result;
        }
      }
      
      console.log(`[extractColor] Dictionary only: "${value}"`);
      return value;
    }
  }
  
  // STEP 2: Fallback to numeric code extraction (4-6 digits, strict lookahead)
  const numericColorMatch = workingText.match(/\b(\d{4,6})(?!\s*(?:MT|M\b|METRE|METER))/i);
  if (numericColorMatch) {
    const candidate = numericColorMatch[1];
    console.log(`[extractColor] Numeric code found: "${candidate}"`);
    return candidate;
  }
  
  // Try to find any color-like word from dictionary (fallback)
  const normalizedWorking = normalizeTurkish(workingText.toLowerCase());
  const colorWords = normalizedWorking.match(/\b([a-z]{3,})\b/g);
  if (colorWords) {
    for (const word of colorWords) {
      if (colorsDict[word]) {
        console.log(`[extractColor] Color word found: "${colorsDict[word]}"`);
        return colorsDict[word];
      }
    }
  }
  
  console.log(`[extractColor] No color extracted`);
  return null;
}

/**
 * Infer quality from color code when unique
 */
export function inferQualityFromColorCode(
  colorCode: string,
  dbContext: DBValidationContext
): { quality: string | null; ambiguous: boolean; candidates: string[] } {
  // Clean color code - might have color name prefix (e.g., "CHOCOLATE 4364" -> "4364")
  const cleanCode = colorCode.replace(/^[A-Z\s]+\s+(\d+)$/, '$1').trim();
  
  const candidates = dbContext.colorCodeToQualities[cleanCode.toUpperCase()] || [];
  
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
 * Split lines containing multiple quality codes into separate lines
 * Example: "P777 – BLACK & V710 - BLACK" -> ["P777 – BLACK", "V710 - BLACK"]
 */
function splitMultiQualityLine(line: string): string[] {
  // Look for multiple quality codes with separators (&, +, ,)
  const qualityMatches = Array.from(line.matchAll(/\b([PVAK]\d{3,4}[A-Z]?|VC?\d{3,5}[A-Z]?|SU\s?\d{3,4}[A-Z]?)\b/gi));
  
  if (qualityMatches.length <= 1) {
    return [line];
  }
  
  console.log(`[splitMultiQualityLine] Found ${qualityMatches.length} qualities in line: "${line.substring(0, 60)}..."`);
  
  // Check if line has quality separators (&, +, comma)
  const hasSeparators = /[&+,]/.test(line);
  
  if (!hasSeparators) {
    // No separators - don't split (might be color codes, not multiple orders)
    return [line];
  }
  
  const splitLines: string[] = [];
  const qualities = qualityMatches.map(m => m[1]);
  
  // Split line by separators and assign each quality to its segment
  const segments = line.split(/\s*[&+,]\s*/);
  
  for (let i = 0; i < qualities.length && i < segments.length; i++) {
    const quality = qualities[i];
    const segment = i < segments.length ? segments[i] : segments[segments.length - 1];
    
    // Remove other qualities from this segment
    let cleanSegment = segment;
    qualities.forEach(otherQ => {
      if (otherQ !== quality) {
        cleanSegment = cleanSegment.replace(new RegExp(`\\b${otherQ}\\b`, 'gi'), '');
      }
    });
    
    cleanSegment = cleanSegment.replace(/\s+/g, ' ').trim();
    
    // If segment is too short after cleaning, use the shared text for all
    if (cleanSegment.length < 5) {
      // Extract shared text (colors, meters) and prepend quality
      const sharedText = line.replace(/\b([PVAK]\d{3,4}[A-Z]?|VC?\d{3,5}[A-Z]?|SU\s?\d{3,4}[A-Z]?)\b/gi, '').replace(/[&+,]/g, '').trim();
      splitLines.push(`${quality} ${sharedText}`);
    } else {
      splitLines.push(cleanSegment);
    }
  }
  
  console.log(`[splitMultiQualityLine] Split into ${splitLines.length} lines:`, splitLines.map(l => l.substring(0, 40)));
  
  return splitLines;
}

/**
 * Infer intent type from line content
 * Returns: 'order' | 'sample_request' | 'stock_inquiry' | 'reservation' | 'price_request' | 'shipping' | 'noise'
 */
function inferIntentType(line: string): IntentType {
  const upper = line.toUpperCase();
  
  // Sample request indicators
  if (/\b(VARSA|VARMIS?|NUMUNE|SAMPLE|A4|ORNEK|ÖRNEK)\b/i.test(line)) {
    return 'sample_request';
  }
  
  // Stock inquiry indicators
  if (/\b(STOK\s*VAR\s*MI|STOKTA\s*VAR\s*MI|MEVCUT\s*MU|AVAILABLE|IN\s*STOCK)\b/i.test(line)) {
    return 'stock_inquiry';
  }
  
  // Reservation indicators
  if (/\b(REZERVE|RESERVE|AYIR|BLOCK|HOLD|BLOKE)\b/i.test(line)) {
    return 'reservation';
  }
  
  // Price request indicators
  if (/\b(FIYAT|PRICE|QUOTE|TEKLIF|EUR|USD|TL|\$|€|EURO|DOLAR)\b/i.test(line)) {
    return 'price_request';
  }
  
  // Shipping/delivery indicators
  if (/\b(SEVK|TESLIMAT|DELIVERY|SHIP|KARGO|TESLİMAT)\b/i.test(line)) {
    return 'shipping';
  }
  
  // Noise indicators (greetings, confirmations, questions)
  // STEP 1: Removed short line filter to allow standalone quality codes like "A800"
  if (/\b(MERHABA|HELLO|GUNAYDIN|GÜNAYDIN|IYI\s*GUNLER|İYI\s*GÜNLER|TESEKKUR|TEŞEKKÜR|THANK|SELAM|SELAMLAR)\b/i.test(line) ||
      /\b(ONAYLANMISTIR|ONAYLANMIŞTIR|HAZIRLAYIN|BAKALIM|RICA|EDERIM)\b/i.test(line)) {
    return 'noise';
  }
  
  // Default: order
  return 'order';
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
  let prevHeaderIndex = -1; // Track last header line index
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip very short lines
    if (trimmed.length < 3) continue;  // Allow 3+ char lines (A800=4, A311=4, P777=4)
    
    // Skip header lines
    if (/^(sira|no|kalite|quality|renk|color|metre|meter|fiş|tarih|cari)/i.test(trimmed)) continue;
    
    // PHASE 1F: Skip noise lines
    if (isNoiseLine(trimmed)) {
      console.log(`[deterministicExtract] Skipping noise line: "${trimmed.substring(0, 50)}"`);
      continue;
    }
    
    // PHASE 3: Check if line contains multiple quality codes and split if needed
    const splitLines = splitMultiQualityLine(line);
    
    for (const processLine of splitLines) {
      const processTrimmed = processLine.trim();
      
      let quality = extractQuality(processLine);
      console.log(`[deterministicExtract] Line ${i + 1}: "${processTrimmed.substring(0, 60)}" -> quality="${quality}"`);
      
      // Extract color AFTER quality, passing quality to prevent it being extracted as color
      let color = extractColor(processLine, quality || undefined);
      const meters = parseMetersExpression(processLine);
      let needsReview = false;
      let conflictInfo: ParsedLine['conflict_info'] | undefined;
      
      // PHASE 2A: Header detection BEFORE validation
      // Headers are ONLY lines with quality but NO meters and NO color
      // Lines with meters are NEVER headers (e.g., "POLYESTER E-123 - 1440m" is NOT a header)
      const isHeader = quality && !meters && !color && 
                       !/[•\-–:=]/.test(processTrimmed.substring(0, 5)) &&
                       i < lines.length - 1; // Must have a line after it
      
      if (isHeader) {
        // This is a header line, set context for subsequent lines
        currentQuality = quality;
        prevHeaderIndex = i; // Track header position
        console.log(`[deterministicExtract] Quality header detected: "${quality}"`);
        continue; // Don't add header as a data row
      }
      
      // If line starts with bullet/dash and no quality extracted, inherit currentQuality
      const isBullet = /^[\s]*[•\-–:=]/.test(processTrimmed);
      const isFirstLineAfterHeader = (i === prevHeaderIndex + 1) && !quality && currentQuality;
      
      if ((isBullet || isFirstLineAfterHeader) && !quality && currentQuality) {
        quality = currentQuality;
        console.log(`[deterministicExtract] Inherited quality "${quality}" from context (bullet=${isBullet}, afterHeader=${isFirstLineAfterHeader})`);
      }
      
      // PHASE 7: Trust pattern-matched qualities, only validate ambiguous ones
      // If quality matches ANY qualityPattern, trust it without DB validation
      if (quality) {
        const matchesPattern = qualityPatterns.some(pattern => pattern.test(quality));
        
        if (matchesPattern) {
          console.log(`[deterministicExtract] Quality ${quality} matches pattern - trusted without DB validation`);
        } else if (/^[A-Z]?\d{3,4}$/.test(quality)) {
          // Only validate ambiguous numeric codes that didn't match any pattern
          console.log(`[deterministicExtract] Quality ${quality} is ambiguous numeric code, checking DB...`);
          
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
        } else {
          console.log(`[deterministicExtract] Quality ${quality} has letter prefix - trusted`);
        }
      }
      
      // Reset context on section breaks (empty conceptual break or long ID lines)
      // This happens AFTER validation to use the corrected quality value
      if (!quality && !color && !meters) {
        currentQuality = null;
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
        const validColors = dbContext.colorsByQuality[quality] || [];
        const colorValid = validColors.some(c => 
          c.label === color || 
          c.code === color ||
          (color.includes(c.label) && color.includes(c.code))
        );
        
        if (!colorValid) {
          console.log(`[deterministicExtract] Invalid Q+C combo: ${quality} + ${color}`);
          needsReview = true;
        }
      }
      
      // Skip if no actionable data
      if (!quality && !color && !meters) continue;
      
      const intentType = inferIntentType(processLine);
      
      let extractionStatus: 'ok' | 'needs_review' | 'blocked';
      let confidenceScore = 1.0;
      
      if (!quality || !color || !meters) {
        extractionStatus = 'needs_review';
        confidenceScore = 0.5;
      } else if (needsReview) {
        extractionStatus = 'needs_review';
        confidenceScore = 0.7;
      } else {
        extractionStatus = 'ok';
        confidenceScore = 0.95;
      }
      
      console.log(`[deterministicExtract] Line: "${processTrimmed.substring(0, 30)}..." -> Q:${quality} C:${color} M:${meters} Status:${extractionStatus}`);
      
      results.push({
        source_row: processLine,
        quality,
        color,
        meters,
        extraction_status: extractionStatus,
        confidence_score: confidenceScore,
        resolution_source: 'deterministic',
        intent_type: intentType,
        quantity_unit: 'MT',
        conflict_info: conflictInfo,
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
