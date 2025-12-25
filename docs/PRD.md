# LotAstro WMS - Product Requirements Document

> **Version**: 2.0.0  
> **Last Updated**: 2025-12-25  
> **Product Owner**: LotAstro Development Team  
> **Target Release**: Production (Continuous Deployment)  
> **Architecture**: Multi-Project Ecosystem

---

## 1. Executive Summary

### Vision Statement

**LotAstro WMS** is a comprehensive Warehouse Management System designed specifically for the textile and leather wholesale industry. It operates as the **inventory and order fulfillment hub** within a larger ecosystem of connected applications, replacing paper-based tracking and Excel spreadsheets with an intelligent, AI-powered platform.

### Ecosystem Context

LotAstro WMS is part of a multi-project ecosystem:

| Project | Platform | Relationship |
|---------|----------|--------------|
| **LotAstro WMS** | Lovable/Supabase | Inventory master, order fulfillment |
| **LotAstro CRM** | Lovable/Supabase | Customer master, sales pipeline |
| **LotAstro Wiki** | Lovable/Supabase | Knowledge base |
| **Customer Portal** | AI Studio | Customer-facing ordering |
| **Cost Portal** | AI Studio | Invoice management |
| **Ops Console** | AI Studio | Unified operations dashboard |
| **Route Optimizer** | AI Studio | Delivery planning |
| **SIM Ticketing** | AI Studio | Support tickets |

### Product Overview

LotAstro WMS provides:

- **Real-time Inventory Tracking**: Lot-level and roll-level visibility with QR code integration
- **AI-Powered Order Processing**: Automated extraction from customer POs, emails, and WhatsApp messages
- **Demand Forecasting**: Machine learning-based predictions with purchase recommendations
- **Manufacturing Order Management**: End-to-end tracking of production orders
- **Stock Take Automation**: Mobile-first camera capture with OCR for efficient physical counts
- **Multi-lingual Support**: Full English and Turkish localization
- **Ecosystem Integration**: APIs and webhooks for connected applications

### Business Value

| Metric | Before LotAstro | With LotAstro |
|--------|-----------------|---------------|
| Order Entry Time | 15-30 min/order | 2-5 min/order |
| Stock Take Duration | 3-5 days | 1 day |
| Inventory Accuracy | 85-90% | 98%+ |
| Stockout Incidents | Reactive | Proactive alerts |
| Report Generation | Hours (manual) | Minutes (automated) |
| Cross-App Data Sync | Manual | Real-time via APIs |

---

## 2. Problem Statement

### Industry Context

The textile and leather wholesale industry operates with:
- **High SKU Complexity**: Thousands of quality×color combinations
- **Lot-Based Tracking**: Same product from different production batches must be tracked separately
- **Roll-Level Precision**: Individual rolls within lots have varying lengths
- **Customer-Specific Requirements**: Shade matching, EU origin certification, composition tracking

### Target Users

| User Type | Primary Pain Points |
|-----------|---------------------|
| **Warehouse Staff** | Manual data entry, paper-based QR systems, slow lookups |
| **Accounting Team** | Duplicate order entry, invoice matching, reservation tracking |
| **Senior Managers** | Lack of visibility, delayed reports, stockout surprises |
| **Business Owners** | No demand forecasting, inefficient purchasing, compliance gaps |

### Current State Problems

1. **Fragmented Data**: Inventory in Excel, orders in email, manufacturing in WhatsApp
2. **Manual Entry Errors**: Typos in quality codes, wrong color assignments, meter miscalculations
3. **No Traceability**: Difficult to track lot history, audit changes, or reverse mistakes
4. **Reactive Operations**: Stockouts discovered when customer orders arrive
5. **Inefficient Stock Takes**: 3-5 days of manual counting with paper forms
6. **Language Barriers**: Turkish staff working with English-only systems
7. **Siloed Applications**: CRM, portal, and WMS don't share data

---

## 3. Feature Requirements

### P0 - Critical (MVP - Complete)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **User Authentication** | Secure login with email/password | Supabase Auth, password reset, session management |
| **Role-Based Access** | 4 roles with granular permissions | Admin, Senior Manager, Accounting, Warehouse Staff |
| **Inventory Management** | Lot and roll tracking | Create/edit/delete lots, roll-level tracking |
| **QR Code System** | Generate and scan QR codes | QR generation, camera scanner, bulk printing |
| **Supplier Management** | Supplier master data | CRUD operations, supplier-quality associations |
| **Order Processing** | Customer order creation | Manual order entry, roll selection, order numbers |
| **Basic Reporting** | Dashboard with KPIs | Statistics, inventory pivot table, Excel export |

### P1 - High Priority (Complete)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **Manufacturing Orders** | Production order tracking | MO creation, status workflow, status history |
| **Reservations** | Stock reservation system | Create/convert/release reservations |
| **Incoming Stock** | Expected delivery tracking | Track arrivals, partial receipts, MO linking |
| **Order Queue** | Approval workflow | Submit/approve/reject with notifications |
| **Email Templates** | Configurable email system | Template editor, EN/TR support, versioning |
| **Audit Logging** | Complete audit trail | Track all CRUD, user attribution, reversal |

### P2 - Medium Priority (In Progress)

| Feature | Description | Status | Acceptance Criteria |
|---------|-------------|--------|---------------------|
| **AI Order Extraction** | Parse customer POs automatically | ✅ Complete | Extract from PDF/image/text, confidence scoring |
| **Demand Forecasting** | Predict future demand | ✅ Complete | Historical import, 3 scenarios, recommendations |
| **Stock Take** | Physical inventory counting | 🔄 Partial | Session-based, OCR, admin review |
| **Report Builder** | Custom report creation | 🔄 In Progress | Data sources, filters, scheduling |
| **Catalog Management** | Product catalog with custom fields | ✅ Complete | Catalog items, approval workflow |

### P3 - Low Priority (Planned - Integration Focus)

| Feature | Description | Target |
|---------|-------------|--------|
| **Integration APIs** | APIs for ecosystem apps | Q1 2025 |
| **Webhook Events** | Event-driven sync | Q1 2025 |
| **CRM Integration** | Bidirectional customer sync | Q1 2025 |
| **Wiki Integration** | Knowledge base access | Q1 2025 |
| **Portal APIs** | Customer-facing order APIs | Q2 2025 |
| **Ops Console Metrics** | Health and usage endpoints | Q2 2025 |

**Note:** CRM, Wiki, and Customer Portal are **separate Lovable/AI Studio projects**, not modules to be built within WMS.

---

## 4. Integration Requirements (New)

### API Endpoints Required

| Endpoint | Method | Purpose | Consumer |
|----------|--------|---------|----------|
| `/get-inventory-summary` | GET | Stock levels | CRM, Portal |
| `/get-customer-orders` | GET | Order history | CRM, Portal |
| `/create-order-external` | POST | Submit orders | Portal |
| `/get-catalog-public` | GET | Product catalog | Portal |
| `/check-availability` | GET | Real-time stock | Portal |
| `/sync-customer-from-crm` | POST | Customer data | CRM |
| `/metrics` | GET | Health/usage | Ops Console |

### Webhook Events Required

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `order.created` | Order details | CRM, Ops Console |
| `order.fulfilled` | Order + shipping | CRM, Portal |
| `order.cancelled` | Order ID, reason | CRM, Portal |
| `inventory.low_stock` | Product, quantity | CRM, Ops Console |
| `inventory.updated` | Product, delta | Portal |

### Data Mapping

| Entity | WMS Field | CRM Field | Sync Direction |
|--------|-----------|-----------|----------------|
| Customer | external_customer_id | customer_id | CRM → WMS |
| Customer Name | customer_name | customer_name | CRM → WMS |
| Credit Limit | customer_credit_limit | credit_limit | CRM → WMS |
| Order Total | calculated | total_orders_value | WMS → CRM |

---

## 5. Non-Functional Requirements

### Performance Requirements

| Metric | Requirement | Current |
|--------|-------------|---------|
| Page Load Time | < 2 seconds | ✅ Achieved |
| API Response Time | < 500ms (p95) | ✅ Achieved |
| Concurrent Users | 50+ simultaneous | ✅ Tested |
| Database Query Time | < 100ms (simple), < 500ms (complex) | ✅ Achieved |
| Mobile Performance | Smooth 60fps interactions | ✅ Achieved |
| Integration API Response | < 1 second | 📅 Planned |

### Security Requirements

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Authentication** | Supabase Auth with JWT | ✅ Complete |
| **Authorization** | RBAC with 4 roles, 13 categories | ✅ Complete |
| **Data Protection** | RLS on 100% of tables | ✅ Complete |
| **Input Validation** | Zod schemas on all inputs | ✅ Complete |
| **Audit Trail** | Complete action logging | ✅ Complete |
| **Session Security** | Configurable timeout | ✅ Complete |
| **IP Restriction** | Admin IP whitelist option | ✅ Complete |
| **Password Policy** | Strength requirements enforced | ✅ Complete |
| **MFA/2FA** | Multi-factor authentication | ❌ Not Implemented |
| **Rate Limiting** | Login attempt limiting | ❌ Not Implemented |
| **XSS Protection** | DOMPurify sanitization | ❌ Not Implemented |
| **API Authentication** | Per-app API keys | 📅 Planned |
| **Webhook Signatures** | HMAC verification | 📅 Planned |

### Availability Requirements

| Metric | Target |
|--------|--------|
| Uptime | 99.5% |
| Planned Maintenance | < 4 hours/month |
| Disaster Recovery | Daily Supabase backups |
| Data Retention | 7 years for audit logs |

### Internationalization Requirements

| Requirement | Status |
|-------------|--------|
| English (EN) | ✅ Complete |
| Turkish (TR) | ✅ Complete |
| RTL Support | Not required |
| Currency | TRY, EUR, USD supported |
| Date Format | Locale-aware |
| Number Format | Locale-aware |

---

## 6. Technical Architecture Overview

### Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  React 18 + Vite + TypeScript + Tailwind + shadcn/ui            │
│  TanStack Query for state | React Router for navigation          │
├─────────────────────────────────────────────────────────────────┤
│                    SUPABASE PLATFORM                             │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │    Auth      │   Database   │   Storage    │Edge Functions│  │
│  │  (JWT/PKCE)  │ (PostgreSQL) │   (S3-like)  │   (Deno)     │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                    EXTERNAL SERVICES                             │
│  Resend (Email) │ OpenAI (Extraction) │ Tesseract (OCR)         │
├─────────────────────────────────────────────────────────────────┤
│                    ECOSYSTEM APPS                                │
│  LotAstro CRM │ LotAstro Wiki │ Customer Portal │ Ops Console   │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Count | Purpose |
|-----------|-------|---------|
| React Pages | 35+ | Route-based views |
| UI Components | 52 | shadcn/ui base library |
| Custom Components | 80+ | Feature-specific UI |
| Custom Hooks | 19 | Reusable logic |
| Context Providers | 5 | Global state |
| Edge Functions | 33 | Backend logic |
| Database Tables | 55+ | Data storage |
| Database Functions | 15+ | Business logic |
| Integration APIs (planned) | 10+ | Ecosystem communication |

---

## 7. Release Plan

### Phase 1: Core WMS ✅ Complete

**Timeline**: Completed  
**Focus**: Essential warehouse operations

- User management with RBAC
- Inventory (lots, rolls, suppliers)
- Order processing
- QR code system
- Basic reporting

### Phase 2: Advanced Features 🔄 In Progress

**Timeline**: Current  
**Focus**: Automation and intelligence

| Feature | Status |
|---------|--------|
| AI Order Extraction | ✅ Complete |
| Manufacturing Orders | ✅ Complete |
| Reservations | ✅ Complete |
| Forecasting | ✅ Complete |
| Stock Take | 🔄 In Progress |
| Report Builder | 🔄 In Progress |
| Email System | ✅ Complete |

### Phase 3: Integration Layer 📅 Planned

**Timeline**: Q1 2025  
**Focus**: Ecosystem connectivity

| Feature | Target |
|---------|--------|
| Internal APIs | Month 1 |
| Webhook Events | Month 1 |
| CRM Integration | Month 1-2 |
| Wiki Integration | Month 2 |
| Portal APIs | Month 2-3 |

### Phase 4: Enterprise & Compliance 📅 Planned

**Timeline**: Q2-Q3 2025  
**Focus**: Enterprise customers

| Feature | Target |
|---------|--------|
| SSO/SAML | Q2 2025 |
| Advanced RBAC | Q2 2025 |
| GDPR Data Export | Q2 2025 |
| Ops Console Metrics | Q2 2025 |

---

## 8. Success Metrics & KPIs

### Operational Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Orders Processed/Day | 50+ | `orders` table count |
| AI Extraction Accuracy | > 85% | `po_draft_lines.confidence_score` |
| Stock Take Duration | < 8 hours | `count_sessions` timestamps |
| Forecast Accuracy | > 80% | Predicted vs actual demand |
| System Uptime | > 99.5% | Supabase monitoring |

### Integration Metrics (New)

| Metric | Target | How Measured |
|--------|--------|--------------|
| API Uptime | > 99.9% | Edge function monitoring |
| Webhook Delivery Rate | > 99.5% | Delivery success logs |
| Data Sync Latency | < 5 seconds | Event timestamps |
| Cross-App API Response | < 500ms | API response times |

### User Adoption Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Daily Active Users | 10+ | Auth session logs |
| Mobile Usage | > 30% | User agent analysis |
| Feature Adoption | > 70% per module | Page view analytics |
| Translation Coverage | 100% | Automated check script |

---

## 9. Constraints & Assumptions

### Constraints

1. **Technology**: Must use React/Supabase stack (existing investment)
2. **Budget**: Limited external API usage (OpenAI, Vision API)
3. **Timeline**: Incremental releases, no big-bang deployments
4. **Team**: Small development team, limited capacity
5. **Architecture**: Separate projects for CRM, Wiki, Portal (not embedded modules)

### Assumptions

1. Users have reliable internet connection
2. Modern browsers (Chrome, Safari, Edge - last 2 versions)
3. Mobile devices can access camera for QR/OCR features
4. Email delivery via Resend is reliable
5. Supabase platform remains stable and supported
6. Ecosystem apps will implement required API consumers

### Dependencies

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| Supabase | Low | Strong SLA, open source fallback |
| Resend | Low | Alternative email providers available |
| OpenAI | Medium | Fallback to manual entry |
| LotAstro CRM | Medium | APIs documented, fallback to manual entry |
| AI Studio Apps | Medium | Import to Lovable if needed |

---

## 10. Production Readiness Status

### Current Assessment

| Category | Status | Score |
|----------|--------|-------|
| **Overall Verdict** | ⚠️ Conditionally Ready | 2.9/5 |
| Engineering & Infrastructure | Good | 3.5/5 |
| Security | Needs Work | 2.5/5 |
| Compliance | Critical Gaps | 1.5/5 |
| Business Continuity | Good | 3.0/5 |
| UX & Adoption | Excellent | 4.0/5 |
| Integrations | In Development | 2.5/5 |

### Critical Blockers

| Issue | Category | Priority |
|-------|----------|----------|
| Missing CRON_SECRET validation | Security | P0 |
| XSS vulnerabilities in email templates | Security | P0 |
| Missing Terms of Service page | Compliance | P0 |
| Missing Privacy Policy page | Compliance | P0 |
| Missing Cookie Consent | Compliance | P0 |
| No MFA/2FA support | Security | P1 |
| No login rate limiting | Security | P1 |
| No integration APIs | Ecosystem | P1 |

### Deployment Model

| Aspect | Current State |
|--------|---------------|
| **Architecture** | Single-tenant |
| **Multi-tenant Support** | Not implemented |
| **Tenant Isolation** | N/A (single organization) |
| **Scalability** | Supabase-managed |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Lot** | A batch of fabric from a single production run |
| **Roll** | Individual roll of fabric within a lot |
| **Quality** | Fabric type/code (e.g., "SELENA", "MONTANA") |
| **Color** | Color variant of a quality |
| **MO** | Manufacturing Order - request to supplier for production |
| **Reservation** | Stock held for a customer before order confirmation |
| **Stock Take** | Physical inventory count process |
| **Draft** | AI-extracted order pending human confirmation |
| **Catalog Item** | Product definition in the catalog |
| **Ecosystem** | The collection of LotAstro applications |
| **Integration API** | Edge function endpoint for ecosystem communication |
| **Webhook** | Event notification sent to subscriber endpoints |

---

## 12. Related Documents

| Document | Purpose |
|----------|---------|
| [PERSONAS.md](./PERSONAS.md) | User persona definitions |
| [USER-JOURNEYS.md](./USER-JOURNEYS.md) | Key user journey maps |
| [ERD.md](./ERD.md) | Database schema documentation |
| [API.md](./API.md) | API and Edge Function reference |
| [CONTEXT.md](./CONTEXT.md) | System architecture context |
| [SECURITY.md](./SECURITY.md) | Security implementation details |
| [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) | Production readiness assessment |
| [ROADMAP.md](./ROADMAP.md) | Development roadmap |
| [FEATURES.md](./FEATURES.md) | Feature inventory |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial PRD creation |
| 1.1.0 | 2025-01-10 | Added production readiness status and security requirements |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem architecture; integration requirements; removed embedded CRM/Portal modules |
