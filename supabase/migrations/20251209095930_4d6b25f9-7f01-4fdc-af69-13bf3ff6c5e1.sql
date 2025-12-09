-- Add 'forecast_settings' to audit_entity_type enum
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'forecast_settings';