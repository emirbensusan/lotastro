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
    // Support both GET and POST
    let query = '';
    let qualityCode: string | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json();
      query = body.query || '';
      qualityCode = body.quality || null;
    } else {
      const url = new URL(req.url);
      query = url.searchParams.get('query') || '';
      qualityCode = url.searchParams.get('quality');
    }

    console.log(`[autocomplete-colors] Query: "${query}", Quality: "${qualityCode || 'all'}"`);

    // Minimum 3 characters required
    if (query.length < 3) {
      console.log(`[autocomplete-colors] Query too short, returning empty`);
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use SERVICE_ROLE key to bypass RLS (read-only queries)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    console.log(`[autocomplete-colors] Returned ${data?.length || 0} results for "${query}", quality="${qualityCode || 'all'}"`);

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
