import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@2.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Generate invitation token
    const token_value = crypto.randomUUID();

    // Create invitation record
    const { error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role,
        invited_by: user.id,
        token: token_value,
        status: 'pending'
      });

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      throw new Error('Failed to create invitation');
    }

    // Send invitation email
    const invitationUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'supabase.co')}/invite?token=${token_value}`;
    
    const emailResponse = await resend.emails.send({
      from: 'LotAstro <onboarding@resend.dev>',
      to: [email],
      subject: 'You\'re invited to join LotAstro',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin-bottom: 10px;">LotAstro</h1>
            <h2 style="color: #334155; margin-top: 0;">You're Invited!</h2>
          </div>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.5;">
            You've been invited to join LotAstro as a <strong>${role.replace('_', ' ')}</strong>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationUrl}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">
              Accept Invitation
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This invitation will expire in 7 days. If you have any questions, please contact your administrator.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${invitationUrl}" style="color: #2563eb; word-break: break-all;">${invitationUrl}</a>
          </p>
        </div>
      `,
    });

    console.log('Invitation email sent:', emailResponse);

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