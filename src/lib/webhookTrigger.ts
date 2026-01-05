/**
 * Webhook Event Dispatcher
 * 
 * Utility for dispatching webhook events from the frontend.
 * Events are sent to the webhook-dispatcher edge function which
 * handles delivery to all registered subscriptions.
 */

import { supabase } from '@/integrations/supabase/client';

export type WebhookEventType = 
  | 'order.created'
  | 'order.fulfilled'
  | 'order.cancelled'
  | 'lot.received'
  | 'inventory.updated'
  | 'inventory.low_stock'
  | 'catalog.updated'
  | 'reservation.created'
  | 'reservation.fulfilled'
  | 'reservation.cancelled';

export interface WebhookEventData {
  id?: string;
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

/**
 * Helper to dispatch order.created event
 */
export function dispatchOrderCreated(order: {
  id: string;
  order_number: string;
  customer_name: string;
  lots_count: number;
  total_meters: number;
  created_by?: string;
}) {
  return dispatchWebhookEvent('order.created', order);
}

/**
 * Helper to dispatch order.fulfilled event
 */
export function dispatchOrderFulfilled(order: {
  id: string;
  order_number: string;
  customer_name: string;
  fulfilled_by?: string;
  fulfilled_at: string;
}) {
  return dispatchWebhookEvent('order.fulfilled', order);
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
  return dispatchWebhookEvent('lot.received', lot);
}

/**
 * Helper to dispatch inventory.updated event
 */
export function dispatchInventoryUpdated(update: {
  quality: string;
  color: string;
  previous_meters: number;
  new_meters: number;
  change_type: 'adjustment' | 'receive' | 'fulfill' | 'transfer';
}) {
  return dispatchWebhookEvent('inventory.updated', update);
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
  return dispatchWebhookEvent('inventory.low_stock', alert);
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
  return dispatchWebhookEvent('catalog.updated', item);
}

/**
 * Helper to dispatch reservation.created event
 */
export function dispatchReservationCreated(reservation: {
  id: string;
  reservation_number: string;
  customer_name: string;
  total_reserved_meters: number;
  lines_count: number;
  hold_until?: string | null;
  created_by?: string;
}) {
  return dispatchWebhookEvent('reservation.created', reservation);
}

/**
 * Helper to dispatch reservation.fulfilled event
 */
export function dispatchReservationFulfilled(reservation: {
  id: string;
  reservation_number: string;
  customer_name: string;
  fulfilled_at: string;
  fulfilled_by?: string;
}) {
  return dispatchWebhookEvent('reservation.fulfilled', reservation);
}

/**
 * Helper to dispatch reservation.cancelled event
 */
export function dispatchReservationCancelled(reservation: {
  id: string;
  reservation_number: string;
  customer_name: string;
  cancelled_at: string;
  cancelled_by?: string;
  reason?: string;
}) {
  return dispatchWebhookEvent('reservation.cancelled', reservation);
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
  return dispatchWebhookEvent('order.cancelled', order);
}
