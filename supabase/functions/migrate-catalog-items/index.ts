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

    // Create lookup map for existing items (case-insensitive)
    const existingMap = new Map<string, string>();
    (existingCatalog || []).forEach(item => {
      const key = `${item.code.toLowerCase()}||${item.color_name.toLowerCase()}`;
      existingMap.set(key, item.id);
    });

    result.details.existingCatalogItems = existingMap.size;
    console.log(`Found ${existingMap.size} existing catalog items`);

    // Step 2: Fetch ALL records from lots, incoming_stock, manufacturing_orders
    // and group them by lowercase (quality, color) key with their original values and IDs

    // Structure to hold records grouped by lowercase key
    interface RecordGroup {
      quality: string; // Original casing (first encountered)
      color: string;   // Original casing (first encountered)
      lotIds: string[];
      incomingStockIds: string[];
      manufacturingOrderIds: string[];
    }
    const recordGroups = new Map<string, RecordGroup>();

    // From lots - fetch ALL (not just unlinked for counting, but we only update unlinked)
    console.log('Fetching lots...');
    const { data: allLots, error: lotError } = await supabase
      .from('lots')
      .select('id, quality, color, catalog_item_id');

    if (lotError) {
      result.errors.push(`Failed to fetch lots: ${lotError.message}`);
    } else {
      console.log(`Found ${allLots?.length || 0} lots total`);
      (allLots || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!recordGroups.has(key)) {
          recordGroups.set(key, { 
            quality: row.quality, 
            color: row.color, 
            lotIds: [], 
            incomingStockIds: [], 
            manufacturingOrderIds: [] 
          });
        }
        // Only add to list if not already linked
        if (!row.catalog_item_id) {
          recordGroups.get(key)!.lotIds.push(row.id);
        }
      });
    }

    // From incoming_stock
    console.log('Fetching incoming_stock...');
    const { data: allIncoming, error: incomingError } = await supabase
      .from('incoming_stock')
      .select('id, quality, color, catalog_item_id');

    if (incomingError) {
      result.errors.push(`Failed to fetch incoming_stock: ${incomingError.message}`);
    } else {
      console.log(`Found ${allIncoming?.length || 0} incoming_stock records total`);
      (allIncoming || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!recordGroups.has(key)) {
          recordGroups.set(key, { 
            quality: row.quality, 
            color: row.color, 
            lotIds: [], 
            incomingStockIds: [], 
            manufacturingOrderIds: [] 
          });
        }
        // Only add to list if not already linked
        if (!row.catalog_item_id) {
          recordGroups.get(key)!.incomingStockIds.push(row.id);
        }
      });
    }

    // From manufacturing_orders
    console.log('Fetching manufacturing_orders...');
    const { data: allMO, error: moError } = await supabase
      .from('manufacturing_orders')
      .select('id, quality, color, catalog_item_id');

    if (moError) {
      result.errors.push(`Failed to fetch manufacturing_orders: ${moError.message}`);
    } else {
      console.log(`Found ${allMO?.length || 0} manufacturing_orders total`);
      (allMO || []).forEach(row => {
        const key = `${row.quality.toLowerCase()}||${row.color.toLowerCase()}`;
        if (!recordGroups.has(key)) {
          recordGroups.set(key, { 
            quality: row.quality, 
            color: row.color, 
            lotIds: [], 
            incomingStockIds: [], 
            manufacturingOrderIds: [] 
          });
        }
        // Only add to list if not already linked
        if (!row.catalog_item_id) {
          recordGroups.get(key)!.manufacturingOrderIds.push(row.id);
        }
      });
    }

    result.details.uniquePairs = recordGroups.size;
    console.log(`Found ${recordGroups.size} unique (quality, color) pairs to process`);

    // Step 3: Create catalog items and link records using ID-based updates
    let processed = 0;
    for (const [key, group] of recordGroups) {
      processed++;
      const hasUnlinkedRecords = group.lotIds.length > 0 || group.incomingStockIds.length > 0 || group.manufacturingOrderIds.length > 0;
      
      // Check if catalog item already exists
      let catalogItemId = existingMap.get(key);

      if (catalogItemId) {
        result.skippedExisting++;
        
        // Link unlinked records to existing catalog item using IDs
        if (!dryRun && hasUnlinkedRecords) {
          // Link lots by ID
          if (group.lotIds.length > 0) {
            const { error: lotUpdateError } = await supabase
              .from('lots')
              .update({ catalog_item_id: catalogItemId })
              .in('id', group.lotIds);
            
            if (lotUpdateError) {
              result.errors.push(`Failed to link lots for ${group.quality}/${group.color}: ${lotUpdateError.message}`);
            } else {
              result.lotsLinked += group.lotIds.length;
            }
          }

          // Link incoming_stock by ID
          if (group.incomingStockIds.length > 0) {
            const { error: incomingUpdateError } = await supabase
              .from('incoming_stock')
              .update({ catalog_item_id: catalogItemId })
              .in('id', group.incomingStockIds);
            
            if (incomingUpdateError) {
              result.errors.push(`Failed to link incoming_stock for ${group.quality}/${group.color}: ${incomingUpdateError.message}`);
            } else {
              result.incomingStockLinked += group.incomingStockIds.length;
            }
          }

          // Link manufacturing_orders by ID
          if (group.manufacturingOrderIds.length > 0) {
            const { error: moUpdateError } = await supabase
              .from('manufacturing_orders')
              .update({ catalog_item_id: catalogItemId })
              .in('id', group.manufacturingOrderIds);
            
            if (moUpdateError) {
              result.errors.push(`Failed to link manufacturing_orders for ${group.quality}/${group.color}: ${moUpdateError.message}`);
            } else {
              result.manufacturingOrdersLinked += group.manufacturingOrderIds.length;
            }
          }
        }
        continue;
      }

      // Only create new catalog item if there are unlinked records
      if (!hasUnlinkedRecords) {
        continue;
      }

      if (dryRun) {
        result.catalogItemsCreated++;
        continue;
      }

      // Create new catalog item
      const skuCode = `LTA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const { data: newItem, error: insertError } = await supabase
        .from('catalog_items')
        .insert({
          code: group.quality,
          color_name: group.color,
          lastro_sku_code: skuCode,
          status: 'active',
          is_active: true,
          type: 'lining',
          approved_at: new Date().toISOString(),
          created_by_user_id: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        result.errors.push(`Failed to create catalog item for ${group.quality}/${group.color}: ${insertError.message}`);
        continue;
      }

      result.catalogItemsCreated++;
      catalogItemId = newItem.id;

      // Link lots by ID
      if (group.lotIds.length > 0) {
        const { error: lotUpdateError } = await supabase
          .from('lots')
          .update({ catalog_item_id: catalogItemId })
          .in('id', group.lotIds);
        
        if (lotUpdateError) {
          result.errors.push(`Failed to link lots for ${group.quality}/${group.color}: ${lotUpdateError.message}`);
        } else {
          result.lotsLinked += group.lotIds.length;
        }
      }

      // Link incoming_stock by ID
      if (group.incomingStockIds.length > 0) {
        const { error: incomingUpdateError } = await supabase
          .from('incoming_stock')
          .update({ catalog_item_id: catalogItemId })
          .in('id', group.incomingStockIds);
        
        if (incomingUpdateError) {
          result.errors.push(`Failed to link incoming_stock for ${group.quality}/${group.color}: ${incomingUpdateError.message}`);
        } else {
          result.incomingStockLinked += group.incomingStockIds.length;
        }
      }

      // Link manufacturing_orders by ID
      if (group.manufacturingOrderIds.length > 0) {
        const { error: moUpdateError } = await supabase
          .from('manufacturing_orders')
          .update({ catalog_item_id: catalogItemId })
          .in('id', group.manufacturingOrderIds);
        
        if (moUpdateError) {
          result.errors.push(`Failed to link manufacturing_orders for ${group.quality}/${group.color}: ${moUpdateError.message}`);
        } else {
          result.manufacturingOrdersLinked += group.manufacturingOrderIds.length;
        }
      }

      // Log progress every 50 items
      if (processed % 50 === 0) {
        console.log(`Processed ${processed}/${recordGroups.size} pairs...`);
      }
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
