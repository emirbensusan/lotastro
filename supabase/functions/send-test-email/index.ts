import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestEmailRequest {
  templateId: string;
  recipientEmail: string;
  language: 'en' | 'tr';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing send-test-email request...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Verify the user is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { templateId, recipientEmail, language }: TestEmailRequest = await req.json();

    if (!templateId || !recipientEmail || !language) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: templateId, recipientEmail, language' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the template
    const { data: template, error: templateError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subject and body based on language
    const subject = language === 'tr' ? template.subject_tr : template.subject_en;
    const body = language === 'tr' ? template.body_tr : template.body_en;

    // Replace variables with sample data
    const sampleData: Record<string, string> = {
      mo_number: 'MO-20241208-001',
      quality: 'P200',
      color: 'Navy Blue',
      ordered_meters: '5,000',
      supplier: 'Sample Textile Corp',
      eta: '2024-12-15',
      status: 'IN_PRODUCTION',
      customer: 'Acme Corporation',
      overdue_days: '3',
      reservation_number: 'RES-20241208-001',
      order_number: 'ORD-20241208-001',
      lot_number: 'LOT-001',
      meters: '1,500',
      date: new Date().toISOString().split('T')[0],
    };

    let finalSubject = subject;
    let finalBody = body;

    // Also use variables_meta if available
    if (template.variables_meta && Array.isArray(template.variables_meta)) {
      template.variables_meta.forEach((v: any) => {
        if (v.name && v.example) {
          sampleData[v.name] = v.example;
        }
      });
    }

    // Replace all variables
    Object.entries(sampleData).forEach(([key, value]) => {
      const pattern = new RegExp(`\\{${key}\\}`, 'g');
      finalSubject = finalSubject.replace(pattern, value);
      finalBody = finalBody.replace(pattern, value);
    });

    // Add test email notice
    const testNotice = language === 'tr'
      ? '<div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; margin-bottom: 16px; border-radius: 4px;"><strong>⚠️ TEST E-POSTASI</strong><br/>Bu, örnek verilerle gönderilmiş bir test e-postasıdır.</div>'
      : '<div style="background-color: #fef3c7; border: 1px solid #f59e0b; padding: 12px; margin-bottom: 16px; border-radius: 4px;"><strong>⚠️ TEST EMAIL</strong><br/>This is a test email sent with sample data.</div>';

    finalBody = testNotice + finalBody;

    console.log(`Sending test email to ${recipientEmail} using template ${template.name}`);

    // Send the test email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'LotAstro <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `[TEST] ${finalSubject}`,
      html: finalBody,
    });

    if (emailError) {
      console.error('Resend error:', emailError);
      return new Response(
        JSON.stringify({ error: emailError.message || 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Test email sent successfully to ${recipientEmail}`, emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test email sent to ${recipientEmail}`,
        emailId: emailResult?.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-test-email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);