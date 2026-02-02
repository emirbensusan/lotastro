/**
 * Contract Validation Utilities
 * 
 * Client-side validation helpers for WMS-CRM integration contract v1.0.23
 * These mirror the database functions for pre-flight validation
 */

// Valid UOM values per contract Section 4.2
export const CONTRACT_UOM_VALUES = ['MT', 'KG'] as const;
export type ContractUOM = typeof CONTRACT_UOM_VALUES[number];

// Valid source systems
export const SOURCE_SYSTEMS = ['wms', 'crm'] as const;
export type SourceSystem = typeof SOURCE_SYSTEMS[number];

/**
 * Validates a UOM against contract-allowed values
 * Contract only allows MT (meters) and KG (kilograms)
 */
export function validateContractUom(uom: string | null | undefined): boolean {
  if (!uom) return false;
  return CONTRACT_UOM_VALUES.includes(uom.toUpperCase() as ContractUOM);
}

/**
 * Validates idempotency key format
 * Contract format: <source_system>:<entity>:<entity_id>:<action>:v1
 */
export interface IdempotencyKeyValidation {
  isValid: boolean;
  sourceSystem: string | null;
  entity: string | null;
  entityId: string | null;
  action: string | null;
  version: string | null;
  errorMessage: string | null;
}

export function validateIdempotencyKey(key: string | null | undefined): IdempotencyKeyValidation {
  // Handle null or empty input
  if (!key || key.trim() === '') {
    return {
      isValid: false,
      sourceSystem: null,
      entity: null,
      entityId: null,
      action: null,
      version: null,
      errorMessage: 'Idempotency key is null or empty',
    };
  }

  // Split by colon
  const parts = key.split(':');

  // Must have exactly 5 segments
  if (parts.length !== 5) {
    return {
      isValid: false,
      sourceSystem: null,
      entity: null,
      entityId: null,
      action: null,
      version: null,
      errorMessage: `Expected 5 segments, got ${parts.length}`,
    };
  }

  const [sourceSystem, entity, entityId, action, version] = parts;

  // Validate source_system
  if (!SOURCE_SYSTEMS.includes(sourceSystem as SourceSystem)) {
    return {
      isValid: false,
      sourceSystem,
      entity,
      entityId,
      action,
      version,
      errorMessage: `Invalid source_system: ${sourceSystem} (must be wms or crm)`,
    };
  }

  // Validate version
  if (version !== 'v1') {
    return {
      isValid: false,
      sourceSystem,
      entity,
      entityId,
      action,
      version,
      errorMessage: `Invalid version: ${version} (must be v1)`,
    };
  }

  // Validate no empty segments
  if (!entity || !entityId || !action) {
    return {
      isValid: false,
      sourceSystem,
      entity,
      entityId,
      action,
      version,
      errorMessage: 'Entity, entity_id, and action cannot be empty',
    };
  }

  // Valid key
  return {
    isValid: true,
    sourceSystem,
    entity,
    entityId,
    action,
    version,
    errorMessage: null,
  };
}

/**
 * Generate idempotency key per contract format
 * Format: <source_system>:<entity>:<entity_id>:<action>:v1
 * NO TIMESTAMPS - keys must be stable for deduplication
 */
export function generateIdempotencyKey(
  sourceSystem: SourceSystem,
  entity: string,
  entityId: string,
  action: string
): string {
  if (!entity || !entityId || !action) {
    throw new Error('Entity, entity_id, and action are required');
  }
  return `${sourceSystem}:${entity}:${entityId}:${action}:v1`;
}

/**
 * Generate stock item idempotency key with pipe-separated quality|color
 * Per contract Section 5.4
 */
export function generateStockIdempotencyKey(
  qualityCode: string,
  colorCode: string,
  action: 'changed' | 'low_stock'
): string {
  return `wms:stock_item:${qualityCode}|${colorCode}:${action}:v1`;
}

// Violation types per contract
export const VIOLATION_TYPES = [
  'invalid_idempotency_key',
  'invalid_uom',
  'unknown_field',
  'missing_required_field',
  'schema_mismatch',
  'hmac_failure',
  'unknown_event_type',
  'payload_hash_drift',
  'sequence_out_of_order',
  'other',
] as const;

export type ViolationType = typeof VIOLATION_TYPES[number];

export interface ContractViolation {
  eventType: string;
  idempotencyKey?: string;
  sourceSystem: SourceSystem;
  violationType: ViolationType;
  violationMessage: string;
  fieldName?: string;
  fieldValue?: string;
  expectedValue?: string;
  payloadSnapshot?: Record<string, unknown>;
  inboxId?: string;
}
