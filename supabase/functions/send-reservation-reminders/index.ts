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

  console.log("send-reservation-reminders: Starting reservation reminder check");

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

    // Check if reservation reminders are enabled
    const { data: enabledSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "reservation_reminders_enabled")
      .single();

    if (enabledSetting?.setting_value !== "true" && enabledSetting?.setting_value !== true) {
      console.log("send-reservation-reminders: Reservation reminders are disabled");
      return new Response(JSON.stringify({ message: "Reservation reminders disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get days before setting
    const { data: daysSetting } = await supabase
      .from("email_settings")
      .select("setting_value")
      .eq("setting_key", "reservation_reminders_days_before")
      .single();

    const daysBefore = parseInt(daysSetting?.setting_value || "3", 10);

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

    // Get template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "reservation_expiring")
      .eq("is_active", true)
      .single();

    if (!template) {
      console.log("send-reservation-reminders: Template not found or inactive");
      return new Response(JSON.stringify({ message: "Template not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate the date range for expiring reservations
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysBefore);

    // Get reservations expiring within the threshold
    const { data: expiringReservations, error: reservationsError } = await supabase
      .from("reservations")
      .select(`
        id,
        reservation_number,
        customer_name,
        hold_until,
        created_by,
        reservation_lines (
          reserved_meters
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

    const emailsSent: { reservation_number: string; status: string }[] = [];

    for (const reservation of expiringReservations) {
      // Check if already reminded recently (within 24 hours)
      const { data: recentLog } = await supabase
        .from("email_log")
        .select("id")
        .eq("template_key", "reservation_expiring")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq("metadata->>'reservation_number'", reservation.reservation_number)
        .limit(1);

      if (recentLog && recentLog.length > 0) {
        console.log(`send-reservation-reminders: Already reminded for ${reservation.reservation_number}`);
        continue;
      }

      // Get the creator's email
      const { data: creator } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", reservation.created_by)
        .single();

      if (!creator?.email) {
        console.log(`send-reservation-reminders: No creator email for ${reservation.reservation_number}`);
        continue;
      }

      // Calculate total meters
      const totalMeters = (reservation.reservation_lines || [])
        .reduce((sum: number, line: { reserved_meters: number }) => sum + (line.reserved_meters || 0), 0);

      // Calculate days remaining
      const holdUntil = new Date(reservation.hold_until);
      const daysRemaining = Math.ceil((holdUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const subject = template.subject_en
        .replace("{reservation_number}", reservation.reservation_number);
      
      const body = template.body_en
        .replace(/{reservation_number}/g, reservation.reservation_number)
        .replace(/{customer_name}/g, reservation.customer_name)
        .replace(/{total_meters}/g, totalMeters.toString())
        .replace(/{hold_until}/g, holdUntil.toLocaleDateString("en-US", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        }))
        .replace(/{days_remaining}/g, daysRemaining.toString());

      if (!resend) {
        console.log("send-reservation-reminders: Resend not configured");
        continue;
      }

      try {
        const { error: emailError } = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: [creator.email],
          subject,
          html: body,
        });

        const status = emailError ? "failed" : "sent";

        // Log the email
        await supabase.from("email_log").insert({
          template_key: "reservation_expiring",
          recipient: creator.email,
          subject,
          status,
          sent_at: status === "sent" ? new Date().toISOString() : null,
          error_message: emailError?.message || null,
          metadata: { 
            reservation_number: reservation.reservation_number,
            customer_name: reservation.customer_name,
            days_remaining: daysRemaining,
          },
        });

        emailsSent.push({ reservation_number: reservation.reservation_number, status });
        console.log(`send-reservation-reminders: Reminder ${status} for ${reservation.reservation_number}`);
      } catch (emailErr: any) {
        console.error("send-reservation-reminders: Email send error:", emailErr);
        await supabase.from("email_log").insert({
          template_key: "reservation_expiring",
          recipient: creator.email,
          subject,
          status: "failed",
          error_message: emailErr.message,
          metadata: { 
            reservation_number: reservation.reservation_number,
            customer_name: reservation.customer_name,
          },
        });
        emailsSent.push({ reservation_number: reservation.reservation_number, status: "failed" });
      }
    }

    console.log(`send-reservation-reminders: Completed. ${emailsSent.length} emails processed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        reservations_found: expiringReservations.length,
        emails_sent: emailsSent.filter(e => e.status === "sent").length,
        emails_failed: emailsSent.filter(e => e.status === "failed").length,
        details: emailsSent,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-reservation-reminders: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
