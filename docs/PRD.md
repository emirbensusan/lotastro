# LotAstro WMS - Product Requirements Document

> **Version**: 3.0.0  
> **Last Updated**: 2025-12-26  
> **Product Owner**: LotAstro Development Team  
> **Target Release**: Production (Continuous Deployment)  
> **Architecture**: Multi-Project Ecosystem  
> **Philosophy**: Reliability → Intelligence → Connectivity → Delight

---

## 1. Executive Summary

### Vision Statement

> **We're not here to write code. We're here to make a dent in the universe.**

**LotAstro WMS** is the **operational nervous system** for textile and leather wholesalers. It's not just warehouse software—it's an intelligent platform that transforms how businesses manage inventory, process orders, and make data-driven decisions.

Every feature is designed to be so elegant, so intuitive, so *right* that it feels inevitable.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Reliability First** | Users trust the system 100%. Data never lies. Actions never fail silently. |
| **Intelligence Everywhere** | The system does the work. Humans verify, not calculate. |
| **Connectivity By Default** | Everything talks to everything. Seamless ecosystem integration. |
| **Delightful Experience** | Users love using it. Reduces churn, not adds burden. |

### Ecosystem Context

LotAstro WMS is the **inventory and order fulfillment hub** within a larger ecosystem:

| Project | Platform | Relationship |
|---------|----------|--------------|
| **LotAstro WMS** | Lovable/Supabase | Inventory master, order fulfillment |
| **LotAstro CRM** | Lovable/Supabase | Customer master, sales pipeline |
| **LotAstro Wiki** | Lovable/Supabase | Knowledge base |
| **Customer Portal** | AI Studio | Customer-facing ordering |
| **Cost Portal** | AI Studio | Invoice management |
| **Ops Console** | AI Studio | Unified operations dashboard |

### Product Overview

LotAstro WMS provides:

- **Real-time Inventory Tracking**: Lot-level and roll-level visibility with QR code integration
- **AI-Powered Order Processing**: Automated extraction from customer POs, emails, and WhatsApp messages
- **Demand Forecasting**: Machine learning-based predictions with purchase recommendations
- **Manufacturing Order Management**: End-to-end tracking of production orders
- **Stock Take Automation**: Mobile-first camera capture with OCR for efficient physical counts
- **Multi-lingual Support**: Full English and Turkish localization
- **Ecosystem Integration**: Public APIs and webhooks for connected applications

### Business Value

| Metric | Before LotAstro | With LotAstro | Target |
|--------|-----------------|---------------|--------|
| Order Entry Time | 15-30 min/order | 2-5 min/order | 3 min |
| Stock Take Duration | 3-5 days | 1 day | 8 hours |
| Inventory Accuracy | 85-90% | 98%+ | 99% |
| OCR Accuracy (clean labels) | N/A | 70% | 95% |
| AI Extraction Accuracy | N/A | 70% | 90% |
| Stockout Incidents | Reactive | Proactive alerts | 100% proactive |
| Report Generation | Hours (manual) | Minutes (automated) | < 1 min |
| Cross-App Data Sync | Manual | Real-time via APIs | < 5 sec latency |

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

### The Four Pillars Framework

Features are organized around four strategic pillars:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PILLAR 1: RELIABILITY     │  PILLAR 2: INTELLIGENCE                        │
│  ─────────────────────     │  ─────────────────────                         │
│  • Security hardening      │  • OCR @ 95% accuracy                          │
│  • Data integrity          │  • AI extraction @ 90%                         │
│  • Error recovery          │  • Report execution                            │
│  • Offline capability      │  • Demand forecasting                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  PILLAR 3: CONNECTIVITY    │  PILLAR 4: DELIGHT                             │
│  ─────────────────────     │  ─────────────────                             │
│  • Public APIs (OpenAPI)   │  • Onboarding wizard                           │
│  • Webhook events          │  • Analytics dashboard                         │
│  • CRM integration         │  • Mobile excellence                           │
│  • Portal-ready endpoints  │  • Performance polish                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P0 - Critical (MVP - Complete)

| Feature | Description | Status |
|---------|-------------|--------|
| **User Authentication** | Secure login with email/password | ✅ Complete |
| **Role-Based Access** | 4 roles with granular permissions | ✅ Complete |
| **Inventory Management** | Lot and roll tracking | ✅ Complete |
| **QR Code System** | Generate and scan QR codes | ✅ Complete |
| **Supplier Management** | Supplier master data | ✅ Complete |
| **Order Processing** | Customer order creation | ✅ Complete |
| **Basic Reporting** | Dashboard with KPIs | ✅ Complete |

### P1 - High Priority (Complete)

| Feature | Description | Status |
|---------|-------------|--------|
| **Manufacturing Orders** | Production order tracking | ✅ Complete |
| **Reservations** | Stock reservation system | ✅ Complete |
| **Incoming Stock** | Expected delivery tracking | ✅ Complete |
| **Order Queue** | Approval workflow | ✅ Complete |
| **Email Templates** | Configurable email system | ✅ Complete |
| **Audit Logging** | Complete audit trail | ✅ Complete |
| **Legal Compliance** | Terms, Privacy, Cookies, KVKK | ✅ Complete |
| **Security Hardening** | Session timeout, password policy | ✅ Complete |
| **Integration APIs** | OpenAPI spec, API endpoints | ✅ Complete |

### P2 - Medium Priority (In Progress)

| Feature | Description | Status | Target |
|---------|-------------|--------|--------|
| **AI Order Extraction** | Parse customer POs automatically | 🔄 Needs Fix | 90% accuracy |
| **Demand Forecasting** | Predict future demand | ✅ Complete | - |
| **Stock Take OCR** | Camera capture with OCR | 🔄 Needs Fix | 95% accuracy |
| **Report Builder** | Custom report creation | 🔄 In Progress | Full execution |
| **Catalog Management** | Product catalog with custom fields | ✅ Complete | - |

### P3 - Future (Planned)

| Feature | Description | Target |
|---------|-------------|--------|
| **CRM Integration** | Bidirectional customer sync | Q1 2025 |
| **Webhook Events** | order.created, inventory.low_stock, etc. | Q1 2025 |
| **Analytics Dashboard** | Executive KPIs | Q1 2025 |
| **Onboarding Wizard** | First-login setup | Q1 2025 |
| **PWA Support** | Installable mobile app | Q2 2025 |
| **SSO/SAML** | Enterprise authentication | Q2 2025 |

---

## 4. Integration Requirements

### API Endpoints (Implemented)

| Endpoint | Method | Purpose | Consumer | Status |
|----------|--------|---------|----------|--------|
| `/api-get-inventory` | GET | Stock levels | CRM, Portal | ✅ Complete |
| `/api-get-catalog` | GET | Product catalog | Portal | ✅ Complete |
| `/api-create-order` | POST | Submit orders | Portal | ✅ Complete |
| `/webhook-dispatcher` | POST | Event distribution | All | ✅ Complete |

### API Endpoints (Planned)

| Endpoint | Method | Purpose | Consumer |
|----------|--------|---------|----------|
| `/get-customer-orders` | GET | Order history | CRM, Portal |
| `/check-availability` | GET | Real-time stock | Portal |
| `/sync-customer-from-crm` | POST | Customer data | CRM |
| `/metrics` | GET | Health/usage | Ops Console |

### Webhook Events (Planned)

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `order.created` | Order details | CRM, Ops Console |
| `order.fulfilled` | Order + shipping | CRM, Portal |
| `order.cancelled` | Order ID, reason | CRM, Portal |
| `inventory.low_stock` | Product, quantity | CRM, Ops Console |
| `inventory.updated` | Product, delta | Portal |

### OpenAPI Specification

Full API documentation available at `public/openapi.yaml`:
- OpenAPI 3.0.3 compliant
- Bearer token authentication
- Complete request/response schemas
- Error response definitions

---

## 5. Non-Functional Requirements

### Performance Requirements

| Metric | Requirement | Current | Target |
|--------|-------------|---------|--------|
| Page Load Time | < 2 seconds | ✅ Achieved | < 1.5s |
| API Response Time | < 500ms (p95) | ✅ Achieved | < 300ms |
| Concurrent Users | 50+ simultaneous | ✅ Tested | 100+ |
| Database Query Time | < 100ms (simple) | ✅ Achieved | - |
| Mobile Performance | Smooth 60fps | ✅ Achieved | - |
| Integration API Response | < 1 second | ✅ Achieved | < 500ms |

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
| **Password Policy** | Configurable strength requirements | ✅ Complete |
| **XSS Protection** | DOMPurify sanitization | ✅ Complete |
| **CRON Security** | Secret validation on all functions | ✅ Complete |
| **API Authentication** | Per-app API keys | ✅ Complete |
| **Webhook Signatures** | HMAC verification | ✅ Complete |
| **MFA/2FA** | Multi-factor authentication | 🔄 Components ready |
| **Rate Limiting** | Login attempt limiting | 🔄 Hook exists |

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
| Custom Hooks | 25+ | Reusable logic |
| Context Providers | 5 | Global state |
| Edge Functions | 38 | Backend logic |
| Database Tables | 55+ | Data storage |
| Database Functions | 15+ | Business logic |
| Integration APIs | 4 | Ecosystem communication |

---

## 7. Success Metrics & KPIs

### Operational Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Orders Processed/Day | - | 50+ | `orders` table count |
| AI Extraction Accuracy | ~70% | 90% | `po_draft_lines.confidence_score` |
| OCR Accuracy (clean) | ~70% | 95% | `count_rolls.ocr_confidence_score` |
| Stock Take Duration | 3 days | 8 hours | `count_sessions` timestamps |
| Forecast Accuracy | - | 80% | Predicted vs actual demand |
| System Uptime | - | 99.5% | Supabase monitoring |

### Integration Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| API Uptime | 99.9% | Edge function monitoring |
| Webhook Delivery Rate | 99.5% | Delivery success logs |
| Data Sync Latency | < 5 seconds | Event timestamps |
| Cross-App API Response | < 500ms | API response times |

### User Adoption Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Daily Active Users | 10+ | Auth session logs |
| Mobile Usage | 40% | User agent analysis |
| Feature Adoption | 70% per module | Page view analytics |
| User Satisfaction | 4.5/5 | In-app feedback |

---

## 8. Release Plan

### Phase 1: Core WMS ✅ Complete

**Status**: Completed  
**Focus**: Essential warehouse operations

- ✅ User management with RBAC
- ✅ Inventory (lots, rolls, suppliers)
- ✅ Order processing
- ✅ QR code system
- ✅ Basic reporting
- ✅ Legal compliance
- ✅ Security hardening

### Phase 2: Advanced Features 🔄 In Progress

**Status**: Current  
**Focus**: Automation and intelligence

| Feature | Status |
|---------|--------|
| AI Order Extraction | 🔄 Needs accuracy fix |
| Manufacturing Orders | ✅ Complete |
| Reservations | ✅ Complete |
| Forecasting | ✅ Complete |
| Stock Take OCR | 🔄 Needs accuracy fix |
| Report Builder | 🔄 Needs execution engine |
| Email System | ✅ Complete |
| Integration APIs | ✅ Foundation complete |

### Phase 3: Integration Layer 📅 Planned

**Timeline**: Q1 2025  
**Focus**: Ecosystem connectivity

| Feature | Target |
|---------|--------|
| Complete Webhook Events | Week 8-9 |
| CRM Integration | Week 9-10 |
| Wiki Integration | Week 10 |
| Portal APIs | Week 10-11 |

### Phase 4: User Delight 📅 Planned

**Timeline**: Q1 2025  
**Focus**: Adoption and experience

| Feature | Target |
|---------|--------|
| Onboarding Wizard | Week 11 |
| Analytics Dashboard | Week 12 |
| Mobile PWA | Week 13 |
| Performance Polish | Week 14 |

---

## 9. Production Readiness Status

### Current Assessment

| Category | Status | Score |
|----------|--------|-------|
| **Overall Verdict** | ✅ Ready for Production | 3.8/5 |
| Engineering & Infrastructure | Excellent | 4.0/5 |
| Security | Good (MFA pending) | 3.5/5 |
| Compliance | Complete | 4.0/5 |
| Business Continuity | Good | 3.5/5 |
| UX & Adoption | Excellent | 4.5/5 |
| Integrations | Foundation complete | 3.5/5 |

### Resolved Blockers ✅

| Issue | Category | Status |
|-------|----------|--------|
| Missing CRON_SECRET validation | Security | ✅ Fixed |
| XSS vulnerabilities | Security | ✅ Fixed |
| Missing Terms of Service | Compliance | ✅ Fixed |
| Missing Privacy Policy | Compliance | ✅ Fixed |
| Missing Cookie Consent | Compliance | ✅ Fixed |
| No session timeout config | Security | ✅ Fixed |
| No password policy config | Security | ✅ Fixed |
| No integration APIs | Ecosystem | ✅ Fixed |

### Remaining Improvements

| Issue | Category | Priority |
|-------|----------|----------|
| MFA enforcement for admins | Security | P1 |
| Rate limiting enforcement | Security | P1 |
| OCR accuracy improvement | Intelligence | P1 |
| AI extraction accuracy | Intelligence | P1 |
| Report execution engine | Intelligence | P1 |

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Lot** | A batch of fabric from a single production run |
| **Roll** | Individual roll of fabric within a lot |
| **Quality** | Fabric type/code (e.g., "SELENA", "MONTANA") |
| **Color** | Color variant of a quality |
| **MO** | Manufacturing Order - request to supplier for production |
| **Reservation** | Stock held for a customer before order confirmation |
| **Stock Take** | Physical inventory count process |
| **OCR** | Optical Character Recognition - extract text from images |
| **Webhook** | HTTP callback for event-driven integration |
| **OpenAPI** | Specification for describing REST APIs |

---

## 11. Related Documents

| Document | Purpose |
|----------|---------|
| [ROADMAP.md](./ROADMAP.md) | Development phases and timeline |
| [FEATURES.md](./FEATURES.md) | Complete feature inventory |
| [SECURITY.md](./SECURITY.md) | Security architecture |
| [API.md](./API.md) | API documentation |
| [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) | Go-live checklist |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial PRD |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem |
| 3.0.0 | 2025-12-26 | Enterprise vision; Four Pillars; Production ready status updated |
