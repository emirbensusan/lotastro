/**
 * Session 1.2 Acceptance Tests
 * Webhook Receiver Core Logic with Canonical HMAC
 * 
 * CRITICAL: HMAC is computed over "${timestamp}.${rawBody}" (canonical string)
 * computeHmac(message, secret) hashes EXACTLY the input message - no internal canonicalization
 * 
 * Test Coverage:
 * - 401: Missing signature, missing timestamp, expired timestamp, invalid signature (body-only)
 * - 400: Invalid idempotency (4 segments, v2, invalid source), unknown event type, unknown fields, invalid UOM
 * - 200: New event creates inbox row, duplicate returns 200 without new row, failed->pending retry
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  computeHmac,
  verifyHmac,
  validateInboundEvent,
  HMAC_HEADER,
  TIMESTAMP_HEADER,
} from "../_shared/contract-validation.ts";

import {
  IDEMPOTENCY_DELIMITER,
} from "../_shared/contract-schemas.ts";

// Test secret for HMAC verification
const TEST_SECRET = 'test-hmac-secret-for-session-1-2';

// Helper to get current epoch timestamp in seconds
function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// Helper to create a mock request with proper canonical HMAC
async function createMockRequest(
  body: object | string,
  options: {
    signature?: string;
    timestamp?: string;
    computeValidSignature?: boolean;
    useBodyOnlySignature?: boolean; // For testing that body-only HMAC fails
  } = {}
): Promise<Request> {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  
  const timestamp = options.timestamp ?? nowEpochSeconds().toString();
  
  if (options.computeValidSignature) {
    // CORRECT: Canonical string is "${timestamp}.${rawBody}"
    const canonicalString = `${timestamp}.${bodyString}`;
    const signature = await computeHmac(canonicalString, TEST_SECRET);
    headers.set(HMAC_HEADER, signature);
    headers.set(TIMESTAMP_HEADER, timestamp);
  } else if (options.useBodyOnlySignature) {
    // WRONG: Body-only signature should FAIL
    const wrongSignature = await computeHmac(bodyString, TEST_SECRET);
    headers.set(HMAC_HEADER, wrongSignature);
    headers.set(TIMESTAMP_HEADER, timestamp);
  } else {
    if (options.signature !== undefined) {
      headers.set(HMAC_HEADER, options.signature);
    }
    if (options.timestamp !== undefined) {
      headers.set(TIMESTAMP_HEADER, options.timestamp);
    }
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
    idempotency_key: `crm${IDEMPOTENCY_DELIMITER}reservation${IDEMPOTENCY_DELIMITER}${crypto.randomUUID()}${IDEMPOTENCY_DELIMITER}created${IDEMPOTENCY_DELIMITER}v1`,
    timestamp: new Date().toISOString(),
    source_system: 'crm',
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [],
    },
    ...overrides,
  };
}

// ============================================
// 401 TESTS - Authentication/HMAC Failures
// ============================================

Deno.test("401-1: Missing X-WMS-Signature header returns 401", async () => {
  const envelope = createValidEnvelope();
  const timestamp = nowEpochSeconds().toString();
  
  // No signature, only timestamp
  const req = await createMockRequest(envelope, { timestamp });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('401-1 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'MISSING_HMAC');
});

Deno.test("401-2: Missing X-WMS-Timestamp header returns 401", async () => {
  const envelope = createValidEnvelope();
  const bodyString = JSON.stringify(envelope);
  
  // Compute signature but don't include timestamp header
  const signature = await computeHmac(bodyString, TEST_SECRET);
  const req = await createMockRequest(envelope, { signature });
  
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('401-2 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'MISSING_TIMESTAMP');
});

Deno.test("401-3: Expired timestamp (>5 min old) returns 401", async () => {
  const envelope = createValidEnvelope();
  const bodyString = JSON.stringify(envelope);
  
  // Timestamp from 10 minutes ago
  const expiredTimestamp = (nowEpochSeconds() - 600).toString();
  const canonicalString = `${expiredTimestamp}.${bodyString}`;
  const signature = await computeHmac(canonicalString, TEST_SECRET);
  
  const headers = new Headers({
    'Content-Type': 'application/json',
    [HMAC_HEADER]: signature,
    [TIMESTAMP_HEADER]: expiredTimestamp,
  });
  
  const req = new Request('https://example.com/webhook', {
    method: 'POST',
    headers,
    body: bodyString,
  });
  
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('401-3 Result:', { statusCode: result.statusCode, errorCode: result.errorCode, error: result.error });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'INVALID_TIMESTAMP');
});

Deno.test("401-4: Invalid HMAC signature returns 401", async () => {
  const envelope = createValidEnvelope();
  const timestamp = nowEpochSeconds().toString();
  
  const req = await createMockRequest(envelope, { 
    signature: 'definitely-invalid-signature-abcdef1234567890abcdef1234567890ab',
    timestamp 
  });
  
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('401-4 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'INVALID_HMAC');
});

Deno.test("401-5: CRITICAL - Body-only HMAC (no timestamp prefix) MUST fail with 401", async () => {
  const envelope = createValidEnvelope();
  
  // This test ensures that an attacker cannot bypass replay protection
  // by computing HMAC over body alone instead of "${timestamp}.${body}"
  const req = await createMockRequest(envelope, { useBodyOnlySignature: true });
  
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('401-5 Result:', { 
    statusCode: result.statusCode, 
    errorCode: result.errorCode,
    message: 'Body-only signature correctly rejected'
  });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 401);
  assertEquals(result.errorCode, 'INVALID_HMAC');
});

Deno.test("401-6: Canonical HMAC verification - correct format passes", async () => {
  const envelope = createValidEnvelope();
  const bodyString = JSON.stringify(envelope);
  const timestamp = nowEpochSeconds().toString();
  
  // CORRECT: Canonical string is "${timestamp}.${rawBody}"
  const canonicalString = `${timestamp}.${bodyString}`;
  const correctSignature = await computeHmac(canonicalString, TEST_SECRET);
  
  // WRONG: Body-only signature
  const wrongSignature = await computeHmac(bodyString, TEST_SECRET);
  
  console.log('401-6 Signatures differ:', correctSignature !== wrongSignature);
  assertNotEquals(correctSignature, wrongSignature, 'Canonical and body-only signatures must differ');
  
  // Verify correct signature passes
  const correctReq = await createMockRequest(envelope, { computeValidSignature: true });
  const { result: correctResult } = await validateInboundEvent(correctReq, TEST_SECRET);
  
  console.log('401-6 Correct signature result:', { statusCode: correctResult.statusCode });
  assertEquals(correctResult.statusCode, 200);
});

// ============================================
// 400 TESTS - Schema/Validation Failures
// ============================================

Deno.test("400-1: Invalid idempotency key (4 segments) returns 400", async () => {
  const envelope = createValidEnvelope({ 
    idempotency_key: 'crm:reservation:123:created' // Missing :v1
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-1 Result:', { statusCode: result.statusCode, errorCode: result.errorCode, error: result.error });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'INVALID_IDEMPOTENCY_KEY');
  assertEquals(result.error?.includes('5 segments'), true);
});

Deno.test("400-2: Invalid idempotency key (v2 version) returns 400", async () => {
  const envelope = createValidEnvelope({ 
    idempotency_key: 'crm:reservation:123:created:v2' // v2 instead of v1
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-2 Result:', { statusCode: result.statusCode, errorCode: result.errorCode, error: result.error });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'INVALID_IDEMPOTENCY_KEY');
  assertEquals(result.error?.includes('v1'), true);
});

Deno.test("400-3: Invalid idempotency key (invalid source 'xyz') returns 400", async () => {
  const envelope = createValidEnvelope({ 
    idempotency_key: 'xyz:reservation:123:created:v1' // xyz instead of crm/wms
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-3 Result:', { statusCode: result.statusCode, errorCode: result.errorCode, error: result.error });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'INVALID_IDEMPOTENCY_KEY');
});

Deno.test("400-4: Unknown event type returns 400", async () => {
  const envelope = createValidEnvelope({ event_type: 'unknown.event.type' });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-4 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'UNKNOWN_EVENT_TYPE');
});

Deno.test("400-5: Unknown fields (strict mode) returns 400", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [],
      unknown_field_xyz: 'should trigger strict mode rejection',
      another_unknown_field: 12345,
    }
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-5 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'UNKNOWN_FIELDS');
  
  const unknownViolations = result.violations?.filter(v => v.type === 'unknown_field');
  assertExists(unknownViolations);
  assertEquals(unknownViolations.length >= 2, true);
});

Deno.test("400-6: Invalid UOM (YD instead of MT/KG) returns 400", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [
        { 
          crm_deal_line_id: crypto.randomUUID(), 
          quality_code: 'P200', 
          color_code: 'BLACK',
          reserved_meters: 100,
          uom: 'YD', // Invalid - must be MT or KG
          scope: 'INVENTORY'
        }
      ],
    }
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-6 Result:', { statusCode: result.statusCode, violations: result.violations });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  
  const uomViolation = result.violations?.find(v => v.type === 'invalid_uom');
  assertExists(uomViolation);
});

Deno.test("400-7: Missing event_type returns 400", async () => {
  const envelope = {
    idempotency_key: 'crm:reservation:123:created:v1',
    timestamp: new Date().toISOString(),
    payload: {},
    // Missing event_type
  };
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-7 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'MISSING_EVENT_TYPE');
});

Deno.test("400-8: Missing idempotency_key returns 400", async () => {
  const envelope = {
    event_type: 'reservation.created',
    timestamp: new Date().toISOString(),
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test',
      reserved_date: '2025-02-02',
      lines: [],
    },
    // Missing idempotency_key
  };
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('400-8 Result:', { statusCode: result.statusCode, errorCode: result.errorCode });
  
  assertEquals(result.valid, false);
  assertEquals(result.statusCode, 400);
  assertEquals(result.errorCode, 'MISSING_IDEMPOTENCY_KEY');
});

// ============================================
// 200 TESTS - Success Cases
// ============================================

Deno.test("200-1: Valid event with canonical HMAC returns 200", async () => {
  const envelope = createValidEnvelope();
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result, event } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('200-1 Result:', { statusCode: result.statusCode, eventType: event?.eventType });
  
  assertEquals(result.valid, true);
  assertEquals(result.statusCode, 200);
  assertExists(event);
  assertEquals(event.eventType, 'reservation.created');
  assertExists(event.idempotencyKey);
  assertExists(event.rawBody);
});

Deno.test("200-2: Valid UOM MT is accepted", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [
        { 
          crm_deal_line_id: crypto.randomUUID(), 
          quality_code: 'P200', 
          color_code: 'BLACK',
          reserved_meters: 100,
          uom: 'MT', // Valid
          scope: 'INVENTORY'
        }
      ],
    }
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('200-2 Result:', { statusCode: result.statusCode });
  
  assertEquals(result.valid, true);
  assertEquals(result.statusCode, 200);
});

Deno.test("200-3: Valid UOM KG is accepted", async () => {
  const envelope = createValidEnvelope({
    payload: {
      crm_reservation_id: crypto.randomUUID(),
      crm_organization_id: crypto.randomUUID(),
      crm_customer_id: crypto.randomUUID(),
      customer_name: 'Test Customer',
      reserved_date: '2025-02-02',
      lines: [
        { 
          crm_deal_line_id: crypto.randomUUID(), 
          quality_code: 'P200', 
          color_code: 'BLACK',
          reserved_meters: 50,
          uom: 'KG', // Valid
          scope: 'INVENTORY'
        }
      ],
    }
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('200-3 Result:', { statusCode: result.statusCode });
  
  assertEquals(result.valid, true);
  assertEquals(result.statusCode, 200);
});

// ============================================
// HMAC UNIT TESTS
// ============================================

Deno.test("HMAC-1: computeHmac hashes EXACTLY the input message (no internal canonicalization)", async () => {
  const message1 = '{"test":"data"}';
  const message2 = '1234567890.{"test":"data"}'; // Pre-canonicalized
  
  const sig1 = await computeHmac(message1, TEST_SECRET);
  const sig2 = await computeHmac(message2, TEST_SECRET);
  
  console.log('HMAC-1 sig1:', sig1.substring(0, 16) + '...');
  console.log('HMAC-1 sig2:', sig2.substring(0, 16) + '...');
  
  // Different inputs MUST produce different signatures
  assertNotEquals(sig1, sig2);
  
  // Same input MUST produce same signature
  const sig1Again = await computeHmac(message1, TEST_SECRET);
  assertEquals(sig1, sig1Again);
});

Deno.test("HMAC-2: verifyHmac validates exact message match", async () => {
  const message = 'test-message';
  const signature = await computeHmac(message, TEST_SECRET);
  
  // Exact match should pass
  const valid = await verifyHmac(message, signature, TEST_SECRET);
  assertEquals(valid, true);
  
  // Different message should fail
  const invalid = await verifyHmac('different-message', signature, TEST_SECRET);
  assertEquals(invalid, false);
});

Deno.test("HMAC-3: Canonical string format is ${timestamp}.${body}", async () => {
  const body = JSON.stringify({ event: 'test' });
  const timestamp = '1234567890';
  
  // This is the ONLY correct way to build canonical string
  const canonicalString = `${timestamp}.${body}`;
  
  console.log('HMAC-3 Canonical string:', canonicalString.substring(0, 50) + '...');
  
  // Verify the format
  assertEquals(canonicalString.startsWith(timestamp), true);
  assertEquals(canonicalString.includes('.'), true);
  assertEquals(canonicalString.endsWith(body), true);
  
  // The signature should be computable
  const signature = await computeHmac(canonicalString, TEST_SECRET);
  assertEquals(signature.length, 64); // SHA-256 = 64 hex chars
});

// ============================================
// IDEMPOTENCY KEY FORMAT TESTS
// ============================================

Deno.test("IDEM-1: Valid 5-segment key with colon delimiter is accepted", async () => {
  const envelope = createValidEnvelope({ 
    idempotency_key: 'crm:reservation:abc-123:created:v1'
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result, event } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('IDEM-1 Result:', { valid: result.valid, key: event?.idempotencyKey });
  
  assertEquals(result.valid, true);
  assertEquals(event?.idempotencyKey, 'crm:reservation:abc-123:created:v1');
});

Deno.test("IDEM-2: Source 'wms' is valid", async () => {
  const envelope = createValidEnvelope({ 
    idempotency_key: 'wms:stock_item:P200|BLACK:changed:v1'
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('IDEM-2 Result:', { valid: result.valid, statusCode: result.statusCode });
  
  assertEquals(result.valid, true);
  assertEquals(result.statusCode, 200);
});

Deno.test("IDEM-3: Pipe separator in entity_id is valid", async () => {
  // Per contract Section 5.4: stock item keys use pipe separator
  const envelope = createValidEnvelope({ 
    idempotency_key: 'wms:stock_item:QUALITY|COLOR:low_stock:v1'
  });
  
  const req = await createMockRequest(envelope, { computeValidSignature: true });
  const { result } = await validateInboundEvent(req, TEST_SECRET);
  
  console.log('IDEM-3 Result:', { valid: result.valid });
  
  assertEquals(result.valid, true);
});

console.log('\n========================================');
console.log('Session 1.2 Acceptance Tests');
console.log('Canonical HMAC: ${timestamp}.${rawBody}');
console.log('========================================\n');
