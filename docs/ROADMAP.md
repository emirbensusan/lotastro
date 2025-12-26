# LotAstro Development Roadmap

> **Version**: 3.0.0  
> **Last Updated**: 2025-12-26  
> **Planning Horizon**: 14 weeks (Q1 2025)  
> **Architecture**: Multi-Project Ecosystem  
> **Philosophy**: Reliability → Intelligence → Connectivity → Delight

---

## 1. Vision Statement

> **We're not here to write code. We're here to make a dent in the universe.**

LotAstro WMS is not just warehouse software—it's the **operational nervous system** for textile and leather wholesalers. Every feature should be so elegant, so intuitive, so *right* that it feels inevitable.

### Design Principles

1. **Reliability First** – Users trust the system 100%. Data never lies. Actions never fail silently.
2. **Intelligence Everywhere** – The system does the work. Humans verify, not calculate.
3. **Connectivity By Default** – Everything talks to everything. Seamless ecosystem.
4. **Delightful Experience** – Users love using it. Reduces churn, not adds burden.

### The Four Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE FOUR PILLARS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐                                 │
│   │  🔒 RELIABILITY │   │  🧠 INTELLIGENCE│                                 │
│   │  ─────────────  │   │  ─────────────  │                                 │
│   │  • Security     │   │  • OCR @ 95%    │                                 │
│   │  • Data Integrity│  │  • AI @ 90%     │                                 │
│   │  • Error Recovery│  │  • Reports      │                                 │
│   │  • Offline Mode │   │  • Forecasting  │                                 │
│   └─────────────────┘   └─────────────────┘                                 │
│                                                                              │
│   ┌─────────────────┐   ┌─────────────────┐                                 │
│   │  🔗 CONNECTIVITY│   │  ✨ DELIGHT     │                                 │
│   │  ─────────────  │   │  ─────────────  │                                 │
│   │  • Public APIs  │   │  • Onboarding   │                                 │
│   │  • Webhooks     │   │  • Analytics    │                                 │
│   │  • CRM Sync     │   │  • Mobile UX    │                                 │
│   │  • Portal Ready │   │  • Performance  │                                 │
│   └─────────────────┘   └─────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ecosystem Overview

### LotAstro Project Landscape

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
│                    │   • OpenAPI 3.0 Spec ✅   │                            │
│                    │   • Webhook Events        │                            │
│                    │   • Shared Entity IDs     │                            │
│                    └───────────────────────────┘                            │
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

---

## 3. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| **OCR Accuracy (clean labels)** | ~70% | 95% | `count_rolls.ocr_confidence_score` |
| **AI Extraction Accuracy** | ~70% | 90% | `po_draft_lines.confidence_score` avg |
| **Stock Take Duration** | 3 days | 8 hours | `count_sessions` timestamps |
| **Order Entry Time** | 15 min | 3 min | Time from start to confirm |
| **System Uptime** | - | 99.5% | Supabase monitoring |
| **Mobile Usage** | - | 40% | User agent analysis |
| **User Satisfaction** | - | 4.5/5 | In-app feedback |

---

## 4. Current Status

### Completed Phases ✅

| Phase | Theme | Status | Completion Date |
|-------|-------|--------|-----------------|
| Phase 0A | CRON Security | ✅ Complete | 2025-12-25 |
| Phase 0B | XSS Protection | ✅ Complete | 2025-12-25 |
| Phase 1B | Legal Compliance | ✅ Complete | 2025-12-25 |
| Phase 2A.1 | Integration APIs Foundation | ✅ Complete | 2025-12-26 |
| Phase 1A | Security Hardening | ✅ Complete | 2025-12-26 |

### Completed Work Summary

- ✅ **11 CRON functions** protected with secret validation
- ✅ **DOMPurify** XSS protection on all HTML rendering
- ✅ **Legal pages**: Terms, Privacy, Cookies, KVKK
- ✅ **Cookie consent** banner with localStorage
- ✅ **Integration APIs**: `api-get-inventory`, `api-get-catalog`, `api-create-order`, `webhook-dispatcher`
- ✅ **OpenAPI 3.0 specification** at `public/openapi.yaml`
- ✅ **Session timeout** configurable via admin panel
- ✅ **Password policy** configurable via admin panel
- ✅ **MFA components** ready (`MFAEnroll.tsx`, `MFAVerify.tsx`)

---

## 5. Roadmap Phases

### PILLAR 1: RELIABILITY FOUNDATION

#### Phase 1.1: Security Hardening (Week 1) ✅ COMPLETE

**Owner:** Backend  
**Theme:** Authentication Hardening  
**Status:** ✅ Complete (2025-12-26)

| Task | Priority | Status |
|------|----------|--------|
| Session timeout configuration UI | P1 | ✅ Complete |
| Password policy configuration UI | P1 | ✅ Complete |
| System settings database table | P1 | ✅ Complete |
| Password strength on reset page | P1 | ✅ Complete |
| OpenAPI spec creation | P1 | ✅ Complete |
| API docs download button | P2 | ✅ Complete |

**Remaining Work:**
- [ ] Wire MFA enforcement for admins (`useAuth.tsx`)
- [ ] Rate limiting enforcement (wire `useLoginRateLimit.ts`)
- [ ] RLS audit on `rolls` and `goods_in_receipts` tables

---

#### Phase 1.2: Data Integrity (Week 1-2) 🔴 NOT STARTED

**Owner:** Backend  
**Theme:** Bulletproof Data

| Task | File/Location | Priority | Status |
|------|---------------|----------|--------|
| RLS policy audit - `rolls` | Database | P0 | 🔴 Not Started |
| RLS policy audit - `goods_in_receipts` | Database | P0 | 🔴 Not Started |
| Foreign key cascade review | Database | P1 | 🔴 Not Started |
| Add missing CHECK constraints | Database | P2 | 🔴 Not Started |

---

#### Phase 1.3: Error Recovery (Week 2) 🟡 PARTIAL

**Owner:** Frontend  
**Theme:** Graceful Failures

| Task | Status | Notes |
|------|--------|-------|
| ErrorBoundary component | ✅ Complete | Exists at `src/components/ErrorBoundary.tsx` |
| QueryErrorState component | ✅ Complete | Exists at `src/components/ui/query-error-state.tsx` |
| useNetworkRetry hook | ✅ Complete | Exists at `src/hooks/useNetworkRetry.ts` |
| Form draft recovery | ✅ Complete | `useFormPersistence.tsx` exists |
| Test all error paths | 🔴 Not Started | Verify error handling works |

---

#### Phase 1.4: Offline Capability (Week 3) 🔴 NOT STARTED

**Owner:** Full-Stack  
**Theme:** Work Without Internet

| Task | File/Location | Priority | Status |
|------|---------------|----------|--------|
| Create `useOfflineQueue` hook | `src/hooks/useOfflineQueue.ts` | P1 | 🔴 Not Started |
| IndexedDB mutation queue | New utility | P1 | 🔴 Not Started |
| Background sync on reconnect | Service worker | P2 | 🔴 Not Started |
| Conflict resolution UI | New component | P2 | 🔴 Not Started |
| Offline status indicator | ✅ Already in `Layout.tsx` | - | ✅ Complete |

---

### PILLAR 2: INTELLIGENCE UPGRADE

#### Phase 2.1: OCR Pipeline Overhaul (Weeks 4-5) 🔴 NOT STARTED

**Owner:** Full-Stack  
**Theme:** Stock Take OCR Reliability  
**Exit Criteria:** 95%+ accuracy on clean printed labels

##### Problem Statement

The Stock Take OCR module is **not working reliably** due to:
- Missing image preprocessing (resize, adaptive binarization, deskew)
- Incorrect Tesseract configuration (wrong PSM, no character whitelist)
- No debug tools to diagnose failures

##### Preprocessing Pipeline (Correct Order)

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

##### Tesseract Configuration

```typescript
await worker.setParameters({
  tessedit_pageseg_mode: '6',  // PSM.SINGLE_BLOCK for labels
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-./: ',
});
```

##### Task Breakdown

| Task | File | Priority | Status |
|------|------|----------|--------|
| Rewrite preprocessing pipeline | `src/utils/ocrPreprocessing.ts` | P0 | 🔴 Not Started |
| Mandatory resize to 1800px | `src/utils/ocrPreprocessing.ts` | P0 | 🔴 Not Started |
| Enable Otsu's adaptive binarization | `src/utils/ocrPreprocessing.ts` | P0 | 🔴 Not Started |
| Set PSM=6 and character whitelist | `src/hooks/useClientOCR.ts` | P0 | 🔴 Not Started |
| Create OCR Test Lab page | `src/pages/OCRTestLab.tsx` | P1 | 🔴 Not Started |
| Server-side preprocessing parity | `supabase/functions/stock-take-ocr/index.ts` | P1 | 🔴 Not Started |

---

#### Phase 2.2: AI Extraction Fixes (Weeks 5-6) 🔴 NOT STARTED

**Owner:** Full-Stack  
**Theme:** AI Order Extraction Reliability  
**Exit Criteria:** 90%+ combined extraction accuracy

##### Problem Statement

The AI Order Extraction is **not working reliably** due to:
- Incorrect regex pattern priority (greedy patterns match first)
- Turkish number parsing edge cases (`1.720` → 1720 not 1.72)
- LLM prompt complexity causing inconsistent output

##### Turkish Number Parsing Rules

```typescript
// Input → Expected Output
"1.000,50" → 1000.50   // European: dots=thousands, comma=decimal
"1,000.50" → 1000.50   // US format
"1.720"    → 1720      // Ambiguous: treat as thousands if 3 digits after
"1.720 MT" → 1720      // Context: MT suffix indicates meters
"10,5 mt"  → 10.5      // Turkish decimal with context
```

##### Task Breakdown

| Task | File | Priority | Status |
|------|------|----------|--------|
| Reorder regex patterns (specific first) | `supabase/functions/_shared/extraction-lib.ts` | P0 | 🔴 Not Started |
| Fix `parseTurkishNumber()` | `supabase/functions/_shared/extraction-lib.ts` | P0 | 🔴 Not Started |
| Add header context inheritance | `supabase/functions/_shared/extraction-lib.ts` | P0 | 🔴 Not Started |
| Switch LLM to tool-calling | `supabase/functions/extract-order/index.ts` | P0 | 🔴 Not Started |
| Add confidence threshold gate (<0.6) | `supabase/functions/_shared/extraction-lib.ts` | P1 | 🔴 Not Started |
| Enhance ExtractionTest page | `src/pages/ExtractionTest.tsx` | P2 | 🔴 Not Started |

---

#### Phase 2.3: Report Builder Execution (Weeks 6-7) 🔄 IN PROGRESS

**Owner:** Full-Stack  
**Theme:** Reports That Actually Run  
**Exit Criteria:** Reports can be created, saved, executed, and exported

##### Problem Statement

Beautiful UI, but reports don't actually run or export.

##### Task Breakdown

| Task | File | Priority | Status |
|------|------|----------|--------|
| Query builder engine | `supabase/functions/generate-report-attachment/index.ts` | P0 | 🔄 In Progress |
| Convert report definition → SQL | New utility | P0 | 🔴 Not Started |
| PDF export generator | Edge function | P1 | 🔴 Not Started |
| Excel export generator | Use `xlsx-js-style` | P1 | 🔴 Not Started |
| Wire RunReportButton | `src/components/reports/RunReportButton.tsx` | P1 | 🔴 Not Started |
| Schedule execution | `supabase/functions/send-scheduled-report/index.ts` | P2 | 🔴 Not Started |

---

### PILLAR 3: CONNECTIVITY LAYER

#### Phase 3.1: Public API Completion (Week 8) 🟡 PARTIAL

**Owner:** Backend  
**Theme:** Seamless Ecosystem Integration

| Task | Status | Notes |
|------|--------|-------|
| OpenAPI 3.0 Specification | ✅ Complete | `public/openapi.yaml` |
| API Key Authentication | ✅ Complete | `_shared/api-auth.ts` |
| `api-get-inventory` endpoint | ✅ Complete | Returns stock levels |
| `api-get-catalog` endpoint | ✅ Complete | Returns product catalog |
| `api-create-order` endpoint | ✅ Complete | Accepts orders from Portal |
| Interactive Swagger UI | 🔴 Not Started | Embed in ApiDocs page |
| API Key Management UI | ✅ Complete | `ApiKeyManagementTab.tsx` |
| API Usage Dashboard | ✅ Complete | `ApiUsageDashboardTab.tsx` |

---

#### Phase 3.2: Webhook System (Week 8-9) 🟡 PARTIAL

**Owner:** Backend  
**Theme:** Event-Driven Architecture

| Task | Status | Notes |
|------|--------|-------|
| Webhook dispatcher | ✅ Complete | `webhook-dispatcher/index.ts` |
| HMAC signing | ✅ Complete | Implemented in dispatcher |
| Webhook subscriptions table | ✅ Complete | `webhook_subscriptions` |
| Webhook deliveries table | ✅ Complete | `webhook_deliveries` |
| Order events (created, fulfilled, cancelled) | 🔴 Not Started | Define event payloads |
| Inventory events (low_stock, updated) | 🔴 Not Started | Define event payloads |
| Webhook management UI | 🔴 Not Started | Admin panel tab |

---

#### Phase 3.3: CRM Integration (Week 9-10) 🔴 NOT STARTED

**Owner:** Backend  
**Theme:** Bidirectional Customer Sync

| Task | File | Priority | Status |
|------|------|----------|--------|
| Customer sync endpoint | New edge function | P1 | 🔴 Not Started |
| External customer linking | Database column | P1 | 🔴 Not Started |
| Order notification webhook | Webhook event | P1 | 🔴 Not Started |
| Credit limit enforcement | Order creation | P2 | 🔴 Not Started |

---

### PILLAR 4: USER DELIGHT

#### Phase 4.1: Onboarding Experience (Week 11) 🔴 NOT STARTED

**Owner:** Frontend  
**Theme:** Zero-Friction Start

| Task | Priority | Status |
|------|----------|--------|
| First-login setup wizard | P1 | 🔴 Not Started |
| Role-based feature tours | P2 | 🔴 Not Started |
| Contextual help tooltips | P2 | 🔴 Not Started |
| Video tutorial embeds | P3 | 🔴 Not Started |

---

#### Phase 4.2: Analytics Dashboard (Week 12) 🔴 NOT STARTED

**Owner:** Frontend  
**Theme:** Data-Driven Decisions

| Task | Priority | Status |
|------|----------|--------|
| Executive KPI dashboard | P1 | 🔴 Not Started |
| Orders today/week/month | P1 | 🔴 Not Started |
| Inventory value & turnover | P1 | 🔴 Not Started |
| Forecast accuracy tracking | P2 | 🔴 Not Started |
| Trend charts with Recharts | P2 | 🔴 Not Started |

---

#### Phase 4.3: Mobile Excellence (Week 13) 🟡 PARTIAL

**Owner:** Frontend  
**Theme:** Native-Like Experience

| Task | Status | Notes |
|------|--------|-------|
| Virtual scrolling | ✅ Complete | `src/components/ui/virtual-list.tsx` |
| Swipe actions | ✅ Complete | `SwipeableCardEnhanced.tsx` |
| Haptic feedback | ✅ Complete | `useHapticFeedback.ts` |
| Pull-to-refresh | ✅ Complete | `PullToRefresh.tsx` |
| Camera scanner improvements | 🔴 Not Started | Better QR detection |
| PWA manifest | 🔴 Not Started | Installable app |

---

#### Phase 4.4: Performance Polish (Week 14) 🟡 PARTIAL

**Owner:** Frontend  
**Theme:** Blazing Fast

| Task | Status | Notes |
|------|--------|-------|
| Bundle splitting | ✅ Complete | Vite code splitting |
| Image lazy loading | ✅ Complete | `LazyImage` component |
| Query optimization | 🔴 Not Started | Review slow queries |
| Aggressive caching | 🔴 Not Started | TanStack Query staleTime |
| < 2s page load | 🔴 Not Started | Performance audit |

---

## 6. Priority Decision Matrix

### What to Build vs. What to Wait

| Feature | Build Now | Wait | Rationale |
|---------|-----------|------|-----------|
| **OCR Pipeline Fix** | ✅ | | Critical for stock take usability |
| **AI Extraction Fix** | ✅ | | Critical for order processing |
| **Report Execution** | ✅ | | Users expecting this feature |
| **MFA Enforcement** | ✅ | | Security requirement |
| **Offline Mode** | | ⏳ Phase 2 | Nice-to-have, not blocking |
| **Analytics Dashboard** | | ⏳ Phase 4 | After core features stable |
| **CRM Integration** | | ⏳ Phase 3 | After CRM project ready |
| **PWA** | | ⏳ Backlog | Mobile web works well |

### Recommended Starting Point

```
┌─────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED PRIORITY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OPTION A: Start with Phase 2.1 (OCR Pipeline Fix)              │
│  ────────────────────────────────────────────────               │
│  • Stock take is currently unusable                             │
│  • High user impact when fixed                                  │
│  • ~1 week effort                                               │
│                                                                  │
│  OPTION B: Start with Phase 2.2 (AI Extraction Fix)             │
│  ────────────────────────────────────────────────               │
│  • Order processing is the core workflow                        │
│  • Turkish number parsing is broken                             │
│  • ~1 week effort                                               │
│                                                                  │
│  OPTION C: Start with Phase 2.3 (Report Builder)                │
│  ────────────────────────────────────────────────               │
│  • UI is beautiful but doesn't execute                          │
│  • Users are waiting for this                                   │
│  • ~1-2 week effort                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Changelog

### 2025-12-26 (v3.0.0) - Enterprise Vision Roadmap
- 🎯 Restructured around Four Pillars: Reliability, Intelligence, Connectivity, Delight
- ✅ Phase 1A (Security Hardening) completed
- ✅ Phase 2A.1 (OpenAPI spec + API docs) completed
- 📋 Added success metrics with targets
- 📋 Added priority decision matrix
- 📋 Added recommended starting points

### 2025-12-25 (v2.1.0)
- ✅ Phase 0A: CRON_SECRET validation complete (11/11 edge functions)
- ✅ Phase 0B: DOMPurify XSS protection complete
- ✅ Phase 1B: Legal pages and cookie consent complete
- 🔄 Phase 2A: Integration API foundation started

### Previous
- 2025-12-25 (v2.0.0): Multi-project ecosystem architecture documented
- 2025-01-10 (v1.0.0): Initial roadmap

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial roadmap |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem |
| 2.1.0 | 2025-12-25 | Phase 0A/0B/1B complete |
| 3.0.0 | 2025-12-26 | Enterprise vision; Four Pillars; Phase 1A complete |
