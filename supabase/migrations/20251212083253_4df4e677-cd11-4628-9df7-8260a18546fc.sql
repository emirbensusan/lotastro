-- 3.1 Database Preparation

-- Add stock threshold columns to qualities table
ALTER TABLE public.qualities 
ADD COLUMN IF NOT EXISTS low_stock_threshold_meters numeric DEFAULT 500,
ADD COLUMN IF NOT EXISTS critical_stock_threshold_meters numeric DEFAULT 100;

-- Create email_log table for tracking sent emails
CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.email_templates(id),
  template_key text,
  recipient text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on email_log
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_log - only admins can view
CREATE POLICY "Admins can view email_log"
  ON public.email_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- System (edge functions) can insert email_log
CREATE POLICY "System can insert email_log"
  ON public.email_log FOR INSERT
  WITH CHECK (true);

-- Admins can update email_log
CREATE POLICY "Admins can update email_log"
  ON public.email_log FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_log_template_key ON public.email_log(template_key);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON public.email_log(recipient);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON public.email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON public.email_log(created_at DESC);

-- 3.2 Insert Email Templates

-- Low Stock Alert Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'low_stock_alert',
  'Low Stock Alert',
  'inventory_alerts',
  'Low Stock Alert: {quality} {color}',
  'Düşük Stok Uyarısı: {quality} {color}',
  '<h2>Low Stock Alert</h2>
<p>The following item has fallen below the low stock threshold:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quality:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Color:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Current Stock:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{current_stock} meters</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Threshold:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{threshold} meters</td></tr>
</table>
<p style="margin-top: 20px;">Please consider reordering this item.</p>',
  '<h2>Düşük Stok Uyarısı</h2>
<p>Aşağıdaki ürün düşük stok eşiğinin altına düştü:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kalite:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Renk:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Mevcut Stok:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{current_stock} metre</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Eşik:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{threshold} metre</td></tr>
</table>
<p style="margin-top: 20px;">Lütfen bu ürünü yeniden sipariş etmeyi düşünün.</p>',
  ARRAY['quality', 'color', 'current_stock', 'threshold'],
  '[{"key": "quality", "description": "Quality code"}, {"key": "color", "description": "Color name"}, {"key": "current_stock", "description": "Current stock in meters"}, {"key": "threshold", "description": "Threshold value"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Critical Stock Alert Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'critical_stock_alert',
  'Critical Stock Alert',
  'inventory_alerts',
  '🚨 CRITICAL: Stock Alert for {quality} {color}',
  '🚨 KRİTİK: {quality} {color} için Stok Uyarısı',
  '<h2 style="color: #dc2626;">🚨 Critical Stock Alert</h2>
<p><strong>URGENT:</strong> The following item has reached critical stock levels:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quality:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Color:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Current Stock:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;">{current_stock} meters</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Critical Threshold:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{threshold} meters</td></tr>
</table>
<p style="margin-top: 20px; color: #dc2626;"><strong>Immediate action required!</strong></p>',
  '<h2 style="color: #dc2626;">🚨 Kritik Stok Uyarısı</h2>
<p><strong>ACİL:</strong> Aşağıdaki ürün kritik stok seviyesine ulaştı:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kalite:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Renk:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Mevcut Stok:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626; font-weight: bold;">{current_stock} metre</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kritik Eşik:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{threshold} metre</td></tr>
</table>
<p style="margin-top: 20px; color: #dc2626;"><strong>Acil aksiyon gerekli!</strong></p>',
  ARRAY['quality', 'color', 'current_stock', 'threshold'],
  '[{"key": "quality", "description": "Quality code"}, {"key": "color", "description": "Color name"}, {"key": "current_stock", "description": "Current stock in meters"}, {"key": "threshold", "description": "Critical threshold value"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Forecast Weekly Digest Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'forecast_weekly_digest',
  'Forecast Weekly Digest',
  'forecast',
  'Weekly Forecast Digest - {date}',
  'Haftalık Tahmin Özeti - {date}',
  '<h2>Weekly Forecast Digest</h2>
<p>Here is your weekly forecast summary for {date}:</p>

<h3>📊 Summary</h3>
<ul>
  <li>Total Quality-Color Combinations: {total_combinations}</li>
  <li>Items at Risk (Stockout): {at_risk_count}</li>
  <li>Items Overstocked: {overstock_count}</li>
</ul>

<h3>⚠️ Top Items Requiring Attention</h3>
{items_table}

<h3>📈 Recommended Orders</h3>
{recommendations_table}

<p style="margin-top: 20px;">View full details in the <a href="{app_url}/forecast">Forecast Dashboard</a>.</p>',
  '<h2>Haftalık Tahmin Özeti</h2>
<p>{date} tarihi için haftalık tahmin özetiniz:</p>

<h3>📊 Özet</h3>
<ul>
  <li>Toplam Kalite-Renk Kombinasyonu: {total_combinations}</li>
  <li>Risk Altındaki Ürünler (Stok Tükenmesi): {at_risk_count}</li>
  <li>Fazla Stoklu Ürünler: {overstock_count}</li>
</ul>

<h3>⚠️ Dikkat Gerektiren Ürünler</h3>
{items_table}

<h3>📈 Önerilen Siparişler</h3>
{recommendations_table}

<p style="margin-top: 20px;">Detayları <a href="{app_url}/forecast">Tahmin Paneli</a>''nde görüntüleyin.</p>',
  ARRAY['date', 'total_combinations', 'at_risk_count', 'overstock_count', 'items_table', 'recommendations_table', 'app_url'],
  '[{"key": "date", "description": "Report date"}, {"key": "total_combinations", "description": "Total quality-color pairs"}, {"key": "at_risk_count", "description": "Items at risk"}, {"key": "overstock_count", "description": "Overstocked items"}, {"key": "items_table", "description": "HTML table of items"}, {"key": "recommendations_table", "description": "HTML table of recommendations"}, {"key": "app_url", "description": "Application URL"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Reservation Expiring Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'reservation_expiring',
  'Reservation Expiring Soon',
  'reservations',
  'Reservation {reservation_number} Expiring Soon',
  '{reservation_number} Numaralı Rezervasyon Yakında Sona Erecek',
  '<h2>Reservation Expiring Soon</h2>
<p>The following reservation is expiring soon and requires your attention:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reservation #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{reservation_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reserved Meters:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{total_meters}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Expires On:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #f59e0b; font-weight: bold;">{hold_until}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Days Remaining:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{days_remaining}</td></tr>
</table>
<p style="margin-top: 20px;">Please convert this reservation to an order or extend the hold date.</p>',
  '<h2>Rezervasyon Yakında Sona Erecek</h2>
<p>Aşağıdaki rezervasyon yakında sona erecek ve dikkatinizi gerektiriyor:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rezervasyon #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{reservation_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Müşteri:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rezerve Metre:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{total_meters}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bitiş Tarihi:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #f59e0b; font-weight: bold;">{hold_until}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kalan Gün:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{days_remaining}</td></tr>
</table>
<p style="margin-top: 20px;">Lütfen bu rezervasyonu siparişe dönüştürün veya bekletme tarihini uzatın.</p>',
  ARRAY['reservation_number', 'customer_name', 'total_meters', 'hold_until', 'days_remaining'],
  '[{"key": "reservation_number", "description": "Reservation number"}, {"key": "customer_name", "description": "Customer name"}, {"key": "total_meters", "description": "Total reserved meters"}, {"key": "hold_until", "description": "Expiration date"}, {"key": "days_remaining", "description": "Days until expiration"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Reservation Created Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'reservation_created',
  'Reservation Created',
  'reservations',
  'New Reservation Created: {reservation_number}',
  'Yeni Rezervasyon Oluşturuldu: {reservation_number}',
  '<h2>New Reservation Created</h2>
<p>A new reservation has been created:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reservation #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{reservation_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Created By:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{created_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Meters:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{total_meters}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Hold Until:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{hold_until}</td></tr>
</table>
<h3>Reserved Items</h3>
{items_table}',
  '<h2>Yeni Rezervasyon Oluşturuldu</h2>
<p>Yeni bir rezervasyon oluşturuldu:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rezervasyon #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{reservation_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Müşteri:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Oluşturan:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{created_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Toplam Metre:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{total_meters}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bekletme Tarihi:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{hold_until}</td></tr>
</table>
<h3>Rezerve Edilen Ürünler</h3>
{items_table}',
  ARRAY['reservation_number', 'customer_name', 'created_by', 'total_meters', 'hold_until', 'items_table'],
  '[{"key": "reservation_number", "description": "Reservation number"}, {"key": "customer_name", "description": "Customer name"}, {"key": "created_by", "description": "User who created"}, {"key": "total_meters", "description": "Total meters"}, {"key": "hold_until", "description": "Hold date"}, {"key": "items_table", "description": "HTML table of items"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Order Status Changed Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'order_status_changed',
  'Order Status Changed',
  'orders',
  'Order {order_number} Status Updated',
  '{order_number} Sipariş Durumu Güncellendi',
  '<h2>Order Status Updated</h2>
<p>The status of order {order_number} has been updated:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Order #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{order_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Customer:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Previous Status:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{old_status}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>New Status:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #16a34a; font-weight: bold;">{new_status}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Updated By:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{updated_by}</td></tr>
</table>',
  '<h2>Sipariş Durumu Güncellendi</h2>
<p>{order_number} numaralı siparişin durumu güncellendi:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Sipariş #:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{order_number}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Müşteri:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{customer_name}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Önceki Durum:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{old_status}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Yeni Durum:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #16a34a; font-weight: bold;">{new_status}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Güncelleyen:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{updated_by}</td></tr>
</table>',
  ARRAY['order_number', 'customer_name', 'old_status', 'new_status', 'updated_by'],
  '[{"key": "order_number", "description": "Order number"}, {"key": "customer_name", "description": "Customer name"}, {"key": "old_status", "description": "Previous status"}, {"key": "new_status", "description": "New status"}, {"key": "updated_by", "description": "User who updated"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Catalog Item Approved Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'catalog_item_approved',
  'Catalog Item Approved',
  'catalog',
  'Catalog Item Approved: {sku_code}',
  'Katalog Öğesi Onaylandı: {sku_code}',
  '<h2>Catalog Item Approved ✓</h2>
<p>Your catalog item has been approved and is now active:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>SKU Code:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{sku_code}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quality:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Color:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Approved By:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{approved_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Approved At:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{approved_at}</td></tr>
</table>
<p style="margin-top: 20px;">This item can now be used in inventory and orders.</p>',
  '<h2>Katalog Öğesi Onaylandı ✓</h2>
<p>Katalog öğeniz onaylandı ve artık aktif:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>SKU Kodu:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{sku_code}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kalite:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Renk:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Onaylayan:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{approved_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Onay Tarihi:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{approved_at}</td></tr>
</table>
<p style="margin-top: 20px;">Bu öğe artık envanter ve siparişlerde kullanılabilir.</p>',
  ARRAY['sku_code', 'quality', 'color', 'approved_by', 'approved_at'],
  '[{"key": "sku_code", "description": "SKU code"}, {"key": "quality", "description": "Quality code"}, {"key": "color", "description": "Color name"}, {"key": "approved_by", "description": "Approver name"}, {"key": "approved_at", "description": "Approval timestamp"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Catalog Item Rejected Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'catalog_item_rejected',
  'Catalog Item Rejected',
  'catalog',
  'Catalog Item Rejected: {sku_code}',
  'Katalog Öğesi Reddedildi: {sku_code}',
  '<h2 style="color: #dc2626;">Catalog Item Rejected ✗</h2>
<p>Your catalog item has been rejected:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>SKU Code:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{sku_code}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Quality:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Color:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rejected By:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{rejected_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">{rejection_reason}</td></tr>
</table>
<p style="margin-top: 20px;">Please review the feedback and resubmit if needed.</p>',
  '<h2 style="color: #dc2626;">Katalog Öğesi Reddedildi ✗</h2>
<p>Katalog öğeniz reddedildi:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>SKU Kodu:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{sku_code}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Kalite:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{quality}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Renk:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{color}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Reddeden:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{rejected_by}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Neden:</strong></td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">{rejection_reason}</td></tr>
</table>
<p style="margin-top: 20px;">Lütfen geri bildirimi inceleyin ve gerekirse yeniden gönderin.</p>',
  ARRAY['sku_code', 'quality', 'color', 'rejected_by', 'rejection_reason'],
  '[{"key": "sku_code", "description": "SKU code"}, {"key": "quality", "description": "Quality code"}, {"key": "color", "description": "Color name"}, {"key": "rejected_by", "description": "Rejector name"}, {"key": "rejection_reason", "description": "Rejection reason"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- New User Welcome Template
INSERT INTO public.email_templates (template_key, name, category, subject_en, subject_tr, body_en, body_tr, variables, variables_meta, is_system)
VALUES (
  'new_user_welcome',
  'New User Welcome',
  'system',
  'Welcome to LotAstro, {user_name}!',
  'LotAstro''ya Hoş Geldiniz, {user_name}!',
  '<h2>Welcome to LotAstro! 🎉</h2>
<p>Hello {user_name},</p>
<p>Your account has been created successfully. Here are your details:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{email}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Role:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{role}</td></tr>
</table>
<p style="margin-top: 20px;">You can now log in to the system using the credentials you set during registration.</p>
<p><a href="{app_url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Go to LotAstro</a></p>
<p style="margin-top: 20px;">If you have any questions, please contact your administrator.</p>',
  '<h2>LotAstro''ya Hoş Geldiniz! 🎉</h2>
<p>Merhaba {user_name},</p>
<p>Hesabınız başarıyla oluşturuldu. İşte bilgileriniz:</p>
<table style="border-collapse: collapse; width: 100%;">
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>E-posta:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{email}</td></tr>
  <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rol:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{role}</td></tr>
</table>
<p style="margin-top: 20px;">Kayıt sırasında belirlediğiniz kimlik bilgilerini kullanarak sisteme giriş yapabilirsiniz.</p>
<p><a href="{app_url}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">LotAstro''ya Git</a></p>
<p style="margin-top: 20px;">Herhangi bir sorunuz varsa, lütfen yöneticinizle iletişime geçin.</p>',
  ARRAY['user_name', 'email', 'role', 'app_url'],
  '[{"key": "user_name", "description": "User full name"}, {"key": "email", "description": "User email"}, {"key": "role", "description": "Assigned role"}, {"key": "app_url", "description": "Application URL"}]'::jsonb,
  true
) ON CONFLICT (template_key) DO NOTHING;

-- Add email notification settings to email_settings
INSERT INTO public.email_settings (setting_key, setting_value, description)
VALUES 
  ('stock_alerts_enabled', 'true', 'Enable/disable stock alert emails'),
  ('stock_alerts_recipients', '[]', 'List of email addresses to receive stock alerts'),
  ('reservation_reminders_enabled', 'true', 'Enable/disable reservation expiration reminders'),
  ('reservation_reminders_days_before', '3', 'Days before expiration to send reminder'),
  ('forecast_digest_enabled', 'true', 'Enable/disable weekly forecast digest'),
  ('forecast_digest_recipients', '[]', 'List of email addresses to receive forecast digest')
ON CONFLICT (setting_key) DO NOTHING;