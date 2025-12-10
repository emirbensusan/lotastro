import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationResult {
  success: boolean;
  dryRun: boolean;
  catalogItemsCreated: number;
  lotsLinked: number;
  incomingStockLinked: number;
  manufacturingOrdersLinked: number;
  skippedExisting: number;
  errors: string[];
  details: {
    uniquePairs: number;
    existingCatalogItems: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Client for user auth check
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { dryRun = false } = await req.json().catch(() => ({}));

    console.log(`Starting catalog migration (dryRun: ${dryRun})`);

    const result: MigrationResult = {
      success: true,
      dryRun,
      catalogItemsCreated: 0,
      lotsLinked: 0,
      incomingStockLinked: 0,
      manufacturingOrdersLinked: 0,
      skippedExisting: 0,
      errors: [],
      details: {
        uniquePairs: 0,
        existingCatalogItems: 0,
      },
    };

    // Step 1: Get all existing catalog items
    const { data: existingCatalog, error: catalogError } = await supabase
      .from('catalog_items')
      .select('id, code, color_name');

    if (catalogError) {
      throw new Error(`Failed to fetch existing catalog: ${catalogError.message}`);
    }

    // Create lookup map for existing items
    const existingMap = new Map<string, string>();
    (existingCatalog || []).forEach(item => {
      const key = `${item.code.toLowerCase()}||${item.color_name.toLowerCase()}`;
      existingMap.set(key, item.id);
    });

    result.details.existingCatalogItems = existingMap.size;
    console.log(`Found ${existingMap.size} existing catalog items`);

    // Step 2: Extract unique (quality, color) pairs from all tables
    const uniquePairs = new Map<string, { quality: string; color: string; sources: string[] }>();

    // From lots
    const { data: lotPairs, error: lotError } = await supabase
      .from('lots')
      .select('quality, color')
      .is('catalog_item_id', null);

    if (lotError) {
      result.errors.push(`Failed to fetch lots: ${lotError.message}`);
    } else {
      (lotPairs || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { quality: row.quality, color: row.color, sources: [] });
        }
        if (!uniquePairs.get(key)!.sources.includes('lots')) {
          uniquePairs.get(key)!.sources.push('lots');
        }
      });
    }

    // From incoming_stock
    const { data: incomingPairs, error: incomingError } = await supabase
      .from('incoming_stock')
      .select('quality, color')
      .is('catalog_item_id', null);

    if (incomingError) {
      result.errors.push(`Failed to fetch incoming_stock: ${incomingError.message}`);
    } else {
      (incomingPairs || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { quality: row.quality, color: row.color, sources: [] });
        }
        if (!uniquePairs.get(key)!.sources.includes('incoming_stock')) {
          uniquePairs.get(key)!.sources.push('incoming_stock');
        }
      });
    }

    // From manufacturing_orders
    const { data: moPairs, error: moError } = await supabase
      .from('manufacturing_orders')
      .select('quality, color')
      .is('catalog_item_id', null);

    if (moError) {
      result.errors.push(`Failed to fetch manufacturing_orders: ${moError.message}`);
    } else {
      (moPairs || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!uniquePairs.has(key)) {
          uniquePairs.set(key, { quality: row.quality, color: row.color, sources: [] });
        }
        if (!uniquePairs.get(key)!.sources.includes('manufacturing_orders')) {
          uniquePairs.get(key)!.sources.push('manufacturing_orders');
        }
      });
    }

    result.details.uniquePairs = uniquePairs.size;
    console.log(`Found ${uniquePairs.size} unique (quality, color) pairs to process`);

    // Step 3: Create catalog items and link records
    for (const [key, pair] of uniquePairs) {
      // Check if already exists in catalog
      if (existingMap.has(key)) {
        result.skippedExisting++;
        const catalogItemId = existingMap.get(key)!;
        
        // Still link records to existing catalog item
        if (!dryRun) {
          // Link lots
          const { count: lotsUpdated } = await supabase
            .from('lots')
            .update({ catalog_item_id: catalogItemId })
            .eq('quality', pair.quality)
            .eq('color', pair.color)
            .is('catalog_item_id', null)
            .select('*', { count: 'exact', head: true });
          result.lotsLinked += lotsUpdated || 0;

          // Link incoming_stock
          const { count: incomingUpdated } = await supabase
            .from('incoming_stock')
            .update({ catalog_item_id: catalogItemId })
            .eq('quality', pair.quality)
            .eq('color', pair.color)
            .is('catalog_item_id', null)
            .select('*', { count: 'exact', head: true });
          result.incomingStockLinked += incomingUpdated || 0;

          // Link manufacturing_orders
          const { count: moUpdated } = await supabase
            .from('manufacturing_orders')
            .update({ catalog_item_id: catalogItemId })
            .eq('quality', pair.quality)
            .eq('color', pair.color)
            .is('catalog_item_id', null)
            .select('*', { count: 'exact', head: true });
          result.manufacturingOrdersLinked += moUpdated || 0;
        }
        continue;
      }

      if (dryRun) {
        result.catalogItemsCreated++;
        continue;
      }

      // Create new catalog item
      const { data: newItem, error: insertError } = await supabase
        .from('catalog_items')
        .insert({
          code: pair.quality,
          color_name: pair.color,
          lastro_sku_code: `MIGRATED-${pair.quality}-${pair.color.substring(0, 10)}`.replace(/\s+/g, '-').toUpperCase(),
          status: 'active',
          is_active: true,
          type: 'lining',
          approved_at: new Date().toISOString(),
          created_by_user_id: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        result.errors.push(`Failed to create catalog item for ${pair.quality}/${pair.color}: ${insertError.message}`);
        continue;
      }

      result.catalogItemsCreated++;
      const catalogItemId = newItem.id;

      // Link lots
      const { count: lotsUpdated } = await supabase
        .from('lots')
        .update({ catalog_item_id: catalogItemId })
        .eq('quality', pair.quality)
        .eq('color', pair.color)
        .is('catalog_item_id', null)
        .select('*', { count: 'exact', head: true });
      result.lotsLinked += lotsUpdated || 0;

      // Link incoming_stock
      const { count: incomingUpdated } = await supabase
        .from('incoming_stock')
        .update({ catalog_item_id: catalogItemId })
        .eq('quality', pair.quality)
        .eq('color', pair.color)
        .is('catalog_item_id', null)
        .select('*', { count: 'exact', head: true });
      result.incomingStockLinked += incomingUpdated || 0;

      // Link manufacturing_orders
      const { count: moUpdated } = await supabase
        .from('manufacturing_orders')
        .update({ catalog_item_id: catalogItemId })
        .eq('quality', pair.quality)
        .eq('color', pair.color)
        .is('catalog_item_id', null)
        .select('*', { count: 'exact', head: true });
      result.manufacturingOrdersLinked += moUpdated || 0;
    }

    console.log('Migration complete:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
