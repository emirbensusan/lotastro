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
  const lines = csvText.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  const requiredFields = ['quality', 'color', 'roll_count', 'roll_details', 'meters', 'lot_number', 'entry_date', 'supplier_name', 'invoice_number', 'invoice_date'];
  const missingFields = requiredFields.filter(field => !headers.includes(field));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required columns: ${missingFields.join(', ')}. Expected format: quality, color, roll_count, roll_details, meters, lot_number, entry_date, supplier_name, invoice_number, invoice_date, production_date, warehouse_location, notes`);
  }

  const data: ImportLotData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    if (values.length !== headers.length) {
      throw new Error(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}. Check for missing commas or extra data.`);
    }

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    // Validate required fields first
    if (!row.quality || !row.color || !row.lot_number || !row.entry_date || !row.supplier_name || !row.invoice_number || !row.invoice_date || !row.roll_details) {
      throw new Error(`Row ${i + 1}: Missing required data. All fields except production_date, warehouse_location, and notes are required.`);
    }

    // Parse and validate numeric values
    const rollCount = parseInt(row.roll_count);
    const meters = parseFloat(row.meters);
    
    if (isNaN(rollCount) || rollCount <= 0) {
      throw new Error(`Row ${i + 1}: Invalid roll_count "${row.roll_count}". Must be a positive integer.`);
    }
    
    if (isNaN(meters) || meters <= 0) {
      throw new Error(`Row ${i + 1}: Invalid meters "${row.meters}". Must be a positive number.`);
    }

    // Validate and parse roll_details
    const rollMeters = row.roll_details.split(';').map((m: string) => {
      const parsed = parseFloat(m.trim());
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error(`Row ${i + 1}: Invalid roll detail "${m}". All roll details must be positive numbers separated by semicolons.`);
      }
      return parsed;
    });

    if (rollMeters.length !== rollCount) {
      throw new Error(`Row ${i + 1}: Roll count (${rollCount}) doesn't match number of roll details (${rollMeters.length}). Each roll must have a meter value in roll_details.`);
    }

    const rollDetailsSum = rollMeters.reduce((sum, meters) => sum + meters, 0);
    if (Math.abs(rollDetailsSum - meters) > 0.01) {
      throw new Error(`Row ${i + 1}: Sum of roll details (${rollDetailsSum.toFixed(2)}) doesn't match total meters (${meters}). Please check your calculations.`);
    }

    // Parse and validate dates
    let entryDate: string;
    let invoiceDate: string;
    let productionDate: string | undefined;

    try {
      entryDate = parseFlexibleDate(row.entry_date);
    } catch (error: any) {
      throw new Error(`Row ${i + 1}: Invalid entry_date. ${error.message}`);
    }

    try {
      invoiceDate = parseFlexibleDate(row.invoice_date);
    } catch (error: any) {
      throw new Error(`Row ${i + 1}: Invalid invoice_date. ${error.message}`);
    }

    if (row.production_date) {
      try {
        productionDate = parseFlexibleDate(row.production_date);
      } catch (error: any) {
        throw new Error(`Row ${i + 1}: Invalid production_date. ${error.message}`);
      }
    }

    const lotData: ImportLotData = {
      quality: row.quality,
      color: row.color,
      roll_count: rollCount,
      meters: meters,
      lot_number: row.lot_number,
      entry_date: entryDate,
      supplier_name: row.supplier_name,
      invoice_number: row.invoice_number,
      invoice_date: invoiceDate,
      production_date: productionDate,
      warehouse_location: row.warehouse_location || undefined,
      notes: row.notes || undefined,
      roll_details: row.roll_details
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