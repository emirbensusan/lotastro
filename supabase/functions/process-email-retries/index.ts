import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("process-email-retries: Starting email retry processing");

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("process-email-retries: Invalid or missing CRON_SECRET");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    if (!resend) {
      console.log("process-email-retries: Resend not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get default retry config
    const { data: retryConfigSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "retry_config_default")
      .single();

    const defaultRetryConfig = retryConfigSetting?.setting_value 
      ? (typeof retryConfigSetting.setting_value === 'string' 
          ? JSON.parse(retryConfigSetting.setting_value) 
          : retryConfigSetting.setting_value)
      : { max_retries: 3, backoff_seconds: [60, 300, 900] };

    // Get failed emails that need retry
    const { data: failedEmails, error: fetchError } = await supabase
      .from("email_log")
      .select("*, email_templates!email_log_template_id_fkey(*)")
      .eq("status", "failed")
      .lt("retry_count", defaultRetryConfig.max_retries)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
      .limit(10); // Process 10 at a time

    if (fetchError) {
      console.error("process-email-retries: Error fetching failed emails:", fetchError);
      throw fetchError;
    }

    if (!failedEmails || failedEmails.length === 0) {
      console.log("process-email-retries: No emails to retry");
      return new Response(JSON.stringify({ message: "No emails to retry" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`process-email-retries: Found ${failedEmails.length} emails to retry`);

    // Get email sender
    const { data: senderSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "email_sender")
      .single();

    let senderEmail = "noreply@depo.lotastro.com";
    let senderName = "LotAstro";
    if (senderSetting?.setting_value) {
      const sender = typeof senderSetting.setting_value === 'string'
        ? JSON.parse(senderSetting.setting_value)
        : senderSetting.setting_value;
      senderEmail = sender.email || senderEmail;
      senderName = sender.name || senderName;
    }

    const results: { id: string; status: string; error?: string }[] = [];

    for (const email of failedEmails) {
      const retryCount = (email.retry_count || 0) + 1;
      const template = email.email_templates;

      console.log(`process-email-retries: Retrying email ${email.id}, attempt ${retryCount}`);

      try {
        // Get the body content - try to reconstruct from template if available
        let htmlBody = '';
        if (template) {
          // Use stored template body - we don't have the variables anymore
          // So we'll need to store the rendered body in metadata for retries
          htmlBody = email.metadata?.rendered_body || template.body_en || '';
        }

        const { error: emailError } = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: email.recipient.split(', '),
          subject: email.subject,
          html: htmlBody || `<p>This is a retry of a previously failed email.</p><p>Original subject: ${email.subject}</p>`,
        });

        if (emailError) {
          throw new Error(emailError.message);
        }

        // Update as sent
        await supabase
          .from("email_log")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            retry_count: retryCount,
            error_message: null,
          })
          .eq("id", email.id);

        results.push({ id: email.id, status: "sent" });
        console.log(`process-email-retries: Email ${email.id} sent successfully on retry ${retryCount}`);

      } catch (retryError: any) {
        console.error(`process-email-retries: Retry failed for ${email.id}:`, retryError);

        // Calculate next retry time
        const backoffSeconds = defaultRetryConfig.backoff_seconds[retryCount - 1] || 
                               defaultRetryConfig.backoff_seconds[defaultRetryConfig.backoff_seconds.length - 1];
        const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000);

        if (retryCount >= defaultRetryConfig.max_retries) {
          // Max retries reached - mark as permanently failed
          await supabase
            .from("email_log")
            .update({
              status: "permanently_failed",
              retry_count: retryCount,
              error_message: `Max retries (${defaultRetryConfig.max_retries}) reached. Last error: ${retryError.message}`,
            })
            .eq("id", email.id);

          // Create in-app notification as fallback
          await supabase.functions.invoke("send-in-app-notification", {
            body: {
              type: "email_failed",
              title: "Email Delivery Failed",
              message: `Email "${email.subject}" to ${email.recipient} failed after ${retryCount} attempts.`,
              recipients: ["role:admin"],
              metadata: { email_log_id: email.id },
            },
          });

          results.push({ id: email.id, status: "permanently_failed", error: retryError.message });
        } else {
          // Schedule next retry
          await supabase
            .from("email_log")
            .update({
              retry_count: retryCount,
              next_retry_at: nextRetryAt.toISOString(),
              error_message: retryError.message,
            })
            .eq("id", email.id);

          results.push({ id: email.id, status: "retry_scheduled", error: retryError.message });
        }
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "permanently_failed").length;
    const scheduled = results.filter(r => r.status === "retry_scheduled").length;

    console.log(`process-email-retries: Completed. Sent: ${sent}, Failed: ${failed}, Scheduled: ${scheduled}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        sent,
        permanently_failed: failed,
        retry_scheduled: scheduled,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-email-retries: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
