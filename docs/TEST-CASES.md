# LotAstro Test Cases

> **Version**: 1.0.0  
> **Last Updated**: 2026-01-05  
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
