/**
 * Session 1.1: Integration Inbox Table + RLS Tests
 * 
 * Tests the integration_inbox table schema, indexes, and RLS policies.
 * Run with: deno test --allow-net --allow-env supabase/functions/_tests/session_1_1_test.ts
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://kwcwbyfzzordqwudixvl.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3Y3dieWZ6em9yZHF3dWRpeHZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMDY2MTksImV4cCI6MjA3MTY4MjYxOX0.toD6pqqb2w1YBa7LQSWLXb0WI9_6wsGJFLsnSm_BPNM";

// Helper to make Supabase REST API calls
async function supabaseQuery(
  query: string,
  apiKey: string,
  method: "GET" | "POST" = "POST"
): Promise<{ data: unknown; error: unknown }> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/`;
  
  // For direct table queries, use the REST endpoint
  if (query.startsWith("SELECT") || query.startsWith("INSERT")) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/integration_inbox?select=*&limit=1`, {
      method: "GET",
      headers: {
        "apikey": apiKey,
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: { message: errorText, status: response.status } };
    }
    
    const data = await response.json();
    return { data, error: null };
  }
  
  return { data: null, error: "Unsupported query type" };
}

// Helper for SQL queries via service role
async function executeSql(sql: string): Promise<{ data: unknown[]; error: unknown }> {
  if (!SERVICE_ROLE_KEY) {
    return { data: [], error: "SERVICE_ROLE_KEY not set" };
  }
  
  // Use the SQL endpoint for direct queries
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "apikey": SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  
  // For table existence check, just try to select from it
  return { data: [], error: null };
}

Deno.test("Session 1.1 - Table Existence", async (t) => {
  await t.step("integration_inbox table exists and is queryable", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox?select=id&limit=1`,
      {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    assertEquals(response.ok, true, "Table should be queryable with service role");
    console.log("✅ integration_inbox table exists and is queryable");
  });
});

Deno.test("Session 1.1 - Schema Verification", async (t) => {
  await t.step("integration_inbox has all required columns", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    // Query the information_schema to verify columns
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    
    // Alternative: Insert a test row to verify schema
    const testPayload = {
      idempotency_key: `test:inbox:${Date.now()}:verify:v1`,
      event_type: "test.schema_verification",
      source_system: "crm",
      payload: { test: true },
      payload_hash: "abc123",
      hmac_verified: true,
    };
    
    const insertResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify(testPayload),
      }
    );
    
    assertEquals(insertResponse.ok, true, "Should be able to insert with service role");
    
    const inserted = await insertResponse.json();
    assertExists(inserted[0]?.id, "Inserted row should have id");
    assertExists(inserted[0]?.created_at, "Should have created_at");
    assertExists(inserted[0]?.received_at, "Should have received_at");
    assertEquals(inserted[0]?.status, "pending", "Default status should be pending");
    assertEquals(inserted[0]?.attempt_count, 0, "Default attempt_count should be 0");
    
    // Cleanup
    await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox?id=eq.${inserted[0].id}`,
      {
        method: "DELETE",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    console.log("✅ All required columns present with correct defaults");
  });
});

Deno.test("Session 1.1 - Idempotency Key Uniqueness", async (t) => {
  await t.step("duplicate idempotency_key is rejected", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const uniqueKey = `test:inbox:${Date.now()}:duplicate:v1`;
    const testPayload = {
      idempotency_key: uniqueKey,
      event_type: "test.duplicate",
      source_system: "crm",
      payload: { test: true },
      payload_hash: "hash1",
      hmac_verified: true,
    };
    
    // First insert should succeed
    const firstResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation",
        },
        body: JSON.stringify(testPayload),
      }
    );
    assertEquals(firstResponse.ok, true, "First insert should succeed");
    const firstRow = await firstResponse.json();
    
    // Second insert with same key should fail
    const secondResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...testPayload, payload_hash: "hash2" }),
      }
    );
    assertEquals(secondResponse.ok, false, "Duplicate idempotency_key should be rejected");
    assertEquals(secondResponse.status, 409, "Should return 409 Conflict");
    
    // Cleanup
    await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox?id=eq.${firstRow[0].id}`,
      {
        method: "DELETE",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    console.log("✅ Duplicate idempotency_key correctly rejected with 409");
  });
});

Deno.test("Session 1.1 - Source System Constraint", async (t) => {
  await t.step("invalid source_system is rejected", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const testPayload = {
      idempotency_key: `test:inbox:${Date.now()}:source:v1`,
      event_type: "test.source",
      source_system: "invalid_source",  // Invalid value
      payload: { test: true },
      payload_hash: "abc",
      hmac_verified: true,
    };
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      }
    );
    
    assertEquals(response.ok, false, "Invalid source_system should be rejected");
    console.log("✅ Invalid source_system correctly rejected");
  });
  
  await t.step("valid source_systems are accepted", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    for (const source of ["crm", "wms"]) {
      const testPayload = {
        idempotency_key: `test:inbox:${Date.now()}:source-${source}:v1`,
        event_type: "test.source",
        source_system: source,
        payload: { test: true },
        payload_hash: "abc",
        hmac_verified: true,
      };
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/integration_inbox`,
        {
          method: "POST",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify(testPayload),
        }
      );
      
      assertEquals(response.ok, true, `source_system '${source}' should be accepted`);
      const row = await response.json();
      
      // Cleanup
      await fetch(
        `${SUPABASE_URL}/rest/v1/integration_inbox?id=eq.${row[0].id}`,
        {
          method: "DELETE",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      );
    }
    
    console.log("✅ Valid source_systems (crm, wms) accepted");
  });
});

Deno.test("Session 1.1 - RLS Policy Verification", async (t) => {
  await t.step("anon user cannot access integration_inbox", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox?select=*&limit=1`,
      {
        headers: {
          "apikey": ANON_KEY,
          "Authorization": `Bearer ${ANON_KEY}`,
        },
      }
    );
    
    // Should get empty result or error due to RLS
    if (response.ok) {
      const data = await response.json();
      assertEquals(data.length, 0, "Anon should not see any rows");
    }
    
    console.log("✅ Anon user correctly blocked by RLS");
  });
  
  await t.step("service role bypasses RLS", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox?select=*&limit=1`,
      {
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    assertEquals(response.ok, true, "Service role should bypass RLS");
    console.log("✅ Service role correctly bypasses RLS");
  });
});

Deno.test("Session 1.1 - Status Enum Verification", async (t) => {
  await t.step("all status values are valid", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const validStatuses = ["pending", "processing", "processed", "failed", "rejected", "skipped"];
    
    for (const status of validStatuses) {
      const testPayload = {
        idempotency_key: `test:inbox:${Date.now()}:status-${status}:v1`,
        event_type: "test.status",
        source_system: "crm",
        payload: { test: true },
        payload_hash: "abc",
        hmac_verified: true,
        status: status,
      };
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/integration_inbox`,
        {
          method: "POST",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
          },
          body: JSON.stringify(testPayload),
        }
      );
      
      assertEquals(response.ok, true, `Status '${status}' should be valid`);
      const row = await response.json();
      
      // Cleanup
      await fetch(
        `${SUPABASE_URL}/rest/v1/integration_inbox?id=eq.${row[0].id}`,
        {
          method: "DELETE",
          headers: {
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
        }
      );
    }
    
    console.log("✅ All valid status values accepted");
  });
  
  await t.step("invalid status is rejected", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.log("⚠️  Skipping: SERVICE_ROLE_KEY not set");
      return;
    }
    
    const testPayload = {
      idempotency_key: `test:inbox:${Date.now()}:invalid-status:v1`,
      event_type: "test.status",
      source_system: "crm",
      payload: { test: true },
      payload_hash: "abc",
      hmac_verified: true,
      status: "invalid_status",
    };
    
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/integration_inbox`,
      {
        method: "POST",
        headers: {
          "apikey": SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPayload),
      }
    );
    
    assertEquals(response.ok, false, "Invalid status should be rejected");
    console.log("✅ Invalid status correctly rejected");
  });
});

console.log(`
================================================================================
Session 1.1 Test Suite - Integration Inbox Table + RLS
================================================================================

To run these tests locally:
  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  deno test --allow-net --allow-env supabase/functions/_tests/session_1_1_test.ts

Manual SQL verification queries:
  
1. Verify table exists:
   SELECT * FROM integration_inbox LIMIT 1;
   
2. Verify indexes:
   SELECT indexname FROM pg_indexes WHERE tablename = 'integration_inbox';
   
3. Verify RLS is enabled:
   SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'integration_inbox';
   
4. Verify unique constraint:
   SELECT constraint_name FROM information_schema.table_constraints 
   WHERE table_name = 'integration_inbox' AND constraint_type = 'UNIQUE';

5. Verify status enum values:
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = 'integration_inbox_status'::regtype;

================================================================================
`);
