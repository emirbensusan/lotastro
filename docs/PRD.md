# LotAstro WMS - Product Requirements Document

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Product Owner**: LotAstro Development Team  
> **Target Release**: Production (Continuous Deployment)

---

## 1. Executive Summary

### Vision Statement

**LotAstro WMS** is a comprehensive Warehouse Management System designed specifically for the textile and leather wholesale industry. Our mission is to digitize and automate warehouse operations, replacing paper-based tracking and Excel spreadsheets with an intelligent, AI-powered platform that scales with business growth.

### Product Overview

LotAstro WMS transforms how textile/leather wholesalers manage their inventory by providing:

- **Real-time Inventory Tracking**: Lot-level and roll-level visibility with QR code integration
- **AI-Powered Order Processing**: Automated extraction from customer POs, emails, and WhatsApp messages
- **Demand Forecasting**: Machine learning-based predictions with purchase recommendations
- **Manufacturing Order Management**: End-to-end tracking of production orders
- **Stock Take Automation**: Mobile-first camera capture with OCR for efficient physical counts
- **Multi-lingual Support**: Full English and Turkish localization

### Business Value

| Metric | Before LotAstro | With LotAstro |
|--------|-----------------|---------------|
| Order Entry Time | 15-30 min/order | 2-5 min/order |
| Stock Take Duration | 3-5 days | 1 day |
| Inventory Accuracy | 85-90% | 98%+ |
| Stockout Incidents | Reactive | Proactive alerts |
| Report Generation | Hours (manual) | Minutes (automated) |

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

---

## 3. Feature Requirements

### P0 - Critical (MVP - Complete)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **User Authentication** | Secure login with email/password | - Supabase Auth integration<br>- Password reset flow<br>- Session management |
| **Role-Based Access** | 4 roles with granular permissions | - Admin, Senior Manager, Accounting, Warehouse Staff<br>- 11 permission categories<br>- View As Role for testing |
| **Inventory Management** | Lot and roll tracking | - Create/edit/delete lots<br>- Roll-level tracking<br>- Warehouse location assignment |
| **QR Code System** | Generate and scan QR codes | - QR generation for lots<br>- Camera scanner integration<br>- Bulk QR printing |
| **Supplier Management** | Supplier master data | - CRUD operations<br>- Supplier-quality associations |
| **Order Processing** | Customer order creation | - Manual order entry<br>- Roll selection per lot<br>- Order number generation |
| **Basic Reporting** | Dashboard with KPIs | - Dashboard statistics<br>- Inventory pivot table<br>- Export to Excel |

### P1 - High Priority (Complete)

| Feature | Description | Acceptance Criteria |
|---------|-------------|---------------------|
| **Manufacturing Orders** | Production order tracking | - MO creation with supplier<br>- Status workflow (pending→in_production→completed)<br>- Status history with notes |
| **Reservations** | Stock reservation system | - Create reservations for customers<br>- Reserve from lots or incoming stock<br>- Convert to orders<br>- Auto-release on expiry |
| **Incoming Stock** | Expected delivery tracking | - Track expected arrivals<br>- Partial receipt handling<br>- Link to manufacturing orders |
| **Order Queue** | Approval workflow | - Submit orders for approval<br>- Approve/reject with reasons<br>- Email notifications |
| **Email Templates** | Configurable email system | - Template editor with variables<br>- EN/TR support<br>- Version history |
| **Audit Logging** | Complete audit trail | - Track all CRUD operations<br>- User attribution<br>- Reversal capability |

### P2 - Medium Priority (In Progress)

| Feature | Description | Status | Acceptance Criteria |
|---------|-------------|--------|---------------------|
| **AI Order Extraction** | Parse customer POs automatically | ✅ Complete | - Extract from PDF/image/text<br>- Quality/color/meter parsing<br>- Confidence scoring<br>- Human review before confirmation |
| **Demand Forecasting** | Predict future demand | ✅ Complete | - Historical demand import<br>- Configurable forecast engine<br>- 3 scenarios (conservative/normal/aggressive)<br>- Purchase recommendations |
| **Stock Take** | Physical inventory counting | 🔄 Partial | - Session-based counting<br>- Camera capture with OCR<br>- Admin review workflow<br>- Reconciliation |
| **Report Builder** | Custom report creation | 🔄 In Progress | - Data source selection<br>- Column browser with joins<br>- Filter builder<br>- Schedule reports |
| **Catalog Management** | Product catalog with custom fields | ✅ Complete | - Catalog items with composition<br>- Custom field definitions<br>- Approval workflow<br>- Supplier associations |

### P3 - Low Priority (Planned)

| Feature | Description | Target |
|---------|-------------|--------|
| **CRM Module** | Customer relationship management | Q2 2025 |
| **Wiki/Knowledge Base** | Internal documentation | Q2 2025 |
| **Customer Portal** | External customer access | Q3 2025 |
| **Supplier Portal** | Supplier self-service | Q3 2025 |
| **Agreements Module** | Contract management | Q4 2025 |
| **Advanced Analytics** | BI dashboards | Q4 2025 |

---

## 4. Non-Functional Requirements

### Performance Requirements

| Metric | Requirement | Current |
|--------|-------------|---------|
| Page Load Time | < 2 seconds | ✅ Achieved |
| API Response Time | < 500ms (p95) | ✅ Achieved |
| Concurrent Users | 50+ simultaneous | ✅ Tested |
| Database Query Time | < 100ms (simple), < 500ms (complex) | ✅ Achieved |
| Mobile Performance | Smooth 60fps interactions | ✅ Achieved |

### Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | Supabase Auth with JWT |
| **Authorization** | RBAC with 4 roles, 11 categories |
| **Data Protection** | RLS on 100% of tables |
| **Input Validation** | Zod schemas on all inputs |
| **Audit Trail** | Complete action logging |
| **Session Security** | Configurable timeout |
| **IP Restriction** | Admin IP whitelist option |
| **Password Policy** | Strength requirements enforced |

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

## 5. Technical Architecture Overview

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
│  Resend (Email) │ Google Vision (OCR) │ OpenAI (Extraction)     │
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

---

## 6. Release Plan

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

### Phase 3: Extended Ecosystem 📋 Planned

**Timeline**: Q2-Q4 2025  
**Focus**: External integrations

- CRM Module
- Wiki/Knowledge Base
- Customer Portal
- Supplier Portal
- Agreements Module

---

## 7. Success Metrics & KPIs

### Operational Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Orders Processed/Day | 50+ | `orders` table count |
| AI Extraction Accuracy | > 85% | `po_draft_lines.confidence_score` |
| Stock Take Duration | < 8 hours | `count_sessions` timestamps |
| Forecast Accuracy | > 80% | Predicted vs actual demand |
| System Uptime | > 99.5% | Supabase monitoring |

### User Adoption Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Daily Active Users | 10+ | Auth session logs |
| Mobile Usage | > 30% | User agent analysis |
| Feature Adoption | > 70% per module | Page view analytics |
| Translation Coverage | 100% | Automated check script |

### Business Impact Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Order Entry Time Reduction | 80% | Before/after study |
| Inventory Accuracy | 98%+ | Stock take reconciliation |
| Stockout Prevention | 90% advance warning | Forecast alerts triggered |
| Audit Compliance | 100% traceability | Audit log completeness |

---

## 8. Constraints & Assumptions

### Constraints

1. **Technology**: Must use React/Supabase stack (existing investment)
2. **Budget**: Limited external API usage (OpenAI, Vision API)
3. **Timeline**: Incremental releases, no big-bang deployments
4. **Team**: Small development team, limited capacity

### Assumptions

1. Users have reliable internet connection
2. Modern browsers (Chrome, Safari, Edge - last 2 versions)
3. Mobile devices can access camera for QR/OCR features
4. Email delivery via Resend is reliable
5. Supabase platform remains stable and supported

### Dependencies

| Dependency | Risk Level | Mitigation |
|------------|------------|------------|
| Supabase | Low | Strong SLA, open source fallback |
| Resend | Low | Alternative email providers available |
| OpenAI | Medium | Fallback to manual entry |
| Google Vision | Medium | Client-side Tesseract.js fallback |

---

## 9. Glossary

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

---

## 10. Appendix

### Related Documents

| Document | Purpose |
|----------|---------|
| [PERSONAS.md](./PERSONAS.md) | User persona definitions |
| [USER-JOURNEYS.md](./USER-JOURNEYS.md) | Key user journey maps |
| [ERD.md](./ERD.md) | Database schema documentation |
| [API.md](./API.md) | API and Edge Function reference |
| [CONTEXT.md](./CONTEXT.md) | System architecture context |
| [SECURITY.md](./SECURITY.md) | Security implementation details |
| [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) | Production readiness assessment |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial PRD creation |
| 1.1.0 | 2025-01-10 | Added production readiness status and security requirements |

---

## 11. Production Readiness Status

### Current Assessment

| Category | Status | Score |
|----------|--------|-------|
| **Overall Verdict** | ⚠️ Conditionally Ready | 2.9/5 |
| Engineering & Infrastructure | Good | 3.5/5 |
| Security | Needs Work | 2.5/5 |
| Compliance | Critical Gaps | 1.5/5 |
| Business Continuity | Good | 3.0/5 |
| UX & Adoption | Excellent | 4.0/5 |

### Critical Blockers

The following must be resolved before production deployment:

| Issue | Category | Priority |
|-------|----------|----------|
| Missing CRON_SECRET validation | Security | P0 |
| XSS vulnerabilities in email templates | Security | P0 |
| Missing Terms of Service page | Compliance | P0 |
| Missing Privacy Policy page | Compliance | P0 |
| Missing Cookie Consent | Compliance | P0 |
| No MFA/2FA support | Security | P1 |
| No login rate limiting | Security | P1 |

### Deployment Model

| Aspect | Current State |
|--------|---------------|
| **Architecture** | Single-tenant |
| **Multi-tenant Support** | Not implemented |
| **Tenant Isolation** | N/A (single organization) |
| **Scalability** | Supabase-managed |

### Security Requirements (Updated)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| **Authentication** | Supabase Auth with JWT | ✅ Complete |
| **Authorization** | RBAC with 4 roles, 13 categories | ✅ Complete |
| **Data Protection** | RLS on all tables | ✅ Complete |
| **Input Validation** | Zod schemas on all inputs | ✅ Complete |
| **Audit Trail** | Complete action logging | ✅ Complete |
| **Session Security** | Configurable timeout | ✅ Complete |
| **IP Restriction** | Admin IP whitelist option | ✅ Complete |
| **Password Policy** | Strength requirements enforced | ✅ Complete |
| **MFA/2FA** | Multi-factor authentication | ❌ Not Implemented |
| **Rate Limiting** | Login attempt limiting | ❌ Not Implemented |
| **XSS Protection** | DOMPurify sanitization | ❌ Not Implemented |
| **CRON Security** | Secret validation | ⚠️ Partial |

### Compliance Requirements (New)

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Terms of Service** | ❌ Missing | Legal page required |
| **Privacy Policy** | ❌ Missing | GDPR/KVKK requirement |
| **Cookie Consent** | ❌ Missing | EU ePrivacy requirement |
| **Data Export** | ⚠️ Partial | Manual via admin |
| **Right to Deletion** | ⚠️ Partial | admin-delete-user function |
| **Audit Retention** | ✅ Complete | 2-year retention |

See [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) for full assessment and remediation roadmap.
