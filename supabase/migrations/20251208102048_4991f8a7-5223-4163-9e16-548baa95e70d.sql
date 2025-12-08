-- Create manufacturing_orders table
CREATE TABLE public.manufacturing_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mo_number TEXT NOT NULL UNIQUE,
  
  -- Core fields
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  quality TEXT NOT NULL,
  color TEXT NOT NULL,
  ordered_meters NUMERIC NOT NULL,
  
  -- Dates
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_completion_date DATE,
  
  -- Optional fields
  supplier_confirmation_number TEXT,
  price_per_meter NUMERIC,
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  
  -- Customer reservation link
  is_customer_order BOOLEAN DEFAULT false,
  customer_name TEXT,
  customer_agreed_date DATE,
  reservation_id UUID REFERENCES public.reservations(id),
  
  -- Status: ORDERED, CONFIRMED, IN_PRODUCTION, READY_TO_SHIP, SHIPPED, CANCELLED
  status TEXT NOT NULL DEFAULT 'ORDERED',
  
  -- Tracking
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  
  -- Link to incoming_stock when shipped
  incoming_stock_id UUID REFERENCES public.incoming_stock(id)
);

-- Create mo_status_history table
CREATE TABLE public.mo_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturing_order_id UUID NOT NULL REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject_en TEXT NOT NULL,
  subject_tr TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_tr TEXT NOT NULL,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create email_settings table
CREATE TABLE public.email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Function to generate MO number
CREATE OR REPLACE FUNCTION public.generate_mo_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mo_num TEXT;
  counter INTEGER := 1;
  base_num TEXT;
BEGIN
  base_num := 'MO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  LOOP
    mo_num := base_num || LPAD(counter::TEXT, 3, '0');
    
    IF NOT EXISTS (SELECT 1 FROM public.manufacturing_orders WHERE mo_number = mo_num) THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
  END LOOP;
  
  RETURN mo_num;
END;
$$;

-- Set default for mo_number
ALTER TABLE public.manufacturing_orders ALTER COLUMN mo_number SET DEFAULT generate_mo_number();

-- Trigger function for status history
CREATE OR REPLACE FUNCTION public.log_mo_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.mo_status_history (manufacturing_order_id, old_status, new_status, changed_by, notes)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.updated_by, NEW.created_by), NEW.notes);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for status history
CREATE TRIGGER mo_status_change_trigger
AFTER UPDATE ON public.manufacturing_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_mo_status_change();

-- Trigger for updated_at
CREATE TRIGGER update_manufacturing_orders_updated_at
BEFORE UPDATE ON public.manufacturing_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mo_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for manufacturing_orders
CREATE POLICY "All authorized users can view manufacturing_orders"
ON public.manufacturing_orders FOR SELECT
USING (
  has_role(auth.uid(), 'warehouse_staff'::user_role) OR
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can create manufacturing_orders"
ON public.manufacturing_orders FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Accounting, senior managers and admins can update manufacturing_orders"
ON public.manufacturing_orders FOR UPDATE
USING (
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "Only admins can delete manufacturing_orders"
ON public.manufacturing_orders FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for mo_status_history
CREATE POLICY "All authorized users can view mo_status_history"
ON public.mo_status_history FOR SELECT
USING (
  has_role(auth.uid(), 'warehouse_staff'::user_role) OR
  has_role(auth.uid(), 'accounting'::user_role) OR
  has_role(auth.uid(), 'senior_manager'::user_role) OR
  has_role(auth.uid(), 'admin'::user_role)
);

CREATE POLICY "System can insert mo_status_history"
ON public.mo_status_history FOR INSERT
WITH CHECK (true);

-- RLS Policies for email_templates
CREATE POLICY "Admins can manage email_templates"
ON public.email_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for email_settings
CREATE POLICY "Admins can view email_settings"
ON public.email_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update email_settings"
ON public.email_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can insert email_settings"
ON public.email_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Insert default email templates
INSERT INTO public.email_templates (template_key, name, subject_en, subject_tr, body_en, body_tr, variables) VALUES
('mo_reminder', 'Manufacturing Order Reminder', 
 'Reminder: Manufacturing Order {mo_number} - {quality} {color}',
 'Hatırlatma: Üretim Siparişi {mo_number} - {quality} {color}',
 '<p>Reminder: <strong>{ordered_meters}</strong> meters of <strong>{quality}</strong> ({color}) from <strong>{supplier}</strong> is due on <strong>{eta}</strong>.</p><p>Current status: <strong>{status}</strong></p><p>Manufacturing Order: {mo_number}</p>',
 '<p>Hatırlatma: <strong>{supplier}</strong> tedarikçisinden <strong>{quality}</strong> kalite, <strong>{color}</strong> renkte <strong>{ordered_meters}</strong> metre üretim siparişi <strong>{eta}</strong> tarihinde teslim edilecek.</p><p>Mevcut durum: <strong>{status}</strong></p><p>Üretim Siparişi: {mo_number}</p>',
 ARRAY['mo_number', 'quality', 'color', 'ordered_meters', 'supplier', 'eta', 'status']),

('mo_overdue', 'Manufacturing Order Overdue',
 'OVERDUE: Manufacturing Order {mo_number} - {quality} {color}',
 'GECİKMİŞ: Üretim Siparişi {mo_number} - {quality} {color}',
 '<p><strong>OVERDUE:</strong> {ordered_meters} meters of {quality} ({color}) from {supplier} was due on {eta}.</p><p>This order is now <strong>{overdue_days} days overdue</strong>.</p><p>Current status: {status}</p><p>Please check status with the supplier.</p>',
 '<p><strong>GECİKMİŞ:</strong> {supplier} tedarikçisinden {quality} kalite, {color} renkte {ordered_meters} metre üretim siparişi {eta} tarihinde teslim edilmeliydi.</p><p>Bu sipariş <strong>{overdue_days} gün gecikmiş</strong> durumda.</p><p>Mevcut durum: {status}</p><p>Lütfen tedarikçiden güncel durumu öğrenin.</p>',
 ARRAY['mo_number', 'quality', 'color', 'ordered_meters', 'supplier', 'eta', 'status', 'overdue_days']),

('mo_weekly_summary', 'Weekly Manufacturing Orders Summary',
 'Weekly Manufacturing Orders Summary - {date}',
 'Haftalık Üretim Siparişleri Özeti - {date}',
 '<h2>Weekly Manufacturing Orders Summary</h2><p>Date: {date}</p><h3>Orders Due This Week: {due_count}</h3>{due_orders_list}<h3>Overdue Orders: {overdue_count}</h3>{overdue_orders_list}<h3>In Production: {in_production_count}</h3>',
 '<h2>Haftalık Üretim Siparişleri Özeti</h2><p>Tarih: {date}</p><h3>Bu Hafta Teslim Edilecek: {due_count}</h3>{due_orders_list}<h3>Gecikmiş Siparişler: {overdue_count}</h3>{overdue_orders_list}<h3>Üretimde: {in_production_count}</h3>',
 ARRAY['date', 'due_count', 'due_orders_list', 'overdue_count', 'overdue_orders_list', 'in_production_count']);

-- Insert default email settings
INSERT INTO public.email_settings (setting_key, setting_value, description) VALUES
('mo_reminder_days', '{"days": [7, 3]}', 'Days before ETA to send reminders'),
('mo_reminder_schedule', '{"day_of_week": 4, "hour": 17, "minute": 0, "timezone": "Europe/Istanbul"}', 'Weekly reminder schedule (day_of_week: 0=Sunday, 4=Thursday)'),
('mo_reminder_recipients', '{"emails": []}', 'Additional email addresses for MO reminders'),
('mo_overdue_escalation', '{"daily_count": 3, "then_weekly": true}', 'Overdue escalation rules');