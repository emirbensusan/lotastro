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
    const url = new URL(req.url);
    const query = url.searchParams.get('query') || '';
    const qualityCode = url.searchParams.get('quality');

    // Minimum 3 characters required
    if (query.length < 3) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    let queryBuilder = supabaseClient
      .from('quality_colors')
      .select('quality_code, color_label, color_code')
      .ilike('color_label', `%${query}%`)
      .limit(10);

    // If quality specified, filter by it
    if (qualityCode) {
      queryBuilder = queryBuilder.eq('quality_code', qualityCode);
    }

    const { data, error } = await queryBuilder;

    if (error) throw error;

    console.log(`Autocomplete colors: query="${query}" quality="${qualityCode || 'all'}" returned ${data?.length || 0} results`);

    return new Response(JSON.stringify(data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Autocomplete colors error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
