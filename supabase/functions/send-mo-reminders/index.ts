import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManufacturingOrder {
  id: string;
  mo_number: string;
  quality: string;
  color: string;
  ordered_meters: number;
  expected_completion_date: string | null;
  status: string;
  supplier_name: string;
  is_customer_order: boolean;
  customer_name: string | null;
}

interface EmailTemplate {
  template_key: string;
  subject_en: string;
  subject_tr: string;
  body_en: string;
  body_tr: string;
  is_active: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting MO reminders job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('email_settings')
      .select('setting_key, setting_value');

    if (settingsError) throw settingsError;

    const settings: Record<string, any> = {};
    settingsData?.forEach((row: any) => {
      settings[row.setting_key] = row.setting_value;
    });

    const reminderDays = settings.mo_reminder_days?.days || [7, 3];
    const recipients = settings.mo_reminder_recipients?.emails || [];
    
    // Get sender configuration
    const senderName = settings.email_sender?.name || 'LotAstro';
    const senderEmail = settings.email_sender?.email || 'info@lotastro.com';
    const fromAddress = `${senderName} <${senderEmail}>`;

    if (recipients.length === 0) {
      console.log('No recipients configured, skipping reminders');
      return new Response(JSON.stringify({ message: 'No recipients configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch email templates
    const { data: templates, error: templatesError } = await supabase
      .from('email_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError) throw templatesError;

    const templateMap: Record<string, EmailTemplate> = {};
    templates?.forEach((t: EmailTemplate) => {
      templateMap[t.template_key] = t;
    });

    // Fetch active manufacturing orders
    const { data: orders, error: ordersError } = await supabase
      .from('manufacturing_orders')
      .select(`
        id,
        mo_number,
        quality,
        color,
        ordered_meters,
        expected_completion_date,
        status,
        is_customer_order,
        customer_name,
        suppliers (name)
      `)
      .not('status', 'in', '(SHIPPED,CANCELLED)');

    if (ordersError) throw ordersError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ordersToRemind: ManufacturingOrder[] = [];
    const overdueOrders: ManufacturingOrder[] = [];

    orders?.forEach((order: any) => {
      if (!order.expected_completion_date) return;

      const eta = new Date(order.expected_completion_date);
      const diffDays = Math.ceil((eta.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const mo: ManufacturingOrder = {
        id: order.id,
        mo_number: order.mo_number,
        quality: order.quality,
        color: order.color,
        ordered_meters: order.ordered_meters,
        expected_completion_date: order.expected_completion_date,
        status: order.status,
        supplier_name: order.suppliers?.name || 'Unknown',
        is_customer_order: order.is_customer_order,
        customer_name: order.customer_name,
      };

      if (diffDays < 0) {
        overdueOrders.push(mo);
      } else if (reminderDays.includes(diffDays)) {
        ordersToRemind.push(mo);
      }
    });

    console.log(`Found ${ordersToRemind.length} orders due for reminder, ${overdueOrders.length} overdue`);

    // Generate email content
    const replaceVariables = (template: string, order: ManufacturingOrder, overdueDays?: number) => {
      return template
        .replace(/{mo_number}/g, order.mo_number)
        .replace(/{quality}/g, order.quality)
        .replace(/{color}/g, order.color)
        .replace(/{ordered_meters}/g, order.ordered_meters.toLocaleString())
        .replace(/{supplier}/g, order.supplier_name)
        .replace(/{eta}/g, order.expected_completion_date || 'N/A')
        .replace(/{status}/g, order.status)
        .replace(/{overdue_days}/g, String(overdueDays || 0))
        .replace(/{customer}/g, order.customer_name || 'N/A');
    };

    const emailsSent: string[] = [];
    const emailErrors: string[] = [];

    // Send reminders for upcoming orders
    if (ordersToRemind.length > 0 && templateMap.mo_reminder) {
      const template = templateMap.mo_reminder;
      
      for (const order of ordersToRemind) {
        const subject = replaceVariables(template.subject_en, order);
        const body = replaceVariables(template.body_en, order);

        try {
          const { error: emailError } = await resend.emails.send({
            from: fromAddress,
            to: recipients,
            subject: subject,
            html: body,
          });

          if (emailError) {
            console.error(`Failed to send reminder for ${order.mo_number}:`, emailError);
            emailErrors.push(`${order.mo_number}: ${emailError.message}`);
          } else {
            console.log(`Sent reminder for ${order.mo_number} to ${recipients.join(', ')}`);
            emailsSent.push(`Reminder: ${order.mo_number}`);
          }
        } catch (err: any) {
          console.error(`Error sending reminder for ${order.mo_number}:`, err);
          emailErrors.push(`${order.mo_number}: ${err.message}`);
        }
      }
    }

    // Send overdue notifications
    if (overdueOrders.length > 0 && templateMap.mo_overdue) {
      const template = templateMap.mo_overdue;
      
      for (const order of overdueOrders) {
        const eta = new Date(order.expected_completion_date!);
        const overdueDays = Math.ceil((today.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
        
        const subject = replaceVariables(template.subject_en, order, overdueDays);
        const body = replaceVariables(template.body_en, order, overdueDays);

        try {
          const { error: emailError } = await resend.emails.send({
            from: fromAddress,
            to: recipients,
            subject: subject,
            html: body,
          });

          if (emailError) {
            console.error(`Failed to send overdue notice for ${order.mo_number}:`, emailError);
            emailErrors.push(`${order.mo_number}: ${emailError.message}`);
          } else {
            console.log(`Sent overdue notice for ${order.mo_number} (${overdueDays} days overdue)`);
            emailsSent.push(`Overdue: ${order.mo_number} (${overdueDays}d)`);
          }
        } catch (err: any) {
          console.error(`Error sending overdue notice for ${order.mo_number}:`, err);
          emailErrors.push(`${order.mo_number}: ${err.message}`);
        }
      }
    }

    // Generate weekly summary if it's the scheduled day
    const currentDay = today.getDay();
    const scheduledDay = settings.mo_reminder_schedule?.day_of_week || 4; // Default Thursday

    if (currentDay === scheduledDay && templateMap.mo_weekly_summary) {
      console.log('Generating weekly summary...');
      
      const dueThisWeek = orders?.filter((o: any) => {
        if (!o.expected_completion_date) return false;
        const eta = new Date(o.expected_completion_date);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return eta >= today && eta <= nextWeek;
      }) || [];

      // Build summary HTML
      const summaryHtml = `
        <h2>Weekly Manufacturing Orders Summary</h2>
        <p><strong>Date:</strong> ${today.toISOString().split('T')[0]}</p>
        <h3>Due This Week: ${dueThisWeek.length} orders</h3>
        ${dueThisWeek.length > 0 ? `
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background-color: #f0f0f0;">
              <th>MO Number</th>
              <th>Supplier</th>
              <th>Quality</th>
              <th>Color</th>
              <th>Meters</th>
              <th>ETA</th>
              <th>Status</th>
            </tr>
            ${dueThisWeek.map((o: any) => `
              <tr>
                <td>${o.mo_number}</td>
                <td>${o.suppliers?.name || 'Unknown'}</td>
                <td>${o.quality}</td>
                <td>${o.color}</td>
                <td>${o.ordered_meters.toLocaleString()}</td>
                <td>${o.expected_completion_date}</td>
                <td>${o.status}</td>
              </tr>
            `).join('')}
          </table>
        ` : '<p>No orders due this week.</p>'}
        <h3>Overdue Orders: ${overdueOrders.length}</h3>
        ${overdueOrders.length > 0 ? `
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
            <tr style="background-color: #ffcccc;">
              <th>MO Number</th>
              <th>Supplier</th>
              <th>Quality</th>
              <th>Color</th>
              <th>Meters</th>
              <th>ETA</th>
              <th>Days Overdue</th>
            </tr>
            ${overdueOrders.map((o) => {
              const eta = new Date(o.expected_completion_date!);
              const overdueDays = Math.ceil((today.getTime() - eta.getTime()) / (1000 * 60 * 60 * 24));
              return `
                <tr>
                  <td>${o.mo_number}</td>
                  <td>${o.supplier_name}</td>
                  <td>${o.quality}</td>
                  <td>${o.color}</td>
                  <td>${o.ordered_meters.toLocaleString()}</td>
                  <td>${o.expected_completion_date}</td>
                  <td style="color: red; font-weight: bold;">${overdueDays}</td>
                </tr>
              `;
            }).join('')}
          </table>
        ` : '<p>No overdue orders.</p>'}
      `;

      try {
        const { error: summaryError } = await resend.emails.send({
          from: fromAddress,
          to: recipients,
          subject: `Weekly MO Summary - ${today.toISOString().split('T')[0]}`,
          html: summaryHtml,
        });

        if (summaryError) {
          console.error('Failed to send weekly summary:', summaryError);
          emailErrors.push(`Weekly summary: ${summaryError.message}`);
        } else {
          console.log(`Weekly summary sent to ${recipients.join(', ')}`);
          emailsSent.push('Weekly summary');
        }
      } catch (err: any) {
        console.error('Error sending weekly summary:', err);
        emailErrors.push(`Weekly summary: ${err.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${ordersToRemind.length} reminders, ${overdueOrders.length} overdue notices`,
      emailsSent,
      emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-mo-reminders:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
