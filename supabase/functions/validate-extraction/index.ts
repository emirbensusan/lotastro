import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Loading DB validation context...');

    // Fetch qualities
    const { data: qualities, error: qualitiesError } = await supabaseClient
      .from('qualities')
      .select('code, aliases');

    if (qualitiesError) throw qualitiesError;

    // Fetch quality_colors
    const { data: colors, error: colorsError } = await supabaseClient
      .from('quality_colors')
      .select('quality_code, color_label, color_code');

    if (colorsError) throw colorsError;

    // Build context maps
    const qualitiesMap: Record<string, { code: string; aliases: string[] }> = {};
    qualities.forEach(q => {
      qualitiesMap[q.code] = { code: q.code, aliases: q.aliases || [] };
    });

    const colorsByQuality: Record<string, Array<{ label: string; code: string | null }>> = {};
    const colorCodeToQualities: Record<string, string[]> = {};

    colors.forEach(c => {
      // Group by quality
      if (!colorsByQuality[c.quality_code]) {
        colorsByQuality[c.quality_code] = [];
      }
      colorsByQuality[c.quality_code].push({
        label: c.color_label,
        code: c.color_code
      });

      // Index by color code for reverse lookup
      if (c.color_code) {
        if (!colorCodeToQualities[c.color_code]) {
          colorCodeToQualities[c.color_code] = [];
        }
        if (!colorCodeToQualities[c.color_code].includes(c.quality_code)) {
          colorCodeToQualities[c.color_code].push(c.quality_code);
        }
      }
    });

    console.log(`Loaded ${qualities.length} qualities and ${colors.length} colors`);

    return new Response(JSON.stringify({
      qualities: qualitiesMap,
      colorsByQuality,
      colorCodeToQualities
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Validation context error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
