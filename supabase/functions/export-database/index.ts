import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExportRequest {
  tables: string[];
  format: 'excel' | 'csv' | 'json';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get authorization header for user context
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Authorization required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify user is admin
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('role', 'admin')
    .single();

  if (!roleData) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: ExportRequest = await req.json();
    const { tables, format } = body;

    if (!tables || tables.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No tables specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting export: format=${format}, tables=${tables.join(', ')}`);

    // Create export log entry
    const { data: logEntry, error: logError } = await supabase
      .from('database_export_logs')
      .insert({
        export_type: format,
        tables_included: tables,
        exported_by: userData.user.id,
        status: 'in_progress',
      })
      .select()
      .single();

    if (logError) {
      console.error('Error creating log entry:', logError);
    }

    // Fetch data from each table
    const exportData: Record<string, any[]> = {};
    const rowCounts: Record<string, number> = {};

    for (const table of tables) {
      console.log(`Fetching data from table: ${table}`);
      
      let query = supabase.from(table).select('*');
      
      // Special handling for audit_logs - limit to last 90 days
      if (table === 'audit_logs') {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        query = query.gte('created_at', ninetyDaysAgo.toISOString());
      }
      
      // Limit to prevent memory issues
      query = query.limit(100000);

      const { data, error } = await query;

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        exportData[table] = [];
        rowCounts[table] = 0;
      } else {
        exportData[table] = data || [];
        rowCounts[table] = (data || []).length;
        console.log(`Fetched ${rowCounts[table]} rows from ${table}`);
      }
    }

    // Generate export based on format
    let exportResult: { content: string; mimeType: string; extension: string };

    if (format === 'json') {
      exportResult = {
        content: JSON.stringify(exportData, null, 2),
        mimeType: 'application/json',
        extension: 'json',
      };
    } else if (format === 'csv') {
      // For CSV, we'll create a simple concatenated format with table headers
      const csvParts: string[] = [];
      
      for (const [tableName, rows] of Object.entries(exportData)) {
        if (rows.length === 0) continue;
        
        csvParts.push(`\n=== ${tableName.toUpperCase()} ===\n`);
        
        const headers = Object.keys(rows[0]);
        csvParts.push(headers.join(','));
        
        for (const row of rows) {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          });
          csvParts.push(values.join(','));
        }
      }
      
      exportResult = {
        content: csvParts.join('\n'),
        mimeType: 'text/csv',
        extension: 'csv',
      };
    } else {
      // Excel format - create a simplified TSV that Excel can open
      // Note: Full XLSX generation would require a library like xlsx
      const tsvParts: string[] = [];
      
      for (const [tableName, rows] of Object.entries(exportData)) {
        if (rows.length === 0) continue;
        
        tsvParts.push(`\n=== ${tableName.toUpperCase()} ===\n`);
        
        const headers = Object.keys(rows[0]);
        tsvParts.push(headers.join('\t'));
        
        for (const row of rows) {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ');
          });
          tsvParts.push(values.join('\t'));
        }
      }
      
      exportResult = {
        content: tsvParts.join('\n'),
        mimeType: 'text/tab-separated-values',
        extension: 'tsv',
      };
    }

    // Calculate file size
    const encoder = new TextEncoder();
    const bytes = encoder.encode(exportResult.content);
    const fileSize = bytes.length;

    // Update export log
    if (logEntry) {
      await supabase
        .from('database_export_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          file_size_bytes: fileSize,
          row_counts: rowCounts,
        })
        .eq('id', logEntry.id);
    }

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `database-export-${timestamp}.${exportResult.extension}`;

    console.log(`Export completed: ${filename}, size: ${fileSize} bytes`);

    // Return base64 encoded content
    const base64Content = btoa(unescape(encodeURIComponent(exportResult.content)));

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        mimeType: exportResult.mimeType,
        base64: base64Content,
        size: fileSize,
        rowCounts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Export error:', error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
