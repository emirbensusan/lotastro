# LotAstro Security Implementation (SECURITY.md)

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Classification**: Internal - Security Documentation

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

---

## 2. Authentication Architecture

### 2.1 Authentication Flow

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

### 2.2 Session Security

| Feature | Implementation | Configuration |
|---------|----------------|---------------|
| **Session Duration** | JWT expiration | 1 week (Supabase default) |
| **Auto Refresh** | Supabase SDK | Automatic before expiry |
| **Inactivity Timeout** | useSessionTimeout hook | Configurable (default 30 min) |
| **Secure Storage** | Supabase SDK | HttpOnly-equivalent via SDK |
| **Session Invalidation** | Sign out | Clears all tokens |

### 2.3 Password Security

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

### 2.4 User Invitation Security

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
1. Admin creates invitation → unique token generated
2. Email sent with magic link → send-invitation edge function
3. User clicks link → /invite route validates token
4. Token consumed on successful signup → status = 'accepted'
5. Expired tokens rejected → status = 'expired'
```

---

## 3. Authorization (RBAC) System

### 3.1 Role Hierarchy

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

### 3.2 Role Storage (Secure Pattern)

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

### 3.3 Permission Categories & Actions

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

### 3.4 Permission Check Implementation

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

### 3.5 Admin "View As Role" Feature

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

## 4. Row Level Security (RLS)

### 4.1 RLS Philosophy

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

### 4.2 RLS Policy Patterns

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

### 4.3 RLS Coverage by Table Category

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
| `rolls` | 5 | Role-based CRUD |
| `lot_queue` | 4 | Role-based with creator access |
| `incoming_stock` | 4 | Accounting/senior/admin |
| `goods_in_receipts` | 3 | Warehouse + admin |
| `goods_in_rows` | 3 | Follows receipt access |

#### Order Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `orders` | 4 | Role-based CRUD |
| `order_lots` | 3 | Follows order access |
| `order_queue` | 3 | Accounting/senior/admin |
| `po_drafts` | 3 | Creator access + admin |

#### Catalog Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `catalog_items` | 4 | Role-based; admin delete |
| `catalog_item_suppliers` | 2 | Edit/view by role |
| `catalog_custom_field_definitions` | 2 | Admin manage; all view |
| `catalog_custom_field_values` | 2 | Edit/view by role |
| `catalog_item_audit_logs` | 2 | Insert/view by role |
| `catalog_approval_settings` | 4 | Admin manage |
| `catalog_user_views` | 2 | User owns their views |

#### Stock Take Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `count_sessions` | 6 | Creator + admin/senior review |
| `count_rolls` | 6 | Session-based + admin review |

#### Email System Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `email_templates` | 1 | Admin only |
| `email_log` | 3 | Admin view; system insert |
| `email_schedules` | 2 | Admin manage; senior view |
| `email_recipients` | 2 | Admin manage; senior view |
| `email_settings` | 3 | Admin only |
| `email_digest_configs` | 3 | Admin only |
| `email_recipient_preferences` | 3 | User owns; admin manage all |

#### Audit & System Tables

| Table | Policies | Access Pattern |
|-------|----------|----------------|
| `audit_logs` | 4 | Admin/senior view; system insert |
| `role_permissions` | 2 | Admin manage; all view |
| `field_edit_queue` | 4 | All create; senior/admin manage |
| `ai_usage` | 1 | Admin/senior view only |

### 4.4 RLS Bypass Prevention

```sql
-- NEVER bypass RLS in application code
-- Edge Functions use service role only when necessary

-- ❌ WRONG: Bypassing RLS
const supabaseAdmin = createClient(url, SERVICE_ROLE_KEY);

-- ✅ CORRECT: Use authenticated client
const supabase = createClient(url, ANON_KEY);
// RLS automatically applied based on user JWT
```

---

## 5. Input Validation

### 5.1 Zod Schema Validation

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
  // Handle validation errors
  throw new Error(result.error.message);
}
```

### 5.2 Common Validation Patterns

```typescript
// Email validation
const emailSchema = z.string().email().max(255);

// UUID validation
const uuidSchema = z.string().uuid();

// Numeric ranges
const metersSchema = z.number().positive().max(10000);

// Date validation
const dateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date' }
);

// Enum validation
const roleSchema = z.enum(['warehouse_staff', 'accounting', 'senior_manager', 'admin']);
```

### 5.3 Edge Function Validation

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

## 6. Audit Logging

### 6.1 Audit Log Structure

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

### 6.2 Audit Logging Implementation

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

### 6.3 Audit Log Retention

```sql
-- cleanup-old-audit-logs edge function
-- Runs on schedule to maintain log size
-- Configurable retention period (default: 2 years)

DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '2 years'
  AND is_reversed = false;
```

### 6.4 Audit Reversal Feature

```typescript
// Admins can reverse certain actions
// Creates reversal audit entry linked to original
await supabase.functions.invoke('reverse-audit-action', {
  body: {
    auditId: originalAuditId,
    reason: 'User requested correction'
  }
});
```

---

## 7. Edge Function Security

### 7.1 Authentication Enforcement

```typescript
// Every edge function validates authentication
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Missing authorization' }), {
    status: 401,
  });
}

// Verify JWT
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});

const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), {
    status: 401,
  });
}
```

### 7.2 Role Verification in Edge Functions

```typescript
// Check user role for privileged operations
const { data: roleData } = await supabaseAdmin
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (roleData?.role !== 'admin') {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
  });
}
```

### 7.3 CRON Job Authentication

```typescript
// All scheduled jobs validate CRON_SECRET
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

### 7.4 CORS Configuration

```typescript
// Standard CORS headers for all edge functions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

---

## 8. Data Protection

### 8.1 Sensitive Data Classification

| Level | Examples | Protection |
|-------|----------|------------|
| **Critical** | Passwords, API keys | Never stored in frontend |
| **Sensitive** | Email, phone, PII | Encrypted at rest |
| **Internal** | User IDs, order numbers | RLS protected |
| **Public** | Product names, images | Standard access |

### 8.2 Data in Transit

- All communications over HTTPS
- TLS 1.2+ enforced by Supabase
- No sensitive data in URLs

### 8.3 Data at Rest

- Supabase encrypts all data at rest
- Database-level encryption (PostgreSQL)
- Storage bucket encryption

### 8.4 Client-Side Data Handling

```typescript
// NEVER store sensitive data in localStorage
// ❌ WRONG
localStorage.setItem('userRole', 'admin');

// ✅ CORRECT - Use secure session from Supabase
const { data: { session } } = await supabase.auth.getSession();
// Role comes from database, not client storage
```

---

## 9. IP Whitelisting (Admin Panel)

### 9.1 Implementation

```sql
-- admin_ip_whitelist table
CREATE TABLE public.admin_ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only admins can manage
CREATE POLICY "Only admins can manage IP whitelist" ON admin_ip_whitelist
FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### 9.2 Admin Panel Component

```typescript
// IPWhitelistTab.tsx
// Manages allowed IP addresses for enhanced security
// Optional feature for high-security deployments
```

---

## 10. Security Checklist

### 10.1 New Feature Checklist

- [ ] All inputs validated with Zod schemas
- [ ] RLS policies created for new tables
- [ ] Permission checks added to UI
- [ ] Edge function auth verified
- [ ] Audit logging implemented
- [ ] No sensitive data in console logs
- [ ] Error messages are generic
- [ ] CORS headers configured

### 10.2 Code Review Checklist

- [ ] No hardcoded secrets
- [ ] No client-side role storage
- [ ] No dangerouslySetInnerHTML with user content
- [ ] Parameterized queries only
- [ ] Service role used only when necessary
- [ ] Input sanitization applied

### 10.3 Deployment Checklist

- [ ] Environment variables configured
- [ ] CRON_SECRET set for scheduled functions
- [ ] RESEND_API_KEY verified
- [ ] OPENAI_API_KEY secured
- [ ] RLS policies tested
- [ ] Edge functions deployed

---

## 11. Incident Response

### 11.1 Security Event Types

| Event | Severity | Response |
|-------|----------|----------|
| **Failed logins (>5)** | Medium | Account lockout |
| **Unauthorized access attempt** | High | Log & alert |
| **Data breach** | Critical | Immediate investigation |
| **RLS bypass attempt** | Critical | Block & audit |

### 11.2 Logging & Monitoring

```typescript
// Security events logged to audit_logs
await supabase.rpc('log_audit_action', {
  p_action: 'SECURITY_EVENT',
  p_entity_type: 'profile',
  p_entity_id: userId,
  p_notes: 'Multiple failed login attempts detected'
});
```

### 11.3 Contact Points

| Role | Responsibility |
|------|----------------|
| System Admin | Initial investigation |
| Development Lead | Technical remediation |
| Project Owner | Stakeholder communication |

---

## 12. Compliance Considerations

### 12.1 Data Retention

| Data Type | Retention | Policy |
|-----------|-----------|--------|
| Audit logs | 2 years | Automatic cleanup |
| User data | Active account | Deleted on request |
| Order history | 7 years | Legal requirement |
| Email logs | 1 year | Auto-purge |

### 12.2 GDPR Considerations

- User data export capability (via admin)
- Right to deletion (admin-delete-user)
- Consent tracking (email_recipient_preferences)
- Data minimization (collect only necessary)

### 12.3 Future Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| MFA support | High | Planned |
| SSO integration | Medium | Planned |
| Security dashboard | Medium | Planned |
| Automated vulnerability scanning | Low | Planned |
