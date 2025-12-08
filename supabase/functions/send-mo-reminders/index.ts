import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

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

interface EmailSettings {
  mo_reminder_days: { days: number[] };
  mo_reminder_schedule: { day_of_week: number; hour: number; minute: number; timezone: string };
  mo_reminder_recipients: { emails: string[] };
  mo_overdue_escalation: { daily_count: number; then_weekly: boolean };
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Send reminders for upcoming orders
    if (ordersToRemind.length > 0 && templateMap.mo_reminder) {
      const template = templateMap.mo_reminder;
      
      for (const order of ordersToRemind) {
        const subject = replaceVariables(template.subject_en, order);
        const body = replaceVariables(template.body_en, order);

        console.log(`Would send reminder for ${order.mo_number} to ${recipients.join(', ')}`);
        emailsSent.push(`Reminder: ${order.mo_number}`);
        
        // Here you would integrate with Supabase Auth email or another email service
        // For now, we log the reminder
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

        console.log(`Would send overdue notice for ${order.mo_number} (${overdueDays} days overdue)`);
        emailsSent.push(`Overdue: ${order.mo_number} (${overdueDays}d)`);
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

      console.log(`Weekly summary: ${dueThisWeek.length} due this week, ${overdueOrders.length} overdue`);
      emailsSent.push(`Weekly summary generated`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${ordersToRemind.length} reminders, ${overdueOrders.length} overdue notices`,
      emailsSent,
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