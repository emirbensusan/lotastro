import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Generate HTML table for overdue manufacturing orders
function generateMOTable(orders: { 
  mo_number: string; 
  quality: string; 
  color: string; 
  ordered_amount: number;
  supplier_name: string;
  expected_date: string;
  days_overdue: number;
}[]): string {
  if (orders.length === 0) {
    return '<p style="color: #666; font-style: italic;">No overdue manufacturing orders.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">MO #</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Quality</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Color</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Amount</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Supplier</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Expected</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Overdue</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.mo_number}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.quality}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.color}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${order.ordered_amount.toLocaleString()}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.supplier_name}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${order.expected_date}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #dc2626; font-weight: bold;">${order.days_overdue} days</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Generate HTML table for overdue orders
function generateOrdersTable(orders: { 
  order_number: string; 
  customer_name: string; 
  created_at: string;
  days_old: number;
}[]): string {
  if (orders.length === 0) {
    return '<p style="color: #666; font-style: italic;">No overdue orders.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Order #</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Customer</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Created</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Age</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(order => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.order_number}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${order.customer_name}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${order.created_at}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; color: #f59e0b; font-weight: bold;">${order.days_old} days</td>
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

  console.log("send-overdue-digest: Starting overdue items digest");

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("send-overdue-digest: Invalid or missing CRON_SECRET");
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
      .eq("digest_type", "overdue_digest")
      .single();

    if (!digestConfig?.is_enabled) {
      console.log("send-overdue-digest: Overdue digest is disabled");
      return new Response(JSON.stringify({ message: "Overdue digest disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (digestConfig.last_sent_at) {
      const lastSent = new Date(digestConfig.last_sent_at);
      const cooldownMs = (digestConfig.cooldown_hours || 24) * 60 * 60 * 1000;
      if (Date.now() - lastSent.getTime() < cooldownMs) {
        console.log("send-overdue-digest: Still in cooldown period");
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
      console.log("send-overdue-digest: No recipients configured");
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get overdue manufacturing orders
    const { data: overdueMOs, error: moError } = await supabase
      .from("manufacturing_orders")
      .select(`
        id,
        mo_number,
        quality,
        color,
        ordered_amount,
        expected_completion_date,
        supplier_id,
        suppliers!manufacturing_orders_supplier_id_fkey (name)
      `)
      .not("status", "in", '("SHIPPED","CANCELLED")')
      .not("expected_completion_date", "is", null)
      .lt("expected_completion_date", today.toISOString().split("T")[0]);

    if (moError) {
      console.error("send-overdue-digest: Error fetching MOs:", moError);
      throw moError;
    }

    // Get overdue orders (unfulfilled for more than 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const { data: overdueOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, created_at")
      .is("fulfilled_at", null)
      .lt("created_at", sevenDaysAgo.toISOString());

    if (ordersError) {
      console.error("send-overdue-digest: Error fetching orders:", ordersError);
      throw ordersError;
    }

    // Process MOs
    const moData = (overdueMOs || []).map((mo: any) => {
      const expectedDate = new Date(mo.expected_completion_date);
      const daysOverdue = Math.ceil((today.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        mo_number: mo.mo_number,
        quality: mo.quality,
        color: mo.color,
        ordered_amount: mo.ordered_amount,
        supplier_name: mo.suppliers?.name || 'Unknown',
        expected_date: expectedDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        days_overdue: daysOverdue,
      };
    });

    // Process Orders
    const ordersData = (overdueOrders || []).map((order: any) => {
      const createdAt = new Date(order.created_at);
      const daysOld = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return {
        order_number: order.order_number,
        customer_name: order.customer_name,
        created_at: createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        days_old: daysOld,
      };
    });

    const totalCount = moData.length + ordersData.length;

    if (totalCount === 0) {
      console.log("send-overdue-digest: No overdue items to send");
      return new Response(JSON.stringify({ message: "No overdue items" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get digest template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "overdue_digest")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.error("send-overdue-digest: overdue_digest template not found");
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML tables
    const moTable = generateMOTable(moData);
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
      .replace(/{overdue_mo_count}/g, moData.length.toString())
      .replace(/{overdue_orders_count}/g, ordersData.length.toString())
      .replace(/{total_count}/g, totalCount.toString())
      .replace(/{mo_table}/g, moTable)
      .replace(/{orders_table}/g, ordersTable)
      .replace(/{app_url}/g, "https://lotastro.lovable.app");

    if (!resend) {
      console.log("send-overdue-digest: Resend not configured");
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
        template_key: "overdue_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error_message: emailError?.message || null,
        digest_type: "overdue_digest",
        metadata: { 
          overdue_mo_count: moData.length, 
          overdue_orders_count: ordersData.length,
          total_count: totalCount,
        },
      });

      // Update last_sent_at
      if (status === "sent") {
        await supabase
          .from("email_digest_configs")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("digest_type", "overdue_digest");

        // Update template send count
        await supabase
          .from("email_templates")
          .update({ 
            send_count: (template.send_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", template.id);
      }

      console.log(`send-overdue-digest: Digest ${status}. MOs: ${moData.length}, Orders: ${ordersData.length}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          digest_sent: status === "sent",
          overdue_mo_count: moData.length,
          overdue_orders_count: ordersData.length,
          total_count: totalCount,
          recipients: recipients.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailErr: any) {
      console.error("send-overdue-digest: Email send error:", emailErr);
      
      await supabase.from("email_log").insert({
        template_key: "overdue_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status: "failed",
        error_message: emailErr.message,
        digest_type: "overdue_digest",
      });

      return new Response(
        JSON.stringify({ error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("send-overdue-digest: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
