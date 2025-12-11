import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForecastSettings {
  forecast_horizon_months: number;
  time_bucket: string;
  history_window_months: number;
  normalization_type: string;
  outlier_percentile: number;
  weighting_method: string;
  default_safety_stock_weeks: number;
  default_safety_stock_mode: string;
  min_order_zero_history: number;
  demand_statuses: string[];
  stockout_alert_days: number;
  overstock_alert_months: number;
  scenario_parameters: {
    conservative: { coverage_multiplier: number; safety_multiplier: number; history_weight: number };
    normal: { coverage_multiplier: number; safety_multiplier: number; history_weight: number };
    aggressive: { coverage_multiplier: number; safety_multiplier: number; history_weight: number };
  };
}

interface QualityOverride {
  quality_code: string;
  color_code: string;
  lead_time_days: number | null;
  safety_stock_weeks: number | null;
  target_coverage_weeks: number | null;
  min_recommended_order: number | null;
}

interface StockPosition {
  quality_code: string;
  color_code: string;
  unit: string;
  available_stock: number;
  incoming_stock: number;
  in_production_stock: number;
}

interface DemandData {
  quality_code: string;
  color_code: string;
  total_demand: number;
  demand_periods: { date: Date; amount: number }[];
}

// Helper function to fetch ALL records with pagination (avoiding 1000 row limit)
async function fetchAllRecords<T>(
  supabase: any,
  table: string,
  select: string,
  filters?: { column: string; operator: string; value: any }[],
  order?: { column: string; ascending: boolean }
): Promise<T[]> {
  const BATCH_SIZE = 1000;
  let allRecords: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from(table).select(select);
    
    // Apply filters
    if (filters) {
      for (const filter of filters) {
        if (filter.operator === 'eq') {
          query = query.eq(filter.column, filter.value);
        } else if (filter.operator === 'in') {
          query = query.in(filter.column, filter.value);
        } else if (filter.operator === 'gte') {
          query = query.gte(filter.column, filter.value);
        } else if (filter.operator === 'neq') {
          query = query.neq(filter.column, filter.value);
        }
      }
    }
    
    // Apply ordering if specified
    if (order) {
      query = query.order(order.column, { ascending: order.ascending });
    }
    
    const { data, error } = await query.range(offset, offset + BATCH_SIZE - 1);
    
    if (error) {
      console.error(`[fetchAllRecords] Error fetching ${table}:`, error);
      throw error;
    }
    
    allRecords = allRecords.concat(data || []);
    hasMore = (data?.length || 0) === BATCH_SIZE;
    offset += BATCH_SIZE;
    
    if (hasMore) {
      console.log(`[fetchAllRecords] Fetched ${allRecords.length} records from ${table}, fetching more...`);
    }
  }
  
  console.log(`[fetchAllRecords] Total records from ${table}: ${allRecords.length}`);
  return allRecords;
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
    const body = await req.json().catch(() => ({}));
    const runType = body.run_type || 'manual';
    const triggeredBy = body.triggered_by || null;
    const affectedQualities = body.affected_qualities || null; // For partial runs

    console.log(`[forecast-engine] Starting ${runType} forecast run`);

    // 1. Create forecast run record
    const { data: runRecord, error: runError } = await supabase
      .from('forecast_runs')
      .insert({
        run_type: runType,
        triggered_by: triggeredBy,
        status: 'running',
        affected_qualities: affectedQualities,
      })
      .select()
      .single();

    if (runError) {
      console.error('[forecast-engine] Error creating run record:', runError);
      throw new Error(`Failed to create forecast run: ${runError.message}`);
    }

    const runId = runRecord.id;
    console.log(`[forecast-engine] Created run record: ${runId}`);

    try {
      // 2. Fetch global settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('forecast_settings_global')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (settingsError) {
        throw new Error(`Failed to fetch settings: ${settingsError.message}`);
      }

      const settings: ForecastSettings = settingsData || {
        forecast_horizon_months: 3,
        time_bucket: '2-week',
        history_window_months: 12,
        normalization_type: 'none',
        outlier_percentile: 95,
        weighting_method: 'fixed',
        default_safety_stock_weeks: 2,
        default_safety_stock_mode: 'weeks',
        min_order_zero_history: 0,
        demand_statuses: ['confirmed', 'reserved'],
        stockout_alert_days: 14,
        overstock_alert_months: 6,
        scenario_parameters: {
          conservative: { coverage_multiplier: 1.5, safety_multiplier: 1.5, history_weight: 1.2 },
          normal: { coverage_multiplier: 1.0, safety_multiplier: 1.0, history_weight: 1.0 },
          aggressive: { coverage_multiplier: 0.7, safety_multiplier: 0.7, history_weight: 0.8 },
        },
      };

      console.log(`[forecast-engine] Using settings:`, JSON.stringify(settings, null, 2));

      // 3. Fetch per-quality overrides (using pagination)
      const overridesData = await fetchAllRecords<QualityOverride>(
        supabase,
        'forecast_settings_per_quality',
        '*'
      );

      const overridesMap = new Map<string, QualityOverride>();
      overridesData.forEach((o: QualityOverride) => {
        overridesMap.set(`${o.quality_code}|${o.color_code}`, o);
      });

      // 4. Fetch supplier default lead times
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('id, name, default_lead_time_days');

      const defaultLeadTime = suppliersData?.[0]?.default_lead_time_days || 30;
      console.log(`[forecast-engine] Default lead time: ${defaultLeadTime} days`);

      // 5. Fetch quality units
      const qualitiesData = await fetchAllRecords<{ code: string; unit: string }>(
        supabase,
        'qualities',
        'code, unit'
      );

      const unitMap = new Map<string, string>();
      qualitiesData.forEach((q: { code: string; unit: string }) => {
        unitMap.set(q.code.toUpperCase(), q.unit);
      });

      // 6. Aggregate available stock from lots + rolls
      // First fetch ALL lots with in_stock status using pagination
      console.log('[forecast-engine] Aggregating available stock...');
      const lotsData = await fetchAllRecords<{
        id: string;
        quality: string;
        color: string;
        meters: number;
        roll_count: number;
        status: string;
      }>(
        supabase,
        'lots',
        'id, quality, color, meters, roll_count, status',
        [{ column: 'status', operator: 'eq', value: 'in_stock' }]
      );

      console.log(`[forecast-engine] Fetched ${lotsData.length} lots with in_stock status`);

      // Fetch ALL available rolls in one batch query (instead of per-lot queries)
      const lotIds = lotsData.map(l => l.id);
      let allAvailableRolls: { lot_id: string; meters: number }[] = [];
      
      if (lotIds.length > 0) {
        // Batch fetch rolls in chunks of 500 lot IDs to avoid query limits
        const LOT_BATCH_SIZE = 500;
        for (let i = 0; i < lotIds.length; i += LOT_BATCH_SIZE) {
          const batchLotIds = lotIds.slice(i, i + LOT_BATCH_SIZE);
          const rollsData = await fetchAllRecords<{ lot_id: string; meters: number }>(
            supabase,
            'rolls',
            'lot_id, meters',
            [
              { column: 'lot_id', operator: 'in', value: batchLotIds },
              { column: 'status', operator: 'eq', value: 'available' }
            ]
          );
          allAvailableRolls = allAvailableRolls.concat(rollsData);
        }
      }

      console.log(`[forecast-engine] Fetched ${allAvailableRolls.length} available rolls`);

      // Group rolls by lot_id
      const rollsByLot = new Map<string, number>();
      for (const roll of allAvailableRolls) {
        const current = rollsByLot.get(roll.lot_id) || 0;
        rollsByLot.set(roll.lot_id, current + roll.meters);
      }

      // Now aggregate stock positions
      const stockPositions = new Map<string, StockPosition>();

      for (const lot of lotsData) {
        const key = `${lot.quality.toUpperCase()}|${lot.color.toUpperCase()}`;
        const existing = stockPositions.get(key) || {
          quality_code: lot.quality.toUpperCase(),
          color_code: lot.color.toUpperCase(),
          unit: unitMap.get(lot.quality.toUpperCase()) || 'M',
          available_stock: 0,
          incoming_stock: 0,
          in_production_stock: 0,
        };

        const availableMeters = rollsByLot.get(lot.id) || 0;
        existing.available_stock += availableMeters;
        stockPositions.set(key, existing);
      }

      console.log(`[forecast-engine] Found ${stockPositions.size} quality-color combinations in stock`);

      // 7. Aggregate incoming stock using pagination
      console.log('[forecast-engine] Aggregating incoming stock...');
      const incomingData = await fetchAllRecords<{
        quality: string;
        color: string;
        expected_meters: number;
        received_meters: number;
      }>(
        supabase,
        'incoming_stock',
        'quality, color, expected_meters, received_meters',
        [{ column: 'status', operator: 'in', value: ['pending_inbound', 'partially_received'] }]
      );

      console.log(`[forecast-engine] Fetched ${incomingData.length} incoming stock records`);

      for (const inc of incomingData) {
        const key = `${inc.quality.toUpperCase()}|${inc.color.toUpperCase()}`;
        const existing = stockPositions.get(key) || {
          quality_code: inc.quality.toUpperCase(),
          color_code: inc.color.toUpperCase(),
          unit: unitMap.get(inc.quality.toUpperCase()) || 'M',
          available_stock: 0,
          incoming_stock: 0,
          in_production_stock: 0,
        };
        existing.incoming_stock += (inc.expected_meters - inc.received_meters);
        stockPositions.set(key, existing);
      }

      // 8. Aggregate in-production stock from manufacturing orders using pagination
      console.log('[forecast-engine] Aggregating in-production stock...');
      const moData = await fetchAllRecords<{
        quality: string;
        color: string;
        ordered_amount: number;
      }>(
        supabase,
        'manufacturing_orders',
        'quality, color, ordered_amount',
        [{ column: 'status', operator: 'in', value: ['ORDERED', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP'] }]
      );

      console.log(`[forecast-engine] Fetched ${moData.length} manufacturing orders`);

      for (const mo of moData) {
        const key = `${mo.quality.toUpperCase()}|${mo.color.toUpperCase()}`;
        const existing = stockPositions.get(key) || {
          quality_code: mo.quality.toUpperCase(),
          color_code: mo.color.toUpperCase(),
          unit: unitMap.get(mo.quality.toUpperCase()) || 'M',
          available_stock: 0,
          incoming_stock: 0,
          in_production_stock: 0,
        };
        existing.in_production_stock += mo.ordered_amount;
        stockPositions.set(key, existing);
      }

      // 9. Fetch historical demand using pagination
      console.log('[forecast-engine] Fetching historical demand...');
      const historyStartDate = new Date();
      historyStartDate.setMonth(historyStartDate.getMonth() - settings.history_window_months);

      const demandDataRecords = await fetchAllRecords<{
        quality_code: string;
        color_code: string;
        demand_date: string;
        amount: number;
        unit: string;
      }>(
        supabase,
        'demand_history',
        'quality_code, color_code, demand_date, amount, unit',
        [{ column: 'demand_date', operator: 'gte', value: historyStartDate.toISOString().split('T')[0] }],
        { column: 'demand_date', ascending: false }
      );

      console.log(`[forecast-engine] Fetched ${demandDataRecords.length} demand history records`);

      const demandMap = new Map<string, DemandData>();
      for (const d of demandDataRecords) {
        const key = `${d.quality_code.toUpperCase()}|${d.color_code.toUpperCase()}`;
        const existing = demandMap.get(key) || {
          quality_code: d.quality_code.toUpperCase(),
          color_code: d.color_code.toUpperCase(),
          total_demand: 0,
          demand_periods: [],
        };
        existing.total_demand += d.amount;
        existing.demand_periods.push({ date: new Date(d.demand_date), amount: d.amount });
        demandMap.set(key, existing);

        // Ensure quality-color exists in stock positions (even if 0 stock)
        if (!stockPositions.has(key)) {
          stockPositions.set(key, {
            quality_code: d.quality_code.toUpperCase(),
            color_code: d.color_code.toUpperCase(),
            unit: d.unit || 'M',
            available_stock: 0,
            incoming_stock: 0,
            in_production_stock: 0,
          });
        }
      }

      console.log(`[forecast-engine] Found demand data for ${demandMap.size} quality-color combinations`);
      console.log(`[forecast-engine] Total quality-color combinations to process: ${stockPositions.size}`);

      // 10. Calculate forecasts and recommendations
      console.log('[forecast-engine] Calculating forecasts...');
      const forecastResults: any[] = [];
      const recommendations: any[] = [];
      const alerts: any[] = [];

      let processedCount = 0;
      const totalCombinations = stockPositions.size;

      for (const [key, stock] of stockPositions) {
        processedCount++;
        const [qualityCode, colorCode] = key.split('|');
        
        // Skip if partial run and not in affected list
        if (affectedQualities && !affectedQualities.some(
          (aq: { quality_code: string; color_code: string }) => 
            aq.quality_code === qualityCode && aq.color_code === colorCode
        )) {
          continue;
        }

        const override = overridesMap.get(key);
        const demand = demandMap.get(key);
        const hasOverride = !!override && (
          override.lead_time_days !== null ||
          override.safety_stock_weeks !== null ||
          override.target_coverage_weeks !== null ||
          override.min_recommended_order !== null
        );

        // Get effective lead time
        const leadTimeDays = override?.lead_time_days ?? defaultLeadTime;
        const leadTimeWeeks = leadTimeDays / 7;

        // Calculate weekly demand rate
        let weeklyDemandRate = 0;
        if (demand && demand.demand_periods.length > 0) {
          const weeks = settings.history_window_months * 4.33;
          
          if (settings.weighting_method === 'exponential_decay') {
            // Exponential decay - recent periods weighted higher
            let weightedSum = 0;
            let weightSum = 0;
            const now = new Date();
            demand.demand_periods.forEach((p, i) => {
              const weeksAgo = (now.getTime() - p.date.getTime()) / (7 * 24 * 60 * 60 * 1000);
              const weight = Math.exp(-0.1 * weeksAgo);
              weightedSum += p.amount * weight;
              weightSum += weight;
            });
            weeklyDemandRate = weightSum > 0 ? (weightedSum / weightSum) / (weeks / demand.demand_periods.length) : 0;
          } else if (settings.weighting_method === 'linear_decay') {
            // Linear decay
            let weightedSum = 0;
            let weightSum = 0;
            const maxIdx = demand.demand_periods.length;
            demand.demand_periods.forEach((p, i) => {
              const weight = (maxIdx - i) / maxIdx;
              weightedSum += p.amount * weight;
              weightSum += weight;
            });
            weeklyDemandRate = weightSum > 0 ? (weightedSum / weightSum) / weeks : 0;
          } else {
            // Fixed weights (simple average)
            weeklyDemandRate = demand.total_demand / weeks;
          }

          // Apply outlier normalization if configured
          if (settings.normalization_type === 'cap_outliers' && demand.demand_periods.length > 5) {
            const amounts = demand.demand_periods.map(p => p.amount).sort((a, b) => a - b);
            const percentileIdx = Math.floor(amounts.length * settings.outlier_percentile / 100);
            const cap = amounts[percentileIdx] || amounts[amounts.length - 1];
            // Recalculate with capped values
            const cappedTotal = demand.demand_periods.reduce((sum, p) => sum + Math.min(p.amount, cap), 0);
            weeklyDemandRate = cappedTotal / weeks;
          }
        }

        // Calculate total stock position
        const totalStock = stock.available_stock + stock.incoming_stock + stock.in_production_stock;

        // Get safety stock value
        let safetyStockValue = 0;
        const safetyStockWeeks = override?.safety_stock_weeks ?? settings.default_safety_stock_weeks;
        if (settings.default_safety_stock_mode === 'weeks') {
          safetyStockValue = weeklyDemandRate * safetyStockWeeks;
        } else {
          safetyStockValue = safetyStockWeeks; // min_units or min_per_color
        }

        const targetCoverageWeeks = override?.target_coverage_weeks ?? leadTimeWeeks + safetyStockWeeks;

        // Generate forecast periods
        const periods = generatePeriods(settings.time_bucket, settings.forecast_horizon_months);
        
        for (const period of periods) {
          const periodWeeks = (period.end.getTime() - period.start.getTime()) / (7 * 24 * 60 * 60 * 1000);
          const baseForecast = weeklyDemandRate * periodWeeks;

          // Store base forecast
          forecastResults.push({
            run_id: runId,
            quality_code: qualityCode,
            color_code: colorCode,
            unit: stock.unit,
            period_start: period.start.toISOString().split('T')[0],
            period_end: period.end.toISOString().split('T')[0],
            forecast_amount: baseForecast,
            scenario: 'base',
            historical_avg: weeklyDemandRate,
            weighted_avg: weeklyDemandRate,
          });
        }

        // Calculate recommendations for each scenario
        const leadTimeDemand = weeklyDemandRate * leadTimeWeeks;
        const scenarios = settings.scenario_parameters;

        const calcRecommendation = (params: { coverage_multiplier: number; safety_multiplier: number }) => {
          const adjustedLeadTimeDemand = leadTimeDemand * params.coverage_multiplier;
          const adjustedSafetyStock = safetyStockValue * params.safety_multiplier;
          const required = adjustedLeadTimeDemand + adjustedSafetyStock;
          const recommendation = Math.max(0, required - totalStock);
          
          // Apply minimum order if no history
          if (recommendation === 0 && (!demand || demand.total_demand === 0)) {
            const minOrder = override?.min_recommended_order ?? settings.min_order_zero_history;
            return minOrder;
          }
          
          return recommendation;
        };

        const conservativeRec = calcRecommendation(scenarios.conservative);
        const normalRec = calcRecommendation(scenarios.normal);
        const aggressiveRec = calcRecommendation(scenarios.aggressive);

        // Get last order date from manufacturing orders (single query per item)
        const { data: lastOrderData } = await supabase
          .from('manufacturing_orders')
          .select('order_date')
          .eq('quality', qualityCode)
          .eq('color', colorCode)
          .order('order_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        recommendations.push({
          run_id: runId,
          quality_code: qualityCode,
          color_code: colorCode,
          unit: stock.unit,
          available_stock: stock.available_stock,
          incoming_stock: stock.incoming_stock,
          in_production_stock: stock.in_production_stock,
          total_stock_position: totalStock,
          past_12m_demand: demand?.total_demand || 0,
          forecasted_lead_time_demand: leadTimeDemand,
          safety_stock_value: safetyStockValue,
          target_coverage_weeks: targetCoverageWeeks,
          conservative_recommendation: conservativeRec,
          normal_recommendation: normalRec,
          aggressive_recommendation: aggressiveRec,
          lead_time_days: leadTimeDays,
          has_quality_override: hasOverride,
          last_order_date: lastOrderData?.order_date || null,
        });

        // Generate alerts
        if (weeklyDemandRate > 0) {
          const weeksOfStock = totalStock / weeklyDemandRate;
          const daysOfStock = weeksOfStock * 7;

          // Stockout risk alert
          if (daysOfStock < settings.stockout_alert_days) {
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (daysOfStock <= 0) severity = 'critical';
            else if (daysOfStock < 7) severity = 'high';
            else if (daysOfStock < 14) severity = 'medium';

            alerts.push({
              run_id: runId,
              quality_code: qualityCode,
              color_code: colorCode,
              unit: stock.unit,
              alert_type: 'stockout_risk',
              severity,
              projected_stockout_days: Math.round(daysOfStock),
              current_stock: totalStock,
              forecasted_demand: leadTimeDemand,
            });
          }

          // Overstock risk alert
          const monthsOfStock = weeksOfStock / 4.33;
          if (monthsOfStock > settings.overstock_alert_months) {
            let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
            if (monthsOfStock > 24) severity = 'high';
            else if (monthsOfStock > 12) severity = 'medium';

            alerts.push({
              run_id: runId,
              quality_code: qualityCode,
              color_code: colorCode,
              unit: stock.unit,
              alert_type: 'overstock_risk',
              severity,
              coverage_months: Math.round(monthsOfStock * 10) / 10,
              current_stock: totalStock,
              forecasted_demand: leadTimeDemand,
            });
          }
        }
      }

      // 11. Batch insert results
      console.log(`[forecast-engine] Inserting ${forecastResults.length} forecast results...`);
      if (forecastResults.length > 0) {
        // Insert in batches of 500 to avoid payload size limits
        const BATCH_SIZE = 500;
        for (let i = 0; i < forecastResults.length; i += BATCH_SIZE) {
          const batch = forecastResults.slice(i, i + BATCH_SIZE);
          const { error: resultsError } = await supabase
            .from('forecast_results')
            .insert(batch);

          if (resultsError) {
            console.error('[forecast-engine] Error inserting forecast results batch:', resultsError);
          }
        }
      }

      console.log(`[forecast-engine] Inserting ${recommendations.length} recommendations...`);
      if (recommendations.length > 0) {
        // Insert in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < recommendations.length; i += BATCH_SIZE) {
          const batch = recommendations.slice(i, i + BATCH_SIZE);
          const { error: recError } = await supabase
            .from('purchase_recommendations')
            .insert(batch);

          if (recError) {
            console.error('[forecast-engine] Error inserting recommendations batch:', recError);
          }
        }
      }

      console.log(`[forecast-engine] Inserting ${alerts.length} alerts...`);
      if (alerts.length > 0) {
        // Insert in batches of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < alerts.length; i += BATCH_SIZE) {
          const batch = alerts.slice(i, i + BATCH_SIZE);
          const { error: alertsError } = await supabase
            .from('forecast_alerts')
            .insert(batch);

          if (alertsError) {
            console.error('[forecast-engine] Error inserting alerts batch:', alertsError);
          }
        }
      }

      // 12. Update run record as completed
      await supabase
        .from('forecast_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_combinations: totalCombinations,
          processed_combinations: processedCount,
        })
        .eq('id', runId);

      console.log(`[forecast-engine] Forecast run ${runId} completed successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          run_id: runId,
          total_combinations: totalCombinations,
          forecast_results: forecastResults.length,
          recommendations: recommendations.length,
          alerts: alerts.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processingError) {
      // Update run record as failed
      await supabase
        .from('forecast_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: processingError instanceof Error ? processingError.message : String(processingError),
        })
        .eq('id', runId);

      throw processingError;
    }

  } catch (error) {
    console.error('[forecast-engine] Error:', error);
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

// Helper function to generate forecast periods
function generatePeriods(timeBucket: string, horizonMonths: number): { start: Date; end: Date }[] {
  const periods: { start: Date; end: Date }[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let current = new Date(now);
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + horizonMonths);

  while (current < endDate) {
    const periodStart = new Date(current);
    let periodEnd: Date;

    switch (timeBucket) {
      case 'weekly':
        periodEnd = new Date(current);
        periodEnd.setDate(periodEnd.getDate() + 7);
        break;
      case '2-week':
        periodEnd = new Date(current);
        periodEnd.setDate(periodEnd.getDate() + 14);
        break;
      case 'monthly':
        periodEnd = new Date(current);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
      case 'quarterly':
        periodEnd = new Date(current);
        periodEnd.setMonth(periodEnd.getMonth() + 3);
        break;
      default:
        periodEnd = new Date(current);
        periodEnd.setDate(periodEnd.getDate() + 14);
    }

    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    periods.push({ start: periodStart, end: periodEnd });
    current = new Date(periodEnd);
  }

  return periods;
}
