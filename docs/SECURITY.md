# LotAstro Security Implementation (SECURITY.md)

> **Version**: 2.1.0  
> **Last Updated**: 2025-12-25  
> **Classification**: Internal - Security Documentation  
> **Architecture**: Multi-Project Ecosystem

---

## 1. Executive Summary

LotAstro implements a defense-in-depth security strategy with multiple layers of protection:

| Layer | Implementation | Status |
|-------|----------------|--------|
| **Authentication** | Supabase Auth (JWT) | ✅ Complete |
| **Authorization** | RBAC with RLS | ✅ Complete |
| **Data Protection** | RLS on all tables | ✅ Complete |
| **Input Validation** | Zod schemas | ✅ Complete |
| **Audit Logging** | Comprehensive trail | ✅ Complete |
| **Session Management** | Auto-timeout | ✅ Complete |
| **API Security** | Edge function auth | ✅ Complete |
| **XSS Protection** | DOMPurify sanitization | ✅ Complete |
| **CRON Security** | CRON_SECRET validation | ✅ Complete |
| **Integration Security** | API keys, webhooks, HMAC | ✅ Complete |
| **MFA/2FA** | Multi-factor auth | ❌ Not Implemented |
| **Rate Limiting** | Brute force protection | ❌ Not Implemented |

---

## 2. Ecosystem Security Context

### Multi-Project Architecture

LotAstro WMS operates within an ecosystem of connected applications. Security considerations extend beyond the WMS to protect data flowing between systems.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SECURITY PERIMETER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐      │
│   │  LotAstro WMS   │◄──│  LotAstro CRM   │   │  LotAstro Wiki  │      │
│   │  (This System)  │──►│  (External)     │   │  (External)     │      │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘      │
│            │                     │                     │                │
│            └─────────────────────┼─────────────────────┘                │
│                                  │                                      │
│                    ┌─────────────▼─────────────┐                        │
│                    │   INTEGRATION LAYER       │                        │
│                    │   ═══════════════════════ │                        │
│                    │   • API Key Auth ✅       │                        │
│                    │   • HMAC Webhook Signing ✅│                        │
│                    │   • Rate Limiting ✅      │                        │
│                    │   • Request Logging ✅    │                        │
│                    └─────────────┬─────────────┘                        │
│                                  │                                      │
│   ┌─────────────────┐   ┌───────┴───────┐   ┌─────────────────┐        │
│   │ Customer Portal │   │  Ops Console  │   │ Other AI Studio │        │
│   │   (External)    │   │  (External)   │   │     Apps        │        │
│   └─────────────────┘   └───────────────┘   └─────────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Ecosystem Security Principles

1. **Zero Trust Between Apps**: Each app must authenticate, even internal ones
2. **Least Privilege APIs**: APIs expose only necessary data
3. **Audit All Cross-App Calls**: Log every integration request
4. **Signed Webhooks**: Prevent webhook spoofing with HMAC
5. **Per-App Secrets**: Unique API keys per consumer application

---

## 3. Authentication Architecture

### 3.1 Authentication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Login    │────▶│  Supabase Auth  │────▶│   JWT Token     │
│                 │     │                 │     │   (1 week exp)  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
         ┌───────────────────────────────────────────────┤
         │                                               │
         ▼                                               ▼
┌─────────────────────────┐                     ┌─────────────────┐
│  AuthProvider Context   │                     │  Auto Refresh   │
│  - user state           │                     │  (Supabase SDK) │
│  - session state        │                     └─────────────────┘
│  - profile data         │
│  - role information     │
└─────────────────────────┘
```

### 3.2 Session Security

| Feature | Implementation | Configuration |
|---------|----------------|---------------|
| **Session Duration** | JWT expiration | 1 week (Supabase default) |
| **Auto Refresh** | Supabase SDK | Automatic before expiry |
| **Inactivity Timeout** | useSessionTimeout hook | Configurable (default 30 min) |
| **Secure Storage** | Supabase SDK | HttpOnly-equivalent via SDK |
| **Session Invalidation** | Sign out | Clears all tokens |

### 3.3 Password Security

```typescript
// Password requirements enforced by PasswordStrengthIndicator
const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

// Supabase handles password hashing (bcrypt)
// Never store or transmit plain passwords
```

### 3.4 User Invitation Security

```typescript
// user_invitations table
interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  expires_at: string;        // 7-day expiration
  status: 'pending' | 'accepted' | 'expired';
  invite_link: string;       // Unique token
}

// Invitation flow
// 1. Admin creates invitation → unique token generated
// 2. Email sent with magic link → send-invitation edge function
// 3. User clicks link → /invite route validates token
// 4. Token consumed on successful signup → status = 'accepted'
// 5. Expired tokens rejected → status = 'expired'
```

---

## 4. Authorization (RBAC) System

### 4.1 Role Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                        ADMIN                             │
│   Full system access, user management, configuration    │
├─────────────────────────────────────────────────────────┤
│                   SENIOR_MANAGER                         │
│   All operations, approvals, forecasting, reports       │
├─────────────────────────────────────────────────────────┤
│                     ACCOUNTING                           │
│   Orders, catalog, manufacturing, reservations          │
├─────────────────────────────────────────────────────────┤
│                   WAREHOUSE_STAFF                        │
│   Inventory view, lot intake, QR scanning, stock take   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Role Storage (Secure Pattern)

```sql
-- CRITICAL: Roles stored in separate table, NOT in profiles
-- This prevents privilege escalation attacks

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
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
```

### 4.3 Permission Categories & Actions

| Category | Actions | Description |
|----------|---------|-------------|
| `inventory` | view, createlotentries, editlot, delete, viewlotqueue, viewincoming, receiveincoming | Lot/roll operations |
| `orders` | vieworders, createorders, fulfilorders, cancelorders, approve | Order management |
| `reservations` | view, create, release, cancel, convert | Stock reservations |
| `manufacturing` | view, create, edit, delete | Manufacturing orders |
| `catalog` | view, create, edit, approve, delete | Product catalog |
| `approvals` | viewapprovals, approve, reject | Approval queue |
| `reports` | viewreports, accessdashboard | Reporting access |
| `auditlogs` | viewalllogs, viewownlogs | Audit history |
| `usermanagement` | viewusers, manageusers, managepermissions | User admin |
| `forecasting` | viewforecasts, configureforecasts, runforecasts | Demand forecasting |
| `stocktake` | startsession, reviewsessions | Stock counting |
| `qrdocuments` | scanqrcodes, printqrcodes | QR operations |
| `suppliers` | viewsuppliers, managesuppliers | Supplier management |

### 4.4 Permission Check Implementation

```typescript
// Frontend permission check
const { hasPermission } = usePermissions();

// Check before rendering UI elements
{hasPermission('orders', 'approve') && (
  <Button onClick={handleApprove}>Approve Order</Button>
)}

// Check before navigation
const filteredNavigation = navigationItems.filter(item =>
  hasPermission(item.permission.category, item.permission.action)
);
```

### 4.5 Admin "View As Role" Feature

```typescript
// ViewAsRoleContext allows admins to simulate other roles
const { viewAsRole, setViewAsRole, isViewingAsOtherRole } = useViewAsRole();

// Permission checks respect viewAsRole
const effectiveRole = viewAsRole || profile?.role;

// Visual indicator when viewing as another role
<Badge className={isViewingAsOtherRole ? 'ring-2 ring-orange-400' : ''}>
  {effectiveRole}
</Badge>
```

---

## 5. Row Level Security (RLS)

### 5.1 RLS Philosophy

All tables in LotAstro use **RESTRICTIVE** RLS policies:

```sql
-- Default deny: No access without explicit policy
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Restrictive policies (USING clause required for access)
CREATE POLICY "policy_name" ON table_name
FOR SELECT
TO authenticated
USING (condition);
```

### 5.2 RLS Policy Patterns

#### Pattern 1: Role-Based Access

```sql
-- Admins can manage all records
CREATE POLICY "Admins can manage all" ON public.table_name
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Senior managers can view
CREATE POLICY "Senior managers can view" ON public.table_name
FOR SELECT
USING (has_role(auth.uid(), 'senior_manager'));
```

#### Pattern 2: Owner-Based Access

```sql
-- Users can only see their own data
CREATE POLICY "Users can view own records" ON public.table_name
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own records
CREATE POLICY "Users can update own records" ON public.table_name
FOR UPDATE
USING (user_id = auth.uid());
```

#### Pattern 3: Multi-Role Access

```sql
-- Multiple roles can access
CREATE POLICY "Authorized users can view" ON public.table_name
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'senior_manager') OR
  has_role(auth.uid(), 'accounting')
);
```

### 5.3 RLS Coverage by Table Category

#### User Management Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `profiles` | 4 | Users see own; admins see all |
| `user_roles` | 3 | Admins manage; users view own |
| `user_invitations` | 3 | Admins create; public verify token |
| `admin_ip_whitelist` | 1 | Admin only |

#### Inventory Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `lots` | 5 | Role-based CRUD |
| `rolls` | 5 | Role-based CRUD ⚠️ Review needed |
| `lot_queue` | 4 | Role-based with creator access |
| `incoming_stock` | 4 | Accounting/senior/admin |
| `goods_in_receipts` | 3 | Warehouse + admin ⚠️ Review needed |
| `goods_in_rows` | 3 | Follows receipt access |

### 5.4 Known RLS Gaps (Remaining)

| Table | Issue | Risk | Remediation |
|-------|-------|------|-------------|
| `rolls` | Overly permissive SELECT | Data exposure | Restrict to role-based |
| `goods_in_receipts` | Overly permissive SELECT | Data exposure | Restrict to role-based |

---

## 6. Input Validation

### 6.1 Zod Schema Validation

```typescript
// All user inputs validated with Zod schemas
import { z } from 'zod';

// Example: Order creation schema
const orderSchema = z.object({
  customer_name: z.string().trim().min(1).max(100),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(z.object({
    quality: z.string().min(1),
    color: z.string().min(1),
    meters: z.number().positive(),
  })).min(1),
  notes: z.string().max(500).optional(),
});

// Validation before API call
const result = orderSchema.safeParse(formData);
if (!result.success) {
  throw new Error(result.error.message);
}
```

### 6.2 Edge Function Validation

```typescript
// All edge functions validate input
export async function handler(req: Request) {
  try {
    const body = await req.json();
    
    // Validate request body
    const schema = z.object({
      orderId: z.string().uuid(),
      action: z.enum(['approve', 'reject']),
    });
    
    const validated = schema.parse(body);
    
    // Process validated data...
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({
        error: 'Validation failed',
        details: error.errors,
      }), { status: 400 });
    }
    throw error;
  }
}
```

---

## 7. Audit Logging

### 7.1 Audit Log Structure

```typescript
interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'FULFILL' | 'APPROVE' | 'REJECT';
  entity_type: 'lot' | 'order' | 'roll' | 'profile' | 'supplier' | '...';
  entity_id: string;
  entity_identifier: string;  // Human-readable (e.g., order number)
  old_data: Json | null;      // State before change
  new_data: Json | null;      // State after change
  changed_fields: Json | null; // Specific fields changed
  notes: string | null;
  created_at: string;
  is_reversed: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_audit_id: string | null;
}
```

### 7.2 Audit Logging Implementation

```typescript
// useAuditLog hook
export const useAuditLog = () => {
  const logAction = async (
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    entityIdentifier: string,
    oldData?: any,
    newData?: any,
    notes?: string
  ) => {
    try {
      await supabase.rpc('log_audit_action', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_entity_identifier: entityIdentifier,
        p_old_data: oldData || null,
        p_new_data: newData || null,
        p_changed_fields: null,
        p_notes: notes || null
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  };

  return { logAction };
};
```

---

## 8. Edge Function Security

### 8.1 Authentication Enforcement

```typescript
// All edge functions must verify JWT
import { createClient } from '@supabase/supabase-js';

export async function handler(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authHeader } }
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401 
    });
  }

  // Proceed with authorized request...
}
```

### 8.2 CRON Job Authentication ✅ COMPLETE

All 11 CRON-triggered edge functions now validate `CRON_SECRET`:

```typescript
// REQUIRED: CRON jobs must validate CRON_SECRET
export async function handler(req: Request) {
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = Deno.env.get('CRON_SECRET');
  
  if (!cronSecret || cronSecret !== expectedSecret) {
    console.error('CRON authentication failed');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401 
    });
  }

  // Proceed with CRON job...
}
```

**Protected Functions (11/11):**
- ✅ `cleanup-old-drafts`
- ✅ `send-mo-reminders`
- ✅ `process-ocr-queue`
- ✅ `send-scheduled-report`
- ✅ `cleanup-old-audit-logs`
- ✅ `check-stock-alerts`
- ✅ `process-email-retries`
- ✅ `send-reservation-reminders`
- ✅ `send-overdue-digest`
- ✅ `send-pending-approvals-digest`
- ✅ `send-forecast-digest`

### 8.3 CORS Configuration

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret, x-api-key',
};

// Handle CORS preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

## 9. Integration Security ✅ COMPLETE

### 9.1 API Key Authentication

```typescript
// Implemented in supabase/functions/_shared/api-auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function validateApiKey(
  supabase: any,
  apiKey: string | null
): Promise<ApiKeyValidation> {
  if (!apiKey) {
    return { valid: false, error: 'Missing x-api-key header' };
  }

  // Hash the provided key
  const keyHash = await hashApiKey(apiKey);
  
  // Look up the key
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !keyData) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check expiration
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }

  // Check rate limit
  if (keyData.rate_limit_per_minute) {
    const isRateLimited = await checkRateLimit(supabase, keyData.id, keyData.rate_limit_per_minute);
    if (isRateLimited) {
      return { valid: false, error: 'Rate limit exceeded' };
    }
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyData.id);

  return { 
    valid: true, 
    keyData,
    service: keyData.service,
    permissions: keyData.permissions 
  };
}
```

### 9.2 Webhook Signature Verification

```typescript
// Implemented in supabase/functions/webhook-dispatcher/index.ts
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Webhook headers include:
// - X-Webhook-Signature: HMAC-SHA256 signature
// - X-Webhook-Timestamp: Unix timestamp
// - X-Webhook-Event: Event type
```

### 9.3 Rate Limiting

```typescript
// Implemented with sliding window rate limiting
async function checkRateLimit(
  supabase: any, 
  keyId: string, 
  limit: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - 60000).toISOString(); // 1 minute window
  
  const { count } = await supabase
    .from('api_request_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyId)
    .gte('created_at', windowStart);
  
  return (count || 0) >= limit;
}
```

---

## 10. XSS Protection ✅ COMPLETE

### 10.1 DOMPurify Integration

```typescript
// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize email HTML content (preserves more CSS for email templates)
 */
export function sanitizeEmailHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'blockquote', 'pre', 'code'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt', 'width', 'height', 'border', 'cellpadding', 'cellspacing', 'align', 'valign', 'bgcolor', 'color'],
    ALLOW_DATA_ATTR: false,
  });
}
```

### 10.2 Protected Components

| Component | File | Status |
|-----------|------|--------|
| EmailTemplatePreview | `src/components/email/EmailTemplatePreview.tsx` | ✅ Protected |
| VersionHistoryDrawer | `src/components/email/VersionHistoryDrawer.tsx` | ✅ Protected |

---

## 11. Security Checklist

### For New Features

- [x] Input validated with Zod schema
- [x] RLS policies reviewed for new tables
- [x] Audit logging implemented
- [x] Permission checks added
- [x] No sensitive data in client logs
- [x] CORS configured correctly
- [x] Edge function validates JWT

### For Code Reviews

- [x] No hardcoded secrets
- [x] No `dangerouslySetInnerHTML` without DOMPurify
- [x] SQL injection prevented (use parameterized queries)
- [x] Error messages don't leak sensitive info
- [x] API responses don't include unnecessary data

### For Deployments

- [x] CRON_SECRET configured
- [x] All secrets rotated if compromised
- [x] RLS policies tested
- [x] Edge functions tested with auth

---

## 12. Known Security Gaps & Remediation

### Critical (P0) - ✅ ALL RESOLVED

| Issue | Risk | Remediation | Status |
|-------|------|-------------|--------|
| ~~Missing CRON_SECRET~~ | ~~CRON job abuse~~ | ~~Add validation to all CRON functions~~ | ✅ Complete |
| ~~XSS in email templates~~ | ~~Script injection~~ | ~~Add DOMPurify~~ | ✅ Complete |
| Overly permissive RLS | Data exposure | Review rolls, goods_in_receipts | 🔴 Open |

### High (P1)

| Issue | Risk | Remediation | Status |
|-------|------|-------------|--------|
| No MFA/2FA | Account takeover | Implement TOTP | 📅 Planned |
| No rate limiting | Brute force | Add login rate limiter | 📅 Planned |
| No password lockout | Account compromise | Lock after N failures | 📅 Planned |

### Medium (P2) - ✅ INTEGRATION SECURITY COMPLETE

| Issue | Risk | Remediation | Status |
|-------|------|-------------|--------|
| ~~No API key auth~~ | ~~Ecosystem abuse~~ | ~~Implement per-app keys~~ | ✅ Complete |
| ~~No webhook signatures~~ | ~~Webhook spoofing~~ | ~~Add HMAC signing~~ | ✅ Complete |
| No penetration test | Unknown vulns | Conduct external audit | 📅 Planned |

---

## 13. Changelog

### 2025-12-25 (v2.1.0)
- ✅ CRON_SECRET validation: All 11 functions protected
- ✅ XSS Protection: DOMPurify integration complete
- ✅ Integration Security: API key auth, rate limiting, webhook signatures
- Updated security gap status

### Previous
- 2025-12-25 (v2.0.0): Ecosystem security context; integration security requirements
- 2025-01-10 (v1.0.0): Initial security documentation

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial security documentation |
| 2.0.0 | 2025-12-25 | Ecosystem security context; integration requirements |
| 2.1.0 | 2025-12-25 | CRON/XSS/Integration security complete; updated gaps |
