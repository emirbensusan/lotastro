# LotAstro Development Roadmap

> **Version**: 4.0.0  
> **Last Updated**: 2026-01-02  
> **Planning Horizon**: 19.5 days remaining  
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

## 4. Batch Status Summary

### ✅ COMPLETED BATCHES

| Batch | Theme | Completion Date |
|-------|-------|-----------------|
| **A-D** | Core, Security, Legal | 2025-12-26 |
| **E** | User Delight & Onboarding (Tours, Help) | 2025-12-27 |
| **G** | Performance & Mobile Polish | 2025-12-28 |
| **H** | Analytics & Insights (Dashboard Widgets) | 2025-12-28 |

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
- ✅ **Product tours** with react-joyride (4 role-based tours)
- ✅ **Help panel** with contextual documentation
- ✅ **Dashboard widgets** (InsightsWidget, ActivityFeed, TrendChart)
- ✅ **PWA install prompt** component
- ✅ **Lazy loading** for dashboard components
- ✅ **Vendor chunking** in Vite config

---

## 5. Remaining Batches (Priority Order)

### PRIORITY 1: Core Features

#### Batch L: Report Builder Execution (2.5 days, ~9-14 credits)

**Owner:** Full-Stack  
**Theme:** Reports That Actually Run  
**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| Query builder engine | `supabase/functions/generate-report-attachment/index.ts` | P0 | 🔴 Not Started |
| Convert report definition → SQL | New utility | P0 | 🔴 Not Started |
| PDF export generator | Edge function | P1 | 🔴 Not Started |
| Excel export generator | Use `xlsx-js-style` | P1 | 🔴 Not Started |
| Wire RunReportButton | `src/components/reports/RunReportButton.tsx` | P1 | 🔴 Not Started |
| Report sharing/permissions | UI + RLS | P2 | 🔴 Not Started |
| Report templates library | Database + UI | P2 | 🔴 Not Started |
| Schedule execution | `supabase/functions/send-scheduled-report/index.ts` | P2 | 🔴 Not Started |

---

#### Batch J: Offline & Reliability (2 days, ~8-12 credits)

**Owner:** Full-Stack  
**Theme:** Work Without Internet  
**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| IndexedDB sync queue | `src/hooks/useSyncQueue.ts` | P0 | 🔴 Not Started |
| Conflict resolution UI | `src/components/offline/ConflictResolutionDialog.tsx` | P1 | 🔴 Not Started |
| Background sync service worker | `public/sw.js` | P1 | 🔴 Not Started |
| Offline-first data caching | Query persistence | P1 | 🔴 Not Started |
| Sync status indicator | `src/components/offline/SyncStatusBadge.tsx` | P2 | 🔴 Not Started |

---

### PRIORITY 2: Connectivity

#### Batch K: Webhook & Integration Events (1.5 days, ~6-9 credits)

**Owner:** Backend  
**Theme:** Event-Driven Architecture  
**Status:** 🟡 PARTIAL

| Task | File | Priority | Status |
|------|------|----------|--------|
| Webhook dispatcher | `supabase/functions/webhook-dispatcher/index.ts` | - | ✅ Complete |
| HMAC signing | Dispatcher | - | ✅ Complete |
| Order events (created, fulfilled, cancelled) | Webhook payloads | P0 | 🔴 Not Started |
| Inventory events (low_stock, updated) | Webhook payloads | P1 | 🔴 Not Started |
| Retry/dead letter queue | Edge function + table | P1 | 🔴 Not Started |
| Integration logs dashboard | Admin UI | P2 | 🔴 Not Started |

---

### PRIORITY 3: Quality of Life

#### Batch O: Quality of Life & Polish (2 days, ~8-13 credits)

**Owner:** Frontend  
**Theme:** Delightful UX  
**Status:** 🔴 NOT STARTED

| Task | Priority | Status |
|------|----------|--------|
| Bulk actions (select all, bulk delete) | P1 | 🔴 Not Started |
| Advanced filtering presets (save/load) | P1 | 🔴 Not Started |
| Print layout refinements | P2 | 🔴 Not Started |
| Accessibility audit (ARIA labels) | P2 | 🔴 Not Started |
| Keyboard navigation polish | P2 | 🔴 Not Started |

---

#### Batch N: Admin & Security Enhancements (1.5 days, ~6-10 credits)

**Owner:** Full-Stack  
**Theme:** Enterprise Security  
**Status:** ✅ COMPLETE (2026-01-02)

| Task | Priority | Status |
|------|----------|--------|
| API rate limiting dashboard | P1 | ✅ Complete |
| Session management (view active sessions) | P1 | ✅ Complete |
| Audit log export/archival | P2 | ✅ Complete |
| IP whitelist enhancements (bulk import, CIDR) | P2 | ✅ Complete |

---

### PRIORITY 4: Advanced Features

#### Batch M: Advanced Forecasting (2.5 days, ~9-14 credits)

**Owner:** Full-Stack  
**Theme:** Predictive Intelligence  
**Status:** 🔴 NOT STARTED

| Task | Priority | Status |
|------|----------|--------|
| Forecast algorithm refinement | P1 | 🔴 Not Started |
| Seasonal adjustment settings | P1 | 🔴 Not Started |
| Forecast vs. actual comparison | P2 | 🔴 Not Started |
| Alert threshold configuration | P2 | 🔴 Not Started |

---

### PRIORITY 5: AI/OCR (Deferred)

#### Batch P: AI Extraction Refactoring (2.5 days, ~10-15 credits)

**Owner:** Full-Stack  
**Theme:** AI Order Extraction Reliability  
**Exit Criteria:** 90%+ combined extraction accuracy  
**Status:** 🔴 NOT STARTED

##### Problem Statement

The AI Order Extraction is **not working reliably** due to:
- Incorrect regex pattern priority (greedy patterns match first)
- Turkish number parsing edge cases (`1.720` → 1720 not 1.72)
- LLM prompt complexity causing inconsistent JSON output
- No confidence threshold gating
- Fragile header inheritance logic
- Inconsistent few-shot examples

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
| Fix `parseTurkishNumber()` edge cases | `supabase/functions/_shared/extraction-lib.ts` | P0 | 🔴 Not Started |
| Add header context inheritance tests | `supabase/functions/_shared/extraction-lib.ts` | P0 | 🔴 Not Started |
| Switch LLM to tool-calling (from raw JSON) | `supabase/functions/extract-order/index.ts` | P0 | 🔴 Not Started |
| Add confidence threshold gate (<0.6 → manual) | `supabase/functions/_shared/extraction-lib.ts` | P1 | 🔴 Not Started |
| Multi-language extraction prompt | `supabase/functions/extract-order/index.ts` | P2 | 🔴 Not Started |
| Enhance ExtractionTest page | `src/pages/ExtractionTest.tsx` | P2 | 🔴 Not Started |

---

#### Batch I: OCR Pipeline Overhaul (3 days, ~11-17 credits)

**Owner:** Full-Stack  
**Theme:** Stock Take OCR Reliability  
**Exit Criteria:** 95%+ accuracy on clean printed labels  
**Status:** 🔴 NOT STARTED

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

### SIDELINED

#### Batch F: CRM & Ecosystem Connectivity (2 days, ~8-13 credits)

**Owner:** Backend  
**Theme:** Bidirectional Sync  
**Status:** ⏸️ SIDELINED (awaiting CRM project readiness)

| Task | Priority | Status |
|------|----------|--------|
| CRM data sync (customers) | P1 | ⏸️ Sidelined |
| Customer Portal API enhancements | P1 | ⏸️ Sidelined |
| "View in CRM" deep links | P2 | ⏸️ Sidelined |
| Shared OAuth authentication | P2 | ⏸️ Sidelined |
| Activity timeline sync | P3 | ⏸️ Sidelined |

---

## 6. Priority Decision Matrix

### Recommended Execution Order

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED PRIORITY ORDER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Batch L: Report Builder Execution    (2.5 days, ~9-14 credits)          │
│     → Users expecting reports to actually work                              │
│                                                                              │
│  2. Batch J: Offline & Reliability       (2 days, ~8-12 credits)            │
│     → Critical for warehouse floor use                                      │
│                                                                              │
│  3. Batch K: Webhook & Integration       (1.5 days, ~6-9 credits)           │
│     → Enables CRM/Portal connectivity                                       │
│                                                                              │
│  4. Batch O: Quality of Life             (2 days, ~8-13 credits)            │
│     → User satisfaction improvements                                        │
│                                                                              │
│  5. Batch N: Admin & Security            (1.5 days, ~6-10 credits)          │
│     → Enterprise requirements                                               │
│                                                                              │
│  6. Batch M: Advanced Forecasting        (2.5 days, ~9-14 credits)          │
│     → After core features stable                                            │
│                                                                              │
│  7. Batch P: AI Extraction Refactoring   (2.5 days, ~10-15 credits)         │
│     → Deferred per user request                                             │
│                                                                              │
│  8. Batch I: OCR Pipeline Overhaul       (3 days, ~11-17 credits)           │
│     → Deferred per user request                                             │
│                                                                              │
│  ⏸️ Batch F: CRM & Ecosystem             (2 days, ~8-13 credits)            │
│     → Sidelined until CRM ready                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Total Remaining Effort

| Priority | Batches | Days | Credits |
|----------|---------|------|---------|
| Core Features | L, J | 4.5 | ~17-26 |
| Connectivity | K | 1.5 | ~6-9 |
| Quality of Life | O, N | 3.5 | ~14-23 |
| Advanced | M | 2.5 | ~9-14 |
| AI/OCR (deferred) | P, I | 5.5 | ~21-32 |
| Sidelined | F | 2 | ~8-13 |
| **TOTAL** | 9 | **19.5** | **~75-117** |

---

## 7. Changelog

### 2026-01-02 (v4.0.0) - Batch Consolidation

- 📋 Restructured roadmap into consolidated batches (L, J, K, O, N, M, P, I, F)
- ✅ Marked Batches A-D, E, G, H as complete
- ➕ Added Batch P: AI Extraction Refactoring with detailed problem statement
- 📋 Added Turkish number parsing rules documentation
- 📋 Added recommended execution order with rationale
- 📋 Deferred Batch P & I (OCR/AI) to end per user request
- ⏸️ Sidelined Batch F (CRM) pending CRM project readiness

### 2025-12-28 (v3.2.0)

- ✅ Batch G (Performance) complete: Lazy loading, vendor chunking
- ✅ Batch H (Analytics) complete: Dashboard widgets integrated

### 2025-12-27 (v3.1.0)

- ✅ Batch E (Onboarding) complete: Tours, help panel, keyboard shortcuts

### 2025-12-26 (v3.0.0) - Enterprise Vision Roadmap

- 🎯 Restructured around Four Pillars: Reliability, Intelligence, Connectivity, Delight
- ✅ Phase 1A (Security Hardening) completed
- ✅ Phase 2A.1 (OpenAPI spec + API docs) completed
- 📋 Added success metrics with targets
- 📋 Added priority decision matrix

### 2025-12-25 (v2.1.0)

- ✅ Phase 0A: CRON_SECRET validation complete (11/11 edge functions)
- ✅ Phase 0B: DOMPurify XSS protection complete
- ✅ Phase 1B: Legal pages and cookie consent complete

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-10 | Initial roadmap |
| 2.0.0 | 2025-12-25 | Multi-project ecosystem |
| 2.1.0 | 2025-12-25 | Phase 0A/0B/1B complete |
| 3.0.0 | 2025-12-26 | Enterprise vision; Four Pillars |
| 3.1.0 | 2025-12-27 | Batch E complete |
| 3.2.0 | 2025-12-28 | Batches G, H complete |
| 4.0.0 | 2026-01-02 | Batch consolidation; AI Extraction batch added |
