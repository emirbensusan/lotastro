import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface StockItem {
  quality: string;
  color: string;
  total_meters: number;
  available_meters: number;
}

interface QualityThreshold {
  code: string;
  low_stock_threshold_meters: number;
  critical_stock_threshold_meters: number;
  alerts_enabled: boolean;
}

// Generate HTML table for stock items
function generateStockTable(items: { quality: string; color: string; stock: number; threshold: number }[]): string {
  if (items.length === 0) {
    return '<p style="color: #666; font-style: italic;">No items in this category.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Quality</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Color</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Current Stock</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.quality}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.color}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${item.stock.toLocaleString()} m</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${item.threshold.toLocaleString()} m</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Resolve recipients from role:xxx format
async function resolveRecipients(supabase: any, recipientsConfig: string[]): Promise<string[]> {
  const emails: string[] = [];
  
  for (const recipient of recipientsConfig) {
    if (recipient.startsWith('role:')) {
      const role = recipient.replace('role:', '');
      const { data: users } = await supabase
        .from('profiles')
        .select('email')
        .eq('role', role)
        .eq('active', true);
      
      if (users) {
        emails.push(...users.map((u: { email: string }) => u.email));
      }
    } else {
      emails.push(recipient);
    }
  }
  
  return [...new Set(emails)]; // Remove duplicates
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("check-stock-alerts: Starting DIGEST stock alert check");

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

    // Get digest config
    const { data: digestConfig } = await supabase
      .from("email_digest_configs")
      .select("*")
      .eq("digest_type", "stock_alerts")
      .single();

    if (!digestConfig?.is_enabled) {
      console.log("check-stock-alerts: Stock alerts digest is disabled");
      return new Response(JSON.stringify({ message: "Stock alerts digest disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (digestConfig.last_sent_at) {
      const lastSent = new Date(digestConfig.last_sent_at);
      const cooldownMs = (digestConfig.cooldown_hours || 24) * 60 * 60 * 1000;
      if (Date.now() - lastSent.getTime() < cooldownMs) {
        console.log("check-stock-alerts: Still in cooldown period");
        return new Response(JSON.stringify({ message: "Cooldown period active" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Resolve recipients
    const recipientsConfig = digestConfig.recipients || [];
    const recipients = await resolveRecipients(supabase, recipientsConfig);

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

    // Get quality thresholds - ONLY for qualities with alerts_enabled
    const { data: qualities, error: qualitiesError } = await supabase
      .from("qualities")
      .select("code, low_stock_threshold_meters, critical_stock_threshold_meters, alerts_enabled")
      .eq("alerts_enabled", true);

    if (qualitiesError) {
      console.error("check-stock-alerts: Error fetching qualities:", qualitiesError);
      throw qualitiesError;
    }

    if (!qualities || qualities.length === 0) {
      console.log("check-stock-alerts: No qualities have alerts enabled");
      return new Response(JSON.stringify({ message: "No qualities have alerts enabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const thresholdMap = new Map<string, QualityThreshold>();
    qualities.forEach((q: QualityThreshold) => {
      thresholdMap.set(q.code.toUpperCase(), q);
    });

    // Get current stock levels
    const { data: stockData, error: stockError } = await supabase
      .rpc("get_inventory_pivot_summary");

    if (stockError) {
      console.error("check-stock-alerts: Error fetching stock:", stockError);
      throw stockError;
    }

    // Collect items by severity
    const criticalItems: { quality: string; color: string; stock: number; threshold: number }[] = [];
    const lowStockItems: { quality: string; color: string; stock: number; threshold: number }[] = [];

    for (const item of stockData || []) {
      const qualityKey = (item.quality || "").toUpperCase();
      const thresholds = thresholdMap.get(qualityKey);
      
      if (!thresholds) continue; // Skip if quality doesn't have alerts enabled

      const currentStock = item.available_meters || 0;
      const lowThreshold = thresholds.low_stock_threshold_meters || 500;
      const criticalThreshold = thresholds.critical_stock_threshold_meters || 100;

      if (currentStock <= criticalThreshold) {
        criticalItems.push({
          quality: item.quality,
          color: item.color,
          stock: currentStock,
          threshold: criticalThreshold,
        });
      } else if (currentStock <= lowThreshold) {
        lowStockItems.push({
          quality: item.quality,
          color: item.color,
          stock: currentStock,
          threshold: lowThreshold,
        });
      }
    }

    const totalCount = criticalItems.length + lowStockItems.length;

    // Dispatch webhook events for low stock alerts
    if (totalCount > 0) {
      const allItems = [
        ...criticalItems.map(item => ({ ...item, severity: 'critical' as const })),
        ...lowStockItems.map(item => ({ ...item, severity: 'low' as const })),
      ];
      
      // Call webhook dispatcher for each low stock item
      for (const item of allItems) {
        try {
          await supabase.functions.invoke('webhook-dispatcher', {
            body: {
              event: 'inventory.low_stock',
              data: {
                quality: item.quality,
                color: item.color,
                current_stock: item.stock,
                threshold: item.threshold,
                severity: item.severity,
              },
            },
          });
        } catch (webhookError) {
          console.error(`check-stock-alerts: Failed to dispatch webhook for ${item.quality}/${item.color}:`, webhookError);
          // Continue processing - webhook failure shouldn't stop email
        }
      }
      console.log(`check-stock-alerts: Dispatched ${allItems.length} low stock webhook events`);
    }

    if (totalCount === 0) {
      console.log("check-stock-alerts: No stock alerts to send");
      return new Response(JSON.stringify({ message: "No stock below thresholds" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get digest template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "stock_digest")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.error("check-stock-alerts: stock_digest template not found");
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML tables
    const criticalTable = generateStockTable(criticalItems);
    const lowStockTable = generateStockTable(lowStockItems);
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const appUrl = supabaseUrl.replace('.supabase.co', '').replace('https://', 'https://app.');

    // Replace template variables
    const subject = template.subject_en.replace("{date}", currentDate);
    const body = template.body_en
      .replace(/{date}/g, currentDate)
      .replace(/{critical_count}/g, criticalItems.length.toString())
      .replace(/{low_stock_count}/g, lowStockItems.length.toString())
      .replace(/{total_count}/g, totalCount.toString())
      .replace(/{critical_items_table}/g, criticalTable)
      .replace(/{low_stock_items_table}/g, lowStockTable)
      .replace(/{app_url}/g, "https://lotastro.lovable.app");

    if (!resend) {
      console.log("check-stock-alerts: Resend not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send ONE digest email
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
        template_key: "stock_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error_message: emailError?.message || null,
        digest_type: "stock_alerts",
        metadata: { 
          critical_count: criticalItems.length, 
          low_stock_count: lowStockItems.length,
          total_count: totalCount,
        },
      });

      // Update last_sent_at
      if (status === "sent") {
        await supabase
          .from("email_digest_configs")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("digest_type", "stock_alerts");

        // Update template send count
        await supabase
          .from("email_templates")
          .update({ 
            send_count: (template.send_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", template.id);
      }

      console.log(`check-stock-alerts: Digest ${status}. Critical: ${criticalItems.length}, Low: ${lowStockItems.length}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          digest_sent: status === "sent",
          critical_count: criticalItems.length,
          low_stock_count: lowStockItems.length,
          total_count: totalCount,
          recipients: recipients.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailErr: any) {
      console.error("check-stock-alerts: Email send error:", emailErr);
      
      await supabase.from("email_log").insert({
        template_key: "stock_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status: "failed",
        error_message: emailErr.message,
        digest_type: "stock_alerts",
      });

      return new Response(
        JSON.stringify({ error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("check-stock-alerts: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
