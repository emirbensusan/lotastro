import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETENTION_DAYS = 90;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log(`[cleanup-old-drafts] Starting cleanup (retention: ${RETENTION_DAYS} days)`);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    console.log('[cleanup-old-drafts] Cutoff date:', cutoffISO);

    // Find old drafts
    const { data: oldDrafts, error: fetchError } = await supabase
      .from('po_drafts')
      .select('id, source_object_path, status, created_at')
      .lt('created_at', cutoffISO);

    if (fetchError) {
      console.error('[cleanup-old-drafts] Fetch error:', fetchError);
      throw fetchError;
    }

    if (!oldDrafts || oldDrafts.length === 0) {
      console.log('[cleanup-old-drafts] No old drafts found');
      return new Response(
        JSON.stringify({ 
          message: 'No old drafts to clean up',
          deletedCount: 0,
        }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[cleanup-old-drafts] Found', oldDrafts.length, 'old drafts');

    let deletedFiles = 0;
    let deletedDrafts = 0;
    const errors: string[] = [];

    // Process each old draft
    for (const draft of oldDrafts) {
      console.log(`[cleanup-old-drafts] Processing draft ${draft.id} (${draft.status}, ${draft.created_at})`);

      // Delete storage file if exists
      if (draft.source_object_path) {
        try {
          const { error: deleteFileError } = await supabase.storage
            .from('ai_order_uploads')
            .remove([draft.source_object_path]);

          if (deleteFileError) {
            console.warn(`[cleanup-old-drafts] Failed to delete file ${draft.source_object_path}:`, deleteFileError);
            errors.push(`File ${draft.source_object_path}: ${deleteFileError.message}`);
          } else {
            deletedFiles++;
            console.log(`[cleanup-old-drafts] Deleted file: ${draft.source_object_path}`);
          }
        } catch (fileError) {
          console.warn('[cleanup-old-drafts] File deletion error:', fileError);
          errors.push(`File ${draft.source_object_path}: ${fileError instanceof Error ? fileError.message : 'Unknown'}`);
        }
      }

      // Delete draft (this will cascade delete lines and ai_usage)
      try {
        const { error: deleteDraftError } = await supabase
          .from('po_drafts')
          .delete()
          .eq('id', draft.id);

        if (deleteDraftError) {
          console.error(`[cleanup-old-drafts] Failed to delete draft ${draft.id}:`, deleteDraftError);
          errors.push(`Draft ${draft.id}: ${deleteDraftError.message}`);
        } else {
          deletedDrafts++;
          console.log(`[cleanup-old-drafts] Deleted draft: ${draft.id}`);
        }
      } catch (draftError) {
        console.error('[cleanup-old-drafts] Draft deletion error:', draftError);
        errors.push(`Draft ${draft.id}: ${draftError instanceof Error ? draftError.message : 'Unknown'}`);
      }
    }

    console.log('[cleanup-old-drafts] Cleanup complete:', {
      processedDrafts: oldDrafts.length,
      deletedDrafts,
      deletedFiles,
      errorCount: errors.length,
    });

    return new Response(
      JSON.stringify({ 
        message: 'Cleanup complete',
        processedDrafts: oldDrafts.length,
        deletedDrafts,
        deletedFiles,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[cleanup-old-drafts] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'cleanup_failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
