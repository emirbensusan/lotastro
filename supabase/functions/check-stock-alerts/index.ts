import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface StockItem {
  quality: string;
  color: string;
  total_meters: number;
}

interface QualityThreshold {
  code: string;
  low_stock_threshold_meters: number;
  critical_stock_threshold_meters: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("check-stock-alerts: Starting stock alert check");

  // Validate CRON_SECRET for scheduled runs
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("check-stock-alerts: Invalid or missing CRON_SECRET");
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

    // Check if stock alerts are enabled
    const { data: enabledSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "stock_alerts_enabled")
      .single();

    if (enabledSetting?.setting_value !== "true" && enabledSetting?.setting_value !== true) {
      console.log("check-stock-alerts: Stock alerts are disabled");
      return new Response(JSON.stringify({ message: "Stock alerts disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get recipients
    const { data: recipientsSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "stock_alerts_recipients")
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
      console.log("check-stock-alerts: No recipients configured");
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

    // Get quality thresholds
    const { data: qualities, error: qualitiesError } = await supabase
      .from("qualities")
      .select("code, low_stock_threshold_meters, critical_stock_threshold_meters");

    if (qualitiesError) {
      console.error("check-stock-alerts: Error fetching qualities:", qualitiesError);
      throw qualitiesError;
    }

    const thresholdMap = new Map<string, QualityThreshold>();
    (qualities || []).forEach((q: QualityThreshold) => {
      thresholdMap.set(q.code.toUpperCase(), q);
    });

    // Get current stock levels
    const { data: stockData, error: stockError } = await supabase
      .rpc("get_inventory_pivot_summary");

    if (stockError) {
      console.error("check-stock-alerts: Error fetching stock:", stockError);
      throw stockError;
    }

    // Get templates
    const { data: lowStockTemplate } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "low_stock_alert")
      .eq("is_active", true)
      .single();

    const { data: criticalTemplate } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "critical_stock_alert")
      .eq("is_active", true)
      .single();

    const alerts: { type: string; quality: string; color: string; stock: number; threshold: number }[] = [];
    const emailsSent: { recipient: string; subject: string; status: string }[] = [];

    // Check each stock item
    for (const item of stockData || []) {
      const qualityKey = (item.quality || "").toUpperCase();
      const thresholds = thresholdMap.get(qualityKey);
      
      if (!thresholds) continue;

      const currentStock = item.available_meters || 0;
      const lowThreshold = thresholds.low_stock_threshold_meters || 500;
      const criticalThreshold = thresholds.critical_stock_threshold_meters || 100;

      // Check if already alerted recently (within 24 hours) for this item
      const alertKey = `${item.quality}-${item.color}`;
      const { data: recentLog } = await supabase
        .from("email_log")
        .select("id")
        .in("template_key", ["low_stock_alert", "critical_stock_alert"])
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .ilike("metadata->>'quality'", item.quality)
        .ilike("metadata->>'color'", item.color)
        .limit(1);

      if (recentLog && recentLog.length > 0) {
        continue; // Already alerted recently
      }

      let template = null;
      let alertType = "";

      if (currentStock <= criticalThreshold) {
        template = criticalTemplate;
        alertType = "critical";
      } else if (currentStock <= lowThreshold) {
        template = lowStockTemplate;
        alertType = "low";
      }

      if (template && resend) {
        alerts.push({
          type: alertType,
          quality: item.quality,
          color: item.color,
          stock: currentStock,
          threshold: alertType === "critical" ? criticalThreshold : lowThreshold,
        });

        // Send email
        const subject = template.subject_en
          .replace("{quality}", item.quality)
          .replace("{color}", item.color);
        
        const body = template.body_en
          .replace(/{quality}/g, item.quality)
          .replace(/{color}/g, item.color)
          .replace(/{current_stock}/g, currentStock.toString())
          .replace(/{threshold}/g, (alertType === "critical" ? criticalThreshold : lowThreshold).toString());

        try {
          const { error: emailError } = await resend.emails.send({
            from: `${senderName} <${senderEmail}>`,
            to: recipients,
            subject,
            html: body,
          });

          const status = emailError ? "failed" : "sent";
          
          // Log the email
          await supabase.from("email_log").insert({
            template_key: alertType === "critical" ? "critical_stock_alert" : "low_stock_alert",
            recipient: recipients.join(", "),
            subject,
            status,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            error_message: emailError?.message || null,
            metadata: { quality: item.quality, color: item.color, stock: currentStock },
          });

          emailsSent.push({ recipient: recipients.join(", "), subject, status });
          console.log(`check-stock-alerts: ${alertType} alert sent for ${item.quality} ${item.color}`);
        } catch (emailErr: any) {
          console.error("check-stock-alerts: Email send error:", emailErr);
          await supabase.from("email_log").insert({
            template_key: alertType === "critical" ? "critical_stock_alert" : "low_stock_alert",
            recipient: recipients.join(", "),
            subject,
            status: "failed",
            error_message: emailErr.message,
            metadata: { quality: item.quality, color: item.color, stock: currentStock },
          });
        }
      }
    }

    console.log(`check-stock-alerts: Completed. ${alerts.length} alerts, ${emailsSent.length} emails sent`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alerts_found: alerts.length, 
        emails_sent: emailsSent.length,
        alerts,
        emails: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("check-stock-alerts: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
