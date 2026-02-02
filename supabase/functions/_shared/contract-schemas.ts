/**
 * Contract Schema Definitions for WMS-CRM Integration
 * Version: 1.0.23
 * 
 * This file defines all event schemas, validation functions, and contract constants
 * for the WMS webhook receiver and event dispatcher edge functions.
 * 
 * IMPORTANT: All idempotency keys use COLON (:) as delimiter
 * Format: <source_system>:<entity>:<entity_id>:<action>:v1
 * Example: wms:order:123:created:v1
 */

// ============================================
// Contract Constants
// ============================================

/**
 * Contract-allowed UOM values (Section 4.2)
 * MT = Meters, KG = Kilograms
 */
export const CONTRACT_UOM_VALUES = ['MT', 'KG'] as const;
export type ContractUOM = typeof CONTRACT_UOM_VALUES[number];

/**
 * Valid source systems for idempotency keys
 */
export const SOURCE_SYSTEMS = ['wms', 'crm'] as const;
export type SourceSystem = typeof SOURCE_SYSTEMS[number];

/**
 * Idempotency key delimiter - COLON, not slash or dot
 */
export const IDEMPOTENCY_DELIMITER = ':';

/**
 * Idempotency key version
 */
export const IDEMPOTENCY_VERSION = 'v1';

/**
 * Contract violation types
 */
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

// ============================================
// Idempotency Key Validation
// ============================================

export interface IdempotencyKeyValidation {
  isValid: boolean;
  sourceSystem: string | null;
  entity: string | null;
  entityId: string | null;
  action: string | null;
  version: string | null;
  errorMessage: string | null;
}

/**
 * Validates idempotency key format per contract specification
 * Format: <source_system>:<entity>:<entity_id>:<action>:v1
 * 
 * DELIMITER: COLON (:)
 * 
 * @example
 * validateIdempotencyKey('wms:order:123:created:v1') // isValid: true
 * validateIdempotencyKey('wms:order:123:created')    // isValid: false (4 segments)
 * validateIdempotencyKey('erp:order:123:created:v1') // isValid: false (bad source)
 */
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

  // Split by COLON delimiter
  const parts = key.split(IDEMPOTENCY_DELIMITER);

  // Must have exactly 5 segments
  if (parts.length !== 5) {
    return {
      isValid: false,
      sourceSystem: null,
      entity: null,
      entityId: null,
      action: null,
      version: null,
      errorMessage: `Expected 5 segments (delimiter: colon), got ${parts.length}`,
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
      errorMessage: `Invalid source_system: ${sourceSystem} (must be 'wms' or 'crm')`,
    };
  }

  // Validate version
  if (version !== IDEMPOTENCY_VERSION) {
    return {
      isValid: false,
      sourceSystem,
      entity,
      entityId,
      action,
      version,
      errorMessage: `Invalid version: ${version} (must be '${IDEMPOTENCY_VERSION}')`,
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
 * 
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
  return `${sourceSystem}${IDEMPOTENCY_DELIMITER}${entity}${IDEMPOTENCY_DELIMITER}${entityId}${IDEMPOTENCY_DELIMITER}${action}${IDEMPOTENCY_DELIMITER}${IDEMPOTENCY_VERSION}`;
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
  return `wms${IDEMPOTENCY_DELIMITER}stock_item${IDEMPOTENCY_DELIMITER}${qualityCode}|${colorCode}${IDEMPOTENCY_DELIMITER}${action}${IDEMPOTENCY_DELIMITER}${IDEMPOTENCY_VERSION}`;
}

// ============================================
// UOM Validation
// ============================================

/**
 * Validates UOM against contract-allowed values
 * Contract only allows MT (meters) and KG (kilograms)
 */
export function validateContractUom(uom: string | null | undefined): boolean {
  if (!uom) return false;
  return CONTRACT_UOM_VALUES.includes(uom.toUpperCase() as ContractUOM);
}

// ============================================
// CRM → WMS Event Schemas (11 Events)
// ============================================

/**
 * All CRM → WMS event types per contract
 */
export const CRM_TO_WMS_EVENT_TYPES = [
  'reservation.created',
  'reservation.updated',
  'reservation.cancelled',
  'supply_request.created',
  'supply_request.status_updated',
  'shipment.approved',
  'shipment.cancelled',
  'org_access.updated',
  'customer.updated',
  'deal.won',
  'deal.cancelled',
] as const;
export type CrmToWmsEventType = typeof CRM_TO_WMS_EVENT_TYPES[number];

/**
 * Base event envelope schema
 */
export interface EventEnvelope<T = unknown> {
  event_type: CrmToWmsEventType;
  idempotency_key: string;
  timestamp: string; // ISO 8601
  source_system: 'crm';
  payload: T;
}

/**
 * Event schema definitions with required/optional field metadata
 */
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date';
  required: boolean;
  allowedValues?: readonly string[];
  format?: 'uuid' | 'iso8601' | 'email' | 'uom';
}

export interface EventSchema {
  eventType: CrmToWmsEventType;
  fields: Record<string, FieldDefinition>;
}

// reservation.created / reservation.updated payload fields
const RESERVATION_FIELDS: Record<string, FieldDefinition> = {
  crm_reservation_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  crm_customer_id: { type: 'string', required: true, format: 'uuid' },
  customer_name: { type: 'string', required: true },
  reserved_date: { type: 'date', required: true, format: 'iso8601' },
  expires_at: { type: 'date', required: false, format: 'iso8601' },
  notes: { type: 'string', required: false },
  lines: { type: 'array', required: true },
};

// reservation line item fields
const RESERVATION_LINE_FIELDS: Record<string, FieldDefinition> = {
  crm_deal_line_id: { type: 'string', required: true, format: 'uuid' },
  quality_code: { type: 'string', required: true },
  color_code: { type: 'string', required: true },
  reserved_meters: { type: 'number', required: true },
  uom: { type: 'string', required: true, format: 'uom', allowedValues: CONTRACT_UOM_VALUES },
  scope: { type: 'string', required: true, allowedValues: ['INVENTORY', 'INCOMING'] },
  incoming_stock_id: { type: 'string', required: false, format: 'uuid' },
};

// supply_request.created / supply_request.status_updated fields
const SUPPLY_REQUEST_FIELDS: Record<string, FieldDefinition> = {
  crm_supply_request_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  quality_code: { type: 'string', required: true },
  color_code: { type: 'string', required: true },
  requested_meters: { type: 'number', required: true },
  uom: { type: 'string', required: true, format: 'uom', allowedValues: CONTRACT_UOM_VALUES },
  status: { type: 'string', required: true },
  eta_confirmed: { type: 'date', required: false, format: 'iso8601' },
  in_transit_at: { type: 'date', required: false, format: 'iso8601' },
  arrived_soft_at: { type: 'date', required: false, format: 'iso8601' },
};

// shipment.approved fields
const SHIPMENT_APPROVED_FIELDS: Record<string, FieldDefinition> = {
  crm_shipment_id: { type: 'string', required: true, format: 'uuid' },
  crm_reservation_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  approved_by_user_id: { type: 'string', required: true, format: 'uuid' },
  approved_at: { type: 'date', required: true, format: 'iso8601' },
  carrier_preference: { type: 'string', required: false },
  shipping_notes: { type: 'string', required: false },
};

// shipment.cancelled fields
const SHIPMENT_CANCELLED_FIELDS: Record<string, FieldDefinition> = {
  crm_shipment_id: { type: 'string', required: true, format: 'uuid' },
  crm_reservation_id: { type: 'string', required: true, format: 'uuid' },
  cancelled_by_user_id: { type: 'string', required: true, format: 'uuid' },
  cancelled_at: { type: 'date', required: true, format: 'iso8601' },
  cancellation_reason: { type: 'string', required: false },
};

// org_access.updated fields (snapshot replacement)
const ORG_ACCESS_UPDATED_FIELDS: Record<string, FieldDefinition> = {
  crm_user_id: { type: 'string', required: true, format: 'uuid' },
  email: { type: 'string', required: true, format: 'email' },
  sequence: { type: 'number', required: true },
  grants: { type: 'array', required: true }, // Array of { org_id, role_in_org }
};

// customer.updated fields
const CUSTOMER_UPDATED_FIELDS: Record<string, FieldDefinition> = {
  crm_customer_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  company_name: { type: 'string', required: true },
  unique_code: { type: 'string', required: false },
  email: { type: 'string', required: false, format: 'email' },
  phone: { type: 'string', required: false },
  contacts: { type: 'array', required: false },
  payment_terms: { type: 'object', required: false },
};

// deal.won fields
const DEAL_WON_FIELDS: Record<string, FieldDefinition> = {
  crm_deal_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  crm_customer_id: { type: 'string', required: true, format: 'uuid' },
  won_at: { type: 'date', required: true, format: 'iso8601' },
  lines: { type: 'array', required: true },
};

// deal.cancelled fields
const DEAL_CANCELLED_FIELDS: Record<string, FieldDefinition> = {
  crm_deal_id: { type: 'string', required: true, format: 'uuid' },
  crm_organization_id: { type: 'string', required: true, format: 'uuid' },
  cancelled_at: { type: 'date', required: true, format: 'iso8601' },
  cancellation_reason: { type: 'string', required: false },
};

/**
 * Complete event schema registry
 */
export const EVENT_SCHEMAS: Record<CrmToWmsEventType, EventSchema> = {
  'reservation.created': {
    eventType: 'reservation.created',
    fields: RESERVATION_FIELDS,
  },
  'reservation.updated': {
    eventType: 'reservation.updated',
    fields: RESERVATION_FIELDS,
  },
  'reservation.cancelled': {
    eventType: 'reservation.cancelled',
    fields: {
      crm_reservation_id: { type: 'string', required: true, format: 'uuid' },
      cancelled_at: { type: 'date', required: true, format: 'iso8601' },
      cancellation_reason: { type: 'string', required: false },
    },
  },
  'supply_request.created': {
    eventType: 'supply_request.created',
    fields: SUPPLY_REQUEST_FIELDS,
  },
  'supply_request.status_updated': {
    eventType: 'supply_request.status_updated',
    fields: SUPPLY_REQUEST_FIELDS,
  },
  'shipment.approved': {
    eventType: 'shipment.approved',
    fields: SHIPMENT_APPROVED_FIELDS,
  },
  'shipment.cancelled': {
    eventType: 'shipment.cancelled',
    fields: SHIPMENT_CANCELLED_FIELDS,
  },
  'org_access.updated': {
    eventType: 'org_access.updated',
    fields: ORG_ACCESS_UPDATED_FIELDS,
  },
  'customer.updated': {
    eventType: 'customer.updated',
    fields: CUSTOMER_UPDATED_FIELDS,
  },
  'deal.won': {
    eventType: 'deal.won',
    fields: DEAL_WON_FIELDS,
  },
  'deal.cancelled': {
    eventType: 'deal.cancelled',
    fields: DEAL_CANCELLED_FIELDS,
  },
};

/**
 * Reservation line schema for nested validation
 */
export const RESERVATION_LINE_SCHEMA = {
  fields: RESERVATION_LINE_FIELDS,
};

// ============================================
// WMS → CRM Event Types (Outbound)
// ============================================

export const WMS_TO_CRM_EVENT_TYPES = [
  'stock.changed',
  'stock.low_stock',
  'reservation.allocated',
  'reservation.allocation_planned',
  'order.created',
  'order.status_changed',
  'order.shipped',
  'shipment.override_requested',
] as const;
export type WmsToCrmEventType = typeof WMS_TO_CRM_EVENT_TYPES[number];

// ============================================
// Payload Schema Validation
// ============================================

export interface SchemaValidationResult {
  isValid: boolean;
  missingFields: string[];
  unknownFields: string[];
  invalidFields: Array<{ field: string; reason: string }>;
}

/**
 * Validates payload against event schema
 * @param eventType - The event type to validate against
 * @param payload - The payload object to validate
 * @returns Validation result with missing, unknown, and invalid fields
 */
export function validatePayloadSchema(
  eventType: CrmToWmsEventType,
  payload: Record<string, unknown>
): SchemaValidationResult {
  const schema = EVENT_SCHEMAS[eventType];
  
  if (!schema) {
    return {
      isValid: false,
      missingFields: [],
      unknownFields: [],
      invalidFields: [{ field: 'event_type', reason: `Unknown event type: ${eventType}` }],
    };
  }

  const missingFields: string[] = [];
  const unknownFields: string[] = [];
  const invalidFields: Array<{ field: string; reason: string }> = [];

  // Check for missing required fields
  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    if (fieldDef.required && (payload[fieldName] === undefined || payload[fieldName] === null)) {
      missingFields.push(fieldName);
    }
  }

  // Check for unknown fields
  for (const fieldName of Object.keys(payload)) {
    if (!schema.fields[fieldName]) {
      unknownFields.push(fieldName);
    }
  }

  // Validate field values
  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    const value = payload[fieldName];
    if (value === undefined || value === null) continue;

    // Validate UOM fields
    if (fieldDef.format === 'uom' && typeof value === 'string') {
      if (!validateContractUom(value)) {
        invalidFields.push({
          field: fieldName,
          reason: `Invalid UOM: ${value} (must be MT or KG)`,
        });
      }
    }

    // Validate allowed values
    if (fieldDef.allowedValues && typeof value === 'string') {
      if (!fieldDef.allowedValues.includes(value as any)) {
        invalidFields.push({
          field: fieldName,
          reason: `Invalid value: ${value} (allowed: ${fieldDef.allowedValues.join(', ')})`,
        });
      }
    }
  }

  return {
    isValid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    unknownFields,
    invalidFields,
  };
}

// ============================================
// Contract Violation Logging Helper
// ============================================

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

/**
 * Builds SQL params for logging contract violation via RPC
 * Use with supabase.rpc('log_contract_violation', buildViolationParams(violation))
 */
export function buildViolationLogParams(violation: ContractViolation): Record<string, unknown> {
  return {
    p_event_type: violation.eventType,
    p_idempotency_key: violation.idempotencyKey ?? null,
    p_source_system: violation.sourceSystem,
    p_violation_type: violation.violationType,
    p_violation_message: violation.violationMessage,
    p_field_name: violation.fieldName ?? null,
    p_field_value: violation.fieldValue ?? null,
    p_expected_value: violation.expectedValue ?? null,
    p_payload_snapshot: violation.payloadSnapshot ?? null,
    p_inbox_id: violation.inboxId ?? null,
  };
}

/**
 * Helper to create violation object for invalid idempotency key
 */
export function createIdempotencyViolation(
  eventType: string,
  key: string,
  validation: IdempotencyKeyValidation
): ContractViolation {
  return {
    eventType,
    idempotencyKey: key,
    sourceSystem: 'crm',
    violationType: 'invalid_idempotency_key',
    violationMessage: validation.errorMessage || 'Invalid idempotency key format',
    fieldName: 'idempotency_key',
    fieldValue: key,
    expectedValue: '<source>:<entity>:<id>:<action>:v1',
  };
}

/**
 * Helper to create violation object for invalid UOM
 */
export function createUomViolation(
  eventType: string,
  fieldName: string,
  value: string
): ContractViolation {
  return {
    eventType,
    sourceSystem: 'crm',
    violationType: 'invalid_uom',
    violationMessage: `UOM ${value} is not allowed by contract`,
    fieldName,
    fieldValue: value,
    expectedValue: 'MT or KG',
  };
}

/**
 * Helper to create violation object for unknown fields
 */
export function createUnknownFieldViolation(
  eventType: string,
  idempotencyKey: string,
  unknownFields: string[]
): ContractViolation {
  return {
    eventType,
    idempotencyKey,
    sourceSystem: 'crm',
    violationType: 'unknown_field',
    violationMessage: `Unknown fields detected: ${unknownFields.join(', ')}`,
    fieldName: unknownFields[0],
    expectedValue: 'Field not in contract schema',
  };
}

/**
 * Helper to create violation object for missing required fields
 */
export function createMissingFieldViolation(
  eventType: string,
  idempotencyKey: string,
  missingFields: string[]
): ContractViolation {
  return {
    eventType,
    idempotencyKey,
    sourceSystem: 'crm',
    violationType: 'missing_required_field',
    violationMessage: `Missing required fields: ${missingFields.join(', ')}`,
    fieldName: missingFields[0],
    expectedValue: 'Required field must be present',
  };
}
