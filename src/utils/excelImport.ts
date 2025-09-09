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
    'meters',
    'lot_number',
    'entry_date',
    'supplier_name',
    'invoice_number',
    'invoice_date',
    'production_date',
    'warehouse_location',
    'notes',
    'roll_details'
  ];

  const sampleData = [
    'Premium,Red,3,190.5,LOT001,2024-01-15,Supplier A,INV001,2024-01-10,2024-01-05,A1-B2-C3,Sample notes,40;50;100.5',
    'Standard,Blue,1,75.2,LOT002,2024-01-16,Supplier B,INV002,2024-01-12,,A2-B1-C1,,75.2',
    'Premium,Green,2,170.0,LOT003,2024-01-17,Supplier C,INV003,2024-01-14,2024-01-08,B1-C2-A3,High quality fabric,70;100'
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

export const parseCSVFile = (csvText: string): ImportLotData[] => {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
  
  const requiredFields = ['quality', 'color', 'roll_count', 'meters', 'lot_number', 'entry_date', 'supplier_name', 'invoice_number', 'invoice_date', 'roll_details'];
  const missingFields = requiredFields.filter(field => !headers.includes(field));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  const data: ImportLotData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    
    if (values.length !== headers.length) {
      throw new Error(`Row ${i + 1}: Invalid number of columns`);
    }

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    // Validate and convert data types
    const lotData: ImportLotData = {
      quality: row.quality,
      color: row.color,
      roll_count: parseInt(row.roll_count),
      meters: parseFloat(row.meters),
      lot_number: row.lot_number,
      entry_date: row.entry_date,
      supplier_name: row.supplier_name,
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date,
      production_date: row.production_date || undefined,
      warehouse_location: row.warehouse_location || undefined,
      notes: row.notes || undefined,
      roll_details: row.roll_details || undefined
    };

    // Validate required fields
    if (!lotData.quality || !lotData.color || !lotData.lot_number || !lotData.entry_date || !lotData.supplier_name || !lotData.invoice_number || !lotData.invoice_date || !lotData.roll_details) {
      throw new Error(`Row ${i + 1}: Missing required data`);
    }

    if (isNaN(lotData.meters) || isNaN(lotData.roll_count)) {
      throw new Error(`Row ${i + 1}: Invalid numeric values`);
    }

    // Validate roll_details format and consistency
    const rollMeters = lotData.roll_details.split(';').map(m => parseFloat(m.trim()));
    
    if (rollMeters.some(m => isNaN(m) || m <= 0)) {
      throw new Error(`Row ${i + 1}: Invalid roll details format. Use semicolon-separated positive numbers (e.g., "40;50;100")`);
    }

    if (rollMeters.length !== lotData.roll_count) {
      throw new Error(`Row ${i + 1}: Roll count (${lotData.roll_count}) doesn't match number of roll details (${rollMeters.length})`);
    }

    const rollDetailsSum = rollMeters.reduce((sum, meters) => sum + meters, 0);
    if (Math.abs(rollDetailsSum - lotData.meters) > 0.01) {
      throw new Error(`Row ${i + 1}: Sum of roll details (${rollDetailsSum}) doesn't match total meters (${lotData.meters})`);
    }

    // Validate date formats
    if (!Date.parse(lotData.entry_date)) {
      throw new Error(`Row ${i + 1}: Invalid entry date format`);
    }

    if (!Date.parse(lotData.invoice_date)) {
      throw new Error(`Row ${i + 1}: Invalid invoice date format`);
    }

    if (lotData.production_date && !Date.parse(lotData.production_date)) {
      throw new Error(`Row ${i + 1}: Invalid production date format`);
    }

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