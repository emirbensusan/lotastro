import { supabase } from '@/integrations/supabase/client';

export interface ImportLotData {
  quality: string;
  color: string;
  roll_count: number;
  meters: number;
  lot_number: string;
  entry_date: string;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  production_date?: string;
  warehouse_location?: string;
  notes?: string;
  roll_details?: string; // Semicolon-separated meters per roll (e.g., "40;50;100")
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported?: number;
  errors?: string[];
}

export const generateExcelTemplate = (): void => {
  const headers = [
    'quality',
    'color', 
    'roll_count',
    'roll_details',
    'meters',
    'lot_number',
    'entry_date',
    'supplier_name',
    'invoice_number',
    'invoice_date',
    'production_date',
    'warehouse_location',
    'notes'
  ];

  const sampleData = [
    'P755,PEBBLE 465,2,17;14,31,24043920,27.06.2025,JTR,FVZ001,16.06.2025,,,',
    'P755,OFF WHITE 27,8,101;110;100;73;86;100;95;43,708,25002440,27.06.2025,JTR,FVZ001,16.06.2025,,,'
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'lot_import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// Helper function to parse flexible date formats
const parseFlexibleDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // Try DD.MM.YYYY format first
  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Try YYYY-MM-DD format
  const yyyymmddMatch = dateStr.match(/^\d{4}-\d{1,2}-\d{1,2}$/);
  if (yyyymmddMatch) {
    return dateStr;
  }
  
  // If other formats, try to parse and convert
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  throw new Error(`Invalid date format: ${dateStr}. Use DD.MM.YYYY or YYYY-MM-DD`);
};

export const parseCSVFile = (csvText: string): ImportLotData[] => {
  // Normalize newlines and trim BOM
  let text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  // Utility: remove quotes around a value
  const unquote = (s: string) => s.replace(/^\s*\"|\"\s*$/g, '').trim();

  // Detect delimiter (comma vs semicolon) based on header line
  const firstLine = text.split('\n').find(l => l.trim().length > 0) || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  // Split a CSV line respecting quotes
  const splitCSVLine = (line: string, delim: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(v => unquote(v.trim()))
  };

  // Header normalization
  const removeDiacritics = (str: string) => str.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const canonicalize = (h: string) => removeDiacritics(h.toLowerCase().trim())
    .replace(/^\uFEFF/, '')
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const synonymMap: Record<string, string> = {
    // quality
    kalite: 'quality',
    quality: 'quality',

    // color
    renk: 'color',
    color: 'color',

    // roll_count (do not map generic "rulo" to avoid ambiguity)
    rulo_sayisi: 'roll_count',
    rulosayisi: 'roll_count',
    rulo_sayisi1: 'roll_count',
    rulo_sayisi_1: 'roll_count',
    rulo_sayisi_2: 'roll_count',
    rulo_sayisi_3: 'roll_count',
    rulo_sayisi_adet: 'roll_count',
    rulo_sayisi_adedi: 'roll_count',
    rollcount: 'roll_count',
    roll_count: 'roll_count',
    adet: 'roll_count',

    // roll_details
    rulo_detaylari: 'roll_details',
    rulo_detay: 'roll_details',
    rolldetails: 'roll_details',
    roll_details: 'roll_details',

    // meters
    metre: 'meters',
    metraj: 'meters',
    metre_m: 'meters',
    toplam_metre: 'meters',
    toplammetre: 'meters',
    meters: 'meters',

    // lot number
    lot: 'lot_number',
    lot_no: 'lot_number',
    lotno: 'lot_number',
    lot_numarasi: 'lot_number',
    lotnumber: 'lot_number',
    lot_number: 'lot_number',

    // dates
    giris_tarihi: 'entry_date',
    giristarihi: 'entry_date',
    entry_date: 'entry_date',

    fatura_no: 'invoice_number',
    fatura_numarasi: 'invoice_number',
    invoice_number: 'invoice_number',
    invoice_no: 'invoice_number',

    fatura_tarihi: 'invoice_date',
    faturatarihi: 'invoice_date',
    invoice_date: 'invoice_date',

    uretim_tarihi: 'production_date',
    production_date: 'production_date',

    // warehouse
    ambar: 'warehouse_location',
    depo: 'warehouse_location',
    warehouse_location: 'warehouse_location',
    warehouse: 'warehouse_location',

    // notes
    not: 'notes',
    aciklama: 'notes',
    notes: 'notes',
  };
  const lines = text.split('\n').filter(l => l.length > 0);
  if (lines.length === 0) throw new Error('Empty file');

  const rawHeaderCells = splitCSVLine(lines[0], delimiter);
  const originalHeaders = rawHeaderCells.map(h => h.trim());
  const normalized = rawHeaderCells.map(h => canonicalize(h));

  // Map normalized headers to expected keys via synonyms
  const expectedKeys = ['quality','color','roll_count','roll_details','meters','lot_number','entry_date','supplier_name','invoice_number','invoice_date','production_date','warehouse_location','notes'];
  const headerKeyByIndex: (string | null)[] = normalized.map(n => {
    if (n in synonymMap) return synonymMap[n];
    // allow exact expected names too
    if (expectedKeys.includes(n)) return n;
    // Also map common variants
    if (n === 'supplier' || n === 'tedarikci') return 'supplier_name';
    if (n === 'fatura') return 'invoice_number';
    if (n === 'faturatarihi') return 'invoice_date';
    if (n === 'giristarihi') return 'entry_date';
    if (n === 'lotnumarasi' || n === 'lotnumarasi_') return 'lot_number';
    return null;
  });

  const indexOfKey: Record<string, number> = {};
  headerKeyByIndex.forEach((key, idx) => {
    if (key && !(key in indexOfKey)) indexOfKey[key] = idx;
  });

  const requiredKeys = ['quality','color','roll_count','meters','lot_number','entry_date','supplier_name','invoice_number','invoice_date'];
  const missing = requiredKeys.filter(k => !(k in indexOfKey));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Detected headers: ${originalHeaders.join(' | ')}. Delimiter detected: "${delimiter}". You can download the template to see the expected columns.`);
  }

  const data: ImportLotData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const values = splitCSVLine(line, delimiter);

    const getVal = (key: string) => {
      const idx = indexOfKey[key];
      return typeof idx === 'number' ? values[idx] ?? '' : '';
    };

    const row: any = {
      quality: getVal('quality'),
      color: getVal('color'),
      roll_count: getVal('roll_count'),
      meters: getVal('meters'),
      lot_number: getVal('lot_number'),
      entry_date: getVal('entry_date'),
      supplier_name: getVal('supplier_name'),
      invoice_number: getVal('invoice_number'),
      invoice_date: getVal('invoice_date'),
      production_date: getVal('production_date'),
      warehouse_location: getVal('warehouse_location'),
      notes: getVal('notes'),
      roll_details: getVal('roll_details'),
    };

    // Validate required fields
    const rowNumber = i + 1; // human-friendly
    const requiredMissing: string[] = [];
    ['quality','color','lot_number','entry_date','supplier_name','invoice_number','invoice_date','roll_count','meters'].forEach(k => {
      if (!row[k] || String(row[k]).trim() === '') requiredMissing.push(k);
    });
    if (requiredMissing.length > 0) {
      throw new Error(`Row ${rowNumber}: Missing required data: ${requiredMissing.join(', ')}`);
    }

    // Parse numbers
    const rollCount = parseInt(String(row.roll_count).replace(/[^0-9-]/g, ''));
    const meters = parseFloat(String(row.meters).replace(',', '.'));
    if (!Number.isFinite(rollCount) || rollCount <= 0) {
      throw new Error(`Row ${rowNumber}: Invalid roll_count "${row.roll_count}". Must be a positive integer.`);
    }
    if (!Number.isFinite(meters) || meters <= 0) {
      throw new Error(`Row ${rowNumber}: Invalid meters "${row.meters}". Must be a positive number.`);
    }

    // Parse dates
    let entryDate: string;
    let invoiceDate: string;
    let productionDate: string | undefined;
    try { entryDate = parseFlexibleDate(String(row.entry_date)); } catch (e: any) { throw new Error(`Row ${rowNumber}: Invalid entry_date. ${e.message}`); }
    try { invoiceDate = parseFlexibleDate(String(row.invoice_date)); } catch (e: any) { throw new Error(`Row ${rowNumber}: Invalid invoice_date. ${e.message}`); }
    if (row.production_date) {
      try { productionDate = parseFlexibleDate(String(row.production_date)); } catch (e: any) { throw new Error(`Row ${rowNumber}: Invalid production_date. ${e.message}`); }
    }

    // Handle roll_details (optional). If missing, distribute evenly.
    let rollDetailsStr = String(row.roll_details || '').trim();
    if (!rollDetailsStr) {
      const each = Math.round((meters / rollCount) * 100) / 100;
      const details: number[] = Array.from({ length: rollCount }, () => each);
      // Fix rounding on last item to match total exactly to 2 decimals
      const sumExceptLast = details.slice(0, -1).reduce((s, v) => s + v, 0);
      const last = Math.round(((meters - sumExceptLast) + Number.EPSILON) * 100) / 100;
      details[details.length - 1] = last;
      rollDetailsStr = details.join(';');
    } else {
      const parts = rollDetailsStr.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
      const parsed = parts.map(m => parseFloat(m.replace(',', '.')));
      if (parsed.some(v => !Number.isFinite(v) || v <= 0)) {
        throw new Error(`Row ${rowNumber}: Invalid roll_details values. Use positive numbers separated by ';' or ','.`);
      }
      let rollMeters: number[];
      if (parsed.length === 1 && rollCount > 1) {
        // Interpret as per-roll meters to be replicated by roll_count
        const perRoll = Math.round(parsed[0] * 100) / 100;
        rollMeters = Array.from({ length: rollCount }, () => perRoll);
      } else if (parsed.length !== rollCount) {
        throw new Error(`Row ${rowNumber}: Roll count (${rollCount}) doesn't match number of roll details (${parsed.length}). If you meant a per-roll value, provide a single number (e.g., "104.5") which will be multiplied by roll_count.`);
      } else {
        rollMeters = parsed;
      }
      const sum = rollMeters.reduce((s, v) => s + v, 0);
      if (Math.abs(sum - meters) > 0.5) {
        throw new Error(`Row ${rowNumber}: Sum of roll details (${sum.toFixed(2)}) doesn't match total meters (${meters}). If you intended a per-roll value, ensure it times roll_count ≈ meters (±0.5).`);
      }
      // Normalize to semicolon-separated
      rollDetailsStr = rollMeters.map(v => Math.round(v * 100) / 100).join(';');
    }

    const lotData: ImportLotData = {
      quality: String(row.quality),
      color: String(row.color),
      roll_count: rollCount,
      meters,
      lot_number: String(row.lot_number),
      entry_date: entryDate,
      supplier_name: String(row.supplier_name),
      invoice_number: String(row.invoice_number),
      invoice_date: invoiceDate,
      production_date: productionDate,
      warehouse_location: row.warehouse_location ? String(row.warehouse_location) : undefined,
      notes: row.notes ? String(row.notes) : undefined,
      roll_details: rollDetailsStr,
    };

    data.push(lotData);
  }

  return data;
};

export const importLotsToDatabase = async (lots: ImportLotData[]): Promise<ImportResult> => {
  try {
    const errors: string[] = [];
    let imported = 0;

    for (const lot of lots) {
      try {
        // Find or create supplier
        let { data: supplier, error: supplierError } = await supabase
          .from('suppliers')
          .select('id')
          .eq('name', lot.supplier_name)
          .single();

        if (supplierError && supplierError.code === 'PGRST116') {
          // Supplier doesn't exist, create it
          const { data: newSupplier, error: createError } = await supabase
            .from('suppliers')
            .insert({ name: lot.supplier_name })
            .select('id')
            .single();

          if (createError) {
            errors.push(`Failed to create supplier "${lot.supplier_name}": ${createError.message}`);
            continue;
          }
          supplier = newSupplier;
        } else if (supplierError) {
          errors.push(`Supplier lookup error for "${lot.supplier_name}": ${supplierError.message}`);
          continue;
        }

        // Insert LOT
        const { data: lotData, error: lotError } = await supabase
          .from('lots')
          .insert({
            quality: lot.quality,
            color: lot.color,
            roll_count: lot.roll_count,
            meters: lot.meters,
            lot_number: lot.lot_number,
            entry_date: lot.entry_date,
            supplier_id: supplier!.id,
            invoice_number: lot.invoice_number,
            invoice_date: lot.invoice_date,
            production_date: lot.production_date || null,
            warehouse_location: lot.warehouse_location || null,
            notes: lot.notes || null,
            status: 'in_stock'
          })
          .select('id')
          .single();

        if (lotError) {
          errors.push(`Failed to import LOT "${lot.lot_number}": ${lotError.message}`);
          continue;
        }

        // Create individual roll entries
        if (lot.roll_details) {
          const rollMeters = lot.roll_details.split(';').map(m => parseFloat(m.trim()));
          const rollInserts = rollMeters.map((meters, index) => ({
            lot_id: lotData.id,
            meters: meters,
            position: index + 1
          }));

          const { error: rollsError } = await supabase
            .from('rolls')
            .insert(rollInserts);

          if (rollsError) {
            errors.push(`Failed to create roll entries for LOT "${lot.lot_number}": ${rollsError.message}`);
          }
        }
        
        imported++;
      } catch (error: any) {
        errors.push(`Error processing LOT "${lot.lot_number}": ${error.message}`);
      }
    }

    return {
      success: imported > 0,
      message: `Successfully imported ${imported} of ${lots.length} lots`,
      imported,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Import failed: ${error.message}`
    };
  }
};