# LotAstro System Architecture (CONTEXT.md)

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Purpose**: Comprehensive system architecture and technical reference

---

## 1. Project Overview

### Business Domain

LotAstro is a **Warehouse Management System (WMS)** designed for the textile and leather wholesale industry. It provides end-to-end inventory management, order processing, manufacturing order tracking, and demand forecasting.

### Target Market

| Segment | Description |
|---------|-------------|
| **Primary** | Textile/leather wholesalers with roll-based inventory |
| **Secondary** | Manufacturing suppliers, distributors |
| **Scale** | SMB to mid-market (10-500 employees) |
| **Geography** | Turkey/EU markets (bilingual EN/TR) |

### Core Value Propositions

1. **AI-Powered Order Extraction** - Automatic parsing of customer orders from images/text
2. **Real-Time Inventory Tracking** - Roll-level precision with QR codes
3. **Demand Forecasting** - Predictive analytics for stock planning
4. **Mobile-First Design** - Warehouse floor accessibility

---

## 2. Technology Stack

### Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | React | 18.3.1 | UI library |
| **Build Tool** | Vite | Latest | Fast bundling & HMR |
| **Language** | TypeScript | Strict | Type safety |
| **Styling** | Tailwind CSS | 3.x | Utility-first CSS |
| **UI Components** | shadcn/ui | Latest | Radix-based components |
| **Icons** | Lucide React | 0.462.0 | Icon library |
| **State** | TanStack Query | 5.83.0 | Server state management |
| **Routing** | React Router DOM | 6.30.1 | Client-side routing |
| **Forms** | React Hook Form | 7.61.1 | Form management |
| **Validation** | Zod | 3.25.76 | Schema validation |
| **Charts** | Recharts | 2.15.4 | Data visualization |
| **Date Utils** | date-fns | 3.6.0 | Date manipulation |
| **OCR** | Tesseract.js | 5.1.1 | Client-side OCR |
| **Excel** | xlsx | 0.18.5 | Spreadsheet handling |
| **QR Code** | qrcode + jsqr | Latest | QR generation & scanning |
| **Rich Text** | TipTap | 2.27.1 | Email template editor |

### Backend Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Platform** | Supabase | Latest | Backend-as-a-Service |
| **Database** | PostgreSQL | 15.x | Primary database |
| **Auth** | Supabase Auth | Latest | JWT authentication |
| **Storage** | Supabase Storage | Latest | File storage |
| **Edge Functions** | Deno | Latest | Serverless functions |
| **Email** | Resend | 4.0.0 | Transactional email |
| **AI** | OpenAI GPT-4 | Latest | Order extraction |

---

## 3. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                      │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│   │   Desktop     │  │    Mobile     │  │    Tablet     │               │
│   │   Browser     │  │   Browser     │  │   Browser     │               │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘               │
└───────────┼───────────────────┼───────────────────┼─────────────────────┘
            │                   │                   │
            ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND APPLICATION                             │
│   React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  Providers: Auth → ViewAsRole → Language → POCart → Query       │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│   │   Pages      │ │  Components  │ │    Hooks     │ │   Contexts   │   │
│   │   (30+)      │ │   (100+)     │ │    (20+)     │ │    (5)       │   │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLIENT                                  │
│                    @supabase/supabase-js                                 │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│   │  Auth API    │ │ Database API │ │ Storage API  │ │ Functions API│   │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE BACKEND                                 │
│   ┌───────────────────────────────────────────────────────────────────┐ │
│   │                        Edge Functions (33)                        │ │
│   │   Admin (5) | Email (10) | AI (3) | OCR (2) | Forecast (2) | ... │ │
│   └───────────────────────────────────────────────────────────────────┘ │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│   │   Auth       │ │  PostgreSQL  │ │   Storage    │ │   Realtime   │   │
│   │  (JWT/SSO)   │ │   (50+ tbl)  │ │  (4 buckets) │ │  (Webhooks)  │   │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│   ┌───────────────────────────────────────────────────────────────────┐ │
│   │                    Row Level Security (RLS)                       │ │
│   │              Restrictive policies on ALL tables                   │ │
│   └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES                                 │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
│   │   Resend     │ │   OpenAI     │ │   (Future)   │                    │
│   │   (Email)    │ │  (GPT-4)     │ │   Stripe     │                    │
│   └──────────────┘ └──────────────┘ └──────────────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
User Action → React Component → Custom Hook → TanStack Query → Supabase Client
                                                                      │
                                                                      ▼
                                                              ┌───────────────┐
                                                              │ Auth Check    │
                                                              │ (JWT Token)   │
                                                              └───────┬───────┘
                                                                      │
                                              ┌───────────────────────┼───────────────────────┐
                                              │                       │                       │
                                              ▼                       ▼                       ▼
                                      ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
                                      │   Database    │       │    Storage    │       │ Edge Function │
                                      │   (Direct)    │       │   (Direct)    │       │   (Invoke)    │
                                      └───────┬───────┘       └───────────────┘       └───────┬───────┘
                                              │                                               │
                                              ▼                                               ▼
                                      ┌───────────────┐                               ┌───────────────┐
                                      │  RLS Policy   │                               │  Business     │
                                      │  Evaluation   │                               │  Logic        │
                                      └───────────────┘                               └───────────────┘
```

---

## 4. Frontend Architecture

### Provider Hierarchy

```tsx
// Provider nesting order (outermost to innermost)
<QueryClientProvider>           // TanStack Query - server state
  <LanguageProvider>            // i18n - translations
    <TooltipProvider>           // Radix tooltips
      <BrowserRouter>           // React Router
        <AuthProvider>          // Authentication state
          <ViewAsRoleProvider>  // Admin role simulation
            <POCartProvider>    // Purchase order cart
              <ErrorBoundary>   // Error catching
                <Routes />      // Application routes
              </ErrorBoundary>
            </POCartProvider>
          </ViewAsRoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </LanguageProvider>
</QueryClientProvider>
```

### Folder Structure

```
src/
├── components/                 # UI Components
│   ├── ui/                    # shadcn/ui base (52 components)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── catalog/               # Catalog module (11 components)
│   ├── email/                 # Email templates (7 components)
│   ├── forecast/              # Forecasting (5 components)
│   ├── reports/               # Report builder (18 components)
│   ├── stocktake/             # Stock take (8 components)
│   └── [feature].tsx          # Feature components
│
├── contexts/                   # React Context Providers
│   ├── LanguageContext.tsx    # i18n (EN/TR)
│   ├── POCartProvider.tsx     # Purchase order cart
│   └── ViewAsRoleContext.tsx  # Admin role simulation
│
├── hooks/                      # Custom Hooks (20 hooks)
│   ├── useAuth.tsx            # Authentication
│   ├── usePermissions.tsx     # RBAC permissions
│   ├── useAuditLog.tsx        # Audit logging
│   ├── useReportBuilder.ts    # Report building
│   ├── useStockTakeSession.ts # Stock take sessions
│   ├── use-mobile.tsx         # Mobile detection
│   ├── usePullToRefresh.ts    # Pull-to-refresh
│   ├── useSwipeGesture.ts     # Touch gestures
│   └── ...
│
├── pages/                      # Route Pages (30+ pages)
│   ├── Dashboard.tsx
│   ├── Inventory.tsx
│   ├── Orders.tsx
│   ├── Catalog.tsx
│   ├── Reports.tsx
│   └── ...
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client instance
│       └── types.ts           # Generated database types
│
├── utils/                      # Utility Functions
│   ├── excelImport.ts         # Excel parsing
│   ├── ocrExtraction.ts       # OCR utilities
│   └── ocrPreprocessing.ts    # Image preprocessing
│
├── lib/
│   └── utils.ts               # cn() and utilities
│
├── App.tsx                     # Application root
├── main.tsx                    # Entry point
└── index.css                   # Global styles + Tailwind
```

### Custom Hooks Inventory

| Hook | Purpose | Key Dependencies |
|------|---------|------------------|
| `useAuth` | Authentication state & methods | Supabase Auth |
| `usePermissions` | RBAC permission checking | role_permissions table |
| `useAuditLog` | Audit trail logging | log_audit_action RPC |
| `useReportBuilder` | Report configuration | email_report_configs |
| `useStockTakeSession` | Stock take sessions | count_sessions table |
| `useStockTakeSettings` | Stock take config | app_settings table |
| `useStockTakeUpload` | Photo upload handling | Storage + count_rolls |
| `useClientOCR` | Tesseract.js OCR | tesseract.js |
| `useDuplicateDetection` | Roll duplicate checking | photo hashes |
| `useImageCompression` | Image optimization | Browser APIs |
| `useIndexedDBBackup` | Offline backup | IndexedDB |
| `usePullToRefresh` | Mobile refresh gesture | Touch events |
| `useSwipeGesture` | Swipe detection | Touch events |
| `useHapticFeedback` | Vibration feedback | Navigator API |
| `useSessionTimeout` | Auto-logout | Timer + Auth |
| `useUploadRetry` | Failed upload retry | IndexedDB queue |
| `useViewMode` | Table/card view toggle | localStorage |
| `use-mobile` | Mobile breakpoint | window.matchMedia |
| `use-toast` | Toast notifications | sonner |

### Routing Structure

```
/                           → Dashboard (Protected)
/auth                       → Login/Signup (Public)
/reset-password             → Password Reset (Public)
/invite                     → Accept Invitation (Public)

/lot-intake                 → Create New Lots
/lot-queue                  → Pending Lots Queue
/inventory                  → Inventory List
/inventory/:quality         → Quality Detail
/inventory/:quality/:color  → Lot Detail

/orders                     → Orders List
/order-queue                → Order Processing Queue
/reservations               → Stock Reservations
/lot-selection              → Roll Selection
/bulk-selection             → Bulk Roll Selection

/catalog                    → Product Catalog
/catalog/:id                → Catalog Item Detail

/incoming-stock             → Incoming Stock
/manufacturing-orders       → Manufacturing Orders
/goods-receipt              → Receive Goods

/forecast                   → Demand Forecast
/forecast-settings          → Forecast Configuration

/stock-take                 → Stock Take Capture
/stock-take-review          → Review Sessions

/qr-scan                    → QR Scanner
/qr/:lotNumber              → QR Direct Access
/print/qr/:lotNumber        → QR Print Page

/reports                    → Reports Hub
/reports/builder            → New Report
/reports/builder/:id        → Edit Report

/approvals                  → Approval Queue
/audit-logs                 → Action History
/suppliers                  → Supplier Management
/admin                      → System Administration

/admin/extraction-test      → AI Extraction Test (Dev)
```

---

## 5. Database Architecture

### Table Categories

| Category | Tables | Description |
|----------|--------|-------------|
| **User Management** | 4 | profiles, user_roles, user_invitations, admin_ip_whitelist |
| **Inventory Core** | 6 | lots, rolls, lot_queue, incoming_stock, goods_in_receipts, goods_in_rows |
| **Order Management** | 4 | orders, order_lots, order_queue, po_drafts |
| **Manufacturing** | 2 | manufacturing_orders, mo_status_history |
| **Reservations** | 2 | reservations, reservation_rolls |
| **Catalog** | 7 | catalog_items, catalog_item_suppliers, catalog_custom_field_*, catalog_user_views, catalog_approval_settings |
| **Forecasting** | 5 | forecast_settings_global, forecast_settings_per_quality, forecast_runs, forecast_results, forecast_alerts, demand_history |
| **Stock Take** | 2 | count_sessions, count_rolls |
| **Email System** | 9 | email_templates, email_log, email_schedules, email_recipients, email_settings, etc. |
| **Reports** | 1 | email_report_configs |
| **Audit/System** | 4 | audit_logs, role_permissions, field_edit_queue, ai_usage |
| **Reference** | 1 | suppliers |

### Key Database Functions

| Function | Purpose | Security |
|----------|---------|----------|
| `has_role(user_id, role)` | Check user role | SECURITY DEFINER |
| `get_user_role(user_id)` | Get primary role | SECURITY DEFINER |
| `log_audit_action(...)` | Create audit log | SECURITY DEFINER |
| `handle_new_user()` | Trigger: auto-create profile | Trigger function |
| `generate_order_number()` | Sequential order numbers | Sequence-based |
| `generate_mo_number()` | Sequential MO numbers | Sequence-based |
| `get_dashboard_stats()` | Dashboard KPIs | RPC function |
| `get_inventory_pivot_summary()` | Pivot inventory data | RPC function |
| `get_inventory_with_reservations()` | Inventory + reservations | RPC function |
| `refresh_roll_counts()` | Recalculate roll counts | Maintenance |

### Storage Buckets

| Bucket | Purpose | Public | Size Limit |
|--------|---------|--------|------------|
| `catalog-files` | Product specs, test reports | No | 50MB |
| `order-attachments` | Order documents | No | 10MB |
| `stock-take-photos` | Roll label photos | No | 5MB |
| `public-assets` | Shared assets | Yes | 10MB |

---

## 6. Edge Functions Inventory

### Function Categories

#### Admin Functions (5)

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `admin-change-password` | POST | Admin | Change user password |
| `admin-deactivate-user` | POST | Admin | Soft-disable account |
| `admin-delete-user` | POST | Admin | Hard-delete user |
| `admin-reconcile-users` | POST | Admin | Sync auth.users with profiles |
| `migrate-catalog-items` | POST | Admin | Catalog migration utility |

#### Email Functions (10)

| Function | Method | Trigger | Purpose |
|----------|--------|---------|---------|
| `send-invitation` | POST | Manual | User invite email |
| `send-test-email` | POST | Manual | Template testing |
| `send-mo-reminders` | POST | CRON | MO reminder digest |
| `send-overdue-digest` | POST | CRON | Overdue orders digest |
| `send-pending-approvals-digest` | POST | CRON | Approvals digest |
| `send-reservation-reminders` | POST | CRON | Reservation expiry |
| `send-forecast-digest` | POST | CRON | Forecast alerts |
| `send-scheduled-report` | POST | CRON | Report delivery |
| `send-in-app-notification` | POST | Event | In-app notifications |
| `process-email-retries` | POST | CRON | Failed email retry |

#### AI/OCR Functions (5)

| Function | Method | Purpose |
|----------|--------|---------|
| `extract-order` | POST | GPT-4 order extraction |
| `test-extraction` | POST | Test extraction (dev) |
| `validate-extraction` | POST | Validate extraction results |
| `stock-take-ocr` | POST | Roll label OCR |
| `process-ocr-queue` | POST | Batch OCR processing |

#### Report Functions (2)

| Function | Method | Purpose |
|----------|--------|---------|
| `get-report-schema` | POST | Database schema for reports |
| `generate-report-attachment` | POST | PDF/Excel generation |

#### Forecast Functions (2)

| Function | Method | Purpose |
|----------|--------|---------|
| `forecast-engine` | POST | Run forecast calculations |
| `forecast-import-history` | POST | Import demand history |

#### Utility Functions (9)

| Function | Method | Purpose |
|----------|--------|---------|
| `autocomplete-colors` | GET | Color suggestions |
| `autocomplete-qualities` | GET | Quality suggestions |
| `confirm-draft` | POST | Confirm PO draft |
| `cleanup-old-drafts` | POST | Remove expired drafts |
| `cleanup-old-audit-logs` | POST | Audit log retention |
| `repair-audit-inconsistencies` | POST | Fix audit issues |
| `reverse-audit-action` | POST | Undo audit action |
| `check-stock-alerts` | POST | Stock level alerts |

---

## 7. Authentication & Authorization

### Authentication Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Login    │────▶│  Supabase Auth  │────▶│   JWT Token     │
│   (Email/Pass)  │     │  (Validation)   │     │   (Issued)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │  Auto-refresh   │◀─────────────┘
                        │  (Supabase SDK) │
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │   AuthProvider  │
                        │  (React Context)│
                        └────────┬────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  user: User     │     │ session: Session│     │ profile: Profile│
│  (auth.users)   │     │   (JWT data)    │     │ (public.profiles)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### RBAC Permission System

```typescript
// Permission check flow
const { hasPermission } = usePermissions();

// Check pattern
if (hasPermission('category', 'action')) {
  // Allow operation
}

// Database lookup
role_permissions table:
┌──────────────────┬─────────────────────┬──────────────────┬────────────┐
│ role             │ permission_category │ permission_action│ is_allowed │
├──────────────────┼─────────────────────┼──────────────────┼────────────┤
│ warehouse_staff  │ inventory           │ view             │ true       │
│ warehouse_staff  │ inventory           │ delete           │ false      │
│ admin            │ *                   │ *                │ true       │
└──────────────────┴─────────────────────┴──────────────────┴────────────┘
```

### Permission Categories

| Category | Actions |
|----------|---------|
| `inventory` | view, createlotentries, editlot, delete, viewlotqueue, viewincoming, receiveincoming |
| `orders` | vieworders, createorders, fulfilorders, cancelorders, approve |
| `reservations` | view, create, release, cancel, convert |
| `manufacturing` | view, create, edit, delete |
| `catalog` | view, create, edit, approve, delete |
| `approvals` | viewapprovals, approve, reject |
| `reports` | viewreports, accessdashboard |
| `auditlogs` | viewalllogs, viewownlogs |
| `usermanagement` | viewusers, manageusers, managepermissions |
| `forecasting` | viewforecasts, configureforecasts, runforecasts |
| `stocktake` | startsession, reviewsessions |
| `qrdocuments` | scanqrcodes, printqrcodes |
| `suppliers` | viewsuppliers, managesuppliers |

---

## 8. Internationalization (i18n)

### Language Support

| Language | Code | Status |
|----------|------|--------|
| English | `en` | Full support |
| Turkish | `tr` | Full support |

### Implementation

```typescript
// LanguageContext.tsx
interface LanguageContextType {
  language: 'en' | 'tr';
  setLanguage: (lang: 'en' | 'tr') => void;
  t: (key: string) => string | Record<string, string>;
}

// Usage in components
const { t, language } = useLanguage();
<span>{t('dashboard')}</span>  // "Dashboard" or "Kontrol Paneli"
```

### Translation Structure

```typescript
const translations = {
  en: {
    dashboard: 'Dashboard',
    inventory: 'Inventory',
    orders: 'Orders',
    // ... 500+ keys
  },
  tr: {
    dashboard: 'Kontrol Paneli',
    inventory: 'Envanter',
    orders: 'Siparişler',
    // ... 500+ keys
  }
};
```

---

## 9. Environment Configuration

### Environment Variables

| Variable | Environment | Purpose |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | All | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | All | Supabase anonymous key |

### Supabase Secrets (Edge Functions)

| Secret | Purpose | Required By |
|--------|---------|-------------|
| `RESEND_API_KEY` | Email sending | All email functions |
| `OPENAI_API_KEY` | AI extraction | extract-order, stock-take-ocr |
| `CRON_SECRET` | Scheduled job auth | All CRON functions |
| `SERVICE_ROLE_KEY` | Admin operations | admin-* functions |

### Deployment Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| Development | localhost:8080 | Local development |
| Staging | *.lovableproject.com | Preview/testing |
| Production | depo.lotastro.com | Live production |

---

## 10. Build & Deployment

### Build Process

```bash
# Development
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    host: '::',
  },
});
```

### Edge Function Deployment

```bash
# Deploy single function
supabase functions deploy function-name

# Deploy all functions
supabase functions deploy

# Local development
supabase functions serve --env-file .env.local
```

---

## 11. API Patterns

### TanStack Query Pattern

```typescript
// Standard query pattern
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['resource', id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('table')
      .select('*')
      .eq('id', id);
    if (error) throw error;
    return data;
  },
});

// Mutation pattern
const mutation = useMutation({
  mutationFn: async (payload) => {
    const { error } = await supabase
      .from('table')
      .insert(payload);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource'] });
    toast.success('Created successfully');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### Edge Function Call Pattern

```typescript
// Calling edge functions
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param1: 'value1' },
  headers: { 'x-custom-header': 'value' },
});

if (error) {
  console.error('Function error:', error);
  throw error;
}

return data;
```

### RPC Call Pattern

```typescript
// Database function calls
const { data, error } = await supabase
  .rpc('function_name', {
    p_param1: 'value1',
    p_param2: 'value2',
  });
```

---

## 12. Performance Considerations

### Query Optimization

- Use `.select()` to limit returned columns
- Implement pagination with `.range()`
- Use database indexes for filtered queries
- Leverage RPC functions for complex aggregations

### Bundle Optimization

- Dynamic imports for large components
- Tree-shaking via ES modules
- Image optimization in build
- Code splitting per route

### Caching Strategy

| Data Type | Cache Time | Invalidation |
|-----------|------------|--------------|
| Reference data | 5 minutes | Manual |
| User profile | Session | On change |
| Inventory data | 30 seconds | Real-time |
| Reports | On demand | Manual |

---

## 13. Monitoring & Observability

### Client-Side Logging

```typescript
// Error boundary catches React errors
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Console logging for debugging
console.error('Failed to load:', error);
```

### Server-Side Logging

- Edge function logs in Supabase Dashboard
- PostgreSQL logs for query issues
- Auth logs for authentication events

### Audit Trail

```typescript
// All significant actions logged
await logAction(
  'CREATE',           // action type
  'order',            // entity type
  orderId,            // entity id
  orderNumber,        // entity identifier
  null,               // old data
  orderData,          // new data
  'Created via AI extraction'  // notes
);
```

---

## 14. Future Considerations

### Planned Modules

| Module | Status | Dependencies |
|--------|--------|--------------|
| CRM | Planned | New tables, customer portal |
| Wiki/Knowledge Base | Planned | Rich text storage |
| Customer Portal | Planned | Auth changes, new roles |
| Agreements | Planned | Document templates |
| Supplier Portal | Planned | Supplier auth |

### Technical Debt

- Translation key consolidation
- Component refactoring for reusability
- Test coverage improvement
- Documentation expansion

### Scalability

- Horizontal scaling via Supabase
- CDN for static assets
- Connection pooling (Supavisor)
- Read replicas for heavy queries
