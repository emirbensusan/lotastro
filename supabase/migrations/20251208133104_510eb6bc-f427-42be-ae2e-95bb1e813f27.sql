-- Insert email_sender setting with initial value
INSERT INTO public.email_settings (setting_key, setting_value, description)
VALUES (
  'email_sender',
  '{"name": "LotAstro", "email": "info@lotastro.com"}'::jsonb,
  'Sender name and email address for outgoing emails'
)
ON CONFLICT (setting_key) DO NOTHING;