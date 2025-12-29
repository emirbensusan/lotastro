import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SnapshotSettings {
  is_enabled: boolean;
  retention_years: number;
  include_lot_details: boolean;
  include_quality_breakdown: boolean;
  include_color_breakdown: boolean;
  include_customer_breakdown: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== Starting daily snapshot process ===');

  try {
    // 1. Fetch snapshot settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('snapshot_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch snapshot settings');
    }

    const settings = settingsData as SnapshotSettings;

    // Check if snapshots are enabled
    if (!settings.is_enabled) {
      console.log('Snapshots are disabled. Exiting.');
      return new Response(
        JSON.stringify({ success: true, message: 'Snapshots disabled', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`Creating snapshot for date: ${today}`);

    // 2. Check if snapshot already exists for today
    const { data: existingSnapshot } = await supabase
      .from('inventory_snapshots')
      .select('id')
      .eq('snapshot_date', today)
      .single();

    if (existingSnapshot) {
      console.log('Snapshot already exists for today. Skipping.');
      return new Response(
        JSON.stringify({ success: true, message: 'Snapshot already exists for today', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Aggregate inventory data
    console.log('Aggregating inventory data...');
    const { data: lots, error: lotsError } = await supabase
      .from('lots')
      .select('id, quality, color, meters, reserved_meters, status, roll_count');

    if (lotsError) {
      console.error('Error fetching lots:', lotsError);
      throw new Error('Failed to fetch lots');
    }

    // Calculate totals
    let totalMeters = 0;
    let totalReservedMeters = 0;
    let totalLots = 0;
    let totalRolls = 0;

    const byQuality: Record<string, { meters: number; lots: number; rolls: number; reserved: number }> = {};
    const byColor: Record<string, { meters: number; lots: number; rolls: number }> = {};
    const byStatus: Record<string, { meters: number; count: number }> = {};
    const byQualityColor: Record<string, Record<string, { meters: number; lots: number }>> = {};
    const lotDetails: Array<{ lot_id: string; quality: string; color: string; meters: number; rolls: number; status: string; reserved: number }> = [];

    for (const lot of lots || []) {
      const meters = Number(lot.meters) || 0;
      const reserved = Number(lot.reserved_meters) || 0;
      const rolls = lot.roll_count || 0;

      totalMeters += meters;
      totalReservedMeters += reserved;
      totalLots += 1;
      totalRolls += rolls;

      // By quality
      if (settings.include_quality_breakdown) {
        if (!byQuality[lot.quality]) {
          byQuality[lot.quality] = { meters: 0, lots: 0, rolls: 0, reserved: 0 };
        }
        byQuality[lot.quality].meters += meters;
        byQuality[lot.quality].lots += 1;
        byQuality[lot.quality].rolls += rolls;
        byQuality[lot.quality].reserved += reserved;
      }

      // By color
      if (settings.include_color_breakdown) {
        if (!byColor[lot.color]) {
          byColor[lot.color] = { meters: 0, lots: 0, rolls: 0 };
        }
        byColor[lot.color].meters += meters;
        byColor[lot.color].lots += 1;
        byColor[lot.color].rolls += rolls;
      }

      // By status
      if (!byStatus[lot.status]) {
        byStatus[lot.status] = { meters: 0, count: 0 };
      }
      byStatus[lot.status].meters += meters;
      byStatus[lot.status].count += 1;

      // By quality-color combination
      if (settings.include_quality_breakdown && settings.include_color_breakdown) {
        if (!byQualityColor[lot.quality]) {
          byQualityColor[lot.quality] = {};
        }
        if (!byQualityColor[lot.quality][lot.color]) {
          byQualityColor[lot.quality][lot.color] = { meters: 0, lots: 0 };
        }
        byQualityColor[lot.quality][lot.color].meters += meters;
        byQualityColor[lot.quality][lot.color].lots += 1;
      }

      // Lot details
      if (settings.include_lot_details) {
        lotDetails.push({
          lot_id: lot.id,
          quality: lot.quality,
          color: lot.color,
          meters: meters,
          rolls: rolls,
          status: lot.status,
          reserved: reserved,
        });
      }
    }

    // 4. Insert inventory snapshot
    const { error: invInsertError } = await supabase
      .from('inventory_snapshots')
      .insert({
        snapshot_date: today,
        total_meters: totalMeters,
        total_reserved_meters: totalReservedMeters,
        total_available_meters: totalMeters - totalReservedMeters,
        total_lots: totalLots,
        total_rolls: totalRolls,
        by_quality: settings.include_quality_breakdown ? byQuality : {},
        by_color: settings.include_color_breakdown ? byColor : {},
        by_status: byStatus,
        by_quality_color: (settings.include_quality_breakdown && settings.include_color_breakdown) ? byQualityColor : {},
        lot_details: settings.include_lot_details ? lotDetails : [],
      });

    if (invInsertError) {
      console.error('Error inserting inventory snapshot:', invInsertError);
      throw new Error('Failed to insert inventory snapshot');
    }
    console.log('Inventory snapshot created successfully');

    // 5. Aggregate order data
    console.log('Aggregating order data...');
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, fulfilled_at, created_at');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw new Error('Failed to fetch orders');
    }

    // Get order lines for meter calculations
    const { data: orderLines, error: linesError } = await supabase
      .from('order_lines')
      .select('order_id, meters');

    if (linesError) {
      console.error('Error fetching order lines:', linesError);
    }

    const orderMetersByOrderId: Record<string, number> = {};
    for (const line of orderLines || []) {
      orderMetersByOrderId[line.order_id] = (orderMetersByOrderId[line.order_id] || 0) + (Number(line.meters) || 0);
    }

    let totalOrders = 0;
    let pendingOrders = 0;
    let fulfilledOrders = 0;
    let pendingMeters = 0;
    let fulfilledMeters = 0;
    const orderByStatus: Record<string, { count: number; meters: number }> = {};
    const orderByCustomer: Record<string, { count: number; meters: number }> = {};
    const orderDetails: Array<{ order_id: string; order_number: string; customer: string; meters: number; fulfilled: boolean }> = [];

    for (const order of orders || []) {
      const meters = orderMetersByOrderId[order.id] || 0;
      const isFulfilled = !!order.fulfilled_at;
      const status = isFulfilled ? 'fulfilled' : 'pending';

      totalOrders += 1;
      if (isFulfilled) {
        fulfilledOrders += 1;
        fulfilledMeters += meters;
      } else {
        pendingOrders += 1;
        pendingMeters += meters;
      }

      // By status
      if (!orderByStatus[status]) {
        orderByStatus[status] = { count: 0, meters: 0 };
      }
      orderByStatus[status].count += 1;
      orderByStatus[status].meters += meters;

      // By customer
      if (settings.include_customer_breakdown && order.customer_name) {
        if (!orderByCustomer[order.customer_name]) {
          orderByCustomer[order.customer_name] = { count: 0, meters: 0 };
        }
        orderByCustomer[order.customer_name].count += 1;
        orderByCustomer[order.customer_name].meters += meters;
      }

      orderDetails.push({
        order_id: order.id,
        order_number: order.order_number,
        customer: order.customer_name,
        meters: meters,
        fulfilled: isFulfilled,
      });
    }

    // 6. Insert order snapshot
    const { error: orderInsertError } = await supabase
      .from('order_snapshots')
      .insert({
        snapshot_date: today,
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        fulfilled_orders: fulfilledOrders,
        pending_meters: pendingMeters,
        fulfilled_meters: fulfilledMeters,
        by_status: orderByStatus,
        by_customer: settings.include_customer_breakdown ? orderByCustomer : {},
        order_details: orderDetails,
      });

    if (orderInsertError) {
      console.error('Error inserting order snapshot:', orderInsertError);
      throw new Error('Failed to insert order snapshot');
    }
    console.log('Order snapshot created successfully');

    // 7. Aggregate reservation data
    console.log('Aggregating reservation data...');
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, reservation_number, customer_name, status, expiry_date');

    if (resError) {
      console.error('Error fetching reservations:', resError);
      throw new Error('Failed to fetch reservations');
    }

    // Get reservation lines
    const { data: resLines, error: resLinesError } = await supabase
      .from('reservation_lines')
      .select('reservation_id, reserved_meters');

    if (resLinesError) {
      console.error('Error fetching reservation lines:', resLinesError);
    }

    const resMetersByResId: Record<string, number> = {};
    for (const line of resLines || []) {
      resMetersByResId[line.reservation_id] = (resMetersByResId[line.reservation_id] || 0) + (Number(line.reserved_meters) || 0);
    }

    let activeCount = 0;
    let totalReservedMetersByRes = 0;
    let expiring7Days = 0;
    let convertedCount = 0;
    let canceledCount = 0;
    const resByStatus: Record<string, { count: number; meters: number }> = {};
    const resByCustomer: Record<string, { count: number; meters: number }> = {};
    const resDetails: Array<{ reservation_id: string; reservation_number: string; customer: string; meters: number; status: string }> = [];

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    for (const res of reservations || []) {
      const meters = resMetersByResId[res.id] || 0;

      if (res.status === 'active') {
        activeCount += 1;
        totalReservedMetersByRes += meters;

        if (res.expiry_date && new Date(res.expiry_date) <= sevenDaysFromNow) {
          expiring7Days += 1;
        }
      } else if (res.status === 'converted') {
        convertedCount += 1;
      } else if (res.status === 'canceled') {
        canceledCount += 1;
      }

      // By status
      if (!resByStatus[res.status]) {
        resByStatus[res.status] = { count: 0, meters: 0 };
      }
      resByStatus[res.status].count += 1;
      resByStatus[res.status].meters += meters;

      // By customer
      if (settings.include_customer_breakdown && res.customer_name) {
        if (!resByCustomer[res.customer_name]) {
          resByCustomer[res.customer_name] = { count: 0, meters: 0 };
        }
        resByCustomer[res.customer_name].count += 1;
        resByCustomer[res.customer_name].meters += meters;
      }

      resDetails.push({
        reservation_id: res.id,
        reservation_number: res.reservation_number,
        customer: res.customer_name,
        meters: meters,
        status: res.status,
      });
    }

    // 8. Insert reservation snapshot
    const { error: resInsertError } = await supabase
      .from('reservation_snapshots')
      .insert({
        snapshot_date: today,
        active_count: activeCount,
        total_reserved_meters: totalReservedMetersByRes,
        expiring_7_days: expiring7Days,
        converted_count: convertedCount,
        canceled_count: canceledCount,
        by_status: resByStatus,
        by_customer: settings.include_customer_breakdown ? resByCustomer : {},
        reservation_details: resDetails,
      });

    if (resInsertError) {
      console.error('Error inserting reservation snapshot:', resInsertError);
      throw new Error('Failed to insert reservation snapshot');
    }
    console.log('Reservation snapshot created successfully');

    // 9. Cleanup old snapshots based on retention
    const retentionDays = settings.retention_years * 365;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    console.log(`Cleaning up snapshots older than ${cutoffDateStr}`);

    const { error: cleanupInvError } = await supabase
      .from('inventory_snapshots')
      .delete()
      .lt('snapshot_date', cutoffDateStr);

    if (cleanupInvError) {
      console.error('Error cleaning up inventory snapshots:', cleanupInvError);
    }

    const { error: cleanupOrderError } = await supabase
      .from('order_snapshots')
      .delete()
      .lt('snapshot_date', cutoffDateStr);

    if (cleanupOrderError) {
      console.error('Error cleaning up order snapshots:', cleanupOrderError);
    }

    const { error: cleanupResError } = await supabase
      .from('reservation_snapshots')
      .delete()
      .lt('snapshot_date', cutoffDateStr);

    if (cleanupResError) {
      console.error('Error cleaning up reservation snapshots:', cleanupResError);
    }

    // 10. Update last snapshot timestamp in settings
    await supabase
      .from('snapshot_settings')
      .update({
        last_snapshot_at: new Date().toISOString(),
        last_snapshot_status: 'success',
        last_snapshot_error: null,
      })
      .eq('id', settingsData.id);

    console.log('=== Daily snapshot process completed successfully ===');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily snapshot created successfully',
        snapshot_date: today,
        stats: {
          inventory: { lots: totalLots, meters: totalMeters, rolls: totalRolls },
          orders: { total: totalOrders, pending: pendingOrders, fulfilled: fulfilledOrders },
          reservations: { active: activeCount, total_meters: totalReservedMetersByRes },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Snapshot error:', error);

    // Update settings with error status
    try {
      await supabase
        .from('snapshot_settings')
        .update({
          last_snapshot_status: 'error',
          last_snapshot_error: error.message,
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all (there should only be one)
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
