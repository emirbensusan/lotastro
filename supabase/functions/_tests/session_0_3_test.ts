/**
 * Session 0.3 Acceptance Tests
 * HMAC + Schema Validation for Edge Functions
 * 
 * Run with: Deno test runner via Lovable
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  computeHmac,
  verifyHmac,
  validateTimestamp,
  validateInboundEvent,
  STRICT_MODE,
  HMAC_HEADER,
  TIMESTAMP_HEADER,
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/contract-validation.ts";

import {
  IDEMPOTENCY_DELIMITER,
  CRM_TO_WMS_EVENT_TYPES,
} from "../_shared/contract-schemas.ts";

// Test secret for HMAC verification
const TEST_SECRET = 'test-hmac-secret-for-unit-tests';

// Helper to create a mock request
function createMockRequest(
  body: object | string,
  signature?: string,
  timestamp?: number
): Request {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  
  if (signature) {
    headers.set(HMAC_HEADER, signature);
  }
  
  if (timestamp !== undefined) {
    headers.set(TIMESTAMP_HEADER, timestamp.toString());
  }
  
  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers,
    body: bodyString,
  });
}

// Helper to create valid event envelope
function createValidEnvelope(overrides: Record<string, unknown> = {}): object {
  return {
    event_type: 'reservation.created',
    idempotency_key: 'crm:reservation:123:created:v1',
    timestamp: new Date().toISOString(),
    source_system: 'crm',
    payload: {
      crm_reservation_id: '123e4567-e89b-12d3-a456-426614174000',
      crm_organization_id: '123e4567-e89b-12d3-a456-426614174001',
      crm_customer_id: '123e4567-e89b-12d3-a456-426614174002',
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [],
    },
    ...overrides,
  };
}

// ============================================
// TEST 1: HMAC computation
// ============================================
Deno.test("T1: computeHmac produces consistent hex signature", async () => {
  const payload = JSON.stringify({ test: 'data' });
  
  const sig1 = await computeHmac(payload, TEST_SECRET);
  const sig2 = await computeHmac(payload, TEST_SECRET);
  
  console.log('T1 Signature:', sig1);
  console.log('T1 Signature length:', sig1.length);
  
  assertEquals(sig1, sig2, 'Same payload should produce same signature');
  assertEquals(sig1.length, 64, 'SHA-256 produces 64 hex chars');
  assertEquals(/^[0-9a-f]+$/.test(sig1), true, 'Signature should be hex');
});

// ============================================
// TEST 2: HMAC verification - valid signature
// ============================================
Deno.test("T2: verifyHmac returns true for valid signature", async () => {
  const payload = JSON.stringify({ test: 'data' });
  const validSig = await computeHmac(payload, TEST_SECRET);
  
  const result = await verifyHmac(payload, validSig, TEST_SECRET);
  
  console.log('T2 Valid signature verified:', result);
  
  assertEquals(result, true);
});

// ============================================
// TEST 3: HMAC verification - invalid signature
// ============================================
Deno.test("T3: verifyHmac returns false for invalid signature", async () => {
  const payload = JSON.stringify({ test: 'data' });
  const invalidSig = 'definitely-not-a-valid-signature-abcdef1234567890';
  
  const result = await verifyHmac(payload, invalidSig, TEST_SECRET);
  
  console.log('T3 Invalid signature rejected:', !result);
  
  assertEquals(result, false);
});

// ============================================
// TEST 4: HMAC verification - wrong secret
// ============================================
Deno.test("T4: verifyHmac returns false for wrong secret", async () => {
  const payload = JSON.stringify({ test: 'data' });
  const sigWithCorrectSecret = await computeHmac(payload, TEST_SECRET);
  
  const result = await verifyHmac(payload, sigWithCorrectSecret, 'wrong-secret');
  
  console.log('T4 Wrong secret rejected:', !result);
  
  assertEquals(result, false);
});

// ============================================
// TEST 5: Timestamp validation - valid
// ============================================
Deno.test("T5: validateTimestamp accepts recent timestamp", () => {
  const now = Math.floor(Date.now() / 1000);
  
  const result = validateTimestamp(now.toString());
  
  console.log('T5 Valid timestamp result:', result);
  
  assertEquals(result.valid, true);
  assertEquals(result.error, undefined);
});

// ============================================
// TEST 6: Timestamp validation - expired
// ============================================
Deno.test("T6: validateTimestamp rejects expired timestamp", () => {
  const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  
  const result = validateTimestamp(oldTimestamp.toString());
  
  console.log('T6 Expired timestamp result:', result);
  
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('expired'), true);
});

// ============================================
// TEST 7: Timestamp validation - missing
// ============================================
Deno.test("T7: validateTimestamp rejects missing timestamp", () => {
  const result = validateTimestamp(null);
  
  console.log('T7 Missing timestamp result:', result);
  
  assertEquals(result.valid, false);
  assertEquals(result.error?.includes('Missing'), true);
});

// ============================================
// TEST 8: Full validation - valid request
// ============================================
Deno.test("T8: validateInboundEvent passes for valid request", async () => {
  const envelope = createValidEnvelope();
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result, event } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T8 Valid request result:', { valid: result.valid, statusCode: result.statusCode });
  console.log('T8 Event type:', event?.eventType);
  console.log('T8 Idempotency key:', event?.idempotencyKey);
  
  assertEquals(result.valid, true);
  assertEquals(result.statusCode, 200);
  assertExists(event);
  assertEquals(event.eventType, 'reservation.created');
});

// ============================================
// TEST 9: Validation fails - missing HMAC header (401)
// ============================================
Deno.test("T9: validateInboundEvent returns 401 for missing HMAC", async () => {
  const envelope = createValidEnvelope();
  const timestamp = Math.floor(Date.now() / 1000);
  
  // No signature provided
  const req = createMockRequest(envelope, undefined, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T9 Missing HMAC result:', { statusCode: result.statusCode, error: result.error });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'MISSING_HMAC');
});

// ============================================
// TEST 10: Validation fails - invalid HMAC (401)
// ============================================
Deno.test("T10: validateInboundEvent returns 401 for invalid HMAC", async () => {
  const envelope = createValidEnvelope();
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, 'invalid-signature', timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T10 Invalid HMAC result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'INVALID_HMAC');
});

// ============================================
// TEST 11: Validation fails - unknown event type (400)
// ============================================
Deno.test("T11: validateInboundEvent returns 400 for unknown event type", async () => {
  const envelope = createValidEnvelope({ event_type: 'unknown.event' });
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T11 Unknown event type result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'UNKNOWN_EVENT_TYPE');
});

// ============================================
// TEST 12: Validation fails - invalid idempotency key (400)
// ============================================
Deno.test("T12: validateInboundEvent returns 400 for invalid idempotency key (4 segments)", async () => {
  // 4-segment key (missing version)
  const envelope = createValidEnvelope({ idempotency_key: 'crm:reservation:123:created' });
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T12 Invalid idempotency key result:', { 
    statusCode: result.statusCode, 
    errorCode: result.errorCode,
    error: result.error 
  });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'INVALID_IDEMPOTENCY_KEY');
  assertEquals(result.error?.includes('5 segments'), true);
});

// ============================================
// TEST 13: Validation fails - missing required fields (400)
// ============================================
Deno.test("T13: validateInboundEvent returns 400 for missing required fields", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: '123',
      // Missing: crm_organization_id, crm_customer_id, customer_name, reserved_date, lines
    }
  });
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T13 Missing fields result:', { 
    statusCode: result.statusCode, 
    violations: result.violations?.length 
  });
  console.log('T13 Violations:', result.violations);
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.violations && result.violations.length > 0, true);
});

// ============================================
// TEST 14: Validation fails - invalid UOM (400)
// ============================================
Deno.test("T14: validateInboundEvent returns 400 for invalid UOM", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: '123e4567-e89b-12d3-a456-426614174000',
      crm_organization_id: '123e4567-e89b-12d3-a456-426614174001',
      crm_customer_id: '123e4567-e89b-12d3-a456-426614174002',
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [
        { 
          crm_deal_line_id: '123', 
          quality_code: 'P200', 
          color_code: 'BLACK',
          reserved_meters: 100,
          uom: 'YD', // Invalid UOM
          scope: 'INVENTORY'
        }
      ],
    }
  });
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T14 Invalid UOM result:', { 
    statusCode: result.statusCode,
    violations: result.violations 
  });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  
  const uomViolation = result.violations?.find(v => v.type === 'invalid_uom');
  assertExists(uomViolation);
});

// ============================================
// TEST 15: Unknown fields detected (strict mode)
// ============================================
Deno.test("T15: validateInboundEvent detects unknown fields", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: '123e4567-e89b-12d3-a456-426614174000',
      crm_organization_id: '123e4567-e89b-12d3-a456-426614174001',
      crm_customer_id: '123e4567-e89b-12d3-a456-426614174002',
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [],
      unknown_field_1: 'should be detected',
      another_unknown: 123,
    }
  });
  const bodyString = JSON.stringify(envelope);
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const timestamp = Math.floor(Date.now() / 1000);
  
  const req = createMockRequest(envelope, signature, timestamp);
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('T15 Unknown fields result:', { 
    valid: result.valid,
    statusCode: result.statusCode,
    STRICT_MODE 
  });
  console.log('T15 Violations:', result.violations);
  
  // In strict mode, unknown fields should cause rejection
  if (STRICT_MODE) {
    assertEquals(result.valid, false);
    assertEquals(result.statusCode, 400);
    assertEquals(result.errorCode, 'UNKNOWN_FIELDS');
  }
  
  const unknownViolations = result.violations?.filter(v => v.type === 'unknown_field');
  assertEquals(unknownViolations && unknownViolations.length > 0, true);
});

// ============================================
// TEST 16: Response helpers
// ============================================
Deno.test("T16: Response helpers create proper responses", async () => {
  const errorResp = createErrorResponse(400, 'Test error', 'TEST_ERROR', [
    { type: 'missing_required_field', message: 'field is missing' }
  ]);
  
  const successResp = createSuccessResponse({ id: '123' });
  
  console.log('T16 Error response status:', errorResp.status);
  console.log('T16 Success response status:', successResp.status);
  
  assertEquals(errorResp.status, 400);
  assertEquals(successResp.status, 200);
  
  const errorBody = await errorResp.json();
  const successBody = await successResp.json();
  
  assertEquals(errorBody.success, false);
  assertEquals(errorBody.error_code, 'TEST_ERROR');
  assertEquals(successBody.success, true);
  assertEquals(successBody.data.id, '123');
});

// ============================================
// TEST 17: Idempotency key delimiter verification
// ============================================
Deno.test("T17: Idempotency key uses COLON delimiter", () => {
  console.log('T17 IDEMPOTENCY_DELIMITER:', JSON.stringify(IDEMPOTENCY_DELIMITER));
  console.log('T17 Expected:', JSON.stringify(':'));
  
  assertEquals(IDEMPOTENCY_DELIMITER, ':');
  
  // Verify a valid key uses colons
  const validKey = 'crm:reservation:123:created:v1';
  const parts = validKey.split(IDEMPOTENCY_DELIMITER);
  
  console.log('T17 Key parts:', parts);
  console.log('T17 Part count:', parts.length);
  
  assertEquals(parts.length, 5);
  assertEquals(parts[0], 'crm');
  assertEquals(parts[4], 'v1');
});

// ============================================
// TEST 18: All CRM→WMS event types recognized
// ============================================
Deno.test("T18: All 11 CRM→WMS event types are valid", () => {
  console.log('T18 Event types:', CRM_TO_WMS_EVENT_TYPES);
  console.log('T18 Count:', CRM_TO_WMS_EVENT_TYPES.length);
  
  assertEquals(CRM_TO_WMS_EVENT_TYPES.length, 11);
  
  // Verify key events exist
  assertEquals(CRM_TO_WMS_EVENT_TYPES.includes('reservation.created'), true);
  assertEquals(CRM_TO_WMS_EVENT_TYPES.includes('shipment.approved'), true);
  assertEquals(CRM_TO_WMS_EVENT_TYPES.includes('org_access.updated'), true);
});

console.log('\n========================================');
console.log('Session 0.3 Acceptance Tests Complete');
console.log('========================================\n');
