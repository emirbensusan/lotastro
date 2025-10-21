import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Zod validation schema
const PasswordChangeSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current user from the auth header
    const { data: currentUser, error: currentUserError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (currentUserError || !currentUser.user) {
      console.error('Error getting current user:', currentUserError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if current user is admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', currentUser.user.id)
      .single()

    if (adminError || adminProfile?.role !== 'admin') {
      console.error('Admin check failed:', adminError)
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Admin access required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse and validate request body
    let parsedData;
    try {
      const body = await req.json();
      parsedData = PasswordChangeSchema.parse(body);
    } catch (error) {
      console.error('Validation error:', error);
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed',
            details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, newPassword } = parsedData;

    // Log security event for audit trail
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'PASSWORD_CHANGE_ATTEMPT',
      user_id: currentUser.user.id,
      target_user_id: userId,
      details: { admin_id: currentUser.user.id, timestamp: new Date().toISOString() }
    });

    // Update user password using admin client
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (error) {
      console.error('Error updating password:', error)
      
      // Log failed password change
      await supabaseAdmin.rpc('log_security_event', {
        event_type: 'PASSWORD_CHANGE_FAILED',
        user_id: currentUser.user.id,
        target_user_id: userId,
        details: { error: error.message, admin_id: currentUser.user.id }
      });
      
      // Handle specific error types
      if (error.message && error.message.includes('weak')) {
        return new Response(
          JSON.stringify({ error: 'Password is too weak or commonly used. Please choose a stronger password with at least 8 characters, including numbers and special characters.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      if (error.message && error.message.includes('pwned')) {
        return new Response(
          JSON.stringify({ error: 'This password has been found in data breaches and is not secure. Please choose a different password.' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to update password: ${error.message}` }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Password changed for user ${userId} by admin ${currentUser.user.id}`)

    // Log successful password change
    await supabaseAdmin.rpc('log_security_event', {
      event_type: 'PASSWORD_CHANGE_SUCCESS',
      user_id: currentUser.user.id,
      target_user_id: userId,
      details: { admin_id: currentUser.user.id, timestamp: new Date().toISOString() }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password updated successfully',
        user: data.user 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})