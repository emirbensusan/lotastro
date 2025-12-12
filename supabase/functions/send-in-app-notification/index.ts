import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: string;
  title: string;
  message: string;
  recipients: string[]; // email addresses or "role:xxx"
  metadata?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

// Resolve recipients from role:xxx format
async function resolveRecipientIds(supabase: any, recipientsConfig: string[]): Promise<string[]> {
  const userIds: string[] = [];
  
  for (const recipient of recipientsConfig) {
    if (recipient.startsWith('role:')) {
      const role = recipient.replace('role:', '');
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('role', role)
        .eq('active', true);
      
      if (users) {
        userIds.push(...users.map((u: { user_id: string }) => u.user_id));
      }
    } else {
      // It's an email, find the user
      const { data: user } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', recipient)
        .single();
      
      if (user) {
        userIds.push(user.user_id);
      }
    }
  }
  
  return [...new Set(userIds)]; // Remove duplicates
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("send-in-app-notification: Starting notification creation");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { type, title, message, recipients, metadata, priority = 'normal' }: NotificationRequest = await req.json();

    if (!type || !title || !message || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, title, message, recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`send-in-app-notification: Type=${type}, Recipients=${recipients.length}`);

    // Resolve recipient user IDs
    const userIds = await resolveRecipientIds(supabase, recipients);

    if (userIds.length === 0) {
      console.log("send-in-app-notification: No valid recipients found");
      return new Response(
        JSON.stringify({ message: "No valid recipients found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For now, we'll log notifications to email_log with a special type
    // In a real app, you might have a separate notifications table
    // This serves as a fallback mechanism when email fails
    
    const notificationLog = {
      template_key: `notification_${type}`,
      recipient: userIds.join(', '),
      subject: title,
      status: 'notification_created',
      sent_at: new Date().toISOString(),
      metadata: {
        notification_type: type,
        message,
        priority,
        recipient_count: userIds.length,
        ...metadata,
      },
    };

    const { error: insertError } = await supabase
      .from("email_log")
      .insert(notificationLog);

    if (insertError) {
      console.error("send-in-app-notification: Error logging notification:", insertError);
      // Don't throw - notification logging is not critical
    }

    // In a production app, you would:
    // 1. Insert into a notifications table
    // 2. Send push notifications if configured
    // 3. Update real-time subscriptions
    // For now, this serves as the fallback logging mechanism

    console.log(`send-in-app-notification: Created notification for ${userIds.length} users`);

    return new Response(
      JSON.stringify({ 
        success: true,
        notification_type: type,
        recipients_count: userIds.length,
        priority,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-in-app-notification: Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
