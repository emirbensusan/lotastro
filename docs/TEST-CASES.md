# LotAstro Test Cases

> **Version**: 1.1.0  
> **Last Updated**: 2026-01-20  
> **Coverage**: Critical User Journeys & Integration Points

---

## 1. Authentication & Security

### 1.1 Login Flow

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| AUTH-001 | Valid login | Enter valid email/password, click Login | Redirect to Dashboard |
| AUTH-002 | Invalid password | Enter valid email, wrong password | Error toast, remain on login |
| AUTH-003 | Rate limiting | Attempt 5 failed logins | Account locked message, cooldown timer shown |
| AUTH-004 | Password reset | Click "Forgot password", enter email | Email sent confirmation |
| AUTH-005 | Session timeout | Leave app idle for configured timeout | Auto logout, redirect to login |

### 1.2 MFA Enforcement

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| MFA-001 | Admin MFA required | Login as admin without MFA enrolled | MFA enrollment screen shown, blocked from app |
| MFA-002 | MFA enrollment | Complete TOTP setup with authenticator | MFA enabled, access granted |
| MFA-003 | MFA verification | Login with MFA enabled, enter valid code | Access granted |
| MFA-004 | Invalid MFA code | Enter incorrect TOTP code | Error message, retry allowed |

### 1.3 Role-Based Access

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| RBAC-001 | Warehouse user access | Login as warehouse role | Only warehouse-relevant menu items visible |
| RBAC-002 | Admin panel access | Login as non-admin, navigate to /admin | Access denied or redirect |
| RBAC-003 | View-as-role | Admin uses "View as" dropdown | UI reflects selected role permissions |

---

## 2. Inventory Management

### 2.1 Lot Intake

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| LOT-001 | Create lot | Enter quality, color, meters, submit | Lot created, appears in inventory |
| LOT-002 | QR code generation | Create lot, click print QR | QR code contains lot ID, quality, color |
| LOT-003 | Duplicate detection | Create lot with same quality/color/lot# | Warning shown, option to proceed |

### 2.2 Stock Movement

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| INV-001 | Receive stock | Open ReceiveStockDialog, enter details | Stock added, webhook `lot.received` fired |
| INV-002 | Reserve stock | Create reservation for lot | Available meters reduced, reserved increased |
| INV-003 | Fulfill reservation | Convert reservation to order | Reserved meters deducted, order created |
| INV-004 | Low stock alert | Stock falls below threshold | `inventory.low_stock` webhook fired |

---

## 3. Order Management

### 3.1 Order Creation

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ORD-001 | Manual order entry | Fill order form, submit | Order created, `order.created` webhook fired |
| ORD-002 | AI order extraction | Upload order image/text | Draft created with extracted lines |
| ORD-003 | Bulk upload | Upload Excel with multiple orders | All orders imported with validation |
| ORD-004 | Order confirmation | Confirm draft order | Status changes to confirmed |

### 3.2 Order Fulfillment

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ORD-005 | Lot selection | Select lots to fulfill order line | Lots reserved/allocated |
| ORD-006 | Order fulfillment | Mark order as fulfilled | `order.fulfilled` webhook fired |
| ORD-007 | Order cancellation | Cancel order | Status updated, `order.cancelled` webhook fired |

---

## 4. Reservations

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| RES-001 | Create reservation | Fill reservation form, submit | Reservation created, `reservation.created` webhook fired |
| RES-002 | Reservation expiry | Let reservation pass expiry date | Status changes to expired |
| RES-003 | Convert to order | Click convert on active reservation | Order created, reservation fulfilled |
| RES-004 | Cancel reservation | Cancel active reservation | Stock released, status updated |

---

## 5. Catalog Management

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CAT-001 | Create catalog item | Fill catalog form, save | Item created, `catalog.updated` webhook fired |
| CAT-002 | Edit catalog item | Modify existing item, save | Changes saved, webhook fired with update type |
| CAT-003 | Catalog approval | Submit item for approval | Status changes to pending |
| CAT-004 | Bulk upload | Upload catalog Excel | Items imported with validation errors shown |

---

## 6. Webhook Integration

### 6.1 Webhook Dispatch

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| WH-001 | Subscription create | Add webhook subscription | Subscription saved with endpoint URL |
| WH-002 | Event dispatch | Trigger subscribed event | POST sent to endpoint with HMAC signature |
| WH-003 | Retry on failure | Endpoint returns 500 | Retry with exponential backoff |
| WH-004 | Dead letter queue | 10 consecutive failures | Entry created in `webhook_dead_letters` |

### 6.2 Event Types

| Event | Trigger | Payload Includes |
|-------|---------|------------------|
| `order.created` | New order confirmed | order_id, customer, lines, total |
| `order.fulfilled` | Order fulfilled | order_id, fulfilled_by, fulfilled_at |
| `order.cancelled` | Order cancelled | order_id, cancelled_by, reason |
| `lot.received` | Stock received | lot_id, quality, color, meters |
| `inventory.low_stock` | Stock below threshold | quality, color, current_stock, threshold |
| `reservation.created` | New reservation | reservation_id, customer, items |
| `catalog.updated` | Catalog item changed | item_id, change_type, fields |

---

## 7. Forecasting

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| FC-001 | Run forecast | Trigger forecast run | Results generated for all quality/color combos |
| FC-002 | Seasonal adjustment | Enable seasonal factors | Forecast amounts adjusted by month |
| FC-003 | Trend detection | Enable trend detection | Forecast includes trend direction |
| FC-004 | Accuracy calculation | Compare forecast vs actual | Accuracy metrics (MAPE, MAE) calculated |
| FC-005 | Alert generation | Forecast shows stockout risk | Alert created with severity level |

---

## 8. Stock Take

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| ST-001 | Start session | Click "Start Stock Take" | New session created, counter mode active |
| ST-002 | Capture roll | Take photo of label | OCR processes, fields extracted |
| ST-003 | Manual entry | Enter roll details manually | Roll added without OCR |
| ST-004 | Duplicate detection | Capture same roll twice | Warning shown with original reference |
| ST-005 | Session review | Complete counting, submit for review | Status changes to pending_review |
| ST-006 | Reconciliation | Admin approves/rejects rolls | Inventory adjusted accordingly |

---

## 9. Reporting

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| RPT-001 | Build report | Select data source, columns, filters | Report definition saved |
| RPT-002 | Run report | Click "Run Report" | Data fetched, displayed in preview |
| RPT-003 | Export Excel | Click Excel export | .xlsx file downloaded |
| RPT-004 | Export PDF | Click PDF export | PDF generated with styling |
| RPT-005 | Schedule report | Set daily schedule | Report runs automatically, email sent |
| RPT-006 | Share report | Generate share link | Token-based access works |

---

## 10. Offline Mode

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| OFF-001 | Detect offline | Disconnect network | Offline indicator shown |
| OFF-002 | Queue mutations | Perform action while offline | Action queued in IndexedDB |
| OFF-003 | Auto sync | Reconnect network | Queued actions synced automatically |
| OFF-004 | Conflict resolution | Server data changed while offline | Conflict dialog shown with options |

---

## 11. API Integration

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| API-001 | Get inventory | GET /api-get-inventory with valid key | JSON response with inventory data |
| API-002 | Get catalog | GET /api-get-catalog with valid key | JSON response with catalog items |
| API-003 | Create order | POST /api-create-order with payload | Order created, ID returned |
| API-004 | Invalid API key | Request with wrong key | 401 Unauthorized |
| API-005 | Rate limiting | Exceed rate limit | 429 Too Many Requests |

---

## 12. Email & Notifications

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| EMAIL-001 | Send test email | Click "Send Test" on template | Email delivered, logged |
| EMAIL-002 | Scheduled digest | Configure daily digest | Email sent at scheduled time |
| EMAIL-003 | Email retry | Email fails initially | Retried with backoff, logged |
| EMAIL-004 | In-app notification | Trigger notification event | Bell icon shows unread count |

---

## Test Environment Setup

### Prerequisites
- Supabase project connected
- Test user accounts for each role
- Webhook test endpoint (e.g., webhook.site)
- Sample data loaded

### Test Data
- 5 catalog items (various types)
- 10 lots across different qualities/colors
- 3 orders (draft, confirmed, fulfilled)
- 2 reservations (active, expired)

---

## Regression Checklist

Before each release, verify:

- [ ] Login/logout works
- [ ] MFA enforcement active for admin roles
- [ ] Order creation and fulfillment complete
- [ ] Webhook events fire correctly
- [ ] Forecast runs without errors
- [ ] Stock take capture works
- [ ] Reports generate and export
- [ ] Offline mode queues and syncs
- [ ] API endpoints respond correctly
- [ ] Email notifications deliver
- [ ] CRM webhooks received and processed
- [ ] WMS webhooks dispatched with correct payloads

---

## 13. CRM-WMS Integration

> **Contract Version**: 1.0.7  
> **Reference**: `docs/integration_contract_v1.md`

### 13.1 Supply Requests

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-001 | Supply request webhook received | CRM sends `supply_request.created` | Record created in `supply_requests` table |
| CRM-002 | Manufacturing order linked | CRM sends supply_request with `mo_number` | `manufacturing_order_id` FK populated |
| CRM-003 | Confirm in transit | Click "Confirm In Transit" on planned request | Status changes to `in_transit`, `supply_request.status_updated` webhook emitted |
| CRM-004 | Mark arrived (soft) | Click "Mark Arrived" on in_transit request | Status changes to `arrived_soft`, NO inventory increase |
| CRM-005 | arrived_soft does NOT add inventory | Check lots/rolls after Mark Arrived | No new lots or rolls created |
| CRM-006 | Status history recorded | Change supply request status | Entry added to `supply_request_status_history` |
| CRM-007 | UI label for arrived_soft | View supply request with arrived_soft status | Display shows "Arrived (Soft)" (LOCKED) |
| CRM-008 | Import-from-central type | CRM sends supply_request with type=import_from_central | Record created with correct type |
| CRM-009 | ETA date stored | CRM sends supply_request with eta_date | eta_date stored and visible in UI |

### 13.2 Allocation Planning (INCOMING-BACKED Only)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-010 | View arrived_soft supplies | Open Allocation Planning page | Only `arrived_soft` supply requests shown |
| CRM-011 | Plan allocation | Select reservations, click Plan Allocation | `allocation_state=planned`, `reservation.allocation_planned` webhook emitted |
| CRM-012 | Webhook includes lines | Check `reservation.allocation_planned` payload | `lines[]` array with `crm_deal_line_id` on each line |
| CRM-013 | Shortage detection | Arrived meters < reserved meters | `action_required_reason=needs_shortage_decision`, Plan Allocation blocked |
| CRM-014 | Shortage decision | Manager records decision in ShortageDecisionDialog | Audit logged, allocation unblocked |
| CRM-015 | Shortage email sent | Complete shortage decision | Email sent to sales manager via Resend |
| CRM-016 | Only INCOMING-BACKED shown | View Allocation Planning with ON-HAND reservations | ON-HAND reservations NOT shown (Partaj N/A) |
| CRM-017 | Reservation source indicator | View reservation in Allocation Planning | Shows "INCOMING-BACKED" source label |

### 13.3 Allocation Entry (INCOMING-BACKED Only)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-020 | View planned reservations | Open Allocation Entry page | Only `allocation_state=planned` reservations shown |
| CRM-021 | Enter lot/roll | Enter lot/roll/meters for planned reservation | `allocation_state=allocated`, `reservation.allocated` webhook emitted |
| CRM-022 | Webhook includes lines | Check `reservation.allocated` payload | `lines[]` array with `crm_deal_line_id`, `lot_id`, `roll_id` |
| CRM-023 | Immediate ship intent | Allocate reservation with `ship_intent=immediate` | `action_required_reason=needs_shipment_approval` |
| CRM-024 | Ship on date without date | Allocate reservation with `ship_intent=ship_on_date`, no date | `action_required_reason=needs_ship_date` |
| CRM-025 | crm_deal_line_id preserved | Allocate reservation from CRM deal | `reservation.allocated` payload includes `crm_deal_line_id` on each line |
| CRM-026 | Only INCOMING-BACKED shown | View Allocation Entry with ON-HAND reservations | ON-HAND reservations NOT shown |

### 13.4 Shipment Approval + PO Creation (UNIVERSAL GATE)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-030 | shipment.approved creates PO (INCOMING-BACKED) | CRM sends `shipment.approved` for INCOMING-BACKED reservation | WMS Order created with `po_number`, `order.created` webhook emitted |
| CRM-031 | shipment.approved creates PO (ON-HAND) | CRM sends `shipment.approved` for ON-HAND reservation | WMS Order created with `po_number`, `order.created` webhook emitted |
| CRM-032 | po_number = order_number | Check created order | `po_number` equals `order_number` |
| CRM-033 | order.created includes po_number | Check webhook payload | `po_number` field present |
| CRM-034 | order.created includes lines[] | Check webhook payload | `lines[]` array with `crm_deal_line_id` on each line |
| CRM-035 | order.created includes CRM IDs | Check webhook payload | `crm_deal_id`, `crm_customer_id`, `crm_organization_id` present |
| CRM-036 | Reject INCOMING-BACKED if not allocated | `shipment.approved` for unallocated INCOMING-BACKED reservation | Error response, no order created |
| CRM-037 | Accept ON-HAND without allocation_state | `shipment.approved` for ON-HAND reservation (no allocation_state) | Order created successfully (v1.0.7 fix) |
| CRM-038 | Single-PO full fulfillment | Attempt partial shipment on PO | Not allowed, enforced at order level |
| CRM-039 | order_lots has crm_deal_line_id | Check order_lots after PO creation | `crm_deal_line_id` populated from reservation_lines |
| CRM-040 | Determine reservation source | shipment.approved handler | Uses `crm_supply_request_id IS NULL` to detect ON-HAND |

### 13.5 Manager Override

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-041 | Override without CRM approval | Manager uses ShipmentOverrideDialog | Order created, override logged in `shipment_approval_overrides` |
| CRM-042 | Override reason required | Try to submit override without reason | Blocked, reason dropdown required |
| CRM-043 | Override reason validated | Try invalid override reason | Constraint violation, blocked |
| CRM-044 | Override fields populated | Complete override | `orders.override_used=true`, `override_reason`, `override_by`, `override_at` set |
| CRM-045 | Override notifies CRM | Complete override | `order.created` webhook emitted with override info |
| CRM-046 | Override email sent | Complete override | Email sent to CRM admin via Resend |
| CRM-047 | action_required_reason set | Complete override | `reservation.action_required_reason=override_used` |
| CRM-048 | Override allowed for ON-HAND | Manager overrides ON-HAND reservation | Override succeeds, no allocation_state check |
| CRM-049 | Override allowed for INCOMING-BACKED | Manager overrides INCOMING-BACKED reservation | Override succeeds if allocation_state=allocated |

### 13.6 Webhook Compliance

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-050 | HMAC validation | Send webhook without valid signature | 401 Unauthorized |
| CRM-051 | HMAC with wrong secret | Send webhook with wrong HMAC | 401 Unauthorized |
| CRM-052 | Idempotency key format | Check emitted webhooks | Keys follow format: `source:entity:id:action:v1` |
| CRM-053 | Idempotency key no timestamp | Check idempotency key | No timestamp component in key |
| CRM-054 | Idempotency deduplication | Send same event twice | Second event returns 409 or is ignored |
| CRM-055 | 5-minute timestamp window | Send webhook with timestamp > 5 min old | Rejected with 401 |
| CRM-056 | Webhook retry logged | Outbound webhook fails | Entry in `integration_outbox` with retry info |
| CRM-057 | Spelling normalization | Check outbound cancelled status | Uses `cancelled` not `canceled` |

### 13.7 CRM ID Tracking

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-060 | crm_deal_id on reservation | Create reservation from CRM deal | `crm_deal_id` stored on reservation |
| CRM-061 | crm_deal_id on order | Create order from reservation | `crm_deal_id` carried forward to order |
| CRM-062 | crm_customer_id stored | Receive CRM webhook with customer | `crm_customer_id` stored |
| CRM-063 | crm_organization_id stored | Receive CRM webhook with org | `crm_organization_id` stored |
| CRM-064 | crm_supply_request_id linked | Plan allocation for supply request | `crm_supply_request_id` on reservation |
| CRM-065 | Multiple POs per deal | Create 2 orders from same deal | Both orders share same `crm_deal_id` |
| CRM-066 | crm_deal_line_id on reservation_lines | Create reservation from CRM deal | `crm_deal_line_id` stored on each line |
| CRM-067 | crm_deal_line_id on order_lots | Create order from reservation | `crm_deal_line_id` carried forward to order_lots |

### 13.8 Ship Next Day (Post-PO Staging)

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-070 | View staging queue | Open Ship Next Day page | Shows orders (POs) from approved shipments |
| CRM-071 | po_number displayed | View order in staging | `po_number` is primary display column |
| CRM-072 | Mark staged | Click "Mark Staged" on order | Order moves to pick/pack flow |
| CRM-073 | Ship date visible | View order with ship_date | Ship date shown in staging queue |
| CRM-074 | Only shows POs | Verify page content | Shows WMS Orders (POs), NOT reservations |
| CRM-075 | Filter by ship date | Filter staging queue by date | Only matching orders shown |

### 13.9 Internal Email Notifications

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-080 | Supply request created email | Handle `supply_request.created` | Email sent to WMS Ops |
| CRM-081 | ETA near email | ETA date approaches | Email sent to WMS Ops + Sales Owner |
| CRM-082 | In transit email | Status → in_transit | Email sent to Sales Owner |
| CRM-083 | Soft arrival email | Status → arrived_soft | Email sent to Sales Owner |
| CRM-084 | Approval needed email | `action_required_reason=needs_shipment_approval` | Email sent to Sales Owner/Manager |
| CRM-085 | Override used email | Override logged | Email sent to Sales Manager |

### 13.10 Reservation Source Detection

| ID | Test Case | Steps | Expected Result |
|----|-----------|-------|-----------------|
| CRM-090 | ON-HAND detection | Reservation without crm_supply_request_id | Identified as ON-HAND |
| CRM-091 | INCOMING-BACKED detection | Reservation with crm_supply_request_id | Identified as INCOMING-BACKED |
| CRM-092 | ON-HAND skips Partaj | Process ON-HAND reservation | Allocation Planning/Entry pages skip it |
| CRM-093 | INCOMING-BACKED requires Partaj | Process INCOMING-BACKED reservation | Must go through Allocation Planning → Entry |
| CRM-094 | UI shows source | View reservation details | Source type (ON-HAND / INCOMING-BACKED) displayed |

---

## CRM-WMS Test Data Requirements

### Prerequisite Data
- CRM API credentials configured (`CRM_API_KEY`, `CRM_API_URL`, `CRM_WEBHOOK_SECRET`)
- Test CRM deal with multiple lines
- Test CRM customer and organization
- Manufacturing order for linking tests
- Webhook test endpoint configured

### Test Scenarios Data

| Scenario | Requirements |
|----------|--------------|
| Supply request flow | 1 manufacturing + 1 import_from_central supply request |
| Allocation planning | 2 INCOMING-BACKED reservations matching supply request quality/color |
| Shortage scenario | Supply request with 100m, reservations totaling 150m |
| Override scenario | Allocated INCOMING-BACKED reservation without CRM approval |
| Multi-line scenario | Deal with 3 lines, different quality/color each |
| ON-HAND scenario | Reservation without crm_supply_request_id |
| INCOMING-BACKED scenario | Reservation with crm_supply_request_id |
| Mixed scenario | Deal with 1 ON-HAND + 1 INCOMING-BACKED reservation |

---

## v1.0.7 Specific Test Cases

> These test cases verify the key changes introduced in contract v1.0.7

| ID | Test Case | v1.0.7 Requirement | Expected Result |
|----|-----------|-------------------|-----------------|
| V107-001 | Universal shipment approval gate | Shipment approval applies to both ON-HAND and INCOMING-BACKED | Both types processed correctly |
| V107-002 | ON-HAND no allocation_state check | ON-HAND reservations don't require allocation_state=allocated | Shipment approved without deadlock |
| V107-003 | INCOMING-BACKED requires allocated | INCOMING-BACKED requires allocation_state=allocated | Error if not allocated |
| V107-004 | arrived_soft UI label | Status must display as "Arrived (Soft)" | Exact string in all UI locations |
| V107-005 | Ship Next Day is post-PO | Page shows POs, not reservations | Only WMS Orders displayed |
| V107-006 | manufacturing_order_id FK | Supply requests link to manufacturing_orders | FK populated when applicable |
| V107-007 | Partaj only for INCOMING-BACKED | Allocation Planning/Entry filter by source | ON-HAND excluded from Partaj flow |
