import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ColumnDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'currency' | 'boolean';
  table: string;
}

interface TableRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one';
}

interface DataSourceDefinition {
  key: string;
  labelEn: string;
  labelTr: string;
  descriptionEn: string;
  descriptionTr: string;
  columns: ColumnDefinition[];
  joins?: {
    table: string;
    labelEn: string;
    labelTr: string;
    joinColumn: string;
    foreignColumn: string;
  }[];
}

// Define the relationship graph between tables
const RELATIONSHIPS: TableRelationship[] = [
  // lots relationships
  { fromTable: 'lots', fromColumn: 'supplier_id', toTable: 'suppliers', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'lots', fromColumn: 'catalog_item_id', toTable: 'catalog_items', toColumn: 'id', type: 'many-to-one' },
  
  // incoming_stock relationships
  { fromTable: 'incoming_stock', fromColumn: 'supplier_id', toTable: 'suppliers', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'incoming_stock', fromColumn: 'catalog_item_id', toTable: 'catalog_items', toColumn: 'id', type: 'many-to-one' },
  
  // reservation_lines relationships
  { fromTable: 'reservation_lines', fromColumn: 'reservation_id', toTable: 'reservations', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'reservation_lines', fromColumn: 'lot_id', toTable: 'lots', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'reservation_lines', fromColumn: 'incoming_stock_id', toTable: 'incoming_stock', toColumn: 'id', type: 'many-to-one' },
  
  // manufacturing_orders relationships
  { fromTable: 'manufacturing_orders', fromColumn: 'supplier_id', toTable: 'suppliers', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'manufacturing_orders', fromColumn: 'catalog_item_id', toTable: 'catalog_items', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'manufacturing_orders', fromColumn: 'reservation_id', toTable: 'reservations', toColumn: 'id', type: 'many-to-one' },
  
  // catalog_item_suppliers relationships
  { fromTable: 'catalog_item_suppliers', fromColumn: 'catalog_item_id', toTable: 'catalog_items', toColumn: 'id', type: 'many-to-one' },
  
  // demand_history - standalone, no direct FK relationships to core tables
  
  // rolls relationships
  { fromTable: 'rolls', fromColumn: 'lot_id', toTable: 'lots', toColumn: 'id', type: 'many-to-one' },
  
  // goods_in_receipts relationships
  { fromTable: 'goods_in_receipts', fromColumn: 'incoming_stock_id', toTable: 'incoming_stock', toColumn: 'id', type: 'many-to-one' },
  
  // goods_in_rows relationships
  { fromTable: 'goods_in_rows', fromColumn: 'receipt_id', toTable: 'goods_in_receipts', toColumn: 'id', type: 'many-to-one' },
  { fromTable: 'goods_in_rows', fromColumn: 'lot_id', toTable: 'lots', toColumn: 'id', type: 'many-to-one' },
];

// Define all available tables with their columns
const ALL_TABLE_COLUMNS: Record<string, ColumnDefinition[]> = {
  lots: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'lots' },
    { key: 'lot_number', labelEn: 'Lot Number', labelTr: 'Lot Numarası', type: 'text', table: 'lots' },
    { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', table: 'lots' },
    { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', table: 'lots' },
    { key: 'meters', labelEn: 'Meters', labelTr: 'Metre', type: 'number', table: 'lots' },
    { key: 'roll_count', labelEn: 'Roll Count', labelTr: 'Top Sayısı', type: 'number', table: 'lots' },
    { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', table: 'lots' },
    { key: 'entry_date', labelEn: 'Entry Date', labelTr: 'Giriş Tarihi', type: 'date', table: 'lots' },
    { key: 'production_date', labelEn: 'Production Date', labelTr: 'Üretim Tarihi', type: 'date', table: 'lots' },
    { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'lots' },
    { key: 'warehouse_location', labelEn: 'Warehouse Location', labelTr: 'Depo Konumu', type: 'text', table: 'lots' },
    { key: 'invoice_number', labelEn: 'Invoice Number', labelTr: 'Fatura Numarası', type: 'text', table: 'lots' },
    { key: 'invoice_date', labelEn: 'Invoice Date', labelTr: 'Fatura Tarihi', type: 'date', table: 'lots' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'lots' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'lots' },
  ],
  incoming_stock: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'incoming_stock' },
    { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', table: 'incoming_stock' },
    { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', table: 'incoming_stock' },
    { key: 'expected_meters', labelEn: 'Expected Meters', labelTr: 'Beklenen Metre', type: 'number', table: 'incoming_stock' },
    { key: 'received_meters', labelEn: 'Received Meters', labelTr: 'Alınan Metre', type: 'number', table: 'incoming_stock' },
    { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', table: 'incoming_stock' },
    { key: 'expected_arrival_date', labelEn: 'Expected Arrival', labelTr: 'Beklenen Varış', type: 'date', table: 'incoming_stock' },
    { key: 'invoice_number', labelEn: 'Invoice Number', labelTr: 'Fatura Numarası', type: 'text', table: 'incoming_stock' },
    { key: 'invoice_date', labelEn: 'Invoice Date', labelTr: 'Fatura Tarihi', type: 'date', table: 'incoming_stock' },
    { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'incoming_stock' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'incoming_stock' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'incoming_stock' },
  ],
  reservations: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'reservations' },
    { key: 'reservation_number', labelEn: 'Reservation Number', labelTr: 'Rezervasyon Numarası', type: 'text', table: 'reservations' },
    { key: 'customer_name', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'reservations' },
    { key: 'reserved_date', labelEn: 'Reserved Date', labelTr: 'Rezervasyon Tarihi', type: 'date', table: 'reservations' },
    { key: 'expiry_date', labelEn: 'Expiry Date', labelTr: 'Son Kullanma Tarihi', type: 'date', table: 'reservations' },
    { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'reservations' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'reservations' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'reservations' },
  ],
  reservation_lines: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'reservation_lines' },
    { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', table: 'reservation_lines' },
    { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', table: 'reservation_lines' },
    { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', table: 'reservation_lines' },
    { key: 'scope', labelEn: 'Scope', labelTr: 'Kapsam', type: 'text', table: 'reservation_lines' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'reservation_lines' },
  ],
  manufacturing_orders: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'manufacturing_orders' },
    { key: 'mo_number', labelEn: 'MO Number', labelTr: 'ÜS Numarası', type: 'text', table: 'manufacturing_orders' },
    { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', table: 'manufacturing_orders' },
    { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', table: 'manufacturing_orders' },
    { key: 'ordered_amount', labelEn: 'Ordered Amount', labelTr: 'Sipariş Miktarı', type: 'number', table: 'manufacturing_orders' },
    { key: 'order_date', labelEn: 'Order Date', labelTr: 'Sipariş Tarihi', type: 'date', table: 'manufacturing_orders' },
    { key: 'expected_completion_date', labelEn: 'Expected Completion', labelTr: 'Beklenen Tamamlanma', type: 'date', table: 'manufacturing_orders' },
    { key: 'customer_agreed_date', labelEn: 'Customer Agreed Date', labelTr: 'Müşteri Anlaşma Tarihi', type: 'date', table: 'manufacturing_orders' },
    { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'manufacturing_orders' },
    { key: 'customer_name', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'manufacturing_orders' },
    { key: 'is_customer_order', labelEn: 'Is Customer Order', labelTr: 'Müşteri Siparişi Mi', type: 'boolean', table: 'manufacturing_orders' },
    { key: 'price_per_meter', labelEn: 'Price per Meter', labelTr: 'Metre Başına Fiyat', type: 'currency', table: 'manufacturing_orders' },
    { key: 'currency', labelEn: 'Currency', labelTr: 'Para Birimi', type: 'text', table: 'manufacturing_orders' },
    { key: 'supplier_confirmation_number', labelEn: 'Supplier Confirmation', labelTr: 'Tedarikçi Onayı', type: 'text', table: 'manufacturing_orders' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'manufacturing_orders' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'manufacturing_orders' },
  ],
  orders: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'orders' },
    { key: 'order_number', labelEn: 'Order Number', labelTr: 'Sipariş Numarası', type: 'text', table: 'orders' },
    { key: 'customer_name', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'orders' },
    { key: 'total_lots', labelEn: 'Total Lots', labelTr: 'Toplam Lot', type: 'number', table: 'orders' },
    { key: 'total_rolls', labelEn: 'Total Rolls', labelTr: 'Toplam Top', type: 'number', table: 'orders' },
    { key: 'total_meters', labelEn: 'Total Meters', labelTr: 'Toplam Metre', type: 'number', table: 'orders' },
    { key: 'fulfilled_at', labelEn: 'Fulfilled At', labelTr: 'Karşılanma Tarihi', type: 'date', table: 'orders' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'orders' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'orders' },
  ],
  suppliers: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'suppliers' },
    { key: 'name', labelEn: 'Name', labelTr: 'Ad', type: 'text', table: 'suppliers' },
    { key: 'code', labelEn: 'Code', labelTr: 'Kod', type: 'text', table: 'suppliers' },
    { key: 'contact_person', labelEn: 'Contact Person', labelTr: 'İlgili Kişi', type: 'text', table: 'suppliers' },
    { key: 'email', labelEn: 'Email', labelTr: 'E-posta', type: 'text', table: 'suppliers' },
    { key: 'phone', labelEn: 'Phone', labelTr: 'Telefon', type: 'text', table: 'suppliers' },
    { key: 'address', labelEn: 'Address', labelTr: 'Adres', type: 'text', table: 'suppliers' },
    { key: 'country', labelEn: 'Country', labelTr: 'Ülke', type: 'text', table: 'suppliers' },
    { key: 'is_active', labelEn: 'Is Active', labelTr: 'Aktif Mi', type: 'boolean', table: 'suppliers' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'suppliers' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'suppliers' },
  ],
  catalog_items: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'catalog_items' },
    { key: 'lastro_sku_code', labelEn: 'Lastro SKU', labelTr: 'Lastro SKU', type: 'text', table: 'catalog_items' },
    { key: 'logo_sku_code', labelEn: 'Logo SKU', labelTr: 'Logo SKU', type: 'text', table: 'catalog_items' },
    { key: 'code', labelEn: 'Code', labelTr: 'Kod', type: 'text', table: 'catalog_items' },
    { key: 'color_name', labelEn: 'Color Name', labelTr: 'Renk Adı', type: 'text', table: 'catalog_items' },
    { key: 'type', labelEn: 'Type', labelTr: 'Tip', type: 'text', table: 'catalog_items' },
    { key: 'fabric_type', labelEn: 'Fabric Type', labelTr: 'Kumaş Tipi', type: 'text', table: 'catalog_items' },
    { key: 'weight_g_m2', labelEn: 'Weight (g/m²)', labelTr: 'Ağırlık (g/m²)', type: 'number', table: 'catalog_items' },
    { key: 'weaving_knitted', labelEn: 'Weaving/Knitted', labelTr: 'Dokuma/Örme', type: 'text', table: 'catalog_items' },
    { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'catalog_items' },
    { key: 'is_active', labelEn: 'Is Active', labelTr: 'Aktif Mi', type: 'boolean', table: 'catalog_items' },
    { key: 'eu_origin', labelEn: 'EU Origin', labelTr: 'AB Menşei', type: 'boolean', table: 'catalog_items' },
    { key: 'description', labelEn: 'Description', labelTr: 'Açıklama', type: 'text', table: 'catalog_items' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'catalog_items' },
  ],
  audit_logs: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'audit_logs' },
    { key: 'action', labelEn: 'Action', labelTr: 'Eylem', type: 'text', table: 'audit_logs' },
    { key: 'entity_type', labelEn: 'Entity Type', labelTr: 'Varlık Tipi', type: 'text', table: 'audit_logs' },
    { key: 'entity_identifier', labelEn: 'Entity Identifier', labelTr: 'Varlık Tanımlayıcı', type: 'text', table: 'audit_logs' },
    { key: 'user_email', labelEn: 'User Email', labelTr: 'Kullanıcı E-posta', type: 'text', table: 'audit_logs' },
    { key: 'user_role', labelEn: 'User Role', labelTr: 'Kullanıcı Rolü', type: 'text', table: 'audit_logs' },
    { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'audit_logs' },
    { key: 'is_reversed', labelEn: 'Is Reversed', labelTr: 'Geri Alındı Mı', type: 'boolean', table: 'audit_logs' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'audit_logs' },
  ],
  demand_history: [
    { key: 'id', labelEn: 'ID', labelTr: 'ID', type: 'text', table: 'demand_history' },
    { key: 'quality_code', labelEn: 'Quality Code', labelTr: 'Kalite Kodu', type: 'text', table: 'demand_history' },
    { key: 'color_code', labelEn: 'Color Code', labelTr: 'Renk Kodu', type: 'text', table: 'demand_history' },
    { key: 'amount', labelEn: 'Amount', labelTr: 'Miktar', type: 'number', table: 'demand_history' },
    { key: 'unit', labelEn: 'Unit', labelTr: 'Birim', type: 'text', table: 'demand_history' },
    { key: 'demand_date', labelEn: 'Demand Date', labelTr: 'Talep Tarihi', type: 'date', table: 'demand_history' },
    { key: 'document_status', labelEn: 'Document Status', labelTr: 'Belge Durumu', type: 'text', table: 'demand_history' },
    { key: 'source', labelEn: 'Source', labelTr: 'Kaynak', type: 'text', table: 'demand_history' },
    { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'demand_history' },
  ],
};

// Table metadata for display
const TABLE_METADATA: Record<string, { labelEn: string; labelTr: string; descriptionEn: string; descriptionTr: string }> = {
  lots: { labelEn: 'Inventory Lots', labelTr: 'Envanter Lotları', descriptionEn: 'Physical stock lots in warehouse', descriptionTr: 'Depodaki fiziksel stok lotları' },
  incoming_stock: { labelEn: 'Incoming Stock', labelTr: 'Gelen Stok', descriptionEn: 'Expected deliveries and pending arrivals', descriptionTr: 'Beklenen teslimatlar' },
  reservations: { labelEn: 'Reservations', labelTr: 'Rezervasyonlar', descriptionEn: 'Customer reservations', descriptionTr: 'Müşteri rezervasyonları' },
  reservation_lines: { labelEn: 'Reservation Lines', labelTr: 'Rezervasyon Satırları', descriptionEn: 'Individual reservation line items', descriptionTr: 'Rezervasyon satır öğeleri' },
  manufacturing_orders: { labelEn: 'Manufacturing Orders', labelTr: 'Üretim Siparişleri', descriptionEn: 'Production orders', descriptionTr: 'Üretim siparişleri' },
  orders: { labelEn: 'Orders', labelTr: 'Siparişler', descriptionEn: 'Customer orders', descriptionTr: 'Müşteri siparişleri' },
  suppliers: { labelEn: 'Suppliers', labelTr: 'Tedarikçiler', descriptionEn: 'Supplier information', descriptionTr: 'Tedarikçi bilgileri' },
  catalog_items: { labelEn: 'Catalog Items', labelTr: 'Katalog Ürünleri', descriptionEn: 'Product catalog', descriptionTr: 'Ürün kataloğu' },
  audit_logs: { labelEn: 'Audit Logs', labelTr: 'Denetim Kayıtları', descriptionEn: 'System activity logs', descriptionTr: 'Sistem aktivite kayıtları' },
  demand_history: { labelEn: 'Demand History', labelTr: 'Talep Geçmişi', descriptionEn: 'Historical demand data', descriptionTr: 'Geçmiş talep verileri' },
};

// BFS algorithm to find shortest path between tables
function findJoinPath(fromTables: string[], toTable: string): TableRelationship[] | null {
  if (fromTables.includes(toTable)) return [];
  
  const visited = new Set<string>(fromTables);
  const queue: { table: string; path: TableRelationship[] }[] = fromTables.map(t => ({ table: t, path: [] }));
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    // Find all relationships from current table
    const outgoing = RELATIONSHIPS.filter(r => r.fromTable === current.table);
    const incoming = RELATIONSHIPS.filter(r => r.toTable === current.table);
    
    for (const rel of outgoing) {
      if (rel.toTable === toTable) {
        return [...current.path, rel];
      }
      if (!visited.has(rel.toTable)) {
        visited.add(rel.toTable);
        queue.push({ table: rel.toTable, path: [...current.path, rel] });
      }
    }
    
    for (const rel of incoming) {
      if (rel.fromTable === toTable) {
        // Reverse the relationship direction
        const reversedRel: TableRelationship = {
          fromTable: rel.toTable,
          fromColumn: rel.toColumn,
          toTable: rel.fromTable,
          toColumn: rel.fromColumn,
          type: rel.type === 'many-to-one' ? 'one-to-many' : 'many-to-one',
        };
        return [...current.path, reversedRel];
      }
      if (!visited.has(rel.fromTable)) {
        visited.add(rel.fromTable);
        const reversedRel: TableRelationship = {
          fromTable: rel.toTable,
          fromColumn: rel.toColumn,
          toTable: rel.fromTable,
          toColumn: rel.fromColumn,
          type: rel.type === 'many-to-one' ? 'one-to-many' : 'many-to-one',
        };
        queue.push({ table: rel.fromTable, path: [...current.path, reversedRel] });
      }
    }
  }
  
  return null; // No path found
}

// Check if tables can be joined together
function canJoinTables(tables: string[]): { canJoin: boolean; joinPath: TableRelationship[]; error?: string } {
  if (tables.length <= 1) {
    return { canJoin: true, joinPath: [] };
  }
  
  const fullPath: TableRelationship[] = [];
  const connectedTables = [tables[0]];
  
  for (let i = 1; i < tables.length; i++) {
    const path = findJoinPath(connectedTables, tables[i]);
    if (!path) {
      return { 
        canJoin: false, 
        joinPath: [], 
        error: `Cannot join ${tables[i]} with ${connectedTables.join(', ')} - no relationship exists` 
      };
    }
    fullPath.push(...path);
    connectedTables.push(tables[i]);
  }
  
  return { canJoin: true, joinPath: fullPath };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') ?? '' },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse from body or query params
    const url = new URL(req.url);
    let mode = url.searchParams.get('mode');
    let selectedTables = url.searchParams.get('tables')?.split(',').filter(Boolean) || [];
    let checkTable = url.searchParams.get('checkTable');
    
    // If POST request, also check body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.mode) mode = body.mode;
        if (body.tables) selectedTables = body.tables;
        if (body.checkTable) checkTable = body.checkTable;
      } catch {
        // Body parsing failed, use query params
      }
    }
    
    console.log('Request params:', { mode, selectedTables, checkTable });

    // Mode: getAllColumnsWithRelationships - Return all columns grouped by table with relationship info
    if (mode === 'getAllColumnsWithRelationships') {
      const allTables = Object.entries(ALL_TABLE_COLUMNS).map(([tableName, columns]) => ({
        table: tableName,
        ...TABLE_METADATA[tableName],
        columns: columns,
        columnCount: columns.length,
      }));

      return new Response(
        JSON.stringify({
          tables: allTables,
          relationships: RELATIONSHIPS,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mode: validateColumnCompatibility - Check if a new table can join with existing selection
    if (mode === 'validateColumnCompatibility' && checkTable) {
      const tablesToCheck = [...selectedTables, checkTable];
      const result = canJoinTables(tablesToCheck);
      
      return new Response(
        JSON.stringify({
          canJoin: result.canJoin,
          joinPath: result.joinPath,
          error: result.error,
          tables: tablesToCheck,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mode: getJoinPath - Get the full join path for selected tables
    if (mode === 'getJoinPath' && selectedTables.length > 0) {
      const result = canJoinTables(selectedTables);
      
      return new Response(
        JSON.stringify({
          canJoin: result.canJoin,
          joinPath: result.joinPath,
          error: result.error,
          tables: selectedTables,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mode: getColumnsForTables - Get columns for specific tables
    if (mode === 'getColumnsForTables' && selectedTables.length > 0) {
      const columns: ColumnDefinition[] = [];
      for (const table of selectedTables) {
        if (ALL_TABLE_COLUMNS[table]) {
          columns.push(...ALL_TABLE_COLUMNS[table]);
        }
      }
      
      const result = canJoinTables(selectedTables);
      
      return new Response(
        JSON.stringify({
          columns,
          canJoin: result.canJoin,
          joinPath: result.joinPath,
          error: result.error,
          tables: selectedTables,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default: Return all available tables summary (for backward compatibility)
    const dataSources = Object.entries(ALL_TABLE_COLUMNS).map(([tableName, columns]) => ({
      key: tableName,
      ...TABLE_METADATA[tableName],
      columnCount: columns.length,
      hasJoins: RELATIONSHIPS.some(r => r.fromTable === tableName || r.toTable === tableName),
    }));

    return new Response(
      JSON.stringify({
        dataSources,
        relationships: RELATIONSHIPS,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-report-schema:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
