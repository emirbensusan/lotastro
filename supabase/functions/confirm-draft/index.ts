import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmRequest {
  draftId: string;
  userId: string;
}

interface AggregatedLine {
  quality: string;
  color: string;
  meters: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: ConfirmRequest = await req.json();
    const { draftId, userId } = body;

    console.log('[confirm-draft] Request received:', { draftId, userId });

    if (!draftId || !userId) {
      return new Response(
        JSON.stringify({ error: 'missing_params', message: 'draftId and userId are required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify draft exists and belongs to user
    const { data: draft, error: draftError } = await supabase
      .from('po_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('created_by', userId)
      .single();

    if (draftError || !draft) {
      console.error('[confirm-draft] Draft not found:', draftError);
      return new Response(
        JSON.stringify({ error: 'draft_not_found', message: 'Draft not found or access denied' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (draft.status !== 'draft') {
      return new Response(
        JSON.stringify({ error: 'already_confirmed', message: 'Draft already confirmed or cancelled' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all lines for this draft
    const { data: lines, error: linesError } = await supabase
      .from('po_draft_lines')
      .select('quality, color, meters, extraction_status')
      .eq('draft_id', draftId)
      .order('line_no');

    if (linesError || !lines || lines.length === 0) {
      console.error('[confirm-draft] No lines found:', linesError);
      return new Response(
        JSON.stringify({ error: 'no_lines', message: 'No lines found for this draft' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[confirm-draft] Found', lines.length, 'lines');

    // Validate all lines
    const invalid = lines.some(l => 
      !l.quality || 
      !l.color || 
      !l.meters || 
      l.meters <= 0 || 
      l.extraction_status !== 'ok'
    );

    if (invalid) {
      const invalidLines = lines.filter(l => 
        !l.quality || !l.color || !l.meters || l.meters <= 0 || l.extraction_status !== 'ok'
      );
      console.warn('[confirm-draft] Invalid lines found:', invalidLines);
      
      return new Response(
        JSON.stringify({ 
          error: 'needs_review_remaining', 
          message: 'Some lines still need review or have missing/invalid data',
          invalidCount: invalidLines.length,
        }), 
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate by quality + color
    const grouped = new Map<string, number>();
    
    for (const line of lines) {
      const key = `${line.quality}||${line.color}`;
      const currentMeters = grouped.get(key) || 0;
      grouped.set(key, currentMeters + Number(line.meters));
    }

    console.log('[confirm-draft] Aggregated into', grouped.size, 'unique combinations');

    // Create aggregated result
    const aggregated: AggregatedLine[] = Array.from(grouped.entries()).map(([key, totalMeters]) => {
      const [quality, color] = key.split('||');
      return {
        quality,
        color,
        meters: Number(totalMeters.toFixed(2)),
      };
    });

    // Update draft status to confirmed
    const { error: updateError } = await supabase
      .from('po_drafts')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', draftId);

    if (updateError) {
      console.error('[confirm-draft] Update error:', updateError);
      throw updateError;
    }

    console.log('[confirm-draft] Success:', { draftId, aggregatedCount: aggregated.length });

    return new Response(
      JSON.stringify({ 
        draftId, 
        aggregated,
        message: `Confirmed ${lines.length} lines into ${aggregated.length} order items`,
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[confirm-draft] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'confirmation_failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
