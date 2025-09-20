import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the service role key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the request comes from an authenticated admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Create client with user token to verify admin role
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: {
        headers: { authorization: authHeader }
      }
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin check failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: corsHeaders }
      );
    }

    // Parse request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Admin ${user.email} attempting to delete user ${userId}`);

    // Log security event for audit trail
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'USER_DELETE_ATTEMPT',
      user_id: user.id,
      target_user_id: userId,
      details: { admin_email: user.email, timestamp: new Date().toISOString() }
    });

    // Delete user using service role
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Failed to delete user:', deleteError);
      
      // Log failed deletion attempt
      await supabaseAdmin.rpc('log_security_event', {
        event_type: 'USER_DELETE_FAILED',
        user_id: user.id,
        target_user_id: userId,
        details: { error: deleteError.message, admin_email: user.email }
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to delete user' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`User ${userId} successfully deleted by admin ${user.email}`);

    // Log successful deletion
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'USER_DELETE_SUCCESS',
      user_id: user.id,
      target_user_id: userId,
      details: { admin_email: user.email, timestamp: new Date().toISOString() }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-delete-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});