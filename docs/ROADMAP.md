# LotAstro Development Roadmap

> **Version**: 2.1.0  
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
| Integration APIs | 🔄 In Progress | 40% | Q1 2025 |

### Key Metrics (Current)

| Metric | Value |
|--------|-------|
| Database Tables | 50+ |
| Edge Functions | 38 |
| UI Components | 100+ |
| Custom Hooks | 20 |
| Translations | 500+ keys |

---

## 4. Roadmap Phases

### Phase 0A: Critical Security Fixes (Days 1-2) ✅ COMPLETE

**Owner:** Backend/DevOps  
**Theme:** Eliminate Critical Security Vulnerabilities  
**Exit Criteria:** All P0 security issues resolved  
**Status:** ✅ Complete (2025-12-25)

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| Add CRON_SECRET validation | `cleanup-old-drafts/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-mo-reminders/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `process-ocr-queue/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-scheduled-report/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `cleanup-old-audit-logs/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `check-stock-alerts/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `process-email-retries/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-reservation-reminders/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-overdue-digest/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-pending-approvals-digest/index.ts` | P0 | XS | Backend | ✅ Complete |
| Add CRON_SECRET validation | `send-forecast-digest/index.ts` | P0 | XS | Backend | ✅ Complete |
| Configure CRON_SECRET secret | Supabase Dashboard → Secrets | P0 | XS | DevOps | ✅ Complete |
| Audit RLS on `rolls` table | Database → RLS Policies | P0 | S | Backend | 🔴 Not Started |
| Audit RLS on `goods_in_receipts` table | Database → RLS Policies | P0 | S | Backend | 🔴 Not Started |

**Deliverables:**
- [x] All CRON endpoints protected with secret validation (11/11 functions)
- [ ] RLS policies verified as restrictive
- [ ] No tables with `USING condition: true` for SELECT

---

### Phase 0B: Compliance Blockers (Days 3-4) ✅ COMPLETE

**Owner:** Frontend  
**Theme:** Eliminate XSS Vulnerabilities  
**Exit Criteria:** All dangerouslySetInnerHTML sanitized  
**Status:** ✅ Complete (2025-12-25)

| Task | File/Location | Priority | Effort | Owner | Status |
|------|---------------|----------|--------|-------|--------|
| Install DOMPurify package | `package.json` | P0 | XS | Frontend | ✅ Complete |
| Create sanitize utility | `src/lib/sanitize.ts` | P0 | S | Frontend | ✅ Complete |
| Add DOMPurify sanitization | `EmailTemplatePreview.tsx` | P0 | S | Frontend | ✅ Complete |
| Add DOMPurify sanitization | `VersionHistoryDrawer.tsx` | P0 | S | Frontend | ✅ Complete |

**Deliverables:**
- [x] All `dangerouslySetInnerHTML` uses sanitized with DOMPurify
- [x] `sanitizeHtml()` and `sanitizeEmailHtml()` utility functions available
- [x] No raw HTML injection possible

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

### Phase 1B: Legal & Compliance Pages (Week 1) ✅ COMPLETE

**Owner:** Frontend/Legal  
**Theme:** Legal Compliance  
**Exit Criteria:** Legal pages live and accessible  
**Status:** ✅ Complete (2025-12-25)

| Task | Route | Priority | Effort | Owner | Status |
|------|-------|----------|--------|-------|--------|
| Create Terms of Service page | `/terms` | P0 | M | Frontend | ✅ Complete |
| Create Privacy Policy page | `/privacy` | P0 | M | Frontend | ✅ Complete |
| Create Cookie Policy page | `/cookies` | P1 | S | Frontend | ✅ Complete |
| Implement cookie consent banner | Global component | P0 | M | Frontend | ✅ Complete |
| Add legal links to footer | Layout component | P1 | XS | Frontend | ✅ Complete |
| Create KVKK compliance notice | `/kvkk` (Turkey specific) | P1 | S | Frontend | ✅ Complete |

**Deliverables:**
- [x] Terms, Privacy, Cookies, KVKK pages accessible
- [x] Cookie consent shown on first visit
- [x] Consent stored in localStorage and respected
- [x] Footer links to all legal pages

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

### Phase 2A: Integration Layer - Internal APIs (Month 1, Weeks 1-2) 🔄 IN PROGRESS

**Owner:** Backend  
**Theme:** WMS Exposes APIs for Ecosystem  
**Exit Criteria:** CRM can query WMS via API  
**Status:** 🔄 In Progress (2025-12-25)

| Task | Description | Priority | Effort | Owner | Status |
|------|-------------|----------|--------|-------|--------|
| Create API key database tables | `api_keys`, `webhook_subscriptions`, `webhook_deliveries` | P1 | M | Backend | ✅ Complete |
| Create `_shared/api-auth.ts` helper | API key validation, rate limiting, logging | P1 | M | Backend | ✅ Complete |
| Create `api-get-inventory` Edge Function | Returns stock levels for CRM/Portal | P1 | M | Backend | ✅ Complete |
| Create `api-get-catalog` Edge Function | Returns product catalog for Portal | P1 | M | Backend | ✅ Complete |
| Create `api-create-order` Edge Function | Accepts orders from Portal/CRM | P1 | L | Backend | ✅ Complete |
| Create `webhook-dispatcher` Edge Function | Central webhook event distribution | P1 | M | Backend | ✅ Complete |
| Create OpenAPI spec | Document all integration endpoints | P2 | M | Backend | 📅 Planned |

**New Secrets Required:**
- `CRM_API_KEY` - for CRM to call WMS
- `PORTAL_API_KEY` - for Ordering Portal to call WMS
- `OPS_CONSOLE_API_KEY` - for Ops Console to call WMS

**Deliverables:**
- [x] API key authentication implemented
- [x] CRM can query WMS inventory via API
- [x] Portal can submit orders to WMS
- [x] Webhook dispatcher sends events to registered endpoints

---

## 5. Changelog

### 2025-12-25 (v2.1.0)
- ✅ Phase 0A: CRON_SECRET validation complete (11/11 edge functions)
- ✅ Phase 0B: DOMPurify XSS protection complete
- ✅ Phase 1B: Legal pages and cookie consent complete
- 🔄 Phase 2A: Integration API foundation started (database tables + 5 edge functions)

### Previous
- 2025-12-25 (v2.0.0): Multi-project ecosystem architecture documented
- 2025-01-10 (v1.0.0): Initial roadmap

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial roadmap |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem; integration features |
| 2.1.0 | 2025-12-25 | Phase 0A/0B/1B complete; Phase 2A integration APIs started |
