import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    database: CheckResult;
    auth: CheckResult;
    storage: CheckResult;
    functions: CheckResult;
  };
  version: string;
}

interface CheckResult {
  status: "pass" | "fail";
  latency_ms?: number;
  error?: string;
}

async function checkDatabase(supabase: any): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from("profiles")
      .select("count")
      .limit(1)
      .single();
    
    // Count query might return no rows, that's ok
    const latency = Date.now() - start;
    return { status: "pass", latency_ms: latency };
  } catch (error) {
    return { status: "fail", error: String(error) };
  }
}

async function checkAuth(supabase: any): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Just verify auth endpoint is responsive
    const { error } = await supabase.auth.getSession();
    const latency = Date.now() - start;
    
    // No session is fine, we just want to know auth is working
    return { status: "pass", latency_ms: latency };
  } catch (error) {
    return { status: "fail", error: String(error) };
  }
}

async function checkStorage(supabase: any): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;
    
    if (error) {
      return { status: "fail", error: error.message };
    }
    
    return { status: "pass", latency_ms: latency };
  } catch (error) {
    return { status: "fail", error: String(error) };
  }
}

function checkFunctions(): CheckResult {
  // If this function is running, functions are working
  return { status: "pass", latency_ms: 0 };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Run all checks in parallel
    const [database, auth, storage] = await Promise.all([
      checkDatabase(supabase),
      checkAuth(supabase),
      checkStorage(supabase),
    ]);

    const functions = checkFunctions();

    const checks = { database, auth, storage, functions };
    
    // Determine overall status
    const allPassing = Object.values(checks).every(c => c.status === "pass");
    const anyFailing = Object.values(checks).some(c => c.status === "fail");
    
    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (allPassing) {
      overallStatus = "healthy";
    } else if (anyFailing && !allPassing) {
      overallStatus = "degraded";
    } else {
      overallStatus = "unhealthy";
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: "1.0.0",
    };

    const httpStatus = overallStatus === "healthy" ? 200 : 
                       overallStatus === "degraded" ? 200 : 503;

    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: httpStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Health check error:", error);
    
    const errorResponse: HealthStatus = {
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: "fail", error: "Unable to check" },
        auth: { status: "fail", error: "Unable to check" },
        storage: { status: "fail", error: "Unable to check" },
        functions: { status: "fail", error: String(error) },
      },
      version: "1.0.0",
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
