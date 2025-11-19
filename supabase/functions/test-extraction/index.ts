import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { 
  deterministicExtract, 
  ParsedLine 
} from '../_shared/extraction-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestRequest {
  text: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: TestRequest = await req.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'no_text', message: 'Text is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[test-extraction] Testing extraction on', text.split('\n').length, 'lines');
    
    // Load DB context
    let dbContext;
    try {
      const { data: validationData, error: dbError } = await supabase.functions.invoke('validate-extraction');
      if (!dbError && validationData) {
        dbContext = validationData;
      }
    } catch (dbErr) {
      console.warn('[test-extraction] Could not load DB context:', dbErr);
    }
    
    // Step 1: Pre-processing
    const rawLines = text.split('\n').filter(l => l.trim().length > 0);
    const preprocessingResult = {
      originalLineCount: rawLines.length,
      normalizedText: text,
      detectedSections: [] as string[],
    };
    
    // Step 2: Deterministic extraction
    const extractedRows = deterministicExtract(text, dbContext);
    
    // Step 3: Statistics
    const intentCounts = extractedRows.reduce((acc, r) => {
      const intent = r.intent_type || 'unknown';
      acc[intent] = (acc[intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const statusCounts = extractedRows.reduce((acc, r) => {
      acc[r.extraction_status] = (acc[r.extraction_status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const avgConfidence = extractedRows.length > 0
      ? extractedRows.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / extractedRows.length
      : 0;
    
    const needsLLM = extractedRows.filter(r => 
      (r.confidence_score ?? 0) < 0.8 && 
      r.intent_type !== 'noise' &&
      r.extraction_status === 'needs_review'
    );
    
    // Step 4: Build detailed response
    const result = {
      preprocessing: preprocessingResult,
      extraction: {
        totalLines: extractedRows.length,
        byIntent: intentCounts,
        byStatus: statusCounts,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        needsLLM: needsLLM.length,
        llmPercentage: Math.round((needsLLM.length / extractedRows.length) * 100),
      },
      rows: extractedRows.map((r, idx) => ({
        lineNumber: idx + 1,
        sourceRow: r.source_row,
        intentType: r.intent_type,
        quality: r.quality,
        color: r.color,
        meters: r.meters,
        quantityUnit: r.quantity_unit,
        isFirmOrder: r.is_firm_order,
        isSample: r.is_sample,
        isOptionOrBlocked: r.is_option_or_blocked,
        customerName: r.customer_name,
        referenceNumbers: r.reference_numbers,
        confidenceScore: r.confidence_score,
        extractionStatus: r.extraction_status,
        resolutionSource: r.resolution_source,
        deliveryNotes: r.delivery_notes,
        conflictInfo: r.conflict_info,
      })),
      dbContext: dbContext ? {
        qualityCount: Object.keys(dbContext.qualities || {}).length,
        colorCount: Object.values(dbContext.colorsByQuality || {}).reduce((sum: number, colors: any) => sum + colors.length, 0),
        sampleQualities: Object.keys(dbContext.qualities || {}).slice(0, 10),
      } : null,
      summary: {
        totalExtracted: extractedRows.length,
        okCount: statusCounts.ok || 0,
        needsReviewCount: statusCounts.needs_review || 0,
        successRate: Math.round(((statusCounts.ok || 0) / extractedRows.length) * 100),
      }
    };

    return new Response(
      JSON.stringify(result), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error: any) {
    console.error('[test-extraction] Error:', error);
    return new Response(
      JSON.stringify({ error: 'extraction_failed', message: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
