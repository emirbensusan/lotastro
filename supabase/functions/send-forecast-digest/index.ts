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

  console.log("send-forecast-digest: Starting weekly digest");

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("send-forecast-digest: Invalid or missing CRON_SECRET");
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

    // Check if forecast digest is enabled
    const { data: enabledSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "forecast_digest_enabled")
      .single();

    if (enabledSetting?.setting_value !== "true" && enabledSetting?.setting_value !== true) {
      console.log("send-forecast-digest: Forecast digest is disabled");
      return new Response(JSON.stringify({ message: "Forecast digest disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipients
    const { data: recipientsSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "forecast_digest_recipients")
      .single();

    let recipients: string[] = [];
    try {
      const parsed = typeof recipientsSetting?.setting_value === 'string'
        ? JSON.parse(recipientsSetting.setting_value)
        : recipientsSetting?.setting_value;
      recipients = Array.isArray(parsed) ? parsed : [];
    } catch {
      recipients = [];
    }

    if (recipients.length === 0) {
      console.log("send-forecast-digest: No recipients configured");
      return new Response(JSON.stringify({ message: "No recipients configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Get latest forecast run
    const { data: latestRun } = await supabase
      .from("forecast_runs")
      .select("id, status, completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      console.log("send-forecast-digest: No completed forecast runs found");
      return new Response(JSON.stringify({ message: "No forecast data available" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recommendations from latest run
    const { data: recommendations } = await supabase
      .from("purchase_recommendations")
      .select("*")
      .eq("run_id", latestRun.id);

    // Get alerts from latest run
    const { data: alerts } = await supabase
      .from("forecast_alerts")
      .select("*")
      .eq("run_id", latestRun.id)
      .eq("is_resolved", false);

    const totalCombinations = recommendations?.length || 0;
    const atRiskCount = alerts?.filter(a => a.alert_type === "stockout").length || 0;
    const overstockCount = alerts?.filter(a => a.alert_type === "overstock").length || 0;

    // Build items table
    const topAtRisk = (alerts || [])
      .filter(a => a.alert_type === "stockout")
      .slice(0, 10);

    let itemsTable = '<table style="border-collapse: collapse; width: 100%;">';
    itemsTable += '<tr style="background-color: #f3f4f6;"><th style="padding: 8px; border: 1px solid #ddd;">Quality</th><th style="padding: 8px; border: 1px solid #ddd;">Color</th><th style="padding: 8px; border: 1px solid #ddd;">Current Stock</th><th style="padding: 8px; border: 1px solid #ddd;">Severity</th></tr>';
    
    for (const item of topAtRisk) {
      const severityColor = item.severity === "critical" ? "#dc2626" : "#f59e0b";
      itemsTable += `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.quality_code}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.color_code}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.current_stock} ${item.unit}</td>
        <td style="padding: 8px; border: 1px solid #ddd; color: ${severityColor}; font-weight: bold;">${item.severity}</td>
      </tr>`;
    }
    itemsTable += '</table>';

    if (topAtRisk.length === 0) {
      itemsTable = '<p style="color: #16a34a;">No items at risk! ✓</p>';
    }

    // Build recommendations table
    const topRecommendations = (recommendations || [])
      .filter(r => r.normal_recommendation > 0)
      .sort((a, b) => b.normal_recommendation - a.normal_recommendation)
      .slice(0, 10);

    let recommendationsTable = '<table style="border-collapse: collapse; width: 100%;">';
    recommendationsTable += '<tr style="background-color: #f3f4f6;"><th style="padding: 8px; border: 1px solid #ddd;">Quality</th><th style="padding: 8px; border: 1px solid #ddd;">Color</th><th style="padding: 8px; border: 1px solid #ddd;">Recommended Order</th></tr>';
    
    for (const rec of topRecommendations) {
      recommendationsTable += `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${rec.quality_code}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${rec.color_code}</td>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${rec.normal_recommendation} ${rec.unit}</td>
      </tr>`;
    }
    recommendationsTable += '</table>';

    if (topRecommendations.length === 0) {
      recommendationsTable = '<p style="color: #16a34a;">No orders recommended at this time.</p>';
    }

    // Get template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "forecast_weekly_digest")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.log("send-forecast-digest: Template not found or inactive");
      return new Response(JSON.stringify({ message: "Template not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });

    const appUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") || "https://app.lotastro.com";

    const subject = template.subject_en.replace("{date}", today);
    const body = template.body_en
      .replace(/{date}/g, today)
      .replace(/{total_combinations}/g, totalCombinations.toString())
      .replace(/{at_risk_count}/g, atRiskCount.toString())
      .replace(/{overstock_count}/g, overstockCount.toString())
      .replace(/{items_table}/g, itemsTable)
      .replace(/{recommendations_table}/g, recommendationsTable)
      .replace(/{app_url}/g, appUrl);

    if (!resend) {
      console.log("send-forecast-digest: Resend not configured");
      return new Response(JSON.stringify({ message: "Email service not configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: emailError } = await resend.emails.send({
      from: `${senderName} <${senderEmail}>`,
      to: recipients,
      subject,
      html: body,
    });

    const status = emailError ? "failed" : "sent";

    // Log the email
    await supabase.from("email_log").insert({
      template_key: "forecast_weekly_digest",
      recipient: recipients.join(", "),
      subject,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error_message: emailError?.message || null,
      metadata: { 
        total_combinations: totalCombinations, 
        at_risk_count: atRiskCount, 
        overstock_count: overstockCount 
      },
    });

    console.log(`send-forecast-digest: Completed. Status: ${status}`);

    return new Response(
      JSON.stringify({ 
        success: status === "sent", 
        status,
        recipients: recipients.length,
        summary: { totalCombinations, atRiskCount, overstockCount },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-forecast-digest: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
