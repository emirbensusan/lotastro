/**
 * Contract Validation Module for WMS-CRM Integration
 * Version: 1.0.23
 * 
 * Implements inbound event validation including:
 * - HMAC signature verification
 * - Schema validation (required fields, types)
 * - UOM validation (MT/KG only)
 * - Unknown field detection
 * - Idempotency key format validation
 * 
 * IMPORTANT: All idempotency keys use COLON (:) as delimiter
 * Format: <source_system>:<entity>:<entity_id>:<action>:v1
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateIdempotencyKey,
  validatePayloadSchema,
  validateContractUom,
  CRM_TO_WMS_EVENT_TYPES,
  CrmToWmsEventType,
  EventEnvelope,
  buildViolationLogParams,
  createIdempotencyViolation,
  createMissingFieldViolation,
  createUnknownFieldViolation,
  createUomViolation,
  ViolationType,
  IDEMPOTENCY_DELIMITER,
} from "./contract-schemas.ts";

// ============================================
// Configuration
// ============================================

/**
 * STRICT_MODE controls unknown field handling:
 * - true: Unknown fields cause rejection (400) and are logged
 * - false: Unknown fields are logged but event is still processed
 */
export const STRICT_MODE = true;

/**
 * HMAC algorithm used for signature verification
 */
const HMAC_ALGORITHM = "SHA-256";

/**
 * Header name for HMAC signature
 */
export const HMAC_HEADER = "X-WMS-Signature";

/**
 * Header name for timestamp (replay protection)
 */
export const TIMESTAMP_HEADER = "X-WMS-Timestamp";

/**
 * Maximum age of request in seconds (replay protection)
 */
const MAX_REQUEST_AGE_SECONDS = 300; // 5 minutes

// ============================================
// HMAC Verification
// ============================================

/**
 * Computes HMAC-SHA256 signature for payload
 */
export async function computeHmac(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: HMAC_ALGORITHM },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  
  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies HMAC signature using timing-safe comparison
 */
export async function verifyHmac(
  payload: string,
  providedSignature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await computeHmac(payload, secret);
  
  // Timing-safe comparison
  if (providedSignature.length !== expectedSignature.length) {
    return false;
  }
  
  let mismatch = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    mismatch |= expectedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  
  return mismatch === 0;
}

/**
 * Validates request timestamp for replay protection
 */
export function validateTimestamp(timestampHeader: string | null): { valid: boolean; error?: string } {
  if (!timestampHeader) {
    return { valid: false, error: 'Missing timestamp header' };
  }
  
  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);
  
  if (age > MAX_REQUEST_AGE_SECONDS) {
    return { valid: false, error: `Request expired (age: ${age}s, max: ${MAX_REQUEST_AGE_SECONDS}s)` };
  }
  
  return { valid: true };
}

// ============================================
// Validation Result Types
// ============================================

export interface ValidationResult {
  valid: boolean;
  statusCode: number;
  error?: string;
  errorCode?: string;
  violations?: Array<{
    type: ViolationType;
    message: string;
    field?: string;
  }>;
}

export interface ValidatedEvent<T = unknown> {
  eventType: CrmToWmsEventType;
  idempotencyKey: string;
  timestamp: string;
  payload: T;
  rawBody: string;
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validates an inbound CRM→WMS event
 * 
 * Checks performed (in order):
 * 1. HMAC signature verification
 * 2. Timestamp validation (replay protection)
 * 3. Event type validation
 * 4. Idempotency key format (5 segments, colon delimiter)
 * 5. Schema validation (required fields)
 * 6. Unknown field detection
 * 7. UOM validation (MT/KG only)
 * 
 * @param req - The incoming HTTP request
 * @param hmacSecret - The shared HMAC secret
 * @returns Validation result with status code and any errors
 */
export async function validateInboundEvent(
  req: Request,
  hmacSecret: string
): Promise<{ result: ValidationResult; event?: ValidatedEvent }> {
  const violations: Array<{ type: ViolationType; message: string; field?: string }> = [];
  
  // 1. Get raw body for HMAC verification
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Failed to read request body',
        errorCode: 'INVALID_BODY',
      }
    };
  }
  
  if (!rawBody || rawBody.trim() === '') {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Empty request body',
        errorCode: 'EMPTY_BODY',
      }
    };
  }
  
  // 2. Check HMAC signature header exists
  const providedSignature = req.headers.get(HMAC_HEADER);
  if (!providedSignature) {
    return {
      result: {
        valid: false,
        statusCode: 401,
        error: `Missing ${HMAC_HEADER} header`,
        errorCode: 'MISSING_HMAC',
        violations: [{ type: 'hmac_failure', message: 'Missing HMAC signature header' }],
      }
    };
  }
  
  // 3. Check timestamp header exists
  const timestampHeader = req.headers.get(TIMESTAMP_HEADER);
  if (!timestampHeader) {
    return {
      result: {
        valid: false,
        statusCode: 401,
        error: `Missing ${TIMESTAMP_HEADER} header`,
        errorCode: 'MISSING_TIMESTAMP',
        violations: [{ type: 'hmac_failure', message: 'Missing timestamp header' }],
      }
    };
  }
  
  // 4. Validate timestamp freshness (replay protection)
  const timestampResult = validateTimestamp(timestampHeader);
  if (!timestampResult.valid) {
    return {
      result: {
        valid: false,
        statusCode: 401,
        error: timestampResult.error,
        errorCode: 'INVALID_TIMESTAMP',
        violations: [{ type: 'hmac_failure', message: timestampResult.error || 'Timestamp validation failed' }],
      }
    };
  }
  
  // 5. Build canonical string and verify HMAC
  // CRITICAL: Canonical format is "${timestamp}.${rawBody}" - this prevents replay attacks
  const canonicalString = `${timestampHeader}.${rawBody}`;
  const hmacValid = await verifyHmac(canonicalString, providedSignature, hmacSecret);
  if (!hmacValid) {
    return {
      result: {
        valid: false,
        statusCode: 401,
        error: 'Invalid HMAC signature',
        errorCode: 'INVALID_HMAC',
        violations: [{ type: 'hmac_failure', message: 'HMAC signature verification failed' }],
      }
    };
  }
  
  // 4. Parse JSON
  let envelope: EventEnvelope;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Invalid JSON in request body',
        errorCode: 'INVALID_JSON',
      }
    };
  }
  
  // 5. Validate event type
  const eventType = envelope.event_type;
  if (!eventType) {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Missing event_type field',
        errorCode: 'MISSING_EVENT_TYPE',
        violations: [{ type: 'missing_required_field', message: 'event_type is required', field: 'event_type' }],
      }
    };
  }
  
  if (!CRM_TO_WMS_EVENT_TYPES.includes(eventType as CrmToWmsEventType)) {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: `Unknown event type: ${eventType}`,
        errorCode: 'UNKNOWN_EVENT_TYPE',
        violations: [{ type: 'unknown_event_type', message: `Unknown event type: ${eventType}`, field: 'event_type' }],
      }
    };
  }
  
  // 6. Validate idempotency key format (5 segments, colon delimiter)
  const idempotencyKey = envelope.idempotency_key;
  if (!idempotencyKey) {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Missing idempotency_key field',
        errorCode: 'MISSING_IDEMPOTENCY_KEY',
        violations: [{ type: 'missing_required_field', message: 'idempotency_key is required', field: 'idempotency_key' }],
      }
    };
  }
  
  const keyValidation = validateIdempotencyKey(idempotencyKey);
  if (!keyValidation.isValid) {
    violations.push({
      type: 'invalid_idempotency_key',
      message: keyValidation.errorMessage || 'Invalid idempotency key format',
      field: 'idempotency_key',
    });
    
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: `Invalid idempotency key: ${keyValidation.errorMessage}. Format must be <source>${IDEMPOTENCY_DELIMITER}<entity>${IDEMPOTENCY_DELIMITER}<id>${IDEMPOTENCY_DELIMITER}<action>${IDEMPOTENCY_DELIMITER}v1`,
        errorCode: 'INVALID_IDEMPOTENCY_KEY',
        violations,
      }
    };
  }
  
  // 7. Validate timestamp field
  if (!envelope.timestamp) {
    violations.push({
      type: 'missing_required_field',
      message: 'timestamp is required',
      field: 'timestamp',
    });
  }
  
  // 8. Validate payload exists
  if (!envelope.payload || typeof envelope.payload !== 'object') {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: 'Missing or invalid payload field',
        errorCode: 'INVALID_PAYLOAD',
        violations: [{ type: 'missing_required_field', message: 'payload must be an object', field: 'payload' }],
      }
    };
  }
  
  // 9. Validate payload schema
  const schemaResult = validatePayloadSchema(
    eventType as CrmToWmsEventType,
    envelope.payload as Record<string, unknown>
  );
  
  // Check for missing required fields
  if (schemaResult.missingFields.length > 0) {
    for (const field of schemaResult.missingFields) {
      violations.push({
        type: 'missing_required_field',
        message: `Missing required field: ${field}`,
        field,
      });
    }
  }
  
  // Check for invalid field values
  for (const invalid of schemaResult.invalidFields) {
    violations.push({
      type: 'invalid_uom',
      message: invalid.reason,
      field: invalid.field,
    });
  }
  
  // Check for unknown fields
  if (schemaResult.unknownFields.length > 0) {
    for (const field of schemaResult.unknownFields) {
      violations.push({
        type: 'unknown_field',
        message: `Unknown field in payload: ${field}`,
        field,
      });
    }
    
    // In strict mode, reject unknown fields
    if (STRICT_MODE) {
      return {
        result: {
          valid: false,
          statusCode: 400,
          error: `Unknown fields detected: ${schemaResult.unknownFields.join(', ')}. Strict mode enabled.`,
          errorCode: 'UNKNOWN_FIELDS',
          violations,
        }
      };
    }
  }
  
  // 10. Validate UOM fields in payload
  const payload = envelope.payload as Record<string, unknown>;
  if ('uom' in payload && typeof payload.uom === 'string') {
    if (!validateContractUom(payload.uom)) {
      violations.push({
        type: 'invalid_uom',
        message: `Invalid UOM: ${payload.uom} (must be MT or KG)`,
        field: 'uom',
      });
    }
  }
  
  // Check for UOM in nested lines array
  if ('lines' in payload && Array.isArray(payload.lines)) {
    for (let i = 0; i < payload.lines.length; i++) {
      const line = payload.lines[i] as Record<string, unknown>;
      if ('uom' in line && typeof line.uom === 'string') {
        if (!validateContractUom(line.uom)) {
          violations.push({
            type: 'invalid_uom',
            message: `Invalid UOM in lines[${i}]: ${line.uom} (must be MT or KG)`,
            field: `lines[${i}].uom`,
          });
        }
      }
    }
  }
  
  // If we have any violations for required fields or UOM, reject
  const criticalViolations = violations.filter(
    v => v.type === 'missing_required_field' || v.type === 'invalid_uom'
  );
  
  if (criticalViolations.length > 0) {
    return {
      result: {
        valid: false,
        statusCode: 400,
        error: criticalViolations.map(v => v.message).join('; '),
        errorCode: 'VALIDATION_FAILED',
        violations,
      }
    };
  }
  
  // Validation passed
  return {
    result: {
      valid: true,
      statusCode: 200,
      violations: violations.length > 0 ? violations : undefined,
    },
    event: {
      eventType: eventType as CrmToWmsEventType,
      idempotencyKey,
      timestamp: envelope.timestamp,
      payload: envelope.payload,
      rawBody,
    }
  };
}

// ============================================
// Violation Logging Helper
// ============================================

/**
 * Logs validation violations to the database
 */
export async function logValidationViolations(
  supabaseUrl: string,
  supabaseServiceKey: string,
  eventType: string,
  idempotencyKey: string | undefined,
  violations: Array<{ type: ViolationType; message: string; field?: string }>,
  payloadSnapshot?: Record<string, unknown>
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  for (const violation of violations) {
    try {
      await supabase.rpc('log_contract_violation', {
        p_event_type: eventType,
        p_idempotency_key: idempotencyKey ?? null,
        p_source_system: 'crm',
        p_violation_type: violation.type,
        p_violation_message: violation.message,
        p_field_name: violation.field ?? null,
        p_field_value: null,
        p_expected_value: null,
        p_payload_snapshot: payloadSnapshot ?? null,
        p_inbox_id: null,
      });
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
  }
}

// ============================================
// Response Helpers
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wms-signature, x-wms-timestamp',
};

export function createErrorResponse(
  statusCode: number,
  error: string,
  errorCode: string,
  violations?: Array<{ type: string; message: string; field?: string }>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error,
      error_code: errorCode,
      violations,
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

export function createSuccessResponse(data: unknown): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export { corsHeaders };
