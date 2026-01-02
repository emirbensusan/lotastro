import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[calculate-forecast-accuracy] Starting accuracy calculation...');

    // Get the latest completed forecast run
    const { data: latestRun, error: runError } = await supabase
      .from('forecast_runs')
      .select('id, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError || !latestRun) {
      console.log('[calculate-forecast-accuracy] No completed forecast runs found');
      return new Response(
        JSON.stringify({ success: true, message: 'No completed runs to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calculate-forecast-accuracy] Analyzing run: ${latestRun.id}`);

    // Get forecast results from completed periods (periods that have ended)
    const today = new Date().toISOString().split('T')[0];
    
    const { data: forecasts, error: forecastError } = await supabase
      .from('forecast_results')
      .select('*')
      .eq('run_id', latestRun.id)
      .eq('scenario', 'base')
      .lt('period_end', today);

    if (forecastError) throw forecastError;

    console.log(`[calculate-forecast-accuracy] Found ${forecasts?.length || 0} completed forecast periods`);

    if (!forecasts || forecasts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No completed forecast periods to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get actual demand for those periods
    const accuracyRecords: any[] = [];
    let totalAbsoluteError = 0;
    let totalPercentageError = 0;
    let totalBias = 0;
    let itemsWithActuals = 0;
    let hitsWithin20Percent = 0;

    for (const forecast of forecasts) {
      // Get actual demand for this quality/color in this period
      const { data: actualData } = await supabase
        .from('demand_history')
        .select('amount')
        .eq('quality_code', forecast.quality_code)
        .eq('color_code', forecast.color_code)
        .gte('demand_date', forecast.period_start)
        .lte('demand_date', forecast.period_end);

      const actualAmount = (actualData || []).reduce((sum, d) => sum + d.amount, 0);

      // Only calculate accuracy if there's actual data
      if (actualAmount > 0 || forecast.forecast_amount > 0) {
        const absoluteError = Math.abs(forecast.forecast_amount - actualAmount);
        const percentageError = actualAmount > 0 
          ? (absoluteError / actualAmount) * 100 
          : (forecast.forecast_amount > 0 ? 100 : 0);
        const bias = actualAmount > 0 
          ? ((forecast.forecast_amount - actualAmount) / actualAmount) * 100 
          : 0;

        accuracyRecords.push({
          quality_code: forecast.quality_code,
          color_code: forecast.color_code,
          period_start: forecast.period_start,
          period_end: forecast.period_end,
          forecasted_amount: forecast.forecast_amount,
          actual_amount: actualAmount,
          forecast_run_id: latestRun.id,
        });

        if (actualAmount > 0) {
          totalAbsoluteError += absoluteError;
          totalPercentageError += percentageError;
          totalBias += bias;
          itemsWithActuals++;

          if (percentageError <= 20) {
            hitsWithin20Percent++;
          }
        }
      }
    }

    console.log(`[calculate-forecast-accuracy] Processed ${itemsWithActuals} items with actuals`);

    // Insert accuracy records (upsert to handle duplicates)
    if (accuracyRecords.length > 0) {
      // Batch insert in chunks
      const BATCH_SIZE = 100;
      for (let i = 0; i < accuracyRecords.length; i += BATCH_SIZE) {
        const batch = accuracyRecords.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('forecast_accuracy')
          .upsert(batch, { 
            onConflict: 'quality_code,color_code,period_start,period_end,forecast_run_id' 
          });

        if (insertError) {
          console.error('[calculate-forecast-accuracy] Error inserting accuracy records:', insertError);
        }
      }
    }

    // Calculate aggregate metrics
    if (itemsWithActuals > 0) {
      const mape = totalPercentageError / itemsWithActuals;
      const mae = totalAbsoluteError / itemsWithActuals;
      const bias = totalBias / itemsWithActuals;
      const hitRate = (hitsWithin20Percent / itemsWithActuals) * 100;

      // Calculate RMSE
      let sumSquaredErrors = 0;
      for (const record of accuracyRecords) {
        if (record.actual_amount > 0) {
          sumSquaredErrors += Math.pow(record.forecasted_amount - record.actual_amount, 2);
        }
      }
      const rmse = Math.sqrt(sumSquaredErrors / itemsWithActuals);

      const calculationDate = new Date().toISOString().split('T')[0];

      // Insert global metrics
      const { error: metricsError } = await supabase
        .from('forecast_accuracy_metrics')
        .upsert({
          calculation_date: calculationDate,
          quality_code: null,
          color_code: null,
          period_type: 'monthly',
          total_items: itemsWithActuals,
          mape,
          mae,
          rmse,
          bias,
          hit_rate: hitRate,
          forecast_run_id: latestRun.id,
        }, { onConflict: 'calculation_date,quality_code,color_code,period_type' });

      if (metricsError) {
        console.error('[calculate-forecast-accuracy] Error inserting metrics:', metricsError);
      }

      console.log(`[calculate-forecast-accuracy] Metrics calculated - MAPE: ${mape.toFixed(2)}%, Hit Rate: ${hitRate.toFixed(2)}%`);

      return new Response(
        JSON.stringify({
          success: true,
          metrics: {
            mape: parseFloat(mape.toFixed(2)),
            mae: parseFloat(mae.toFixed(2)),
            rmse: parseFloat(rmse.toFixed(2)),
            bias: parseFloat(bias.toFixed(2)),
            hit_rate: parseFloat(hitRate.toFixed(2)),
            total_items: itemsWithActuals,
          },
          accuracy_records: accuracyRecords.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'No items with actual data to compare' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-forecast-accuracy] Error:', error);
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
