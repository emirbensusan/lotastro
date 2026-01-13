-- ============================================================
-- CRM Integration Schema Changes per integration_contract_v1.md
-- ============================================================

-- B.1 Reservations Table Additions (Section 10.3)
-- Add release_reason for tracking why reservation was released
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS release_reason TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS crm_deal_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS crm_customer_id TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS crm_organization_id TEXT;

-- Add constraint for release_reason values (canonical spelling: cancelled not canceled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'chk_release_reason'
  ) THEN
    ALTER TABLE reservations ADD CONSTRAINT chk_release_reason 
      CHECK (release_reason IS NULL OR release_reason IN ('expired', 'cancelled', 'converted'));
  END IF;
END $$;

-- B.2 Orders Table Additions (Section 10.4)
-- status per Section 3.2 Order Status Dictionary
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed';
-- fulfillment_blocker_status per Section 3.4
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_blocker_status TEXT DEFAULT 'none';
-- fulfillment_outcome per Section 3.5
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_outcome TEXT;
-- action_required flag for CRM notifications
ALTER TABLE orders ADD COLUMN IF NOT EXISTS action_required BOOLEAN DEFAULT false;
-- CRM reference columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_customer_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS crm_deal_id UUID;

-- Add constraints for orders.status (Section 3.2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'chk_order_status'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_order_status
      CHECK (status IN ('draft', 'confirmed', 'reserved', 'picking', 'shipped', 'delivered', 'invoiced', 'fulfilled', 'cancelled'));
  END IF;
END $$;

-- Add constraint for fulfillment_blocker_status (Section 3.4)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'chk_fulfillment_blocker_status'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_fulfillment_blocker_status
      CHECK (fulfillment_blocker_status IN ('none', 'backordered', 'awaiting_incoming', 'needs_central_check', 'production_required', 'rejected'));
  END IF;
END $$;

-- Add constraint for fulfillment_outcome (Section 3.5)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE constraint_name = 'chk_fulfillment_outcome'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_fulfillment_outcome
      CHECK (fulfillment_outcome IS NULL OR fulfillment_outcome IN ('complete', 'partial_closed', 'cancelled'));
  END IF;
END $$;

-- B.3 Add timestamp columns for lifecycle tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- B.4 Integration Outbox Table (for reliable event delivery)
CREATE TABLE IF NOT EXISTS integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_system TEXT NOT NULL DEFAULT 'crm',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_outbox_status CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON integration_outbox(status, next_retry_at) 
  WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_outbox_created ON integration_outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_idempotency ON integration_outbox(idempotency_key);

-- B.5 CRM Customer Cache Table
CREATE TABLE IF NOT EXISTS crm_customer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id UUID NOT NULL,
  crm_organization_id TEXT,
  company_name TEXT NOT NULL,
  unique_code TEXT,
  email TEXT,
  phone TEXT,
  contacts JSONB DEFAULT '[]'::jsonb,
  payment_terms JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  stale_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '24 hours'),
  
  CONSTRAINT unique_crm_customer UNIQUE (crm_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_cache_customer ON crm_customer_cache(crm_customer_id);
CREATE INDEX IF NOT EXISTS idx_cache_code ON crm_customer_cache(unique_code);
CREATE INDEX IF NOT EXISTS idx_cache_stale ON crm_customer_cache(stale_at);

-- B.6 Integration Feature Flags Table
CREATE TABLE IF NOT EXISTS integration_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT UNIQUE NOT NULL,
  flag_value BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Insert default flags
INSERT INTO integration_feature_flags (flag_key, flag_value, description) VALUES
  ('integration_enabled', false, 'Master switch for CRM integration'),
  ('crm_customer_sync', false, 'Enable customer data sync from CRM'),
  ('crm_reservation_events', false, 'Send reservation events to CRM'),
  ('crm_order_events', false, 'Send order events to CRM'),
  ('crm_shipment_events', false, 'Send shipment events to CRM'),
  ('crm_inventory_events', false, 'Send inventory events to CRM'),
  ('crm_masked_stock', true, 'Return masked stock levels to CRM API')
ON CONFLICT (flag_key) DO NOTHING;

-- B.7 Enable RLS on new tables
ALTER TABLE integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_customer_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin and service role access)
CREATE POLICY "integration_outbox_admin_all" ON integration_outbox
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "crm_customer_cache_admin_all" ON crm_customer_cache
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "integration_feature_flags_admin_all" ON integration_feature_flags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Allow read access for all authenticated users on feature flags
CREATE POLICY "integration_feature_flags_read" ON integration_feature_flags
  FOR SELECT USING (auth.uid() IS NOT NULL);