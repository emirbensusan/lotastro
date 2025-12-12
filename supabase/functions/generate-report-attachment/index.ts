import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  report_type: string;
  format: 'html' | 'csv' | 'json';
  config_id?: string;
  filters?: Record<string, any>;
}

// Generate CSV content
function generateCSV(headers: string[], rows: any[][]): string {
  const csvRows = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const str = String(cell ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','))
  ];
  return csvRows.join('\n');
}

// Generate HTML table
function generateHTMLTable(headers: string[], rows: any[][]): string {
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f3f4f6;">
          ${headers.map(h => `<th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>
            ${row.map(cell => `<td style="padding: 8px; border: 1px solid #e5e7eb;">${cell ?? ''}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("generate-report-attachment: Starting report generation");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { report_type, format, config_id, filters }: ReportRequest = await req.json();

    console.log(`generate-report-attachment: Type=${report_type}, Format=${format}`);

    let headers: string[] = [];
    let rows: any[][] = [];

    // Fetch report config if provided
    let reportConfig: any = null;
    if (config_id) {
      const { data } = await supabase
        .from("email_report_configs")
        .select("*")
        .eq("id", config_id)
        .single();
      reportConfig = data;
    }

    switch (report_type) {
      case 'inventory_stock': {
        const { data: stockData, error } = await supabase.rpc("get_inventory_pivot_summary");
        if (error) throw error;

        headers = ['Quality', 'Color', 'In Stock (m)', 'Reserved (m)', 'Available (m)'];
        rows = (stockData || []).map((item: any) => [
          item.quality,
          item.color,
          item.total_meters?.toLocaleString() || '0',
          item.total_reserved_meters?.toLocaleString() || '0',
          item.available_meters?.toLocaleString() || '0',
        ]);
        break;
      }

      case 'inventory_position': {
        const { data: stockData, error } = await supabase.rpc("get_inventory_pivot_summary");
        if (error) throw error;

        headers = ['Quality', 'Color', 'In Stock', 'Incoming', 'Reserved', 'Available'];
        rows = (stockData || []).map((item: any) => [
          item.quality,
          item.color,
          item.total_meters?.toLocaleString() || '0',
          item.incoming_meters?.toLocaleString() || '0',
          item.total_reserved_meters?.toLocaleString() || '0',
          item.available_meters?.toLocaleString() || '0',
        ]);
        break;
      }

      case 'inventory_aging': {
        const { data: lotsData, error } = await supabase
          .from("lots")
          .select("quality, color, entry_date, meters")
          .eq("status", "in_stock")
          .order("entry_date", { ascending: true });
        if (error) throw error;

        const today = new Date();
        headers = ['Quality', 'Color', 'Entry Date', 'Days in Stock', 'Meters'];
        rows = (lotsData || []).map((lot: any) => {
          const entryDate = new Date(lot.entry_date);
          const daysInStock = Math.ceil((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          return [
            lot.quality,
            lot.color,
            entryDate.toLocaleDateString(),
            daysInStock,
            lot.meters?.toLocaleString() || '0',
          ];
        });
        break;
      }

      case 'incoming_orders': {
        const { data: incomingData, error } = await supabase
          .from("incoming_stock")
          .select(`
            quality, color, expected_meters, received_meters, status,
            suppliers!incoming_stock_supplier_id_fkey (name)
          `)
          .in("status", ["pending_inbound", "partially_received"]);
        if (error) throw error;

        headers = ['Quality', 'Color', 'Supplier', 'Expected', 'Received', 'Status'];
        rows = (incomingData || []).map((item: any) => [
          item.quality,
          item.color,
          item.suppliers?.name || 'Unknown',
          item.expected_meters?.toLocaleString() || '0',
          item.received_meters?.toLocaleString() || '0',
          item.status,
        ]);
        break;
      }

      case 'production_digest': {
        const { data: moData, error } = await supabase
          .from("manufacturing_orders")
          .select(`
            mo_number, quality, color, ordered_amount, status, expected_completion_date,
            suppliers!manufacturing_orders_supplier_id_fkey (name)
          `)
          .not("status", "in", '("SHIPPED","CANCELLED")');
        if (error) throw error;

        headers = ['MO #', 'Quality', 'Color', 'Amount', 'Status', 'Expected Date', 'Supplier'];
        rows = (moData || []).map((mo: any) => [
          mo.mo_number,
          mo.quality,
          mo.color,
          mo.ordered_amount?.toLocaleString() || '0',
          mo.status,
          mo.expected_completion_date || 'N/A',
          mo.suppliers?.name || 'Unknown',
        ]);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown report type: ${report_type}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`generate-report-attachment: Generated ${rows.length} rows`);

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'csv':
        content = generateCSV(headers, rows);
        contentType = 'text/csv';
        filename = `${report_type}_${new Date().toISOString().split('T')[0]}.csv`;
        break;
      case 'html':
        content = generateHTMLTable(headers, rows);
        contentType = 'text/html';
        filename = `${report_type}_${new Date().toISOString().split('T')[0]}.html`;
        break;
      case 'json':
      default:
        content = JSON.stringify({ headers, rows, generated_at: new Date().toISOString() });
        contentType = 'application/json';
        filename = `${report_type}_${new Date().toISOString().split('T')[0]}.json`;
        break;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        content,
        content_type: contentType,
        filename,
        row_count: rows.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-report-attachment: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
