import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Generate HTML table for pending catalog items
function generateCatalogTable(items: { 
  sku: string; 
  code: string; 
  color_name: string;
  type: string;
  created_at: string;
}[]): string {
  if (items.length === 0) {
    return '<p style="color: #666; font-style: italic;">No pending catalog items.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">SKU</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Code</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Color</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Type</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Submitted</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb; font-family: monospace;">${item.sku}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.code}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.color_name}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${item.type}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.created_at}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Generate HTML table for pending order approvals
function generateOrdersTable(orders: { 
  order_number: string; 
  customer_name: string;
  submitted_at: string;
  submitted_by: string;
}[]): string {
  if (orders.length === 0) {
    return '<p style="color: #666; font-style: italic;">No pending order approvals.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Order #</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Customer</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Submitted</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Submitted By</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.order_number}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.customer_name}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${order.submitted_at}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.submitted_by}</td>
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
  
  return [...new Set(emails)];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-pending-approvals-digest: Starting pending approvals digest");

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("send-pending-approvals-digest: Invalid or missing CRON_SECRET");
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
      .eq("digest_type", "pending_approvals")
      .single();

    if (!digestConfig?.is_enabled) {
      console.log("send-pending-approvals-digest: Pending approvals digest is disabled");
      return new Response(JSON.stringify({ message: "Pending approvals digest disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (digestConfig.last_sent_at) {
      const lastSent = new Date(digestConfig.last_sent_at);
      const cooldownMs = (digestConfig.cooldown_hours || 24) * 60 * 60 * 1000;
      if (Date.now() - lastSent.getTime() < cooldownMs) {
        console.log("send-pending-approvals-digest: Still in cooldown period");
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
      console.log("send-pending-approvals-digest: No recipients configured");
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

    // Get pending catalog items
    const { data: pendingCatalog, error: catalogError } = await supabase
      .from("catalog_items")
      .select("id, lastro_sku_code, code, color_name, type, created_at")
      .eq("status", "pending_approval");

    if (catalogError) {
      console.error("send-pending-approvals-digest: Error fetching catalog items:", catalogError);
      throw catalogError;
    }

    // Get pending order approvals
    const { data: pendingOrders, error: ordersError } = await supabase
      .from("order_queue")
      .select(`
        id,
        submitted_at,
        submitted_by,
        orders!order_queue_order_id_fkey (
          order_number,
          customer_name
        ),
        profiles!order_queue_submitted_by_fkey (
          full_name,
          email
        )
      `)
      .eq("status", "pending_approval");

    if (ordersError) {
      console.error("send-pending-approvals-digest: Error fetching orders:", ordersError);
      throw ordersError;
    }

    // Process catalog items
    const catalogData = (pendingCatalog || []).map((item: any) => ({
      sku: item.lastro_sku_code,
      code: item.code,
      color_name: item.color_name,
      type: item.type,
      created_at: new Date(item.created_at).toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      }),
    }));

    // Process orders
    const ordersData = (pendingOrders || []).map((item: any) => ({
      order_number: item.orders?.order_number || 'N/A',
      customer_name: item.orders?.customer_name || 'Unknown',
      submitted_at: new Date(item.submitted_at).toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      }),
      submitted_by: item.profiles?.full_name || item.profiles?.email || 'Unknown',
    }));

    const totalCount = catalogData.length + ordersData.length;

    if (totalCount === 0) {
      console.log("send-pending-approvals-digest: No pending approvals to send");
      return new Response(JSON.stringify({ message: "No pending approvals" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get digest template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "pending_approvals_digest")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.error("send-pending-approvals-digest: pending_approvals_digest template not found");
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML tables
    const catalogTable = generateCatalogTable(catalogData);
    const ordersTable = generateOrdersTable(ordersData);
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Replace template variables
    const subject = template.subject_en.replace("{date}", currentDate);
    const body = template.body_en
      .replace(/{date}/g, currentDate)
      .replace(/{pending_catalog_count}/g, catalogData.length.toString())
      .replace(/{pending_orders_count}/g, ordersData.length.toString())
      .replace(/{total_count}/g, totalCount.toString())
      .replace(/{catalog_table}/g, catalogTable)
      .replace(/{orders_table}/g, ordersTable)
      .replace(/{app_url}/g, "https://lotastro.lovable.app");

    if (!resend) {
      console.log("send-pending-approvals-digest: Resend not configured");
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
        template_key: "pending_approvals_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error_message: emailError?.message || null,
        digest_type: "pending_approvals",
        metadata: { 
          pending_catalog_count: catalogData.length, 
          pending_orders_count: ordersData.length,
          total_count: totalCount,
        },
      });

      // Update last_sent_at
      if (status === "sent") {
        await supabase
          .from("email_digest_configs")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("digest_type", "pending_approvals");

        // Update template send count
        await supabase
          .from("email_templates")
          .update({ 
            send_count: (template.send_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", template.id);
      }

      console.log(`send-pending-approvals-digest: Digest ${status}. Catalog: ${catalogData.length}, Orders: ${ordersData.length}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          digest_sent: status === "sent",
          pending_catalog_count: catalogData.length,
          pending_orders_count: ordersData.length,
          total_count: totalCount,
          recipients: recipients.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailErr: any) {
      console.error("send-pending-approvals-digest: Email send error:", emailErr);
      
      await supabase.from("email_log").insert({
        template_key: "pending_approvals_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status: "failed",
        error_message: emailErr.message,
        digest_type: "pending_approvals",
      });

      return new Response(
        JSON.stringify({ error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("send-pending-approvals-digest: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
