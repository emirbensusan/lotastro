-- Add indexes for audit logs and goods_in_rows performance improvements
-- These indexes speed up audit lookups and reversal operations

-- Index for audit log entity lookups (used frequently in reverse operations)
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_lookup 
ON public.audit_logs(entity_type, entity_id, action, created_at DESC);

-- Index for finding reversed audit entries
CREATE INDEX IF NOT EXISTS idx_audit_logs_reversal 
ON public.audit_logs(is_reversed, entity_type) 
WHERE is_reversed = true;

-- Index for goods_in_rows lookups by lot_id (used in reversal)
CREATE INDEX IF NOT EXISTS idx_goods_in_rows_lot_id 
ON public.goods_in_rows(lot_id);

-- Index for goods_in_rows lookups by receipt (used in mismatch detection)
CREATE INDEX IF NOT EXISTS idx_goods_in_rows_receipt 
ON public.goods_in_rows(receipt_id);

-- Index for finding lots by incoming stock via goods_in_rows
CREATE INDEX IF NOT EXISTS idx_goods_in_receipts_incoming_stock 
ON public.goods_in_receipts(incoming_stock_id);

-- Add comment explaining the purpose
COMMENT ON INDEX idx_audit_logs_entity_lookup IS 'Speeds up audit log lookups by entity for reversal operations';
COMMENT ON INDEX idx_audit_logs_reversal IS 'Speeds up finding reversed audit entries for consistency checks';
COMMENT ON INDEX idx_goods_in_rows_lot_id IS 'Speeds up reversal operations that delete goods_in_rows by lot_id';
COMMENT ON INDEX idx_goods_in_rows_receipt IS 'Speeds up mismatch detection by receipt_id';
COMMENT ON INDEX idx_goods_in_receipts_incoming_stock IS 'Speeds up lot lookups by incoming_stock_id';