/**
 * Session 0.2 Acceptance Tests
 * Contract Schema Definitions for Edge Functions
 * 
 * Run with: Deno test runner via Lovable
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  validateIdempotencyKey,
  validateContractUom,
  validatePayloadSchema,
  generateIdempotencyKey,
  generateStockIdempotencyKey,
  CONTRACT_UOM_VALUES,
  SOURCE_SYSTEMS,
  IDEMPOTENCY_DELIMITER,
  IDEMPOTENCY_VERSION,
  CRM_TO_WMS_EVENT_TYPES,
  EVENT_SCHEMAS,
  createIdempotencyViolation,
  createUomViolation,
  buildViolationLogParams,
} from "../_shared/contract-schemas.ts";

// ============================================
// TEST 1: Valid 5-segment idempotency key (PASS)
// ============================================
Deno.test("T1: Valid 5-segment idempotency key returns isValid=true", () => {
  const result = validateIdempotencyKey('wms:order:123:created:v1');
  
  console.log('T1 Result:', JSON.stringify(result, null, 2));
  
  assertEquals(result.isValid, true);
  assertEquals(result.sourceSystem, 'wms');
  assertEquals(result.entity, 'order');
  assertEquals(result.entityId, '123');
  assertEquals(result.action, 'created');
  assertEquals(result.version, 'v1');
  assertEquals(result.errorMessage, null);
});

// ============================================
// TEST 2: Invalid 4-segment key (FAIL)
// ============================================
Deno.test("T2: Invalid 4-segment key returns isValid=false", () => {
  const result = validateIdempotencyKey('wms:order:123:created');
  
  console.log('T2 Result:', JSON.stringify(result, null, 2));
  
  assertEquals(result.isValid, false);
  assertEquals(result.errorMessage?.includes('Expected 5 segments'), true);
});

// ============================================
// TEST 3: Empty segment (FAIL)
// ============================================
Deno.test("T3: Empty segment returns isValid=false", () => {
  const result = validateIdempotencyKey('wms::123:created:v1');
  
  console.log('T3 Result:', JSON.stringify(result, null, 2));
  
  assertEquals(result.isValid, false);
  assertEquals(result.errorMessage?.includes('cannot be empty'), true);
});

// ============================================
// TEST 4: Bad source system (FAIL)
// ============================================
Deno.test("T4: Bad source_system 'erp' returns isValid=false", () => {
  const result = validateIdempotencyKey('erp:order:123:created:v1');
  
  console.log('T4 Result:', JSON.stringify(result, null, 2));
  
  assertEquals(result.isValid, false);
  assertEquals(result.errorMessage?.includes('Invalid source_system'), true);
});

// ============================================
// TEST 5: Valid UOM values (PASS)
// ============================================
Deno.test("T5: Valid UOM 'MT' and 'KG' return true", () => {
  const mtValid = validateContractUom('MT');
  const kgValid = validateContractUom('KG');
  const mtLower = validateContractUom('mt'); // Should also work (case insensitive)
  
  console.log('T5 MT valid:', mtValid);
  console.log('T5 KG valid:', kgValid);
  console.log('T5 mt (lowercase) valid:', mtLower);
  
  assertEquals(mtValid, true);
  assertEquals(kgValid, true);
  assertEquals(mtLower, true);
});

// ============================================
// TEST 6: Invalid UOM values (FAIL)
// ============================================
Deno.test("T6: Invalid UOM 'YD' and 'LB' return false", () => {
  const ydValid = validateContractUom('YD');
  const lbValid = validateContractUom('LB');
  const nullValid = validateContractUom(null);
  const emptyValid = validateContractUom('');
  
  console.log('T6 YD valid:', ydValid);
  console.log('T6 LB valid:', lbValid);
  console.log('T6 null valid:', nullValid);
  console.log('T6 empty valid:', emptyValid);
  
  assertEquals(ydValid, false);
  assertEquals(lbValid, false);
  assertEquals(nullValid, false);
  assertEquals(emptyValid, false);
});

// ============================================
// TEST 7: Generate idempotency key
// ============================================
Deno.test("T7: generateIdempotencyKey produces correct format", () => {
  const key = generateIdempotencyKey('wms', 'order', '456', 'shipped');
  
  console.log('T7 Generated key:', key);
  
  assertEquals(key, 'wms:order:456:shipped:v1');
  
  // Validate the generated key
  const validation = validateIdempotencyKey(key);
  assertEquals(validation.isValid, true);
});

// ============================================
// TEST 8: Generate stock idempotency key
// ============================================
Deno.test("T8: generateStockIdempotencyKey uses pipe separator for quality|color", () => {
  const key = generateStockIdempotencyKey('P200', 'BLACK', 'changed');
  
  console.log('T8 Generated stock key:', key);
  
  assertEquals(key, 'wms:stock_item:P200|BLACK:changed:v1');
  
  // Validate the generated key
  const validation = validateIdempotencyKey(key);
  assertEquals(validation.isValid, true);
});

// ============================================
// TEST 9: Payload schema validation - missing fields
// ============================================
Deno.test("T9: validatePayloadSchema detects missing required fields", () => {
  const result = validatePayloadSchema('reservation.created', {
    crm_reservation_id: '123',
    // Missing: crm_organization_id, crm_customer_id, customer_name, reserved_date, lines
  });
  
  console.log('T9 Missing fields:', result.missingFields);
  console.log('T9 isValid:', result.isValid);
  
  assertEquals(result.isValid, false);
  assertEquals(result.missingFields.includes('crm_organization_id'), true);
  assertEquals(result.missingFields.includes('customer_name'), true);
  assertEquals(result.missingFields.includes('lines'), true);
});

// ============================================
// TEST 10: Payload schema validation - unknown fields
// ============================================
Deno.test("T10: validatePayloadSchema detects unknown fields", () => {
  const result = validatePayloadSchema('reservation.cancelled', {
    crm_reservation_id: '123',
    cancelled_at: '2025-02-02T10:00:00Z',
    some_unknown_field: 'value',
    another_unknown: 123,
  });
  
  console.log('T10 Unknown fields:', result.unknownFields);
  
  assertEquals(result.unknownFields.includes('some_unknown_field'), true);
  assertEquals(result.unknownFields.includes('another_unknown'), true);
});

// ============================================
// TEST 11: Contract constants verification
// ============================================
Deno.test("T11: Contract constants are correctly defined", () => {
  console.log('T11 CONTRACT_UOM_VALUES:', CONTRACT_UOM_VALUES);
  console.log('T11 SOURCE_SYSTEMS:', SOURCE_SYSTEMS);
  console.log('T11 IDEMPOTENCY_DELIMITER:', IDEMPOTENCY_DELIMITER);
  console.log('T11 IDEMPOTENCY_VERSION:', IDEMPOTENCY_VERSION);
  
  assertEquals(CONTRACT_UOM_VALUES.length, 2);
  assertEquals(CONTRACT_UOM_VALUES.includes('MT'), true);
  assertEquals(CONTRACT_UOM_VALUES.includes('KG'), true);
  
  assertEquals(SOURCE_SYSTEMS.length, 2);
  assertEquals(SOURCE_SYSTEMS.includes('wms'), true);
  assertEquals(SOURCE_SYSTEMS.includes('crm'), true);
  
  assertEquals(IDEMPOTENCY_DELIMITER, ':');
  assertEquals(IDEMPOTENCY_VERSION, 'v1');
});

// ============================================
// TEST 12: All 11 CRM→WMS event types defined
// ============================================
Deno.test("T12: All 11 CRM→WMS event types are defined with schemas", () => {
  console.log('T12 Event types:', CRM_TO_WMS_EVENT_TYPES);
  
  assertEquals(CRM_TO_WMS_EVENT_TYPES.length, 11);
  
  // Verify each event type has a schema
  for (const eventType of CRM_TO_WMS_EVENT_TYPES) {
    const schema = EVENT_SCHEMAS[eventType];
    assertExists(schema, `Schema missing for ${eventType}`);
    assertExists(schema.fields, `Fields missing for ${eventType}`);
    console.log(`  ✓ ${eventType} - ${Object.keys(schema.fields).length} fields`);
  }
});

// ============================================
// TEST 13: Violation helper functions
// ============================================
Deno.test("T13: Violation helper functions work correctly", () => {
  const idempViolation = createIdempotencyViolation(
    'reservation.created',
    'bad:key',
    { isValid: false, errorMessage: 'Test error', sourceSystem: null, entity: null, entityId: null, action: null, version: null }
  );
  
  console.log('T13 Idempotency violation:', JSON.stringify(idempViolation, null, 2));
  
  assertEquals(idempViolation.violationType, 'invalid_idempotency_key');
  assertEquals(idempViolation.sourceSystem, 'crm');
  
  const uomViolation = createUomViolation('stock.changed', 'uom', 'YD');
  console.log('T13 UOM violation:', JSON.stringify(uomViolation, null, 2));
  
  assertEquals(uomViolation.violationType, 'invalid_uom');
  assertEquals(uomViolation.fieldValue, 'YD');
  
  // Test buildViolationLogParams
  const params = buildViolationLogParams(uomViolation);
  console.log('T13 SQL params:', JSON.stringify(params, null, 2));
  
  assertEquals(params.p_violation_type, 'invalid_uom');
  assertEquals(params.p_field_value, 'YD');
});

// ============================================
// TEST 14: Null/undefined handling
// ============================================
Deno.test("T14: Null and undefined inputs handled gracefully", () => {
  const nullResult = validateIdempotencyKey(null);
  const undefinedResult = validateIdempotencyKey(undefined);
  const emptyResult = validateIdempotencyKey('');
  const whitespaceResult = validateIdempotencyKey('   ');
  
  console.log('T14 null result:', nullResult.isValid, nullResult.errorMessage);
  console.log('T14 undefined result:', undefinedResult.isValid, undefinedResult.errorMessage);
  console.log('T14 empty result:', emptyResult.isValid, emptyResult.errorMessage);
  console.log('T14 whitespace result:', whitespaceResult.isValid, whitespaceResult.errorMessage);
  
  assertEquals(nullResult.isValid, false);
  assertEquals(undefinedResult.isValid, false);
  assertEquals(emptyResult.isValid, false);
  assertEquals(whitespaceResult.isValid, false);
});

console.log('\n========================================');
console.log('Session 0.2 Acceptance Tests Complete');
console.log('========================================\n');
