import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { 
  deterministicExtract, 
  ParsedLine,
  mergeDeterministicAndLLM
} from '../_shared/extraction-lib.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_LINES = 20;

interface ExtractRequest {
  pasteText?: string;
  filePath?: string;
  sourceType?: 'paste' | 'pdf' | 'image';
  userId: string;
  note?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body: ExtractRequest = await req.json();
    const { pasteText, filePath, sourceType, userId, note } = body;

    console.log('[extract-order] Request received:', { 
      hasText: !!pasteText, 
      filePath, 
      sourceType, 
      userId 
    });

    if (!pasteText && !filePath) {
      return new Response(
        JSON.stringify({ error: 'no_input', message: 'Either pasteText or filePath is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'no_user', message: 'userId is required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let rawText = pasteText ?? '';
    let usedVision = false;
    let actualSourceType = sourceType || 'paste';

    // If file provided, download and extract text
    if (!rawText && filePath) {
      console.log('[extract-order] Downloading file:', filePath);
      
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('ai_order_uploads')
        .download(filePath);

      if (downloadError) {
        console.error('[extract-order] Download error:', downloadError);
        return new Response(
          JSON.stringify({ error: 'download_failed', message: downloadError.message }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (fileData.size > MAX_BYTES) {
        return new Response(
          JSON.stringify({ error: 'file_too_large', maxMB: 2 }), 
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For images, use Vision OCR via Lovable AI
      if (actualSourceType === 'image') {
        console.log('[extract-order] Using Vision OCR for image');
        usedVision = true;
        
        const imageBuffer = await fileData.arrayBuffer();
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        const imageUrl = `data:image/jpeg;base64,${base64Image}`;

        const ocrResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Lütfen bu görüntüdeki metni çıkarın. Tüm metni olduğu gibi döndürün. Sipariş bilgileri, kalite kodları, renkler ve metre miktarlarını içeren tüm satırları çıkarın.',
                  },
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl },
                  },
                ],
              },
            ],
          }),
        });

        if (!ocrResponse.ok) {
          const errorText = await ocrResponse.text();
          console.error('[extract-order] OCR error:', ocrResponse.status, errorText);
          
          if (ocrResponse.status === 429) {
            return new Response(
              JSON.stringify({ error: 'rate_limit', message: 'AI rate limit exceeded' }), 
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (ocrResponse.status === 402) {
            return new Response(
              JSON.stringify({ error: 'payment_required', message: 'AI credits depleted' }), 
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          throw new Error(`OCR failed: ${errorText}`);
        }

        const ocrData = await ocrResponse.json();
        rawText = ocrData.choices?.[0]?.message?.content || '';
        console.log('[extract-order] OCR extracted text length:', rawText.length);
      } else if (actualSourceType === 'pdf') {
        // For PDF, we'd need a PDF parser - for now, return error
        return new Response(
          JSON.stringify({ error: 'pdf_not_supported', message: 'PDF parsing not yet implemented. Please paste text or upload an image.' }), 
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!rawText || rawText.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'no_text', message: 'No text could be extracted' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-order] Starting deterministic extraction');
    
    // Step 1: Deterministic extraction
    let rows = deterministicExtract(rawText);
    console.log('[extract-order] Deterministic extraction found', rows.length, 'rows');

    // Step 2: LLM extraction for ambiguous rows
    const needsHelp = rows.filter(r => r.extraction_status !== 'ok');
    console.log('[extract-order] Rows needing LLM help:', needsHelp.length);

    if (needsHelp.length > 0) {
      console.log('[extract-order] Using LLM for ambiguous rows');
      
      const llmPrompt = `Görevin: Aşağıdaki sipariş metinlerinden kalite, renk ve metre bilgilerini çıkarmak.

KURALLAR:
- Yalnızca şu alanları döndür: quality, color, meters, source_row, extraction_status
- Kesin değilsen: o alanı null bırak ve extraction_status='needs_review'
- Hayal ürün/renk üretme
- Metre birimini sayıya çevir (ör. '1.720 MT' → 1720, '10,5 mt' → 10.5)
- Renk kodları (1463, 1522 gibi) sayısal ise olduğu gibi döndür
- Quality kodları: V710, V-710, SU200, KDB02 gibi

METİN:
${rawText}

Beklenen JSON (array döndür):
[
  {"quality":"V710","color":"LOVAT","meters":10,"source_row":"...","extraction_status":"ok"},
  ...
]`;

      try {
        const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Sen bir sipariş veri çıkarma asistanısın. Sadece JSON döndür.' },
              { role: 'user', content: llmPrompt },
            ],
          }),
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const llmContent = llmData.choices?.[0]?.message?.content || '[]';
          
          // Try to extract JSON from the response
          const jsonMatch = llmContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const llmRows: ParsedLine[] = JSON.parse(jsonMatch[0]);
            console.log('[extract-order] LLM extracted', llmRows.length, 'rows');
            rows = mergeDeterministicAndLLM(rows, llmRows);
          }
        } else {
          console.warn('[extract-order] LLM extraction failed, using deterministic only');
        }
      } catch (llmError) {
        console.error('[extract-order] LLM error:', llmError);
        // Continue with deterministic results only
      }
    }

    // Limit to MAX_LINES
    if (rows.length > MAX_LINES) {
      console.log(`[extract-order] Limiting to ${MAX_LINES} rows`);
      rows = rows.slice(0, MAX_LINES);
    }

    // Create draft record
    const draftId = crypto.randomUUID();
    console.log('[extract-order] Creating draft:', draftId);

    const { error: draftError } = await supabase
      .from('po_drafts')
      .insert({
        id: draftId,
        created_by: userId,
        source_type: actualSourceType,
        source_object_path: filePath || null,
        note: note || null,
        status: 'draft',
      });

    if (draftError) {
      console.error('[extract-order] Draft creation error:', draftError);
      throw draftError;
    }

    // Create draft lines
    const lines = rows.map((r, i) => ({
      draft_id: draftId,
      line_no: i + 1,
      quality: r.quality,
      color: r.color,
      meters: r.meters,
      source_row: r.source_row,
      extraction_status: r.extraction_status,
    }));

    const { error: linesError } = await supabase
      .from('po_draft_lines')
      .insert(lines);

    if (linesError) {
      console.error('[extract-order] Lines creation error:', linesError);
      throw linesError;
    }

    // Log AI usage
    await supabase.from('ai_usage').insert({
      draft_id: draftId,
      used_vision: usedVision,
      tokens_in: rawText.length / 4, // Rough estimate
      tokens_out: 100, // Rough estimate
    });

    console.log('[extract-order] Success:', { draftId, rowCount: rows.length });

    return new Response(
      JSON.stringify({ 
        draftId, 
        rows,
        message: `Successfully extracted ${rows.length} order lines`,
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[extract-order] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'extraction_failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
