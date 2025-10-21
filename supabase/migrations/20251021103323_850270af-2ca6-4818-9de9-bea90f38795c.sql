-- Add 'incoming_stock' to audit_entity_type enum
ALTER TYPE audit_entity_type ADD VALUE IF NOT EXISTS 'incoming_stock';