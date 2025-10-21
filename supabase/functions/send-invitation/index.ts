import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zod validation schema
const InvitationSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .transform(val => val.toLowerCase().trim()),
  role: z.enum(['admin', 'warehouse_staff', 'accounting', 'senior_manager'], {
    errorMap: () => ({ message: 'Role must be one of: admin, warehouse_staff, accounting, senior_manager' })
  })
});

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

    console.log("Verifying admin role for user:", user.email);

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

    // Parse and validate request body with Zod
    let parsedData;
    try {
      const body = await req.json();
      parsedData = InvitationSchema.parse(body);
    } catch (error) {
      console.error('Validation error:', error);
      if (error instanceof z.ZodError) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed',
            code: 'INVALID_INPUT',
            details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Invalid request body', code: 'INVALID_INPUT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email: normalizedEmail, role } = parsedData;

    console.log(`Admin ${user.email} inviting:`, { email: normalizedEmail, role });

    // PRE-FLIGHT CHECK 1: Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('email, user_id, active')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      console.log('Profile already exists:', existingProfile);
      return new Response(
        JSON.stringify({ 
          error: 'User already exists',
          code: 'USER_EXISTS',
          details: `A user with email ${email} already has an account. Use password reset or edit the existing user instead.`
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRE-FLIGHT CHECK 2: Check if auth user exists (without profile - ghost user)
    let authUsers: any[] = [];
    let page = 1;
    
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data.users || data.users.length === 0) break;
      authUsers = authUsers.concat(data.users);
      if (data.users.length < 1000) break;
      page++;
    }

    const existingAuthUser = authUsers.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (existingAuthUser) {
      console.log('Auth user exists without profile (ghost user):', existingAuthUser.email);
      return new Response(
        JSON.stringify({ 
          error: 'Auth user exists without profile',
          code: 'AUTH_ONLY_USER',
          details: `User ${email} exists in authentication but has no profile. Click "Reconcile Users" to fix this issue, then try again.`,
          userId: existingAuthUser.id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invite token and link
    const inviteToken = crypto.randomUUID();
    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://depo.lotastro.com';
    const inviteLink = `${origin}/invite?token=${inviteToken}`;

    console.log('Sending invitation via Supabase auth...');

    // Attempt to send invitation via Supabase
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        data: { role, full_name: '' },
        redirectTo: `${origin}/invite`
      }
    );

    let emailSent = false;
    let emailError = null;
    let statusCode = 200;
    let errorCode = null;

    if (inviteError) {
      console.error('Supabase invitation error:', inviteError);
      emailSent = false;
      emailError = inviteError.message;

      // Categorize the error for better UX
      if (inviteError.message.includes('already registered') || 
          inviteError.message.includes('already exists') ||
          inviteError.message.includes('User already registered')) {
        errorCode = 'USER_EXISTS';
        statusCode = 409;
      } else if (inviteError.message.includes('rate limit') || 
                 inviteError.message.includes('too many')) {
        errorCode = 'RATE_LIMIT';
        statusCode = 429;
      } else if (inviteError.message.includes('email') || 
                 inviteError.message.includes('smtp') ||
                 inviteError.message.includes('delivery')) {
        errorCode = 'EMAIL_DELIVERY';
        statusCode = 503;
      } else if (inviteError.message.includes('invalid email')) {
        errorCode = 'INVALID_EMAIL';
        statusCode = 400;
      } else {
        errorCode = 'INVITATION_FAILED';
        statusCode = 500;
      }

      console.log('Email sending failed, but will still create invitation with shareable link');
    } else {
      emailSent = true;
      console.log('Email sent successfully via Supabase');
    }

    // Create profile for the invited user (even if email failed)
    const userId = inviteData?.user?.id || crypto.randomUUID();
    
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        email: normalizedEmail,
        full_name: '',
        role: role as any,
        active: true
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't fail completely - we can still proceed with invitation record
    } else {
      console.log("Profile created for invited user:", userId);
    }

    // Always create invitation record with tracking info
    const { error: invitationError } = await supabase
      .from('user_invitations')
      .insert({
        email: normalizedEmail,
        role: role as any,
        invited_by: user.id,
        token: inviteToken,
        status: 'pending',
        email_sent: emailSent,
        email_error: emailError,
        last_attempt_at: new Date().toISOString(),
        invite_link: inviteLink
      });

    if (invitationError) {
      console.error('Error creating invitation record:', invitationError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create invitation record',
          details: invitationError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Invitation created for ${normalizedEmail} (email_sent: ${emailSent})`);

    // If email failed, return error with invite link for manual sharing
    if (!emailSent) {
      const errorMessages: Record<string, string> = {
        'USER_EXISTS': 'User already exists. Use password reset instead.',
        'RATE_LIMIT': 'Too many invitations sent. Please wait a few minutes and try again.',
        'EMAIL_DELIVERY': 'Email delivery failed. Use the shareable link below to invite the user manually.',
        'INVALID_EMAIL': 'Invalid email address format.',
        'INVITATION_FAILED': 'Failed to send invitation email. Use the shareable link below to invite the user manually.'
      };

      return new Response(
        JSON.stringify({ 
          error: errorMessages[errorCode!] || 'Failed to send invitation email',
          code: errorCode,
          details: emailError,
          invite_link: inviteLink,
          email_sent: false
        }),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Success response with invite link
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Invitation sent successfully',
        email_sent: true,
        invite_link: inviteLink,
        userId: userId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error.message
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);