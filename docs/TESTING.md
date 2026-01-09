# WMS Application - Production Readiness Test Specification

> **Document Version:** 2.0  
> **Last Updated:** 2026-01-09  
> **Purpose:** Comprehensive production readiness testing for all WMS features, integrations, and infrastructure  
> **Original Scope:** CRM ↔ WMS integration testing (now expanded to full application)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Application Inventory](#2-application-inventory)
3. [Environments & Test Accounts](#3-environments--test-accounts)
4. [Roles & Permissions Matrix](#4-roles--permissions-matrix)
5. [Global Test Standards](#5-global-test-standards)
6. [Test Suites](#6-test-suites)
   - 6.1 [Platform & Security](#61-platform--security)
   - 6.2 [WMS Core Features](#62-wms-core-features)
   - 6.3 [Audit Logs](#63-audit-logs)
   - 6.4 [Edge Functions](#64-edge-functions)
   - 6.5 [CRON/Scheduled Jobs](#65-cronscheduled-jobs)
   - 6.6 [Storage & File Handling](#66-storage--file-handling)
   - 6.7 [Email & Notifications](#67-email--notifications)
   - 6.8 [Webhooks](#68-webhooks)
   - 6.9 [Offline & PWA](#69-offline--pwa)
   - 6.10 [CRM ↔ WMS Integration](#610-crm--wms-integration)
7. [Non-Functional Testing](#7-non-functional-testing)
8. [Production Go/No-Go Checklist](#8-production-gono-go-checklist)
9. [Coverage Matrix](#9-coverage-matrix)
10. [Appendix](#10-appendix)

---

## 1. Purpose & Scope

### 1.1 What This Document Covers

This document provides a complete production readiness test specification for the WMS (Warehouse Management System) application, including:

- **All application features** (42 pages/routes)
- **Platform capabilities** (authentication, authorization, session management, MFA)
- **Database security** (RLS policies, role-based access)
- **Edge Functions** (40+ serverless functions)
- **CRON/Scheduled Jobs** (13 scheduled tasks)
- **Integrations** (CRM ↔ WMS, webhooks, external APIs)
- **Offline/PWA capabilities**
- **Audit logging and compliance**

### 1.2 Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial CRM ↔ WMS integration testing focus |
| 2.0 | 2026-01-09 | Expanded to full production readiness specification |

### 1.3 Out of Scope

- Load/stress testing at scale (separate document)
- Penetration testing (separate security audit)
- Third-party service availability testing

---

## 2. Application Inventory

### 2.1 WMS Feature List (Pages/Routes)

| Route | Page | Description | Auth Required | Roles |
|-------|------|-------------|---------------|-------|
| `/` | Index | Landing/redirect | No | All |
| `/auth` | Auth | Login/signup | No | All |
| `/reset-password` | ResetPassword | Password reset flow | No | All |
| `/invite-accept` | InviteAccept | Accept user invitation | No | All |
| `/dashboard` | Dashboard | Main dashboard | Yes | All |
| `/inventory` | Inventory | Inventory management | Yes | All |
| `/inventory/excel` | InventoryExcel | Excel-style inventory view | Yes | All |
| `/inventory/transactions` | InventoryTransactions | Transaction history | Yes | All |
| `/orders` | Orders | Order management | Yes | All |
| `/order-queue` | OrderQueue | Order processing queue | Yes | warehouse_staff, admin |
| `/reservations` | Reservations | Reservation management | Yes | All |
| `/inquiries` | Inquiries | Inquiry management | Yes | All |
| `/manufacturing-orders` | ManufacturingOrders | MO management | Yes | All |
| `/incoming-stock` | IncomingStock | Incoming stock receipt | Yes | warehouse_staff, admin |
| `/goods-receipt` | GoodsReceipt | Goods receipt posting | Yes | warehouse_staff, admin |
| `/lot-intake` | LotIntake | Lot intake processing | Yes | warehouse_staff, admin |
| `/lot-queue` | LotQueue | Lot processing queue | Yes | warehouse_staff, admin |
| `/lot-selection` | LotSelection | Lot selection for orders | Yes | All |
| `/lot-details/:id` | LotDetails | Individual lot details | Yes | All |
| `/quality-details/:id` | QualityDetails | Quality code details | Yes | All |
| `/bulk-selection` | BulkSelection | Bulk lot selection | Yes | All |
| `/stock-take/capture` | StockTakeCapture | Stock take photo capture | Yes | warehouse_staff, admin |
| `/stock-take/review` | StockTakeReview | Stock take review | Yes | admin |
| `/catalog` | Catalog | Catalog management | Yes | All |
| `/catalog/:id` | CatalogDetail | Catalog item details | Yes | All |
| `/suppliers` | Suppliers | Supplier management | Yes | admin, accounting |
| `/forecast` | Forecast | Demand forecasting | Yes | admin, accounting |
| `/forecast/settings` | ForecastSettings | Forecast configuration | Yes | admin |
| `/reports` | Reports | Report viewing | Yes | All |
| `/reports/builder` | ReportBuilder | Custom report builder | Yes | admin, accounting |
| `/approvals` | Approvals | Approval queue | Yes | admin |
| `/audit-logs` | AuditLogs | Audit log viewer | Yes | admin |
| `/admin` | Admin | Admin settings | Yes | admin |
| `/api-docs` | ApiDocs | API documentation | Yes | admin |
| `/qr-scan` | QRScan | QR code scanning | Yes | All |
| `/qr-print` | QRPrint | QR code printing | Yes | warehouse_staff, admin |
| `/extraction-test` | ExtractionTest | OCR extraction testing | Yes | admin |
| `/terms` | Terms | Terms of service | No | All |
| `/privacy` | Privacy | Privacy policy | No | All |
| `/cookies` | Cookies | Cookie policy | No | All |
| `/kvkk` | KVKK | KVKK compliance | No | All |
| `*` | NotFound | 404 page | No | All |

### 2.2 Shared/Platform Feature List

| Feature | Description | Components/Hooks |
|---------|-------------|------------------|
| Authentication | Login, logout, signup, password reset | `useAuth`, `Auth.tsx` |
| Session Management | Timeout, refresh, invalidation | `useSessionTimeout`, `useSessionExpiry` |
| MFA | TOTP enrollment and verification | `MFAEnroll`, `MFAVerify`, `MFAGate` |
| Role-Based Access | Permission checking | `usePermissions`, `PermissionsContext` |
| Audit Logging | Action tracking | `useAuditLog`, `log_audit_action` RPC |
| Global Search | Cross-entity search | `GlobalSearch`, `CommandPalette` |
| Offline Support | Offline data access and sync | `OfflineContext`, `useOfflineQuery` |
| Notifications | In-app notifications | `NotificationCenter`, `useNotifications` |
| PWA | Progressive web app | `InstallPrompt`, service worker |
| Error Handling | Error boundaries, toasts | `ErrorBoundary`, `sonner` |
| Keyboard Shortcuts | Navigation shortcuts | `useKeyboardShortcuts`, `ShortcutsHelp` |
| Product Tours | Onboarding tours | `TourProvider`, `useProductTour` |

### 2.3 Edge Functions List

| Function Name | Purpose | Auth (JWT) | Type |
|---------------|---------|------------|------|
| `admin-change-password` | Admin password reset | Yes | Admin |
| `admin-deactivate-user` | Deactivate user account | Yes | Admin |
| `admin-delete-user` | Delete user account | Yes | Admin |
| `admin-reconcile-users` | Reconcile user data | Yes | Admin |
| `api-create-order` | Create order via API | API Key | API |
| `api-get-catalog` | Get catalog via API | API Key | API |
| `api-get-inventory` | Get inventory via API | API Key | API |
| `autocomplete-colors` | Color autocomplete | Yes | Utility |
| `autocomplete-qualities` | Quality autocomplete | Yes | Utility |
| `calculate-forecast-accuracy` | Calculate forecast accuracy | Yes | Forecast |
| `check-stock-alerts` | Check low stock alerts | No (CRON) | CRON |
| `cleanup-old-audit-logs` | Clean old audit logs | No (CRON) | CRON |
| `cleanup-old-drafts` | Clean old PO drafts | No (CRON) | CRON |
| `confirm-draft` | Confirm PO draft | Yes | Orders |
| `export-database` | Export database backup | Yes | Admin |
| `extract-order` | AI order extraction | Yes | AI/OCR |
| `forecast-engine` | Run forecast engine | Yes | Forecast |
| `forecast-import-history` | Import historical data | Yes | Forecast |
| `generate-report-attachment` | Generate report PDF/Excel | Yes | Reports |
| `get-report-schema` | Get report schema | Yes | Reports |
| `health-check` | System health check | No | Utility |
| `migrate-catalog-items` | Migrate catalog data | Yes | Migration |
| `process-email-retries` | Retry failed emails | No (CRON) | CRON |
| `process-ocr-queue` | Process OCR queue | No (CRON) | CRON |
| `process-webhook-retries` | Retry failed webhooks | No (CRON) | CRON |
| `repair-audit-inconsistencies` | Fix audit log issues | Yes | Admin |
| `reverse-audit-action` | Reverse audited action | Yes | Audit |
| `send-forecast-digest` | Send forecast digest | No (CRON) | CRON |
| `send-in-app-notification` | Send notification | Yes | Notifications |
| `send-invitation` | Send user invitation | Yes | Admin |
| `send-mo-reminders` | MO reminder emails | No (CRON) | CRON |
| `send-overdue-digest` | Send overdue digest | No (CRON) | CRON |
| `send-pending-approvals-digest` | Approval digest | No (CRON) | CRON |
| `send-reservation-reminders` | Reservation reminders | No (CRON) | CRON |
| `send-scheduled-report` | Send scheduled report | No (CRON) | CRON |
| `send-test-email` | Send test email | Yes | Admin |
| `stock-take-ocr` | Process stock take OCR | Yes | OCR |
| `take-daily-snapshot` | Daily data snapshot | No (CRON) | CRON |
| `test-extraction` | Test OCR extraction | Yes | Dev |
| `validate-extraction` | Validate extraction data | Yes | OCR |
| `webhook-dispatcher` | Dispatch webhooks | No (CRON) | Webhooks |

### 2.4 CRON/Scheduled Jobs

| Job Name | Schedule | Edge Function | Purpose |
|----------|----------|---------------|---------|
| Draft Cleanup | Daily | `cleanup-old-drafts` | Remove stale PO drafts |
| MO Reminders | Daily | `send-mo-reminders` | Send MO deadline reminders |
| Audit Log Cleanup | Weekly | `cleanup-old-audit-logs` | Remove old audit logs |
| Stock Alerts | Hourly | `check-stock-alerts` | Check low stock thresholds |
| Forecast Digest | Weekly | `send-forecast-digest` | Send forecast summary |
| Reservation Reminders | Daily | `send-reservation-reminders` | Expiring reservation alerts |
| Overdue Digest | Daily | `send-overdue-digest` | Overdue items digest |
| Approvals Digest | Daily | `send-pending-approvals-digest` | Pending approvals summary |
| Email Retries | Every 5 min | `process-email-retries` | Retry failed emails |
| OCR Queue | Every 1 min | `process-ocr-queue` | Process pending OCR |
| Scheduled Reports | Per config | `send-scheduled-report` | Execute scheduled reports |
| Daily Snapshot | Daily | `take-daily-snapshot` | Data snapshot for analytics |
| Webhook Retries | Every 5 min | `process-webhook-retries` | Retry failed webhooks |

### 2.5 Database Objects Summary

| Category | Count | Notes |
|----------|-------|-------|
| Tables | 79 | Core business tables |
| RLS Policies | 238+ | Row-level security |
| Functions | 15+ | Database functions |
| Triggers | 20+ | Automation triggers |
| Enums | 15+ | Type definitions |
| Views | 5+ | Materialized views |
| Indexes | 100+ | Performance indexes |

#### Key Tables by Domain

**Inventory Domain:**
- `lots`, `rolls`, `inventory_transactions`, `incoming_stock`
- `qualities`, `quality_colors`, `quality_metadata`

**Orders Domain:**
- `orders`, `order_lines`, `shipments`
- `po_drafts`, `ai_usage`

**Reservations Domain:**
- `reservations`, `reservation_lines`

**Manufacturing Domain:**
- `manufacturing_orders`, `mo_status_history`

**Catalog Domain:**
- `catalog_items`, `catalog_item_suppliers`
- `catalog_custom_field_definitions`, `catalog_custom_field_values`
- `catalog_item_audit_logs`, `catalog_user_views`

**Stock Take Domain:**
- `count_sessions`, `count_rolls`

**Forecast Domain:**
- `demand_history`, `forecast_runs`, `forecast_results`
- `forecast_alerts`, `forecast_accuracy`, `forecast_settings_global`

**Email Domain:**
- `email_templates`, `email_template_versions`, `email_log`
- `email_schedules`, `email_recipients`, `email_digest_configs`

**Reports Domain:**
- `email_report_configs`, `report_executions`

**Security Domain:**
- `profiles`, `user_roles`, `user_sessions`
- `admin_ip_whitelist`, `api_keys`, `api_request_logs`

**Audit Domain:**
- `audit_logs`, `field_edit_queue`

**Integration Domain:**
- `webhook_subscriptions`, `webhook_logs`
- `inquiry_submissions`, `inquiries`

### 2.6 Scripts List

| Script | Location | Purpose |
|--------|----------|---------|
| `check-translations.js` | `scripts/` | Validate i18n translations |
| `i18n-audit.ts` | `scripts/` | Audit translation coverage |

### 2.7 Storage Buckets

| Bucket | Purpose | Public | RLS |
|--------|---------|--------|-----|
| `catalog-files` | Catalog spec sheets, images | No | Yes |
| `stock-take-photos` | Stock take captured images | No | Yes |
| `report-attachments` | Generated report files | No | Yes |
| `order-attachments` | Order documents | No | Yes |
| `avatars` | User profile images | Yes | Yes |

---

## 3. Environments & Test Accounts

### 3.1 Test Environments

| Environment | URL | Purpose | Data |
|-------------|-----|---------|------|
| Development | `localhost:8080` | Local development | Mock/seed data |
| Staging | TBD | Pre-production testing | Anonymized production data |
| Production | `app.lotastro.com` | Live system | Production data |

### 3.2 Required Test Accounts

| Role | Email Pattern | Purpose |
|------|---------------|---------|
| Admin | `test.admin@example.com` | Full system access |
| Warehouse Staff | `test.warehouse@example.com` | Warehouse operations |
| Accounting | `test.accounting@example.com` | Financial operations |
| Sales | `test.sales@example.com` | Sales operations |
| Read-Only | `test.readonly@example.com` | View-only access |

### 3.3 Test Data Requirements

- Minimum 100 lots across 10+ qualities
- 50+ orders in various statuses
- 20+ reservations (active, expired, converted)
- 10+ manufacturing orders
- 5+ stock take sessions
- 100+ catalog items
- 6+ months of demand history (for forecasting)

---

## 4. Roles & Permissions Matrix

### 4.1 Role Definitions

| Role | Code | Description |
|------|------|-------------|
| Administrator | `admin` | Full system access |
| Warehouse Staff | `warehouse_staff` | Inventory operations |
| Accounting | `accounting` | Financial operations |
| Sales | `sales` | Sales and customer operations |

### 4.2 Page Access Matrix

| Page | admin | warehouse_staff | accounting | sales |
|------|-------|-----------------|------------|-------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Inventory | ✅ | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ | ✅ |
| Reservations | ✅ | ✅ | ✅ | ✅ |
| Inquiries | ✅ | ✅ | ✅ | ✅ |
| Manufacturing Orders | ✅ | ✅ | ✅ | ❌ |
| Incoming Stock | ✅ | ✅ | ❌ | ❌ |
| Goods Receipt | ✅ | ✅ | ❌ | ❌ |
| Stock Take Capture | ✅ | ✅ | ❌ | ❌ |
| Stock Take Review | ✅ | ❌ | ❌ | ❌ |
| Catalog | ✅ | ✅ | ✅ | ✅ |
| Suppliers | ✅ | ❌ | ✅ | ❌ |
| Forecast | ✅ | ❌ | ✅ | ❌ |
| Forecast Settings | ✅ | ❌ | ❌ | ❌ |
| Reports | ✅ | ✅ | ✅ | ✅ |
| Report Builder | ✅ | ❌ | ✅ | ❌ |
| Approvals | ✅ | ❌ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ | ❌ |
| Admin | ✅ | ❌ | ❌ | ❌ |

### 4.3 Action Permissions

| Action | admin | warehouse_staff | accounting | sales |
|--------|-------|-----------------|------------|-------|
| Create Orders | ✅ | ✅ | ✅ | ✅ |
| Fulfill Orders | ✅ | ✅ | ❌ | ❌ |
| Cancel Orders | ✅ | ❌ | ❌ | ❌ |
| Create Reservations | ✅ | ✅ | ✅ | ✅ |
| Release Reservations | ✅ | ✅ | ❌ | ✅ |
| Add Incoming Stock | ✅ | ✅ | ❌ | ❌ |
| Approve Catalog Items | ✅ | ❌ | ❌ | ❌ |
| Run Forecast | ✅ | ❌ | ✅ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ | ❌ |
| Reverse Audit Actions | ✅ | ❌ | ❌ | ❌ |
| Manage API Keys | ✅ | ❌ | ❌ | ❌ |
| Export Database | ✅ | ❌ | ❌ | ❌ |

### 4.4 Negative Access Tests Required

| Test | Expected Result |
|------|-----------------|
| Warehouse staff access Admin page | 403 or redirect |
| Accounting access Stock Take Review | 403 or redirect |
| Sales access Manufacturing Orders | 403 or redirect |
| Any role access other user's data | RLS blocks access |
| Expired session access protected page | Redirect to login |
| Invalid role in token | Access denied |

---

## 5. Global Test Standards

### 5.1 Severity Definitions

| Severity | Code | Definition | Response |
|----------|------|------------|----------|
| Blocker | S1 | System unusable, data loss, security breach | Immediate fix required |
| Critical | S2 | Major feature broken, no workaround | Fix before release |
| Major | S3 | Feature impaired, workaround exists | Fix in current cycle |
| Minor | S4 | Cosmetic, minor inconvenience | Fix when possible |

### 5.2 Priority Definitions

| Priority | Code | Definition | Test Timing |
|----------|------|------------|-------------|
| P0 | Must Pass | Release blocker | Every build |
| P1 | High | Critical functionality | Every release |
| P2 | Medium | Important but not blocking | Weekly |

### 5.3 Evidence Requirements

| Test Type | Required Evidence |
|-----------|-------------------|
| Functional | Screenshot of result, console log if error |
| Security | Request/response, RLS query result |
| API | Full request/response, headers |
| Edge Function | Function logs, response body |
| CRON | Job execution log, timestamp |

### 5.4 Pass/Fail Gating Rules

**Release BLOCKED if:**
- Any P0 test fails
- Any Blocker severity defect open
- Security test fails
- RLS policy bypassed
- Data corruption detected

**Release ALLOWED with:**
- All P0 tests pass
- No Blocker/Critical defects
- P1 tests at 95%+ pass rate
- Known issues documented

---

## 6. Test Suites

### 6.1 Platform & Security

#### 6.1.1 Authentication

---

**TC-ID:** PLAT-AUTH-001  
**Title:** Valid email/password login  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Valid user account exists, not locked  
**Test Data:** Valid email, valid password  
**Steps:**
1. Navigate to `/auth`
2. Enter valid email
3. Enter valid password
4. Click "Sign In"

**Expected Result:** User redirected to dashboard, session created  
**Pass Criteria:** Dashboard loads, user menu shows correct name  
**Fail Signals:** Error toast, stays on auth page, console errors  
**Evidence to capture:** Screenshot of dashboard, network tab showing session  
**Notes/Variations:** Test with MFA-enabled account separately

---

**TC-ID:** PLAT-AUTH-002  
**Title:** Invalid password login attempt  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Valid user account exists  
**Test Data:** Valid email, wrong password  
**Steps:**
1. Navigate to `/auth`
2. Enter valid email
3. Enter incorrect password
4. Click "Sign In"

**Expected Result:** Error message displayed, no session created  
**Pass Criteria:** Toast shows "Invalid login credentials", stays on auth page  
**Fail Signals:** Login succeeds, generic error, no feedback  
**Evidence to capture:** Screenshot of error message  
**Notes/Variations:** Message should not reveal if email exists

---

**TC-ID:** PLAT-AUTH-003  
**Title:** Rate limiting on failed logins  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Valid user account exists  
**Test Data:** Valid email, wrong password (5+ attempts)  
**Steps:**
1. Navigate to `/auth`
2. Attempt login with wrong password 5+ times rapidly
3. Attempt login with correct password

**Expected Result:** Account temporarily locked, lockout message shown  
**Pass Criteria:** Lockout activates, correct password rejected during lockout  
**Fail Signals:** No rate limiting, can brute force indefinitely  
**Evidence to capture:** Error message, timestamp of lockout  
**Notes/Variations:** Test lockout duration (usually 15-30 minutes)

---

**TC-ID:** PLAT-AUTH-004  
**Title:** Session persistence across refresh  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** User logged in  
**Test Data:** Active session  
**Steps:**
1. Login successfully
2. Refresh the page (F5)
3. Navigate to different pages

**Expected Result:** Session maintained, no re-login required  
**Pass Criteria:** User remains logged in, data loads correctly  
**Fail Signals:** Redirected to login, session lost  
**Evidence to capture:** Network tab showing token refresh  
**Notes/Variations:** Test across tabs as well

---

**TC-ID:** PLAT-AUTH-005  
**Title:** Logout clears session completely  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User logged in  
**Test Data:** Active session  
**Steps:**
1. Click user menu
2. Click "Logout"
3. Try to navigate to `/dashboard` directly
4. Check localStorage/sessionStorage

**Expected Result:** Session cleared, redirected to login, storage cleaned  
**Pass Criteria:** Cannot access protected pages, storage empty  
**Fail Signals:** Can still access pages, token remains in storage  
**Evidence to capture:** Screenshot of login page, storage inspector  
**Notes/Variations:** Test "logout everywhere" if available

---

**TC-ID:** PLAT-AUTH-006  
**Title:** Password reset flow  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Valid user account exists  
**Test Data:** Valid email  
**Steps:**
1. Navigate to `/auth`
2. Click "Forgot Password"
3. Enter email
4. Check email for reset link
5. Click reset link
6. Enter new password
7. Login with new password

**Expected Result:** Password changed, can login with new password  
**Pass Criteria:** Reset email received, new password works  
**Fail Signals:** No email, link expired, old password still works  
**Evidence to capture:** Email screenshot, successful login  
**Notes/Variations:** Test with expired link (after 1 hour)

---

**TC-ID:** PLAT-AUTH-007  
**Title:** Signup with valid data  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Email not already registered  
**Test Data:** New email, strong password, full name  
**Steps:**
1. Navigate to `/auth`
2. Switch to signup tab
3. Enter full name
4. Enter new email
5. Enter strong password
6. Click "Sign Up"

**Expected Result:** Account created, confirmation email sent (if enabled)  
**Pass Criteria:** Success message, profile created in database  
**Fail Signals:** Error, no profile created, duplicate allowed  
**Evidence to capture:** Success message, database query for profile  
**Notes/Variations:** Check if email confirmation required

---

**TC-ID:** PLAT-AUTH-008  
**Title:** Signup with weak password rejected  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Password policy enabled  
**Test Data:** New email, weak password (e.g., "123")  
**Steps:**
1. Navigate to `/auth`
2. Switch to signup tab
3. Enter valid name and email
4. Enter weak password
5. Observe password strength indicator
6. Try to submit

**Expected Result:** Password rejected, strength indicator shows weak  
**Pass Criteria:** Cannot submit, clear error message  
**Fail Signals:** Weak password accepted, no indicator  
**Evidence to capture:** Screenshot of strength indicator and error  
**Notes/Variations:** Test various weak patterns

---

**TC-ID:** PLAT-AUTH-009  
**Title:** Duplicate email rejected on signup  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Email already registered  
**Test Data:** Existing email  
**Steps:**
1. Navigate to `/auth`
2. Switch to signup tab
3. Enter existing email
4. Complete other fields
5. Click "Sign Up"

**Expected Result:** Error indicating email already registered  
**Pass Criteria:** Clear error message, no duplicate account  
**Fail Signals:** Account created, generic error  
**Evidence to capture:** Error message screenshot  
**Notes/Variations:** Error should not confirm email exists (security)

---

**TC-ID:** PLAT-AUTH-010  
**Title:** Invitation accept creates account  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Invitation sent by admin  
**Test Data:** Valid invitation link  
**Steps:**
1. Receive invitation email
2. Click invitation link
3. Set password
4. Complete profile setup
5. Login

**Expected Result:** Account created with invited role  
**Pass Criteria:** User has correct role, can access allowed pages  
**Fail Signals:** Wrong role, invitation expired error  
**Evidence to capture:** User role in database, accessible pages  
**Notes/Variations:** Test expired invitation (after 7 days)

---

#### 6.1.2 Session Management

---

**TC-ID:** PLAT-SESSION-001  
**Title:** Session timeout after inactivity  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Session timeout configured (e.g., 30 min)  
**Test Data:** Active session  
**Steps:**
1. Login successfully
2. Note current time
3. Leave browser idle for timeout duration + 1 min
4. Try to perform any action

**Expected Result:** Session expired, redirected to login with message  
**Pass Criteria:** Warning shown before expiry, graceful redirect  
**Fail Signals:** Session persists indefinitely, no warning  
**Evidence to capture:** Timeout warning, redirect screenshot  
**Notes/Variations:** Test activity extends timeout

---

**TC-ID:** PLAT-SESSION-002  
**Title:** Session warning before expiry  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Session timeout configured  
**Test Data:** Active session  
**Steps:**
1. Login successfully
2. Wait until warning period (e.g., 5 min before expiry)
3. Observe warning dialog

**Expected Result:** Warning dialog with countdown, extend option  
**Pass Criteria:** Dialog appears, extend button works  
**Fail Signals:** No warning, abrupt logout  
**Evidence to capture:** Screenshot of warning dialog  
**Notes/Variations:** Test extend session action

---

**TC-ID:** PLAT-SESSION-003  
**Title:** Concurrent session handling  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** User logged in on one device  
**Test Data:** Same account credentials  
**Steps:**
1. Login on Device A
2. Login on Device B with same account
3. Perform actions on Device A

**Expected Result:** Both sessions work OR earlier session invalidated (per policy)  
**Pass Criteria:** Behavior matches configured policy  
**Fail Signals:** Data corruption, undefined behavior  
**Evidence to capture:** Both device states  
**Notes/Variations:** Test with "single session" policy enabled

---

**TC-ID:** PLAT-SESSION-004  
**Title:** Token refresh before expiry  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Active session, token nearing expiry  
**Test Data:** Session with 5-min remaining token  
**Steps:**
1. Login successfully
2. Monitor network for token refresh calls
3. Continue using application past token expiry time

**Expected Result:** Token refreshed automatically, no interruption  
**Pass Criteria:** New token obtained, user doesn't notice  
**Fail Signals:** Abrupt logout, 401 errors  
**Evidence to capture:** Network tab showing refresh calls  
**Notes/Variations:** Test with network interruption during refresh

---

**TC-ID:** PLAT-SESSION-005  
**Title:** Invalid refresh token handling  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Session with invalid/expired refresh token  
**Test Data:** Manipulated token or very old session  
**Steps:**
1. Have session with expired refresh token
2. Attempt any authenticated action
3. Observe behavior

**Expected Result:** Graceful logout, clear error message, caches cleared  
**Pass Criteria:** Redirect to login, no console errors, clean state  
**Fail Signals:** Infinite loop, cryptic errors, partial state  
**Evidence to capture:** Console log, application state  
**Notes/Variations:** Test `useAuthErrorHandler` behavior

---

#### 6.1.3 MFA (Multi-Factor Authentication)

---

**TC-ID:** PLAT-MFA-001  
**Title:** MFA enrollment generates QR code  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User logged in, MFA not yet enabled  
**Test Data:** Authenticator app (Google Authenticator, Authy)  
**Steps:**
1. Navigate to user settings
2. Click "Enable MFA"
3. Observe QR code display
4. Scan with authenticator app

**Expected Result:** QR code displayed, app adds account successfully  
**Pass Criteria:** QR scans correctly, app shows 6-digit codes  
**Fail Signals:** QR invalid, app rejects scan  
**Evidence to capture:** Screenshot of QR display (redact actual code)  
**Notes/Variations:** Test manual code entry option

---

**TC-ID:** PLAT-MFA-002  
**Title:** MFA enrollment shows backup codes  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User in MFA enrollment flow  
**Test Data:** N/A  
**Steps:**
1. Complete QR code scanning
2. Enter valid OTP to verify
3. Observe backup codes display

**Expected Result:** Backup codes displayed, download option available  
**Pass Criteria:** 8-10 backup codes shown, can download/copy  
**Fail Signals:** No backup codes, cannot save them  
**Evidence to capture:** Screenshot (redact codes in evidence)  
**Notes/Variations:** Verify codes are one-time use

---

**TC-ID:** PLAT-MFA-003  
**Title:** Login with MFA - valid OTP  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User has MFA enabled  
**Test Data:** Valid OTP from authenticator  
**Steps:**
1. Navigate to `/auth`
2. Enter email and password
3. Observe MFA prompt
4. Enter current valid OTP
5. Click verify

**Expected Result:** Login successful, redirected to dashboard  
**Pass Criteria:** Dashboard loads, session created  
**Fail Signals:** OTP rejected, cannot complete login  
**Evidence to capture:** Screenshot of successful login  
**Notes/Variations:** Test OTP timing (30-second window)

---

**TC-ID:** PLAT-MFA-004  
**Title:** Login with MFA - invalid OTP rejected  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User has MFA enabled  
**Test Data:** Invalid OTP (e.g., "000000")  
**Steps:**
1. Navigate to `/auth`
2. Enter email and password
3. Observe MFA prompt
4. Enter invalid OTP
5. Click verify

**Expected Result:** OTP rejected, can retry  
**Pass Criteria:** Error message, not logged in, can retry  
**Fail Signals:** Login succeeds, no error shown  
**Evidence to capture:** Screenshot of error message  
**Notes/Variations:** Test rate limiting on OTP attempts

---

**TC-ID:** PLAT-MFA-005  
**Title:** Login with backup code  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User has MFA enabled, has backup codes  
**Test Data:** Valid backup code  
**Steps:**
1. Start login flow
2. At MFA prompt, click "Use backup code"
3. Enter valid backup code
4. Verify login

**Expected Result:** Login successful, backup code consumed  
**Pass Criteria:** Dashboard loads, same code cannot be reused  
**Fail Signals:** Code rejected, code reusable  
**Evidence to capture:** Successful login, verify code invalidated  
**Notes/Variations:** Test with already-used backup code

---

**TC-ID:** PLAT-MFA-006  
**Title:** MFA enforcement by role  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** MFA required for admin role  
**Test Data:** Admin account without MFA  
**Steps:**
1. Login as admin without MFA
2. Observe MFA enrollment requirement

**Expected Result:** Forced to enroll MFA before accessing system  
**Pass Criteria:** Cannot access dashboard until MFA enrolled  
**Fail Signals:** Can access system without MFA  
**Evidence to capture:** Screenshot of enrollment requirement  
**Notes/Variations:** Test non-admin roles (MFA optional)

---

**TC-ID:** PLAT-MFA-007  
**Title:** Disable MFA  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** User has MFA enabled  
**Test Data:** Valid OTP for confirmation  
**Steps:**
1. Navigate to user settings
2. Click "Disable MFA"
3. Confirm with current OTP
4. Logout and login again

**Expected Result:** MFA disabled, no OTP prompt on next login  
**Pass Criteria:** Login works with just password  
**Fail Signals:** Still requires OTP, cannot disable  
**Evidence to capture:** Settings page showing MFA off  
**Notes/Variations:** Admin accounts may not be able to disable

---

#### 6.1.4 RLS Policy Verification

---

**TC-ID:** PLAT-RLS-001  
**Title:** User cannot access other users' profiles  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Two users exist (User A, User B)  
**Test Data:** User A's session, User B's profile ID  
**Steps:**
1. Login as User A
2. Attempt to query User B's profile directly via Supabase
3. Check console for returned data

**Expected Result:** Query returns empty or only User A's data  
**Pass Criteria:** No data from User B returned  
**Fail Signals:** User B's data visible  
**Evidence to capture:** Query result, network response  
**Notes/Variations:** Test via RPC and direct table access

---

**TC-ID:** PLAT-RLS-002  
**Title:** Orders visible only to authorized roles  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Orders exist, user has view permission  
**Test Data:** Various roles  
**Steps:**
1. Login as each role
2. Navigate to Orders page
3. Check which orders are visible

**Expected Result:** Each role sees only permitted orders  
**Pass Criteria:** Data matches RLS policy rules  
**Fail Signals:** Sees other company's orders, sees restricted data  
**Evidence to capture:** Order list per role  
**Notes/Variations:** Currently all roles see all orders (verify policy)

---

**TC-ID:** PLAT-RLS-003  
**Title:** Audit logs restricted to admin  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Audit logs exist  
**Test Data:** Non-admin role  
**Steps:**
1. Login as non-admin (warehouse_staff)
2. Try to access `/audit-logs` directly
3. Try to query `audit_logs` table via console

**Expected Result:** Page access denied, query returns empty  
**Pass Criteria:** 403 or redirect, no audit data returned  
**Fail Signals:** Can view audit logs  
**Evidence to capture:** Access denied screenshot, empty query  
**Notes/Variations:** Test all non-admin roles

---

**TC-ID:** PLAT-RLS-004  
**Title:** API keys visible only to creator  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User A created API key  
**Test Data:** User B's session  
**Steps:**
1. User A creates API key
2. Login as User B
3. Query `api_keys` table

**Expected Result:** User B cannot see User A's API keys  
**Pass Criteria:** Only own API keys visible  
**Fail Signals:** Can see other users' keys  
**Evidence to capture:** Query result  
**Notes/Variations:** Admin may have override access

---

**TC-ID:** PLAT-RLS-005  
**Title:** Reservations RLS enforcement  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Reservations exist  
**Test Data:** Multiple user sessions  
**Steps:**
1. Check RLS policy on `reservations` table
2. Verify users can only modify own reservations
3. Verify admins have appropriate override

**Expected Result:** RLS enforced per policy rules  
**Pass Criteria:** Policy behavior matches definition  
**Fail Signals:** Can modify others' reservations  
**Evidence to capture:** Policy SQL, test queries  
**Notes/Variations:** Document current policy scope

---

**TC-ID:** PLAT-RLS-006  
**Title:** Stock take rolls restricted by session  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Multiple stock take sessions exist  
**Test Data:** User who started Session A  
**Steps:**
1. Login as session owner
2. Query `count_rolls` for own session
3. Try to query rolls from other sessions

**Expected Result:** Only see rolls from owned/authorized sessions  
**Pass Criteria:** Data isolation between sessions  
**Fail Signals:** Can see all sessions' rolls  
**Evidence to capture:** Query results  
**Notes/Variations:** Admin may see all

---

#### 6.1.5 Role Resolution

---

**TC-ID:** PLAT-ROLE-001  
**Title:** Role correctly loaded on login  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User has role assigned in `user_roles` table  
**Test Data:** User with `admin` role  
**Steps:**
1. Login as user with admin role
2. Check role resolution in application state
3. Verify admin menu items visible

**Expected Result:** Role correctly identified, permissions applied  
**Pass Criteria:** `hasRole('admin')` returns true  
**Fail Signals:** Wrong role, no role, permission errors  
**Evidence to capture:** Console log of role, UI state  
**Notes/Variations:** Test all role types

---

**TC-ID:** PLAT-ROLE-002  
**Title:** User with no role gets default access  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User exists but no role in `user_roles`  
**Test Data:** User without role assignment  
**Steps:**
1. Login as user without role
2. Check accessible pages
3. Try to access admin pages

**Expected Result:** Default (minimal) access granted  
**Pass Criteria:** Can access basic pages, admin blocked  
**Fail Signals:** Full access or complete denial  
**Evidence to capture:** Accessible vs blocked pages  
**Notes/Variations:** May need profile.role fallback check

---

**TC-ID:** PLAT-ROLE-003  
**Title:** Role change takes effect on next login  
**Area:** Platform  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User currently logged in  
**Test Data:** Admin changes user's role  
**Steps:**
1. User A is logged in as warehouse_staff
2. Admin changes User A's role to admin
3. User A refreshes page
4. User A logs out and logs in again

**Expected Result:** New role effective after re-login  
**Pass Criteria:** Admin menus visible after re-login  
**Fail Signals:** Role change immediate or never takes effect  
**Evidence to capture:** Before/after role state  
**Notes/Variations:** Document expected behavior

---

**TC-ID:** PLAT-ROLE-004  
**Title:** has_role function works in RLS  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** RLS policies using `has_role` function  
**Test Data:** Users with different roles  
**Steps:**
1. Call `has_role(user_id, 'admin')` for admin user
2. Call same function for non-admin user
3. Verify results

**Expected Result:** Returns true only for users with that role  
**Pass Criteria:** Function returns accurate boolean  
**Fail Signals:** Wrong results, SQL errors  
**Evidence to capture:** Function output  
**Notes/Variations:** Test with `SECURITY DEFINER` isolation

---

#### 6.1.6 Token Handling & 401 Scenarios

---

**TC-ID:** PLAT-TOKEN-001  
**Title:** 401 response triggers logout  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Active session  
**Test Data:** Session with invalid token  
**Steps:**
1. Manually invalidate token (or simulate)
2. Attempt any authenticated API call
3. Observe application behavior

**Expected Result:** Graceful logout, redirect to login  
**Pass Criteria:** No infinite loops, clean state  
**Fail Signals:** Stuck state, repeated 401s, data loss  
**Evidence to capture:** Console logs, final state  
**Notes/Variations:** Test `useAuthErrorHandler` hook

---

**TC-ID:** PLAT-TOKEN-002  
**Title:** Expired token triggers refresh  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Valid session, access token expired  
**Test Data:** Token past expiry time  
**Steps:**
1. Wait for access token to expire
2. Attempt API call
3. Observe token refresh

**Expected Result:** New token obtained, call succeeds  
**Pass Criteria:** Seamless experience, no logout  
**Fail Signals:** 401 error shown to user  
**Evidence to capture:** Network tab showing refresh + retry  
**Notes/Variations:** Test refresh failure scenario

---

**TC-ID:** PLAT-TOKEN-003  
**Title:** Multiple 401s don't cause infinite loop  
**Area:** Platform  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Invalid session state  
**Test Data:** Consistently failing auth  
**Steps:**
1. Create state where refresh always fails
2. Trigger authenticated actions
3. Monitor for loops

**Expected Result:** Single logout after max retries  
**Pass Criteria:** Max 3 retries, then clean logout  
**Fail Signals:** Infinite refresh loop, frozen UI  
**Evidence to capture:** Network tab, console logs  
**Notes/Variations:** Check `isHandlingAuthError` flag

---

---

### 6.2 WMS Core Features

#### 6.2.1 Inventory Management

---

**TC-ID:** WMS-INV-001  
**Title:** View inventory list with data  
**Area:** WMS - Inventory  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Inventory data exists  
**Test Data:** 50+ lots across multiple qualities  
**Steps:**
1. Navigate to `/inventory`
2. Wait for data load
3. Verify table displays

**Expected Result:** Inventory table loads with correct data  
**Pass Criteria:** Row count matches database, columns correct  
**Fail Signals:** Empty table, loading forever, error  
**Evidence to capture:** Screenshot of table, row count  
**Notes/Variations:** Test with 1000+ rows for performance

---

**TC-ID:** WMS-INV-002  
**Title:** Filter inventory by quality  
**Area:** WMS - Inventory  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Multiple qualities exist  
**Test Data:** Quality code to filter by  
**Steps:**
1. Navigate to `/inventory`
2. Open quality filter
3. Select specific quality
4. Apply filter

**Expected Result:** Only selected quality items shown  
**Pass Criteria:** All visible rows match filter  
**Fail Signals:** Wrong items shown, filter ignored  
**Evidence to capture:** Filtered result screenshot  
**Notes/Variations:** Test multiple filter combination

---

**TC-ID:** WMS-INV-003  
**Title:** Export inventory to Excel  
**Area:** WMS - Inventory  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Inventory data exists  
**Test Data:** Current view data  
**Steps:**
1. Navigate to `/inventory`
2. Apply some filters
3. Click "Export" button
4. Select Excel format

**Expected Result:** Excel file downloaded with filtered data  
**Pass Criteria:** File opens, data matches screen  
**Fail Signals:** Download fails, wrong data, corrupt file  
**Evidence to capture:** Downloaded file sample  
**Notes/Variations:** Test with large dataset (5000+ rows)

---

**TC-ID:** WMS-INV-004  
**Title:** Pivot table aggregation correct  
**Area:** WMS - Inventory  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Inventory data exists  
**Test Data:** Multiple lots per quality/color  
**Steps:**
1. Navigate to inventory pivot view
2. Check aggregated totals
3. Expand a quality row
4. Verify breakdown matches

**Expected Result:** Totals match sum of detail rows  
**Pass Criteria:** Math is correct, no missing data  
**Fail Signals:** Totals don't match, data missing  
**Evidence to capture:** Screenshot with calculations  
**Notes/Variations:** Compare with raw SQL query

---

**TC-ID:** WMS-INV-005  
**Title:** Reserved vs Available calculation  
**Area:** WMS - Inventory  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Lots with active reservations  
**Test Data:** Lot with 100m total, 30m reserved  
**Steps:**
1. Find lot with reservations
2. Check total, reserved, available columns
3. Verify: Available = Total - Reserved

**Expected Result:** Math is correct for all lots  
**Pass Criteria:** Available = Total - Reserved exactly  
**Fail Signals:** Wrong calculation, negative available  
**Evidence to capture:** Screenshot with numbers  
**Notes/Variations:** Test with multiple reservations on same lot

---

**TC-ID:** WMS-INV-006  
**Title:** Lot details page loads correctly  
**Area:** WMS - Inventory  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Lot exists  
**Test Data:** Valid lot ID  
**Steps:**
1. Navigate to `/lot-details/{id}`
2. Verify all sections load
3. Check reservation history
4. Check transaction history

**Expected Result:** All lot data displayed correctly  
**Pass Criteria:** All tabs load, data is accurate  
**Fail Signals:** 404, missing data, wrong lot  
**Evidence to capture:** Screenshot of details page  
**Notes/Variations:** Test with lot having many transactions

---

#### 6.2.2 Orders

---

**TC-ID:** WMS-ORD-001  
**Title:** Create order manually  
**Area:** WMS - Orders  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User has create order permission  
**Test Data:** Customer info, line items  
**Steps:**
1. Navigate to `/orders`
2. Click "New Order"
3. Fill customer information
4. Add order lines (quality, color, quantity)
5. Submit order

**Expected Result:** Order created with unique number  
**Pass Criteria:** Order appears in list, audit logged  
**Fail Signals:** Error on submit, no order created  
**Evidence to capture:** New order in list, audit log entry  
**Notes/Variations:** Test with from-reservation flow

---

**TC-ID:** WMS-ORD-002  
**Title:** Order status transitions  
**Area:** WMS - Orders  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Order exists in draft status  
**Test Data:** Order ID  
**Steps:**
1. Open order in draft status
2. Confirm order
3. Verify status changed
4. Continue through fulfillment
5. Complete order

**Expected Result:** Each status transition succeeds  
**Pass Criteria:** All transitions work, audit trail created  
**Fail Signals:** Stuck in status, invalid transition allowed  
**Evidence to capture:** Status history  
**Notes/Variations:** Test invalid transitions (should fail)

---

**TC-ID:** WMS-ORD-003  
**Title:** Order fulfillment updates inventory  
**Area:** WMS - Orders  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Order with specific lots, sufficient stock  
**Test Data:** Order for 50m of lot X (has 100m)  
**Steps:**
1. Note current stock level
2. Fulfill order
3. Check lot stock level

**Expected Result:** Stock reduced by fulfilled amount  
**Pass Criteria:** New stock = Old stock - Order qty  
**Fail Signals:** Stock unchanged, wrong reduction  
**Evidence to capture:** Before/after stock levels  
**Notes/Variations:** Test partial fulfillment

---

**TC-ID:** WMS-ORD-004  
**Title:** Order cancellation releases reserved stock  
**Area:** WMS - Orders  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Order with reserved stock  
**Test Data:** Order with associated reservation  
**Steps:**
1. Note reserved quantity on lots
2. Cancel order
3. Check reserved quantity

**Expected Result:** Reserved quantity returned to available  
**Pass Criteria:** Reserved reduced, available increased  
**Fail Signals:** Stock still reserved, orphaned reservation  
**Evidence to capture:** Before/after reservation state  
**Notes/Variations:** Test order without reservation

---

**TC-ID:** WMS-ORD-005  
**Title:** AI order extraction from document  
**Area:** WMS - Orders  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** AI extraction configured  
**Test Data:** Order document (PDF/image)  
**Steps:**
1. Navigate to order creation
2. Click "AI Extract"
3. Upload order document
4. Review extracted data
5. Confirm and create

**Expected Result:** AI extracts order details correctly  
**Pass Criteria:** Key fields extracted, minor corrections only  
**Fail Signals:** Extraction fails, completely wrong data  
**Evidence to capture:** Upload, extracted data, final order  
**Notes/Variations:** Test with various document formats

---

**TC-ID:** WMS-ORD-006  
**Title:** Bulk order upload via Excel  
**Area:** WMS - Orders  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Excel template available  
**Test Data:** Excel file with 10 orders  
**Steps:**
1. Download template
2. Fill with order data
3. Upload file
4. Review preview
5. Confirm import

**Expected Result:** All orders created correctly  
**Pass Criteria:** 10 orders created, data matches file  
**Fail Signals:** Import fails, partial import, wrong data  
**Evidence to capture:** Import summary, created orders  
**Notes/Variations:** Test with validation errors in file

---

**TC-ID:** WMS-ORD-007  
**Title:** Order search and filter  
**Area:** WMS - Orders  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Multiple orders exist  
**Test Data:** Various order numbers, customers, statuses  
**Steps:**
1. Navigate to `/orders`
2. Search by order number
3. Filter by status
4. Filter by date range
5. Combine filters

**Expected Result:** Correct orders shown for each filter  
**Pass Criteria:** Results match filter criteria  
**Fail Signals:** Wrong results, filters ignored  
**Evidence to capture:** Filter results  
**Notes/Variations:** Test edge cases (no results)

---

**TC-ID:** WMS-ORD-008  
**Title:** Order audit trail complete  
**Area:** WMS - Orders  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Order with multiple actions performed  
**Test Data:** Order ID  
**Steps:**
1. Create order
2. Update order
3. Change status
4. Check audit logs for order

**Expected Result:** All actions logged with old/new values  
**Pass Criteria:** Every mutation has audit entry  
**Fail Signals:** Missing entries, incomplete data  
**Evidence to capture:** Audit log entries for order  
**Notes/Variations:** Test delete logging

---

#### 6.2.3 Reservations

---

**TC-ID:** WMS-RES-001  
**Title:** Create reservation with lot selection  
**Area:** WMS - Reservations  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Available lots exist  
**Test Data:** Customer info, quality, quantity  
**Steps:**
1. Navigate to `/reservations`
2. Click "New Reservation"
3. Select quality and color
4. Enter quantity
5. Select specific lots
6. Set expiry date
7. Submit

**Expected Result:** Reservation created, lots marked reserved  
**Pass Criteria:** Lots show reserved quantity, expiry set  
**Fail Signals:** Lots not reserved, reservation fails  
**Evidence to capture:** Reservation details, lot reserved status  
**Notes/Variations:** Test quantity exceeds available

---

**TC-ID:** WMS-RES-002  
**Title:** Reservation expiry auto-release  
**Area:** WMS - Reservations  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Reservation near expiry  
**Test Data:** Reservation expiring soon  
**Steps:**
1. Create reservation with short expiry (or find existing)
2. Wait past expiry time
3. Trigger CRON job (or wait for it)
4. Check reservation status
5. Check lot reserved quantities

**Expected Result:** Reservation expired, lots released  
**Pass Criteria:** Status = expired, reserved qty = 0  
**Fail Signals:** Still active, lots still reserved  
**Evidence to capture:** Before/after status, lot states  
**Notes/Variations:** Test reminder email sent before expiry

---

**TC-ID:** WMS-RES-003  
**Title:** Convert reservation to order  
**Area:** WMS - Reservations  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Active reservation exists  
**Test Data:** Reservation ID  
**Steps:**
1. Open reservation details
2. Click "Convert to Order"
3. Review order details
4. Confirm conversion
5. Check reservation status

**Expected Result:** Order created, reservation closed  
**Pass Criteria:** Order exists with reservation data, reservation converted  
**Fail Signals:** Duplicate order, reservation still active  
**Evidence to capture:** New order, reservation status  
**Notes/Variations:** Test partial conversion

---

**TC-ID:** WMS-RES-004  
**Title:** Release reservation manually  
**Area:** WMS - Reservations  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Active reservation exists  
**Test Data:** Reservation ID  
**Steps:**
1. Open reservation details
2. Click "Release"
3. Confirm release
4. Check lot states

**Expected Result:** Reservation released, lots available  
**Pass Criteria:** Status = released, lots available  
**Fail Signals:** Lots still reserved  
**Evidence to capture:** Before/after lot states  
**Notes/Variations:** Test partial release

---

**TC-ID:** WMS-RES-005  
**Title:** Reservation quantity change  
**Area:** WMS - Reservations  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Active reservation  
**Test Data:** Reservation with 100m, change to 50m  
**Steps:**
1. Open reservation
2. Edit quantity to 50m
3. Save changes
4. Check lot reserved quantities

**Expected Result:** Reserved quantity adjusted correctly  
**Pass Criteria:** Only 50m now reserved on lots  
**Fail Signals:** Old quantity still reserved, data mismatch  
**Evidence to capture:** Before/after reserved amounts  
**Notes/Variations:** Test increase (may need lot reselection)

---

#### 6.2.4 Inquiries

---

**TC-ID:** WMS-INQ-001  
**Title:** Create inquiry  
**Area:** WMS - Inquiries  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User has permission  
**Test Data:** Customer info, item requirements  
**Steps:**
1. Navigate to `/inquiries`
2. Click "New Inquiry"
3. Enter customer information
4. Add item requirements
5. Submit

**Expected Result:** Inquiry created with ID  
**Pass Criteria:** Inquiry in list, correct status  
**Fail Signals:** Creation fails  
**Evidence to capture:** New inquiry in list  
**Notes/Variations:** Test from external form (gated)

---

**TC-ID:** WMS-INQ-002  
**Title:** Convert inquiry to reservation  
**Area:** WMS - Inquiries  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Open inquiry exists  
**Test Data:** Inquiry ID  
**Steps:**
1. Open inquiry details
2. Click "Convert to Reservation"
3. Select lots
4. Confirm

**Expected Result:** Reservation created, inquiry updated  
**Pass Criteria:** Reservation exists, inquiry status changed  
**Fail Signals:** Duplicate data, inquiry unchanged  
**Evidence to capture:** New reservation, inquiry status  
**Notes/Variations:** Test convert to order directly

---

**TC-ID:** WMS-INQ-003  
**Title:** Inquiry gating blocks stock access  
**Area:** WMS - Inquiries  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Inquiry gating enabled  
**Test Data:** Anonymous/new user session  
**Steps:**
1. Try to access stock levels without inquiry
2. Observe gate overlay
3. Submit inquiry via gate
4. Verify stock access granted

**Expected Result:** Stock hidden until inquiry submitted  
**Pass Criteria:** Gate appears, submission grants access  
**Fail Signals:** Stock visible without inquiry  
**Evidence to capture:** Gate overlay, post-submission access  
**Notes/Variations:** Test with existing customer (may bypass)

---

#### 6.2.5 Manufacturing Orders

---

**TC-ID:** WMS-MO-001  
**Title:** Create manufacturing order  
**Area:** WMS - Manufacturing Orders  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User has permission  
**Test Data:** Quality, quantity, dates  
**Steps:**
1. Navigate to `/manufacturing-orders`
2. Click "New MO"
3. Enter production details
4. Set timeline
5. Submit

**Expected Result:** MO created with unique number  
**Pass Criteria:** MO in list, correct status  
**Fail Signals:** Creation fails  
**Evidence to capture:** New MO in list  
**Notes/Variations:** Test with linked reservation

---

**TC-ID:** WMS-MO-002  
**Title:** MO status progression  
**Area:** WMS - Manufacturing Orders  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** MO exists  
**Test Data:** MO in initial status  
**Steps:**
1. Move MO through each status
2. Check status history
3. Verify audit logging

**Expected Result:** All transitions logged correctly  
**Pass Criteria:** Status history complete, audit entries exist  
**Fail Signals:** Missing history, invalid transitions allowed  
**Evidence to capture:** Status history dialog  
**Notes/Variations:** Test invalid transitions

---

**TC-ID:** WMS-MO-003  
**Title:** MO reminders sent  
**Area:** WMS - Manufacturing Orders  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** MO with upcoming deadline  
**Test Data:** MO with deadline in reminder window  
**Steps:**
1. Create/find MO with deadline approaching
2. Wait for reminder CRON
3. Check email logs

**Expected Result:** Reminder email sent  
**Pass Criteria:** Email in logs, correct recipient  
**Fail Signals:** No email sent  
**Evidence to capture:** Email log entry  
**Notes/Variations:** Test configurable reminder times

---

#### 6.2.6 Stock Take

---

**TC-ID:** WMS-ST-001  
**Title:** Start stock take session  
**Area:** WMS - Stock Take  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User has permission  
**Test Data:** N/A  
**Steps:**
1. Navigate to `/stock-take/capture`
2. Click "Start New Session"
3. Verify session created

**Expected Result:** Session created with unique number  
**Pass Criteria:** Session active, can capture rolls  
**Fail Signals:** Cannot start session  
**Evidence to capture:** Session details  
**Notes/Variations:** Test with existing active session

---

**TC-ID:** WMS-ST-002  
**Title:** Capture roll with camera  
**Area:** WMS - Stock Take  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Active session, camera access  
**Test Data:** Roll label to photograph  
**Steps:**
1. In active session, click "Capture"
2. Take photo of roll label
3. Wait for OCR processing
4. Verify extracted data

**Expected Result:** Photo captured, OCR extracts data  
**Pass Criteria:** Quality, color, meters extracted  
**Fail Signals:** Camera fails, OCR returns nothing  
**Evidence to capture:** Captured photo, OCR results  
**Notes/Variations:** Test with poor lighting

---

**TC-ID:** WMS-ST-003  
**Title:** Manual roll entry  
**Area:** WMS - Stock Take  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Active session  
**Test Data:** Roll details  
**Steps:**
1. In active session, click "Manual Entry"
2. Enter roll details
3. Submit entry

**Expected Result:** Roll recorded without photo  
**Pass Criteria:** Roll appears in session list  
**Fail Signals:** Cannot submit, data lost  
**Evidence to capture:** Roll in session  
**Notes/Variations:** Test editing manual entry

---

**TC-ID:** WMS-ST-004  
**Title:** Review and approve rolls  
**Area:** WMS - Stock Take  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Session with captured rolls  
**Test Data:** Session ID with rolls  
**Steps:**
1. Navigate to `/stock-take/review`
2. Select session
3. Review each roll
4. Approve or reject

**Expected Result:** Roll status updated correctly  
**Pass Criteria:** Approved/rejected status saved  
**Fail Signals:** Status not saved  
**Evidence to capture:** Roll statuses  
**Notes/Variations:** Test request recount

---

**TC-ID:** WMS-ST-005  
**Title:** Duplicate roll detection  
**Area:** WMS - Stock Take  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Roll already captured in session  
**Test Data:** Same roll label  
**Steps:**
1. Capture roll with specific lot/details
2. Capture same roll again
3. Observe duplicate warning

**Expected Result:** Warning shown about potential duplicate  
**Pass Criteria:** Duplicate flag set, warning displayed  
**Fail Signals:** No warning, duplicate created  
**Evidence to capture:** Duplicate warning  
**Notes/Variations:** Test photo hash matching

---

**TC-ID:** WMS-ST-006  
**Title:** Complete session and reconcile  
**Area:** WMS - Stock Take  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Session with all rolls reviewed  
**Test Data:** Completed session  
**Steps:**
1. Complete all roll reviews
2. Mark session complete
3. View discrepancy report
4. Apply reconciliation

**Expected Result:** Inventory updated per reconciliation  
**Pass Criteria:** Differences applied to inventory  
**Fail Signals:** Inventory unchanged, errors  
**Evidence to capture:** Discrepancy report, inventory changes  
**Notes/Variations:** Test cancel session

---

#### 6.2.7 Catalog Management

---

**TC-ID:** WMS-CAT-001  
**Title:** View catalog items  
**Area:** WMS - Catalog  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Catalog items exist  
**Test Data:** 50+ catalog items  
**Steps:**
1. Navigate to `/catalog`
2. Verify items load
3. Test search
4. Test filters

**Expected Result:** All catalog items displayed correctly  
**Pass Criteria:** Items load, search works, filters work  
**Fail Signals:** Empty list, search fails  
**Evidence to capture:** Catalog list  
**Notes/Variations:** Test with many items (performance)

---

**TC-ID:** WMS-CAT-002  
**Title:** Create catalog item  
**Area:** WMS - Catalog  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User has permission  
**Test Data:** Item details  
**Steps:**
1. Click "New Item"
2. Fill all required fields
3. Add composition
4. Upload spec sheet
5. Submit

**Expected Result:** Item created (pending approval if enabled)  
**Pass Criteria:** Item in list, correct status  
**Fail Signals:** Creation fails  
**Evidence to capture:** New item details  
**Notes/Variations:** Test approval workflow

---

**TC-ID:** WMS-CAT-003  
**Title:** Catalog item approval workflow  
**Area:** WMS - Catalog  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Approval workflow enabled  
**Test Data:** Pending item  
**Steps:**
1. Non-admin creates item
2. Verify item pending
3. Admin approves item
4. Verify item active

**Expected Result:** Approval workflow functions correctly  
**Pass Criteria:** Status transitions properly  
**Fail Signals:** Item auto-approved, approval fails  
**Evidence to capture:** Status changes  
**Notes/Variations:** Test rejection flow

---

**TC-ID:** WMS-CAT-004  
**Title:** Catalog custom fields  
**Area:** WMS - Catalog  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Custom fields defined  
**Test Data:** Field definitions  
**Steps:**
1. Admin defines custom field
2. Edit catalog item
3. Fill custom field value
4. Save and verify

**Expected Result:** Custom field value saved  
**Pass Criteria:** Value persists, shows in details  
**Fail Signals:** Value not saved  
**Evidence to capture:** Custom field in item details  
**Notes/Variations:** Test different field types

---

#### 6.2.8 Forecasting

---

**TC-ID:** WMS-FC-001  
**Title:** Run forecast engine  
**Area:** WMS - Forecasting  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Demand history exists  
**Test Data:** 6+ months of demand data  
**Steps:**
1. Navigate to `/forecast`
2. Click "Run Forecast"
3. Wait for completion
4. Review results

**Expected Result:** Forecast results generated  
**Pass Criteria:** Results for each quality/color, scenarios shown  
**Fail Signals:** No results, error  
**Evidence to capture:** Forecast results page  
**Notes/Variations:** Test with no history

---

**TC-ID:** WMS-FC-002  
**Title:** Forecast alerts generated  
**Area:** WMS - Forecasting  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Forecast run complete  
**Test Data:** Items projected to stock out  
**Steps:**
1. Run forecast
2. Check for low stock alerts
3. Check for overstock alerts

**Expected Result:** Alerts generated where thresholds crossed  
**Pass Criteria:** Alerts match conditions  
**Fail Signals:** No alerts when expected  
**Evidence to capture:** Alert list  
**Notes/Variations:** Test alert resolution

---

**TC-ID:** WMS-FC-003  
**Title:** Historical data import  
**Area:** WMS - Forecasting  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Import template available  
**Test Data:** Historical demand Excel file  
**Steps:**
1. Navigate to forecast settings
2. Click import history
3. Upload file
4. Review and confirm

**Expected Result:** History imported correctly  
**Pass Criteria:** Data appears in demand_history  
**Fail Signals:** Import fails, wrong data  
**Evidence to capture:** Import summary  
**Notes/Variations:** Test duplicate handling

---

#### 6.2.9 Reports & Analytics

---

**TC-ID:** WMS-RPT-001  
**Title:** Create custom report  
**Area:** WMS - Reports  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User has report builder access  
**Test Data:** Report configuration  
**Steps:**
1. Navigate to `/reports/builder`
2. Select data source
3. Choose columns
4. Add filters
5. Preview report
6. Save

**Expected Result:** Report created and saved  
**Pass Criteria:** Report in list, preview shows data  
**Fail Signals:** Cannot save, wrong data  
**Evidence to capture:** Saved report  
**Notes/Variations:** Test complex joins

---

**TC-ID:** WMS-RPT-002  
**Title:** Run and export report  
**Area:** WMS - Reports  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Saved report exists  
**Test Data:** Report ID  
**Steps:**
1. Open saved report
2. Click "Run"
3. View results
4. Export to Excel
5. Export to PDF

**Expected Result:** Report executes, exports succeed  
**Pass Criteria:** Both files download correctly  
**Fail Signals:** Run fails, export corrupt  
**Evidence to capture:** Downloaded files  
**Notes/Variations:** Test large report (10000+ rows)

---

**TC-ID:** WMS-RPT-003  
**Title:** Schedule report for email delivery  
**Area:** WMS - Reports  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Report exists  
**Test Data:** Report, schedule config  
**Steps:**
1. Open report
2. Click "Schedule"
3. Set schedule (daily/weekly)
4. Add recipients
5. Save schedule

**Expected Result:** Schedule created  
**Pass Criteria:** Schedule in list, CRON will trigger  
**Fail Signals:** Cannot save schedule  
**Evidence to capture:** Schedule configuration  
**Notes/Variations:** Test scheduled execution

---

**TC-ID:** WMS-RPT-004  
**Title:** Dashboard widgets load  
**Area:** WMS - Reports  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** User logged in  
**Test Data:** N/A  
**Steps:**
1. Navigate to `/dashboard`
2. Wait for all widgets to load
3. Check activity feed
4. Check trend charts
5. Check insights

**Expected Result:** All widgets render with data  
**Pass Criteria:** No empty/error widgets  
**Fail Signals:** Widget errors, missing data  
**Evidence to capture:** Dashboard screenshot  
**Notes/Variations:** Test with empty data

---

---

### 6.3 Audit Logs

---

**TC-ID:** AUDIT-001  
**Title:** Create action generates audit log  
**Area:** Audit  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User can create entities  
**Test Data:** Any creatable entity  
**Steps:**
1. Create a new order
2. Navigate to audit logs
3. Search for the order
4. Verify audit entry exists

**Expected Result:** Audit entry shows CREATE action  
**Pass Criteria:** Entry exists with user, timestamp, new_data  
**Fail Signals:** No entry, wrong action type  
**Evidence to capture:** Audit log entry  
**Notes/Variations:** Test all entity types

---

**TC-ID:** AUDIT-002  
**Title:** Update action logs old and new values  
**Area:** Audit  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Entity exists  
**Test Data:** Entity with known current values  
**Steps:**
1. Update an order's status
2. Check audit log
3. Verify old_data and new_data

**Expected Result:** Both old and new values captured  
**Pass Criteria:** Changed fields show before/after  
**Fail Signals:** Missing old_data, incomplete  
**Evidence to capture:** Audit entry with diff  
**Notes/Variations:** Test bulk updates

---

**TC-ID:** AUDIT-003  
**Title:** Delete action logged  
**Area:** Audit  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Deletable entity exists  
**Test Data:** Entity to delete  
**Steps:**
1. Delete an entity
2. Check audit log
3. Verify DELETE entry

**Expected Result:** Delete action logged with old_data  
**Pass Criteria:** Entry shows what was deleted  
**Fail Signals:** No delete entry  
**Evidence to capture:** Delete audit entry  
**Notes/Variations:** Test soft vs hard delete

---

**TC-ID:** AUDIT-004  
**Title:** Audit log filtering works  
**Area:** Audit  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Audit logs exist  
**Test Data:** Various actions, users, dates  
**Steps:**
1. Navigate to `/audit-logs`
2. Filter by action type
3. Filter by user
4. Filter by date range
5. Filter by entity type

**Expected Result:** Filters return correct results  
**Pass Criteria:** Each filter works correctly  
**Fail Signals:** Wrong results, filters ignored  
**Evidence to capture:** Filtered results  
**Notes/Variations:** Test combined filters

---

**TC-ID:** AUDIT-005  
**Title:** Audit log export  
**Area:** Audit  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Audit logs exist  
**Test Data:** Current view data  
**Steps:**
1. Apply filters
2. Click "Export"
3. Download file
4. Verify contents

**Expected Result:** Export contains filtered data  
**Pass Criteria:** File matches screen data  
**Fail Signals:** Export fails, wrong data  
**Evidence to capture:** Exported file  
**Notes/Variations:** Test large export

---

**TC-ID:** AUDIT-006  
**Title:** Reverse audit action  
**Area:** Audit  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Reversible action logged  
**Test Data:** Recent update action  
**Steps:**
1. Find an update action
2. Click "Reverse"
3. Confirm reversal
4. Verify entity reverted

**Expected Result:** Entity restored to previous state  
**Pass Criteria:** Values match old_data  
**Fail Signals:** Reversal fails, wrong state  
**Evidence to capture:** Before/after entity state  
**Notes/Variations:** Test non-reversible actions

---

**TC-ID:** AUDIT-007  
**Title:** Audit retention cleanup  
**Area:** Audit  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Old audit logs exist, retention configured  
**Test Data:** Logs older than retention period  
**Steps:**
1. Configure retention (e.g., 90 days)
2. Trigger cleanup CRON
3. Check for old logs

**Expected Result:** Logs beyond retention deleted  
**Pass Criteria:** Only recent logs remain  
**Fail Signals:** Old logs still exist  
**Evidence to capture:** Log counts before/after  
**Notes/Variations:** Test retention settings

---

**TC-ID:** AUDIT-008  
**Title:** Audit log RLS enforcement  
**Area:** Audit  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Non-admin user exists  
**Test Data:** Non-admin session  
**Steps:**
1. Login as non-admin
2. Try to access audit logs
3. Try direct table query

**Expected Result:** Access denied  
**Pass Criteria:** 403 or empty results  
**Fail Signals:** Can view audit logs  
**Evidence to capture:** Access denied screen  
**Notes/Variations:** Admin should have access

---

---

### 6.4 Edge Functions

#### 6.4.1 Admin Functions

---

**TC-ID:** EDGE-ADMIN-001  
**Title:** send-invitation sends email  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Email service configured  
**Test Data:** Valid email address  
**Steps:**
1. Admin invites new user
2. Check edge function logs
3. Check email_log table
4. Verify email received

**Expected Result:** Invitation email sent  
**Pass Criteria:** Email in inbox, log entry exists  
**Fail Signals:** No email, function error  
**Evidence to capture:** Function logs, email screenshot  
**Notes/Variations:** Test invalid email

---

**TC-ID:** EDGE-ADMIN-002  
**Title:** admin-change-password changes password  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Admin logged in, target user exists  
**Test Data:** User ID, new password  
**Steps:**
1. Admin changes user's password
2. User logs out
3. User tries old password
4. User tries new password

**Expected Result:** New password works, old doesn't  
**Pass Criteria:** Password changed successfully  
**Fail Signals:** Old password works, function fails  
**Evidence to capture:** Function logs  
**Notes/Variations:** Test password policy enforcement

---

**TC-ID:** EDGE-ADMIN-003  
**Title:** admin-deactivate-user blocks login  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Active user exists  
**Test Data:** User ID  
**Steps:**
1. Admin deactivates user
2. User tries to login
3. Observe result

**Expected Result:** User cannot login  
**Pass Criteria:** Login blocked with message  
**Fail Signals:** User can still login  
**Evidence to capture:** Login attempt result  
**Notes/Variations:** Test reactivation

---

**TC-ID:** EDGE-ADMIN-004  
**Title:** admin-delete-user removes user  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** User to delete exists  
**Test Data:** User ID  
**Steps:**
1. Admin deletes user
2. Check auth.users
3. Check profiles table

**Expected Result:** User removed from system  
**Pass Criteria:** No longer in auth.users  
**Fail Signals:** User still exists  
**Evidence to capture:** Database state  
**Notes/Variations:** Test cascade to related data

---

**TC-ID:** EDGE-ADMIN-005  
**Title:** export-database generates backup  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Admin logged in  
**Test Data:** N/A  
**Steps:**
1. Admin triggers database export
2. Wait for completion
3. Download export file

**Expected Result:** Export file generated  
**Pass Criteria:** File downloads, contains data  
**Fail Signals:** Export fails, corrupt file  
**Evidence to capture:** Export log, file sample  
**Notes/Variations:** Test with large database

---

#### 6.4.2 API Functions

---

**TC-ID:** EDGE-API-001  
**Title:** api-get-inventory returns data  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** API key configured, inventory exists  
**Test Data:** Valid API key  
**Steps:**
1. Call GET /api-get-inventory with API key
2. Verify response structure
3. Verify data accuracy

**Expected Result:** Inventory data returned  
**Pass Criteria:** 200 OK, correct JSON structure  
**Fail Signals:** 401, 500, wrong data  
**Evidence to capture:** Request/response  
**Notes/Variations:** Test all parameters

---

**TC-ID:** EDGE-API-002  
**Title:** api-get-inventory masked mode  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** API key with masked permission  
**Test Data:** Query with masked=true  
**Steps:**
1. Call with ?masked=true
2. Check response

**Expected Result:** Stock status instead of quantities  
**Pass Criteria:** Returns "available", "low_stock", "out_of_stock"  
**Fail Signals:** Returns actual numbers  
**Evidence to capture:** Response body  
**Notes/Variations:** Test without masked param

---

**TC-ID:** EDGE-API-003  
**Title:** api-get-inventory invalid API key  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Invalid API key  
**Test Data:** Wrong API key  
**Steps:**
1. Call with invalid API key
2. Observe response

**Expected Result:** 401 Unauthorized  
**Pass Criteria:** No data returned  
**Fail Signals:** Data returned anyway  
**Evidence to capture:** Response status and body  
**Notes/Variations:** Test expired key

---

**TC-ID:** EDGE-API-004  
**Title:** api-get-catalog returns catalog  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** API key configured, catalog exists  
**Test Data:** Valid API key  
**Steps:**
1. Call GET /api-get-catalog
2. Verify response

**Expected Result:** Catalog items returned  
**Pass Criteria:** 200 OK, items in response  
**Fail Signals:** Error or empty  
**Evidence to capture:** Request/response  
**Notes/Variations:** Test filters

---

**TC-ID:** EDGE-API-005  
**Title:** api-create-order creates order  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** API key with create permission  
**Test Data:** Valid order payload  
**Steps:**
1. POST /api-create-order with order data
2. Verify response includes order ID
3. Verify order in database

**Expected Result:** Order created  
**Pass Criteria:** 201 Created, order exists  
**Fail Signals:** Error, no order created  
**Evidence to capture:** Request/response, database check  
**Notes/Variations:** Test validation errors

---

**TC-ID:** EDGE-API-006  
**Title:** API rate limiting enforced  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** Rate limit configured  
**Test Data:** API key with rate limit  
**Steps:**
1. Make requests rapidly exceeding limit
2. Observe response after limit exceeded

**Expected Result:** 429 Too Many Requests  
**Pass Criteria:** Rate limit enforced  
**Fail Signals:** All requests succeed  
**Evidence to capture:** Rate limit response  
**Notes/Variations:** Test different limits

---

#### 6.4.3 Email Functions

---

**TC-ID:** EDGE-EMAIL-001  
**Title:** send-test-email delivers email  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Email service configured  
**Test Data:** Email address, template  
**Steps:**
1. Select template
2. Enter test email
3. Click send
4. Check inbox

**Expected Result:** Test email received  
**Pass Criteria:** Email matches template  
**Fail Signals:** No email, wrong content  
**Evidence to capture:** Email screenshot  
**Notes/Variations:** Test each template

---

**TC-ID:** EDGE-EMAIL-002  
**Title:** process-email-retries retries failed emails  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Failed email in queue  
**Test Data:** Email with status=failed  
**Steps:**
1. Create failed email entry
2. Trigger retry CRON
3. Check email status
4. Check delivery

**Expected Result:** Email retried and delivered  
**Pass Criteria:** Status changes, email sent  
**Fail Signals:** No retry, stuck in failed  
**Evidence to capture:** Email log before/after  
**Notes/Variations:** Test max retries

---

**TC-ID:** EDGE-EMAIL-003  
**Title:** send-scheduled-report generates and sends  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Report scheduled  
**Test Data:** Schedule due now  
**Steps:**
1. Create/find due schedule
2. Trigger CRON
3. Check report generation
4. Check email delivery

**Expected Result:** Report generated and emailed  
**Pass Criteria:** Report attached to email  
**Fail Signals:** No email, no attachment  
**Evidence to capture:** Email with attachment  
**Notes/Variations:** Test multiple formats

---

**TC-ID:** EDGE-EMAIL-004  
**Title:** send-reservation-reminders sends alerts  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Reservations expiring soon  
**Test Data:** Reservation expiring in reminder window  
**Steps:**
1. Trigger CRON
2. Check for reminder emails
3. Verify recipients

**Expected Result:** Reminders sent to correct users  
**Pass Criteria:** Emails in log, correct content  
**Fail Signals:** No reminders sent  
**Evidence to capture:** Email log entries  
**Notes/Variations:** Test already-reminded (no duplicate)

---

#### 6.4.4 OCR Functions

---

**TC-ID:** EDGE-OCR-001  
**Title:** stock-take-ocr extracts text  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Image uploaded  
**Test Data:** Roll label image  
**Steps:**
1. Upload roll label image
2. Call OCR function
3. Check extracted data

**Expected Result:** Quality, color, meters extracted  
**Pass Criteria:** Correct values extracted  
**Fail Signals:** No extraction, wrong values  
**Evidence to capture:** OCR result  
**Notes/Variations:** Test various label formats

---

**TC-ID:** EDGE-OCR-002  
**Title:** process-ocr-queue processes pending  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Items in OCR queue  
**Test Data:** Pending OCR items  
**Steps:**
1. Create pending OCR item
2. Trigger CRON
3. Check item processed

**Expected Result:** Queue items processed  
**Pass Criteria:** Status updated, results available  
**Fail Signals:** Items remain pending  
**Evidence to capture:** Queue before/after  
**Notes/Variations:** Test queue throttling

---

#### 6.4.5 Forecast Functions

---

**TC-ID:** EDGE-FC-001  
**Title:** forecast-engine generates forecasts  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Demand history exists  
**Test Data:** 6+ months history  
**Steps:**
1. Call forecast-engine
2. Check forecast_runs table
3. Check forecast_results table

**Expected Result:** Forecast results generated  
**Pass Criteria:** Results for all quality/colors  
**Fail Signals:** Empty results, error  
**Evidence to capture:** Function logs, results  
**Notes/Variations:** Test scheduled run

---

**TC-ID:** EDGE-FC-002  
**Title:** calculate-forecast-accuracy computes metrics  
**Area:** Edge Functions  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Forecast and actuals exist  
**Test Data:** Past forecast period with actual data  
**Steps:**
1. Call accuracy calculation
2. Check metrics generated

**Expected Result:** Accuracy metrics computed  
**Pass Criteria:** MAPE, MAE, etc. calculated  
**Fail Signals:** No metrics  
**Evidence to capture:** Accuracy results  
**Notes/Variations:** Test with no actuals

---

#### 6.4.6 Webhook Functions

---

**TC-ID:** EDGE-WH-001  
**Title:** webhook-dispatcher sends webhooks  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Webhook subscription exists  
**Test Data:** Subscription URL, triggering event  
**Steps:**
1. Perform action that triggers webhook
2. Check webhook_logs
3. Verify payload received by endpoint

**Expected Result:** Webhook sent with correct payload  
**Pass Criteria:** 200 response, payload matches  
**Fail Signals:** No webhook sent, wrong payload  
**Evidence to capture:** Webhook log, received payload  
**Notes/Variations:** Test HMAC signature

---

**TC-ID:** EDGE-WH-002  
**Title:** process-webhook-retries retries failed  
**Area:** Edge Functions  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Failed webhook in queue  
**Test Data:** Webhook with status=failed  
**Steps:**
1. Create failed webhook
2. Trigger retry CRON
3. Check status

**Expected Result:** Webhook retried  
**Pass Criteria:** Retry attempted, status updated  
**Fail Signals:** No retry  
**Evidence to capture:** Log before/after  
**Notes/Variations:** Test max retries (dead letter)

---

#### 6.4.7 Utility Functions

---

**TC-ID:** EDGE-UTIL-001  
**Title:** health-check returns 200  
**Area:** Edge Functions  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** System running  
**Test Data:** N/A  
**Steps:**
1. Call GET /health-check
2. Verify response

**Expected Result:** 200 OK with status info  
**Pass Criteria:** Health data returned  
**Fail Signals:** Error response  
**Evidence to capture:** Response body  
**Notes/Variations:** Test when DB unavailable

---

**TC-ID:** EDGE-UTIL-002  
**Title:** cleanup-old-drafts removes stale drafts  
**Area:** Edge Functions  
**Priority:** P2  
**Severity if fails:** Minor  
**Preconditions:** Old drafts exist  
**Test Data:** Draft older than threshold  
**Steps:**
1. Create old draft
2. Trigger cleanup CRON
3. Check if removed

**Expected Result:** Old draft deleted  
**Pass Criteria:** Draft no longer exists  
**Fail Signals:** Draft remains  
**Evidence to capture:** Draft count before/after  
**Notes/Variations:** Test threshold configuration

---

---

### 6.5 CRON/Scheduled Jobs

---

**TC-ID:** CRON-001  
**Title:** CRON_SECRET required for CRON functions  
**Area:** CRON  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Function with verify_jwt=false  
**Test Data:** Request without CRON_SECRET  
**Steps:**
1. Call CRON function without secret
2. Observe response

**Expected Result:** 401 Unauthorized  
**Pass Criteria:** Access denied without secret  
**Fail Signals:** Function executes anyway  
**Evidence to capture:** Response status  
**Notes/Variations:** Test with valid secret

---

**TC-ID:** CRON-002  
**Title:** Daily snapshot runs on schedule  
**Area:** CRON  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** CRON configured  
**Test Data:** N/A  
**Steps:**
1. Check CRON schedule configuration
2. Wait for scheduled time (or trigger manually)
3. Verify snapshot created

**Expected Result:** Snapshot saved  
**Pass Criteria:** Snapshot data exists for today  
**Fail Signals:** No snapshot  
**Evidence to capture:** Snapshot table entry  
**Notes/Variations:** Test idempotency (run twice)

---

**TC-ID:** CRON-003  
**Title:** Email digest CRON sends digests  
**Area:** CRON  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Digest configured with recipients  
**Test Data:** Digest configuration  
**Steps:**
1. Configure digest
2. Trigger CRON
3. Check email_log

**Expected Result:** Digest emails sent  
**Pass Criteria:** Emails in log to all recipients  
**Fail Signals:** No emails sent  
**Evidence to capture:** Email log entries  
**Notes/Variations:** Test empty digest (nothing to report)

---

**TC-ID:** CRON-004  
**Title:** Stock alert check runs correctly  
**Area:** CRON  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Low stock conditions exist  
**Test Data:** Item below threshold  
**Steps:**
1. Set item stock below alert threshold
2. Trigger check-stock-alerts
3. Verify alert created

**Expected Result:** Alert generated  
**Pass Criteria:** Alert in forecast_alerts table  
**Fail Signals:** No alert created  
**Evidence to capture:** Alert entry  
**Notes/Variations:** Test duplicate prevention

---

**TC-ID:** CRON-005  
**Title:** Audit cleanup removes old logs  
**Area:** CRON  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Retention period configured, old logs exist  
**Test Data:** Logs older than retention  
**Steps:**
1. Set retention to 30 days
2. Ensure logs older than 30 days exist
3. Trigger cleanup
4. Check log count

**Expected Result:** Old logs removed  
**Pass Criteria:** No logs older than retention  
**Fail Signals:** Old logs remain  
**Evidence to capture:** Count before/after  
**Notes/Variations:** Test protected logs (never delete)

---

---

### 6.6 Storage & File Handling

---

**TC-ID:** STOR-001  
**Title:** Catalog file upload succeeds  
**Area:** Storage  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User can edit catalog items  
**Test Data:** PDF spec sheet  
**Steps:**
1. Edit catalog item
2. Upload spec sheet file
3. Save item
4. Download file

**Expected Result:** File uploaded and retrievable  
**Pass Criteria:** File downloads correctly  
**Fail Signals:** Upload fails, file corrupt  
**Evidence to capture:** Uploaded file  
**Notes/Variations:** Test file size limits

---

**TC-ID:** STOR-002  
**Title:** Stock take photo upload  
**Area:** Storage  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Active stock take session  
**Test Data:** Photo from camera  
**Steps:**
1. Capture roll photo
2. Check upload progress
3. Verify photo in storage

**Expected Result:** Photo uploaded successfully  
**Pass Criteria:** Photo retrievable, OCR can access  
**Fail Signals:** Upload fails  
**Evidence to capture:** Storage bucket contents  
**Notes/Variations:** Test offline upload queue

---

**TC-ID:** STOR-003  
**Title:** Storage RLS prevents cross-user access  
**Area:** Storage  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Files from different users  
**Test Data:** User A's file, User B's session  
**Steps:**
1. User A uploads file
2. User B tries to access file URL
3. Observe access control

**Expected Result:** Access denied for User B  
**Pass Criteria:** 403 or signed URL required  
**Fail Signals:** File accessible to anyone  
**Evidence to capture:** Access attempt result  
**Notes/Variations:** Test public buckets separately

---

**TC-ID:** STOR-004  
**Title:** Report attachment generation  
**Area:** Storage  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Report configured  
**Test Data:** Report with email schedule  
**Steps:**
1. Generate report with attachment
2. Check storage for file
3. Verify attachment in email

**Expected Result:** Attachment saved and emailed  
**Pass Criteria:** File in bucket, email has attachment  
**Fail Signals:** No attachment  
**Evidence to capture:** Storage file, email  
**Notes/Variations:** Test cleanup of old attachments

---

---

### 6.7 Email & Notifications

---

**TC-ID:** EMAIL-001  
**Title:** Email template rendering  
**Area:** Email  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Template exists  
**Test Data:** Template with variables  
**Steps:**
1. Open template editor
2. Preview with test data
3. Verify variable substitution

**Expected Result:** Variables replaced correctly  
**Pass Criteria:** Preview shows substituted values  
**Fail Signals:** Raw {{variable}} shown  
**Evidence to capture:** Preview screenshot  
**Notes/Variations:** Test all template types

---

**TC-ID:** EMAIL-002  
**Title:** Template version history  
**Area:** Email  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Template has been edited  
**Test Data:** Template with history  
**Steps:**
1. Edit template
2. Save changes
3. View version history
4. Restore previous version

**Expected Result:** History shows all versions, restore works  
**Pass Criteria:** Can see and restore old versions  
**Fail Signals:** History missing, restore fails  
**Evidence to capture:** Version list, restored content  
**Notes/Variations:** Test version compare

---

**TC-ID:** EMAIL-003  
**Title:** In-app notification delivered  
**Area:** Notifications  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** User logged in  
**Test Data:** Triggering event  
**Steps:**
1. Perform action that generates notification
2. Check notification center
3. Mark as read

**Expected Result:** Notification appears and can be managed  
**Pass Criteria:** Notification visible, read status updates  
**Fail Signals:** No notification  
**Evidence to capture:** Notification center  
**Notes/Variations:** Test real-time delivery

---

**TC-ID:** EMAIL-004  
**Title:** Email retry on failure  
**Area:** Email  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Email service temporarily failing  
**Test Data:** Email that failed  
**Steps:**
1. Cause email send to fail
2. Wait for retry CRON
3. Check if retried

**Expected Result:** Email retried with backoff  
**Pass Criteria:** Retry count increases, eventually succeeds  
**Fail Signals:** No retry, stuck in failed  
**Evidence to capture:** Email log status changes  
**Notes/Variations:** Test max retry exhaustion

---

---

### 6.8 Webhooks

---

**TC-ID:** WEBHOOK-001  
**Title:** Create webhook subscription  
**Area:** Webhooks  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Admin logged in  
**Test Data:** Webhook URL, event types  
**Steps:**
1. Navigate to webhook settings
2. Add new subscription
3. Select event types
4. Save

**Expected Result:** Subscription created  
**Pass Criteria:** Subscription in list  
**Fail Signals:** Cannot save  
**Evidence to capture:** Subscription details  
**Notes/Variations:** Test URL validation

---

**TC-ID:** WEBHOOK-002  
**Title:** Webhook HMAC signature valid  
**Area:** Webhooks  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Webhook subscription with secret  
**Test Data:** Subscription with HMAC  
**Steps:**
1. Trigger webhook event
2. Capture webhook at receiving endpoint
3. Validate HMAC signature

**Expected Result:** Signature validates correctly  
**Pass Criteria:** HMAC matches computed value  
**Fail Signals:** Signature mismatch, missing signature  
**Evidence to capture:** Headers, signature validation  
**Notes/Variations:** Test with different secrets

---

**TC-ID:** WEBHOOK-003  
**Title:** Webhook delivery logging  
**Area:** Webhooks  
**Priority:** P1  
**Severity if fails:** Major  
**Preconditions:** Webhook delivered  
**Test Data:** Delivered webhook  
**Steps:**
1. Trigger webhook
2. Check webhook_logs table
3. Verify delivery details

**Expected Result:** Delivery logged with status  
**Pass Criteria:** Log shows URL, status, timestamp  
**Fail Signals:** No log entry  
**Evidence to capture:** Webhook log entry  
**Notes/Variations:** Test failure logging

---

**TC-ID:** WEBHOOK-004  
**Title:** Webhook retry with backoff  
**Area:** Webhooks  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Webhook endpoint failing  
**Test Data:** Failing endpoint  
**Steps:**
1. Configure webhook to failing endpoint
2. Trigger event
3. Check retry behavior

**Expected Result:** Retries with exponential backoff  
**Pass Criteria:** Increasing delay between attempts  
**Fail Signals:** No retry, immediate retries  
**Evidence to capture:** Retry timestamps  
**Notes/Variations:** Test dead letter after max retries

---

---

### 6.9 Offline & PWA

---

**TC-ID:** PWA-001  
**Title:** Service worker registers  
**Area:** PWA  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Browser supports SW  
**Test Data:** Fresh browser  
**Steps:**
1. Navigate to app
2. Open DevTools > Application
3. Check Service Workers

**Expected Result:** Service worker registered and active  
**Pass Criteria:** SW status = "activated"  
**Fail Signals:** No SW, failed registration  
**Evidence to capture:** DevTools screenshot  
**Notes/Variations:** Test update flow

---

**TC-ID:** PWA-002  
**Title:** Offline mode indicator  
**Area:** PWA  
**Priority:** P0  
**Severity if fails:** Critical  
**Preconditions:** App loaded  
**Test Data:** N/A  
**Steps:**
1. Disconnect network (airplane mode)
2. Observe UI

**Expected Result:** Offline indicator shown  
**Pass Criteria:** Visual indicator visible  
**Fail Signals:** No indication of offline  
**Evidence to capture:** Offline badge screenshot  
**Notes/Variations:** Test reconnection detection

---

**TC-ID:** PWA-003  
**Title:** Cached data accessible offline  
**Area:** PWA  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Data cached during online  
**Test Data:** Previously viewed inventory  
**Steps:**
1. View inventory while online
2. Go offline
3. Navigate to inventory

**Expected Result:** Cached data displayed  
**Pass Criteria:** Data visible, labeled as cached  
**Fail Signals:** Empty page, error  
**Evidence to capture:** Offline data view  
**Notes/Variations:** Test data freshness indicator

---

**TC-ID:** PWA-004  
**Title:** Offline mutations queued  
**Area:** PWA  
**Priority:** P0  
**Severity if fails:** Blocker  
**Preconditions:** Offline mode  
**Test Data:** Create action  
**Steps:**
1. Go offline
2. Create/update entity
3. Observe queue indicator
4. Go online
5. Check sync

**Expected Result:** Mutation queued and synced  
**Pass Criteria:** Data synced when online  
**Fail Signals:** Data lost, sync fails  
**Evidence to capture:** Queue indicator, synced data  
**Notes/Variations:** Test multiple queued items

---

**TC-ID:** PWA-005  
**Title:** Conflict resolution dialog  
**Area:** PWA  
**Priority:** P1  
**Severity if fails:** Critical  
**Preconditions:** Same entity modified online and offline  
**Test Data:** Entity with concurrent edits  
**Steps:**
1. Edit entity offline
2. Someone else edits same entity online
3. Go online
4. Observe conflict resolution

**Expected Result:** Conflict dialog shown with options  
**Pass Criteria:** Can choose which version to keep  
**Fail Signals:** Data silently overwritten  
**Evidence to capture:** Conflict dialog  
**Notes/Variations:** Test merge capability

---

**TC-ID:** PWA-006  
**Title:** PWA installation  
**Area:** PWA  
**Priority:** P2  
**Severity if fails:** Major  
**Preconditions:** Browser supports PWA install  
**Test Data:** N/A  
**Steps:**
1. Navigate to app
2. Observe install prompt
3. Install PWA
4. Launch from home screen

**Expected Result:** App installs and launches correctly  
**Pass Criteria:** App icon on home screen, launches  
**Fail Signals:** Cannot install, crashes on launch  
**Evidence to capture:** Installed app screenshot  
**Notes/Variations:** Test on iOS and Android

---

---

### 6.10 CRM ↔ WMS Integration

> **Note:** This section preserved from original document and expanded for production readiness.

#### 6.10.1 Customer Handling (Pre-Integration)

---

**TC-ID:** CRM-CUST-001  
**Title:** Customer field on orders  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Order form accessible  
**Test Data:** N/A  
**Steps:**
1. Navigate to create order
2. Check for customer field
3. Verify field saves correctly

**Expected Result:** Customer field exists and persists  
**Pass Criteria:** Field present, value saves to DB  
**Fail Signals:** Field missing, value not saved  
**Evidence to capture:** Form screenshot, DB query  
**Notes/Variations:** Check orders.crm_customer_id column exists

---

**TC-ID:** CRM-CUST-002  
**Title:** Customer field on reservations  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Reservation form accessible  
**Test Data:** N/A  
**Steps:**
1. Navigate to create reservation
2. Check for customer field
3. Verify field saves correctly

**Expected Result:** Customer field exists and persists  
**Pass Criteria:** Field present, value saves to DB  
**Fail Signals:** Field missing, value not saved  
**Evidence to capture:** Form screenshot, DB query  
**Notes/Variations:** Check reservations.crm_customer_id column

---

**TC-ID:** CRM-CUST-003  
**Title:** Customer field on inquiries  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Inquiry form accessible  
**Test Data:** N/A  
**Steps:**
1. Navigate to create inquiry
2. Check for customer field
3. Verify field saves correctly

**Expected Result:** Customer field exists and persists  
**Pass Criteria:** Field present, value saves to DB  
**Fail Signals:** Field missing, value not saved  
**Evidence to capture:** Form screenshot, DB query  
**Notes/Variations:** Check inquiries.crm_customer_id column

---

#### 6.10.2 Order Flow (Critical for Integration)

---

**TC-ID:** CRM-ORD-001  
**Title:** Order creation complete  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** User can create orders  
**Test Data:** Full order data  
**Steps:**
1. Create order with all fields
2. Check all fields saved
3. Verify order number generated

**Expected Result:** All fields saved correctly  
**Pass Criteria:** Every field matches input  
**Fail Signals:** Missing/wrong data  
**Evidence to capture:** Order details, DB record  
**Notes/Variations:** Test with CRM customer ID

---

**TC-ID:** CRM-ORD-002  
**Title:** Order status transitions  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Order exists  
**Test Data:** Order in each status  
**Steps:**
1. Move order: Draft → Confirmed → Fulfilled
2. Verify each transition works
3. Check audit trail

**Expected Result:** All transitions work correctly  
**Pass Criteria:** Status changes, audit logged  
**Fail Signals:** Transition fails, no audit  
**Evidence to capture:** Status history  
**Notes/Variations:** CRM will need these events

---

**TC-ID:** CRM-ORD-003  
**Title:** Order fulfillment updates inventory  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Order with lots assigned  
**Test Data:** Order for 100m, lot has 200m  
**Steps:**
1. Note lot stock: 200m
2. Fulfill order for 100m
3. Check lot stock: should be 100m

**Expected Result:** Inventory correctly reduced  
**Pass Criteria:** Stock = 200 - 100 = 100m  
**Fail Signals:** Wrong stock level  
**Evidence to capture:** Before/after stock  
**Notes/Variations:** Critical for CRM stock sync

---

**TC-ID:** CRM-ORD-004  
**Title:** Order cancellation releases stock  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Order with reserved stock  
**Test Data:** Reserved order  
**Steps:**
1. Note reserved quantity
2. Cancel order
3. Check reserved quantity released

**Expected Result:** Reserved stock returned to available  
**Pass Criteria:** Reserved qty reduced to 0  
**Fail Signals:** Stock still reserved  
**Evidence to capture:** Before/after reservation  
**Notes/Variations:** CRM cancel flow depends on this

---

**TC-ID:** CRM-ORD-005  
**Title:** Order audit trail complete  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Order with actions  
**Test Data:** Order ID  
**Steps:**
1. Perform create/update/status changes
2. Query audit logs
3. Verify all actions logged

**Expected Result:** Complete audit trail  
**Pass Criteria:** Every action has audit entry  
**Fail Signals:** Missing entries  
**Evidence to capture:** Audit log query  
**Notes/Variations:** CRM may query this for sync

---

#### 6.10.3 Reservation Flow (Critical for Integration)

---

**TC-ID:** CRM-RES-001  
**Title:** Reservation creation with lots  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Available lots exist  
**Test Data:** Quality, color, quantity  
**Steps:**
1. Create reservation
2. Select specific lots
3. Verify lots marked reserved

**Expected Result:** Lots correctly reserved  
**Pass Criteria:** Reserved qty matches request  
**Fail Signals:** Lots not reserved  
**Evidence to capture:** Lot reserved status  
**Notes/Variations:** CRM Deal → Reservation depends on this

---

**TC-ID:** CRM-RES-002  
**Title:** Reservation expiry handling  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Reservation near expiry  
**Test Data:** Expiring reservation  
**Steps:**
1. Let reservation expire
2. Check status changed
3. Check lots released

**Expected Result:** Auto-released on expiry  
**Pass Criteria:** Status=expired, lots available  
**Fail Signals:** Still active, lots reserved  
**Evidence to capture:** Status, lot state  
**Notes/Variations:** CRM needs expiry events

---

**TC-ID:** CRM-RES-003  
**Title:** Reservation to order conversion  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Active reservation  
**Test Data:** Reservation ID  
**Steps:**
1. Convert reservation to order
2. Check order created
3. Check reservation status

**Expected Result:** Order created, reservation closed  
**Pass Criteria:** Order exists, res status=converted  
**Fail Signals:** Duplicate, res still active  
**Evidence to capture:** Order and reservation  
**Notes/Variations:** CRM tracks this conversion

---

**TC-ID:** CRM-RES-004  
**Title:** Reservation cancellation  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Active reservation  
**Test Data:** Reservation ID  
**Steps:**
1. Cancel reservation
2. Check lots released

**Expected Result:** Lots returned to available  
**Pass Criteria:** Reserved qty = 0  
**Fail Signals:** Lots still reserved  
**Evidence to capture:** Lot states  
**Notes/Variations:** CRM deal.cancelled triggers this

---

**TC-ID:** CRM-RES-005  
**Title:** Reservation quantity change  
**Area:** CRM Integration  
**Priority:** P1 (MEDIUM)  
**Severity if fails:** Critical  
**Preconditions:** Active reservation  
**Test Data:** Res with 100m, change to 50m  
**Steps:**
1. Edit reservation quantity
2. Save changes
3. Check lot reserved quantities

**Expected Result:** Only new quantity reserved  
**Pass Criteria:** Reserved = 50m (not 100m)  
**Fail Signals:** Old qty still reserved  
**Evidence to capture:** Before/after reserved  
**Notes/Variations:** CRM line quantity changes

---

**TC-ID:** CRM-RES-006  
**Title:** Reservation audit trail  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Reservation with actions  
**Test Data:** Reservation ID  
**Steps:**
1. Perform create/update/release
2. Query audit logs
3. Verify completeness

**Expected Result:** All actions logged  
**Pass Criteria:** Every mutation audited  
**Fail Signals:** Missing entries  
**Evidence to capture:** Audit log query  
**Notes/Variations:** Used for integration reconciliation

---

#### 6.10.4 Inventory API (Critical for Integration)

---

**TC-ID:** CRM-API-001  
**Title:** API authentication  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** API key exists  
**Test Data:** Valid API key  
**Steps:**
1. Call /api-get-inventory with key
2. Check response

**Expected Result:** 200 OK with data  
**Pass Criteria:** Inventory returned  
**Fail Signals:** 401, 500  
**Evidence to capture:** Request/response  
**Notes/Variations:** CRM will call this

---

**TC-ID:** CRM-API-002  
**Title:** API returns correct data  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Inventory exists  
**Test Data:** Known inventory state  
**Steps:**
1. Call API
2. Compare with database
3. Verify all fields

**Expected Result:** Data matches database  
**Pass Criteria:** 100% data accuracy  
**Fail Signals:** Wrong data, missing fields  
**Evidence to capture:** API vs DB comparison  
**Notes/Variations:** CRM relies on accuracy

---

**TC-ID:** CRM-API-003  
**Title:** API filtering works  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Inventory with various items  
**Test Data:** Filter parameters  
**Steps:**
1. Call with quality filter
2. Call with color filter
3. Call with combined filters

**Expected Result:** Correct filtered results  
**Pass Criteria:** Only matching items returned  
**Fail Signals:** Wrong items, filter ignored  
**Evidence to capture:** Filter results  
**Notes/Variations:** CRM queries by quality/color

---

**TC-ID:** CRM-API-004  
**Title:** API pagination  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Many inventory items  
**Test Data:** 100+ items  
**Steps:**
1. Call with page=1, limit=10
2. Call with page=2
3. Verify all data accessible

**Expected Result:** All data paginated correctly  
**Pass Criteria:** No duplicates, no missing  
**Fail Signals:** Duplicate or missing items  
**Evidence to capture:** All page results  
**Notes/Variations:** CRM pages through results

---

**TC-ID:** CRM-API-005  
**Title:** API performance  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Large inventory  
**Test Data:** 5000+ items  
**Steps:**
1. Call API
2. Measure response time

**Expected Result:** Response < 1 second  
**Pass Criteria:** p95 < 1000ms  
**Fail Signals:** Timeout, > 5s  
**Evidence to capture:** Response times  
**Notes/Variations:** CRM has timeout limits

---

#### 6.10.5 Stock Calculations

---

**TC-ID:** CRM-STOCK-001  
**Title:** Reserved vs available calculation  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Lots with reservations  
**Test Data:** Lot with 100m, 30m reserved  
**Steps:**
1. Check total: 100m
2. Check reserved: 30m
3. Check available: 70m

**Expected Result:** Available = Total - Reserved  
**Pass Criteria:** Math is correct  
**Fail Signals:** Wrong calculation  
**Evidence to capture:** All three values  
**Notes/Variations:** CRM shows available stock

---

**TC-ID:** CRM-STOCK-002  
**Title:** Low stock detection  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Critical  
**Preconditions:** Threshold configured  
**Test Data:** Stock near threshold  
**Steps:**
1. Reduce stock below threshold
2. Trigger alert check
3. Verify alert created

**Expected Result:** Low stock alert generated  
**Pass Criteria:** Alert exists in system  
**Fail Signals:** No alert  
**Evidence to capture:** Alert entry  
**Notes/Variations:** CRM may receive this alert

---

**TC-ID:** CRM-STOCK-003  
**Title:** Stock calculations correct  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Various transactions  
**Test Data:** Multiple lots  
**Steps:**
1. Manual calculate expected totals
2. Compare with system totals
3. Verify accuracy

**Expected Result:** System matches manual calculation  
**Pass Criteria:** 100% accuracy  
**Fail Signals:** Any discrepancy  
**Evidence to capture:** Calculation comparison  
**Notes/Variations:** Foundation for CRM sync

---

#### 6.10.6 Data Consistency

---

**TC-ID:** CRM-DATA-001  
**Title:** Transaction integrity  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Concurrent operations  
**Test Data:** Same lot, concurrent updates  
**Steps:**
1. Two users update same lot simultaneously
2. Check for race conditions
3. Verify data integrity

**Expected Result:** No data corruption  
**Pass Criteria:** One update wins, data consistent  
**Fail Signals:** Corrupted data, lost updates  
**Evidence to capture:** Final state  
**Notes/Variations:** Critical for integration reliability

---

**TC-ID:** CRM-DATA-002  
**Title:** Rollback on failure  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Blocker  
**Preconditions:** Transaction with multiple steps  
**Test Data:** Order with inventory update  
**Steps:**
1. Start complex operation
2. Force failure mid-transaction
3. Check data state

**Expected Result:** All changes rolled back  
**Pass Criteria:** Data in original state  
**Fail Signals:** Partial updates persisted  
**Evidence to capture:** Before/after state  
**Notes/Variations:** Prevents sync inconsistency

---

**TC-ID:** CRM-DATA-003  
**Title:** No orphaned records  
**Area:** CRM Integration  
**Priority:** P1 (MEDIUM)  
**Severity if fails:** Major  
**Preconditions:** Foreign key relationships  
**Test Data:** Related entities  
**Steps:**
1. Query for orphaned reservation_lines
2. Query for orphaned order_lines
3. Check all FKs valid

**Expected Result:** No orphaned records  
**Pass Criteria:** All FKs resolve  
**Fail Signals:** Orphaned records exist  
**Evidence to capture:** Query results  
**Notes/Variations:** Data quality for CRM

---

#### 6.10.7 Error Handling

---

**TC-ID:** CRM-ERR-001  
**Title:** Graceful error messages  
**Area:** CRM Integration  
**Priority:** P0 (HIGH)  
**Severity if fails:** Major  
**Preconditions:** User can trigger errors  
**Test Data:** Invalid input  
**Steps:**
1. Submit invalid data
2. Observe error message
3. Verify user-friendly

**Expected Result:** Clear, actionable error  
**Pass Criteria:** User knows what to fix  
**Fail Signals:** Technical jargon, no message  
**Evidence to capture:** Error message  
**Notes/Variations:** CRM receives same messages

---

**TC-ID:** CRM-ERR-002  
**Title:** Error logging  
**Area:** CRM Integration  
**Priority:** P1 (MEDIUM)  
**Severity if fails:** Major  
**Preconditions:** Error occurs  
**Test Data:** Forced error  
**Steps:**
1. Cause an error
2. Check console logs
3. Check error tracking

**Expected Result:** Error logged with context  
**Pass Criteria:** Stack trace, user context  
**Fail Signals:** Silent failure  
**Evidence to capture:** Error log  
**Notes/Variations:** Needed for integration debugging

---

**TC-ID:** CRM-ERR-003  
**Title:** Recovery from errors  
**Area:** CRM Integration  
**Priority:** P1 (MEDIUM)  
**Severity if fails:** Major  
**Preconditions:** Recoverable error  
**Test Data:** Temporary failure  
**Steps:**
1. Cause temporary error
2. Fix condition
3. Retry operation

**Expected Result:** Operation succeeds on retry  
**Pass Criteria:** No permanent damage  
**Fail Signals:** Cannot recover  
**Evidence to capture:** Retry success  
**Notes/Variations:** Integration retry logic

---

---

## 7. Non-Functional Testing

### 7.1 Performance

| Test | Target | Acceptable | Test Method |
|------|--------|------------|-------------|
| Page load (dashboard) | < 2s | < 4s | Lighthouse |
| Inventory list (1000 items) | < 1s | < 2s | Network tab |
| API response (inventory) | < 500ms | < 1s | curl timing |
| Search results | < 300ms | < 500ms | User timing |
| Report generation | < 5s | < 10s | Function timing |
| Bulk upload (100 items) | < 30s | < 60s | End-to-end |

### 7.2 Reliability

| Test | Method | Pass Criteria |
|------|--------|---------------|
| Page refresh preserves state | F5 on any page | Data and filters retained |
| Network drop recovery | Disconnect/reconnect | Auto-reconnect, no data loss |
| Session recovery | Close/reopen tab | Session maintained |
| Failed API retry | Throttle network | Automatic retry with backoff |
| CRON job idempotency | Run job twice | No duplicate effects |

### 7.3 Observability

| Aspect | Verification |
|--------|--------------|
| Console errors | No unhandled errors in normal flow |
| Network errors | All errors have user-facing feedback |
| Edge function logs | All functions log inputs/outputs |
| Audit trail | All mutations logged |
| Error tracking | Critical errors captured |

### 7.4 Backup/Restore

| Test | Steps | Pass Criteria |
|------|-------|---------------|
| Database export | Trigger export | File downloads, contains all tables |
| Export format | Open export file | Valid JSON/SQL format |
| Partial restore | Verify structure | Tables and relationships correct |

---

## 8. Production Go/No-Go Checklist

### 8.1 P0 Must-Pass Requirements

- [ ] **AUTH-001**: Valid login works
- [ ] **AUTH-003**: Rate limiting enforced
- [ ] **AUTH-005**: Logout clears session
- [ ] **SESSION-004**: Token refresh works
- [ ] **MFA-003**: MFA login works (if enabled)
- [ ] **MFA-006**: MFA enforcement by role (if configured)
- [ ] **RLS-001**: User data isolation
- [ ] **RLS-003**: Audit logs admin-only
- [ ] **TOKEN-001**: 401 triggers graceful logout
- [ ] **WMS-INV-001**: Inventory loads
- [ ] **WMS-INV-005**: Reserved vs available correct
- [ ] **WMS-ORD-001**: Order creation works
- [ ] **WMS-ORD-003**: Fulfillment updates inventory
- [ ] **WMS-RES-001**: Reservation creates correctly
- [ ] **WMS-RES-002**: Expiry auto-release works
- [ ] **WMS-ST-001**: Stock take session starts
- [ ] **AUDIT-001**: Create actions logged
- [ ] **AUDIT-002**: Update logs old/new values
- [ ] **EDGE-API-001**: Inventory API works
- [ ] **EDGE-API-003**: Invalid API key rejected
- [ ] **CRON-001**: CRON_SECRET enforced
- [ ] **PWA-002**: Offline indicator shows
- [ ] **PWA-003**: Cached data accessible offline
- [ ] **CRM-STOCK-001**: Stock calculation correct

### 8.2 Pre-Release Verification

- [ ] All P0 tests passed
- [ ] No Blocker/Critical defects open
- [ ] Security scan passed
- [ ] RLS policies reviewed
- [ ] Edge function logs clear
- [ ] Performance benchmarks met
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured

---

## 9. Coverage Matrix

| Feature Area | Test Suite | TC Count | P0 | P1 | P2 |
|--------------|------------|----------|----|----|-----|
| Platform - Auth | 6.1.1 | 10 | 6 | 3 | 1 |
| Platform - Session | 6.1.2 | 5 | 3 | 2 | 0 |
| Platform - MFA | 6.1.3 | 7 | 3 | 4 | 0 |
| Platform - RLS | 6.1.4 | 6 | 5 | 1 | 0 |
| Platform - Roles | 6.1.5 | 4 | 2 | 2 | 0 |
| Platform - Token | 6.1.6 | 3 | 3 | 0 | 0 |
| WMS - Inventory | 6.2.1 | 6 | 3 | 2 | 1 |
| WMS - Orders | 6.2.2 | 8 | 4 | 3 | 1 |
| WMS - Reservations | 6.2.3 | 5 | 3 | 2 | 0 |
| WMS - Inquiries | 6.2.4 | 3 | 0 | 3 | 0 |
| WMS - MO | 6.2.5 | 3 | 1 | 2 | 0 |
| WMS - Stock Take | 6.2.6 | 6 | 3 | 2 | 1 |
| WMS - Catalog | 6.2.7 | 4 | 0 | 3 | 1 |
| WMS - Forecast | 6.2.8 | 3 | 0 | 2 | 1 |
| WMS - Reports | 6.2.9 | 4 | 2 | 2 | 0 |
| Audit Logs | 6.3 | 8 | 4 | 2 | 2 |
| Edge - Admin | 6.4.1 | 5 | 4 | 1 | 0 |
| Edge - API | 6.4.2 | 6 | 4 | 1 | 1 |
| Edge - Email | 6.4.3 | 4 | 0 | 4 | 0 |
| Edge - OCR | 6.4.4 | 2 | 1 | 1 | 0 |
| Edge - Forecast | 6.4.5 | 2 | 0 | 1 | 1 |
| Edge - Webhook | 6.4.6 | 2 | 1 | 1 | 0 |
| Edge - Utility | 6.4.7 | 2 | 1 | 0 | 1 |
| CRON Jobs | 6.5 | 5 | 2 | 2 | 1 |
| Storage | 6.6 | 4 | 2 | 2 | 0 |
| Email | 6.7 | 4 | 0 | 3 | 1 |
| Webhooks | 6.8 | 4 | 2 | 2 | 0 |
| Offline/PWA | 6.9 | 6 | 3 | 2 | 1 |
| CRM Integration | 6.10 | 27 | 20 | 5 | 2 |
| **TOTAL** | - | **158** | **72** | **60** | **16** |

---

## 10. Appendix

### 10.1 Test Case Template

```markdown
---

**TC-ID:** [AREA]-[FEATURE]-[###]  
**Title:** [Descriptive title]  
**Area:** [Platform / WMS / Edge / Audit / CRON / Integration]  
**Priority:** [P0/P1/P2]  
**Severity if fails:** [Blocker/Critical/Major/Minor]  
**Preconditions:** [Required state before test]  
**Test Data:** [Data needed for test]  
**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result:** [What should happen]  
**Pass Criteria:** [Objective measurement]  
**Fail Signals:** [What indicates failure]  
**Evidence to capture:** [Screenshots, logs, etc.]  
**Notes/Variations:** [Edge cases, related tests]

---
```

### 10.2 Defect Report Template

```markdown
## Defect Report

**Defect ID:** DEF-[###]
**Title:** [Brief description]
**Severity:** [Blocker/Critical/Major/Minor]
**Priority:** [P0/P1/P2]
**Test Case:** [TC-ID if applicable]

### Environment
- Browser: 
- OS:
- User Role:
- Date/Time:

### Steps to Reproduce
1. 
2. 
3. 

### Expected Result


### Actual Result


### Evidence
[Screenshots, console logs, network trace]

### Additional Notes

```

### 10.3 Evidence Checklist

| Evidence Type | When Required | Format |
|---------------|---------------|--------|
| Screenshot | All UI tests | PNG |
| Console log | Errors, edge function tests | Text/JSON |
| Network trace | API tests | HAR file |
| Database query | Data integrity tests | SQL + result |
| Video recording | Complex flows, bugs | MP4 |
| Function logs | Edge function tests | Text |

### 10.4 Test Status Legend

| Symbol | Status | Meaning |
|--------|--------|---------|
| ⬜ | Not Run | Test not yet executed |
| ✅ | Passed | Test passed all criteria |
| ❌ | Failed | Test failed - defect logged |
| 🚫 | Blocked | Cannot run - dependency issue |
| ⏸️ | Deferred | Postponed to future release |

---

## Document Maintenance

| Action | Trigger | Owner |
|--------|---------|-------|
| Update inventory | New feature added | Dev Lead |
| Add test cases | New functionality | QA Lead |
| Review coverage | Each release | QA Lead |
| Archive results | Post-release | QA Lead |

---

*End of Production Readiness Test Specification*
