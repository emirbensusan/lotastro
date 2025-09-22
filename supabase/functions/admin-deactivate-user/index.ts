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
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.error('Invalid authorization header format');
      return new Response(
        JSON.stringify({ error: 'Invalid authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify JWT token using service role client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      console.error('User verification failed:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Invalid token or user not found' }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log(`Verifying admin role for user: ${user.email}`);

    // Check if user has admin role using service role client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Profile lookup failed:', profileError.message);
      return new Response(
        JSON.stringify({ error: 'Profile lookup failed' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (profile?.role !== 'admin') {
      console.error(`Access denied. User ${user.email} has role: ${profile?.role}`);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin role required' }),
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

    console.log(`Admin ${user.email} attempting to deactivate user ${userId}`);

    // Log security event for audit trail
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'USER_DEACTIVATE_ATTEMPT',
      user_id: user.id,
      target_user_id: userId,
      details: { admin_email: user.email, timestamp: new Date().toISOString() }
    });

    // Deactivate user by setting active to false
    const { error: deactivateError } = await supabaseAdmin
      .from('profiles')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    
    if (deactivateError) {
      console.error('Failed to deactivate user:', deactivateError);
      
      // Log failed deactivation attempt
      await supabaseAdmin.rpc('log_security_event', {
        event_type: 'USER_DEACTIVATE_FAILED',
        user_id: user.id,
        target_user_id: userId,
        details: { error: deactivateError.message, admin_email: user.email }
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to deactivate user' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`User ${userId} successfully deactivated by admin ${user.email}`);

    // Log successful deactivation
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'USER_DEACTIVATE_SUCCESS',
      user_id: user.id,
      target_user_id: userId,
      details: { admin_email: user.email, timestamp: new Date().toISOString() }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-deactivate-user function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});