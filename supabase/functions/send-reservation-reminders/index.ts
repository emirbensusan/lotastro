import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Reservation {
  id: string;
  reservation_number: string;
  customer_name: string;
  hold_until: string;
  created_by: string;
  reservation_lines: { reserved_meters: number; quality: string; color: string }[];
}

// Generate HTML table for reservations
function generateReservationsTable(reservations: { 
  reservation_number: string; 
  customer_name: string; 
  total_meters: number; 
  hold_until: string;
  days_remaining: number;
}[]): string {
  if (reservations.length === 0) {
    return '<p style="color: #666; font-style: italic;">No reservations in this category.</p>';
  }
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Reservation #</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Customer</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">Total Meters</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Hold Until</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Days Left</th>
        </tr>
      </thead>
      <tbody>
        ${reservations.map(res => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${res.reservation_number}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${res.customer_name}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${res.total_meters.toLocaleString()} m</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${res.hold_until}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; ${res.days_remaining <= 0 ? 'color: #dc2626; font-weight: bold;' : ''}">${res.days_remaining <= 0 ? 'TODAY' : res.days_remaining}</td>
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

  console.log("send-reservation-reminders: Starting DIGEST reservation reminder check");

  // Validate CRON_SECRET
  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  
  if (cronSecret && providedSecret !== cronSecret) {
    console.error("send-reservation-reminders: Invalid or missing CRON_SECRET");
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
      .eq("digest_type", "reservations_expiring")
      .single();

    if (!digestConfig?.is_enabled) {
      console.log("send-reservation-reminders: Reservations expiring digest is disabled");
      return new Response(JSON.stringify({ message: "Reservations digest disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown
    if (digestConfig.last_sent_at) {
      const lastSent = new Date(digestConfig.last_sent_at);
      const cooldownMs = (digestConfig.cooldown_hours || 24) * 60 * 60 * 1000;
      if (Date.now() - lastSent.getTime() < cooldownMs) {
        console.log("send-reservation-reminders: Still in cooldown period");
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
      console.log("send-reservation-reminders: No recipients configured");
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

    // Get days before setting (default 3 days)
    const { data: daysSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "reservation_reminders_days_before")
      .single();

    const daysBefore = parseInt(daysSetting?.setting_value || "3", 10);

    // Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysBefore);

    // Get ALL expiring reservations within the threshold
    const { data: expiringReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select(`
        id,
        reservation_number,
        customer_name,
        hold_until,
        created_by,
        reservation_lines (
          reserved_meters,
          quality,
          color
        )
      `)
      .eq("status", "active")
      .not("hold_until", "is", null)
      .lte("hold_until", futureDate.toISOString().split("T")[0])
      .gte("hold_until", today.toISOString().split("T")[0]);

    if (reservationsError) {
      console.error("send-reservation-reminders: Error fetching reservations:", reservationsError);
      throw reservationsError;
    }

    if (!expiringReservations || expiringReservations.length === 0) {
      console.log("send-reservation-reminders: No expiring reservations found");
      return new Response(JSON.stringify({ message: "No expiring reservations" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`send-reservation-reminders: Found ${expiringReservations.length} expiring reservations`);

    // Process and categorize reservations
    const expiringToday: { reservation_number: string; customer_name: string; total_meters: number; hold_until: string; days_remaining: number }[] = [];
    const expiringSoon: { reservation_number: string; customer_name: string; total_meters: number; hold_until: string; days_remaining: number }[] = [];

    for (const reservation of expiringReservations as Reservation[]) {
      const totalMeters = (reservation.reservation_lines || [])
        .reduce((sum, line) => sum + (line.reserved_meters || 0), 0);

      const holdUntil = new Date(reservation.hold_until);
      holdUntil.setHours(0, 0, 0, 0);
      const daysRemaining = Math.ceil((holdUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const resData = {
        reservation_number: reservation.reservation_number,
        customer_name: reservation.customer_name,
        total_meters: totalMeters,
        hold_until: holdUntil.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
        days_remaining: daysRemaining,
      };

      if (daysRemaining <= 0) {
        expiringToday.push(resData);
      } else {
        expiringSoon.push(resData);
      }
    }

    const totalCount = expiringToday.length + expiringSoon.length;

    // Get digest template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "reservations_expiring_digest")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.error("send-reservation-reminders: reservations_expiring_digest template not found");
      return new Response(JSON.stringify({ error: "Template not found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML tables
    const expiringTodayTable = generateReservationsTable(expiringToday);
    const expiringSoonTable = generateReservationsTable(expiringSoon);
    const currentDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Replace template variables
    const subject = template.subject_en.replace("{date}", currentDate);
    const body = template.body_en
      .replace(/{date}/g, currentDate)
      .replace(/{expiring_today_count}/g, expiringToday.length.toString())
      .replace(/{expiring_soon_count}/g, expiringSoon.length.toString())
      .replace(/{total_count}/g, totalCount.toString())
      .replace(/{expiring_today_table}/g, expiringTodayTable)
      .replace(/{expiring_soon_table}/g, expiringSoonTable)
      .replace(/{app_url}/g, "https://lotastro.lovable.app");

    if (!resend) {
      console.log("send-reservation-reminders: Resend not configured");
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
        template_key: "reservations_expiring_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        error_message: emailError?.message || null,
        digest_type: "reservations_expiring",
        metadata: { 
          expiring_today_count: expiringToday.length, 
          expiring_soon_count: expiringSoon.length,
          total_count: totalCount,
        },
      });

      // Update last_sent_at
      if (status === "sent") {
        await supabase
          .from("email_digest_configs")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("digest_type", "reservations_expiring");

        // Update template send count
        await supabase
          .from("email_templates")
          .update({ 
            send_count: (template.send_count || 0) + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq("id", template.id);
      }

      console.log(`send-reservation-reminders: Digest ${status}. Today: ${expiringToday.length}, Soon: ${expiringSoon.length}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          digest_sent: status === "sent",
          expiring_today_count: expiringToday.length,
          expiring_soon_count: expiringSoon.length,
          total_count: totalCount,
          recipients: recipients.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (emailErr: any) {
      console.error("send-reservation-reminders: Email send error:", emailErr);
      
      await supabase.from("email_log").insert({
        template_key: "reservations_expiring_digest",
        template_id: template.id,
        recipient: recipients.join(", "),
        subject,
        status: "failed",
        error_message: emailErr.message,
        digest_type: "reservations_expiring",
      });

      return new Response(
        JSON.stringify({ error: emailErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    console.error("send-reservation-reminders: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
