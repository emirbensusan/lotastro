-- =============================================
-- CATALOG MODULE - PHASE 1: DATABASE SCHEMA
-- =============================================

-- 1. Extend audit_entity_type enum to include catalog_item
ALTER TYPE public.audit_entity_type ADD VALUE IF NOT EXISTS 'catalog_item';

-- 2. Create catalog_item_status enum
DO $$ BEGIN
  CREATE TYPE public.catalog_item_status AS ENUM (
    'pending_approval',
    'active', 
    'temporarily_unavailable',
    'blocked',
    'end_of_life'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create catalog_item_type enum
DO $$ BEGIN
  CREATE TYPE public.catalog_item_type AS ENUM (
    'lining',
    'pocketing',
    'sleeve_lining',
    'stretch',
    'knee_lining'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create catalog_unit enum
DO $$ BEGIN
  CREATE TYPE public.catalog_unit AS ENUM (
    'meters',
    'kilograms'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create catalog_items table (main table)
CREATE TABLE IF NOT EXISTS public.catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Status & Classification
  status public.catalog_item_status NOT NULL DEFAULT 'pending_approval',
  is_active BOOLEAN NOT NULL DEFAULT false,
  type public.catalog_item_type NOT NULL DEFAULT 'lining',
  
  -- Core identification
  code TEXT NOT NULL,
  color_name TEXT NOT NULL,
  description TEXT,
  
  -- Generated SKU (immutable after creation)
  lastro_sku_code TEXT NOT NULL UNIQUE,
  logo_sku_code TEXT,
  
  -- Fabric properties
  composition JSONB DEFAULT '[]'::jsonb, -- [{fiber: "Viscose", percent: 100}]
  weaving_knitted TEXT, -- Stores the 30+ fabric construction types
  fabric_type TEXT,
  weight_g_m2 NUMERIC,
  produced_unit public.catalog_unit DEFAULT 'meters',
  sold_unit public.catalog_unit DEFAULT 'meters',
  
  -- Documentation
  spec_sheet_url TEXT,
  spec_sheet_file TEXT, -- Storage path
  test_report_url TEXT,
  test_report_file TEXT, -- Storage path
  
  -- Images
  shade_range_image_url TEXT,
  photo_of_design_url TEXT,
  
  -- Additional info
  eu_origin BOOLEAN DEFAULT false,
  sustainable_notes TEXT,
  product_notes TEXT,
  care_instructions TEXT,
  dyeing_batch_size NUMERIC,
  
  -- Supplier summary (denormalized for UI)
  suppliers TEXT,
  
  -- Dates
  last_update_date DATE,
  last_inbound_date DATE,
  
  -- Extensibility
  extra_attributes JSONB DEFAULT '{}'::jsonb,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_user_id UUID,
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID,
  
  -- Unique constraint on code + color_name
  CONSTRAINT catalog_items_code_color_unique UNIQUE (code, color_name)
);

-- 6. Create function to generate lastro_sku_code
CREATE OR REPLACE FUNCTION public.generate_lastro_sku_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sku_code TEXT;
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Excludes ambiguous chars I,O,0,1
  i INTEGER;
BEGIN
  LOOP
    sku_code := 'LTA-';
    FOR i IN 1..8 LOOP
      sku_code := sku_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.catalog_items WHERE lastro_sku_code = sku_code) THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN sku_code;
END;
$$;

-- 7. Create trigger to auto-generate lastro_sku_code and manage is_active
CREATE OR REPLACE FUNCTION public.catalog_items_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate SKU if not provided
  IF NEW.lastro_sku_code IS NULL OR NEW.lastro_sku_code = '' THEN
    NEW.lastro_sku_code := public.generate_lastro_sku_code();
  END IF;
  
  -- Set is_active based on status
  NEW.is_active := (NEW.status = 'active');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER catalog_items_before_insert_trigger
  BEFORE INSERT ON public.catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_items_before_insert();

-- 8. Create trigger to update is_active and updated_at on update
CREATE OR REPLACE FUNCTION public.catalog_items_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing lastro_sku_code after creation
  IF OLD.lastro_sku_code IS DISTINCT FROM NEW.lastro_sku_code THEN
    RAISE EXCEPTION 'Cannot modify lastro_sku_code after creation';
  END IF;
  
  -- Update is_active based on status
  NEW.is_active := (NEW.status = 'active');
  
  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER catalog_items_before_update_trigger
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.catalog_items_before_update();

-- 9. Create catalog_item_suppliers table
CREATE TABLE IF NOT EXISTS public.catalog_item_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
  supplier_name TEXT NOT NULL,
  supplier_code TEXT,
  moq NUMERIC,
  lead_time_days INTEGER,
  supplier_notes TEXT,
  last_update_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create catalog_custom_field_definitions table
CREATE TABLE IF NOT EXISTS public.catalog_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'quality',
  field_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'dropdown', 'url')),
  options JSONB, -- For dropdown type: ["Option1", "Option2"]
  help_text TEXT,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create catalog_custom_field_values table
CREATE TABLE IF NOT EXISTS public.catalog_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  field_definition_id UUID NOT NULL REFERENCES public.catalog_custom_field_definitions(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_custom_field_values_unique UNIQUE (catalog_item_id, field_definition_id)
);

-- 12. Create catalog_item_audit_logs table
CREATE TABLE IF NOT EXISTS public.catalog_item_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE CASCADE,
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'status_change', 'approval')),
  field_changes JSONB -- {field_name: {old: value, new: value}}
);

-- 13. Create catalog_user_views table (saved views)
CREATE TABLE IF NOT EXISTS public.catalog_user_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  selected_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB DEFAULT '{}'::jsonb,
  sort_order JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_user_views_name_unique UNIQUE (user_id, view_name)
);

-- 14. Create catalog_approval_settings table
CREATE TABLE IF NOT EXISTS public.catalog_approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default approval settings
INSERT INTO public.catalog_approval_settings (setting_key, setting_value)
VALUES ('fields_requiring_approval', '["composition", "weight_g_m2", "spec_sheet_url", "spec_sheet_file", "test_report_url", "test_report_file"]'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- 15. Add catalog_item_id FK to existing tables
ALTER TABLE public.lots 
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id);

ALTER TABLE public.incoming_stock 
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id);

ALTER TABLE public.manufacturing_orders 
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.catalog_items(id);

-- 16. Create trigger to update last_inbound_date when lots are created
CREATE OR REPLACE FUNCTION public.update_catalog_last_inbound_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.catalog_item_id IS NOT NULL THEN
    UPDATE public.catalog_items
    SET last_inbound_date = CURRENT_DATE
    WHERE id = NEW.catalog_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lots_update_catalog_inbound_trigger
  AFTER INSERT ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_catalog_last_inbound_date();

CREATE TRIGGER incoming_stock_update_catalog_inbound_trigger
  AFTER INSERT ON public.incoming_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_catalog_last_inbound_date();

-- 17. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_catalog_items_status ON public.catalog_items(status);
CREATE INDEX IF NOT EXISTS idx_catalog_items_type ON public.catalog_items(type);
CREATE INDEX IF NOT EXISTS idx_catalog_items_code ON public.catalog_items(code);
CREATE INDEX IF NOT EXISTS idx_catalog_items_color ON public.catalog_items(color_name);
CREATE INDEX IF NOT EXISTS idx_catalog_items_lastro_sku ON public.catalog_items(lastro_sku_code);
CREATE INDEX IF NOT EXISTS idx_catalog_items_is_active ON public.catalog_items(is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_item_suppliers_catalog_id ON public.catalog_item_suppliers(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_item_audit_logs_catalog_id ON public.catalog_item_audit_logs(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_custom_field_values_catalog_id ON public.catalog_custom_field_values(catalog_item_id);

-- 18. Enable RLS on all catalog tables
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_item_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_user_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_approval_settings ENABLE ROW LEVEL SECURITY;

-- 19. RLS Policies for catalog_items
CREATE POLICY "Users with catalog.view can view catalog_items"
  ON public.catalog_items FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Users with catalog.create can insert catalog_items"
  ON public.catalog_items FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Users with catalog.edit can update catalog_items"
  ON public.catalog_items FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Only admins can delete catalog_items"
  ON public.catalog_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 20. RLS Policies for catalog_item_suppliers
CREATE POLICY "Users with catalog.view can view catalog_item_suppliers"
  ON public.catalog_item_suppliers FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Users with catalog.edit can manage catalog_item_suppliers"
  ON public.catalog_item_suppliers FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

-- 21. RLS Policies for catalog_custom_field_definitions
CREATE POLICY "Users with catalog.view can view custom field definitions"
  ON public.catalog_custom_field_definitions FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Only admins can manage custom field definitions"
  ON public.catalog_custom_field_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 22. RLS Policies for catalog_custom_field_values
CREATE POLICY "Users with catalog.view can view custom field values"
  ON public.catalog_custom_field_values FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Users with catalog.edit can manage custom field values"
  ON public.catalog_custom_field_values FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

-- 23. RLS Policies for catalog_item_audit_logs
CREATE POLICY "Users with catalog.view can view audit logs"
  ON public.catalog_item_audit_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "System can insert audit logs"
  ON public.catalog_item_audit_logs FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

-- 24. RLS Policies for catalog_user_views
CREATE POLICY "Users can view their own saved views"
  ON public.catalog_user_views FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own saved views"
  ON public.catalog_user_views FOR ALL
  USING (user_id = auth.uid());

-- 25. RLS Policies for catalog_approval_settings
CREATE POLICY "Users with catalog.view can view approval settings"
  ON public.catalog_approval_settings FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR
    has_role(auth.uid(), 'senior_manager'::user_role) OR
    has_role(auth.uid(), 'accounting'::user_role)
  );

CREATE POLICY "Only admins can manage approval settings"
  ON public.catalog_approval_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 26. Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('catalog-spec-sheets', 'catalog-spec-sheets', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('catalog-test-reports', 'catalog-test-reports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

-- 27. Storage policies for catalog-spec-sheets
CREATE POLICY "Authorized users can view spec sheets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'catalog-spec-sheets' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Authorized users can upload spec sheets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog-spec-sheets' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Authorized users can update spec sheets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'catalog-spec-sheets' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Admins can delete spec sheets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-spec-sheets' AND has_role(auth.uid(), 'admin'::user_role));

-- 28. Storage policies for catalog-test-reports
CREATE POLICY "Authorized users can view test reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'catalog-test-reports' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Authorized users can upload test reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog-test-reports' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Authorized users can update test reports"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'catalog-test-reports' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Admins can delete test reports"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-test-reports' AND has_role(auth.uid(), 'admin'::user_role));

-- 29. Storage policies for catalog-images (public bucket)
CREATE POLICY "Anyone can view catalog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-images');

CREATE POLICY "Authorized users can upload catalog images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'catalog-images' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Authorized users can update catalog images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'catalog-images' AND
    (has_role(auth.uid(), 'admin'::user_role) OR
     has_role(auth.uid(), 'senior_manager'::user_role) OR
     has_role(auth.uid(), 'accounting'::user_role))
  );

CREATE POLICY "Admins can delete catalog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-images' AND has_role(auth.uid(), 'admin'::user_role));

-- 30. Insert catalog permissions into role_permissions
INSERT INTO public.role_permissions (role, permission_category, permission_action, is_allowed)
VALUES
  -- Catalog View
  ('warehouse_staff', 'catalog', 'view', false),
  ('accounting', 'catalog', 'view', true),
  ('senior_manager', 'catalog', 'view', true),
  ('admin', 'catalog', 'view', true),
  
  -- Catalog Create
  ('warehouse_staff', 'catalog', 'create', false),
  ('accounting', 'catalog', 'create', true),
  ('senior_manager', 'catalog', 'create', true),
  ('admin', 'catalog', 'create', true),
  
  -- Catalog Edit
  ('warehouse_staff', 'catalog', 'edit', false),
  ('accounting', 'catalog', 'edit', true),
  ('senior_manager', 'catalog', 'edit', true),
  ('admin', 'catalog', 'edit', true),
  
  -- Catalog Approve
  ('warehouse_staff', 'catalog', 'approve', false),
  ('accounting', 'catalog', 'approve', false),
  ('senior_manager', 'catalog', 'approve', true),
  ('admin', 'catalog', 'approve', true),
  
  -- Catalog Import
  ('warehouse_staff', 'catalog', 'import', false),
  ('accounting', 'catalog', 'import', true),
  ('senior_manager', 'catalog', 'import', true),
  ('admin', 'catalog', 'import', true),
  
  -- Catalog Export
  ('warehouse_staff', 'catalog', 'export', false),
  ('accounting', 'catalog', 'export', true),
  ('senior_manager', 'catalog', 'export', true),
  ('admin', 'catalog', 'export', true),
  
  -- Catalog Manage Custom Fields
  ('warehouse_staff', 'catalog', 'manage_custom_fields', false),
  ('accounting', 'catalog', 'manage_custom_fields', false),
  ('senior_manager', 'catalog', 'manage_custom_fields', false),
  ('admin', 'catalog', 'manage_custom_fields', true)
ON CONFLICT DO NOTHING;