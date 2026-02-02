-- ============================================
-- Session 0.1 Acceptance Tests
-- Run in Supabase SQL Editor (has superuser access)
-- ============================================

-- PRE-TEST: Count existing violations
SELECT 'BEFORE COUNT' as test, COUNT(*) as violation_count FROM integration_contract_violations;

-- ============================================
-- TEST 1: Valid 5-segment idempotency key (EXPECT: is_valid = true)
-- ============================================
SELECT 
  'TEST 1: Valid 5-segment key' as test_name,
  'wms:order:123:created:v1' as input,
  * 
FROM validate_idempotency_key('wms:order:123:created:v1');

-- ============================================
-- TEST 2: Invalid 4-segment key (EXPECT: is_valid = false)
-- ============================================
SELECT 
  'TEST 2: Invalid 4-segment key' as test_name,
  'wms:order:123:created' as input,
  * 
FROM validate_idempotency_key('wms:order:123:created');

-- Log violation for TEST 2 failure
SELECT log_contract_violation(
  'test_event',                        -- event_type
  'wms:order:123:created',             -- idempotency_key
  'crm',                               -- source_system
  'invalid_idempotency_key',           -- violation_type
  'Expected 5 segments, got 4',        -- violation_message
  'idempotency_key',                   -- field_name
  'wms:order:123:created',             -- field_value
  '<source>:<entity>:<id>:<action>:v1', -- expected_value
  '{"test": "session_0.1"}'::jsonb,    -- payload_snapshot
  NULL                                 -- inbox_id
) as violation_id_test2;

-- ============================================
-- TEST 3: Invalid key with bad source_system (EXPECT: is_valid = false)
-- ============================================
SELECT 
  'TEST 3: Invalid source_system' as test_name,
  'erp:order:123:created:v1' as input,
  * 
FROM validate_idempotency_key('erp:order:123:created:v1');

-- Log violation for TEST 3 failure
SELECT log_contract_violation(
  'test_event',                        -- event_type
  'erp:order:123:created:v1',          -- idempotency_key
  'crm',                               -- source_system
  'invalid_idempotency_key',           -- violation_type
  'Invalid source_system: erp (must be wms or crm)', -- violation_message
  'source_system',                     -- field_name
  'erp',                               -- field_value
  'wms or crm',                        -- expected_value
  '{"test": "session_0.1"}'::jsonb,    -- payload_snapshot
  NULL                                 -- inbox_id
) as violation_id_test3;

-- ============================================
-- TEST 4: Allowed UOM - MT (EXPECT: true)
-- ============================================
SELECT 
  'TEST 4: Valid UOM (MT)' as test_name,
  'MT' as input,
  validate_contract_uom('MT') as is_valid;

-- Also test KG
SELECT 
  'TEST 4b: Valid UOM (KG)' as test_name,
  'KG' as input,
  validate_contract_uom('KG') as is_valid;

-- ============================================
-- TEST 5: Disallowed UOM - YD (EXPECT: false)
-- ============================================
SELECT 
  'TEST 5: Invalid UOM (YD)' as test_name,
  'YD' as input,
  validate_contract_uom('YD') as is_valid;

-- Log violation for TEST 5 failure
SELECT log_contract_violation(
  'test_event',                        -- event_type
  NULL,                                -- idempotency_key
  'crm',                               -- source_system
  'invalid_uom',                       -- violation_type
  'UOM YD is not allowed by contract', -- violation_message
  'uom',                               -- field_name
  'YD',                                -- field_value
  'MT or KG',                          -- expected_value
  '{"test": "session_0.1", "uom": "YD"}'::jsonb, -- payload_snapshot
  NULL                                 -- inbox_id
) as violation_id_test5;

-- ============================================
-- POST-TEST: Count violations (should be 3 more)
-- ============================================
SELECT 'AFTER COUNT' as test, COUNT(*) as violation_count FROM integration_contract_violations;

-- ============================================
-- VERIFY: Show all logged violations with detail
-- ============================================
SELECT 
  id,
  created_at,
  event_type,
  violation_type,
  violation_message,
  field_name,
  field_value,
  expected_value
FROM integration_contract_violations
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- SUMMARY TABLE
-- ============================================
SELECT 
  'TEST SUMMARY' as section,
  'Test 1: Valid 5-seg key' as test,
  CASE WHEN (SELECT is_valid FROM validate_idempotency_key('wms:order:123:created:v1')) THEN '✅ PASS' ELSE '❌ FAIL' END as result
UNION ALL
SELECT 
  'TEST SUMMARY',
  'Test 2: Invalid 4-seg key',
  CASE WHEN NOT (SELECT is_valid FROM validate_idempotency_key('wms:order:123:created')) THEN '✅ PASS' ELSE '❌ FAIL' END
UNION ALL
SELECT 
  'TEST SUMMARY',
  'Test 3: Bad source_system',
  CASE WHEN NOT (SELECT is_valid FROM validate_idempotency_key('erp:order:123:created:v1')) THEN '✅ PASS' ELSE '❌ FAIL' END
UNION ALL
SELECT 
  'TEST SUMMARY',
  'Test 4: Valid UOM (MT)',
  CASE WHEN validate_contract_uom('MT') THEN '✅ PASS' ELSE '❌ FAIL' END
UNION ALL
SELECT 
  'TEST SUMMARY',
  'Test 5: Invalid UOM (YD)',
  CASE WHEN NOT validate_contract_uom('YD') THEN '✅ PASS' ELSE '❌ FAIL' END;
