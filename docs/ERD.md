# LotAstro WMS - Entity Relationship Diagram

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Database**: PostgreSQL 15.x via Supabase

---

## Overview

This document defines the complete database schema for LotAstro WMS, including entity relationships, column definitions, constraints, and indexes.

---

## 1. High-Level ERD

### Entity Clusters

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER MANAGEMENT                                 │
│  ┌──────────┐   ┌─────────────┐   ┌─────────────────┐   ┌─────────────┐ │
│  │ profiles │───│ user_roles  │───│role_permissions │   │user_invites │ │
│  └──────────┘   └─────────────┘   └─────────────────┘   └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           INVENTORY CORE                                  │
│  ┌──────────┐   ┌─────────┐   ┌───────────┐   ┌─────────────────────┐   │
│  │suppliers │───│  lots   │───│   rolls   │   │lot_queue (staging) │   │
│  └──────────┘   └─────────┘   └───────────┘   └─────────────────────┘   │
│        │              │                                                   │
│        ▼              ▼                                                   │
│  ┌──────────┐   ┌───────────────┐   ┌───────────────┐                   │
│  │qualities │───│quality_colors │───│quality_aliases│                   │
│  └──────────┘   └───────────────┘   └───────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORDER MANAGEMENT                                │
│  ┌──────────┐   ┌───────────┐   ┌─────────────┐   ┌──────────────┐      │
│  │  orders  │───│order_lots │   │ order_queue │   │ order_shares │      │
│  └──────────┘   └───────────┘   └─────────────┘   └──────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        MANUFACTURING & INCOMING                           │
│  ┌─────────────────────┐   ┌──────────────────┐   ┌─────────────────┐   │
│  │manufacturing_orders │───│mo_status_history │   │ incoming_stock  │   │
│  └─────────────────────┘   └──────────────────┘   └─────────────────┘   │
│                                                            │             │
│                                                            ▼             │
│                                                   ┌──────────────────┐   │
│                                                   │goods_in_receipts │   │
│                                                   └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            RESERVATIONS                                   │
│  ┌─────────────┐   ┌──────────────────┐                                  │
│  │reservations │───│reservation_lines │                                  │
│  └─────────────┘   └──────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             CATALOG                                       │
│  ┌───────────────┐   ┌──────────────────────┐   ┌────────────────────┐  │
│  │ catalog_items │───│catalog_item_suppliers│   │catalog_custom_*    │  │
│  └───────────────┘   └──────────────────────┘   └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            FORECASTING                                    │
│  ┌─────────────────────┐   ┌────────────────┐   ┌─────────────────────┐ │
│  │forecast_settings_*  │   │ forecast_runs  │───│  forecast_results   │ │
│  └─────────────────────┘   └────────────────┘   └─────────────────────┘ │
│                                    │                                      │
│                                    ▼                                      │
│                            ┌───────────────┐   ┌────────────────────────┐│
│                            │forecast_alerts│   │purchase_recommendations││
│                            └───────────────┘   └────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           STOCK TAKE                                      │
│  ┌────────────────┐   ┌─────────────┐   ┌───────────┐                    │
│  │ count_sessions │───│ count_rolls │   │  ocr_jobs │                    │
│  └────────────────┘   └─────────────┘   └───────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             SYSTEM                                        │
│  ┌────────────┐   ┌─────────────────┐   ┌─────────────────────────────┐ │
│  │ audit_logs │   │ email_templates │───│email_* (logs, schedules...) │ │
│  └────────────┘   └─────────────────┘   └─────────────────────────────┘ │
│                                                                           │
│  ┌────────────┐   ┌─────────────────┐   ┌─────────────────────────────┐ │
│  │ po_drafts  │───│ po_draft_lines  │   │         ai_usage            │ │
│  └────────────┘   └─────────────────┘   └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Management Tables

### profiles

Core user profile data.

```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'warehouse_staff',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ  -- Soft delete
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### user_roles

Multiple roles per user (future extensibility).

```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

### role_permissions

Permission definitions per role.

```sql
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role user_role NOT NULL,
    permission_category TEXT NOT NULL,
    permission_action TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(role, permission_category, permission_action)
);

CREATE INDEX idx_role_permissions_role ON role_permissions(role);
```

### user_invitations

Pending user invitations.

```sql
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'warehouse_staff',
    invited_by UUID NOT NULL REFERENCES profiles(user_id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    invite_link TEXT,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    email_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
```

---

## 3. Inventory Core Tables

### suppliers

Supplier master data.

```sql
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);
```

### qualities

Quality/fabric type definitions.

```sql
CREATE TABLE public.qualities (
    code TEXT PRIMARY KEY,
    unit TEXT NOT NULL DEFAULT 'meters',
    aliases TEXT[],
    low_stock_threshold_meters NUMERIC,
    critical_stock_threshold_meters NUMERIC,
    alerts_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### quality_colors

Color definitions per quality.

```sql
CREATE TABLE public.quality_colors (
    quality_code TEXT NOT NULL REFERENCES qualities(code) ON DELETE CASCADE,
    color_label TEXT NOT NULL,
    color_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (quality_code, color_label)
);

CREATE INDEX idx_quality_colors_quality ON quality_colors(quality_code);
```

### lots

Inventory lots (batches).

```sql
CREATE TABLE public.lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number TEXT NOT NULL UNIQUE,
    quality TEXT NOT NULL,
    color TEXT NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    meters NUMERIC NOT NULL DEFAULT 0,
    reserved_meters NUMERIC NOT NULL DEFAULT 0,
    roll_count INTEGER NOT NULL DEFAULT 0,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    production_date DATE,
    invoice_number TEXT,
    invoice_date DATE,
    warehouse_location TEXT,
    notes TEXT,
    qr_code_url TEXT,
    status stock_status NOT NULL DEFAULT 'available',
    catalog_item_id UUID REFERENCES catalog_items(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lots_quality_color ON lots(quality, color);
CREATE INDEX idx_lots_supplier ON lots(supplier_id);
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_lot_number ON lots(lot_number);
```

### rolls

Individual rolls within lots.

```sql
CREATE TABLE public.rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
    roll_number INTEGER NOT NULL,
    meters NUMERIC NOT NULL,
    status roll_status NOT NULL DEFAULT 'available',
    qr_code_url TEXT,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(lot_id, roll_number)
);

CREATE INDEX idx_rolls_lot ON rolls(lot_id);
CREATE INDEX idx_rolls_status ON rolls(status);
```

---

## 4. Order Management Tables

### orders

Customer orders.

```sql
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE DEFAULT generate_order_number(),
    customer_name TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(user_id),
    fulfilled_at TIMESTAMPTZ,
    fulfilled_by UUID REFERENCES profiles(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON orders(customer_name);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created_by ON orders(created_by);
```

### order_lots

Order line items.

```sql
CREATE TABLE public.order_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    lot_id UUID NOT NULL REFERENCES lots(id),
    quality TEXT NOT NULL,
    color TEXT NOT NULL,
    roll_count INTEGER NOT NULL,
    selected_roll_ids TEXT,  -- JSON array of roll IDs
    selected_roll_meters TEXT,  -- JSON array of meters
    line_type order_line_type NOT NULL DEFAULT 'wholesale',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_lots_order ON order_lots(order_id);
CREATE INDEX idx_order_lots_lot ON order_lots(lot_id);
```

### order_queue

Order approval workflow.

```sql
CREATE TABLE public.order_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES profiles(user_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES profiles(user_id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_queue_status ON order_queue(status);
CREATE INDEX idx_order_queue_submitted_by ON order_queue(submitted_by);
```

---

## 5. Manufacturing & Incoming Tables

### manufacturing_orders

Production orders to suppliers.

```sql
CREATE TABLE public.manufacturing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mo_number TEXT NOT NULL UNIQUE DEFAULT generate_mo_number(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    quality TEXT NOT NULL,
    color TEXT NOT NULL,
    ordered_amount NUMERIC NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_completion_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    supplier_confirmation_number TEXT,
    notes TEXT,
    customer_name TEXT,
    customer_agreed_date DATE,
    is_customer_order BOOLEAN DEFAULT false,
    price_per_meter NUMERIC,
    currency TEXT DEFAULT 'TRY',
    catalog_item_id UUID REFERENCES catalog_items(id),
    reservation_id UUID REFERENCES reservations(id),
    incoming_stock_id UUID REFERENCES incoming_stock(id),
    created_by UUID NOT NULL REFERENCES profiles(user_id),
    updated_by UUID REFERENCES profiles(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mo_supplier ON manufacturing_orders(supplier_id);
CREATE INDEX idx_mo_status ON manufacturing_orders(status);
CREATE INDEX idx_mo_quality_color ON manufacturing_orders(quality, color);
```

### mo_status_history

Status change log for MOs.

```sql
CREATE TABLE public.mo_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturing_order_id UUID NOT NULL REFERENCES manufacturing_orders(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID NOT NULL REFERENCES profiles(user_id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mo_history_mo ON mo_status_history(manufacturing_order_id);
```

### incoming_stock

Expected deliveries.

```sql
CREATE TABLE public.incoming_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    quality TEXT NOT NULL,
    color TEXT NOT NULL,
    expected_meters NUMERIC NOT NULL,
    received_meters NUMERIC NOT NULL DEFAULT 0,
    reserved_meters NUMERIC NOT NULL DEFAULT 0,
    expected_arrival_date DATE,
    invoice_number TEXT,
    invoice_date DATE,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    catalog_item_id UUID REFERENCES catalog_items(id),
    created_by UUID NOT NULL REFERENCES profiles(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incoming_supplier ON incoming_stock(supplier_id);
CREATE INDEX idx_incoming_status ON incoming_stock(status);
```

---

## 6. Reservation Tables

### reservations

Stock reservations for customers.

```sql
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number TEXT NOT NULL UNIQUE DEFAULT generate_reservation_number(),
    customer_name TEXT NOT NULL,
    customer_id UUID,
    reserved_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hold_until DATE,
    status reservation_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(user_id),
    canceled_by UUID REFERENCES profiles(user_id),
    canceled_at TIMESTAMPTZ,
    cancel_reason cancel_reason_type,
    cancel_other_text TEXT,
    converted_by UUID REFERENCES profiles(user_id),
    converted_at TIMESTAMPTZ,
    convert_reason convert_reason_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer ON reservations(customer_name);
```

### reservation_lines

Reserved items per reservation.

```sql
CREATE TABLE public.reservation_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    lot_id UUID REFERENCES lots(id),
    incoming_stock_id UUID REFERENCES incoming_stock(id),
    quality TEXT NOT NULL,
    color TEXT NOT NULL,
    reserved_meters NUMERIC NOT NULL,
    roll_ids TEXT,  -- JSON array of roll IDs
    scope TEXT NOT NULL DEFAULT 'stock' CHECK (scope IN ('stock', 'incoming')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_res_lines_reservation ON reservation_lines(reservation_id);
CREATE INDEX idx_res_lines_lot ON reservation_lines(lot_id);
```

---

## 7. Catalog Tables

### catalog_items

Product catalog entries.

```sql
CREATE TABLE public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lastro_sku_code TEXT NOT NULL UNIQUE DEFAULT generate_lastro_sku_code(),
    logo_sku_code TEXT,
    code TEXT NOT NULL,  -- Quality code
    color_name TEXT NOT NULL,
    type catalog_item_type NOT NULL DEFAULT 'lining',
    status catalog_item_status NOT NULL DEFAULT 'pending_approval',
    is_active BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    fabric_type TEXT,
    weaving_knitted TEXT,
    composition JSONB DEFAULT '[]',
    weight_g_m2 NUMERIC,
    produced_unit catalog_unit DEFAULT 'meters',
    sold_unit catalog_unit DEFAULT 'meters',
    eu_origin BOOLEAN DEFAULT false,
    dyeing_batch_size NUMERIC,
    care_instructions TEXT,
    product_notes TEXT,
    sustainable_notes TEXT,
    suppliers TEXT,
    photo_of_design_url TEXT,
    shade_range_image_url TEXT,
    spec_sheet_url TEXT,
    spec_sheet_file TEXT,
    test_report_url TEXT,
    test_report_file TEXT,
    extra_attributes JSONB DEFAULT '{}',
    last_update_date DATE,
    last_inbound_date DATE,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_code_color ON catalog_items(code, color_name);
CREATE INDEX idx_catalog_status ON catalog_items(status);
CREATE INDEX idx_catalog_type ON catalog_items(type);
```

---

## 8. Forecasting Tables

### forecast_settings_global

Global forecast configuration.

```sql
CREATE TABLE public.forecast_settings_global (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_window_months INTEGER NOT NULL DEFAULT 12,
    forecast_horizon_months INTEGER NOT NULL DEFAULT 3,
    time_bucket TEXT NOT NULL DEFAULT 'month',
    weighting_method TEXT NOT NULL DEFAULT 'weighted_average',
    normalization_type TEXT NOT NULL DEFAULT 'calendar_month',
    outlier_percentile NUMERIC NOT NULL DEFAULT 95,
    min_order_zero_history INTEGER NOT NULL DEFAULT 3,
    default_safety_stock_mode TEXT NOT NULL DEFAULT 'weeks',
    default_safety_stock_weeks INTEGER NOT NULL DEFAULT 2,
    stockout_alert_days INTEGER NOT NULL DEFAULT 30,
    overstock_alert_months NUMERIC NOT NULL DEFAULT 6,
    scenario_parameters JSONB NOT NULL DEFAULT '{}',
    demand_statuses JSONB NOT NULL DEFAULT '[]',
    permissions JSONB NOT NULL DEFAULT '{}',
    weekly_schedule_enabled BOOLEAN NOT NULL DEFAULT false,
    weekly_schedule_day INTEGER NOT NULL DEFAULT 1,
    weekly_schedule_hour INTEGER NOT NULL DEFAULT 8,
    weekly_schedule_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    email_digest_enabled BOOLEAN NOT NULL DEFAULT false,
    email_digest_day INTEGER NOT NULL DEFAULT 1,
    email_digest_hour INTEGER NOT NULL DEFAULT 9,
    email_digest_recipients JSONB NOT NULL DEFAULT '[]',
    override_row_tint_color TEXT NOT NULL DEFAULT '#fef9c3',
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### forecast_runs

Forecast execution log.

```sql
CREATE TABLE public.forecast_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    triggered_by UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,
    error_message TEXT,
    affected_qualities JSONB,
    total_combinations INTEGER DEFAULT 0,
    processed_combinations INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_runs_status ON forecast_runs(status);
CREATE INDEX idx_forecast_runs_started ON forecast_runs(started_at DESC);
```

### forecast_results

Cached forecast data.

```sql
CREATE TABLE public.forecast_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
    quality_code TEXT NOT NULL,
    color_code TEXT NOT NULL,
    unit TEXT NOT NULL,
    scenario TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    forecast_amount NUMERIC NOT NULL,
    historical_avg NUMERIC,
    weighted_avg NUMERIC,
    trend_factor NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forecast_results_run ON forecast_results(run_id);
CREATE INDEX idx_forecast_results_quality_color ON forecast_results(quality_code, color_code);
```

---

## 9. Stock Take Tables

### count_sessions

Stock take counting sessions.

```sql
CREATE TABLE public.count_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number TEXT NOT NULL UNIQUE,
    started_by UUID NOT NULL REFERENCES profiles(user_id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status stock_take_session_status NOT NULL DEFAULT 'draft',
    completed_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID,
    reconciled_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    notes TEXT,
    total_rolls_counted INTEGER NOT NULL DEFAULT 0,
    rolls_approved INTEGER NOT NULL DEFAULT 0,
    rolls_rejected INTEGER NOT NULL DEFAULT 0,
    rolls_pending_review INTEGER NOT NULL DEFAULT 0,
    rolls_recount_requested INTEGER NOT NULL DEFAULT 0,
    ocr_high_confidence_count INTEGER NOT NULL DEFAULT 0,
    ocr_medium_confidence_count INTEGER NOT NULL DEFAULT 0,
    ocr_low_confidence_count INTEGER NOT NULL DEFAULT 0,
    manual_entry_count INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_count_sessions_status ON count_sessions(status);
CREATE INDEX idx_count_sessions_started_by ON count_sessions(started_by);
```

### count_rolls

Individual roll counts within a session.

```sql
CREATE TABLE public.count_rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
    capture_sequence INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    photo_hash_sha256 TEXT NOT NULL,
    photo_hash_perceptual TEXT,
    -- Counter-provided values
    counter_quality TEXT NOT NULL,
    counter_color TEXT NOT NULL,
    counter_lot_number TEXT NOT NULL,
    counter_meters NUMERIC NOT NULL,
    counter_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- OCR-extracted values
    ocr_quality TEXT,
    ocr_color TEXT,
    ocr_lot_number TEXT,
    ocr_meters NUMERIC,
    ocr_raw_text TEXT,
    ocr_status TEXT DEFAULT 'pending',
    ocr_processed_at TIMESTAMPTZ,
    ocr_confidence_score NUMERIC,
    ocr_confidence_level stock_take_confidence_level,
    -- Admin review values
    admin_quality TEXT,
    admin_color TEXT,
    admin_lot_number TEXT,
    admin_meters NUMERIC,
    admin_notes TEXT,
    -- Metadata
    status stock_take_roll_status NOT NULL DEFAULT 'pending_review',
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    is_possible_duplicate BOOLEAN NOT NULL DEFAULT false,
    is_not_label_warning BOOLEAN NOT NULL DEFAULT false,
    duplicate_of_roll_id UUID REFERENCES count_rolls(id),
    original_roll_id UUID REFERENCES count_rolls(id),
    recount_version INTEGER NOT NULL DEFAULT 1,
    recount_reason TEXT,
    fields_manually_edited TEXT[],
    manual_edit_reason stock_take_edit_reason,
    manual_edit_reason_other TEXT,
    captured_by UUID NOT NULL REFERENCES profiles(user_id),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_count_rolls_session ON count_rolls(session_id);
CREATE INDEX idx_count_rolls_status ON count_rolls(status);
```

---

## 10. System Tables

### audit_logs

Centralized audit trail.

```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type audit_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    entity_identifier TEXT,
    action audit_action_type NOT NULL,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    user_role TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_fields JSONB,
    notes TEXT,
    is_reversed BOOLEAN DEFAULT false,
    reversed_at TIMESTAMPTZ,
    reversed_by UUID,
    reversal_audit_id UUID REFERENCES audit_logs(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### email_templates

Email template definitions.

```sql
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'system',
    subject_en TEXT NOT NULL,
    subject_tr TEXT NOT NULL,
    body_en TEXT NOT NULL,
    body_tr TEXT NOT NULL,
    default_subject_en TEXT,
    default_subject_tr TEXT,
    default_body_en TEXT,
    default_body_tr TEXT,
    variables TEXT[],
    variables_meta JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    is_digest BOOLEAN DEFAULT false,
    version INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 5,
    retry_config JSONB DEFAULT '{"max_retries": 3, "backoff_seconds": [60, 300, 900]}',
    send_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_templates_key ON email_templates(template_key);
CREATE INDEX idx_email_templates_category ON email_templates(category);
```

---

## 11. Database Enums

```sql
-- User roles
CREATE TYPE user_role AS ENUM ('warehouse_staff', 'accounting', 'senior_manager', 'admin');

-- Stock status
CREATE TYPE stock_status AS ENUM ('available', 'reserved', 'sold', 'depleted');

-- Roll status
CREATE TYPE roll_status AS ENUM ('available', 'reserved', 'sold', 'defective');

-- Order line type
CREATE TYPE order_line_type AS ENUM ('wholesale', 'retail', 'sample');

-- Reservation status
CREATE TYPE reservation_status AS ENUM ('active', 'converted', 'cancelled', 'expired');

-- Cancel reason type
CREATE TYPE cancel_reason_type AS ENUM ('customer_cancelled', 'stock_unavailable', 'price_issue', 'other');

-- Convert reason type
CREATE TYPE convert_reason_type AS ENUM ('customer_confirmed', 'partial_delivery', 'other');

-- Catalog item type
CREATE TYPE catalog_item_type AS ENUM ('lining', 'outer_fabric', 'accessory');

-- Catalog item status
CREATE TYPE catalog_item_status AS ENUM ('pending_approval', 'approved', 'rejected', 'archived');

-- Catalog unit
CREATE TYPE catalog_unit AS ENUM ('meters', 'pieces', 'kilograms');

-- Stock take session status
CREATE TYPE stock_take_session_status AS ENUM ('draft', 'active', 'submitted', 'under_review', 'reconciled', 'closed', 'cancelled');

-- Stock take roll status
CREATE TYPE stock_take_roll_status AS ENUM ('pending_review', 'approved', 'rejected', 'recount_requested');

-- Stock take confidence level
CREATE TYPE stock_take_confidence_level AS ENUM ('high', 'medium', 'low');

-- Stock take edit reason
CREATE TYPE stock_take_edit_reason AS ENUM ('ocr_error', 'label_damaged', 'label_missing', 'other');

-- Audit entity type
CREATE TYPE audit_entity_type AS ENUM ('lot', 'roll', 'order', 'reservation', 'manufacturing_order', 'incoming_stock', 'catalog_item', 'user', 'settings');

-- Audit action type
CREATE TYPE audit_action_type AS ENUM ('create', 'update', 'delete', 'approve', 'reject', 'cancel', 'convert', 'reverse');
```

---

## 12. Database Functions

### Role Management

```sql
-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = _user_id
$$;
```

### Number Generation

```sql
-- Generate order number (ORD-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    today_count INTEGER;
    new_number TEXT;
BEGIN
    SELECT COUNT(*) + 1 INTO today_count
    FROM orders
    WHERE DATE(created_at) = CURRENT_DATE;
    
    new_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(today_count::TEXT, 4, '0');
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Generate reservation number (RES-XXXXXX)
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'RES-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- Generate MO number (MO-YYYYMMDD-XXXX)
CREATE OR REPLACE FUNCTION generate_mo_number()
RETURNS TEXT AS $$
DECLARE
    today_count INTEGER;
BEGIN
    SELECT COUNT(*) + 1 INTO today_count
    FROM manufacturing_orders
    WHERE DATE(created_at) = CURRENT_DATE;
    
    RETURN 'MO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(today_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

### Dashboard Statistics

```sql
-- Get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_lots', (SELECT COUNT(*) FROM lots WHERE status != 'depleted'),
        'total_meters', (SELECT COALESCE(SUM(meters - reserved_meters), 0) FROM lots WHERE status != 'depleted'),
        'pending_orders', (SELECT COUNT(*) FROM order_queue WHERE status = 'pending'),
        'active_reservations', (SELECT COUNT(*) FROM reservations WHERE status = 'active'),
        'open_manufacturing_orders', (SELECT COUNT(*) FROM manufacturing_orders WHERE status NOT IN ('completed', 'cancelled')),
        'low_stock_alerts', (SELECT COUNT(*) FROM forecast_alerts WHERE is_resolved = false)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 13. Indexes Summary

### Critical Performance Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| profiles | idx_profiles_user_id | user_id | Auth lookup |
| lots | idx_lots_quality_color | quality, color | Inventory queries |
| rolls | idx_rolls_lot | lot_id | Roll retrieval |
| orders | idx_orders_customer | customer_name | Customer search |
| audit_logs | idx_audit_logs_entity | entity_type, entity_id | Audit retrieval |
| count_rolls | idx_count_rolls_session | session_id | Stock take queries |

---

## 14. Data Retention

| Data Type | Retention Period | Archival Strategy |
|-----------|------------------|-------------------|
| Audit logs | 7 years | Partition by year |
| Order history | Indefinite | Archive after 3 years |
| Stock take data | 2 years | Archive after close |
| Email logs | 1 year | Delete after |
| AI usage logs | 6 months | Aggregate then delete |
| Session data | 30 days | Auto-cleanup |
