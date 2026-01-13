/**
 * CRM Normalization Utilities
 * 
 * Handles spelling normalization between WMS internal values
 * and canonical contract format per integration_contract_v1.md Section 13.1
 * 
 * Key rule: Canonical spelling is British English "cancelled" (not "canceled")
 */

/**
 * Normalize internal DB values to canonical contract spelling
 * Converts American spelling to British where required by contract
 */
export function normalizeToCanonical(value: string): string {
  const mappings: Record<string, string> = {
    'canceled': 'cancelled',  // American → British (canonical per contract)
  };
  return mappings[value] || value;
}

/**
 * Normalize release_reason for outbound payloads
 * Ensures only valid canonical values are sent
 */
export function normalizeReleaseReason(
  reason: 'expired' | 'canceled' | 'cancelled' | 'converted' | string
): 'expired' | 'cancelled' | 'converted' {
  if (reason === 'canceled') return 'cancelled';
  if (reason === 'expired' || reason === 'cancelled' || reason === 'converted') {
    return reason;
  }
  // Fallback for unexpected values - log warning and return as cancelled
  console.warn(`[crmNormalization] Unexpected release_reason: ${reason}, defaulting to 'cancelled'`);
  return 'cancelled';
}

/**
 * Normalize order status for outbound payloads
 * Ensures only valid canonical values are sent
 */
export function normalizeOrderStatus(
  status: string
): 'draft' | 'confirmed' | 'reserved' | 'picking' | 'shipped' | 'delivered' | 'invoiced' | 'fulfilled' | 'cancelled' {
  const normalized = normalizeToCanonical(status);
  const validStatuses = ['draft', 'confirmed', 'reserved', 'picking', 'shipped', 'delivered', 'invoiced', 'fulfilled', 'cancelled'];
  
  if (validStatuses.includes(normalized)) {
    return normalized as ReturnType<typeof normalizeOrderStatus>;
  }
  
  console.warn(`[crmNormalization] Unexpected order status: ${status}, defaulting to 'confirmed'`);
  return 'confirmed';
}

/**
 * Normalize fulfillment blocker status for outbound payloads
 */
export function normalizeFulfillmentBlockerStatus(
  status: string
): 'none' | 'backordered' | 'awaiting_incoming' | 'needs_central_check' | 'production_required' | 'rejected' {
  const validStatuses = ['none', 'backordered', 'awaiting_incoming', 'needs_central_check', 'production_required', 'rejected'];
  
  if (validStatuses.includes(status)) {
    return status as ReturnType<typeof normalizeFulfillmentBlockerStatus>;
  }
  
  console.warn(`[crmNormalization] Unexpected blocker status: ${status}, defaulting to 'none'`);
  return 'none';
}

/**
 * Normalize fulfillment outcome for outbound payloads
 */
export function normalizeFulfillmentOutcome(
  outcome: string | null | undefined
): 'complete' | 'partial_closed' | 'cancelled' | null {
  if (!outcome) return null;
  
  const normalized = normalizeToCanonical(outcome);
  const validOutcomes = ['complete', 'partial_closed', 'cancelled'];
  
  if (validOutcomes.includes(normalized)) {
    return normalized as 'complete' | 'partial_closed' | 'cancelled';
  }
  
  console.warn(`[crmNormalization] Unexpected fulfillment outcome: ${outcome}`);
  return null;
}

/**
 * Generate idempotency key per contract format
 * Format: <source_system>:<entity>:<entity_id>:<action>:v1
 * NO TIMESTAMPS - keys must be stable for deduplication
 */
export function generateIdempotencyKey(
  sourceSystem: 'wms' | 'crm',
  entity: string,
  entityId: string,
  action: string
): string {
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
