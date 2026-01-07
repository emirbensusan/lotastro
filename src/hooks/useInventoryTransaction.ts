import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallback } from 'react';
import type { Database } from '@/integrations/supabase/types';

type TransactionType = Database['public']['Enums']['inventory_transaction_type'];

export interface LogTransactionParams {
  rollId?: string | null;
  transactionType: TransactionType;
  quantityChange: number;
  unit?: string;
  sourceType: string;
  sourceId?: string | null;
  sourceIdentifier?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}

export interface LogBatchTransactionParams {
  transactions: LogTransactionParams[];
}

/**
 * Hook to log inventory transactions to the ledger.
 * Use this whenever inventory quantities change (stock-take adjustments, order fulfillment, etc.)
 */
export const useInventoryTransaction = () => {
  const { user } = useAuth();

  /**
   * Log a single inventory transaction
   */
  const logTransaction = useCallback(async (params: LogTransactionParams) => {
    const { error } = await supabase
      .from('inventory_transactions')
      .insert({
        created_by: user?.id || null,
        roll_id: params.rollId || null,
        transaction_type: params.transactionType,
        quantity_change: params.quantityChange,
        unit: params.unit || 'meters',
        source_type: params.sourceType,
        source_id: params.sourceId || null,
        source_identifier: params.sourceIdentifier || null,
        notes: params.notes || null,
        metadata: params.metadata || null,
      });

    if (error) {
      console.error('[useInventoryTransaction] Failed to log transaction:', error);
      throw error;
    }
  }, [user?.id]);

  /**
   * Log multiple inventory transactions in a batch
   */
  const logBatchTransactions = useCallback(async (params: LogBatchTransactionParams) => {
    const records = params.transactions.map(tx => ({
      created_by: user?.id || null,
      roll_id: tx.rollId || null,
      transaction_type: tx.transactionType,
      quantity_change: tx.quantityChange,
      unit: tx.unit || 'meters',
      source_type: tx.sourceType,
      source_id: tx.sourceId || null,
      source_identifier: tx.sourceIdentifier || null,
      notes: tx.notes || null,
      metadata: tx.metadata || null,
    }));

    const { error } = await supabase
      .from('inventory_transactions')
      .insert(records);

    if (error) {
      console.error('[useInventoryTransaction] Failed to log batch transactions:', error);
      throw error;
    }

    return { count: records.length };
  }, [user?.id]);

  /**
   * Log stock adjustment from a count session reconciliation
   * Compares expected vs counted and logs the delta
   */
  const logStockAdjustment = useCallback(async ({
    sessionId,
    sessionNumber,
    adjustments,
  }: {
    sessionId: string;
    sessionNumber: string;
    adjustments: Array<{
      rollId?: string;
      quality: string;
      color: string;
      lotNumber: string;
      expectedMeters: number;
      countedMeters: number;
      adminMeters?: number | null;
    }>;
  }) => {
    const transactions: LogTransactionParams[] = [];

    for (const adj of adjustments) {
      // Use admin-approved meters if available, otherwise counter meters
      const finalMeters = adj.adminMeters ?? adj.countedMeters;
      const delta = finalMeters - adj.expectedMeters;

      // Only log if there's a difference
      if (delta !== 0) {
        transactions.push({
          rollId: adj.rollId || null,
          transactionType: 'STOCK_ADJUSTMENT',
          quantityChange: delta,
          unit: 'meters',
          sourceType: 'count_session',
          sourceId: sessionId,
          sourceIdentifier: sessionNumber,
          notes: `Stock count adjustment: ${adj.quality} / ${adj.color} / Lot ${adj.lotNumber}`,
          metadata: {
            quality: adj.quality,
            color: adj.color,
            lot_number: adj.lotNumber,
            expected_meters: adj.expectedMeters,
            counted_meters: adj.countedMeters,
            admin_meters: adj.adminMeters,
            final_meters: finalMeters,
            delta: delta,
          },
        });
      }
    }

    if (transactions.length > 0) {
      await logBatchTransactions({ transactions });
    }

    return { adjustmentsLogged: transactions.length };
  }, [logBatchTransactions]);

  /**
   * Log transactions for a fully reconciled count session
   * This creates a summary record for audit purposes
   */
  const logSessionReconciliation = useCallback(async ({
    sessionId,
    sessionNumber,
    rollsApproved,
    totalMetersAdjusted,
  }: {
    sessionId: string;
    sessionNumber: string;
    rollsApproved: number;
    totalMetersAdjusted: number;
  }) => {
    // Log a summary transaction for the entire session
    await logTransaction({
      transactionType: 'STOCK_ADJUSTMENT',
      quantityChange: totalMetersAdjusted,
      unit: 'meters',
      sourceType: 'count_session',
      sourceId: sessionId,
      sourceIdentifier: sessionNumber,
      notes: `Session reconciliation complete: ${rollsApproved} rolls approved`,
      metadata: {
        session_id: sessionId,
        session_number: sessionNumber,
        rolls_approved: rollsApproved,
        reconciliation_type: 'session_complete',
      },
    });
  }, [logTransaction]);

  /**
   * Log order fulfillment transactions (ORDER_FULFILLMENT type)
   * Creates individual transactions for each fulfilled roll
   */
  const logOrderFulfillment = useCallback(async ({
    orderId,
    orderNumber,
    customerName,
    fulfillments,
  }: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    fulfillments: Array<{
      rollId: string;
      meters: number;
      lotNumber: string;
      quality: string;
      color: string;
    }>;
  }) => {
    const transactions: LogTransactionParams[] = fulfillments.map(item => ({
      rollId: item.rollId,
      transactionType: 'ORDER_FULFILLMENT' as TransactionType,
      quantityChange: -item.meters, // Negative because stock is leaving
      unit: 'meters',
      sourceType: 'order',
      sourceId: orderId,
      sourceIdentifier: orderNumber,
      notes: `Order fulfilled for ${customerName}: ${item.quality} / ${item.color} / Lot ${item.lotNumber}`,
      metadata: {
        order_id: orderId,
        order_number: orderNumber,
        customer_name: customerName,
        quality: item.quality,
        color: item.color,
        lot_number: item.lotNumber,
        meters: item.meters,
      },
    }));

    if (transactions.length > 0) {
      await logBatchTransactions({ transactions });
    }

    return { fulfillmentsLogged: transactions.length };
  }, [logBatchTransactions]);

  /**
   * Log incoming stock receipt (INCOMING_RECEIPT type)
   * Creates transactions for received rolls
   */
  const logIncomingReceipt = useCallback(async ({
    lotId,
    lotNumber,
    quality,
    color,
    rolls,
    supplierId,
    supplierName,
  }: {
    lotId: string;
    lotNumber: string;
    quality: string;
    color: string;
    rolls: Array<{ rollId: string; meters: number }>;
    supplierId?: string;
    supplierName?: string;
  }) => {
    const transactions: LogTransactionParams[] = rolls.map(roll => ({
      rollId: roll.rollId,
      transactionType: 'INCOMING_RECEIPT' as TransactionType,
      quantityChange: roll.meters, // Positive because stock is entering
      unit: 'meters',
      sourceType: 'lot',
      sourceId: lotId,
      sourceIdentifier: lotNumber,
      notes: `Stock received: ${quality} / ${color} / Lot ${lotNumber}`,
      metadata: {
        lot_id: lotId,
        lot_number: lotNumber,
        quality,
        color,
        supplier_id: supplierId,
        supplier_name: supplierName,
        meters: roll.meters,
      },
    }));

    if (transactions.length > 0) {
      await logBatchTransactions({ transactions });
    }

    return { receiptsLogged: transactions.length };
  }, [logBatchTransactions]);

  return {
    logTransaction,
    logBatchTransactions,
    logStockAdjustment,
    logSessionReconciliation,
    logOrderFulfillment,
    logIncomingReceipt,
  };
};
