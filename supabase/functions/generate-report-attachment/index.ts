import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportRequest {
  report_type: string;
  format: 'html' | 'csv' | 'json' | 'excel';
  config_id?: string;
  filters?: Record<string, any>;
  columns?: string[];
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
function generateHTMLTable(headers: string[], rows: any[][], title?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #1f2937; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; padding: 10px 8px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; }
        td { padding: 8px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { margin-top: 20px; color: #9ca3af; font-size: 11px; }
      </style>
    </head>
    <body>
      ${title ? `<h1>${title}</h1>` : ''}
      <div class="meta">Generated on ${new Date().toLocaleString()}</div>
      <table>
        <thead>
          <tr>
            ${headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">Total rows: ${rows.length}</div>
    </body>
    </html>
  `;
}

// Generate Excel XML (SpreadsheetML format - universally compatible)
function generateExcelXML(headers: string[], rows: any[][], sheetName: string = 'Report'): string {
  const escapeXml = (str: string) => 
    String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const cellType = (value: any): { type: string; value: string } => {
    if (value === null || value === undefined) return { type: 'String', value: '' };
    if (typeof value === 'number') return { type: 'Number', value: String(value) };
    if (typeof value === 'boolean') return { type: 'Boolean', value: value ? '1' : '0' };
    return { type: 'String', value: escapeXml(String(value)) };
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Data">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName)}">
    <Table>
      <Row>
        ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
      </Row>
      ${rows.map(row => `
        <Row>
          ${row.map(cell => {
            const { type, value } = cellType(cell);
            return `<Cell ss:StyleID="Data"><Data ss:Type="${type}">${value}</Data></Cell>`;
          }).join('')}
        </Row>
      `).join('')}
    </Table>
  </Worksheet>
</Workbook>`;
}

// Report type definitions
const REPORT_CONFIGS: Record<string, {
  title: string;
  defaultHeaders: string[];
  sheetName: string;
}> = {
  inventory_stock: {
    title: 'Inventory Stock Report',
    defaultHeaders: ['Quality', 'Color', 'In Stock (m)', 'Rolls', 'Reserved (m)', 'Available (m)'],
    sheetName: 'Inventory Stock',
  },
  inventory_position: {
    title: 'Inventory Position Report',
    defaultHeaders: ['Quality', 'Color', 'In Stock', 'Incoming', 'Reserved', 'Available'],
    sheetName: 'Inventory Position',
  },
  inventory_aging: {
    title: 'Inventory Aging Report',
    defaultHeaders: ['Quality', 'Color', 'Entry Date', 'Days in Stock', 'Meters', 'Age Bracket'],
    sheetName: 'Inventory Aging',
  },
  incoming_stock: {
    title: 'Incoming Stock Report',
    defaultHeaders: ['Quality', 'Color', 'Supplier', 'Expected', 'Received', 'Remaining', 'Status'],
    sheetName: 'Incoming Stock',
  },
  manufacturing_orders: {
    title: 'Manufacturing Orders Report',
    defaultHeaders: ['MO #', 'Quality', 'Color', 'Amount', 'Status', 'Expected Date', 'Supplier'],
    sheetName: 'Manufacturing Orders',
  },
  reservations: {
    title: 'Reservations Report',
    defaultHeaders: ['Reservation #', 'Customer', 'Quality', 'Color', 'Meters', 'Reserved Date', 'Status'],
    sheetName: 'Reservations',
  },
  order_fulfillment: {
    title: 'Order Fulfillment Report',
    defaultHeaders: ['Order #', 'Customer', 'Lots', 'Rolls', 'Meters', 'Created', 'Status'],
    sheetName: 'Orders',
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("generate-report-attachment: Starting report generation");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { report_type, format, config_id, filters, columns }: ReportRequest = await req.json();

    console.log(`generate-report-attachment: Type=${report_type}, Format=${format}`);

    let headers: string[] = [];
    let rows: any[][] = [];
    const reportConfig = REPORT_CONFIGS[report_type];
    const title = reportConfig?.title || 'Report';
    const sheetName = reportConfig?.sheetName || 'Data';

    // Fetch custom report config if provided
    let customConfig: any = null;
    if (config_id) {
      const { data } = await supabase
        .from("email_report_configs")
        .select("*")
        .eq("id", config_id)
        .single();
      customConfig = data;
    }

    switch (report_type) {
      case 'inventory_stock':
      case 'inventory_position': {
        const { data: stockData, error } = await supabase.rpc("get_inventory_pivot_summary");
        if (error) throw error;

        if (report_type === 'inventory_stock') {
          headers = ['Quality', 'Color', 'In Stock (m)', 'Rolls', 'Reserved (m)', 'Available (m)'];
          rows = (stockData || []).map((item: any) => [
            item.quality,
            item.color,
            Number(item.total_meters || 0),
            Number(item.total_rolls || 0),
            Number(item.total_reserved_meters || 0),
            Number(item.available_meters || 0),
          ]);
        } else {
          headers = ['Quality', 'Color', 'In Stock', 'Incoming', 'Reserved', 'Available'];
          rows = (stockData || []).map((item: any) => [
            item.quality,
            item.color,
            Number(item.total_meters || 0),
            Number(item.incoming_meters || 0),
            Number(item.total_reserved_meters || 0),
            Number(item.available_meters || 0),
          ]);
        }
        break;
      }

      case 'inventory_aging': {
        const { data: lotsData, error } = await supabase
          .from("lots")
          .select("quality, color, entry_date, meters, roll_count")
          .eq("status", "in_stock")
          .order("entry_date", { ascending: true });
        if (error) throw error;

        const today = new Date();
        headers = ['Quality', 'Color', 'Entry Date', 'Days in Stock', 'Meters', 'Rolls', 'Age Bracket'];
        rows = (lotsData || []).map((lot: any) => {
          const entryDate = new Date(lot.entry_date);
          const daysInStock = Math.ceil((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
          let ageBracket = '0-30 days';
          if (daysInStock > 90) ageBracket = '90+ days';
          else if (daysInStock > 60) ageBracket = '61-90 days';
          else if (daysInStock > 30) ageBracket = '31-60 days';
          
          return [
            lot.quality,
            lot.color,
            entryDate.toISOString().split('T')[0],
            daysInStock,
            Number(lot.meters || 0),
            Number(lot.roll_count || 0),
            ageBracket,
          ];
        });
        break;
      }

      case 'incoming_stock': {
        const { data: incomingData, error } = await supabase
          .from("incoming_stock")
          .select(`
            quality, color, expected_meters, received_meters, status, expected_arrival_date,
            suppliers!incoming_stock_supplier_id_fkey (name)
          `)
          .in("status", ["pending_inbound", "partially_received"])
          .order("expected_arrival_date", { ascending: true });
        if (error) throw error;

        headers = ['Quality', 'Color', 'Supplier', 'Expected (m)', 'Received (m)', 'Remaining (m)', 'Expected Date', 'Status'];
        rows = (incomingData || []).map((item: any) => [
          item.quality,
          item.color,
          item.suppliers?.name || 'Unknown',
          Number(item.expected_meters || 0),
          Number(item.received_meters || 0),
          Number((item.expected_meters || 0) - (item.received_meters || 0)),
          item.expected_arrival_date || 'N/A',
          item.status,
        ]);
        break;
      }

      case 'manufacturing_orders': {
        const { data: moData, error } = await supabase
          .from("manufacturing_orders")
          .select(`
            mo_number, quality, color, ordered_amount, status, expected_completion_date, order_date,
            suppliers!manufacturing_orders_supplier_id_fkey (name)
          `)
          .not("status", "in", '("SHIPPED","CANCELLED")')
          .order("expected_completion_date", { ascending: true });
        if (error) throw error;

        headers = ['MO #', 'Quality', 'Color', 'Amount (m)', 'Order Date', 'Expected Date', 'Status', 'Supplier'];
        rows = (moData || []).map((mo: any) => [
          mo.mo_number,
          mo.quality,
          mo.color,
          Number(mo.ordered_amount || 0),
          mo.order_date || 'N/A',
          mo.expected_completion_date || 'N/A',
          mo.status,
          mo.suppliers?.name || 'Unknown',
        ]);
        break;
      }

      case 'reservations': {
        const { data: resData, error } = await supabase
          .from("reservations")
          .select(`
            reservation_number, customer_name, reserved_date, status,
            reservation_lines (quality, color, reserved_meters)
          `)
          .eq("status", "active")
          .order("reserved_date", { ascending: false });
        if (error) throw error;

        headers = ['Reservation #', 'Customer', 'Quality', 'Color', 'Reserved (m)', 'Reserved Date', 'Status'];
        rows = [];
        (resData || []).forEach((res: any) => {
          (res.reservation_lines || []).forEach((line: any) => {
            rows.push([
              res.reservation_number,
              res.customer_name,
              line.quality,
              line.color,
              Number(line.reserved_meters || 0),
              res.reserved_date,
              res.status,
            ]);
          });
        });
        break;
      }

      case 'order_fulfillment': {
        const { data: orderData, error } = await supabase
          .from("orders")
          .select(`
            order_number, customer_name, created_at, fulfilled_at,
            order_lots (id, roll_count)
          `)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) throw error;

        headers = ['Order #', 'Customer', 'Lines', 'Rolls', 'Created', 'Fulfilled', 'Status'];
        rows = (orderData || []).map((order: any) => {
          const totalRolls = (order.order_lots || []).reduce((sum: number, lot: any) => sum + (lot.roll_count || 0), 0);
          return [
            order.order_number,
            order.customer_name || 'N/A',
            (order.order_lots || []).length,
            totalRolls,
            new Date(order.created_at).toISOString().split('T')[0],
            order.fulfilled_at ? new Date(order.fulfilled_at).toISOString().split('T')[0] : 'Pending',
            order.fulfilled_at ? 'Fulfilled' : 'Pending',
          ];
        });
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
    const dateStr = new Date().toISOString().split('T')[0];

    switch (format) {
      case 'excel':
        content = generateExcelXML(headers, rows, sheetName);
        contentType = 'application/vnd.ms-excel';
        filename = `${report_type}_${dateStr}.xls`;
        break;
      case 'csv':
        content = generateCSV(headers, rows);
        contentType = 'text/csv';
        filename = `${report_type}_${dateStr}.csv`;
        break;
      case 'html':
        content = generateHTMLTable(headers, rows, title);
        contentType = 'text/html';
        filename = `${report_type}_${dateStr}.html`;
        break;
      case 'json':
      default:
        content = JSON.stringify({ 
          title,
          headers, 
          rows, 
          generated_at: new Date().toISOString(),
          row_count: rows.length,
        });
        contentType = 'application/json';
        filename = `${report_type}_${dateStr}.json`;
        break;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        content,
        content_type: contentType,
        filename,
        row_count: rows.length,
        title,
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
