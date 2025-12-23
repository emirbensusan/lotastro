import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduleConfig {
  hour?: number;
  minute?: number;
  timezone?: string;
  day_of_week?: number;
  day_of_month?: number;
}

interface EmailSchedule {
  id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  schedule_type: string;
  schedule_config: ScheduleConfig;
  is_active: boolean;
}

interface EmailRecipient {
  recipient_type: string;
  recipient_value: string;
}

interface ReportConfig {
  id: string;
  name: string;
  report_type: string;
  columns: string[];
  output_formats: string[];
  include_charts: boolean;
}

// Check if a schedule should run now
function shouldRunSchedule(schedule: EmailSchedule, now: Date): boolean {
  const config = schedule.schedule_config || {};
  const hour = config.hour ?? 8;
  const minute = config.minute ?? 0;
  
  // Check hour and minute (within 5 minute window)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  if (currentHour !== hour) return false;
  if (Math.abs(currentMinute - minute) > 5) return false;
  
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();
  
  switch (schedule.schedule_type) {
    case 'daily':
      return true;
    case 'weekly':
      return dayOfWeek === (config.day_of_week ?? 1);
    case 'monthly':
      return dayOfMonth === (config.day_of_month ?? 1);
    default:
      return true;
  }
}

// Generate HTML email body with report data
function generateEmailBody(reportTitle: string, htmlTable: string, schedule: EmailSchedule): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
        .content { background: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .meta { background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #6b7280; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        th { background: #f3f4f6; padding: 10px 8px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; }
        td { padding: 8px; border: 1px solid #e5e7eb; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { text-align: center; padding: 16px; color: #9ca3af; font-size: 12px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportTitle}</h1>
        <p>${schedule.name}</p>
      </div>
      <div class="content">
        <div class="meta">
          <strong>Schedule:</strong> ${schedule.schedule_type} | 
          <strong>Generated:</strong> ${new Date().toLocaleString()}
        </div>
        ${htmlTable}
      </div>
      <div class="footer">
        This is an automated report from LotAstro. Do not reply to this email.
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-scheduled-report: Starting scheduled report processing");

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }
    const resend = new Resend(resendApiKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional schedule_id (manual trigger)
    let specificScheduleId: string | null = null;
    try {
      const body = await req.json();
      specificScheduleId = body?.schedule_id || null;
    } catch {
      // No body, process all due schedules
    }

    // Fetch active schedules
    let schedulesQuery = supabase
      .from("email_schedules")
      .select("*")
      .eq("is_active", true);
    
    if (specificScheduleId) {
      schedulesQuery = schedulesQuery.eq("id", specificScheduleId);
    }

    const { data: schedules, error: schedulesError } = await schedulesQuery;
    if (schedulesError) throw schedulesError;

    console.log(`send-scheduled-report: Found ${schedules?.length || 0} active schedules`);

    const now = new Date();
    const results: any[] = [];

    for (const schedule of schedules || []) {
      // Check if schedule should run now (unless manually triggered)
      if (!specificScheduleId && !shouldRunSchedule(schedule, now)) {
        console.log(`send-scheduled-report: Skipping ${schedule.name} - not due`);
        continue;
      }

      console.log(`send-scheduled-report: Processing schedule: ${schedule.name}`);

      try {
        // Fetch recipients for this schedule
        const { data: recipientData, error: recipientError } = await supabase
          .from("email_recipients")
          .select("recipient_type, recipient_value")
          .eq("schedule_id", schedule.id)
          .eq("is_active", true);

        if (recipientError) throw recipientError;

        // Resolve email addresses
        const emailAddresses: string[] = [];

        for (const recipient of recipientData || []) {
          if (recipient.recipient_type === 'email') {
            emailAddresses.push(recipient.recipient_value);
          } else if (recipient.recipient_type === 'role') {
            // Fetch users with this role
            const { data: users } = await supabase
              .from("profiles")
              .select("email")
              .eq("role", recipient.recipient_value)
              .eq("active", true);
            
            (users || []).forEach((u: any) => {
              if (u.email && !emailAddresses.includes(u.email)) {
                emailAddresses.push(u.email);
              }
            });
          }
        }

        if (emailAddresses.length === 0) {
          console.log(`send-scheduled-report: No recipients for ${schedule.name}`);
          results.push({ schedule_id: schedule.id, status: 'skipped', reason: 'No recipients' });
          continue;
        }

        console.log(`send-scheduled-report: ${emailAddresses.length} recipients for ${schedule.name}`);

        // Fetch report config if linked
        let reportType = 'inventory_stock'; // Default
        let reportTitle = schedule.name;
        let outputFormat: 'html' | 'excel' | 'csv' = 'html';

        if (schedule.template_id) {
          const { data: reportConfig } = await supabase
            .from("email_report_configs")
            .select("*")
            .eq("id", schedule.template_id)
            .single();

          if (reportConfig) {
            reportType = reportConfig.report_type;
            reportTitle = reportConfig.name;
            // Use first output format or default to html
            const formats = reportConfig.output_formats || ['html'];
            outputFormat = formats.includes('excel') ? 'excel' : 
                          formats.includes('csv') ? 'csv' : 'html';
          }
        }

        // Generate report
        const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-report-attachment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_type: reportType,
            format: 'html', // Always generate HTML for email body
            config_id: schedule.template_id,
          }),
        });

        if (!reportResponse.ok) {
          throw new Error(`Report generation failed: ${await reportResponse.text()}`);
        }

        const reportData = await reportResponse.json();

        // Generate attachment if needed
        let attachments: any[] = [];
        if (outputFormat !== 'html') {
          const attachmentResponse = await fetch(`${supabaseUrl}/functions/v1/generate-report-attachment`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              report_type: reportType,
              format: outputFormat,
              config_id: schedule.template_id,
            }),
          });

          if (attachmentResponse.ok) {
            const attachmentData = await attachmentResponse.json();
            attachments.push({
              filename: attachmentData.filename,
              content: Buffer.from(attachmentData.content).toString('base64'),
            });
          }
        }

        // Fetch sender settings
        const { data: senderSettings } = await supabase
          .from("email_settings")
          .select("setting_value")
          .eq("setting_key", "report_sender")
          .single();

        const senderName = senderSettings?.setting_value?.name || 'LotAstro Reports';
        const senderEmail = senderSettings?.setting_value?.email || 'reports@resend.dev';

        // Generate email body
        const emailBody = generateEmailBody(reportTitle, reportData.content, schedule);

        // Send email
        const emailResult = await resend.emails.send({
          from: `${senderName} <${senderEmail}>`,
          to: emailAddresses,
          subject: `${reportTitle} - ${new Date().toLocaleDateString()}`,
          html: emailBody,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

        console.log(`send-scheduled-report: Email sent for ${schedule.name}:`, emailResult);

        // Update schedule last run info
        await supabase
          .from("email_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: 'success',
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        // Log to email_log
        await supabase.from("email_log").insert({
          recipient: emailAddresses.join(', '),
          subject: `${reportTitle} - ${new Date().toLocaleDateString()}`,
          status: 'sent',
          sent_at: new Date().toISOString(),
          schedule_id: schedule.id,
          metadata: {
            schedule_name: schedule.name,
            report_type: reportType,
            recipient_count: emailAddresses.length,
            row_count: reportData.row_count,
          },
        });

        results.push({ 
          schedule_id: schedule.id, 
          status: 'success', 
          recipients: emailAddresses.length,
          report_rows: reportData.row_count,
        });

      } catch (scheduleError: any) {
        console.error(`send-scheduled-report: Error processing ${schedule.name}:`, scheduleError);

        // Update schedule with failure status
        await supabase
          .from("email_schedules")
          .update({
            last_run_at: new Date().toISOString(),
            last_run_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq("id", schedule.id);

        results.push({ 
          schedule_id: schedule.id, 
          status: 'failed', 
          error: scheduleError.message,
        });
      }
    }

    console.log(`send-scheduled-report: Completed. Processed ${results.length} schedules`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("send-scheduled-report: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
