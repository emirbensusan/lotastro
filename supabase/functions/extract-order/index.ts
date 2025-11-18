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
const MAX_LINES = 100; // PHASE 1H: Increased from 20 to support long order lists

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

    console.log('[extract-order] Loading DB validation context...');
    console.log(`[extract-order] Raw text preview (first 100 chars): "${rawText.substring(0, 100)}..."`);
    
    // Load DB context for validation
    let dbContext;
    try {
      const { data: validationData, error: dbError } = await supabase.functions.invoke('validate-extraction');
      if (dbError) {
        console.warn('[extract-order] ⚠️  Could not load DB context:', dbError);
        console.warn('[extract-order] Extraction will proceed without DB validation');
      } else if (!validationData || !validationData.qualities) {
        console.warn('[extract-order] ⚠️  DB context returned invalid structure');
      } else {
        dbContext = validationData;
        const qualityCount = Object.keys(dbContext.qualities).length;
        const colorCount = Object.keys(dbContext.colorsByQuality).reduce((sum, q) => sum + dbContext.colorsByQuality[q].length, 0);
        console.log(`[extract-order] ✓ DB context loaded: ${qualityCount} qualities, ${colorCount} colors`);
      }
    } catch (dbErr) {
      console.warn('[extract-order] ⚠️  DB context load exception:', dbErr);
    }
    
    console.log('[extract-order] Starting deterministic extraction');
    
    // Step 1: Deterministic extraction with DB validation
    let rows = deterministicExtract(rawText, dbContext);
    console.log('[extract-order] Deterministic extraction found', rows.length, 'rows');

    // PHASE 4B: Selective LLM calling - only for low confidence lines
    const needsLLM = rows.filter(r => 
      (r.confidence_score ?? 0) < 0.8 && 
      r.intent_type !== 'noise' && 
      r.extraction_status === 'needs_review'
    );
    console.log('[extract-order] Rows needing LLM help:', needsLLM.length, 'out of', rows.length);

    if (needsLLM.length > 0) {
      console.log('[extract-order] Using LLM for low-confidence rows');
      
      const dbQualitiesHint = dbContext 
        ? `\nKnown Quality Codes: ${Object.keys(dbContext.qualities).slice(0, 30).join(', ')}` 
        : '';
      
      // PHASE 4A: Intent-aware LLM prompt with classification
      const llmPrompt = `You are extracting textile/lining orders from Turkish/English mixed customer emails.

INTENT TYPES (classify each line):
- 'order': Firm order with quality+color+meters (sevk, sipariş, işleme alır mısınız)
- 'sample_request': Sample/numune request (numune, A4 parça, kartela)
- 'stock_inquiry': Stock availability question (stok var mı, mevcut mu, hazırda)
- 'reservation': Reservation/blocking (opsiyon, bloke, RF)
- 'update': Order correction (eksik, revize, arttırıyorum, yerine)
- 'approval': Color approval (okeylendi, onaylanmıştır)
- 'shipping': Delivery instruction (sevk edebilir misiniz, nakliye, adrese)
- 'price_request': Price/proforma request (proforma, fiyat + quality+color)
- 'noise': Greetings, unstructured text (merhaba, iyi çalışmalar, EUR/USD alone)

RULES:
- Only use values from database${dbQualitiesHint}
- If uncertain: leave field null and set extraction_status='needs_review'
- DO NOT invent products/colors
- Turkish number formats: "110,000 Metre" → 110000, "1.720 MT" → 1720, "10,5 mt" → 10.5
- Calculate expressions: 2x10 → 20, 10+5 → 15
- Preserve quality suffixes (P777W, V710F, VC710)
- Return color codes as-is (E123, 130414, 40046)
- Inherit quality from headers for bullet lists
- For sample_request: look for "A4" → quantity_unit='A4', quantity_value=1
- For stock_inquiry: is_firm_order=false
- For reservation: is_option_or_blocked=true
- Skip 'noise' intent entirely

EXAMPLES:

Example 1 - Firm order:
"753074 E123 1160MT"
→ {"intent_type":"order","quality":"P200","color":"E123","meters":1160,"quantity_unit":"MT","is_firm_order":true,"confidence_score":0.95,"extraction_status":"ok"}

Example 2 - Grouped orders:
"Toray Taffeta P200
• Cafe creme 40046 = 80 mt
• Portwine 29 = 80 mt"
→ [
  {"intent_type":"order","quality":"P200","color":"40046","meters":80,"quantity_unit":"MT","is_firm_order":true,"confidence_score":0.9,"extraction_status":"ok"},
  {"intent_type":"order","quality":"P200","color":"29","meters":80,"quantity_unit":"MT","is_firm_order":true,"confidence_score":0.9,"extraction_status":"ok"}
]

Example 3 - Sample request:
"VARSA P777 PLUM 376 A4"
→ {"intent_type":"sample_request","quality":"P777","color":"376","meters":null,"quantity_value":1,"quantity_unit":"A4","is_sample":true,"confidence_score":0.85,"extraction_status":"ok"}

Example 4 - Stock inquiry:
"V710 AUBERGINE 130402 STOK VARMI"
→ {"intent_type":"stock_inquiry","quality":"V710","color":"130402","meters":null,"is_firm_order":false,"confidence_score":0.9,"extraction_status":"ok"}

Example 5 - Noise (ignore):
"Merhaba İyi çalışmalar" → SKIP (noise intent)
"1,65 EUR" → YOK SAY (fiyat)

ŞİMDİ AYIKLA:
${rawText}

SADECE JSON array döndür (açıklama yok):
[
  {"quality":"...","color":"...","meters":...,"source_row":"...","extraction_status":"ok"},
  ...
]`;

      try {
        const inputLines = needsLLM.map(r => r.source_row).join('\n');
        const llmResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                content: llmPrompt + '\n\nLINES TO EXTRACT:\n' + inputLines + 
                  '\n\nReturn a JSON array (one element per line). Response must be pure JSON only (no explanation).'
              }
            ]
          })
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          const llmContent = llmData.choices?.[0]?.message?.content || '[]';
          
          // Try to extract JSON from the response
          const jsonMatch = llmContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const llmRows: ParsedLine[] = JSON.parse(jsonMatch[0]);
            console.log('[extract-order] LLM extracted', llmRows.length, 'rows');
            
            const beforeMerge = rows.filter(r => r.extraction_status === 'ok').length;
            rows = mergeDeterministicAndLLM(rows, llmRows);
            const afterMerge = rows.filter(r => r.extraction_status === 'ok').length;
            const llmContributed = rows.filter(r => r.resolution_source === 'llm').length;
            
            console.log(`[extract-order] Merge complete: ${beforeMerge} → ${afterMerge} OK rows, LLM contributed to ${llmContributed} rows`);
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
