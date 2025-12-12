import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for scheduled invocations
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (cronSecret) {
      if (!providedSecret || providedSecret !== cronSecret) {
        console.log('Unauthorized: Invalid or missing CRON_SECRET');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    } else {
      console.log('Warning: CRON_SECRET not configured, endpoint is unprotected');
      return new Response(
        JSON.stringify({ error: 'Service not configured' }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting audit log cleanup...');

    // Fetch retention setting
    const { data: settingData, error: settingError } = await supabase
      .from('email_settings')
      .select('setting_value')
      .eq('setting_key', 'audit_log_retention_days')
      .single();

    let retentionDays = 365; // Default
    if (!settingError && settingData) {
      const parsed = parseInt(String(settingData.setting_value).replace(/"/g, ''));
      if (!isNaN(parsed) && parsed >= 30) {
        retentionDays = parsed;
      }
    }

    console.log(`Retention period: ${retentionDays} days`);

    // Calculate cutoff date
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    console.log(`Cutoff date: ${cutoffDate}`);

    // Count logs to be deleted
    const { count: toDeleteCount, error: countError } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDate);

    if (countError) {
      console.error('Error counting logs:', countError);
      throw countError;
    }

    console.log(`Logs to delete: ${toDeleteCount}`);

    if (toDeleteCount === 0) {
      console.log('No logs to delete');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No logs to delete',
          deletedCount: 0,
          retentionDays,
          cutoffDate
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Delete old logs in batches to avoid timeouts
    const BATCH_SIZE = 1000;
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      // Get IDs of logs to delete
      const { data: logsToDelete, error: fetchError } = await supabase
        .from('audit_logs')
        .select('id')
        .lt('created_at', cutoffDate)
        .limit(BATCH_SIZE);

      if (fetchError) {
        console.error('Error fetching logs to delete:', fetchError);
        throw fetchError;
      }

      if (!logsToDelete || logsToDelete.length === 0) {
        hasMore = false;
        break;
      }

      const ids = logsToDelete.map(log => log.id);

      // Delete this batch
      const { error: deleteError } = await supabase
        .from('audit_logs')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Error deleting logs:', deleteError);
        throw deleteError;
      }

      totalDeleted += ids.length;
      console.log(`Deleted batch of ${ids.length} logs. Total deleted: ${totalDeleted}`);

      // Check if there's more to delete
      if (ids.length < BATCH_SIZE) {
        hasMore = false;
      }
    }

    console.log(`Cleanup complete. Total deleted: ${totalDeleted}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Deleted ${totalDeleted} audit logs`,
        deletedCount: totalDeleted,
        retentionDays,
        cutoffDate
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in cleanup-old-audit-logs:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
