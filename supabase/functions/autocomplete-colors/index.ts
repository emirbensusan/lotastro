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

    // Search by color_label OR color_code (case-insensitive)
    let queryBuilder = supabaseClient
      .from('quality_colors')
      .select('quality_code, color_label, color_code');

    // If quality specified, filter by it
    if (qualityCode) {
      queryBuilder = queryBuilder.eq('quality_code', qualityCode);
    }

    // Execute query and filter in code (since Supabase doesn't support OR on ilike easily)
    const { data: allData, error } = await queryBuilder.limit(100);
    
    if (error) throw error;

    // Filter by color_label OR color_code
    const normalizedQuery = query.toUpperCase();
    const data = allData?.filter(c => 
      c.color_label.toUpperCase().includes(normalizedQuery) ||
      (c.color_code && c.color_code.toUpperCase().includes(normalizedQuery))
    ).slice(0, 10) || [];

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
