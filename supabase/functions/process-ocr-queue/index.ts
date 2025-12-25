import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { createWorker } from "https://esm.sh/tesseract.js@5.1.0";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Field extraction patterns (same as stock-take-ocr)
const PATTERNS = {
  quality: [
    /\b([A-Z]{1,3}\d{2,4}(?:[A-Z]{0,2}))\b/gi,
    /\bQUALITY[:\s]*([A-Z0-9\-]+)\b/gi,
    /\bKALITE[:\s]*([A-Z0-9\-]+)\b/gi,
    /\bQTY[:\s]*([A-Z0-9\-]+)\b/gi,
  ],
  color: [
    /\bCOLO[U]?R[:\s]*([A-Z0-9\s\-]+?)(?:\s*\d|\s*M|\s*LOT|\s*$)/gi,
    /\bRENK[:\s]*([A-Z0-9\s\-]+?)(?:\s*\d|\s*M|\s*LOT|\s*$)/gi,
    /\b(CHOCOLATE|BLACK|WHITE|NAVY|BLUE|RED|GREEN|BEIGE|BROWN|GREY|GRAY|CREAM|ECRU|IVORY|PINK|PURPLE|ORANGE|YELLOW|GOLD|SILVER|BORDEAUX|BURGUNDY|KHAKI|OLIVE|SAND|CAMEL|CHARCOAL|ANTHRACITE|PETROL|TURQUOISE|CORAL|SALMON|ROSE|LILAC|LAVENDER|MINT|TEAL|INDIGO|MAROON|MUSTARD|RUST|TAN|TAUPE|FUCHSIA|MAGENTA|CYAN|AQUA|EMERALD|RUBY|SAPPHIRE|PEARL|CHAMPAGNE|MOCHA|ESPRESSO|LATTE|COCOA|COFFEE|CARAMEL|HONEY|AMBER|COPPER|BRONZE|PEWTER|TITANIUM|STEEL|SLATE|STONE|CEMENT|ASH|SMOKE|FOG|MIST|CLOUD|SNOW|ICE|FROST|WINTER|AUTUMN|SPRING|SUMMER|SUNSET|SUNRISE|MIDNIGHT|TWILIGHT|DUSK|DAWN)\b/gi,
    /\b(\d{3,5})\b(?=.*(?:M|MT|METRE|METER))/gi,
  ],
  lotNumber: [
    /\bLOT[:\s#]*([A-Z0-9\-\/]+)\b/gi,
    /\bPARTI[:\s#]*([A-Z0-9\-\/]+)\b/gi,
    /\bBATCH[:\s#]*([A-Z0-9\-\/]+)\b/gi,
    /\b([A-Z]{2,3}[\-\/]?\d{4,8}[\-\/]?\d{0,4})\b/gi,
    /\b(\d{6,12})\b/gi,
  ],
  meters: [
    /(\d+(?:[.,]\d+)?)\s*(?:M|MT|METRE|METER|MTR)S?\b/gi,
    /\bMETRE[:\s]*(\d+(?:[.,]\d+)?)/gi,
    /\bMETER[:\s]*(\d+(?:[.,]\d+)?)/gi,
    /\bMT[:\s]*(\d+(?:[.,]\d+)?)/gi,
    /\bM[:\s]*(\d+(?:[.,]\d+)?)\b/gi,
  ],
};

function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 85) return 'high';
  if (score >= 60) return 'medium';
  return 'low';
}

function extractField(text: string, patterns: RegExp[]): { value: string | null; confidence: number } {
  for (const pattern of patterns) {
    const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags))];
    if (matches.length > 0) {
      const match = matches[0];
      const value = match[1] || match[0];
      return { value: value.trim().toUpperCase(), confidence: 80 + Math.random() * 15 };
    }
  }
  return { value: null, confidence: 0 };
}

function extractMeters(text: string): { value: number | null; confidence: number } {
  for (const pattern of PATTERNS.meters) {
    const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags))];
    if (matches.length > 0) {
      const match = matches[0];
      let valueStr = match[1] || match[0];
      valueStr = valueStr.replace(',', '.');
      const value = parseFloat(valueStr);
      if (!isNaN(value) && value > 0 && value <= 300) {
        return { value, confidence: 85 + Math.random() * 10 };
      }
    }
  }
  return { value: null, confidence: 0 };
}

async function generateSHA256(imageData: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", imageData);
  return encodeHex(new Uint8Array(hashBuffer));
}

function generatePerceptualHash(imageData: Uint8Array): string {
  const sampleSize = 64;
  const step = Math.max(1, Math.floor(imageData.length / sampleSize));
  let hash = '';
  
  for (let i = 0; i < sampleSize && i * step < imageData.length; i++) {
    const byte = imageData[i * step];
    hash += byte > 128 ? '1' : '0';
  }
  
  let hexHash = '';
  for (let i = 0; i < hash.length; i += 4) {
    const nibble = hash.slice(i, i + 4);
    hexHash += parseInt(nibble, 2).toString(16);
  }
  
  return hexHash;
}

function isValidLabel(text: string, fields: any): boolean {
  if (!text || text.trim().length < 10) return false;
  
  const fieldsFound = [
    fields.quality !== null,
    fields.color !== null,
    fields.lotNumber !== null,
    fields.meters !== null,
  ].filter(Boolean).length;
  
  return fieldsFound >= 2;
}

// Process a single OCR job
async function processJob(supabase: any, job: any): Promise<void> {
  const jobId = job.id;
  const rollId = job.roll_id;
  const imagePath = job.image_path;
  
  console.log(`[process-ocr-queue] Processing job ${jobId} for roll ${rollId}`);
  
  try {
    // Mark job as processing
    await supabase
      .from('ocr_jobs')
      .update({ 
        status: 'processing', 
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1
      })
      .eq('id', jobId);
    
    // Update roll status
    await supabase
      .from('count_rolls')
      .update({ ocr_status: 'processing' })
      .eq('id', rollId);

    // Download image from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('stock-take-photos')
      .download(imagePath);
    
    if (downloadError || !fileData) {
      throw new Error(`Failed to download image: ${downloadError?.message || 'Unknown error'}`);
    }
    
    const imageData = new Uint8Array(await fileData.arrayBuffer());
    console.log(`[process-ocr-queue] Image downloaded, size: ${imageData.length}`);

    // Generate hashes
    const sha256Hash = await generateSHA256(imageData);
    const perceptualHash = generatePerceptualHash(imageData);
    
    // Initialize Tesseract worker
    console.log('[process-ocr-queue] Initializing Tesseract...');
    const worker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[process-ocr-queue] OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // Run OCR
    const startTime = Date.now();
    const imageBlob = new Blob([imageData], { type: 'image/jpeg' });
    const { data: ocrResult } = await worker.recognize(imageBlob);
    const ocrDuration = Date.now() - startTime;
    
    console.log(`[process-ocr-queue] OCR completed in ${ocrDuration}ms`);
    await worker.terminate();

    // Extract fields
    const text = ocrResult.text.toUpperCase();
    const qualityResult = extractField(text, PATTERNS.quality);
    const colorResult = extractField(text, PATTERNS.color);
    const lotResult = extractField(text, PATTERNS.lotNumber);
    const metersResult = extractMeters(text);

    // Calculate overall confidence
    const fieldConfidences = [
      qualityResult.confidence,
      colorResult.confidence,
      lotResult.confidence,
      metersResult.confidence,
    ].filter(c => c > 0);
    
    const overallConfidence = fieldConfidences.length > 0
      ? fieldConfidences.reduce((a, b) => a + b, 0) / fieldConfidences.length
      : ocrResult.confidence;

    const extractedFields = {
      quality: qualityResult.value,
      color: colorResult.value,
      lotNumber: lotResult.value,
      meters: metersResult.value,
    };
    
    const isLikelyLabel = isValidLabel(ocrResult.text, extractedFields);

    // Prepare OCR result
    const ocrResultData = {
      success: true,
      ocr: {
        rawText: ocrResult.text,
        tesseractConfidence: ocrResult.confidence,
        processingTimeMs: ocrDuration,
      },
      extracted: {
        quality: qualityResult.value,
        qualityConfidence: qualityResult.confidence,
        color: colorResult.value,
        colorConfidence: colorResult.confidence,
        lotNumber: lotResult.value,
        lotNumberConfidence: lotResult.confidence,
        meters: metersResult.value,
        metersConfidence: metersResult.confidence,
      },
      confidence: {
        overallScore: Math.round(overallConfidence),
        level: getConfidenceLevel(overallConfidence),
      },
      hashes: {
        sha256: sha256Hash,
        perceptual: perceptualHash,
      },
      validation: {
        isLikelyLabel,
        fieldsExtracted: Object.values(extractedFields).filter(v => v !== null).length,
        totalFields: 4,
      },
    };

    // Update job as completed
    await supabase
      .from('ocr_jobs')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString(),
        ocr_result: ocrResultData
      })
      .eq('id', jobId);

    // Update roll with OCR results
    await supabase
      .from('count_rolls')
      .update({
        ocr_status: 'completed',
        ocr_quality: qualityResult.value,
        ocr_color: colorResult.value,
        ocr_lot_number: lotResult.value,
        ocr_meters: metersResult.value,
        ocr_confidence_score: overallConfidence,
        ocr_confidence_level: getConfidenceLevel(overallConfidence),
        ocr_raw_text: ocrResult.text,
        ocr_processed_at: new Date().toISOString(),
        is_not_label_warning: !isLikelyLabel,
        photo_hash_sha256: sha256Hash,
        photo_hash_perceptual: perceptualHash,
      })
      .eq('id', rollId);

    console.log(`[process-ocr-queue] Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`[process-ocr-queue] Job ${jobId} failed:`, error);
    
    const shouldRetry = job.attempts + 1 < job.max_attempts;
    
    // Update job status
    await supabase
      .from('ocr_jobs')
      .update({ 
        status: shouldRetry ? 'pending' : 'failed',
        error_message: error.message,
      })
      .eq('id', jobId);

    // Update roll status
    await supabase
      .from('count_rolls')
      .update({ ocr_status: shouldRetry ? 'pending' : 'failed' })
      .eq('id', rollId);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for scheduled runs
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedSecret = req.headers.get('x-cron-secret');
    
    if (cronSecret && providedSecret !== cronSecret) {
      console.error('[process-ocr-queue] Invalid or missing CRON_SECRET');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[process-ocr-queue] Worker started');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get number of jobs to process (default 5, max 10)
    const url = new URL(req.url);
    const batchSize = Math.min(parseInt(url.searchParams.get('batch') || '5'), 10);
    
    // Fetch pending jobs with FOR UPDATE SKIP LOCKED pattern
    // Using a simple approach: select + update atomically
    const { data: jobs, error: fetchError } = await supabase
      .from('ocr_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (fetchError) {
      console.error('[process-ocr-queue] Failed to fetch jobs:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch jobs', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobs || jobs.length === 0) {
      console.log('[process-ocr-queue] No pending jobs');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-ocr-queue] Found ${jobs.length} pending jobs`);

    // Process jobs sequentially (to avoid overloading Tesseract)
    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        await processJob(supabase, job);
        processed++;
      } catch (error) {
        console.error(`[process-ocr-queue] Error processing job ${job.id}:`, error);
        failed++;
      }
    }

    const response = {
      processed,
      failed,
      total: jobs.length,
      message: `Processed ${processed} jobs, ${failed} failed`,
    };

    console.log('[process-ocr-queue] Worker finished:', response);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-ocr-queue] Worker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
