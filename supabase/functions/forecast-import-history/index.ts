import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedRow {
  quality_code: string;
  color_code: string;
  demand_date: string;
  amount: number;
  unit: string;
  document_status: string;
  row_number: number;
  error?: string;
}

interface ImportResult {
  success: boolean;
  total_rows: number;
  imported_rows: number;
  skipped_duplicates: number;
  error_rows: number;
  errors: { row: number; message: string }[];
  import_batch_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[forecast-import-history] Processing file: ${file.name}, size: ${file.size} bytes`);

    // Read file content
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'File is empty or has no data rows' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse header row
    const headerRow = lines[0];
    const headers = parseCSVRow(headerRow).map(h => h.toLowerCase().trim());
    
    console.log(`[forecast-import-history] Headers found:`, headers);

    // Map Turkish headers to internal names
    const headerMap: Record<string, string> = {
      'kalite_kodu': 'quality_code',
      'kalite': 'quality_code',
      'quality_code': 'quality_code',
      'quality': 'quality_code',
      'renk_kodu': 'color_code',
      'renk': 'color_code',
      'color_code': 'color_code',
      'color': 'color_code',
      'tarih': 'demand_date',
      'date': 'demand_date',
      'demand_date': 'demand_date',
      'miktar': 'amount',
      'amount': 'amount',
      'quantity': 'amount',
      'birim': 'unit',
      'unit': 'unit',
      'belge_durumu': 'document_status',
      'status': 'document_status',
      'document_status': 'document_status',
    };

    // Find column indices
    const columnIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const mappedName = headerMap[header];
      if (mappedName) {
        columnIndices[mappedName] = index;
      }
    });

    console.log(`[forecast-import-history] Column indices:`, columnIndices);

    // Validate required columns
    const requiredColumns = ['quality_code', 'color_code', 'demand_date', 'amount'];
    const missingColumns = requiredColumns.filter(col => columnIndices[col] === undefined);
    
    if (missingColumns.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Missing required columns: ${missingColumns.join(', ')}. Expected headers: kalite_kodu, renk_kodu, tarih, miktar, birim, belge_durumu` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate import batch ID
    const importBatchId = crypto.randomUUID();

    // Parse data rows
    const parsedRows: ParsedRow[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1; // 1-indexed for user display
      const values = parseCSVRow(lines[i]);
      
      if (values.length === 0 || values.every(v => !v.trim())) {
        continue; // Skip empty rows
      }

      try {
        const qualityCode = (values[columnIndices.quality_code] || '').trim().toUpperCase();
        const colorCode = (values[columnIndices.color_code] || '').trim().toUpperCase();
        const dateStr = (values[columnIndices.demand_date] || '').trim();
        const amountStr = (values[columnIndices.amount] || '').trim();
        const unit = columnIndices.unit !== undefined 
          ? (values[columnIndices.unit] || 'M').trim().toUpperCase() 
          : 'M';
        const documentStatus = columnIndices.document_status !== undefined 
          ? (values[columnIndices.document_status] || 'confirmed').trim().toLowerCase() 
          : 'confirmed';

        // Validate quality code
        if (!qualityCode) {
          errors.push({ row: rowNumber, message: 'Kalite kodu boş olamaz (Quality code is required)' });
          continue;
        }

        // Validate color code - REJECT if missing
        if (!colorCode) {
          errors.push({ row: rowNumber, message: 'Renk kodu boş olamaz (Color code is required)' });
          continue;
        }

        // Validate date
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) {
          errors.push({ row: rowNumber, message: `Geçersiz tarih formatı: "${dateStr}". YYYY-MM-DD formatında olmalı` });
          continue;
        }

        // Validate amount
        const amount = parseFloat(amountStr.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
          errors.push({ row: rowNumber, message: `Geçersiz miktar: "${amountStr}". Pozitif sayı olmalı` });
          continue;
        }

        // Validate unit
        if (!['M', 'KG'].includes(unit)) {
          errors.push({ row: rowNumber, message: `Geçersiz birim: "${unit}". M veya KG olmalı` });
          continue;
        }

        parsedRows.push({
          quality_code: qualityCode,
          color_code: colorCode,
          demand_date: parsedDate,
          amount,
          unit,
          document_status: documentStatus,
          row_number: rowNumber,
        });

      } catch (parseError) {
        errors.push({ row: rowNumber, message: `Satır ayrıştırma hatası: ${parseError}` });
      }
    }

    console.log(`[forecast-import-history] Parsed ${parsedRows.length} valid rows, ${errors.length} errors`);

    if (parsedRows.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No valid rows found in file',
          errors: errors.slice(0, 20), // Return first 20 errors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicates in database
    const { data: existingData } = await supabase
      .from('demand_history')
      .select('quality_code, color_code, demand_date, document_status, amount');

    const existingSet = new Set(
      (existingData || []).map(e => 
        `${e.quality_code}|${e.color_code}|${e.demand_date}|${e.document_status}|${e.amount}`
      )
    );

    // Filter out duplicates
    const rowsToInsert: any[] = [];
    let skippedDuplicates = 0;

    for (const row of parsedRows) {
      const key = `${row.quality_code}|${row.color_code}|${row.demand_date}|${row.document_status}|${row.amount}`;
      
      if (existingSet.has(key)) {
        skippedDuplicates++;
        continue;
      }

      rowsToInsert.push({
        quality_code: row.quality_code,
        color_code: row.color_code,
        demand_date: row.demand_date,
        amount: row.amount,
        unit: row.unit,
        document_status: row.document_status,
        source: 'csv_import',
        import_batch_id: importBatchId,
        import_row_number: row.row_number,
        created_by: userId || null,
      });

      // Add to existing set to detect duplicates within file
      existingSet.add(key);
    }

    console.log(`[forecast-import-history] Inserting ${rowsToInsert.length} rows, skipping ${skippedDuplicates} duplicates`);

    // Batch insert (in chunks of 500)
    const BATCH_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('demand_history')
        .insert(batch);

      if (insertError) {
        console.error(`[forecast-import-history] Insert error for batch ${i}:`, insertError);
        // Continue with next batch but log error
        errors.push({ row: i, message: `Veritabanı hatası: ${insertError.message}` });
      } else {
        insertedCount += batch.length;
      }
    }

    const result: ImportResult = {
      success: true,
      total_rows: lines.length - 1, // Exclude header
      imported_rows: insertedCount,
      skipped_duplicates: skippedDuplicates,
      error_rows: errors.length,
      errors: errors.slice(0, 50), // Return first 50 errors
      import_batch_id: importBatchId,
    };

    console.log(`[forecast-import-history] Import completed:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[forecast-import-history] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Parse CSV row handling quoted values
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  // Try to detect delimiter
  const delimiter = row.includes(';') ? ';' : ',';
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// Parse date in various formats
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return dateStr;
    }
  }
  
  // Try DD/MM/YYYY or DD.MM.YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(formatted);
    if (!isNaN(date.getTime())) {
      return formatted;
    }
  }
  
  // Try MM/DD/YYYY
  const mmddyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const formatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const date = new Date(formatted);
    if (!isNaN(date.getTime())) {
      return formatted;
    }
  }
  
  // Try Excel date number
  const excelNum = parseFloat(dateStr);
  if (!isNaN(excelNum) && excelNum > 30000 && excelNum < 60000) {
    // Excel date starts from 1900-01-01
    const date = new Date((excelNum - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  return null;
}