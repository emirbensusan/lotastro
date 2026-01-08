# LotAstro Development Roadmap

> **Version**: 5.0.0  
> **Last Updated**: 2026-01-08
> **Planning Horizon**: 15.5 days remaining  
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
| **K** | Webhook & Integration Events | 2026-01-05 |
| **N** | Admin & Security Enhancements | 2026-01-02 |
| **L** | Report Builder Execution | 2026-01-02 |
| **J** | Offline & Reliability | 2026-01-02 |
| **M** | Advanced Forecasting | 2026-01-05 |
| **O** | Quality of Life & Polish | 2026-01-02 |

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
- ✅ **Webhook event dispatching** with retry logic
- ✅ **Active sessions management** with force logout
- ✅ **Audit log export** with date filtering
- ✅ **IP whitelist CIDR support** and bulk import
- ✅ **Report query builder engine** with dynamic SQL generation
- ✅ **Real Excel (.xlsx) export** using xlsx library
- ✅ **PDF export** with print-friendly HTML
- ✅ **Report sharing/permissions** UI with token-based access
- ✅ **Scheduled report execution** via CRON

---

## 5. Remaining Batches (Priority Order)

### PRIORITY 1: Core Features

#### Batch L: Report Builder Execution (2.5 days, ~9-14 credits)

**Owner:** Full-Stack  
**Theme:** Reports That Actually Run  
**Status:** ✅ COMPLETE (2026-01-02)

| Task | File | Priority | Status |
|------|------|----------|--------|
| Query builder engine | `supabase/functions/generate-report-attachment/index.ts` | P0 | ✅ Complete |
| Convert report definition → SQL | Edge function | P0 | ✅ Complete |
| PDF export generator | Edge function | P1 | ✅ Complete |
| Excel export generator | Using `xlsx` library | P1 | ✅ Complete |
| Wire RunReportButton | `src/components/reports/RunReportButton.tsx` | P1 | ✅ Complete |
| Report sharing/permissions | `ReportShareDialog.tsx` + RLS | P2 | ✅ Complete |
| Report templates library | `ReportTemplatesTab.tsx` | P2 | ✅ Complete |
| Schedule execution | `supabase/functions/send-scheduled-report/index.ts` | P2 | ✅ Complete |

---

#### Batch J: Offline & Reliability (2 days, ~8-12 credits)

**Owner:** Full-Stack  
**Theme:** Work Without Internet  
**Status:** ✅ COMPLETE (2026-01-02)

| Task | File | Priority | Status |
|------|------|----------|--------|
| IndexedDB sync queue | `src/hooks/useSyncQueue.ts` | P0 | ✅ Complete |
| Conflict resolution UI | `src/components/offline/ConflictResolutionDialog.tsx` | P1 | ✅ Complete |
| Background sync service worker | `public/sw-custom.js` | P1 | ✅ Complete |
| Offline-first data caching | `src/hooks/useOfflineQuery.ts` | P1 | ✅ Complete |
| Sync status indicator | `src/components/offline/SyncStatusBadge.tsx` | P2 | ✅ Complete |
| Offline mutation hook | `src/hooks/useOfflineMutation.ts` | P1 | ✅ Complete |
| Service worker hook | `src/hooks/useServiceWorker.ts` | P1 | ✅ Complete |
| Offline admin settings | `src/components/admin/OfflineSettingsTab.tsx` | P2 | ✅ Complete |

---

### PRIORITY 2: Connectivity

#### Batch K: Webhook & Integration Events (1.5 days, ~6-9 credits)

**Owner:** Backend  
**Theme:** Event-Driven Architecture  
**Status:** ✅ COMPLETE (2026-01-05)

| Task | File | Priority | Status |
|------|------|----------|--------|
| Webhook dispatcher | `supabase/functions/webhook-dispatcher/index.ts` | - | ✅ Complete |
| HMAC signing | Dispatcher | - | ✅ Complete |
| Order events (created, fulfilled, cancelled) | Webhook payloads | P0 | ✅ Complete |
| Inventory events (low_stock, updated) | Webhook payloads | P1 | ✅ Complete |
| Lot received event | `src/components/ReceiveStockDialog.tsx` | P1 | ✅ Complete |
| Reservation events | `src/components/ReservationDialog.tsx` | P1 | ✅ Complete |
| Catalog updated event | `src/pages/CatalogDetail.tsx` | P1 | ✅ Complete |
| Retry/dead letter queue | `webhook_dead_letters` table | P1 | ✅ Complete |
| Integration logs dashboard | Admin UI | P2 | 🔴 Deferred

---

### PRIORITY 3: CRM Integration (Pending)

#### Batch F: CRM & Ecosystem Connectivity

**Owner:** Full-Stack  
**Theme:** Cross-System Integration  
**Status:** ⏸️ PENDING CRM PROJECT COMPLETION

*Waiting for CRM project to be finalized before implementing WMS integration features.*

---

### PRIORITY 4: AI/OCR (Active)

#### Batch I: OCR Pipeline Overhaul (3 days, ~11-17 credits)

**Owner:** Full-Stack  
**Theme:** Stock Take OCR Reliability  
**Exit Criteria:** 95%+ accuracy on clean printed labels  
**Status:** 🔴 NOT STARTED

*Will be started after CRM integration features.*

---

#### Batch P: AI Extraction Refactoring (2.5 days, ~10-15 credits)

**Owner:** Full-Stack  
**Theme:** AI Order Extraction Reliability  
**Exit Criteria:** 90%+ combined extraction accuracy  
**Status:** 🔴 NOT STARTED

*Will be started after OCR Pipeline Overhaul.*

---

## 6. WMS Architecture Enhancement Batches

> **Added**: 2026-01-06  
> **Goal**: Align LotAstro with enterprise WMS standards for inventory integrity and auditability

### PRD Alignment Decisions

| PRD Module | Decision | Rationale |
|------------|----------|-----------|
| DEP-M1: Items + Variants | **Use catalog_items** | Existing catalog serves as item master; no separate items/item_variants needed |
| DEP-M2: Warehouses + Locations | **Phase 2** | Single-warehouse operation currently; defer multi-location support |
| DEP-M3: Inventory Transactions | **Priority 1** | Critical architectural foundation for auditability |
| DEP-M4: Transfers | **Phase 2** | Depends on DEP-M2 (locations) |
| DEP-M5: Lot/Serial Tracking | **Already Implemented** | Lots and rolls tables provide this capability |
| DEP-M6: Reservations | **Already Implemented** | reservation_lines + reserved_meters on lots |
| DEP-M7: Picking/Packing | **Minimal Implementation** | Capture roll selection on fulfillment, defer full picking workflow |
| DEP-M8: Stock Count Adjustments | **Priority 2** | Extend count_sessions with manager-approved adjustments |

---

### Phase 1 Batches (Current Priority)

#### Batch WMS-1: Inventory Transaction Ledger (DEP-M3)

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 days  
**Dependencies:** None  
**Theme:** Single Source of Truth for Inventory Movements

Creates the foundational transaction ledger for inventory auditability.

| Task | Priority | Status |
|------|----------|--------|
| Create `inventory_transactions` table | P0 | ✅ Complete |
| Define `transaction_type` enum | P0 | ✅ Complete |
| Add `source_type`/`source_id` columns | P0 | ✅ Complete |
| Create `/inventory-transactions` page | P0 | ✅ Complete |
| Retrofit lot intake to create 'receipt' transaction | P1 | ✅ Complete |
| Retrofit order fulfillment to create 'pick' transaction | P1 | ✅ Complete |
| Add balance consistency check RPC | P2 | 🔴 Deferred |

**Transaction Types (Implemented):**
- `INCOMING_RECEIPT` - Lot intake (goods received)
- `STOCK_ADJUSTMENT` - Stock count adjustments (+/-)
- `ORDER_FULFILLMENT` - Order fulfillment (stock out)
- `MANUAL_CORRECTION` - Manual inventory corrections
- `RESERVATION_ALLOCATION` - Stock reserved for order
- `RESERVATION_RELEASE` - Reserved stock released
- `TRANSFER_OUT` - (Phase 2) Inter-location transfer out
- `TRANSFER_IN` - (Phase 2) Inter-location transfer in

---

#### Batch WMS-2: Stock Count Adjustments (DEP-M8)

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 days  
**Dependencies:** WMS-1  
**Theme:** Manager-Approved Inventory Corrections

Adds manager-approved adjustments after stock count reconciliation.

| Task | Priority | Status |
|------|----------|--------|
| Connect stock-take sessions to inventory ledger | P0 | ✅ Complete |
| Log STOCK_ADJUSTMENT on session reconciliation | P0 | ✅ Complete |
| Batch transaction logging for approved rolls | P1 | ✅ Complete |
| Session summary transaction | P1 | ✅ Complete |
| useInventoryTransaction hook | P1 | ✅ Complete |

---

#### Batch WMS-3: Order Fulfillment Traceability (Minimal DEP-M7)

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 1-2 days  
**Dependencies:** WMS-1  
**Theme:** Know Which Rolls Fulfilled Each Order

Captures which rolls were used when fulfilling orders.

| Task | Priority | Status |
|------|----------|--------|
| Log ORDER_FULFILLMENT transactions on fulfill | P0 | ✅ Complete |
| Capture roll-level details in transactions | P0 | ✅ Complete |
| Link transactions to order via source_id | P1 | ✅ Complete |
| logOrderFulfillment helper in useInventoryTransaction | P1 | ✅ Complete |
| logIncomingReceipt helper for lot intake | P2 | ✅ Complete |

---

### Phase 2 Batches (Future)

#### Batch WMS-4: Warehouses + Locations (DEP-M2)

**Status:** ⏸️ SIDELINED  
**Effort:** 2-3 days  
**Dependencies:** None  
**Theme:** Multi-Location Inventory

| Task | Priority | Status |
|------|----------|--------|
| Create `warehouses` table | P0 | ⏸️ Sidelined |
| Create `locations` table | P0 | ⏸️ Sidelined |
| Add `warehouse_id` to lots | P1 | ⏸️ Sidelined |
| Add `location_id` to rolls | P1 | ⏸️ Sidelined |
| Warehouse management UI | P2 | ⏸️ Sidelined |

---

#### Batch WMS-5: Transfers (DEP-M4)

**Status:** ⏸️ SIDELINED  
**Effort:** 2-3 days  
**Dependencies:** WMS-4  
**Theme:** Inter-Location Stock Movement

| Task | Priority | Status |
|------|----------|--------|
| Create `transfer_orders` table | P0 | ⏸️ Sidelined |
| Create `transfer_lines` table | P0 | ⏸️ Sidelined |
| Transfer approval workflow | P1 | ⏸️ Sidelined |
| Transfer transactions (out + in) | P1 | ⏸️ Sidelined |

---

## 7. Performance & Auth Hardening Phase

> **Added**: 2026-01-07  
> **Goal**: Make the app feel "instant" by removing startup blockers, fixing auth refresh issues, and eliminating duplicate queries

### Phase Overview

| Batch | Theme | Effort | Status |
|-------|-------|--------|--------|
| PERF-1 | MFAGate Optimization | 2-3 hours | ✅ COMPLETE (2026-01-07) |
| PERF-2 | Auth Refresh Token Hardening | 3-4 hours | ✅ COMPLETE (2026-01-07) |
| PERF-3 | Dashboard Stats with React Query | 2-3 hours | ✅ COMPLETE (2026-01-07) |
| PERF-4 | Performance Instrumentation | 2-3 hours | ✅ COMPLETE (2026-01-07) |
| PERF-5 | Additional Optimizations | 2-3 hours | ✅ COMPLETE (2026-01-07) |

---

#### Batch PERF-1: MFAGate Optimization

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 hours  
**Theme:** Remove Startup Blocking

| Task | Priority | Status |
|------|----------|--------|
| Reduce timeout from 10s to 3s | P0 | ✅ Complete |
| Parallel fetch settings + MFA factors | P0 | ✅ Complete |
| Session-level MFA status caching | P0 | ✅ Complete |
| Add timing instrumentation | P1 | ✅ Complete |
| Prevent duplicate checks with ref | P1 | ✅ Complete |

---

#### Batch PERF-2: Auth Refresh Token Hardening

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 3-4 hours  
**Theme:** Stabilize Auth, Prevent Refresh Loops

| Task | Priority | Status |
|------|----------|--------|
| Create useAuthErrorHandler hook | P0 | ✅ Complete |
| Detect invalid refresh token errors | P0 | ✅ Complete |
| Clean sign-out without retry on auth errors | P0 | ✅ Complete |
| Clear all caches on auth errors | P1 | ✅ Complete |
| Add retry limit for token refresh | P1 | ✅ Complete |
| Export singleton queryClient from lib | P1 | ✅ Complete |

---

#### Batch PERF-3: Dashboard Stats with React Query

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 hours  
**Theme:** Eliminate Duplicate Fetches, Add Caching

| Task | Priority | Status |
|------|----------|--------|
| Create useDashboardStats hook | P0 | ✅ Complete |
| Replace useState/useEffect with useQuery | P0 | ✅ Complete |
| Configure staleTime (5 min) | P0 | ✅ Complete |
| Implement stale-while-revalidate | P1 | ✅ Complete |
| Add proper query keys | P1 | ✅ Complete |
| Parallel fetch all stats queries | P1 | ✅ Complete |
| Background refresh indicator | P2 | ✅ Complete |

---

#### Batch PERF-4: Performance Instrumentation

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 hours  
**Theme:** Observability for Performance Metrics

| Task | Priority | Status |
|------|----------|--------|
| Create usePerformanceMetrics hook | P0 | ✅ Complete |
| Create PerformanceOverlay component (dev-only) | P1 | ✅ Complete |
| Add timing logs in main.tsx | P1 | ✅ Complete |
| Add timing logs in useAuth | P1 | ✅ Complete |
| Add timing logs in MFAGate | P1 | ✅ Complete |
| Record dashboard ready time | P2 | ✅ Complete |
| Keyboard shortcut toggle (Ctrl+Shift+P) | P2 | ✅ Complete |

---

#### Batch PERF-5: Additional Optimizations

**Status:** ✅ COMPLETE (2026-01-07)  
**Effort:** 2-3 hours  
**Theme:** Consolidate Queries, Preload Critical Data

| Task | Priority | Status |
|------|----------|--------|
| Create shared useDashboardStats hook | P1 | ✅ Complete (in PERF-3) |
| Add prefetchDashboardStats function | P1 | ✅ Complete |
| Add permissions query keys | P1 | ✅ Complete |
| Prefetch permissions on auth success | P2 | ✅ Complete |
| Prefetch dashboard stats on auth success | P2 | ✅ Complete |
| Parallel prefetch for critical data | P2 | ✅ Complete |
| Update ROADMAP.md | P2 | ✅ Complete |

---

## 8. Below the Line (Backlog)

The following items are nice-to-haves and have been deprioritized:

### From Batch O: Quality of Life & Polish

| Task | Priority | Notes |
|------|----------|-------|
| Bulk actions (select all, bulk delete) | P1 | Nice-to-have |
| Advanced filtering presets (save/load) | P1 | Nice-to-have |
| Print layout refinements | P2 | Nice-to-have |
| Accessibility audit (ARIA labels) | P2 | Nice-to-have |
| Keyboard navigation polish | P2 | ✅ COMPLETE (2026-01-06) - Shortcut hints overlay |

### From Batch K: Webhooks

| Task | Priority | Notes |
|------|----------|-------|
| Integration logs dashboard | P2 | Admin UI deferred |

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
**Status:** ✅ COMPLETE (2026-01-05)

| Task | Priority | Status |
|------|----------|--------|
| Forecast algorithm refinement | P1 | ✅ Complete |
| Seasonal adjustment settings | P1 | ✅ Complete |
| Trend detection settings | P1 | ✅ Complete |
| Forecast vs. actual comparison | P2 | ✅ Complete |
| Alert threshold configuration | P2 | ✅ Complete |
| Per-quality overrides | P2 | ✅ Complete |
| Forecast accuracy metrics | P2 | ✅ Complete |

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

---

## 9. CRM ↔ WMS Integration (Batch F)

> **Added**: 2026-01-08  
> **Architecture**: Two Separate Supabase Projects with Sync  
> **Goal**: Seamless bidirectional integration between LotAstro WMS and LotAstro CRM

### Executive Summary

1. **Two Projects, Same Org**: CRM and WMS are separate Supabase projects under the same organization
2. **Webhook-First**: Primary sync via webhooks with outbox pattern for reliability
3. **API Gateway**: Cross-system queries via edge functions with mutual API key auth
4. **Entity Ownership**: CRM owns Customers/Leads/Deals; WMS owns Inventory/Orders/Reservations
5. **Shared IDs**: `crm_customer_id` on WMS tables, `wms_order_id` on CRM tables
6. **Cache Strategy**: Local cache tables for performance, reconciled via CRON
7. **Security**: Mutual API keys with scoped permissions, RLS on all tables
8. **Rollback**: Each phase independently reversible with feature flags

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        CRM ↔ WMS INTEGRATION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                          SUPABASE ORG (Same Owner)                             │  │
│  │                                                                                │  │
│  │  ┌─────────────────────────┐              ┌─────────────────────────┐         │  │
│  │  │    CRM SUPABASE         │              │    WMS SUPABASE         │         │  │
│  │  │  ─────────────────      │              │  ─────────────────      │         │  │
│  │  │                         │              │                         │         │  │
│  │  │  ┌─────────────────┐    │              │  ┌─────────────────┐    │         │  │
│  │  │  │   customers     │    │   customer   │  │  crm_customer   │    │         │  │
│  │  │  │   leads         │◀───┼──── sync ────┼──│  _cache         │    │         │  │
│  │  │  │   deals         │    │   (webhook)  │  └─────────────────┘    │         │  │
│  │  │  │   contacts      │    │              │                         │         │  │
│  │  │  └─────────────────┘    │              │  ┌─────────────────┐    │         │  │
│  │  │                         │              │  │   orders        │    │         │  │
│  │  │  ┌─────────────────┐    │   order/res  │  │   reservations  │────┼──┐      │  │
│  │  │  │wms_inventory    │    │   events     │  │   inquiries     │    │  │      │  │
│  │  │  │  _cache         │◀───┼──(webhook)───┼──│   lots/rolls    │    │  │      │  │
│  │  │  └─────────────────┘    │              │  └─────────────────┘    │  │      │  │
│  │  │                         │              │                         │  │      │  │
│  │  │  ┌─────────────────┐    │              │  ┌─────────────────┐    │  │      │  │
│  │  │  │wms_events       │    │              │  │integration      │    │  │      │  │
│  │  │  │  _received      │    │              │  │  _outbox        │────┼──┘      │  │
│  │  │  └─────────────────┘    │              │  └─────────────────┘    │         │  │
│  │  │                         │              │                         │         │  │
│  │  │  ┌─────────────────┐    │              │  ┌─────────────────┐    │         │  │
│  │  │  │crm-get-customer │    │   API Call   │  │api-get-inventory│    │         │  │
│  │  │  │  Edge Func      │◀───┼──────────────┼──│  Edge Func      │    │         │  │
│  │  │  └─────────────────┘    │              │  └─────────────────┘    │         │  │
│  │  │                         │              │                         │         │  │
│  │  │  ┌─────────────────┐    │              │  ┌─────────────────┐    │         │  │
│  │  │  │wms-webhook      │◀───┼── Webhook ───┼──│webhook-dispatcher│   │         │  │
│  │  │  │  -receiver      │    │   Events     │  │  (existing)     │    │         │  │
│  │  │  └─────────────────┘    │              │  └─────────────────┘    │         │  │
│  │  └─────────────────────────┘              └─────────────────────────┘         │  │
│  │                                                                                │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                            SYNC RECONCILER (CRON)                              │  │
│  │  • Runs every 6 hours                                                          │  │
│  │  • Compares cache vs source                                                    │  │
│  │  • Logs discrepancies to integration_sync_log                                  │  │
│  │  • Auto-heals stale cache entries                                              │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Integration Contracts

#### Entity Ownership Matrix

| Entity | CRM Owner? | WMS Owner? | Sync Direction | Conflict Resolution |
|--------|------------|------------|----------------|---------------------|
| Customers | ✅ | ❌ | CRM → WMS | CRM wins |
| Leads | ✅ | ❌ | CRM → WMS | CRM wins |
| Deals | ✅ | ❌ | CRM → WMS | CRM wins |
| Contacts | ✅ | ❌ | CRM → WMS | CRM wins |
| Inventory | ❌ | ✅ | WMS → CRM | WMS wins |
| Orders | ❌ | ✅ | WMS → CRM | WMS wins |
| Reservations | ❌ | ✅ | WMS → CRM | WMS wins |
| Inquiries | ❌ | ✅ | WMS → CRM | WMS wins |
| Products/Catalog | ❌ | ✅ | WMS → CRM | WMS wins |

#### Webhook Event Types

**WMS → CRM Events:**

| Event Type | Trigger | Payload Summary |
|------------|---------|-----------------|
| `inquiry.created` | New inquiry | customer_ref, quality, color, meters |
| `inquiry.converted` | Inquiry → Order | inquiry_id, order_id |
| `reservation.created` | New reservation | customer_ref, lines[], expires_at |
| `reservation.released` | Reservation released | reservation_id, reason |
| `order.created` | New order | po_number, lines[], total_meters |
| `order.fulfilled` | Order fulfilled | order_id, shipped_rolls[] |
| `order.cancelled` | Order cancelled | order_id, reason |
| `shipment.posted` | Shipment dispatched | order_id, tracking_info |
| `inventory.low_stock` | Below threshold | quality, color, current_stock |

**CRM → WMS Events:**

| Event Type | Trigger | Payload Summary |
|------------|---------|-----------------|
| `customer.created` | New customer | id, company_name, address, terms |
| `customer.updated` | Customer modified | id, changed_fields |
| `deal.won` | Deal closed-won | deal_id, customer_id, value |
| `deal.lost` | Deal closed-lost | deal_id, reason |

#### API Endpoints

**WMS Exposes:**
- `POST /api-get-inventory` - Query stock by quality/color
- `POST /api-get-catalog` - Get catalog items
- `POST /api-create-order` - Create order from CRM

**CRM Exposes:**
- `POST /crm-get-customer` - Lookup customer by ID or code
- `POST /crm-search-customers` - Search customers

---

### Phase F-0: Foundation (1 day)

**Goal:** Instrumentation, shared secrets, outbox table

**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| Create `integration_outbox` table | Migration | P0 | 🔴 Not Started |
| Create `integration_sync_log` table | Migration | P0 | 🔴 Not Started |
| Add `crm_customer_id` column to `orders` | Migration | P0 | 🔴 Not Started |
| Add `crm_customer_id` column to `reservations` | Migration | P0 | 🔴 Not Started |
| Add `crm_customer_id` column to `inquiries` | Migration | P0 | 🔴 Not Started |
| Create `crm_customer_cache` table | Migration | P0 | 🔴 Not Started |
| Add `CRM_API_KEY` secret | Secrets | P0 | 🔴 Not Started |
| Add `CRM_API_URL` secret | Secrets | P0 | 🔴 Not Started |
| Add `CRM_WEBHOOK_SECRET` secret | Secrets | P0 | 🔴 Not Started |

**Acceptance Criteria:**
- [ ] All tables created with RLS policies
- [ ] Secrets configured in both projects
- [ ] Feature flags for integration enable/disable

**Rollback:** Drop new columns and tables

---

### Phase F-1: Customer Sync + Reservation Flow (2 days)

**Goal:** CRM customers available in WMS, reservations trigger CRM events

**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| Create `crm-get-customer` edge function | `supabase/functions/crm-get-customer/index.ts` | P0 | 🔴 Not Started |
| Customer autocomplete in order forms | `src/components/OrderBulkUpload.tsx` | P1 | 🔴 Not Started |
| Customer autocomplete in reservation dialog | `src/components/ReservationDialog.tsx` | P1 | 🔴 Not Started |
| Link customer on order creation | Order creation flow | P0 | 🔴 Not Started |
| Send `reservation.created` to outbox | `src/components/ReservationDialog.tsx` | P0 | 🔴 Not Started |
| Trigger `trg_notify_crm_reservation` | DB trigger | P0 | 🔴 Not Started |
| Process outbox → webhook dispatcher | Edge function | P0 | 🔴 Not Started |
| Display CRM customer info in order details | `src/pages/Orders.tsx` | P1 | 🔴 Not Started |
| "View in CRM" deep link button | Order details UI | P2 | 🔴 Not Started |

**Acceptance Criteria:**
- [ ] Customer search in WMS returns CRM customers
- [ ] Orders created with `crm_customer_id` populated
- [ ] Reservations trigger `reservation.created` webhook
- [ ] CRM receives and processes webhook within 30s

**Success Metrics:**
- Customer lookup latency < 500ms
- Webhook delivery success rate > 99%

**Rollback:** Disable outbox processing, hide customer autocomplete

---

### Phase F-2: Order Fulfillment + Shipment (2 days)

**Goal:** Order lifecycle events flow to CRM, inventory visibility in CRM

**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| Send `order.created` on order confirm | Order flow | P0 | 🔴 Not Started |
| Send `order.fulfilled` on fulfill | Order flow | P0 | 🔴 Not Started |
| Send `shipment.posted` on shipment | Shipment flow | P0 | 🔴 Not Started |
| Handle order cancel → `reservation.released` | Cancel flow | P1 | 🔴 Not Started |
| Create `api-check-inventory` for CRM | Edge function | P1 | 🔴 Not Started |
| CRM displays WMS stock availability | CRM UI | P1 | 🔴 Not Started |
| CRM displays order/shipment status | CRM UI | P1 | 🔴 Not Started |
| Quantity change → adjust reservation | Order edit flow | P1 | 🔴 Not Started |

**CRM-Side Tasks (IN CRM PROJECT):**

| Task | CRM File | Priority | Status |
|------|----------|----------|--------|
| Create `wms-webhook-receiver` edge function | `supabase/functions/wms-webhook-receiver/index.ts` | P0 | 🔴 Not Started |
| Validate HMAC signature | Edge function | P0 | 🔴 Not Started |
| Create `wms_events_received` table | Migration | P0 | 🔴 Not Started |
| Map order events → CRM activities | Edge function | P1 | 🔴 Not Started |
| Update deal stage on order events | Edge function | P1 | 🔴 Not Started |
| Create `wms_inventory_cache` table | Migration | P1 | 🔴 Not Started |
| Display inventory in deal view | CRM UI | P2 | 🔴 Not Started |

**Acceptance Criteria:**
- [ ] Order lifecycle events appear in CRM within 30s
- [ ] CRM can query WMS inventory via API
- [ ] Order quantity changes update reservations
- [ ] Shipment status visible in CRM deal timeline

**Success Metrics:**
- Order → CRM activity latency < 30s
- Inventory API latency < 1s

**Rollback:** Disable webhook types, feature flag inventory API

---

### Phase F-3: Edge Cases + Reconciliation (1 day)

**Goal:** Handle failures, returns, stock adjustments, CRON reconciliation

**Status:** 🔴 NOT STARTED

| Task | File | Priority | Status |
|------|------|----------|--------|
| Create `integration-reconciler` CRON job | Edge function | P0 | 🔴 Not Started |
| Compare cache vs source every 6 hours | CRON | P0 | 🔴 Not Started |
| Log discrepancies to `integration_sync_log` | CRON | P0 | 🔴 Not Started |
| Auto-heal stale cache entries | CRON | P1 | 🔴 Not Started |
| Dead-letter queue handling | Webhook dispatcher | P1 | 🔴 Not Started |
| Manual retry button for failed events | Admin UI | P2 | 🔴 Not Started |
| Returns/RMA flow (if supported) | TBD | P2 | 🔴 Not Started |

**Acceptance Criteria:**
- [ ] CRON detects and heals stale data
- [ ] Failed webhooks retried with exponential backoff
- [ ] Admin can view/retry failed integration events

**Success Metrics:**
- Data consistency > 99.9%
- Failed webhook recovery rate > 95%

**Rollback:** Disable reconciler CRON

---

### Data Model Changes

#### WMS Database Additions

```sql
-- Add CRM linkage columns
ALTER TABLE orders ADD COLUMN crm_customer_id UUID;
ALTER TABLE orders ADD COLUMN crm_deal_id UUID;
ALTER TABLE reservations ADD COLUMN crm_customer_id UUID;
ALTER TABLE inquiries ADD COLUMN crm_customer_id UUID;

-- CRM customer cache (for performance)
CREATE TABLE crm_customer_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id UUID NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  unique_code TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms TEXT,
  address_line_1 TEXT,
  city TEXT,
  country TEXT,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stale_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

-- Integration outbox for reliable event delivery
CREATE TABLE integration_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  target_system TEXT NOT NULL DEFAULT 'crm',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  idempotency_key TEXT UNIQUE
);

-- Integration sync log for reconciliation
CREATE TABLE integration_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,
  source_system TEXT NOT NULL,
  records_checked INTEGER,
  records_synced INTEGER,
  records_failed INTEGER,
  discrepancies JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running'
);
```

#### CRM Database Additions

```sql
-- Add WMS linkage columns
ALTER TABLE customers ADD COLUMN wms_synced_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN wms_last_order_id UUID;
ALTER TABLE customers ADD COLUMN wms_total_orders INTEGER DEFAULT 0;
ALTER TABLE deals ADD COLUMN wms_reservation_id UUID;
ALTER TABLE deals ADD COLUMN wms_order_id UUID;
ALTER TABLE deals ADD COLUMN wms_shipment_status TEXT;

-- WMS inventory cache
CREATE TABLE wms_inventory_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_code TEXT NOT NULL,
  color_code TEXT NOT NULL,
  available_meters NUMERIC,
  reserved_meters NUMERIC,
  total_meters NUMERIC,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quality_code, color_code)
);

-- WMS events received (for idempotency)
CREATE TABLE wms_events_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  UNIQUE(event_id)
);
```

---

### RLS & Security Model

#### Role Matrix (Integration Permissions)

| Role | WMS Functions | CRM Functions |
|------|---------------|---------------|
| admin | Full access | Full access |
| senior_manager | Read + Link customers | Read inventory |
| warehouse_staff | Link customers on orders | N/A |
| accounting | Read-only | N/A |
| salesperson | N/A | Read inventory, create orders |

#### API Key Scopes

| Scope | WMS Grants | CRM Grants |
|-------|------------|------------|
| `inventory:read` | Query stock levels | Query stock levels |
| `catalog:read` | Query catalog items | Query catalog items |
| `order:write` | Create orders | Create orders |
| `customer:read` | N/A | Query customer data |
| `webhook:receive` | N/A | Process WMS events |

#### RLS Policies

```sql
-- WMS: integration_outbox (only system can insert/update)
CREATE POLICY "System can manage outbox"
  ON integration_outbox FOR ALL
  USING (true)
  WITH CHECK (true);

-- WMS: crm_customer_cache (authenticated users can read)
CREATE POLICY "Authenticated can read customer cache"
  ON crm_customer_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- CRM: wms_events_received (organization isolation)
CREATE POLICY "Organization isolation for WMS events"
  ON wms_events_received FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()));
```

---

### Workflow Mapping

#### Workflow 1: Quote/Inquiry → Order → Reservation → Shipment

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  CRM Sales User                                                                   │
│       │                                                                          │
│       ├──[Creates Deal]──► CRM Deal (status: negotiation)                        │
│       │                                                                          │
│       ├──[Checks Inventory]──► WMS API: /api-get-inventory                       │
│       │                          └──► Returns: {quality, color, available_meters}│
│       │                                                                          │
│       ├──[Wins Deal]──► CRM triggers: deal.won webhook to WMS                    │
│       │                                                                          │
└───────┼──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  WMS System (receives deal.won or manual order creation)                          │
│       │                                                                          │
│       ├──[Creates Reservation]──► WMS reservation_lines                          │
│       │       └──► Outbox: reservation.created                                   │
│       │                                                                          │
│       ├──[Creates Order]──► WMS orders (crm_customer_id, crm_deal_id linked)     │
│       │       └──► Outbox: order.created                                         │
│       │                                                                          │
│       ├──[Fulfills Order]──► WMS rolls picked, lots updated                      │
│       │       └──► Outbox: order.fulfilled                                       │
│       │                                                                          │
│       ├──[Ships Order]──► WMS shipment record                                    │
│       │       └──► Outbox: shipment.posted                                       │
│       │                                                                          │
└───────┼──────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  CRM System (receives WMS webhooks)                                               │
│       │                                                                          │
│       ├──[Receives reservation.created]──► Creates activity, updates deal stage  │
│       ├──[Receives order.created]──► Links wms_order_id to deal                  │
│       ├──[Receives order.fulfilled]──► Updates deal stage to "fulfillment"       │
│       ├──[Receives shipment.posted]──► Updates wms_shipment_status on deal       │
│       │                                                                          │
│       └──► CRM User sees complete order timeline in deal view                    │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### Test Plan

#### Unit Tests

| Test | Location | Coverage |
|------|----------|----------|
| Customer cache lookup | `crm-get-customer` | Cache hit/miss, stale refresh |
| Outbox event creation | DB trigger tests | All event types |
| Webhook payload format | `webhook-dispatcher` | Schema validation |
| HMAC signature | Both projects | Sign/verify round-trip |

#### Integration Tests

| Test | Systems | Scenario |
|------|---------|----------|
| Customer sync | WMS + CRM | Create customer in CRM, query in WMS |
| Order flow | WMS + CRM | Create order, verify CRM activity |
| Webhook delivery | WMS → CRM | Full round-trip with retry |
| Inventory API | CRM → WMS | Query stock, verify response |

#### E2E Tests

| Test | Description |
|------|-------------|
| Full order lifecycle | Deal → Reservation → Order → Fulfill → Ship |
| Webhook failure recovery | Kill CRM, queue events, recover, verify sync |
| Concurrent operations | Multiple orders, verify no race conditions |

#### Rollback Plan

| Phase | Rollback Action | Time |
|-------|-----------------|------|
| F-0 | Drop columns, tables, secrets | 5 min |
| F-1 | Disable outbox processing | 1 min |
| F-2 | Disable webhook types | 1 min |
| F-3 | Disable reconciler CRON | 1 min |

---

### Open Questions / Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Network failures between projects | Missed events | Outbox pattern + retry + reconciler |
| CRM customer ID format mismatch | Broken links | Validate UUID format, fallback to code |
| High webhook volume | CRM overload | Rate limit + batch events |
| Cache staleness | Stale customer data | 24h TTL + reconciler |
| API key rotation | Auth failures | Support key overlap period |
| Multi-tenant WMS (future) | Schema changes | Design with org_id from start |

---

### Deliverables Summary

#### SQL Migrations

| File | Purpose |
|------|---------|
| `add_crm_columns.sql` | Add crm_customer_id to orders/reservations/inquiries |
| `create_integration_tables.sql` | Create outbox, sync_log, cache tables |
| `create_integration_rls.sql` | RLS policies for integration tables |

#### Edge Functions

| Function | Purpose |
|----------|---------|
| `crm-get-customer` | Lookup CRM customer from WMS |
| `process-integration-outbox` | Process outbox → send webhooks |
| `integration-reconciler` | CRON: sync cache, detect discrepancies |

#### CRM Edge Functions (in CRM project)

| Function | Purpose |
|----------|---------|
| `wms-webhook-receiver` | Receive/validate WMS webhooks |
| `api-get-customer` | Expose customer data to WMS |

### Success Criteria (Definition of Done)

- [ ] Orders created in WMS appear as CRM activities within 30s
- [ ] Customer lookup in WMS returns CRM data with < 500ms latency
- [ ] Webhook delivery success rate > 99%
- [ ] Data consistency > 99.9% after reconciliation
- [ ] Deep links work bidirectionally between apps
- [ ] All integration tables have RLS policies
- [ ] Feature flags allow disabling integration per-component

---

## 10. Priority Decision Matrix

### Recommended Execution Order

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECOMMENDED PRIORITY ORDER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ Batch L: Report Builder Execution    (2.5 days) - COMPLETE               │
│  ✅ Batch J: Offline & Reliability       (2 days) - COMPLETE                 │
│  ✅ Batch K: Webhook & Integration       (1.5 days) - COMPLETE               │
│  ✅ Batch O: Quality of Life             (2 days) - COMPLETE                 │
│  ✅ Batch N: Admin & Security            (1.5 days) - COMPLETE               │
│  ✅ Batch M: Advanced Forecasting        (2.5 days) - COMPLETE               │
│  ✅ Batch WMS-1/2/3: WMS Architecture    (5-7 days) - COMPLETE               │
│  ✅ Batch PERF-1/2/3/4/5: Performance    (1-2 days) - COMPLETE               │
│                                                                              │
│  🎯 NEXT: Batch F: CRM ↔ WMS Integration (6 days, ~25-35 credits)            │
│     Phase F-0: Foundation (1 day)                                            │
│     Phase F-1: Customer Sync + Reservation (2 days)                          │
│     Phase F-2: Order Fulfillment + Shipment (2 days)                         │
│     Phase F-3: Edge Cases + Reconciliation (1 day)                           │
│                                                                              │
│  🔴 Batch P: AI Extraction Refactoring   (2.5 days, ~10-15 credits)          │
│     → Deferred per user request                                             │
│                                                                              │
│  🔴 Batch I: OCR Pipeline Overhaul       (3 days, ~11-17 credits)            │
│     → Deferred per user request                                             │
│                                                                              │
│  ⏸️ Batch WMS-4/5: Warehouses + Transfers (4-6 days)                         │
│     → Sidelined until multi-location needed                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Total Remaining Effort

| Priority | Batches | Days | Credits |
|----------|---------|------|---------|
| **CRM Integration** | F (F-0, F-1, F-2, F-3) | 6 | ~25-35 |
| AI/OCR (deferred) | P, I | 5.5 | ~21-32 |
| Sidelined | WMS-4, WMS-5 | 4-6 | ~15-25 |
| **TOTAL REMAINING** | 6 batches | **15.5-17.5** | **~61-92** |

---

## 11. Changelog

### 2026-01-08 (v5.0.0) - CRM ↔ WMS Integration Architecture

- 🎯 **Major**: Added comprehensive CRM ↔ WMS Integration plan (Batch F)
- 📋 Added Section 9: CRM ↔ WMS Integration with 4 phases:
  - Phase F-0: Foundation (outbox tables, secrets, schema changes)
  - Phase F-1: Customer Sync + Reservation Flow
  - Phase F-2: Order Fulfillment + Shipment Events
  - Phase F-3: Edge Cases + CRON Reconciliation
- 📋 Defined integration contracts:
  - Entity ownership matrix (CRM owns customers, WMS owns inventory)
  - 9 WMS → CRM webhook event types
  - 4 CRM → WMS webhook event types
  - API endpoint specifications for both projects
- 📋 Detailed data model changes for both WMS and CRM databases
- 📋 RLS & security model with role matrix and API key scopes
- 📋 Workflow mapping with sequence diagrams
- 📋 Test plan (unit, integration, E2E)
- 📋 Rollback plan for each phase
- 📋 Open questions and risk mitigations
- 🎯 Decision: Two Supabase projects with webhook sync (not shared DB)
- 🎯 Decision: Outbox pattern for reliable event delivery

### 2026-01-07 (v4.3.0) - WMS Phase 1 Complete

- ✅ Batch WMS-1: Inventory Transaction Ledger complete
  - Created `inventory_transactions` table with RLS
  - Defined `inventory_transaction_type` enum with 8 types
  - Built `/inventory-transactions` page with filtering
- ✅ Batch WMS-2: Stock Count Adjustments complete
  - Connected stock-take reconciliation to ledger
  - Created `useInventoryTransaction` hook
- ✅ Batch WMS-3: Order Fulfillment Traceability complete
  - Added `logOrderFulfillment` helper
  - Integrated into order fulfillment flow
  - Added `logIncomingReceipt` helper for lot intake

### 2026-01-06 (v4.2.0) - WMS Architecture Enhancement

- 📋 Added Section 6: WMS Architecture Enhancement Batches
- 📋 Documented PRD alignment decisions for DEP-M1 through DEP-M8
- ➕ Added Batch WMS-1: Inventory Transaction Ledger (P0)
- ➕ Added Batch WMS-2: Stock Count Adjustments (P0)
- ➕ Added Batch WMS-3: Order Fulfillment Traceability (P1)
- ⏸️ Sidelined Batch WMS-4: Warehouses + Locations (Phase 2)
- ⏸️ Sidelined Batch WMS-5: Transfers (Phase 2)
- 🎯 Decision: Use `catalog_items` as item master (no separate items table)
- 🎯 Decision: Existing lots/rolls provide lot tracking (no changes needed for DEP-M5)

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
| 4.2.0 | 2026-01-06 | WMS Architecture Enhancement batches (WMS-1 to WMS-5) |
| 4.3.0 | 2026-01-07 | WMS Phase 1 complete; Performance batches complete |
| **5.0.0** | **2026-01-08** | **CRM ↔ WMS Integration Architecture (Batch F rewrite)** |
