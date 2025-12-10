# LotAstro Application Context File

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Maintainer**: LotAstro Development Team

---

## 1. Purpose of This Context File

This file defines **security rules**, **architecture principles**, **backend integration requirements**, and **application-wide standards** for the LotAstro ecosystem.

### Enforcement Requirements

- **Any future AI agent MUST read, respect, and enforce these rules**
- This ensures consistency across all LotAstro applications:
  - Warehouse Management System (current)
  - CRM Module (planned)
  - Wiki/Knowledge Base (planned)
  - Customer Portal (planned)
  - Agreements Module (planned)
- **Violations of security rules MUST be rejected**
- **All new code MUST follow established patterns**

### Document Structure

| Section | Purpose |
|---------|---------|
| Architecture | System design and technology stack |
| Security | Security foundations and requirements |
| Authentication | Auth system implementation |
| User Management | User lifecycle and administration |
| Email System | Automated email architecture |
| Permissions | RBAC system and enforcement |
| Backend Contract | Edge Function patterns and API contracts |
| Database | Schema overview and conventions |
| Storage | File storage architecture |
| i18n | Internationalization system |
| AI Safety | AI-specific security requirements |
| Agent Instructions | Rules for future AI agents |

---

## 2. Architecture Overview

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React | 18.3.1 |
| **Build Tool** | Vite | Latest |
| **Language** | TypeScript | Strict mode |
| **Styling** | Tailwind CSS | 3.x |
| **UI Components** | shadcn/ui | Slate theme |
| **Icons** | Lucide React | 0.462.0 |
| **State Management** | React Context + TanStack Query | 5.x |
| **Routing** | React Router DOM | 6.30.1 |
| **Backend** | Supabase | Latest |
| **Database** | PostgreSQL | 15.x |
| **Edge Functions** | Deno | Latest |
| **Email Provider** | Resend | 4.0.0 |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React 18 + Vite + TypeScript + Tailwind + shadcn/ui            │
├─────────────────────────────────────────────────────────────────┤
│                    SUPABASE CLIENT                               │
│  @supabase/supabase-js (handles all API communication)          │
├─────────────────────────────────────────────────────────────────┤
│                      SUPABASE BACKEND                            │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │    Auth      │   Database   │   Storage    │Edge Functions│  │
│  │  (JWT/SSO)   │ (PostgreSQL) │   (S3-like)  │   (Deno)     │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Structure

| Environment | Domain | Purpose |
|-------------|--------|---------|
| Development | localhost:8080 | Local development |
| Staging | *.lovableproject.com | Preview deployments |
| Production | depo.lotastro.com | Live production |

### Project Identifiers

```typescript
// Supabase Project Configuration
const SUPABASE_PROJECT_ID = 'kwcwbyfzzordqwudixvl';
const SUPABASE_URL = 'https://kwcwbyfzzordqwudixvl.supabase.co';
```

### Folder Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components (52 components)
│   ├── catalog/        # Catalog-specific components
│   ├── email/          # Email template components
│   └── forecast/       # Forecasting components
├── contexts/           # React Context providers
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/       # Supabase client & types
├── pages/              # Route page components
├── utils/              # Utility functions
└── lib/                # Library utilities

supabase/
├── config.toml         # Supabase configuration
└── functions/          # Edge Functions (20 functions)
    ├── _shared/        # Shared utilities
    └── [function-name]/
        └── index.ts    # Function entry point
```

---

## 3. Security Foundations

### Core Security Principles

| Principle | Implementation |
|-----------|----------------|
| **No secrets on frontend** | All sensitive operations via Edge Functions |
| **Input validation** | Zod schemas for all user inputs |
| **XSS prevention** | Never use `dangerouslySetInnerHTML` with user content |
| **SQL injection prevention** | Supabase client parameterized queries only |
| **RLS enforcement** | 100% table coverage with Row Level Security |
| **Generic errors** | Never expose internal error details to users |
| **HTTPS only** | All communications encrypted |

### Input Validation Requirements

```typescript
// REQUIRED: All user inputs MUST be validated with Zod
import { z } from 'zod';

// Example schema
const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(1000),
});

// NEVER trust user input directly
// ALWAYS validate before processing
```

### Sensitive Data Classification

| Classification | Examples | Handling |
|----------------|----------|----------|
| **Critical** | Passwords, API keys, tokens | Never stored in frontend, never logged |
| **Sensitive** | Email, phone, personal info | Encrypted at rest, access logged |
| **Internal** | User IDs, order numbers | Protected by RLS, not publicly exposed |
| **Public** | Product names, catalog images | Can be displayed without restrictions |

### Security Checklist for New Features

- [ ] All inputs validated with Zod schemas
- [ ] RLS policies created for new tables
- [ ] No sensitive data in console logs
- [ ] Error messages are generic (no stack traces)
- [ ] Edge Functions validate authentication
- [ ] CORS headers properly configured
- [ ] No hardcoded secrets in code

### CRON Endpoint Protection

```typescript
// ALL scheduled endpoints MUST validate CRON_SECRET
const cronSecret = Deno.env.get('CRON_SECRET');
const requestSecret = req.headers.get('x-cron-secret');

if (!cronSecret) {
  return new Response(
    JSON.stringify({ error: 'CRON_SECRET not configured' }),
    { status: 503 }
  );
}

if (requestSecret !== cronSecret) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401 }
  );
}
```

---

## 4. Authentication System

### Authentication Provider

LotAstro uses **Supabase Auth** with the following configuration:

| Feature | Implementation |
|---------|----------------|
| **Token Type** | JWT (JSON Web Tokens) |
| **Token Storage** | Supabase SDK handles automatically |
| **Session Refresh** | Automatic via Supabase client |
| **Password Hashing** | bcrypt (handled by Supabase) |
| **Email Verification** | Via Supabase Auth emails |

### Auth States

```typescript
type AuthState = 
  | 'loading'           // Checking session
  | 'authenticated'     // Valid session exists
  | 'unauthenticated'   // No session
  | 'error';            // Auth error occurred
```

### Authentication Hook

```typescript
// src/hooks/useAuth.tsx
interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}
```

### Profile Auto-Creation

When a new user signs up, the `handle_new_user()` database trigger automatically:

1. Creates a profile record in `public.profiles`
2. Creates a role record in `public.user_roles`
3. Assigns role from invitation (if exists) or defaults to `warehouse_staff`
4. Marks invitation as accepted

### Session Management

```typescript
// Session expiration: Handled by Supabase (default 1 week)
// Refresh: Automatic when token expires
// Logout: Clears all session data

const { error } = await supabase.auth.signOut();
```

### Password Reset Flow

1. User requests reset via `/reset-password`
2. Supabase sends reset email with magic link
3. User clicks link, enters new password
4. Supabase validates token and updates password
5. User redirected to login

---

## 5. User Management

### User Schema

```typescript
// profiles table
interface Profile {
  id: string;           // UUID primary key
  user_id: string;      // References auth.users.id
  email: string;        // User's email
  full_name: string | null;
  role: UserRole;       // Enum: user_role
  active: boolean;      // Account status
  created_at: string;
  updated_at: string;
  deleted_at: string | null;  // Soft delete timestamp
}

// user_roles table (for multiple roles per user)
interface UserRole {
  user_id: string;
  role: UserRole;
  created_at: string;
}
```

### User Roles

| Role | Description | Typical Permissions |
|------|-------------|---------------------|
| `warehouse_staff` | Floor workers | Inventory view, lot intake, QR scan |
| `accounting` | Finance team | Orders, invoices, reports, catalog edit |
| `senior_manager` | Management | All operations, approvals, forecasting |
| `admin` | System admin | Full access, user management, settings |

### User Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   INVITED   │ ──▶ │   PENDING   │ ──▶ │   ACTIVE    │
│  (email)    │     │  (signup)   │     │  (verified) │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐            │
                    │ DEACTIVATED │ ◀──────────┤
                    │  (soft)     │            │
                    └─────────────┘            ▼
                                        ┌─────────────┐
                                        │   DELETED   │
                                        │   (hard)    │
                                        └─────────────┘
```

### User Statuses

| Status | `active` | `deleted_at` | Can Login |
|--------|----------|--------------|-----------|
| Active | true | null | Yes |
| Deactivated | false | null | No |
| Deleted | false | timestamp | No |

### Invitation System

```typescript
// user_invitations table
interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;        // Admin who invited
  invited_at: string;
  expires_at: string;        // Default: 7 days
  status: 'pending' | 'accepted' | 'expired';
  invite_link: string | null;
  email_sent: boolean;
  email_error: string | null;
}
```

### Admin Functions (Edge Functions)

| Function | Purpose |
|----------|---------|
| `admin-change-password` | Change user's password |
| `admin-deactivate-user` | Soft-disable user account |
| `admin-delete-user` | Hard-delete user and data |
| `admin-reconcile-users` | Sync auth.users with profiles |
| `send-invitation` | Send invite email to new user |

---

## 6. Email System

### Email Provider

| Provider | Package | Free Tier |
|----------|---------|-----------|
| **Resend** | `npm:resend@4.0.0` | 3,000 emails/month |

### Configuration

```typescript
// Required secrets
RESEND_API_KEY  // Resend API key

// Email sender (stored in email_settings table)
{
  "name": "LotAstro",
  "email": "info@depo.lotastro.com"
}
```

### Verified Domain

| Domain | Status |
|--------|--------|
| `depo.lotastro.com` | ✅ Verified |

> **Important**: Sender email MUST use verified domain (e.g., `info@depo.lotastro.com`)

### Email Templates

```typescript
// email_templates table
interface EmailTemplate {
  id: string;
  template_key: string;       // Unique identifier
  name: string;               // Display name
  category: string | null;    // manufacturing_orders, reservations, etc.
  subject_en: string;
  subject_tr: string;
  body_en: string;            // HTML content
  body_tr: string;
  variables: string[];        // Available template variables
  variables_meta: Json;       // Variable descriptions
  is_active: boolean;
  is_system: boolean;         // System templates can't be deleted
  version: number;
  created_at: string;
  updated_at: string;
}
```

### Template Variables

```typescript
// Manufacturing Order variables
const moVariables = {
  '{quality}': 'Quality code',
  '{color}': 'Color name',
  '{ordered_meters}': 'Ordered amount',
  '{supplier}': 'Supplier name',
  '{eta}': 'Expected completion date',
  '{status}': 'Current status',
  '{mo_number}': 'MO reference number',
};
```

### Email Events

| Event | Trigger | Template |
|-------|---------|----------|
| MO Reminder | Scheduled (Thursday) | `mo_reminder` |
| MO Overdue | Daily check | `mo_overdue` |
| Weekly Summary | Scheduled | `mo_weekly_summary` |
| User Invitation | Admin action | `user_invitation` |
| Password Reset | User request | Supabase built-in |

### Edge Functions

| Function | Purpose |
|----------|---------|
| `send-mo-reminders` | Scheduled MO reminder emails |
| `send-test-email` | Test email template |
| `send-invitation` | User invitation emails |

---

## 7. Permissions & RBAC System

### Permission Structure

```typescript
// role_permissions table
interface RolePermission {
  id: string;
  role: UserRole;
  permission_category: string;  // e.g., 'inventory', 'orders'
  permission_action: string;    // e.g., 'view', 'create', 'delete'
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}
```

### Permission Categories

| Category | Description |
|----------|-------------|
| `inventory` | Lot and roll management |
| `orders` | Order creation and fulfillment |
| `reservations` | Stock reservations |
| `manufacturing` | Manufacturing orders |
| `catalog` | Product catalog management |
| `incoming` | Incoming stock management |
| `approvals` | Approval queue access |
| `admin` | System administration |
| `reports` | Report generation |
| `audit` | Audit log access |
| `forecasts` | Forecasting module |

### Permission Matrix

| Category | Action | warehouse_staff | accounting | senior_manager | admin |
|----------|--------|:---------------:|:----------:|:--------------:|:-----:|
| inventory | view | ✅ | ✅ | ✅ | ✅ |
| inventory | editlot | ✅ | ❌ | ✅ | ✅ |
| inventory | delete | ❌ | ❌ | ✅ | ✅ |
| orders | view | ✅ | ✅ | ✅ | ✅ |
| orders | create | ✅ | ✅ | ✅ | ✅ |
| orders | approve | ❌ | ❌ | ✅ | ✅ |
| reservations | view | ✅ | ✅ | ✅ | ✅ |
| reservations | create | ✅ | ✅ | ✅ | ✅ |
| reservations | cancel | ❌ | ✅ | ✅ | ✅ |
| manufacturing | view | ✅ | ✅ | ✅ | ✅ |
| manufacturing | create | ❌ | ✅ | ✅ | ✅ |
| manufacturing | edit | ❌ | ✅ | ✅ | ✅ |
| catalog | view | ✅ | ✅ | ✅ | ✅ |
| catalog | create | ❌ | ✅ | ✅ | ✅ |
| catalog | approve | ❌ | ❌ | ✅ | ✅ |
| approvals | viewapprovals | ❌ | ❌ | ✅ | ✅ |
| approvals | approve | ❌ | ❌ | ✅ | ✅ |
| admin | viewusers | ❌ | ❌ | ❌ | ✅ |
| admin | manageusers | ❌ | ❌ | ❌ | ✅ |
| admin | settings | ❌ | ❌ | ❌ | ✅ |
| forecasts | view | ❌ | ❌ | ✅ | ✅ |
| forecasts | run | ❌ | ❌ | ✅ | ✅ |
| forecasts | modify | ❌ | ❌ | ❌ | ✅ |

### Frontend Permission Enforcement

```typescript
// src/hooks/usePermissions.tsx
const { hasPermission, loading } = usePermissions();

// Usage in components
if (!hasPermission('orders', 'create')) {
  return <AccessDenied />;
}

// Admin bypass (unless using View As Role)
if (profile?.role === 'admin' && !viewAsRole) {
  return true; // Admins have all permissions
}
```

### Backend Permission Enforcement

```sql
-- Database function for role checking
CREATE FUNCTION has_role(user_id uuid, required_role user_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = has_role.user_id
      AND ur.role = has_role.required_role
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Example RLS policy using has_role
CREATE POLICY "Admins can manage users"
ON profiles FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### View As Role (Admin Feature)

Admins can simulate other roles for testing:

```typescript
// ViewAsRoleContext
const { viewAsRole, setViewAsRole } = useViewAsRole();

// When viewAsRole is set, permissions use that role instead of admin
const effectiveRole = viewAsRole || profile?.role;
```

---

## 8. Backend Integration Contract

### Supabase Client Usage

```typescript
// ALWAYS use the configured client
import { supabase } from '@/integrations/supabase/client';

// NEVER create new clients or use raw fetch
// NEVER use VITE_* environment variables
```

### Edge Function Pattern

```typescript
// Standard Edge Function structure
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Business logic here...

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### API Response Formats

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
}

// Error response
interface ErrorResponse {
  error: string;
  details?: string;
  code?: string;
}
```

### Edge Function Registry

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `admin-change-password` | Change user password | Yes (admin) |
| `admin-deactivate-user` | Deactivate user | Yes (admin) |
| `admin-delete-user` | Delete user | Yes (admin) |
| `admin-reconcile-users` | Sync users | Yes (admin) |
| `autocomplete-colors` | Color suggestions | Yes |
| `autocomplete-qualities` | Quality suggestions | Yes |
| `cleanup-old-drafts` | Remove old drafts | CRON only |
| `confirm-draft` | Confirm PO draft | Yes |
| `extract-order` | AI order extraction | Yes |
| `forecast-engine` | Run forecasting | Yes |
| `forecast-import-history` | Import demand data | Yes |
| `migrate-catalog-items` | Data migration | Yes (admin) |
| `repair-audit-inconsistencies` | Fix audit data | Yes (admin) |
| `reverse-audit-action` | Undo audit action | Yes (admin) |
| `send-invitation` | Email invitation | Yes (admin) |
| `send-mo-reminders` | MO reminder emails | CRON only |
| `send-test-email` | Test email | Yes |
| `test-extraction` | Test AI extraction | Yes |
| `validate-extraction` | Validate extraction | Yes |

### Calling Edge Functions

```typescript
// From frontend - use supabase.functions.invoke
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: 'value1' },
});

// NEVER use raw fetch or axios for Edge Functions
// NEVER construct URLs manually
```

---

## 9. Database Schema

### Table Categories

#### User Management
| Table | Purpose |
|-------|---------|
| `profiles` | User profile data |
| `user_roles` | User role assignments |
| `user_invitations` | Pending invitations |
| `role_permissions` | Permission definitions |

#### Inventory Core
| Table | Purpose |
|-------|---------|
| `lots` | Inventory lots |
| `rolls` | Individual rolls within lots |
| `lot_queue` | Pending lot intake queue |
| `suppliers` | Supplier master data |
| `qualities` | Quality code definitions |
| `quality_colors` | Color definitions per quality |
| `quality_aliases` | Alternative quality names |

#### Catalog
| Table | Purpose |
|-------|---------|
| `catalog_items` | Product catalog entries |
| `catalog_item_suppliers` | Supplier associations |
| `catalog_custom_field_definitions` | Custom field schemas |
| `catalog_custom_field_values` | Custom field data |
| `catalog_item_audit_logs` | Catalog change history |
| `catalog_user_views` | Saved column views |
| `catalog_approval_settings` | Approval workflow config |

#### Orders
| Table | Purpose |
|-------|---------|
| `orders` | Customer orders |
| `order_lots` | Order line items |
| `order_queue` | Orders pending approval |

#### Manufacturing
| Table | Purpose |
|-------|---------|
| `manufacturing_orders` | Production orders |
| `mo_status_history` | Status change log |

#### Reservations
| Table | Purpose |
|-------|---------|
| `reservations` | Stock reservations |
| `reservation_lines` | Reserved items |

#### Incoming Stock
| Table | Purpose |
|-------|---------|
| `incoming_stock` | Expected deliveries |
| `goods_in_receipts` | Received goods |
| `goods_in_rows` | Receipt line items |

#### Forecasting
| Table | Purpose |
|-------|---------|
| `forecast_settings_global` | Global forecast config |
| `forecast_settings_per_quality` | Per-quality overrides |
| `demand_history` | Historical demand data |
| `forecast_runs` | Forecast execution log |
| `forecast_results` | Cached forecasts |
| `purchase_recommendations` | Purchase suggestions |
| `forecast_alerts` | Stock alerts |
| `forecast_settings_audit_log` | Settings change log |

#### AI/Drafts
| Table | Purpose |
|-------|---------|
| `po_drafts` | AI extraction drafts |
| `po_draft_lines` | Draft line items |
| `ai_usage` | AI token tracking |

#### System
| Table | Purpose |
|-------|---------|
| `audit_logs` | Centralized audit trail |
| `field_edit_queue` | Field edit approvals |
| `email_templates` | Email templates |
| `email_template_versions` | Template history |
| `email_template_usage` | Template associations |
| `email_settings` | Email configuration |

### Database Functions

| Function | Purpose |
|----------|---------|
| `has_role(user_id, role)` | Check user role |
| `get_user_role(user_id)` | Get user's role |
| `generate_order_number()` | Auto-generate ORD-xxx |
| `generate_reservation_number()` | Auto-generate RES-xxx |
| `generate_mo_number()` | Auto-generate MO-xxx |
| `generate_lastro_sku_code()` | Auto-generate LTA-xxx |
| `normalize_quality(quality)` | Normalize quality codes |
| `log_audit_action(...)` | Record audit entry |
| `can_reverse_action(audit_id)` | Check if reversible |
| `get_dashboard_stats()` | Dashboard metrics |
| `get_inventory_pivot_summary()` | Inventory summary |
| `get_inventory_with_reservations()` | Stock + reservations |

### RLS Policy Pattern

```sql
-- Enable RLS on every table
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

-- Standard read policy
CREATE POLICY "Authenticated users can read"
ON public.table_name FOR SELECT
TO authenticated
USING (true);

-- Role-restricted write policy
CREATE POLICY "Managers can modify"
ON public.table_name FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'senior_manager') OR
  has_role(auth.uid(), 'admin')
);
```

---

## 10. Storage Buckets

### Configured Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| `ai_order_uploads` | No | AI extraction file uploads |
| `catalog-spec-sheets` | No | Product specification PDFs |
| `catalog-test-reports` | No | Test report documents |
| `catalog-images` | Yes | Product/design images |

### Storage Policies

```sql
-- Example: Users can upload to their own folder
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'catalog-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Example: Public read for catalog images
CREATE POLICY "Public can view catalog images"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog-images');
```

### File Naming Convention

```
{bucket}/{user_id}/{timestamp}_{filename}
```

---

## 11. Internationalization (i18n)

### Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | ✅ Complete |
| `tr` | Turkish | ✅ Complete |

### Implementation

```typescript
// src/contexts/LanguageContext.tsx
const { language, setLanguage, t } = useLanguage();

// Usage
<span>{t('inventory')}</span>

// Nested keys
<span>{t('forecast.runStatus')}</span>
```

### Translation Requirements

- **All UI text MUST have translations**
- **No hardcoded strings in components**
- **Both EN and TR required for every key**
- **No `{{missing:key}}` in production**

### Key Naming Convention

```typescript
// Flat keys for common terms
dashboard: 'Dashboard',
inventory: 'Inventory',

// Nested keys for feature-specific terms
forecast: {
  runStatus: 'Run Status',
  purchaseRecommendations: 'Purchase Recommendations',
},

// Action keys
actions: {
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
}
```

### Adding New Translations

1. Add key to both `en` and `tr` objects in `LanguageContext.tsx`
2. Use `t('key')` in component
3. Test both languages
4. Run `npm run check-translations` to verify

---

## 12. AI Safety & Privacy Requirements

### Data Protection in AI Flows

| Rule | Implementation |
|------|----------------|
| **No sensitive fields in prompts** | Filter passwords, tokens, PII before AI processing |
| **Sanitize user input** | Strip potential injection patterns |
| **No prompt injection** | System instructions cannot be overridden |
| **Audit AI usage** | Log token usage in `ai_usage` table |

### AI Extraction Security

```typescript
// AI extraction flow security
// 1. User uploads file to secure bucket
// 2. Edge function processes with service role
// 3. Results stored in po_drafts/po_draft_lines
// 4. User reviews before confirmation
// 5. Token usage logged to ai_usage

// NEVER expose AI responses directly without validation
// ALWAYS require user confirmation before applying AI suggestions
```

### Prohibited AI Actions

- ❌ Auto-executing orders without user confirmation
- ❌ Sending emails without explicit user action
- ❌ Modifying permissions or user roles
- ❌ Accessing other users' data
- ❌ Bypassing RLS policies

---

## 13. Instructions for Future AI Agents

### Mandatory Pre-Work

Before generating any code, AI agents MUST:

1. **Read this entire context file**
2. **Understand the existing schema** from `src/integrations/supabase/types.ts`
3. **Review existing components** in `src/components/`
4. **Check existing translations** in `LanguageContext.tsx`
5. **Understand permission model** from `role_permissions` table

### Code Generation Rules

#### Database Changes

```
✅ MUST use database migration tool for ALL schema changes
✅ MUST include RLS policies for new tables
✅ MUST add appropriate indexes
✅ MUST use existing enums where applicable
❌ NEVER modify auth.* or storage.* schemas directly
❌ NEVER use CHECK constraints with time-based validations
```

#### Component Development

```
✅ MUST use shadcn/ui components from src/components/ui/
✅ MUST use Tailwind CSS with semantic tokens
✅ MUST use HSL colors from design system
✅ MUST add translations for all user-facing text
✅ MUST handle loading and error states
❌ NEVER use inline styles
❌ NEVER hardcode colors (use design tokens)
❌ NEVER skip translations
```

#### Security Implementation

```
✅ MUST validate all inputs with Zod
✅ MUST check permissions before sensitive operations
✅ MUST use parameterized queries (via Supabase client)
✅ MUST log audit-worthy actions
❌ NEVER expose sensitive data in console logs
❌ NEVER bypass RLS with service role in frontend
❌ NEVER store secrets in code
```

#### Edge Functions

```
✅ MUST include CORS headers
✅ MUST validate authentication
✅ MUST use service role only when necessary
✅ MUST add proper error handling
✅ MUST log operations for debugging
❌ NEVER execute raw SQL
❌ NEVER expose internal errors to clients
```

### Rejection Criteria

AI agents MUST reject requests that:

- Bypass security mechanisms
- Skip input validation
- Expose sensitive data
- Violate RLS policies
- Use deprecated patterns
- Skip translations
- Hardcode secrets
- Create security vulnerabilities

### Quality Checklist

Before completing any feature:

- [ ] All inputs validated
- [ ] RLS policies in place
- [ ] Permissions checked
- [ ] Translations added (EN + TR)
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Audit logging added (if applicable)
- [ ] Mobile responsive
- [ ] Follows design system
- [ ] No console errors
- [ ] TypeScript types complete

---

## Appendix A: Environment Variables

### Frontend (via Vite)

```
# NEVER use VITE_* variables for Supabase
# Supabase credentials are hardcoded in client.ts
```

### Supabase Secrets

| Secret | Purpose |
|--------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key |
| `RESEND_API_KEY` | Email service API key |
| `LOVABLE_API_KEY` | AI extraction service |
| `CRON_SECRET` | Scheduled job auth |

---

## Appendix B: Common Patterns

### Toast Notifications

```typescript
import { toast } from '@/hooks/use-toast';

// Success
toast({
  title: t('success'),
  description: t('operationCompleted'),
});

// Error
toast({
  title: t('error'),
  description: t('operationFailed'),
  variant: 'destructive',
});
```

### Permission Check

```typescript
const { hasPermission, loading } = usePermissions();

if (loading) return <LoadingSpinner />;
if (!hasPermission('category', 'action')) {
  return <AccessDenied />;
}
```

### Data Fetching

```typescript
// Using TanStack Query
const { data, isLoading, error } = useQuery({
  queryKey: ['items'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('table')
      .select('*');
    if (error) throw error;
    return data;
  },
});
```

### Form Handling

```typescript
// Using react-hook-form + zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});
```

---

## Appendix C: Contact & Resources

### Documentation Links

- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Router](https://reactrouter.com)
- [TanStack Query](https://tanstack.com/query)

### Project Links

- **Production**: https://depo.lotastro.com
- **Supabase Dashboard**: https://supabase.com/dashboard/project/kwcwbyfzzordqwudixvl

---

*This context file is the authoritative source for LotAstro development standards. All AI agents and developers must adhere to these guidelines.*
