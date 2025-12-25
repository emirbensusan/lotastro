# LotAstro Development Roadmap

> **Version**: 2.0.0  
> **Last Updated**: 2025-12-25  
> **Planning Horizon**: 12 months  
> **Architecture**: Multi-Project Ecosystem

---

## 1. Ecosystem Overview

### LotAstro Project Landscape

LotAstro operates as a **multi-project ecosystem** with separate Lovable projects for different business domains, all integrated via APIs and webhooks.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOTASTRO ECOSYSTEM                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐          │
│   │  🏭 LotAstro    │   │  👥 LotAstro    │   │  📚 LotAstro    │          │
│   │     WMS         │   │     CRM         │   │     Wiki        │          │
│   │  (This Project) │   │  (Separate)     │   │  (Separate)     │          │
│   │  ───────────    │   │  ───────────    │   │  ───────────    │          │
│   │  • Inventory    │   │  • Customers    │   │  • Knowledge    │          │
│   │  • Orders       │   │  • Leads        │   │  • Training     │          │
│   │  • Stock Take   │   │  • Sales        │   │  • Procedures   │          │
│   │  • Forecasting  │   │  • Activities   │   │  • FAQs         │          │
│   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘          │
│            │                     │                     │                    │
│            └─────────────────────┼─────────────────────┘                    │
│                                  │                                          │
│                    ┌─────────────▼─────────────┐                            │
│                    │   🔗 Integration Layer    │                            │
│                    │   • Edge Function APIs    │                            │
│                    │   • Webhook Events        │                            │
│                    │   • Shared Entity IDs     │                            │
│                    └─────────────┬─────────────┘                            │
│                                  │                                          │
│   ┌─────────────────────────────┼─────────────────────────────┐            │
│   │                             │                             │            │
│   │   ┌─────────────────┐   ┌──┴──────────────┐   ┌─────────────────┐     │
│   │   │  🛒 Customer    │   │  💰 Cost        │   │  🎫 SIM         │     │
│   │   │     Portal      │   │     Portal      │   │     Ticketing   │     │
│   │   │  (AI Studio)    │   │  (AI Studio)    │   │  (AI Studio)    │     │
│   │   └─────────────────┘   └─────────────────┘   └─────────────────┘     │
│   │                                                                        │
│   │   ┌─────────────────┐   ┌─────────────────┐                           │
│   │   │  🎛️ Ops Console │   │  🚚 Route       │                           │
│   │   │  (AI Studio)    │   │    Optimizer    │                           │
│   │   │                 │   │  (AI Studio)    │                           │
│   │   └─────────────────┘   └─────────────────┘                           │
│   └─────────────────────────────────────────────────────────────────────────┘
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Classification

| Project | Platform | Backend | Status | Data Ownership |
|---------|----------|---------|--------|----------------|
| **LotAstro WMS** | Lovable | Supabase | ✅ Active | Inventory, Orders, Stock |
| **LotAstro CRM** | Lovable | Supabase | ✅ Active | Customers, Leads, Sales |
| **LotAstro Wiki** | Lovable | Supabase | ✅ Active | Knowledge Articles |
| **Customer Portal** | AI Studio | TBD | 📋 Planned | - |
| **Cost Portal** | AI Studio | TBD | 📋 Planned | Invoices |
| **SIM Ticketing** | AI Studio | TBD | 📋 Planned | Tickets |
| **Ops Console** | AI Studio | TBD | 📋 Planned | Metrics (aggregated) |
| **Route Optimizer** | AI Studio | TBD | 📋 Planned | Routes, Deliveries |

### Distributed Data Ownership

| Entity | Master System | Consumers |
|--------|---------------|-----------|
| **Inventory/Stock** | WMS | CRM, Portal, Ops Console |
| **Products/Catalog** | WMS | CRM, Portal |
| **Customers/Leads** | CRM | WMS (for orders), Portal |
| **Orders** | WMS (fulfillment) | CRM (sales view), Portal (customer view) |
| **Invoices/Costs** | Cost Portal | WMS (matching) |
| **Knowledge Articles** | Wiki | All apps |
| **Delivery Routes** | Route Optimizer | WMS |
| **Support Tickets** | Ticketing Portal | Ops Console |

---

## 2. Vision & Strategic Objectives

### Product Vision

> Transform textile/leather warehouse operations through intelligent automation, 
> real-time visibility, and predictive analytics—enabling wholesalers to scale 
> efficiently while reducing manual overhead. Operate as a connected ecosystem 
> of specialized applications sharing data seamlessly.

### Strategic Objectives (12-Month)

| Objective | Target | Metric |
|-----------|--------|--------|
| **Operational Efficiency** | 50% reduction in manual data entry | Orders processed/hour |
| **Inventory Accuracy** | 99% inventory accuracy | Stock variance rate |
| **User Adoption** | 90% daily active users | DAU/MAU ratio |
| **AI Extraction Accuracy** | 95% first-pass accuracy | AI extraction success rate |
| **Forecast Accuracy** | 85% demand forecast accuracy | MAPE |
| **Ecosystem Integration** | 100% data sync across apps | Sync success rate |

---

## 3. Current Status Summary

### Completed Modules (v1.0)

| Module | Status | Completion |
|--------|--------|------------|
| Authentication & RBAC | ✅ Complete | 100% |
| Inventory Management | ✅ Complete | 100% |
| Order Processing | ✅ Complete | 100% |
| AI Order Extraction | ✅ Complete | 100% |
| Manufacturing Orders | ✅ Complete | 100% |
| Reservations | ✅ Complete | 100% |
| Product Catalog | ✅ Complete | 100% |
| Demand Forecasting | ✅ Complete | 100% |
| Email System | ✅ Complete | 100% |
| Audit Logging | ✅ Complete | 100% |
| Admin Panel | ✅ Complete | 100% |

### In Progress

| Module | Status | Completion | ETA |
|--------|--------|------------|-----|
| Reports Builder | 🔄 In Progress | 85% | Q1 2025 |
| Stock Take (OCR) | 🔄 In Progress | 80% | Q1 2025 |

### Key Metrics (Current)

| Metric | Value |
|--------|-------|
| Database Tables | 50+ |
| Edge Functions | 33 |
| UI Components | 100+ |
| Custom Hooks | 20 |
| Translations | 500+ keys |

---

## 4. Roadmap Phases

### Phase 0A: Critical Security Fixes (Days 1-2)

**Owner:** Backend/DevOps  
**Theme:** Eliminate Critical Security Vulnerabilities  
**Exit Criteria:** All P0 security issues resolved

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| Add CRON_SECRET validation | `cleanup-old-drafts/index.ts` | P0 | XS | Backend | 🔴 Not Started |
| Add CRON_SECRET validation | `send-mo-reminders/index.ts` | P0 | XS | Backend | 🔴 Not Started |
| Configure CRON_SECRET secret | Supabase Dashboard → Secrets | P0 | XS | DevOps | 🔴 Not Started |
| Audit RLS on `rolls` table | Database → RLS Policies | P0 | S | Backend | 🔴 Not Started |
| Audit RLS on `goods_in_receipts` table | Database → RLS Policies | P0 | S | Backend | 🔴 Not Started |

**Deliverables:**
- [ ] All CRON endpoints protected with secret validation
- [ ] RLS policies verified as restrictive
- [ ] No tables with `USING condition: true` for SELECT

---

### Phase 0B: Compliance Blockers (Days 3-4)

**Owner:** Frontend  
**Theme:** Eliminate XSS Vulnerabilities  
**Exit Criteria:** All dangerouslySetInnerHTML sanitized

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| Install DOMPurify package | `package.json` | P0 | XS | Frontend | 🔴 Not Started |
| Add DOMPurify sanitization | `EmailTemplateEditor.tsx` | P0 | S | Frontend | 🔴 Not Started |
| Add DOMPurify sanitization | `EmailTemplatePreview.tsx` | P0 | S | Frontend | 🔴 Not Started |
| Add DOMPurify sanitization | `VersionHistoryDrawer.tsx` | P0 | S | Frontend | 🔴 Not Started |
| Add DOMPurify sanitization | `InlineEditableField.tsx` | P0 | S | Frontend | 🔴 Not Started |

**Deliverables:**
- [ ] All `dangerouslySetInnerHTML` uses sanitized with DOMPurify
- [ ] No raw HTML injection possible

---

### Phase 0C: OCR Pipeline Fixes (Days 5-8)

**Owner:** Full-Stack  
**Theme:** Stock Take OCR Reliability  
**Exit Criteria:** 90%+ accuracy on clean printed labels

#### Problem Statement

The Stock Take OCR module is **not working reliably** due to:
- Missing image preprocessing (resize, adaptive binarization, deskew)
- Incorrect Tesseract configuration (wrong PSM, no character whitelist)
- No preprocessing parity between client and server
- No debug tools to diagnose failures

#### Root Cause Analysis

| Failure Mode | Current Behavior | Required Fix |
|--------------|------------------|--------------|
| OCR returns garbage | Raw camera images sent to Tesseract | Add preprocessing pipeline |
| OCR very slow/timeouts | 4-8MB images processed | Resize to 1600-2000px width |
| Low confidence on labels | Global threshold, wrong PSM | Adaptive binarization, PSM=6 |
| Random character noise | No character whitelist | Add `A-Z0-9-./: ` whitelist |
| Skewed labels fail | No deskew detection | Add Hough transform deskew |

#### Task Breakdown

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| **A1: Preprocessing Pipeline** | | | | | |
| Add mandatory resize step (1800px) | `src/utils/ocrPreprocessing.ts` | P0 | S | Full-Stack | 🔴 Not Started |
| Enable adaptive binarization (Otsu) | `src/utils/ocrPreprocessing.ts` | P0 | S | Full-Stack | 🔴 Not Started |
| Add deskew detection | `src/utils/ocrPreprocessing.ts` | P1 | M | Full-Stack | 🔴 Not Started |
| Correct preprocessing order | `src/utils/ocrPreprocessing.ts` | P0 | S | Full-Stack | 🔴 Not Started |
| Add debug image saving to IndexedDB | `src/hooks/useClientOCR.ts` | P1 | S | Full-Stack | 🔴 Not Started |
| **A2: Tesseract Configuration** | | | | | |
| Set PSM=6 (SINGLE_BLOCK) | `src/hooks/useClientOCR.ts` | P0 | XS | Full-Stack | 🔴 Not Started |
| Add character whitelist | `src/hooks/useClientOCR.ts` | P0 | XS | Full-Stack | 🔴 Not Started |
| Use 'eng' language only | `src/hooks/useClientOCR.ts` | P0 | XS | Full-Stack | 🔴 Not Started |
| **A3: Server-Side Preprocessing** | | | | | |
| Add preprocessing to Edge function | `supabase/functions/stock-take-ocr/index.ts` | P1 | M | Backend | 🔴 Not Started |
| Create shared image preprocessing lib | `supabase/functions/_shared/image-preprocessing.ts` | P1 | M | Backend | 🔴 Not Started |
| **A4: Debug & Testing Tools** | | | | | |
| Create OCR Test Lab page | `src/pages/OCRTestLab.tsx` | P1 | M | Full-Stack | 🔴 Not Started |
| Add preprocessing stage visualization | `src/pages/OCRTestLab.tsx` | P1 | S | Full-Stack | 🔴 Not Started |
| Add PSM mode testing | `src/pages/OCRTestLab.tsx` | P2 | S | Full-Stack | 🔴 Not Started |

#### Preprocessing Pipeline (Correct Order)

```
1. Resize (1600-2000px width, maintain aspect ratio)
   ↓
2. Grayscale conversion
   ↓
3. Contrast enhancement (stretch histogram)
   ↓
4. Adaptive binarization (Otsu's method)
   ↓
5. Denoise (remove JPEG artifacts)
   ↓
6. Deskew (if skew > 1°)
   ↓
7. OCR with correct config
```

#### Tesseract Configuration (Required Settings)

```typescript
await worker.setParameters({
  tessedit_pageseg_mode: '6',  // PSM.SINGLE_BLOCK for labels
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./: ',
});
const worker = await Tesseract.createWorker('eng', 1, {...}); // English only
```

#### Expected Accuracy Targets

| Label Type | Target Accuracy | Notes |
|------------|-----------------|-------|
| Printed clean | 90-98% | With proper preprocessing |
| Printed faded | 75-90% | May need manual review |
| Handwritten | 20-50% | Always flag for manual review |

**Deliverables:**
- [ ] Resize step reduces images to ~1800px width
- [ ] Adaptive binarization produces clean black/white output
- [ ] PSM=6 and character whitelist configured
- [ ] OCR Test Lab shows preprocessing stages
- [ ] 90%+ accuracy on clean printed labels

---

### Phase 0D: AI Order Extraction Fixes (Days 9-14)

**Owner:** Full-Stack  
**Theme:** AI Order Extraction Reliability  
**Exit Criteria:** 85%+ combined extraction accuracy

#### Problem Statement

The AI Order Extraction from text is **not working reliably** due to:
- Incorrect regex pattern priority (overly greedy patterns match first)
- Turkish number parsing edge cases (`1.000,50` vs `1,000.50`)
- Missing header context inheritance for bullet lists
- LLM prompt complexity causing inconsistent structured output
- Merge logic conflicts between deterministic and LLM results

#### Root Cause Analysis

| Failure Mode | Current Behavior | Required Fix |
|--------------|------------------|--------------|
| Wrong quality extracted | Greedy regex matches partial codes | Reorder patterns, most specific first |
| Turkish numbers fail | `1.720` parsed as 1.72 instead of 1720 | Fix `parseTurkishNumber()` logic |
| Bullet lists lose context | "P200:" header not inherited | Add header context tracking |
| LLM returns malformed JSON | Free-form JSON parsing | Use tool-calling for structured output |
| Merge conflicts lose data | No conflict resolution logging | Add merge audit trail |

#### Task Breakdown

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| **B1: Deterministic Extraction Fixes** | | | | | |
| Reorder regex patterns (specific first) | `supabase/functions/_shared/extraction-lib.ts` | P0 | M | Backend | 🔴 Not Started |
| Fix `parseTurkishNumber()` edge cases | `supabase/functions/_shared/extraction-lib.ts` | P0 | S | Backend | 🔴 Not Started |
| Add header context inheritance | `supabase/functions/_shared/extraction-lib.ts` | P0 | M | Backend | 🔴 Not Started |
| Add confidence threshold gate (<0.6) | `supabase/functions/_shared/extraction-lib.ts` | P1 | S | Backend | 🔴 Not Started |
| **B2: LLM Integration Refactor** | | | | | |
| Switch to tool-calling for structured output | `supabase/functions/extract-order/index.ts` | P0 | L | Backend | 🔴 Not Started |
| Simplify system prompt (~30 lines) | `supabase/functions/extract-order/index.ts` | P1 | S | Backend | 🔴 Not Started |
| Add DB context validation warning | `supabase/functions/extract-order/index.ts` | P1 | XS | Backend | 🔴 Not Started |
| **B3: Merge Logic Fixes** | | | | | |
| Add conflict resolution logging | `supabase/functions/_shared/extraction-lib.ts` | P1 | S | Backend | 🔴 Not Started |
| Fix source row matching (fuzzy) | `supabase/functions/_shared/extraction-lib.ts` | P1 | M | Backend | 🔴 Not Started |
| Add merge audit trail | `supabase/functions/_shared/extraction-lib.ts` | P1 | S | Backend | 🔴 Not Started |
| **B4: Extraction Test Lab Enhancement** | | | | | |
| Show deterministic vs LLM side-by-side | `src/pages/ExtractionTest.tsx` | P1 | M | Full-Stack | 🔴 Not Started |
| Display DB context that was loaded | `src/pages/ExtractionTest.tsx` | P1 | S | Full-Stack | 🔴 Not Started |
| Show regex match details per line | `src/pages/ExtractionTest.tsx` | P2 | M | Full-Stack | 🔴 Not Started |
| Add re-run buttons (deterministic/LLM only) | `src/pages/ExtractionTest.tsx` | P2 | S | Full-Stack | 🔴 Not Started |

#### Turkish Number Parsing Rules

```typescript
// Input → Expected Output
"1.000,50" → 1000.50   // European: dots=thousands, comma=decimal
"1,000.50" → 1000.50   // US format
"1.720"    → 1720      // Ambiguous: treat as thousands if 3 digits after
"1.720 MT" → 1720      // Context: MT suffix indicates meters
"10,5 mt"  → 10.5      // Turkish decimal with context
```

#### LLM Tool-Calling Schema

```typescript
const extractionTool = {
  type: 'function',
  function: {
    name: 'extract_order_lines',
    description: 'Extract structured order lines from text',
    parameters: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              quality: { type: 'string' },
              color: { type: 'string' },
              meters: { type: 'number' },
              intent_type: { 
                type: 'string', 
                enum: ['order', 'reservation', 'stock_inquiry', 'return', 'noise']
              },
              confidence_score: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['quality', 'color', 'meters', 'intent_type']
          }
        }
      },
      required: ['lines']
    }
  }
};
```

#### Expected Accuracy Targets

| Extraction Mode | Target Accuracy | Notes |
|-----------------|-----------------|-------|
| Deterministic only | 70%+ | Pattern-matched, no LLM |
| Combined (Det + LLM) | 85%+ | LLM fills gaps |
| With manual review | 99%+ | Human verification |

**Deliverables:**
- [ ] Regex patterns ordered by specificity
- [ ] Turkish numbers parsed correctly in all formats
- [ ] Header context inherited for bullet lists
- [ ] LLM uses tool-calling for structured output
- [ ] Merge conflicts logged with audit trail
- [ ] 85%+ accuracy on typical order emails

---

### Phase 1A: Security Hardening (Week 2)

**Owner:** Backend  
**Theme:** Authentication Hardening  
**Exit Criteria:** Admin accounts protected with MFA

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Login rate limiting | Add rate limiter (5 attempts/15 min) | P1 | M | Backend | 📅 Planned |
| Password attempt lockout | Lock after 10 failed attempts for 30 min | P1 | M | Backend | 📅 Planned |
| MFA/2FA for admins | TOTP-based 2FA using Supabase Auth MFA | P1 | L | Backend | 📅 Planned |
| Session timeout config | Configurable session duration (default 8h) | P1 | S | Backend | 📅 Planned |
| Password policy enforcement | Minimum 12 chars, complexity rules | P1 | S | Backend | 📅 Planned |

**Deliverables:**
- [ ] Admin accounts require MFA
- [ ] Failed login attempts are rate-limited
- [ ] Password policy enforced on all new accounts

---

### Phase 1B: Legal & Compliance Pages (Week 1)

**Owner:** Frontend/Legal  
**Theme:** Legal Compliance  
**Exit Criteria:** Legal pages live and accessible

| Task | Route | Priority | Effort | Owner | Status |
|------|-------|----------|--------|-------|--------|
| Create Terms of Service page | `/terms` | P0 | M | Frontend | 📅 Planned |
| Create Privacy Policy page | `/privacy` | P0 | M | Frontend | 📅 Planned |
| Create Cookie Policy page | `/cookies` | P1 | S | Frontend | 📅 Planned |
| Implement cookie consent banner | Global component | P0 | M | Frontend | 📅 Planned |
| Add legal links to footer | Layout component | P1 | XS | Frontend | 📅 Planned |
| Create KVKK compliance notice | `/kvkk` (Turkey specific) | P1 | S | Frontend | 📅 Planned |

**Deliverables:**
- [ ] Terms, Privacy pages accessible
- [ ] Cookie consent shown on first visit
- [ ] Consent stored and respected

---

### Phase 1C: Core Features Completion (Weeks 2-3)

**Owner:** Full-Stack  
**Theme:** Complete MVP Features  
**Exit Criteria:** Reports & Stock Take fully functional

| Task | Module | Priority | Effort | Owner | Status |
|------|--------|----------|--------|-------|--------|
| Complete Report Builder | Reports | P1 | L | Full-Stack | 🔄 In Progress |
| Complete Stock Take OCR flow | Stock Take | P1 | L | Full-Stack | 🔄 In Progress |
| Fix mobile performance issues | Mobile UX | P1 | M | Frontend | 📅 Planned |
| Add error boundaries to all pages | Error Handling | P1 | S | Frontend | 📅 Planned |
| Complete i18n translations (TR) | I18n | P1 | M | Frontend | 📅 Planned |

**Deliverables:**
- [ ] Report Builder can create/save/execute reports
- [ ] Stock Take OCR processes images and extracts data
- [ ] Mobile pages load < 2 seconds

---

### Phase 1D: Operational Readiness (Week 2)

**Owner:** DevOps/Ops  
**Theme:** Production Operations  
**Exit Criteria:** Disaster recovery tested

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Test backup restoration | Restore from Supabase backup to staging | P1 | M | DevOps | 📅 Planned |
| Create incident runbook | Document response procedures | P1 | M | Ops | 📅 Planned |
| Set up monitoring alerts | Supabase dashboard + Resend delivery | P1 | M | DevOps | 📅 Planned |
| Document deployment process | GitHub → Supabase deployment | P1 | S | DevOps | 📅 Planned |
| Create on-call rotation | Define responsibilities | P2 | S | Ops | 📅 Planned |

**Deliverables:**
- [ ] Backup restore tested successfully
- [ ] Runbook covers top 10 incident types
- [ ] Alerts configured for downtime/errors

---

### Phase 2A: Integration Layer - Internal APIs (Month 1, Weeks 1-2)

**Owner:** Backend  
**Theme:** WMS Exposes APIs for Ecosystem  
**Exit Criteria:** CRM can query WMS via API

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `get-inventory-summary` Edge Function | Returns stock levels for CRM/Portal | P1 | M | Backend | 📅 Planned |
| Create `get-customer-orders` Edge Function | Returns orders for a customer ID | P1 | M | Backend | 📅 Planned |
| Create `create-order-external` Edge Function | Accepts orders from Portal/CRM | P1 | L | Backend | 📅 Planned |
| Create `get-catalog-public` Edge Function | Returns product catalog for Portal | P1 | M | Backend | 📅 Planned |
| Implement API key authentication | Service-to-service auth tokens | P1 | M | Backend | 📅 Planned |
| Add request logging for integrations | Audit trail for API calls | P1 | S | Backend | 📅 Planned |
| Create OpenAPI spec | Document all integration endpoints | P2 | M | Backend | 📅 Planned |

**New Secrets Required:**
- `CRM_API_KEY` - for CRM to call WMS
- `PORTAL_API_KEY` - for Ordering Portal to call WMS
- `OPS_CONSOLE_API_KEY` - for Ops Console to call WMS

**Deliverables:**
- [ ] CRM can query WMS inventory via API
- [ ] Portal can submit orders to WMS
- [ ] All API calls logged and auditable

---

### Phase 2B: Integration Layer - Webhooks (Month 1, Weeks 2-3)

**Owner:** Backend  
**Theme:** Event-Driven Sync  
**Exit Criteria:** Order events delivered to CRM

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `webhook-dispatcher` Edge Function | Sends events to registered endpoints | P1 | L | Backend | 📅 Planned |
| Create `webhook_subscriptions` table | Stores endpoint URLs per event type | P1 | S | Backend | 📅 Planned |
| Implement order created webhook | Notifies CRM when order created | P1 | M | Backend | 📅 Planned |
| Implement order fulfilled webhook | Notifies CRM/Portal when order shipped | P1 | M | Backend | 📅 Planned |
| Implement stock alert webhook | Notifies when stock low | P1 | M | Backend | 📅 Planned |
| Implement inventory change webhook | Notifies on stock movements | P2 | M | Backend | 📅 Planned |
| Add webhook retry with backoff | Handle failed deliveries | P1 | M | Backend | 📅 Planned |
| Add webhook signature verification | HMAC signing for security | P1 | M | Backend | 📅 Planned |

**Webhook Events:**

| Event | Payload | Subscribers |
|-------|---------|-------------|
| `order.created` | Order details | CRM, Ops Console |
| `order.fulfilled` | Order + shipping | CRM, Portal |
| `order.cancelled` | Order ID, reason | CRM, Portal |
| `inventory.low_stock` | Product, quantity | CRM, Ops Console |
| `inventory.updated` | Product, delta | Portal |
| `customer.created` | Customer details | WMS (from CRM) |

**Deliverables:**
- [ ] Webhook subscriptions configurable per tenant
- [ ] Failed webhooks retry with exponential backoff
- [ ] Webhook deliveries logged

---

### Phase 2C: CRM Integration (Month 1, Weeks 3-4)

**Owner:** Backend/CRM Team  
**Theme:** Bidirectional Sync with CRM  
**Exit Criteria:** Orders display CRM customer info

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `sync-customer-from-crm` Edge Function | Receives customer data from CRM | P1 | M | Backend | 📅 Planned |
| Create `customers_external` table | Stores CRM customer references | P1 | S | Backend | 📅 Planned |
| Map CRM customer_id to WMS orders | Link orders to CRM customers | P1 | M | Backend | 📅 Planned |
| Create customer sync job | Periodic full sync with CRM | P2 | M | Backend | 📅 Planned |
| Add customer context to order views | Show CRM data in WMS UI | P2 | M | Frontend | 📅 Planned |
| Create `notify-crm` Edge Function | Push order events to CRM | P1 | M | Backend | 📅 Planned |

**Data Mapping:**

| CRM Field | WMS Field | Sync Direction |
|-----------|-----------|----------------|
| `customer_id` | `external_customer_id` | CRM → WMS |
| `customer_name` | `customer_name` | CRM → WMS |
| `credit_limit` | `customer_credit_limit` | CRM → WMS |
| `order_history` | - | WMS → CRM |
| `total_orders_value` | - | WMS → CRM |

**Deliverables:**
- [ ] Orders display CRM customer info
- [ ] CRM receives order notifications
- [ ] Customer credit limits enforced in WMS

---

### Phase 2D: Wiki Integration (Month 2, Week 1)

**Owner:** Full-Stack  
**Theme:** Knowledge Base Accessibility  
**Exit Criteria:** Wiki searchable from WMS

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `search-wiki` Edge Function | Search wiki from WMS | P2 | M | Backend | 📅 Planned |
| Add help icon linking to wiki | Contextual help in WMS UI | P2 | M | Frontend | 📅 Planned |
| Create `get-article` Edge Function | Fetch specific wiki article | P2 | M | Backend | 📅 Planned |
| Add in-app wiki panel | Slide-out panel with wiki content | P2 | L | Frontend | 📅 Planned |

**Deliverables:**
- [ ] Users can search wiki from WMS header
- [ ] Help icons link to relevant wiki articles

---

### Phase 2E: AI Studio Import Preparation (Month 2, Weeks 2-3)

**Owner:** Full-Stack  
**Theme:** Ready to Import AI Studio Projects  
**Exit Criteria:** API contracts documented

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Document Ordering Portal API requirements | What WMS needs to expose | P1 | M | PM/Docs | 📅 Planned |
| Document Cost Portal integration points | Invoice matching requirements | P2 | M | PM/Docs | 📅 Planned |
| Document Route Optimizer data needs | Delivery address, order weights | P2 | M | PM/Docs | 📅 Planned |
| Create integration readiness checklist | Pre-import requirements | P1 | S | PM | 📅 Planned |
| Design Ops Console dashboard requirements | What metrics each app must expose | P1 | M | PM | 📅 Planned |

**Ops Console Requirements:**

| Metric | Source App | Endpoint Needed |
|--------|------------|-----------------|
| Active users | All apps | `/metrics/users` |
| Error rates | All apps | `/metrics/errors` |
| Order volume | WMS | `/metrics/orders` |
| Lead pipeline | CRM | `/metrics/leads` |
| Ticket queue | Ticketing | `/metrics/tickets` |

**Deliverables:**
- [ ] API contracts documented for each AI Studio app
- [ ] Import priority list created

---

### Phase 3A: External Portal APIs (Month 2-3)

**Owner:** Backend  
**Theme:** Portal Can Operate Independently  
**Exit Criteria:** Portal displays live inventory

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `get-products-public` API | Public product catalog for Portal | P1 | M | Backend | 📅 Planned |
| Create `check-availability` API | Real-time stock check | P1 | M | Backend | 📅 Planned |
| Create `submit-order` API | Customer order submission | P1 | L | Backend | 📅 Planned |
| Create `get-order-status` API | Order tracking for customers | P1 | M | Backend | 📅 Planned |
| Create `get-customer-history` API | Past orders for logged-in customers | P2 | M | Backend | 📅 Planned |
| Implement customer authentication | JWT tokens for Portal users | P1 | L | Backend | 📅 Planned |

**Deliverables:**
- [ ] Portal can display live inventory
- [ ] Portal can submit orders to WMS
- [ ] Customers can track order status

---

### Phase 3B: Compliance & Audit (Month 3)

**Owner:** Legal/Backend  
**Theme:** Full Regulatory Compliance  
**Exit Criteria:** GDPR/KVKK requirements met

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| KVKK data inventory | Document all personal data | P1 | L | Legal | 📅 Planned |
| Implement data export | User can download their data | P1 | L | Full-Stack | 📅 Planned |
| Implement data deletion | Right to be forgotten | P1 | L | Full-Stack | 📅 Planned |
| Create DPA for Supabase | Data Processing Agreement | P1 | M | Legal | 📅 Planned |
| Create DPA for Resend | Data Processing Agreement | P1 | M | Legal | 📅 Planned |
| Add consent tracking | Track what users consented to | P1 | M | Full-Stack | 📅 Planned |
| Penetration test | External security audit | P1 | XL | External | 📅 Planned |

**Deliverables:**
- [ ] GDPR/KVKK data subject rights implemented
- [ ] DPAs signed with all vendors
- [ ] Pen test completed, findings remediated

---

### Phase 3C: Enterprise Features (Month 4-5)

**Owner:** Full-Stack  
**Theme:** Enterprise Customer Support  
**Exit Criteria:** Enterprise SSO operational

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| SSO/SAML integration | Enterprise identity providers | P2 | XL | Backend | 📅 Planned |
| Advanced role permissions | Custom role creation | P2 | L | Full-Stack | 📅 Planned |
| Audit log export | Compliance reporting | P2 | M | Full-Stack | 📅 Planned |
| API rate limiting tiers | Different limits per customer | P2 | M | Backend | 📅 Planned |
| White-label support | Custom branding | P3 | XL | Full-Stack | 📅 Planned |

**Deliverables:**
- [ ] Enterprise SSO works with Azure AD, Okta
- [ ] Custom roles can be created by admins

---

### Phase 3D: Ops Console Foundation (Month 5-6)

**Owner:** Full-Stack  
**Theme:** Central Management Dashboard  
**Exit Criteria:** Ops Console displays unified metrics

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create `/metrics` endpoint in WMS | Health and usage metrics | P2 | M | Backend | 📅 Planned |
| Create `/metrics` endpoint in CRM | Health and usage metrics | P2 | M | Backend | 📅 Planned |
| Create `/metrics` endpoint in Wiki | Health and usage metrics | P2 | S | Backend | 📅 Planned |
| Design Ops Console data model | Central dashboard schema | P2 | M | PM | 📅 Planned |
| Import Ops Console from AI Studio | Convert to Lovable project | P2 | XL | Full-Stack | 📅 Planned |
| Connect Ops Console to all apps | Integration wiring | P2 | L | Full-Stack | 📅 Planned |

**Deliverables:**
- [ ] All apps expose `/metrics` endpoint
- [ ] Ops Console displays unified dashboard

---

## 5. Integration Strategy

### Recommended Approach: Edge Function API Gateway + Webhook Sync

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **FDW (Foreign Data Wrapper)** | Real-time queries, SQL-native | Complex setup, connection limits, security exposure | ❌ Not recommended |
| **Direct DB Links** | Fast, consistent | Couples databases, scaling issues | ❌ Not recommended |
| **Edge Function APIs** | Decoupled, secure, scalable | Latency, eventual consistency | ✅ **Recommended** |
| **Webhook Sync** | Event-driven, real-time updates | Complexity, retry handling needed | ✅ **Recommended** |

### Hybrid Strategy

- **Edge Functions** for on-demand data queries (e.g., "get customer details")
- **Webhooks** for event-driven sync (e.g., "order created" → notify CRM)
- **Shared Entity IDs** using UUIDs that work across all systems

---

## 6. Removed vs. Added Phases

### ❌ Removed (Exist as Separate Projects)

| Previously Planned | New Status | Reason |
|--------------------|------------|--------|
| CRM Module Development | Removed | Exists as LotAstro CRM project |
| Customer Ordering Portal | Removed | Exists as AI Studio project |
| Wiki/Knowledge Base | Removed | Exists as LotAstro Wiki project |
| Supplier Portal | Removed | Can be AI Studio project |

### ✅ Added (Integration Focus)

| New Phase | Description |
|-----------|-------------|
| **Phase 2A:** Internal API Layer | WMS exposes APIs for CRM/Portal |
| **Phase 2B:** Webhook Event System | Event-driven sync between apps |
| **Phase 2C:** CRM Integration | Bidirectional data sync |
| **Phase 2D:** Wiki Integration | Knowledge base accessibility |
| **Phase 2E:** AI Studio Import Prep | Prepare for importing AI Studio apps |
| **Phase 3A:** Portal API Layer | APIs for customer-facing portal |
| **Phase 3D:** Ops Console Foundation | Central management dashboard |

---

## 7. Priority Definitions

| Priority | Definition | SLA |
|----------|------------|-----|
| **P0** | Critical - Blocks core workflow or security blocker | This sprint |
| **P1** | High - Significant business value | This quarter |
| **P2** | Medium - Nice to have | Next quarter |
| **P3** | Low - Future consideration | Backlog |

### Effort Definitions

| Effort | Definition | Time |
|--------|------------|------|
| **XS** | Trivial | < 1 day |
| **S** | Small | 1-3 days |
| **M** | Medium | 1-2 weeks |
| **L** | Large | 2-4 weeks |
| **XL** | Extra Large | 1+ months |

---

## 8. Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| **0A-0B** | Days 1-4 | Security & XSS fixes |
| **0C** | Days 5-8 | OCR pipeline fixes (Stock Take) |
| **0D** | Days 9-14 | AI order extraction fixes |
| **1A-1D** | Weeks 2-3 | Auth hardening, legal, ops |
| **1C** | Weeks 3-4 | Reports, Stock Take complete |
| **2A-2B** | Month 2 | API layer + webhooks |
| **2C-2E** | Month 3 | CRM/Wiki integration, AI Studio prep |
| **3A-3B** | Month 4 | Portal APIs, compliance |
| **3C-3D** | Months 5-7 | Enterprise, Ops Console |

---

## 9. Risk Assessment

### Security Risks

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| CRON job abuse | High | High | Add CRON_SECRET validation | 🔴 Open |
| XSS via email templates | Medium | High | Add DOMPurify sanitization | 🔴 Open |
| Account takeover (no MFA) | Medium | Critical | Implement MFA | 📅 Planned |
| Brute force login | Medium | High | Add rate limiting | 📅 Planned |
| Public data exposure | Medium | Critical | Review RLS policies | 🔴 Open |
| API abuse between apps | Medium | Medium | API key rotation, rate limits | 📅 Planned |

### Integration Risks

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| CRM sync failures | Medium | High | Retry queue, alerting | 📅 Planned |
| Webhook delivery failures | Medium | Medium | Exponential backoff, dead letter queue | 📅 Planned |
| API versioning conflicts | Low | Medium | Versioned endpoints, deprecation policy | 📅 Planned |
| Data consistency across apps | Medium | High | Event sourcing, reconciliation jobs | 📅 Planned |

### Compliance Risks

| Risk | Probability | Impact | Mitigation | Status |
|------|-------------|--------|------------|--------|
| GDPR violation | High | Critical | Add legal pages, data export | 🔴 Open |
| KVKK violation (Turkey) | High | Critical | Turkish compliance audit | 📅 Planned |

---

## 10. Success Metrics

### Integration Metrics (New)

| Metric | Target | How Measured |
|--------|--------|--------------|
| API uptime | 99.9% | Edge function monitoring |
| Webhook delivery rate | 99.5% | Delivery success logs |
| Data sync latency | < 5 seconds | Event timestamps |
| Cross-app search response | < 500ms | API response times |

### Production Readiness Milestones

| Milestone | Date | Requirements | Status |
|-----------|------|--------------|--------|
| **Security Fixes** | Week 1 | Phase 0A complete | 🔴 Not Started |
| **Legal Compliance** | Week 1 | Phase 1B complete | 📅 Planned |
| **MVP Features** | Week 3 | Phase 1C complete | 🔄 In Progress |
| **Integration Ready** | Month 2 | Phase 2A-2C complete | 📅 Planned |
| **Enterprise Ready** | Month 5 | Phase 3C complete | 📅 Planned |

---

## Appendix A: Document References

| Document | Purpose |
|----------|---------|
| [SECURITY.md](./SECURITY.md) | Security implementation details |
| [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) | Production readiness assessment |
| [FEATURES.md](./FEATURES.md) | Feature inventory |
| [CONTEXT.md](./CONTEXT.md) | System architecture |
| [PRD.md](./PRD.md) | Product requirements |
| [API.md](./API.md) | API documentation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial roadmap creation |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem architecture; removed CRM/Portal creation; added integration phases |
| 2.1.0 | 2025-12-25 | Added Phase 0C (OCR Pipeline Fixes) and Phase 0D (AI Extraction Fixes) for QA/refactoring |
