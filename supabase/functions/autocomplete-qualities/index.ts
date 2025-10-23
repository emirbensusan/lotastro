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

    // Search by code or aliases (case-insensitive LIKE)
    const { data: qualityData, error } = await supabaseClient
      .from('qualities')
      .select('code, aliases')
      .limit(50); // Get more results to filter by aliases

    if (error) throw error;

    // Filter results: match code OR any alias
    const normalizedQuery = query.toUpperCase();
    const filtered = qualityData?.filter(q => 
      q.code.toUpperCase().includes(normalizedQuery) ||
      q.aliases?.some((alias: string) => alias.toUpperCase().includes(normalizedQuery))
    ).slice(0, 10) || [];

    console.log(`Autocomplete qualities: query="${query}" returned ${filtered.length} results`);

    return new Response(JSON.stringify(filtered), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Autocomplete qualities error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
