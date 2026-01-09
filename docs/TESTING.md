# WMS Application Testing Guide

> **Last Updated:** 2026-01-09  
> **Purpose:** Comprehensive testing checklist for all WMS features

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [Inventory Management](#inventory-management)
3. [Orders](#orders)
4. [Reservations](#reservations)
5. [Inquiries](#inquiries)
6. [Manufacturing Orders](#manufacturing-orders)
7. [Stock Take](#stock-take)
8. [Catalog Management](#catalog-management)
9. [Reports & Analytics](#reports--analytics)
10. [Forecasting](#forecasting)
11. [Email & Notifications](#email--notifications)
12. [API Endpoints](#api-endpoints)
13. [Admin Functions](#admin-functions)
14. [Offline & PWA](#offline--pwa)
15. [CRM Integration Readiness](#crm-integration-readiness)

---

## Authentication & Authorization

### Login/Logout
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Valid login | Enter valid email/password | Redirect to dashboard | ⬜ |
| Invalid login | Enter wrong password | Error message shown | ⬜ |
| Rate limiting | Attempt 5+ failed logins | Account temporarily locked | ⬜ |
| Session timeout | Wait for session expiry | Redirect to login | ⬜ |
| Logout | Click logout button | Session cleared, redirect to login | ⬜ |

### MFA
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| MFA enrollment | Enable MFA in settings | QR code shown, backup codes generated | ⬜ |
| MFA verification | Login with MFA enabled | OTP prompt shown | ⬜ |
| MFA with valid OTP | Enter correct OTP | Login successful | ⬜ |
| MFA with invalid OTP | Enter wrong OTP | Error shown, retry allowed | ⬜ |

### Role-Based Access
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Admin access | Login as admin | All menu items visible | ⬜ |
| Warehouse staff access | Login as warehouse_staff | Limited menu items | ⬜ |
| Accounting access | Login as accounting | Finance-related menus visible | ⬜ |
| Permission denied | Access unauthorized page | 403 or redirect | ⬜ |

---

## Inventory Management

### Inventory Viewing
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View inventory list | Navigate to Inventory | Table with stock data shown | ⬜ |
| Filter by quality | Select quality filter | Only matching items shown | ⬜ |
| Filter by color | Select color filter | Only matching items shown | ⬜ |
| Filter by status | Select status filter | Only matching items shown | ⬜ |
| Search inventory | Enter search term | Matching items shown | ⬜ |
| Sort by column | Click column header | Data sorted accordingly | ⬜ |
| Pagination | Navigate pages | Correct items per page | ⬜ |
| Export to Excel | Click export button | Excel file downloaded | ⬜ |

### Inventory Pivot Table
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View pivot table | Navigate to Inventory pivot | Aggregated view shown | ⬜ |
| Expand quality | Click quality row | Color breakdown shown | ⬜ |
| View lot details | Click on cell | Lot-level details shown | ⬜ |

### Incoming Stock
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Add incoming stock | Fill form, submit | Stock added to inventory | ⬜ |
| Batch receive | Upload multiple items | All items processed | ⬜ |
| QR code scan | Scan QR code | Form pre-filled | ⬜ |
| Duplicate detection | Add existing lot | Warning shown | ⬜ |

### Inventory Transactions
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View transactions | Navigate to transactions | All transactions listed | ⬜ |
| Filter by type | Select transaction type | Filtered list shown | ⬜ |
| Filter by date | Select date range | Filtered list shown | ⬜ |
| Transaction details | Click transaction row | Details dialog shown | ⬜ |

---

## Orders

### Order Creation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create order manually | Fill order form, submit | Order created, number generated | ⬜ |
| Add order lines | Add multiple line items | Lines saved correctly | ⬜ |
| Select from reservation | Link to existing reservation | Reservation data pre-filled | ⬜ |
| AI order input | Upload order document | AI extracts order details | ⬜ |
| Bulk upload | Upload Excel file | Multiple orders created | ⬜ |

### Order Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View order list | Navigate to Orders | All orders shown | ⬜ |
| Filter by status | Select status filter | Filtered orders shown | ⬜ |
| Search orders | Enter search term | Matching orders shown | ⬜ |
| View order details | Click order row | Details dialog shown | ⬜ |
| Edit order | Modify order details | Changes saved | ⬜ |
| Cancel order | Click cancel button | Order status updated | ⬜ |
| Fulfill order | Mark as fulfilled | Status changed, stock updated | ⬜ |

### Order Printing
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Print order | Click print button | Print dialog shown | ⬜ |
| PDF export | Export as PDF | PDF downloaded | ⬜ |

### Order Sharing
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Share order link | Generate share link | Link copied to clipboard | ⬜ |
| Access shared order | Open shared link | Order visible (inquiry gate if needed) | ⬜ |

---

## Reservations

### Reservation Creation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create reservation | Fill form, select lots | Reservation created | ⬜ |
| Select specific lots | Choose lots from dialog | Lots reserved | ⬜ |
| Set expiry date | Pick expiration date | Expiry saved | ⬜ |
| Customer info | Enter customer details | Customer data saved | ⬜ |

### Reservation Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View reservations | Navigate to Reservations | All reservations shown | ⬜ |
| Filter by status | Select status filter | Filtered list shown | ⬜ |
| Filter by customer | Search by customer | Matching reservations shown | ⬜ |
| View details | Click reservation row | Details dialog shown | ⬜ |
| Edit reservation | Modify reservation | Changes saved | ⬜ |
| Extend expiry | Change expiry date | New date saved | ⬜ |
| Release reservation | Click release button | Lots freed, status updated | ⬜ |
| Cancel reservation | Click cancel button | Reservation cancelled | ⬜ |
| Convert to order | Click convert button | Order created from reservation | ⬜ |

### Reservation Expiry
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Expiry reminder | Wait for reminder time | Email sent | ⬜ |
| Auto-release | Wait past expiry | Lots automatically freed | ⬜ |

---

## Inquiries

### Inquiry Creation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create inquiry | Fill inquiry form | Inquiry created | ⬜ |
| Add inquiry items | Add quality/color items | Items saved | ⬜ |
| Set customer info | Enter customer details | Customer saved | ⬜ |

### Inquiry Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View inquiries | Navigate to Inquiries | All inquiries shown | ⬜ |
| Filter by status | Select status filter | Filtered list shown | ⬜ |
| View details | Click inquiry row | Details shown | ⬜ |
| Convert to reservation | Click convert | Reservation created | ⬜ |
| Convert to order | Click convert to order | Order created | ⬜ |
| Close inquiry | Mark as closed | Status updated | ⬜ |

### Inquiry Gating
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Access stock without inquiry | Try to view stock | Inquiry gate shown | ⬜ |
| Submit inquiry first | Complete inquiry form | Stock access granted | ⬜ |

---

## Manufacturing Orders

### MO Creation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create MO | Fill MO form | MO created with number | ⬜ |
| Set production details | Enter quality, quantity | Details saved | ⬜ |
| Set timeline | Enter start/end dates | Dates saved | ⬜ |

### MO Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View MO list | Navigate to MO page | All MOs shown | ⬜ |
| Filter by status | Select status filter | Filtered list shown | ⬜ |
| Update MO status | Change status | Status updated, audit logged | ⬜ |
| View status history | Click history button | Status changes shown | ⬜ |
| MO reminders | Wait for reminder time | Email sent | ⬜ |

### MO Bulk Operations
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Bulk upload MOs | Upload Excel file | Multiple MOs created | ⬜ |
| Bulk status update | Select multiple, update | All statuses changed | ⬜ |

---

## Stock Take

### Session Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Start new session | Click start session | Session created | ⬜ |
| View active session | Navigate to stock take | Session details shown | ⬜ |
| Complete session | Finish counting | Session marked complete | ⬜ |
| Cancel session | Cancel session | Session cancelled with reason | ⬜ |

### Roll Capture
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Camera capture | Take photo of label | Photo saved | ⬜ |
| OCR processing | Submit photo | Text extracted | ⬜ |
| Manual entry | Enter details manually | Roll recorded | ⬜ |
| Edit OCR results | Correct OCR errors | Changes saved | ⬜ |
| Duplicate detection | Scan same roll twice | Warning shown | ⬜ |

### Review Process
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View pending review | Navigate to review | Pending rolls shown | ⬜ |
| Approve roll | Approve captured roll | Status changed to approved | ⬜ |
| Reject roll | Reject with reason | Status changed, reason saved | ⬜ |
| Request recount | Request recount | Roll flagged for recount | ⬜ |

### Reconciliation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View discrepancies | Compare with inventory | Differences shown | ⬜ |
| Reconcile differences | Apply adjustments | Inventory updated | ⬜ |

---

## Catalog Management

### Catalog Items
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View catalog | Navigate to Catalog | All items shown | ⬜ |
| Search catalog | Enter search term | Matching items shown | ⬜ |
| Filter by status | Select status | Filtered list shown | ⬜ |
| Filter by type | Select type | Filtered list shown | ⬜ |
| View item details | Click item row | Details page shown | ⬜ |

### Catalog Item CRUD
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create item | Fill form, submit | Item created | ⬜ |
| Edit item | Modify details | Changes saved | ⬜ |
| Deactivate item | Set inactive | Item marked inactive | ⬜ |
| Add composition | Enter fiber breakdown | Composition saved | ⬜ |
| Upload spec sheet | Attach file | File saved | ⬜ |

### Catalog Bulk Operations
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Bulk upload | Upload Excel file | Multiple items created | ⬜ |
| Migration | Migrate old items | Items migrated | ⬜ |

### Catalog Approval
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Submit for approval | Submit new item | Item in pending status | ⬜ |
| Approve item | Admin approves | Status changed to approved | ⬜ |
| Reject item | Admin rejects | Status changed, reason saved | ⬜ |

### Catalog Custom Fields
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Define custom field | Create field definition | Field available | ⬜ |
| Set field value | Enter value on item | Value saved | ⬜ |
| Filter by custom field | Filter using field | Filtered results shown | ⬜ |

---

## Reports & Analytics

### Report Builder
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create report | Select data source, columns | Report created | ⬜ |
| Add filters | Define filter conditions | Filters applied | ⬜ |
| Add sorting | Set sort order | Data sorted | ⬜ |
| Preview report | Click preview | Report data shown | ⬜ |
| Save report | Save configuration | Report saved | ⬜ |

### Report Execution
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Run report | Execute saved report | Results displayed | ⬜ |
| Export to Excel | Export report data | Excel file downloaded | ⬜ |
| Export to PDF | Export as PDF | PDF downloaded | ⬜ |
| View history | See past runs | Execution history shown | ⬜ |

### Scheduled Reports
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Schedule report | Set schedule | Schedule saved | ⬜ |
| Report auto-runs | Wait for scheduled time | Report generated | ⬜ |
| Email delivery | Check email | Report attached | ⬜ |

### Dashboard Analytics
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View dashboard | Navigate to Dashboard | Widgets loaded | ⬜ |
| Activity feed | Check recent activity | Activities shown | ⬜ |
| Trend charts | View charts | Data visualized | ⬜ |
| Insights widget | Check insights | AI insights shown | ⬜ |

---

## Forecasting

### Forecast Settings
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Configure global settings | Set forecast parameters | Settings saved | ⬜ |
| Set quality overrides | Override per quality | Overrides saved | ⬜ |
| Enable seasonal adjustment | Turn on seasonal | Setting enabled | ⬜ |
| Enable trend detection | Turn on trends | Setting enabled | ⬜ |

### Forecast Execution
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Run forecast manually | Trigger forecast | Forecast generated | ⬜ |
| Scheduled forecast | Wait for schedule | Auto-run executed | ⬜ |
| View forecast results | Navigate to forecast | Results displayed | ⬜ |
| View by scenario | Switch scenarios | Different projections shown | ⬜ |

### Forecast Alerts
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Low stock alert | Forecast shows stockout | Alert generated | ⬜ |
| Overstock alert | Forecast shows excess | Alert generated | ⬜ |
| Resolve alert | Mark alert resolved | Status updated | ⬜ |

### Forecast Accuracy
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Calculate accuracy | Run accuracy check | Metrics calculated | ⬜ |
| View accuracy chart | Check accuracy tab | Chart displayed | ⬜ |

### Historical Import
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Import history | Upload historical data | Data imported | ⬜ |
| Validate import | Check imported data | Data correct | ⬜ |

---

## Email & Notifications

### Email Templates
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View templates | Navigate to templates | All templates shown | ⬜ |
| Edit template | Modify template content | Changes saved | ⬜ |
| Preview template | Click preview | Rendered preview shown | ⬜ |
| Send test email | Send test | Email received | ⬜ |
| Version history | View versions | Past versions shown | ⬜ |
| Restore version | Restore old version | Template reverted | ⬜ |

### Email Digests
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Configure digest | Set digest settings | Configuration saved | ⬜ |
| Digest sent | Wait for schedule | Email received | ⬜ |
| Overdue digest | Check overdue items | Items included | ⬜ |
| Approval digest | Check pending approvals | Items included | ⬜ |

### In-App Notifications
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Receive notification | Trigger event | Notification shown | ⬜ |
| Mark as read | Click notification | Status updated | ⬜ |
| Notification center | Open notification center | All notifications listed | ⬜ |
| Clear notifications | Clear all | Notifications cleared | ⬜ |

---

## API Endpoints

### Inventory API
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| GET /api-get-inventory | Call with API key | Inventory data returned | ⬜ |
| Filter parameters | Add quality/color filters | Filtered data returned | ⬜ |
| Masked mode | Add masked=true | Stock status returned | ⬜ |
| Pagination | Add page/limit | Paginated results | ⬜ |
| Invalid API key | Call with wrong key | 401 Unauthorized | ⬜ |

### Catalog API
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| GET /api-get-catalog | Call with API key | Catalog data returned | ⬜ |
| Filter by type | Add type filter | Filtered data returned | ⬜ |

### Order API
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| POST /api-create-order | Submit order data | Order created | ⬜ |
| Validation errors | Submit invalid data | 400 with errors | ⬜ |

### Rate Limiting
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Rate limit check | Exceed rate limit | 429 Too Many Requests | ⬜ |

### API Key Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create API key | Generate new key | Key created, shown once | ⬜ |
| Revoke API key | Deactivate key | Key no longer works | ⬜ |
| Key permissions | Set limited permissions | Only allowed operations work | ⬜ |

---

## Admin Functions

### User Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View users | Navigate to users | All users listed | ⬜ |
| Invite user | Send invitation | Email sent | ⬜ |
| Accept invitation | Click invite link | Account created | ⬜ |
| Change user role | Modify role | Role updated | ⬜ |
| Deactivate user | Deactivate account | User cannot login | ⬜ |
| Delete user | Delete account | User removed | ⬜ |
| Change password (admin) | Reset user password | Password changed | ⬜ |

### Session Management
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View active sessions | Check sessions tab | Active sessions listed | ⬜ |
| Terminate session | End other session | Session invalidated | ⬜ |
| Session timeout settings | Configure timeout | Setting saved | ⬜ |

### Audit Logs
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View audit logs | Navigate to audit | All logs shown | ⬜ |
| Filter by action | Select action type | Filtered logs shown | ⬜ |
| Filter by user | Search by user | Filtered logs shown | ⬜ |
| Filter by date | Select date range | Filtered logs shown | ⬜ |
| Export logs | Export to file | File downloaded | ⬜ |
| Reverse action | Undo logged action | Changes reverted | ⬜ |

### Audit Retention
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Set retention period | Configure retention | Setting saved | ⬜ |
| Cleanup runs | Wait for cleanup | Old logs removed | ⬜ |

### IP Whitelist
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Add IP to whitelist | Enter IP address | IP added | ⬜ |
| Access from whitelisted IP | Login from IP | Access granted | ⬜ |
| Access from blocked IP | Login from other IP | Access denied (if enabled) | ⬜ |

### Password Policy
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Configure policy | Set requirements | Policy saved | ⬜ |
| Weak password rejected | Try weak password | Error shown | ⬜ |
| Strong password accepted | Use strong password | Password accepted | ⬜ |

### Database Export
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Export database | Trigger export | Export file generated | ⬜ |
| View export history | Check logs | Past exports listed | ⬜ |

### Webhook Subscriptions
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create subscription | Add webhook URL | Subscription created | ⬜ |
| Test webhook | Send test payload | Webhook received | ⬜ |
| Webhook triggered | Perform action | Webhook sent | ⬜ |
| Webhook retry | Simulate failure | Retry executed | ⬜ |

---

## Offline & PWA

### Offline Mode
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Offline indicator | Disconnect network | Offline badge shown | ⬜ |
| Cached data access | View inventory offline | Cached data shown | ⬜ |
| Queue mutations | Make changes offline | Changes queued | ⬜ |
| Sync on reconnect | Reconnect network | Queued changes synced | ⬜ |
| Conflict resolution | Conflicting changes | Resolution dialog shown | ⬜ |

### PWA Installation
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Install prompt | Visit site | Install prompt shown | ⬜ |
| Install app | Click install | App installed | ⬜ |
| Launch from home | Open installed app | App launches | ⬜ |

### Service Worker
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| SW registration | Check DevTools | SW registered | ⬜ |
| Cache populated | Check cache storage | Assets cached | ⬜ |
| Update available | Deploy new version | Update prompt shown | ⬜ |

---

## CRM Integration Readiness

> **Purpose:** These tests ensure WMS features are production-ready for CRM integration

### Customer Handling (Pre-Integration)
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Customer field on orders | Check order form | Customer field exists | HIGH | ⬜ |
| Customer field on reservations | Check reservation form | Customer field exists | HIGH | ⬜ |
| Customer field on inquiries | Check inquiry form | Customer field exists | HIGH | ⬜ |
| Customer data displayed | View order details | Customer info shown | HIGH | ⬜ |

### Order Flow (Critical for Integration)
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Order creation complete | Create full order | All fields saved correctly | HIGH | ⬜ |
| Order status transitions | Move through statuses | All transitions work | HIGH | ⬜ |
| Order fulfillment | Fulfill order | Inventory updated | HIGH | ⬜ |
| Order cancellation | Cancel order | Stock released if reserved | HIGH | ⬜ |
| Order audit trail | Check audit logs | All changes logged | HIGH | ⬜ |

### Reservation Flow (Critical for Integration)
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Reservation creation | Create with lot selection | Lots correctly reserved | HIGH | ⬜ |
| Reservation expiry handling | Let reservation expire | Lots auto-released | HIGH | ⬜ |
| Reservation to order | Convert reservation | Order created, reservation closed | HIGH | ⬜ |
| Reservation cancellation | Cancel reservation | Lots released | HIGH | ⬜ |
| Reservation quantity change | Modify reserved qty | Lots adjusted | MEDIUM | ⬜ |
| Reservation audit trail | Check audit logs | All changes logged | HIGH | ⬜ |

### Inquiry Flow (Medium Priority)
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Inquiry creation | Create inquiry | Inquiry saved | MEDIUM | ⬜ |
| Inquiry to reservation | Convert inquiry | Reservation created | MEDIUM | ⬜ |
| Inquiry to order | Convert to order | Order created | MEDIUM | ⬜ |

### Inventory API (Critical for Integration)
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| API authentication | Call with valid key | 200 OK | HIGH | ⬜ |
| API returns correct data | Compare with UI | Data matches | HIGH | ⬜ |
| API filtering works | Apply filters | Correct subset returned | HIGH | ⬜ |
| API pagination | Page through results | All data accessible | HIGH | ⬜ |
| API performance | Call with large data | Response < 1s | HIGH | ⬜ |

### Shipment/Fulfillment Tracking
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Goods receipt posting | Receive goods | Receipt recorded | HIGH | ⬜ |
| Shipment posting | Ship order | Shipment recorded | HIGH | ⬜ |
| Tracking number | Add tracking | Number saved | MEDIUM | ⬜ |

### Audit & Logging
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| All mutations logged | Perform various actions | Audit entries created | HIGH | ⬜ |
| Audit data complete | Check log details | Old/new values captured | HIGH | ⬜ |
| Audit queryable | Filter audit logs | Filters work correctly | MEDIUM | ⬜ |

### Stock Levels & Alerts
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Low stock detection | Reduce stock below threshold | Alert generated | HIGH | ⬜ |
| Stock calculations correct | Compare calculations | Math is accurate | HIGH | ⬜ |
| Reserved vs available | Check reservation impact | Available = Total - Reserved | HIGH | ⬜ |

### Data Consistency
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Transaction integrity | Perform concurrent ops | No data corruption | HIGH | ⬜ |
| Rollback on failure | Trigger error mid-transaction | Data rolled back | HIGH | ⬜ |
| No orphaned records | Check foreign keys | All references valid | MEDIUM | ⬜ |

### Error Handling
| Test Case | Steps | Expected Result | Priority | Status |
|-----------|-------|-----------------|----------|--------|
| Graceful error messages | Trigger validation error | User-friendly message | HIGH | ⬜ |
| Error logging | Cause error | Error logged to console | MEDIUM | ⬜ |
| Recovery from errors | Fix and retry | Operation succeeds | MEDIUM | ⬜ |

---

## Test Execution Tracking

### Summary
| Section | Total Tests | Passed | Failed | Blocked | Not Run |
|---------|-------------|--------|--------|---------|---------|
| Authentication | 14 | 0 | 0 | 0 | 14 |
| Inventory | 18 | 0 | 0 | 0 | 18 |
| Orders | 17 | 0 | 0 | 0 | 17 |
| Reservations | 14 | 0 | 0 | 0 | 14 |
| Inquiries | 8 | 0 | 0 | 0 | 8 |
| Manufacturing Orders | 9 | 0 | 0 | 0 | 9 |
| Stock Take | 15 | 0 | 0 | 0 | 15 |
| Catalog | 17 | 0 | 0 | 0 | 17 |
| Reports | 12 | 0 | 0 | 0 | 12 |
| Forecasting | 12 | 0 | 0 | 0 | 12 |
| Email & Notifications | 15 | 0 | 0 | 0 | 15 |
| API Endpoints | 13 | 0 | 0 | 0 | 13 |
| Admin Functions | 23 | 0 | 0 | 0 | 23 |
| Offline & PWA | 11 | 0 | 0 | 0 | 11 |
| CRM Integration Readiness | 27 | 0 | 0 | 0 | 27 |
| **TOTAL** | **225** | **0** | **0** | **0** | **225** |

### Test Status Legend
- ⬜ Not Run
- ✅ Passed
- ❌ Failed
- 🚫 Blocked

---

## Notes

### Testing Environment
- Browser: Chrome (latest), Firefox (latest), Safari (latest)
- Mobile: iOS Safari, Android Chrome
- Network: Online, Offline, Slow 3G

### Regression Testing
Run full regression after:
- Major feature releases
- Database migrations
- Security updates
- Dependency updates

### Performance Benchmarks
| Operation | Target | Acceptable |
|-----------|--------|------------|
| Page load | < 2s | < 4s |
| API response | < 500ms | < 1s |
| Search results | < 300ms | < 500ms |
| Report generation | < 5s | < 10s |
