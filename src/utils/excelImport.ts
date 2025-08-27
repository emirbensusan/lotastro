import { supabase } from '@/integrations/supabase/client';

export interface ImportLotData {
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  supplier_name: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  imported?: number;
  errors?: string[];
}

export const generateExcelTemplate = (): void => {
  const headers = [
    'lot_number',
    'quality', 
    'color',
    'meters',
    'roll_count',
    'supplier_name'
  ];

  const sampleData = [
    'LOT001,Premium,Red,100.5,5,Supplier A',
    'LOT002,Standard,Blue,75.2,3,Supplier B',
    'LOT003,Premium,Green,120.0,6,Supplier C'
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
  
  const requiredFields = ['lot_number', 'quality', 'color', 'meters', 'roll_count', 'supplier_name'];
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
      lot_number: row.lot_number,
      quality: row.quality,
      color: row.color,
      meters: parseFloat(row.meters),
      roll_count: parseInt(row.roll_count),
      supplier_name: row.supplier_name
    };

    // Validate required fields
    if (!lotData.lot_number || !lotData.quality || !lotData.color || !lotData.supplier_name) {
      throw new Error(`Row ${i + 1}: Missing required data`);
    }

    if (isNaN(lotData.meters) || isNaN(lotData.roll_count)) {
      throw new Error(`Row ${i + 1}: Invalid numeric values`);
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
        const { error: lotError } = await supabase
          .from('lots')
          .insert({
            lot_number: lot.lot_number,
            quality: lot.quality,
            color: lot.color,
            meters: lot.meters,
            roll_count: lot.roll_count,
            supplier_id: supplier!.id,
            status: 'in_stock'
          });

        if (lotError) {
          errors.push(`Failed to import LOT "${lot.lot_number}": ${lotError.message}`);
        } else {
          imported++;
        }
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