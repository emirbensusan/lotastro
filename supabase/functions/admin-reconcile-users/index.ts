import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconcileResult {
  createdProfiles: number;
  reactivatedProfiles: number;
  inactivatedProfiles: number;
  unchanged: number;
  details: string[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin check failed:', profileError);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${user.email} starting user reconciliation`);

    const result: ReconcileResult = {
      createdProfiles: 0,
      reactivatedProfiles: 0,
      inactivatedProfiles: 0,
      unchanged: 0,
      details: []
    };

    // Step 1: Get all auth users
    let authUsers: any[] = [];
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage
      });

      if (error) {
        console.error('Error listing auth users:', error);
        throw error;
      }

      if (!data.users || data.users.length === 0) break;
      
      authUsers = authUsers.concat(data.users);
      
      if (data.users.length < perPage) break;
      page++;
    }

    console.log(`Found ${authUsers.length} auth users`);

    // Step 2: Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} profiles`);

    const profilesByUserId = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const profilesByEmail = new Map(profiles?.map(p => [p.email.toLowerCase(), p]) || []);

    // Step 3: For each auth user, ensure profile exists
    for (const authUser of authUsers) {
      const existingProfile = profilesByUserId.get(authUser.id);

      if (!existingProfile) {
        // Check if there's a profile with matching email (orphaned profile)
        const emailProfile = profilesByEmail.get(authUser.email.toLowerCase());
        
        if (emailProfile) {
          // Update existing profile to link to this auth user
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              user_id: authUser.id,
              active: true,
              deleted_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', emailProfile.id);

          if (updateError) {
            console.error(`Failed to reactivate profile for ${authUser.email}:`, updateError);
            result.details.push(`❌ Failed to reactivate ${authUser.email}: ${updateError.message}`);
          } else {
            result.reactivatedProfiles++;
            result.details.push(`✓ Reactivated profile for ${authUser.email}`);
            console.log(`Reactivated profile for ${authUser.email}`);
          }
        } else {
          // Create new profile
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: authUser.id,
              email: authUser.email,
              full_name: authUser.user_metadata?.full_name || '',
              role: authUser.user_metadata?.role || 'warehouse_staff',
              active: true
            });

          if (insertError) {
            console.error(`Failed to create profile for ${authUser.email}:`, insertError);
            result.details.push(`❌ Failed to create ${authUser.email}: ${insertError.message}`);
          } else {
            result.createdProfiles++;
            result.details.push(`✓ Created profile for ${authUser.email}`);
            console.log(`Created profile for ${authUser.email}`);
          }
        }
      } else if (!existingProfile.active) {
        // Reactivate inactive profile
        const { error: reactivateError } = await supabase
          .from('profiles')
          .update({
            active: true,
            deleted_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', authUser.id);

        if (reactivateError) {
          console.error(`Failed to reactivate ${authUser.email}:`, reactivateError);
          result.details.push(`❌ Failed to reactivate ${authUser.email}: ${reactivateError.message}`);
        } else {
          result.reactivatedProfiles++;
          result.details.push(`✓ Reactivated ${authUser.email}`);
          console.log(`Reactivated ${authUser.email}`);
        }
      } else {
        result.unchanged++;
      }
    }

    // Step 4: Check for profiles without auth users (orphaned profiles)
    const authUserIds = new Set(authUsers.map(u => u.id));
    
    for (const profile of profiles || []) {
      if (!authUserIds.has(profile.user_id) && profile.active) {
        // Mark profile as inactive (auth user was deleted)
        const { error: deactivateError } = await supabase
          .from('profiles')
          .update({
            active: false,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', profile.user_id);

        if (deactivateError) {
          console.error(`Failed to deactivate orphaned profile ${profile.email}:`, deactivateError);
          result.details.push(`❌ Failed to deactivate ${profile.email}: ${deactivateError.message}`);
        } else {
          result.inactivatedProfiles++;
          result.details.push(`✓ Deactivated orphaned profile ${profile.email}`);
          console.log(`Deactivated orphaned profile ${profile.email}`);
        }
      }
    }

    console.log('Reconciliation complete:', result);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        message: `Reconciliation complete: ${result.createdProfiles} created, ${result.reactivatedProfiles} reactivated, ${result.inactivatedProfiles} inactivated, ${result.unchanged} unchanged`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Error in reconcile-users function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
};

serve(handler);