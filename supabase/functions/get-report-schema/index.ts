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

// Define available data sources with their columns
const DATA_SOURCES: DataSourceDefinition[] = [
  {
    key: 'lots',
    labelEn: 'Inventory Lots',
    labelTr: 'Envanter Lotları',
    descriptionEn: 'Physical stock lots in warehouse',
    descriptionTr: 'Depodaki fiziksel stok lotları',
    columns: [
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
    joins: [
      { table: 'suppliers', labelEn: 'Supplier', labelTr: 'Tedarikçi', joinColumn: 'supplier_id', foreignColumn: 'id' },
      { table: 'catalog_items', labelEn: 'Catalog Item', labelTr: 'Katalog Ürünü', joinColumn: 'catalog_item_id', foreignColumn: 'id' },
    ],
  },
  {
    key: 'incoming_stock',
    labelEn: 'Incoming Stock',
    labelTr: 'Gelen Stok',
    descriptionEn: 'Expected deliveries and pending arrivals',
    descriptionTr: 'Beklenen teslimatlar ve bekleyen gelenler',
    columns: [
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
    joins: [
      { table: 'suppliers', labelEn: 'Supplier', labelTr: 'Tedarikçi', joinColumn: 'supplier_id', foreignColumn: 'id' },
      { table: 'catalog_items', labelEn: 'Catalog Item', labelTr: 'Katalog Ürünü', joinColumn: 'catalog_item_id', foreignColumn: 'id' },
    ],
  },
  {
    key: 'reservations',
    labelEn: 'Reservations',
    labelTr: 'Rezervasyonlar',
    descriptionEn: 'Customer reservations and their lines',
    descriptionTr: 'Müşteri rezervasyonları ve satırları',
    columns: [
      { key: 'reservation_number', labelEn: 'Reservation Number', labelTr: 'Rezervasyon Numarası', type: 'text', table: 'reservations' },
      { key: 'customer_name', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'reservations' },
      { key: 'reserved_date', labelEn: 'Reserved Date', labelTr: 'Rezervasyon Tarihi', type: 'date', table: 'reservations' },
      { key: 'expiry_date', labelEn: 'Expiry Date', labelTr: 'Son Kullanma Tarihi', type: 'date', table: 'reservations' },
      { key: 'status', labelEn: 'Status', labelTr: 'Durum', type: 'text', table: 'reservations' },
      { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'reservations' },
      { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'reservations' },
    ],
    joins: [
      { table: 'reservation_lines', labelEn: 'Reservation Lines', labelTr: 'Rezervasyon Satırları', joinColumn: 'id', foreignColumn: 'reservation_id' },
    ],
  },
  {
    key: 'reservation_lines',
    labelEn: 'Reservation Lines',
    labelTr: 'Rezervasyon Satırları',
    descriptionEn: 'Individual reservation line items',
    descriptionTr: 'Bireysel rezervasyon satır öğeleri',
    columns: [
      { key: 'quality', labelEn: 'Quality', labelTr: 'Kalite', type: 'text', table: 'reservation_lines' },
      { key: 'color', labelEn: 'Color', labelTr: 'Renk', type: 'text', table: 'reservation_lines' },
      { key: 'reserved_meters', labelEn: 'Reserved Meters', labelTr: 'Rezerve Metre', type: 'number', table: 'reservation_lines' },
      { key: 'scope', labelEn: 'Scope', labelTr: 'Kapsam', type: 'text', table: 'reservation_lines' },
      { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'reservation_lines' },
    ],
    joins: [
      { table: 'reservations', labelEn: 'Reservation', labelTr: 'Rezervasyon', joinColumn: 'reservation_id', foreignColumn: 'id' },
      { table: 'lots', labelEn: 'Lot', labelTr: 'Lot', joinColumn: 'lot_id', foreignColumn: 'id' },
      { table: 'incoming_stock', labelEn: 'Incoming Stock', labelTr: 'Gelen Stok', joinColumn: 'incoming_stock_id', foreignColumn: 'id' },
    ],
  },
  {
    key: 'manufacturing_orders',
    labelEn: 'Manufacturing Orders',
    labelTr: 'Üretim Siparişleri',
    descriptionEn: 'Production orders and their status',
    descriptionTr: 'Üretim siparişleri ve durumları',
    columns: [
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
    joins: [
      { table: 'suppliers', labelEn: 'Supplier', labelTr: 'Tedarikçi', joinColumn: 'supplier_id', foreignColumn: 'id' },
      { table: 'catalog_items', labelEn: 'Catalog Item', labelTr: 'Katalog Ürünü', joinColumn: 'catalog_item_id', foreignColumn: 'id' },
      { table: 'reservations', labelEn: 'Reservation', labelTr: 'Rezervasyon', joinColumn: 'reservation_id', foreignColumn: 'id' },
    ],
  },
  {
    key: 'orders',
    labelEn: 'Orders',
    labelTr: 'Siparişler',
    descriptionEn: 'Customer orders and fulfillment',
    descriptionTr: 'Müşteri siparişleri ve karşılama',
    columns: [
      { key: 'order_number', labelEn: 'Order Number', labelTr: 'Sipariş Numarası', type: 'text', table: 'orders' },
      { key: 'customer_name', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'orders' },
      { key: 'total_lots', labelEn: 'Total Lots', labelTr: 'Toplam Lot', type: 'number', table: 'orders' },
      { key: 'total_rolls', labelEn: 'Total Rolls', labelTr: 'Toplam Top', type: 'number', table: 'orders' },
      { key: 'total_meters', labelEn: 'Total Meters', labelTr: 'Toplam Metre', type: 'number', table: 'orders' },
      { key: 'fulfilled_at', labelEn: 'Fulfilled At', labelTr: 'Karşılanma Tarihi', type: 'date', table: 'orders' },
      { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'orders' },
      { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'orders' },
    ],
    joins: [],
  },
  {
    key: 'suppliers',
    labelEn: 'Suppliers',
    labelTr: 'Tedarikçiler',
    descriptionEn: 'Supplier information and contacts',
    descriptionTr: 'Tedarikçi bilgileri ve iletişim',
    columns: [
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
    joins: [],
  },
  {
    key: 'catalog_items',
    labelEn: 'Catalog Items',
    labelTr: 'Katalog Ürünleri',
    descriptionEn: 'Product catalog and specifications',
    descriptionTr: 'Ürün kataloğu ve özellikler',
    columns: [
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
    joins: [],
  },
  {
    key: 'audit_logs',
    labelEn: 'Audit Logs',
    labelTr: 'Denetim Kayıtları',
    descriptionEn: 'System activity and change logs',
    descriptionTr: 'Sistem aktivitesi ve değişiklik kayıtları',
    columns: [
      { key: 'action', labelEn: 'Action', labelTr: 'Eylem', type: 'text', table: 'audit_logs' },
      { key: 'entity_type', labelEn: 'Entity Type', labelTr: 'Varlık Tipi', type: 'text', table: 'audit_logs' },
      { key: 'entity_identifier', labelEn: 'Entity Identifier', labelTr: 'Varlık Tanımlayıcı', type: 'text', table: 'audit_logs' },
      { key: 'user_email', labelEn: 'User Email', labelTr: 'Kullanıcı E-posta', type: 'text', table: 'audit_logs' },
      { key: 'user_role', labelEn: 'User Role', labelTr: 'Kullanıcı Rolü', type: 'text', table: 'audit_logs' },
      { key: 'notes', labelEn: 'Notes', labelTr: 'Notlar', type: 'text', table: 'audit_logs' },
      { key: 'is_reversed', labelEn: 'Is Reversed', labelTr: 'Geri Alındı Mı', type: 'boolean', table: 'audit_logs' },
      { key: 'created_at', labelEn: 'Created At', labelTr: 'Oluşturulma Tarihi', type: 'date', table: 'audit_logs' },
    ],
    joins: [],
  },
];

// Additional columns from joined tables
const JOINED_TABLE_COLUMNS: Record<string, ColumnDefinition[]> = {
  suppliers: [
    { key: 'supplier_name', labelEn: 'Supplier Name', labelTr: 'Tedarikçi Adı', type: 'text', table: 'suppliers' },
    { key: 'supplier_code', labelEn: 'Supplier Code', labelTr: 'Tedarikçi Kodu', type: 'text', table: 'suppliers' },
    { key: 'supplier_contact', labelEn: 'Supplier Contact', labelTr: 'Tedarikçi İletişim', type: 'text', table: 'suppliers' },
    { key: 'supplier_email', labelEn: 'Supplier Email', labelTr: 'Tedarikçi E-posta', type: 'text', table: 'suppliers' },
    { key: 'supplier_country', labelEn: 'Supplier Country', labelTr: 'Tedarikçi Ülke', type: 'text', table: 'suppliers' },
  ],
  catalog_items: [
    { key: 'catalog_sku', labelEn: 'Catalog SKU', labelTr: 'Katalog SKU', type: 'text', table: 'catalog_items' },
    { key: 'catalog_type', labelEn: 'Catalog Type', labelTr: 'Katalog Tipi', type: 'text', table: 'catalog_items' },
    { key: 'catalog_fabric', labelEn: 'Fabric Type', labelTr: 'Kumaş Tipi', type: 'text', table: 'catalog_items' },
    { key: 'catalog_weight', labelEn: 'Weight (g/m²)', labelTr: 'Ağırlık (g/m²)', type: 'number', table: 'catalog_items' },
  ],
  reservations: [
    { key: 'reservation_customer', labelEn: 'Customer Name', labelTr: 'Müşteri Adı', type: 'text', table: 'reservations' },
    { key: 'reservation_status', labelEn: 'Reservation Status', labelTr: 'Rezervasyon Durumu', type: 'text', table: 'reservations' },
    { key: 'reservation_date', labelEn: 'Reservation Date', labelTr: 'Rezervasyon Tarihi', type: 'date', table: 'reservations' },
  ],
};

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
    let dataSourceKey = url.searchParams.get('dataSource');
    let includeJoins = url.searchParams.get('includeJoins') === 'true';
    
    // If POST request, also check body
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.dataSource) dataSourceKey = body.dataSource;
        if (body.includeJoins !== undefined) includeJoins = body.includeJoins === true;
      } catch {
        // Body parsing failed, use query params
      }
    }
    
    console.log('Request params:', { dataSourceKey, includeJoins });

    // If a specific data source is requested, return its columns
    if (dataSourceKey) {
      const dataSource = DATA_SOURCES.find(ds => ds.key === dataSourceKey);
      if (!dataSource) {
        return new Response(
          JSON.stringify({ error: 'Data source not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let columns = [...dataSource.columns];

      // Include columns from joined tables if requested
      if (includeJoins && dataSource.joins) {
        for (const join of dataSource.joins) {
          const joinedColumns = JOINED_TABLE_COLUMNS[join.table];
          if (joinedColumns) {
            columns = [...columns, ...joinedColumns];
          }
        }
      }

      console.log(`Returning schema for data source: ${dataSourceKey}, columns: ${columns.length}`);

      return new Response(
        JSON.stringify({
          dataSource,
          columns,
          availableJoins: dataSource.joins || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return all available data sources
    console.log(`Returning all data sources: ${DATA_SOURCES.length}`);
    
    return new Response(
      JSON.stringify({
        dataSources: DATA_SOURCES.map(ds => ({
          key: ds.key,
          labelEn: ds.labelEn,
          labelTr: ds.labelTr,
          descriptionEn: ds.descriptionEn,
          descriptionTr: ds.descriptionTr,
          columnCount: ds.columns.length,
          hasJoins: (ds.joins?.length || 0) > 0,
        })),
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
