import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ColumnConfig {
  key: string;
  labelEn?: string;
  labelTr?: string;
  displayLabel?: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
  width?: number;
}

interface CalculatedField {
  id: string;
  name: string;
  formula: string;
  columns: string[];
  operation: 'sum' | 'difference' | 'multiply' | 'divide' | 'average' | 'percentage' | 'custom';
  customFormula?: string;
  format?: 'number' | 'currency' | 'percentage';
  decimals?: number;
}

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  value2?: string;
}

interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  conditions: FilterCondition[];
}

interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
  priority: number;
}

interface ConditionalRule {
  id: string;
  column: string;
  operator: string;
  value: string;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: 'normal' | 'bold';
}

interface ReportStyling {
  headerBackgroundColor: string;
  headerTextColor: string;
  headerFontWeight: 'normal' | 'bold';
  alternateRowColors: boolean;
  evenRowColor: string;
  oddRowColor: string;
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  fontSize: 'small' | 'medium' | 'large';
  conditionalRules: ConditionalRule[];
}

interface ReportRequest {
  report_type?: string;
  format: 'html' | 'csv' | 'json' | 'excel' | 'pdf';
  config_id?: string;
  filters?: Record<string, any>;
  columns?: string[];
  language?: 'en' | 'tr';
}

interface DynamicReportConfig {
  id: string;
  name: string;
  data_source: string;
  selected_joins?: string[];
  columns_config: ColumnConfig[];
  calculated_fields?: CalculatedField[];
  filters?: FilterGroup[];
  styling?: ReportStyling;
  output_formats?: string[];
  include_charts?: boolean;
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

// Generate real Excel (.xlsx) using xlsx library
function generateExcelBuffer(
  headers: string[], 
  rows: any[][], 
  sheetName: string,
  styling?: ReportStyling,
  columnConfigs?: ColumnConfig[]
): Uint8Array {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Prepare data with headers
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths based on content
  const colWidths = headers.map((header, idx) => {
    let maxWidth = header.length;
    rows.forEach(row => {
      const cellValue = String(row[idx] ?? '');
      maxWidth = Math.max(maxWidth, cellValue.length);
    });
    return { wch: Math.min(Math.max(maxWidth + 2, 10), 50) };
  });
  ws['!cols'] = colWidths;
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
  
  // Write to buffer
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(buffer);
}

// Generate HTML table with dynamic styling
function generateHTMLTable(
  headers: string[], 
  rows: any[][], 
  title: string,
  styling?: ReportStyling,
  columnConfigs?: ColumnConfig[],
  conditionalRules?: ConditionalRule[]
): string {
  const borderStyles: Record<string, string> = {
    none: 'border: none;',
    light: 'border: 1px solid #e5e7eb;',
    medium: 'border: 1px solid #9ca3af;',
    heavy: 'border: 2px solid #374151;',
  };
  
  const fontSizes: Record<string, string> = {
    small: '12px',
    medium: '14px',
    large: '16px',
  };

  const headerBg = styling?.headerBackgroundColor || '#f3f4f6';
  const headerText = styling?.headerTextColor || '#1f2937';
  const headerWeight = styling?.headerFontWeight || 'bold';
  const evenRow = styling?.evenRowColor || '#f9fafb';
  const oddRow = styling?.oddRowColor || '#ffffff';
  const border = borderStyles[styling?.borderStyle || 'light'];
  const fontSize = fontSizes[styling?.fontSize || 'medium'];
  const alternateRows = styling?.alternateRowColors !== false;

  // Build conditional styling logic
  const getConditionalStyle = (row: any[], rowIndex: number, cellIndex: number): string => {
    if (!conditionalRules || conditionalRules.length === 0 || !columnConfigs) return '';
    
    const columnKey = columnConfigs[cellIndex]?.key;
    const cellValue = row[cellIndex];
    
    for (const rule of conditionalRules) {
      if (rule.column !== columnKey) continue;
      
      let match = false;
      const ruleValue = rule.value;
      
      switch (rule.operator) {
        case 'equals':
          match = String(cellValue) === ruleValue;
          break;
        case 'notEquals':
          match = String(cellValue) !== ruleValue;
          break;
        case 'contains':
          match = String(cellValue).toLowerCase().includes(ruleValue.toLowerCase());
          break;
        case 'greaterThan':
          match = Number(cellValue) > Number(ruleValue);
          break;
        case 'lessThan':
          match = Number(cellValue) < Number(ruleValue);
          break;
        case 'isEmpty':
          match = cellValue === null || cellValue === undefined || cellValue === '';
          break;
        case 'isNotEmpty':
          match = cellValue !== null && cellValue !== undefined && cellValue !== '';
          break;
      }
      
      if (match) {
        let style = '';
        if (rule.backgroundColor) style += `background-color: ${rule.backgroundColor};`;
        if (rule.textColor) style += `color: ${rule.textColor};`;
        if (rule.fontWeight) style += `font-weight: ${rule.fontWeight};`;
        return style;
      }
    }
    
    return '';
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: ${fontSize}; }
        h1 { color: #1f2937; margin-bottom: 8px; }
        .meta { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { 
          background: ${headerBg}; 
          color: ${headerText};
          font-weight: ${headerWeight};
          padding: 10px 8px; 
          ${border}
          text-align: left; 
        }
        td { padding: 8px; ${border} }
        ${alternateRows ? `
        tr:nth-child(even) td { background: ${evenRow}; }
        tr:nth-child(odd) td { background: ${oddRow}; }
        ` : ''}
        .footer { margin-top: 20px; color: #9ca3af; font-size: 11px; }
        .number { text-align: right; }
        .currency { text-align: right; }
        .date { white-space: nowrap; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Generated on ${new Date().toLocaleString()}</div>
      <table>
        <thead>
          <tr>
            ${headers.map((h, i) => {
              const colType = columnConfigs?.[i]?.type || 'text';
              return `<th class="${colType}">${h}</th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, rowIdx) => `
            <tr>
              ${row.map((cell, cellIdx) => {
                const colType = columnConfigs?.[cellIdx]?.type || 'text';
                const conditionalStyle = getConditionalStyle(row, rowIdx, cellIdx);
                return `<td class="${colType}" style="${conditionalStyle}">${formatCellValue(cell, colType)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">Total rows: ${rows.length}</div>
    </body>
    </html>
  `;
}

// Generate print-friendly HTML for PDF export
function generatePDFHTML(
  headers: string[], 
  rows: any[][], 
  title: string,
  styling?: ReportStyling,
  columnConfigs?: ColumnConfig[]
): string {
  const fontSizes: Record<string, string> = {
    small: '10px',
    medium: '11px',
    large: '12px',
  };

  const fontSize = fontSizes[styling?.fontSize || 'medium'];

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 1cm;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
        }
        body { 
          font-family: Arial, Helvetica, sans-serif; 
          font-size: ${fontSize}; 
          margin: 0;
          padding: 20px;
          color: #1f2937;
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        h1 { font-size: 18px; margin: 0; color: #1e40af; }
        .meta { font-size: 10px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { 
          background: #1e40af; 
          color: white;
          padding: 8px 6px; 
          border: 1px solid #1e40af;
          text-align: left;
          font-weight: 600;
          font-size: 10px;
        }
        td { 
          padding: 6px; 
          border: 1px solid #d1d5db;
          font-size: 10px;
        }
        tr:nth-child(even) td { background: #f3f4f6; }
        .footer { 
          margin-top: 15px; 
          text-align: center;
          font-size: 9px; 
          color: #9ca3af;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
        }
        .number, .currency { text-align: right; }
        .print-btn {
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .print-btn:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      </div>
      <table>
        <thead>
          <tr>
            ${headers.map((h, i) => {
              const colType = columnConfigs?.[i]?.type || 'text';
              return `<th class="${colType}">${h}</th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${row.map((cell, cellIdx) => {
                const colType = columnConfigs?.[cellIdx]?.type || 'text';
                return `<td class="${colType}">${formatCellValue(cell, colType)}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        ${title} | Total: ${rows.length} rows | LotAstro WMS
      </div>
    </body>
    </html>
  `;
}

function formatCellValue(value: any, type: string): string {
  if (value === null || value === undefined) return '';
  
  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'currency':
      return typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value);
    case 'date':
      if (value instanceof Date) return value.toISOString().split('T')[0];
      if (typeof value === 'string' && value.includes('T')) return value.split('T')[0];
      return String(value);
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

// Generate Excel XML (SpreadsheetML format)
function generateExcelXML(
  headers: string[], 
  rows: any[][], 
  sheetName: string,
  styling?: ReportStyling,
  columnConfigs?: ColumnConfig[]
): string {
  const escapeXml = (str: string) => 
    String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  
  const cellType = (value: any, type?: string): { type: string; value: string } => {
    if (value === null || value === undefined) return { type: 'String', value: '' };
    if (type === 'number' || type === 'currency') return { type: 'Number', value: String(value) };
    if (typeof value === 'number') return { type: 'Number', value: String(value) };
    if (typeof value === 'boolean') return { type: 'Boolean', value: value ? '1' : '0' };
    return { type: 'String', value: escapeXml(String(value)) };
  };

  const headerBg = styling?.headerBackgroundColor || '#F3F4F6';

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="${headerBg}" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Data">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
    <Style ss:ID="Number">
      <NumberFormat ss:Format="#,##0.00"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXml(sheetName.substring(0, 31))}">
    <Table>
      <Row>
        ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('')}
      </Row>
      ${rows.map(row => `
        <Row>
          ${row.map((cell, idx) => {
            const colType = columnConfigs?.[idx]?.type;
            const { type, value } = cellType(cell, colType);
            const styleId = (type === 'Number') ? 'Number' : 'Data';
            return `<Cell ss:StyleID="${styleId}"><Data ss:Type="${type}">${value}</Data></Cell>`;
          }).join('')}
        </Row>
      `).join('')}
    </Table>
  </Worksheet>
</Workbook>`;
}

// Build Supabase query with filters
function applyFilters(query: any, filterGroups: FilterGroup[], columnConfigs: ColumnConfig[]): any {
  if (!filterGroups || filterGroups.length === 0) return query;

  for (const group of filterGroups) {
    for (const condition of group.conditions) {
      const column = condition.column;
      const value = condition.value;
      
      switch (condition.operator) {
        case 'equals':
          query = query.eq(column, value);
          break;
        case 'notEquals':
          query = query.neq(column, value);
          break;
        case 'contains':
          query = query.ilike(column, `%${value}%`);
          break;
        case 'startsWith':
          query = query.ilike(column, `${value}%`);
          break;
        case 'endsWith':
          query = query.ilike(column, `%${value}`);
          break;
        case 'greaterThan':
          query = query.gt(column, value);
          break;
        case 'lessThan':
          query = query.lt(column, value);
          break;
        case 'greaterOrEqual':
          query = query.gte(column, value);
          break;
        case 'lessOrEqual':
          query = query.lte(column, value);
          break;
        case 'between':
          query = query.gte(column, value).lte(column, condition.value2);
          break;
        case 'isEmpty':
          query = query.is(column, null);
          break;
        case 'isNotEmpty':
          query = query.not(column, 'is', null);
          break;
      }
    }
  }
  
  return query;
}

// Apply sorting to query
function applySorting(query: any, sortConfigs: SortConfig[]): any {
  if (!sortConfigs || sortConfigs.length === 0) return query;
  
  // Sort by priority
  const sorted = [...sortConfigs].sort((a, b) => a.priority - b.priority);
  
  for (const sort of sorted) {
    query = query.order(sort.column, { ascending: sort.direction === 'asc' });
  }
  
  return query;
}

// Calculate calculated field value
function calculateFieldValue(row: Record<string, any>, calcField: CalculatedField): number | null {
  const values = calcField.columns.map(col => {
    const val = row[col];
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  });
  
  if (values.length === 0) return null;
  
  switch (calcField.operation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'difference':
      return values.reduce((a, b) => a - b);
    case 'multiply':
      return values.reduce((a, b) => a * b, 1);
    case 'divide':
      if (values.length < 2 || values[1] === 0) return null;
      return values[0] / values[1];
    case 'average':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'percentage':
      if (values.length < 2 || values[1] === 0) return null;
      return (values[0] / values[1]) * 100;
    default:
      return null;
  }
}

// Main table definitions for dynamic queries
const TABLE_JOINS: Record<string, string> = {
  'lots': 'suppliers!lots_supplier_id_fkey(name, code), catalog_items!lots_catalog_item_id_fkey(lastro_sku_code, type)',
  'incoming_stock': 'suppliers!incoming_stock_supplier_id_fkey(name, code), catalog_items!incoming_stock_catalog_item_id_fkey(lastro_sku_code)',
  'manufacturing_orders': 'suppliers!manufacturing_orders_supplier_id_fkey(name, code), catalog_items!manufacturing_orders_catalog_item_id_fkey(lastro_sku_code)',
  'reservations': 'reservation_lines(quality, color, reserved_meters, scope)',
  'orders': 'order_lots(id, roll_count, quality, color)',
};

// Legacy report type definitions (for backward compatibility)
const REPORT_CONFIGS: Record<string, {
  title: string;
  titleTr: string;
  sheetName: string;
}> = {
  inventory_stock: { title: 'Inventory Stock Report', titleTr: 'Envanter Stok Raporu', sheetName: 'Inventory Stock' },
  inventory_position: { title: 'Inventory Position Report', titleTr: 'Envanter Pozisyon Raporu', sheetName: 'Inventory Position' },
  inventory_aging: { title: 'Inventory Aging Report', titleTr: 'Envanter Yaşlanma Raporu', sheetName: 'Inventory Aging' },
  incoming_stock: { title: 'Incoming Stock Report', titleTr: 'Gelen Stok Raporu', sheetName: 'Incoming Stock' },
  manufacturing_orders: { title: 'Manufacturing Orders Report', titleTr: 'Üretim Siparişleri Raporu', sheetName: 'Manufacturing Orders' },
  reservations: { title: 'Reservations Report', titleTr: 'Rezervasyonlar Raporu', sheetName: 'Reservations' },
  order_fulfillment: { title: 'Order Fulfillment Report', titleTr: 'Sipariş Karşılama Raporu', sheetName: 'Orders' },
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

    const requestBody: ReportRequest = await req.json();
    const { report_type, format, config_id, filters: legacyFilters, columns: legacyColumns, language = 'en' } = requestBody;

    console.log(`generate-report-attachment: config_id=${config_id}, report_type=${report_type}, format=${format}`);

    let headers: string[] = [];
    let rows: any[][] = [];
    let title = 'Report';
    let sheetName = 'Data';
    let styling: ReportStyling | undefined;
    let columnConfigs: ColumnConfig[] | undefined;

    // Check if we're using a dynamic report config
    if (config_id) {
      // Fetch the dynamic report configuration
      const { data: configData, error: configError } = await supabase
        .from("email_report_configs")
        .select("*")
        .eq("id", config_id)
        .maybeSingle();
      
      if (configError) {
        console.error("Error fetching report config:", configError);
        throw configError;
      }
      
      if (!configData) {
        throw new Error(`Report configuration not found: ${config_id}`);
      }

      const config = configData as DynamicReportConfig;
      console.log(`Dynamic report config loaded: ${config.name}, data_source: ${config.data_source}`);

      title = config.name;
      sheetName = config.name.substring(0, 31);
      styling = config.styling;
      columnConfigs = config.columns_config || [];

      // Build column selection string
      const columnKeys = columnConfigs.map(c => c.key);
      
      // Add join columns if needed
      let selectStr = columnKeys.join(', ');
      const joinStr = TABLE_JOINS[config.data_source];
      if (joinStr && config.selected_joins?.length) {
        selectStr += `, ${joinStr}`;
      }

      // Build the query
      let query = supabase.from(config.data_source).select(selectStr);

      // Apply filters
      if (config.filters && config.filters.length > 0) {
        query = applyFilters(query, config.filters, columnConfigs);
      }

      // Get sorting from columns_config or separate sorting config
      const sortConfigs: SortConfig[] = [];
      if (configData.sorting && Array.isArray(configData.sorting)) {
        sortConfigs.push(...configData.sorting);
      }
      
      if (sortConfigs.length > 0) {
        query = applySorting(query, sortConfigs);
      }

      // Execute query
      const { data: queryData, error: queryError } = await query;
      
      if (queryError) {
        console.error("Query error:", queryError);
        throw queryError;
      }

      console.log(`Query returned ${(queryData || []).length} rows`);

      // Build headers from column configs
      headers = columnConfigs.map(col => 
        col.displayLabel || (language === 'tr' ? col.labelTr : col.labelEn) || col.key
      );

      // Add calculated field headers
      const calculatedFields = config.calculated_fields || [];
      for (const calcField of calculatedFields) {
        headers.push(calcField.name);
      }

      // Build rows
      rows = (queryData || []).map((row: any) => {
        const rowData: any[] = columnConfigs!.map(col => {
          // Handle joined data (nested objects)
          if (col.table !== config.data_source) {
            // This is a joined column, try to find it in nested objects
            for (const key of Object.keys(row)) {
              if (typeof row[key] === 'object' && row[key] !== null) {
                if (row[key][col.key] !== undefined) {
                  return row[key][col.key];
                }
              }
            }
          }
          return row[col.key];
        });

        // Add calculated field values
        for (const calcField of calculatedFields) {
          const value = calculateFieldValue(row, calcField);
          if (calcField.format === 'percentage' && value !== null) {
            rowData.push(`${value.toFixed(calcField.decimals || 2)}%`);
          } else if (value !== null) {
            rowData.push(Number(value.toFixed(calcField.decimals || 2)));
          } else {
            rowData.push('');
          }
        }

        return rowData;
      });

    } else if (report_type) {
      // Legacy report type handling (backward compatibility)
      const reportConfig = REPORT_CONFIGS[report_type];
      title = language === 'tr' ? (reportConfig?.titleTr || 'Rapor') : (reportConfig?.title || 'Report');
      sheetName = reportConfig?.sheetName || 'Data';

      // ... existing legacy report generation logic
      switch (report_type) {
        case 'inventory_stock':
        case 'inventory_position': {
          const { data: stockData, error } = await supabase.rpc("get_inventory_pivot_summary");
          if (error) throw error;

          if (report_type === 'inventory_stock') {
            headers = language === 'tr' 
              ? ['Kalite', 'Renk', 'Stokta (m)', 'Top', 'Rezerve (m)', 'Kullanılabilir (m)']
              : ['Quality', 'Color', 'In Stock (m)', 'Rolls', 'Reserved (m)', 'Available (m)'];
            rows = (stockData || []).map((item: any) => [
              item.quality,
              item.color,
              Number(item.total_meters || 0),
              Number(item.total_rolls || 0),
              Number(item.total_reserved_meters || 0),
              Number(item.available_meters || 0),
            ]);
          } else {
            headers = language === 'tr'
              ? ['Kalite', 'Renk', 'Stokta', 'Gelen', 'Rezerve', 'Kullanılabilir']
              : ['Quality', 'Color', 'In Stock', 'Incoming', 'Reserved', 'Available'];
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
          headers = language === 'tr'
            ? ['Kalite', 'Renk', 'Giriş Tarihi', 'Stoktaki Gün', 'Metre', 'Top', 'Yaş Aralığı']
            : ['Quality', 'Color', 'Entry Date', 'Days in Stock', 'Meters', 'Rolls', 'Age Bracket'];
          rows = (lotsData || []).map((lot: any) => {
            const entryDate = new Date(lot.entry_date);
            const daysInStock = Math.ceil((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
            let ageBracket = language === 'tr' ? '0-30 gün' : '0-30 days';
            if (daysInStock > 90) ageBracket = language === 'tr' ? '90+ gün' : '90+ days';
            else if (daysInStock > 60) ageBracket = language === 'tr' ? '61-90 gün' : '61-90 days';
            else if (daysInStock > 30) ageBracket = language === 'tr' ? '31-60 gün' : '31-60 days';
            
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

          headers = language === 'tr'
            ? ['Kalite', 'Renk', 'Tedarikçi', 'Beklenen (m)', 'Alınan (m)', 'Kalan (m)', 'Beklenen Tarih', 'Durum']
            : ['Quality', 'Color', 'Supplier', 'Expected (m)', 'Received (m)', 'Remaining (m)', 'Expected Date', 'Status'];
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

          headers = language === 'tr'
            ? ['ÜS #', 'Kalite', 'Renk', 'Miktar (m)', 'Sipariş Tarihi', 'Beklenen Tarih', 'Durum', 'Tedarikçi']
            : ['MO #', 'Quality', 'Color', 'Amount (m)', 'Order Date', 'Expected Date', 'Status', 'Supplier'];
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

          headers = language === 'tr'
            ? ['Rezervasyon #', 'Müşteri', 'Kalite', 'Renk', 'Rezerve (m)', 'Rezervasyon Tarihi', 'Durum']
            : ['Reservation #', 'Customer', 'Quality', 'Color', 'Reserved (m)', 'Reserved Date', 'Status'];
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

          headers = language === 'tr'
            ? ['Sipariş #', 'Müşteri', 'Satırlar', 'Top', 'Oluşturulma', 'Karşılanma', 'Durum']
            : ['Order #', 'Customer', 'Lines', 'Rolls', 'Created', 'Fulfilled', 'Status'];
          rows = (orderData || []).map((order: any) => {
            const totalRolls = (order.order_lots || []).reduce((sum: number, lot: any) => sum + (lot.roll_count || 0), 0);
            return [
              order.order_number,
              order.customer_name || 'N/A',
              (order.order_lots || []).length,
              totalRolls,
              new Date(order.created_at).toISOString().split('T')[0],
              order.fulfilled_at ? new Date(order.fulfilled_at).toISOString().split('T')[0] : (language === 'tr' ? 'Bekliyor' : 'Pending'),
              order.fulfilled_at ? (language === 'tr' ? 'Karşılandı' : 'Fulfilled') : (language === 'tr' ? 'Bekliyor' : 'Pending'),
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
    } else {
      return new Response(
        JSON.stringify({ error: "Either config_id or report_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`generate-report-attachment: Generated ${rows.length} rows`);

    let content: string | null = null;
    let binaryContent: Uint8Array | null = null;
    let contentType: string;
    let filename: string;
    let isBase64 = false;
    const dateStr = new Date().toISOString().split('T')[0];
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    switch (format) {
      case 'excel': {
        // Generate real .xlsx file
        const excelBuffer = generateExcelBuffer(headers, rows, sheetName, styling, columnConfigs);
        binaryContent = excelBuffer;
        isBase64 = true;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${safeTitle}_${dateStr}.xlsx`;
        break;
      }
      case 'csv':
        content = generateCSV(headers, rows);
        contentType = 'text/csv';
        filename = `${safeTitle}_${dateStr}.csv`;
        break;
      case 'html':
        content = generateHTMLTable(headers, rows, title, styling, columnConfigs, styling?.conditionalRules);
        contentType = 'text/html';
        filename = `${safeTitle}_${dateStr}.html`;
        break;
      case 'pdf': {
        // Generate HTML for PDF (simpler styling for print)
        const pdfHtml = generatePDFHTML(headers, rows, title, styling, columnConfigs);
        content = pdfHtml;
        contentType = 'text/html'; // Return HTML that can be printed as PDF
        filename = `${safeTitle}_${dateStr}.html`;
        break;
      }
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
        filename = `${safeTitle}_${dateStr}.json`;
        break;
    }

    // Convert binary content to base64 for JSON response
    let responseContent: string;
    if (binaryContent) {
      // Convert Uint8Array to base64
      let binary = '';
      for (let i = 0; i < binaryContent.length; i++) {
        binary += String.fromCharCode(binaryContent[i]);
      }
      responseContent = btoa(binary);
    } else {
      responseContent = content!;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        content: responseContent,
        content_type: contentType,
        filename,
        row_count: rows.length,
        title,
        is_base64: isBase64,
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
