import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { userId, force = false, reassignToUserId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Admin ${user.email} attempting to delete user ${userId}`);

    // Check for user dependencies before deletion
    const { data: dependencies, error: depsError } = await supabaseAdmin.rpc('check_user_dependencies', {
      target_user_id: userId
    });

    if (depsError) {
      console.error('Failed to check user dependencies:', depsError);
      return new Response(
        JSON.stringify({ error: 'Failed to check user dependencies' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Check if user has any dependencies
    const totalDependencies = dependencies?.reduce((sum: number, dep: any) => sum + parseInt(dep.dependency_count), 0) || 0;
    
    if (totalDependencies > 0 && !force) {
      const dependencyDetails = dependencies?.filter((dep: any) => parseInt(dep.dependency_count) > 0)
        .map((dep: any) => `${dep.table_name}: ${dep.dependency_count}`)
        .join(', ');
      
      console.log(`Cannot delete user ${userId}: has dependencies - ${dependencyDetails}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete user with existing records',
          details: `User has associated records in: ${dependencyDetails}`,
          canDeactivate: true,
          canForceDelete: true
        }),
        { status: 409, headers: corsHeaders }
      );
    }

    // If force deletion is requested, reassign all dependent records
    if (force && totalDependencies > 0) {
      const assignToUser = reassignToUserId || user.id; // Default to current admin
      
      console.log(`Force deleting user ${userId}, reassigning records to ${assignToUser}`);
      
      try {
        // Reassign orders created by user
        await supabaseAdmin
          .from('orders')
          .update({ created_by: assignToUser })
          .eq('created_by', userId);
          
        // Reassign orders fulfilled by user
        await supabaseAdmin
          .from('orders')
          .update({ fulfilled_by: assignToUser })
          .eq('fulfilled_by', userId);
          
        // Reassign lot_queue records
        await supabaseAdmin
          .from('lot_queue')
          .update({ created_by: assignToUser })
          .eq('created_by', userId);
          
        // Reassign field_edit_queue submitted records
        await supabaseAdmin
          .from('field_edit_queue')
          .update({ submitted_by: assignToUser })
          .eq('submitted_by', userId);
          
        // Reassign field_edit_queue approved records
        await supabaseAdmin
          .from('field_edit_queue')
          .update({ approved_by: assignToUser })
          .eq('approved_by', userId);
          
        // Reassign order_queue submitted records
        await supabaseAdmin
          .from('order_queue')
          .update({ submitted_by: assignToUser })
          .eq('submitted_by', userId);
          
        // Reassign order_queue approved records
        await supabaseAdmin
          .from('order_queue')
          .update({ approved_by: assignToUser })
          .eq('approved_by', userId);
          
        // Reassign user_invitations records
        await supabaseAdmin
          .from('user_invitations')
          .update({ invited_by: assignToUser })
          .eq('invited_by', userId);
          
      } catch (reassignError) {
        console.error('Failed to reassign user dependencies:', reassignError);
        return new Response(
          JSON.stringify({ error: 'Failed to reassign user dependencies' }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

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