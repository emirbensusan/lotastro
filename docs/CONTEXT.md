# LotAstro System Architecture (CONTEXT.md)

> **Version**: 2.0.0  
> **Last Updated**: 2025-12-25  
> **Purpose**: Comprehensive system architecture and technical reference  
> **Architecture**: Multi-Project Ecosystem

---

## 1. Project Overview

### Business Domain

LotAstro is a **Warehouse Management System (WMS)** designed for the textile and leather wholesale industry. It provides end-to-end inventory management, order processing, manufacturing order tracking, and demand forecasting.

### Ecosystem Architecture

LotAstro WMS operates as the **inventory master** within a larger ecosystem of connected applications:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOTASTRO ECOSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   LOVABLE PROJECTS (Supabase Backend)                                       │
│   ════════════════════════════════════                                      │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │  🏭 LotAstro    │   │  👥 LotAstro    │   │  📚 LotAstro    │          │
│   │     WMS         │◄──┤     CRM         │   │     Wiki        │          │
│   │  ═══════════    │   │  ═══════════    │   │  ═══════════    │          │
│   │  THIS PROJECT   │──►│  Customers      │   │  Knowledge      │          │
│   │                 │   │  Leads, Sales   │   │  Articles       │          │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘          │
│            │                     │                     │                    │
│            │   ┌─────────────────┴─────────────────────┘                   │
│            │   │                                                            │
│            ▼   ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │              🔗 INTEGRATION LAYER                            │          │
│   │  ════════════════════════════════════════════════════════   │          │
│   │  • Edge Function APIs (get-inventory, create-order, etc.)   │          │
│   │  • Webhook Events (order.created, inventory.updated, etc.)  │          │
│   │  • API Key Authentication (per-app keys)                    │          │
│   │  • Shared Entity IDs (UUIDs)                                │          │
│   └─────────────────────────────────────────────────────────────┘          │
│            │                                                                │
│            ▼                                                                │
│   AI STUDIO PROJECTS (Potential Lovable Import)                            │
│   ═════════════════════════════════════════════                            │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │  🛒 Customer    │   │  💰 Cost        │   │  🎫 SIM         │          │
│   │     Portal      │   │     Portal      │   │     Ticketing   │          │
│   └─────────────────┘   └─────────────────┘   └─────────────────┘          │
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐                                │
│   │  🎛️ Ops Console │   │  🚚 Route       │                                │
│   │                 │   │    Optimizer    │                                │
│   └─────────────────┘   └─────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
5. **Ecosystem Integration** - Seamless data flow with CRM, Portal, and other apps

---

## 2. Data Ownership Model

### Distributed Ownership Across Ecosystem

| Entity | Master System | Sync Direction | Consumers |
|--------|---------------|----------------|-----------|
| **Inventory/Stock** | WMS | → | CRM, Portal, Ops Console |
| **Products/Catalog** | WMS | → | CRM, Portal |
| **Orders (Fulfillment)** | WMS | ↔ | CRM (sales), Portal (customer) |
| **Customers/Leads** | CRM | → | WMS, Portal |
| **Customer Credit** | CRM | → | WMS |
| **Knowledge Articles** | Wiki | → | All apps |
| **Invoices** | Cost Portal | → | WMS |
| **Delivery Routes** | Route Optimizer | → | WMS |
| **Support Tickets** | Ticketing | → | Ops Console |

### WMS as Inventory Master

LotAstro WMS is the **source of truth** for:
- Lot and roll inventory
- Product catalog definitions
- Order fulfillment status
- Stock levels and availability
- Manufacturing order tracking
- Demand forecasts

---

## 3. Technology Stack

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

### Shared Services

| Service | Usage | Shared With |
|---------|-------|-------------|
| **Resend** | Email delivery | CRM, Wiki |
| **GitHub** | Source control | CRM, Wiki |
| **Supabase** | Backend platform | CRM, Wiki (separate projects) |

---

## 4. System Architecture

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
│   │                        Edge Functions (33+)                       │ │
│   │   Admin (5) | Email (10) | AI (3) | OCR (2) | Forecast (2)       │ │
│   │   Integration APIs (planned): inventory, orders, catalog          │ │
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
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────┐
│   EXTERNAL SERVICES │ │   ECOSYSTEM APPS    │ │   FUTURE INTEGRATIONS   │
│   ─────────────────  │ │   ───────────────   │ │   ────────────────────  │
│   ┌─────────────┐   │ │   ┌─────────────┐   │ │   ┌─────────────────┐   │
│   │   Resend    │   │ │   │  LotAstro   │   │ │   │ Customer Portal │   │
│   │   (Email)   │   │ │   │    CRM      │   │ │   │   (AI Studio)   │   │
│   └─────────────┘   │ │   └─────────────┘   │ │   └─────────────────┘   │
│   ┌─────────────┐   │ │   ┌─────────────┐   │ │   ┌─────────────────┐   │
│   │   OpenAI    │   │ │   │  LotAstro   │   │ │   │  Ops Console    │   │
│   │  (GPT-4)    │   │ │   │    Wiki     │   │ │   │   (AI Studio)   │   │
│   └─────────────┘   │ │   └─────────────┘   │ │   └─────────────────┘   │
└─────────────────────┘ └─────────────────────┘ └─────────────────────────┘
```

### Integration Architecture (Planned)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     INTEGRATION LAYER (Phase 2)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    EDGE FUNCTION APIS                            │   │
│   │  ─────────────────────────────────────────────────────────────  │   │
│   │  GET  /get-inventory-summary    → Returns stock levels          │   │
│   │  GET  /get-customer-orders      → Returns orders by customer    │   │
│   │  POST /create-order-external    → Accept orders from Portal     │   │
│   │  GET  /get-catalog-public       → Product catalog for Portal    │   │
│   │  GET  /check-availability       → Real-time stock check         │   │
│   │  POST /sync-customer-from-crm   → Receive CRM customer data     │   │
│   │  GET  /metrics                  → Health and usage metrics      │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    WEBHOOK EVENTS                                │   │
│   │  ─────────────────────────────────────────────────────────────  │   │
│   │  order.created        → Notify CRM, Ops Console                 │   │
│   │  order.fulfilled      → Notify CRM, Portal                      │   │
│   │  order.cancelled      → Notify CRM, Portal                      │   │
│   │  inventory.low_stock  → Notify CRM, Ops Console                 │   │
│   │  inventory.updated    → Notify Portal                           │   │
│   │  customer.created     → Receive from CRM                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    AUTHENTICATION                                │   │
│   │  ─────────────────────────────────────────────────────────────  │   │
│   │  API Keys: CRM_API_KEY, PORTAL_API_KEY, OPS_CONSOLE_API_KEY     │   │
│   │  Webhook Signatures: HMAC-SHA256 with per-app secrets           │   │
│   │  Rate Limiting: Per-key limits with backoff                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Frontend Architecture

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
│   └── ...
│
├── pages/                      # Route Pages (30+ pages)
│
├── integrations/
│   └── supabase/
│       ├── client.ts          # Supabase client instance
│       └── types.ts           # Generated database types
│
├── utils/                      # Utility Functions
│
├── lib/
│   └── utils.ts               # cn() and utilities
│
├── App.tsx                     # Application root
├── main.tsx                    # Entry point
└── index.css                   # Global styles + Tailwind

supabase/
├── functions/                  # Edge Functions (33+)
│   ├── admin-*/               # Admin functions
│   ├── send-*/                # Email functions
│   ├── extract-order/         # AI extraction
│   ├── stock-take-ocr/        # OCR processing
│   ├── forecast-engine/       # Demand forecasting
│   └── [integration APIs]     # (Planned) CRM, Portal APIs
├── migrations/                 # Database migrations
└── config.toml                # Supabase configuration
```

---

## 6. Database Schema Overview

### Table Categories

| Category | Tables | Purpose |
|----------|--------|---------|
| **User Management** | profiles, user_roles, user_invitations, admin_ip_whitelist | Auth & access |
| **Inventory** | lots, rolls, lot_queue, incoming_stock | Stock tracking |
| **Orders** | orders, order_lots, order_queue, po_drafts | Order processing |
| **Manufacturing** | manufacturing_orders, mo_status_history | Production tracking |
| **Reservations** | reservations, reservation_lots | Stock reservations |
| **Catalog** | catalog_items, catalog_item_suppliers, catalog_custom_* | Product catalog |
| **Forecasting** | forecast_runs, forecast_results, forecast_alerts, forecast_settings_* | Demand prediction |
| **Stock Take** | count_sessions, count_rolls | Physical inventory |
| **Email** | email_templates, email_log, email_schedules, email_* | Email system |
| **Audit** | audit_logs, field_edit_queue | Audit trail |
| **Reports** | email_report_configs | Report builder |
| **Integration** | (planned) webhook_subscriptions, customers_external | Ecosystem sync |

### Key Relationships

```
lots ──┬── rolls (1:N)
       ├── order_lots (N:M via orders)
       ├── reservation_lots (N:M via reservations)
       └── goods_in_rows (N:M via goods_in_receipts)

catalog_items ──┬── catalog_item_suppliers (1:N)
                ├── catalog_custom_field_values (1:N)
                └── lots (1:N via catalog_item_id)

orders ──┬── order_lots (1:N)
         └── po_drafts (1:1)

manufacturing_orders ──┬── mo_status_history (1:N)
                       └── incoming_stock (1:N)

count_sessions ── count_rolls (1:N)

forecast_runs ──┬── forecast_results (1:N)
                └── forecast_alerts (1:N)
```

---

## 7. Edge Functions Inventory

### Current Functions (33)

| Category | Functions | Purpose |
|----------|-----------|---------|
| **Admin** | admin-change-password, admin-deactivate-user, admin-delete-user, admin-reconcile-users | User management |
| **Email Sending** | send-invitation, send-mo-reminders, send-overdue-digest, send-pending-approvals-digest, send-reservation-reminders, send-forecast-digest, send-scheduled-report, send-test-email, send-in-app-notification | Notifications |
| **Email Processing** | process-email-retries | Retry failed emails |
| **AI Extraction** | extract-order, validate-extraction, test-extraction | Order parsing |
| **OCR** | stock-take-ocr, process-ocr-queue | Label reading |
| **Forecasting** | forecast-engine, forecast-import-history | Demand prediction |
| **Reports** | generate-report-attachment, get-report-schema | Report generation |
| **Catalog** | migrate-catalog-items | Data migration |
| **Autocomplete** | autocomplete-colors, autocomplete-qualities | Search helpers |
| **Audit** | repair-audit-inconsistencies, reverse-audit-action, cleanup-old-audit-logs | Audit management |
| **CRON** | check-stock-alerts, cleanup-old-drafts | Scheduled tasks |
| **Order Flow** | confirm-draft | Order confirmation |

### Planned Integration Functions

| Function | Purpose | Consumer |
|----------|---------|----------|
| get-inventory-summary | Stock levels API | CRM, Portal |
| get-customer-orders | Order history API | CRM, Portal |
| create-order-external | Order submission API | Portal |
| get-catalog-public | Product catalog API | Portal |
| check-availability | Stock check API | Portal |
| sync-customer-from-crm | Customer sync | CRM |
| webhook-dispatcher | Event distribution | All apps |
| notify-crm | Order event push | CRM |
| search-wiki | Wiki search | Wiki |
| metrics | Health/usage metrics | Ops Console |

---

## 8. Security Architecture

### Authentication Flow

```
User Login → Supabase Auth → JWT Token (1 week exp)
                                    │
         ┌──────────────────────────┤
         │                          │
         ▼                          ▼
┌─────────────────────┐    ┌─────────────────┐
│  AuthProvider       │    │  Auto Refresh   │
│  Context            │    │  (Supabase SDK) │
└─────────────────────┘    └─────────────────┘
```

### Authorization (RBAC)

| Role | Access Level |
|------|--------------|
| **Admin** | Full system access, user management |
| **Senior Manager** | All operations, approvals, forecasting |
| **Accounting** | Orders, catalog, manufacturing, reservations |
| **Warehouse Staff** | Inventory view, lot intake, QR scanning |

### Row Level Security (RLS)

- ✅ Enabled on ALL tables
- ✅ Restrictive by default
- ✅ Role-based policies via `has_role()` function
- ⚠️ Some policies need review (rolls, goods_in_receipts)

### Integration Security (Planned)

| Mechanism | Purpose |
|-----------|---------|
| API Keys | Per-app authentication |
| HMAC Signatures | Webhook verification |
| Rate Limiting | Abuse prevention |
| Request Logging | Audit trail |

---

## 9. Deployment Architecture

### Current Deployment

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LOVABLE PLATFORM                                 │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Frontend Hosting                              │   │
│   │   • Static React build                                          │   │
│   │   • CDN distribution                                            │   │
│   │   • HTTPS by default                                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE PROJECT                                 │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                │
│   │   Database    │ │    Auth       │ │   Storage     │                │
│   │   (Postgres)  │ │   (GoTrue)    │ │   (S3-like)   │                │
│   └───────────────┘ └───────────────┘ └───────────────┘                │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    Edge Functions (Deno)                         │  │
│   │   • Auto-deployed on code push                                   │  │
│   │   • Isolated per function                                        │  │
│   │   • Access to Supabase client                                    │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Multi-Project Deployment

| Project | Frontend | Backend | Database |
|---------|----------|---------|----------|
| LotAstro WMS | Lovable | Supabase (Project A) | Postgres A |
| LotAstro CRM | Lovable | Supabase (Project B) | Postgres B |
| LotAstro Wiki | Lovable | Supabase (Project C) | Postgres C |
| AI Studio Apps | AI Studio | TBD | TBD |

**Note:** Each Supabase project has its own isolated database. Integration is via APIs, not shared databases.

---

## 10. Key Metrics

| Metric | Value |
|--------|-------|
| Database Tables | 50+ |
| Edge Functions | 33 |
| UI Components | 100+ |
| Custom Hooks | 20 |
| Translation Keys | 500+ |
| React Pages | 30+ |
| API Endpoints (planned) | 10+ |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial context documentation |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem architecture; integration layer; data ownership model |
