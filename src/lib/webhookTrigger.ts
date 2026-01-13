/**
 * Webhook Event Dispatcher
 * 
 * Utility for dispatching webhook events from the frontend.
 * Events are sent to the webhook-dispatcher edge function which
 * handles delivery to all registered subscriptions.
 * 
 * Event names per integration_contract_v1.md Section 2.2
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  normalizeReleaseReason, 
  normalizeOrderStatus,
  generateIdempotencyKey,
  generateStockIdempotencyKey 
} from './crmNormalization';

// Event types per contract Section 2.2
export type WebhookEventType = 
  // WMS → CRM Events (Section 2.2)
  | 'inquiry.created'
  | 'inquiry.converted'
  | 'reservation.created'
  | 'reservation.released'
  | 'reservation.converted'
  | 'order.created'
  | 'order.picking_started'
  | 'order.prepared'
  | 'order.fulfilled'
  | 'order.invoiced'
  | 'order.cancelled'
  | 'shipment.posted'
  | 'shipment.delivered'
  | 'stock.changed'
  | 'inventory.low_stock'
  // Legacy events (still supported)
  | 'lot.received'
  | 'inventory.updated'
  | 'catalog.updated';

export interface WebhookEventData {
  id?: string;
  idempotency_key?: string;
  [key: string]: unknown;
}

export interface WebhookDispatchResult {
  success: boolean;
  event: string;
  subscriptions_found: number;
  delivered: number;
  failed: number;
  error?: string;
}

/**
 * Dispatch a webhook event to all registered subscriptions.
 * This is fire-and-forget - errors are logged but don't throw.
 * 
 * @param event The event type (e.g., 'order.created')
 * @param data The event payload data
 */
export async function dispatchWebhookEvent(
  event: WebhookEventType,
  data: WebhookEventData
): Promise<WebhookDispatchResult | null> {
  try {
    console.log(`[webhookTrigger] Dispatching event: ${event}`, data);
    
    const { data: result, error } = await supabase.functions.invoke('webhook-dispatcher', {
      body: { event, data },
    });

    if (error) {
      console.error(`[webhookTrigger] Error dispatching ${event}:`, error);
      return {
        success: false,
        event,
        subscriptions_found: 0,
        delivered: 0,
        failed: 0,
        error: error.message,
      };
    }

    console.log(`[webhookTrigger] Event ${event} dispatched:`, result);
    return result as WebhookDispatchResult;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[webhookTrigger] Failed to dispatch ${event}:`, err);
    return {
      success: false,
      event,
      subscriptions_found: 0,
      delivered: 0,
      failed: 0,
      error: errorMessage,
    };
  }
}

// ============================================================
// Helper functions for WMS → CRM Events
// ============================================================

/**
 * Helper to dispatch order.created event
 */
export function dispatchOrderCreated(order: {
  id: string;
  order_number: string;
  customer_name: string;
  crm_customer_id?: string;
  crm_deal_id?: string;
  lots_count: number;
  total_meters: number;
  created_by?: string;
}) {
  return dispatchWebhookEvent('order.created', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.id, 'created'),
  });
}

/**
 * Helper to dispatch order.fulfilled event
 */
export function dispatchOrderFulfilled(order: {
  id: string;
  order_number: string;
  customer_name: string;
  crm_deal_id?: string;
  fulfilled_by?: string;
  fulfilled_at: string;
  fulfilled_lines?: Array<{
    quality_code: string;
    color_code: string;
    fulfilled_meters: number;
    lot_numbers: string[];
  }>;
}) {
  return dispatchWebhookEvent('order.fulfilled', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.id, 'fulfilled'),
  });
}

/**
 * Helper to dispatch order.picking_started event
 * Per contract Section 4.1
 */
export function dispatchOrderPickingStarted(order: {
  wms_order_id: string;
  crm_deal_id?: string;
  order_number: string;
  picked_by?: string;
  picked_at: string;
}) {
  return dispatchWebhookEvent('order.picking_started', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.wms_order_id, 'picking_started'),
  });
}

/**
 * Helper to dispatch order.prepared event
 * Per contract Section 4.1
 */
export function dispatchOrderPrepared(order: {
  wms_order_id: string;
  crm_deal_id?: string;
  order_number: string;
  prepared_at: string;
  prepared_lines: Array<{
    quality_code: string;
    color_code: string;
    prepared_meters: number;
    lot_numbers: string[];
  }>;
}) {
  return dispatchWebhookEvent('order.prepared', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.wms_order_id, 'prepared'),
  });
}

/**
 * Helper to dispatch order.invoiced event
 * Per contract Section 4.1
 */
export function dispatchOrderInvoiced(order: {
  wms_order_id: string;
  crm_deal_id?: string;
  order_number: string;
  invoice_number: string;
  invoiced_at: string;
}) {
  return dispatchWebhookEvent('order.invoiced', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.wms_order_id, 'invoiced'),
  });
}

/**
 * Helper to dispatch order.cancelled event
 */
export function dispatchOrderCancelled(order: {
  id: string;
  order_number: string;
  customer_name: string;
  cancelled_at: string;
  cancelled_by?: string;
  reason?: string;
}) {
  return dispatchWebhookEvent('order.cancelled', {
    ...order,
    idempotency_key: generateIdempotencyKey('wms', 'order', order.id, 'cancelled'),
  });
}

/**
 * Helper to dispatch lot.received event
 */
export function dispatchLotReceived(lot: {
  id: string;
  lot_number: string;
  quality: string;
  color: string;
  meters: number;
  roll_count: number;
  supplier_name?: string;
}) {
  return dispatchWebhookEvent('lot.received', {
    ...lot,
    idempotency_key: generateIdempotencyKey('wms', 'lot', lot.id, 'received'),
  });
}

/**
 * Helper to dispatch inventory.updated event (legacy)
 */
export function dispatchInventoryUpdated(update: {
  quality: string;
  color: string;
  previous_meters: number;
  new_meters: number;
  change_type: 'adjustment' | 'receive' | 'fulfill' | 'transfer';
}) {
  return dispatchWebhookEvent('inventory.updated', {
    ...update,
    idempotency_key: generateStockIdempotencyKey(update.quality, update.color, 'changed'),
  });
}

/**
 * Helper to dispatch stock.changed event
 * Per contract Section 5.4 - uses pipe-separated quality|color in idempotency key
 */
export function dispatchStockChanged(stock: {
  quality_code: string;
  color_code: string;
  previous_meters: number;
  new_meters: number;
  change_type: 'adjustment' | 'receive' | 'fulfill' | 'transfer';
}) {
  return dispatchWebhookEvent('stock.changed', {
    ...stock,
    idempotency_key: generateStockIdempotencyKey(stock.quality_code, stock.color_code, 'changed'),
  });
}

/**
 * Helper to dispatch inventory.low_stock event
 */
export function dispatchLowStockAlert(alert: {
  quality: string;
  color: string;
  current_stock: number;
  threshold: number;
  severity: 'low' | 'critical';
}) {
  return dispatchWebhookEvent('inventory.low_stock', {
    ...alert,
    quality_code: alert.quality,
    color_code: alert.color,
    unit: 'meters',
    idempotency_key: generateStockIdempotencyKey(alert.quality, alert.color, 'low_stock'),
  });
}

/**
 * Helper to dispatch catalog.updated event
 */
export function dispatchCatalogUpdated(item: {
  id: string;
  lastro_sku_code: string;
  code: string;
  change_type: 'created' | 'updated' | 'deleted';
}) {
  return dispatchWebhookEvent('catalog.updated', {
    ...item,
    idempotency_key: generateIdempotencyKey('wms', 'catalog', item.id, 'updated'),
  });
}

/**
 * Helper to dispatch reservation.created event
 */
export function dispatchReservationCreated(reservation: {
  id: string;
  reservation_number: string;
  customer_name: string;
  crm_customer_id?: string;
  crm_deal_id?: string;
  crm_organization_id?: string;
  total_reserved_meters: number;
  lines_count: number;
  hold_until?: string | null;
  created_by?: string;
  lines?: Array<{
    quality_code: string;
    color_code: string;
    reserved_meters: number;
    lot_numbers?: string[];
  }>;
}) {
  return dispatchWebhookEvent('reservation.created', {
    wms_reservation_id: reservation.id,
    ...reservation,
    status: 'active',
    idempotency_key: generateIdempotencyKey('wms', 'reservation', reservation.id, 'created'),
  });
}

/**
 * Helper to dispatch reservation.released event
 * MUST include release_reason per contract Section 4.1
 */
export function dispatchReservationReleased(reservation: {
  wms_reservation_id: string;
  crm_deal_id?: string;
  release_reason: 'expired' | 'canceled' | 'cancelled' | 'converted';
  released_meters: number;
}) {
  // Normalize internal 'canceled' to canonical 'cancelled'
  const normalizedReason = normalizeReleaseReason(reservation.release_reason);
  
  return dispatchWebhookEvent('reservation.released', {
    ...reservation,
    release_reason: normalizedReason,
    idempotency_key: generateIdempotencyKey('wms', 'reservation', reservation.wms_reservation_id, 'released'),
  });
}

/**
 * Helper to dispatch reservation.converted event
 * Sent when reservation is converted to an order
 */
export function dispatchReservationConverted(reservation: {
  wms_reservation_id: string;
  crm_deal_id?: string;
  wms_order_id: string;
  order_number: string;
  converted_at: string;
  converted_by?: string;
}) {
  return dispatchWebhookEvent('reservation.converted', {
    ...reservation,
    idempotency_key: generateIdempotencyKey('wms', 'reservation', reservation.wms_reservation_id, 'converted'),
  });
}

/**
 * Helper to dispatch shipment.posted event
 */
export function dispatchShipmentPosted(shipment: {
  wms_shipment_id: string;
  crm_deal_id?: string;
  order_number: string;
  tracking_number?: string;
  carrier?: string;
  shipped_at: string;
}) {
  return dispatchWebhookEvent('shipment.posted', {
    ...shipment,
    idempotency_key: generateIdempotencyKey('wms', 'shipment', shipment.wms_shipment_id, 'posted'),
  });
}

/**
 * Helper to dispatch shipment.delivered event
 */
export function dispatchShipmentDelivered(shipment: {
  wms_shipment_id: string;
  crm_deal_id?: string;
  order_number: string;
  delivered_at: string;
}) {
  return dispatchWebhookEvent('shipment.delivered', {
    ...shipment,
    idempotency_key: generateIdempotencyKey('wms', 'shipment', shipment.wms_shipment_id, 'delivered'),
  });
}

/**
 * Helper to dispatch inquiry.created event
 */
export function dispatchInquiryCreated(inquiry: {
  wms_inquiry_id: string;
  crm_customer_id?: string;
  inquiry_number: string;
  items: Array<{
    quality_code: string;
    color_code: string;
    requested_meters: number;
  }>;
}) {
  return dispatchWebhookEvent('inquiry.created', {
    ...inquiry,
    idempotency_key: generateIdempotencyKey('wms', 'inquiry', inquiry.wms_inquiry_id, 'created'),
  });
}

/**
 * Helper to dispatch inquiry.converted event
 */
export function dispatchInquiryConverted(inquiry: {
  wms_inquiry_id: string;
  crm_customer_id?: string;
  wms_reservation_id: string;
  converted_at: string;
}) {
  return dispatchWebhookEvent('inquiry.converted', {
    ...inquiry,
    idempotency_key: generateIdempotencyKey('wms', 'inquiry', inquiry.wms_inquiry_id, 'converted'),
  });
}
