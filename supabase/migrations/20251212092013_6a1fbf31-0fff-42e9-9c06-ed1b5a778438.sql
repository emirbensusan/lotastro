-- Phase 2: Email Templates - Digest Format

-- ============================================
-- 1. Create Stock Alerts Digest Template
-- ============================================
INSERT INTO public.email_templates (
  template_key,
  name,
  subject_en,
  subject_tr,
  body_en,
  body_tr,
  variables,
  variables_meta,
  category,
  is_system,
  is_active,
  is_digest
) VALUES (
  'stock_digest',
  'Stock Alerts Digest',
  '📦 Stock Alert Digest - {date}',
  '📦 Stok Uyarı Özeti - {date}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Stock Alert Digest</h1>
    <p style="color: #666;">Report generated on {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🚨 Critical Stock ({critical_count} items)</h2>
      {critical_items_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">⚠️ Low Stock ({low_stock_count} items)</h2>
      {low_stock_items_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Total Items Requiring Attention:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/inventory" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Inventory</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated digest from LotAstro. Only qualities with alerts enabled are included.</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Stok Uyarı Özeti</h1>
    <p style="color: #666;">Rapor tarihi: {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🚨 Kritik Stok ({critical_count} ürün)</h2>
      {critical_items_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">⚠️ Düşük Stok ({low_stock_count} ürün)</h2>
      {low_stock_items_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Toplam Dikkat Gereken Ürün:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/inventory" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Envanteri Görüntüle</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Bu otomatik bir özet e-postasıdır. Sadece uyarıları etkin olan kaliteler dahildir.</p>
  </div>',
  ARRAY['date', 'critical_count', 'low_stock_count', 'total_count', 'critical_items_table', 'low_stock_items_table', 'app_url'],
  '[
    {"name": "date", "description_en": "Current date", "description_tr": "Güncel tarih", "example": "2024-12-12", "type": "date", "required": true},
    {"name": "critical_count", "description_en": "Number of critical stock items", "description_tr": "Kritik stok ürün sayısı", "example": "5", "type": "number", "required": true},
    {"name": "low_stock_count", "description_en": "Number of low stock items", "description_tr": "Düşük stok ürün sayısı", "example": "12", "type": "number", "required": true},
    {"name": "total_count", "description_en": "Total items requiring attention", "description_tr": "Toplam dikkat gereken ürün", "example": "17", "type": "number", "required": true},
    {"name": "critical_items_table", "description_en": "HTML table of critical stock items", "description_tr": "Kritik stok ürünleri tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "low_stock_items_table", "description_en": "HTML table of low stock items", "description_tr": "Düşük stok ürünleri tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "app_url", "description_en": "Application base URL", "description_tr": "Uygulama ana URL", "example": "https://app.lotastro.com", "type": "url", "required": true}
  ]'::jsonb,
  'alerts',
  true,
  true,
  true
);

-- ============================================
-- 2. Create Reservations Expiring Digest Template
-- ============================================
INSERT INTO public.email_templates (
  template_key,
  name,
  subject_en,
  subject_tr,
  body_en,
  body_tr,
  variables,
  variables_meta,
  category,
  is_system,
  is_active,
  is_digest
) VALUES (
  'reservations_expiring_digest',
  'Expiring Reservations Digest',
  '⏰ Expiring Reservations Digest - {date}',
  '⏰ Süresi Dolan Rezervasyon Özeti - {date}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Expiring Reservations Digest</h1>
    <p style="color: #666;">Report generated on {date}</p>
    
    <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
      <h3 style="color: #dc2626; margin: 0 0 10px 0;">🚨 Expiring Today ({expiring_today_count})</h3>
      {expiring_today_table}
    </div>
    
    <div style="margin: 20px 0; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <h3 style="color: #f59e0b; margin: 0 0 10px 0;">⚠️ Expiring in 1-3 Days ({expiring_soon_count})</h3>
      {expiring_soon_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Total Expiring Reservations:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/reservations" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Reservations</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated digest from LotAstro.</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Süresi Dolan Rezervasyon Özeti</h1>
    <p style="color: #666;">Rapor tarihi: {date}</p>
    
    <div style="margin: 20px 0; padding: 15px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 4px;">
      <h3 style="color: #dc2626; margin: 0 0 10px 0;">🚨 Bugün Sona Eren ({expiring_today_count})</h3>
      {expiring_today_table}
    </div>
    
    <div style="margin: 20px 0; padding: 15px; background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px;">
      <h3 style="color: #f59e0b; margin: 0 0 10px 0;">⚠️ 1-3 Gün İçinde Sona Eren ({expiring_soon_count})</h3>
      {expiring_soon_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Toplam Süresi Dolan Rezervasyon:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/reservations" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Rezervasyonları Görüntüle</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Bu otomatik bir özet e-postasıdır.</p>
  </div>',
  ARRAY['date', 'expiring_today_count', 'expiring_soon_count', 'total_count', 'expiring_today_table', 'expiring_soon_table', 'app_url'],
  '[
    {"name": "date", "description_en": "Current date", "description_tr": "Güncel tarih", "example": "2024-12-12", "type": "date", "required": true},
    {"name": "expiring_today_count", "description_en": "Reservations expiring today", "description_tr": "Bugün sona eren rezervasyonlar", "example": "3", "type": "number", "required": true},
    {"name": "expiring_soon_count", "description_en": "Reservations expiring in 1-3 days", "description_tr": "1-3 gün içinde sona eren", "example": "8", "type": "number", "required": true},
    {"name": "total_count", "description_en": "Total expiring reservations", "description_tr": "Toplam süresi dolan", "example": "11", "type": "number", "required": true},
    {"name": "expiring_today_table", "description_en": "HTML table of today expiring", "description_tr": "Bugün sona eren tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "expiring_soon_table", "description_en": "HTML table of soon expiring", "description_tr": "Yakında sona eren tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "app_url", "description_en": "Application base URL", "description_tr": "Uygulama ana URL", "example": "https://app.lotastro.com", "type": "url", "required": true}
  ]'::jsonb,
  'alerts',
  true,
  true,
  true
);

-- ============================================
-- 3. Create Overdue Items Digest Template
-- ============================================
INSERT INTO public.email_templates (
  template_key,
  name,
  subject_en,
  subject_tr,
  body_en,
  body_tr,
  variables,
  variables_meta,
  category,
  is_system,
  is_active,
  is_digest
) VALUES (
  'overdue_digest',
  'Overdue Items Digest',
  '🚨 Overdue Items Digest - {date}',
  '🚨 Gecikmiş Öğeler Özeti - {date}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Overdue Items Digest</h1>
    <p style="color: #666;">Report generated on {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🏭 Overdue Manufacturing Orders ({overdue_mo_count})</h2>
      {mo_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📦 Overdue Orders ({overdue_orders_count})</h2>
      {orders_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Total Overdue Items:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/manufacturing-orders" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">View MOs</a>
      <a href="{app_url}/orders" style="display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px;">View Orders</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated digest from LotAstro.</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Gecikmiş Öğeler Özeti</h1>
    <p style="color: #666;">Rapor tarihi: {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🏭 Gecikmiş Üretim Emirleri ({overdue_mo_count})</h2>
      {mo_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📦 Gecikmiş Siparişler ({overdue_orders_count})</h2>
      {orders_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Toplam Gecikmiş Öğe:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/manufacturing-orders" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">Üretim Emirlerini Gör</a>
      <a href="{app_url}/orders" style="display: inline-block; padding: 12px 24px; background: #6b7280; color: white; text-decoration: none; border-radius: 6px;">Siparişleri Gör</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Bu otomatik bir özet e-postasıdır.</p>
  </div>',
  ARRAY['date', 'overdue_mo_count', 'overdue_orders_count', 'total_count', 'mo_table', 'orders_table', 'app_url'],
  '[
    {"name": "date", "description_en": "Current date", "description_tr": "Güncel tarih", "example": "2024-12-12", "type": "date", "required": true},
    {"name": "overdue_mo_count", "description_en": "Overdue manufacturing orders count", "description_tr": "Gecikmiş üretim emirleri sayısı", "example": "4", "type": "number", "required": true},
    {"name": "overdue_orders_count", "description_en": "Overdue orders count", "description_tr": "Gecikmiş sipariş sayısı", "example": "2", "type": "number", "required": true},
    {"name": "total_count", "description_en": "Total overdue items", "description_tr": "Toplam gecikmiş öğe", "example": "6", "type": "number", "required": true},
    {"name": "mo_table", "description_en": "HTML table of overdue MOs", "description_tr": "Gecikmiş ÜE tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "orders_table", "description_en": "HTML table of overdue orders", "description_tr": "Gecikmiş sipariş tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "app_url", "description_en": "Application base URL", "description_tr": "Uygulama ana URL", "example": "https://app.lotastro.com", "type": "url", "required": true}
  ]'::jsonb,
  'alerts',
  true,
  true,
  true
);

-- ============================================
-- 4. Create Pending Approvals Digest Template
-- ============================================
INSERT INTO public.email_templates (
  template_key,
  name,
  subject_en,
  subject_tr,
  body_en,
  body_tr,
  variables,
  variables_meta,
  category,
  is_system,
  is_active,
  is_digest
) VALUES (
  'pending_approvals_digest',
  'Pending Approvals Digest',
  '✅ Pending Approvals Digest - {date}',
  '✅ Onay Bekleyen Öğeler Özeti - {date}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Pending Approvals Digest</h1>
    <p style="color: #666;">Report generated on {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">📋 Pending Catalog Items ({pending_catalog_count})</h2>
      {catalog_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">📦 Pending Order Approvals ({pending_orders_count})</h2>
      {orders_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Total Pending Approvals:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/approvals" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Approvals</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated digest from LotAstro.</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Onay Bekleyen Öğeler Özeti</h1>
    <p style="color: #666;">Rapor tarihi: {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 8px;">📋 Onay Bekleyen Katalog Öğeleri ({pending_catalog_count})</h2>
      {catalog_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">📦 Onay Bekleyen Siparişler ({pending_orders_count})</h2>
      {orders_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0;"><strong>Toplam Onay Bekleyen:</strong> {total_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/approvals" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Onayları Görüntüle</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Bu otomatik bir özet e-postasıdır.</p>
  </div>',
  ARRAY['date', 'pending_catalog_count', 'pending_orders_count', 'total_count', 'catalog_table', 'orders_table', 'app_url'],
  '[
    {"name": "date", "description_en": "Current date", "description_tr": "Güncel tarih", "example": "2024-12-12", "type": "date", "required": true},
    {"name": "pending_catalog_count", "description_en": "Pending catalog items count", "description_tr": "Onay bekleyen katalog sayısı", "example": "5", "type": "number", "required": true},
    {"name": "pending_orders_count", "description_en": "Pending order approvals count", "description_tr": "Onay bekleyen sipariş sayısı", "example": "3", "type": "number", "required": true},
    {"name": "total_count", "description_en": "Total pending approvals", "description_tr": "Toplam onay bekleyen", "example": "8", "type": "number", "required": true},
    {"name": "catalog_table", "description_en": "HTML table of pending catalog items", "description_tr": "Onay bekleyen katalog tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "orders_table", "description_en": "HTML table of pending orders", "description_tr": "Onay bekleyen sipariş tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "app_url", "description_en": "Application base URL", "description_tr": "Uygulama ana URL", "example": "https://app.lotastro.com", "type": "url", "required": true}
  ]'::jsonb,
  'alerts',
  true,
  true,
  true
);

-- ============================================
-- 5. Mark individual alert templates as deprecated
-- ============================================
UPDATE public.email_templates 
SET 
  is_active = false,
  name = name || ' (Deprecated - Use Digest)'
WHERE template_key IN ('low_stock_alert', 'critical_stock_alert', 'reservation_expiring')
AND is_active = true;

-- ============================================
-- 6. Add digest template for Forecast Weekly (update existing if present)
-- ============================================
INSERT INTO public.email_templates (
  template_key,
  name,
  subject_en,
  subject_tr,
  body_en,
  body_tr,
  variables,
  variables_meta,
  category,
  is_system,
  is_active,
  is_digest
) VALUES (
  'forecast_weekly_digest',
  'Weekly Forecast Digest',
  '📊 Weekly Forecast Digest - {date}',
  '📊 Haftalık Tahmin Özeti - {date}',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Weekly Forecast Digest</h1>
    <p style="color: #666;">Report generated on {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🚨 At-Risk Items ({at_risk_count})</h2>
      <p style="color: #666; font-size: 14px;">Items with potential stockout within lead time</p>
      {at_risk_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📈 Overstock Items ({overstock_count})</h2>
      <p style="color: #666; font-size: 14px;">Items with excess inventory</p>
      {overstock_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px;">🛒 Top Purchase Recommendations</h2>
      {recommendations_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0 0 8px 0;"><strong>Summary:</strong></p>
      <p style="margin: 0; font-size: 14px;">At-Risk: {at_risk_count} | Overstock: {overstock_count} | Recommendations: {recommendations_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/forecast" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">View Full Forecast</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">This is an automated weekly digest from LotAstro.</p>
  </div>',
  '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h1 style="color: #1a1a2e;">Haftalık Tahmin Özeti</h1>
    <p style="color: #666;">Rapor tarihi: {date}</p>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 8px;">🚨 Risk Altındaki Ürünler ({at_risk_count})</h2>
      <p style="color: #666; font-size: 14px;">Tedarik süresi içinde stok tükenmesi riski olan ürünler</p>
      {at_risk_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px;">📈 Fazla Stok ({overstock_count})</h2>
      <p style="color: #666; font-size: 14px;">Fazla envanteri olan ürünler</p>
      {overstock_table}
    </div>
    
    <div style="margin: 20px 0;">
      <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 8px;">🛒 En Önemli Satın Alma Önerileri</h2>
      {recommendations_table}
    </div>
    
    <div style="margin-top: 30px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
      <p style="margin: 0 0 8px 0;"><strong>Özet:</strong></p>
      <p style="margin: 0; font-size: 14px;">Risk Altında: {at_risk_count} | Fazla Stok: {overstock_count} | Öneriler: {recommendations_count}</p>
    </div>
    
    <div style="margin-top: 20px; text-align: center;">
      <a href="{app_url}/forecast" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Tam Tahmini Görüntüle</a>
    </div>
    
    <p style="color: #999; font-size: 12px; margin-top: 30px;">Bu otomatik bir haftalık özet e-postasıdır.</p>
  </div>',
  ARRAY['date', 'at_risk_count', 'overstock_count', 'recommendations_count', 'at_risk_table', 'overstock_table', 'recommendations_table', 'app_url'],
  '[
    {"name": "date", "description_en": "Current date", "description_tr": "Güncel tarih", "example": "2024-12-12", "type": "date", "required": true},
    {"name": "at_risk_count", "description_en": "At-risk items count", "description_tr": "Risk altındaki ürün sayısı", "example": "7", "type": "number", "required": true},
    {"name": "overstock_count", "description_en": "Overstock items count", "description_tr": "Fazla stok sayısı", "example": "4", "type": "number", "required": true},
    {"name": "recommendations_count", "description_en": "Purchase recommendations count", "description_tr": "Satın alma önerisi sayısı", "example": "12", "type": "number", "required": true},
    {"name": "at_risk_table", "description_en": "HTML table of at-risk items", "description_tr": "Risk altındaki ürün tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "overstock_table", "description_en": "HTML table of overstock items", "description_tr": "Fazla stok tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "recommendations_table", "description_en": "HTML table of recommendations", "description_tr": "Öneri tablosu", "example": "<table>...</table>", "type": "html", "required": true},
    {"name": "app_url", "description_en": "Application base URL", "description_tr": "Uygulama ana URL", "example": "https://app.lotastro.com", "type": "url", "required": true}
  ]'::jsonb,
  'alerts',
  true,
  true,
  true
) ON CONFLICT (template_key) DO UPDATE SET
  is_digest = true,
  body_en = EXCLUDED.body_en,
  body_tr = EXCLUDED.body_tr,
  variables = EXCLUDED.variables,
  variables_meta = EXCLUDED.variables_meta;