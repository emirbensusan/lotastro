import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvitationRequest {
  email: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error('Only admins can send invitations');
    }

    const { email, role }: InvitationRequest = await req.json();

    // Use Supabase's built-in invitation system
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        role: role,
        invited_by: user.id
      },
      redirectTo: `${req.headers.get('origin')}/invite`
    });

    if (inviteError) {
      console.error('Error sending invitation:', inviteError);
      
      // Check if user already exists
      if (inviteError.message.includes('already registered') || inviteError.message.includes('already exists')) {
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
      
      throw new Error(`Failed to send invitation: ${inviteError.message}`);
    }

    // Create profile for the invited user
    if (inviteData?.user?.id) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: inviteData.user.id,
          email: email,
          role: role,
          full_name: ''
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        console.error('Warning: Failed to create profile for invited user:', profileError);
        // Don't fail the invitation if profile creation fails
      } else {
        console.log('Profile created for invited user:', inviteData.user.id);
      }
    }

    // Create invitation record for tracking
    const { error: trackingError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        invited_by: user.id,
        token: crypto.randomUUID(), // For tracking purposes
        status: 'pending'
      });

    if (trackingError) {
      console.log('Warning: Failed to create tracking record:', trackingError);
    }

    console.log('Invitation sent successfully to:', email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in send-invitation function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);