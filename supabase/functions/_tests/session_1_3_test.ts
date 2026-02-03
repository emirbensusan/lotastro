/**
 * Session 1.3 QA Tests: Webhook Receiver Audit Columns + Drift Detection
 * 
 * Tests verify:
 * - Audit columns populated on inbox insert
 * - Drift detection returns 409 for changed payload
 * - Drift logged to integration_contract_violations
 * - Session 1.2 regression (HMAC, timestamps, idempotency)
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HMAC_SECRET = Deno.env.get("WMS_CRM_HMAC_SECRET") || "test-secret-min-16-chars";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/wms-webhook-receiver`;

// Compute HMAC signature (canonical format: timestamp.payload)
async function computeHmac(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateIdempotencyKey(): string {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `crm:deal:${id}:won:v1`;
}

async function sendEvent(
  body: object,
  options: {
    signature?: string;
    timestamp?: string;
    skipSignature?: boolean;
    skipTimestamp?: boolean;
  } = {}
): Promise<Response> {
  const rawBody = JSON.stringify(body);
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000).toString();
  const signature = options.signature || await computeHmac(`${timestamp}.${rawBody}`, HMAC_SECRET);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!options.skipSignature) {
    headers["X-WMS-Signature"] = signature;
  }
  if (!options.skipTimestamp) {
    headers["X-WMS-Timestamp"] = timestamp;
  }

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: rawBody,
  });

  return response;
}

// ============= AUDIT COLUMN TESTS =============

Deno.test("AUD-1: Valid event populates received_signature", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-aud1" },
  };
  const rawBody = JSON.stringify(body);
  const signature = await computeHmac(`${timestamp}.${rawBody}`, HMAC_SECRET);

  const response = await sendEvent(body, { signature, timestamp });
  const responseBody = await response.text();
  
  assertEquals(response.status, 200, `Expected 200, got ${response.status}: ${responseBody}`);

  // Query inbox to verify audit columns
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("received_signature, received_timestamp, schema_valid, payload_hash")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertExists(inboxRow, "Inbox row should exist");
  assertEquals(inboxRow.received_signature, signature, "received_signature should match");
  
  // Cleanup
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

Deno.test("AUD-2: Valid event populates received_timestamp as integer", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const timestamp = Math.floor(Date.now() / 1000);
  const body = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-aud2" },
  };

  const response = await sendEvent(body, { timestamp: timestamp.toString() });
  await response.text();
  
  assertEquals(response.status, 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("received_timestamp")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertExists(inboxRow, "Inbox row should exist");
  assertEquals(inboxRow.received_timestamp, timestamp, "received_timestamp should be parsed int");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

Deno.test("AUD-3: Valid event sets schema_valid=true", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const body = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-aud3" },
  };

  const response = await sendEvent(body);
  await response.text();
  
  assertEquals(response.status, 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("schema_valid")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertExists(inboxRow, "Inbox row should exist");
  assertEquals(inboxRow.schema_valid, true, "schema_valid should be true");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

Deno.test("AUD-4: Valid event populates payload_hash", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const body = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-aud4" },
  };

  const response = await sendEvent(body);
  await response.text();
  
  assertEquals(response.status, 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("payload_hash")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertExists(inboxRow, "Inbox row should exist");
  assertExists(inboxRow.payload_hash, "payload_hash should be populated");
  assertEquals(inboxRow.payload_hash.length, 64, "payload_hash should be 64-char SHA-256 hex");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

// ============= IDEMPOTENCY TESTS =============

Deno.test("IDEM-1: Duplicate idempotency_key returns 200, no new row", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const body = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-idem1" },
  };

  // First request
  const response1 = await sendEvent(body);
  await response1.text();
  assertEquals(response1.status, 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { count: countBefore } = await supabase
    .from("integration_inbox")
    .select("*", { count: "exact", head: true })
    .eq("idempotency_key", idempotencyKey);

  // Second request (duplicate)
  const response2 = await sendEvent(body);
  const body2 = await response2.json();
  
  assertEquals(response2.status, 200, "Duplicate should return 200");
  assertEquals(body2.message, "Event already processed (idempotent)");

  const { count: countAfter } = await supabase
    .from("integration_inbox")
    .select("*", { count: "exact", head: true })
    .eq("idempotency_key", idempotencyKey);

  assertEquals(countAfter, countBefore, "No new row should be created for duplicate");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

// ============= RETRY + DRIFT DETECTION TESTS =============

Deno.test("RET-1: Failed status with same payload re-queues correctly", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Insert a failed row manually
  const rawBody = JSON.stringify({
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "test-deal-ret1" },
  });
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawBody));
  const payloadHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await supabase.from("integration_inbox").insert({
    idempotency_key: idempotencyKey,
    event_type: "deal.approved",
    source_system: "crm",
    payload: { crm_deal_id: "test-deal-ret1" },
    status: "failed",
    hmac_verified: true,
    payload_hash: payloadHash,
    attempt_count: 1,
  });

  // Send retry with same payload
  const response = await sendEvent(JSON.parse(rawBody));
  const responseBody = await response.json();
  
  assertEquals(response.status, 200, "Retry should return 200");
  assertEquals(responseBody.message, "Queued for retry");
  assertEquals(responseBody.attempt, 2, "attempt should be incremented");

  // Verify status changed to pending
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("status, attempt_count")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertEquals(inboxRow?.status, "pending", "Status should be pending after retry");
  assertEquals(inboxRow?.attempt_count, 2, "attempt_count should be 2");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
});

Deno.test("RET-2: Failed status with different payload returns 409", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Insert a failed row with original payload hash
  const originalBody = JSON.stringify({
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "original-deal" },
  });
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(originalBody));
  const originalHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await supabase.from("integration_inbox").insert({
    idempotency_key: idempotencyKey,
    event_type: "deal.approved",
    source_system: "crm",
    payload: { crm_deal_id: "original-deal" },
    status: "failed",
    hmac_verified: true,
    payload_hash: originalHash,
    attempt_count: 1,
  });

  // Send retry with DIFFERENT payload (same idempotency_key)
  const differentBody = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "different-deal" },
  };
  
  const response = await sendEvent(differentBody);
  const responseBody = await response.json();
  
  assertEquals(response.status, 409, "Drift should return 409");
  assertEquals(responseBody.error, "Payload drift detected");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
  await supabase.from("integration_contract_violations").delete().eq("idempotency_key", idempotencyKey);
});

Deno.test("DRIFT-1: Drift logged to integration_contract_violations", async () => {
  const idempotencyKey = generateIdempotencyKey();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Insert failed row
  const originalBody = JSON.stringify({
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "drift-test-original" },
  });
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(originalBody));
  const originalHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: insertedRow } = await supabase.from("integration_inbox").insert({
    idempotency_key: idempotencyKey,
    event_type: "deal.approved",
    source_system: "crm",
    payload: { crm_deal_id: "drift-test-original" },
    status: "failed",
    hmac_verified: true,
    payload_hash: originalHash,
    attempt_count: 1,
  }).select("id").single();

  // Trigger drift
  const differentBody = {
    event_type: "deal.approved",
    idempotency_key: idempotencyKey,
    payload: { crm_deal_id: "drift-test-changed" },
  };
  
  const response = await sendEvent(differentBody);
  await response.text();
  
  assertEquals(response.status, 409);

  // Check violation was logged
  const { data: violation } = await supabase
    .from("integration_contract_violations")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .eq("violation_type", "payload_hash_drift")
    .single();

  assertExists(violation, "Drift violation should be logged");
  assertEquals(violation.violation_type, "payload_hash_drift");
  assertEquals(violation.expected_value, originalHash);
  
  // Check inbox row has error marker
  const { data: inboxRow } = await supabase
    .from("integration_inbox")
    .select("error_message, last_attempt_at")
    .eq("idempotency_key", idempotencyKey)
    .single();

  assertEquals(inboxRow?.error_message, "Payload drift detected on retry");
  assertExists(inboxRow?.last_attempt_at, "last_attempt_at should be set");
  
  await supabase.from("integration_inbox").delete().eq("idempotency_key", idempotencyKey);
  await supabase.from("integration_contract_violations").delete().eq("idempotency_key", idempotencyKey);
});

// ============= REGRESSION TESTS (Session 1.2) =============

Deno.test("REG-1: Invalid HMAC returns 401", async () => {
  const body = {
    event_type: "deal.approved",
    idempotency_key: generateIdempotencyKey(),
    payload: { crm_deal_id: "test-deal-reg1" },
  };

  const response = await sendEvent(body, { signature: "invalid-signature" });
  const responseBody = await response.json();
  
  assertEquals(response.status, 401, "Invalid HMAC should return 401");
  assertEquals(responseBody.error, "Invalid HMAC signature");
});

Deno.test("REG-2: Missing signature returns 401", async () => {
  const body = {
    event_type: "deal.approved",
    idempotency_key: generateIdempotencyKey(),
    payload: { crm_deal_id: "test-deal-reg2" },
  };

  const response = await sendEvent(body, { skipSignature: true });
  const responseBody = await response.json();
  
  assertEquals(response.status, 401, "Missing signature should return 401");
  assertEquals(responseBody.error, "Missing X-WMS-Signature header");
});

Deno.test("REG-3: Missing timestamp returns 401", async () => {
  const body = {
    event_type: "deal.approved",
    idempotency_key: generateIdempotencyKey(),
    payload: { crm_deal_id: "test-deal-reg3" },
  };

  const response = await sendEvent(body, { skipTimestamp: true });
  const responseBody = await response.json();
  
  assertEquals(response.status, 401, "Missing timestamp should return 401");
  assertEquals(responseBody.error, "Missing X-WMS-Timestamp header");
});

Deno.test("REG-4: Unknown event type returns 400", async () => {
  const body = {
    event_type: "unknown.event",
    idempotency_key: generateIdempotencyKey(),
    payload: { crm_deal_id: "test-deal-reg4" },
  };

  const response = await sendEvent(body);
  const responseBody = await response.json();
  
  assertEquals(response.status, 400, "Unknown event type should return 400");
  assertEquals(responseBody.error, "Unknown event type: unknown.event");
});

Deno.test("REG-5: Expired timestamp returns 401", async () => {
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
  const body = {
    event_type: "deal.approved",
    idempotency_key: generateIdempotencyKey(),
    payload: { crm_deal_id: "test-deal-reg5" },
  };

  const response = await sendEvent(body, { timestamp: expiredTimestamp });
  const responseBody = await response.json();
  
  assertEquals(response.status, 401, "Expired timestamp should return 401");
  assertEquals(responseBody.error, "Timestamp expired");
});
