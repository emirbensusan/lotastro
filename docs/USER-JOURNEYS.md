# LotAstro WMS - User Journeys

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Purpose**: Document key user workflows from end to end

---

## Overview

This document maps the primary user journeys in LotAstro WMS, identifying touchpoints, pain points, and ideal states for each workflow. These journeys inform UX design decisions and feature prioritization.

---

## Journey 1: Lot Intake (Warehouse Staff)

### Scenario
A delivery truck arrives with fabric rolls. Warehouse staff must receive the goods, verify quantities, and register them in the system.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   ARRIVAL   │───▶│   VERIFY    │───▶│   ENTER     │───▶│   PRINT     │───▶│   STORE     │
│   Truck     │    │   Delivery  │    │   System    │    │   QR Codes  │    │   Location  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Arrival | Truck arrives at warehouse | Driver | - | Unexpected arrivals | Incoming stock calendar |
| 2. Verify | Check delivery note against boxes | Warehouse | - | Paper-based matching | Mobile scanner for DO |
| 3. Identify | Match to existing incoming stock record | Warehouse | Lookup incoming_stock | Manual search | Auto-suggest from expected |
| 4. Count | Count rolls, verify meters | Warehouse | - | Time consuming | OCR from labels |
| 5. Enter | Create lot record with roll details | Warehouse | POST lots + rolls | Complex form | Pre-filled from incoming |
| 6. Quality | Note any defects or issues | Warehouse | Update lot notes | Forgotten step | Mandatory defect checklist |
| 7. Print QR | Generate and print QR labels | Warehouse | Generate QR | Printer issues | Bulk print support |
| 8. Apply | Attach QR to each roll | Warehouse | - | Time consuming | Pre-printed on receipt |
| 9. Store | Move to warehouse location | Warehouse | Update location | Location forgotten | Barcode scan location |
| 10. Complete | Confirm receipt done | Warehouse | Update incoming_stock | - | Auto-notify accounting |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time per lot intake | 15 min | 5 min |
| Data entry errors | 5% | 1% |
| Missing QR labels | 10% | 0% |

### Related Features

- Lot creation form (`/lot-intake`)
- QR code printing (`/qr-print`)
- Incoming stock management (`/incoming-stock`)
- Goods receipt workflow (`/goods-receipt`)

---

## Journey 2: Order Fulfillment (Accounting → Warehouse)

### Scenario
Customer sends order via email. Accounting processes the order, warehouse picks the rolls, and goods are dispatched.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   RECEIVE   │───▶│   EXTRACT   │───▶│   VERIFY    │───▶│   APPROVE   │───▶│   PICK      │
│   Order     │    │   AI Parse  │    │   Stock     │    │   Manager   │    │   Rolls     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                                    │
                                                                                    ▼
                                                         ┌─────────────┐    ┌─────────────┐
                                                         │   INVOICE   │◀───│   DISPATCH  │
                                                         │   Generate  │    │   Load Truck│
                                                         └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Receive | Get order from email/WhatsApp | Accounting | - | Multiple channels | Unified inbox |
| 2. Extract | Copy order details manually | Accounting | - | Re-typing errors | AI extraction |
| 3. AI Parse | Use AI to extract order lines | Accounting | extract-order | Requires review | 90%+ accuracy |
| 4. Review | Verify extracted data, fix errors | Accounting | po_draft_lines | Low confidence items | Highlight issues |
| 5. Confirm | Convert draft to order | Accounting | confirm-draft | Commitment step | Clear preview |
| 6. Check Stock | Verify availability per line | Accounting | View inventory | Multiple lookups | Inline availability |
| 7. Select Rolls | Choose specific rolls per lot | Accounting | Roll selection | Time consuming | Auto-suggest FIFO |
| 8. Submit | Send for approval | Accounting | order_queue | - | Manager notification |
| 9. Approve | Manager reviews and approves | Manager | order_queue | Delayed response | Mobile push |
| 10. Pick List | Generate picking instructions | Accounting | Order print | Manual creation | Auto-generate |
| 11. Pick | Locate and collect rolls | Warehouse | Scan QR | Wrong rolls | Scan verification |
| 12. Pack | Prepare for shipment | Warehouse | - | - | Packing list |
| 13. Dispatch | Load truck, confirm departure | Warehouse | Update order | - | Driver confirmation |
| 14. Invoice | Generate customer invoice | Accounting | - | Separate system | Integrated invoicing |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Order entry time | 15 min | 3 min |
| AI extraction accuracy | 85% | 95% |
| Pick error rate | 2% | 0.5% |
| Order to dispatch | 4 hours | 2 hours |

### Related Features

- AI Order Input (`/orders` → AI input)
- Order Queue (`/order-queue`)
- Order Print/Pick List (`OrderPrintDialog`)
- Bulk Selection (`/bulk-selection`)

---

## Journey 3: Stock Take (Warehouse Staff → Admin)

### Scenario
Monthly physical inventory count. Warehouse staff photograph labels, admin reviews discrepancies, reconciliation updates system.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   START     │───▶│   CAPTURE   │───▶│   OCR       │───▶│   REVIEW    │───▶│  RECONCILE  │
│   Session   │    │   Photos    │    │   Process   │    │   Admin     │    │   Adjust    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Plan | Schedule stock take date | Admin | - | Ad-hoc, disruptive | Calendar integration |
| 2. Start | Create new counting session | Warehouse | count_sessions | - | One-tap start |
| 3. Navigate | Go to first storage location | Warehouse | - | No route optimization | Suggested path |
| 4. Photograph | Take photo of roll label | Warehouse | Camera capture | Blurry photos | Quality check |
| 5. OCR | Extract data from photo | System | stock-take-ocr | Low accuracy | Improved models |
| 6. Confirm | Verify OCR results | Warehouse | count_rolls | Manual correction | Smart suggestions |
| 7. Continue | Repeat for all rolls | Warehouse | - | Fatigue, missed rolls | Progress tracker |
| 8. Complete | Mark session complete | Warehouse | Update session | - | Completeness check |
| 9. Queue | Rolls queued for review | System | count_rolls | - | Auto-categorize |
| 10. Review | Admin reviews discrepancies | Admin | Review interface | Time consuming | Prioritized list |
| 11. Approve | Accept or request recount | Admin | Update status | - | Bulk actions |
| 12. Reconcile | System updates inventory | System | Compare + adjust | Complex matching | Auto-reconcile |
| 13. Report | Generate variance report | Admin | Report builder | - | Standard template |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time per roll capture | 30 sec | 10 sec |
| OCR accuracy | 70% | 90% |
| Full count duration | 3 days | 1 day |
| Admin review time | 4 hours | 1 hour |

### Related Features

- Stock Take Capture (`/stock-take-capture`)
- Stock Take Review (`/stock-take-review`)
- Session Management (`StockTakeSessionDetail`)
- OCR Processing (`stock-take-ocr` edge function)

---

## Journey 4: Manufacturing Order (Accounting → Supplier → Warehouse)

### Scenario
Stock is low for a quality. Accounting creates manufacturing order to supplier, tracks production, receives finished goods.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   IDENTIFY  │───▶│   CREATE    │───▶│   TRACK     │───▶│   RECEIVE   │───▶│   CLOSE     │
│   Need      │    │   MO        │    │   Status    │    │   Goods     │    │   MO        │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Alert | Low stock notification | System | forecast_alerts | Reactive discovery | Proactive alert |
| 2. Review | Check forecast recommendations | Manager | purchase_recommendations | Manual calculation | AI recommendations |
| 3. Create | New manufacturing order | Accounting | manufacturing_orders | Complex form | Pre-filled from alert |
| 4. Supplier | Select supplier, set ETA | Accounting | - | Scattered info | Supplier catalog |
| 5. Confirm | Send order to supplier | Accounting | - | Manual email | Integrated communication |
| 6. Track | Monitor production status | Accounting | mo_status_history | No visibility | Supplier updates |
| 7. Update | Log status changes with notes | Accounting | Update MO | Forgotten | Reminder emails |
| 8. Notify | Alert when goods expected | System | send-mo-reminders | No advance warning | Scheduled reminders |
| 9. Receive | Goods arrive at warehouse | Warehouse | goods_in_receipts | Unexpected | Expected date visible |
| 10. Link | Connect receipt to MO | Warehouse | incoming_stock | Manual matching | Auto-link |
| 11. Quality | Check received goods | Warehouse | - | No checklist | Quality inspection |
| 12. Complete | Close MO with final quantities | Accounting | Update status | - | Auto-close option |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| MO creation time | 10 min | 3 min |
| Status update frequency | Weekly | Real-time |
| Overdue visibility | Manual check | Auto-alert |
| Receipt to close | 2 days | Same day |

### Related Features

- Manufacturing Orders (`/manufacturing-orders`)
- MO Dialog (`ManufacturingOrderDialog`)
- Status History (`MOStatusHistoryDialog`)
- Reminders (`send-mo-reminders`)

---

## Journey 5: Reservation Workflow (Accounting → Customer)

### Scenario
Customer requests to hold stock before confirming order. Accounting creates reservation, manages hold period, converts or releases.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   REQUEST   │───▶│   RESERVE   │───▶│   FOLLOW    │───▶│   CONVERT   │
│   Hold      │    │   Stock     │    │   Up        │    │   or Cancel │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Request | Customer asks to hold stock | - | - | Informal channel | Formal request |
| 2. Check | Verify stock availability | Accounting | inventory view | Multiple lookups | Inline check |
| 3. Create | Create reservation record | Accounting | reservations | - | Quick form |
| 4. Lines | Add reserved items | Accounting | reservation_lines | - | Auto-suggest lots |
| 5. Duration | Set hold-until date | Accounting | - | No enforcement | Auto-expire |
| 6. Confirm | Notify customer of hold | Accounting | - | Manual email | Template email |
| 7. Track | Monitor reservation status | Accounting | - | Easy to forget | Dashboard widget |
| 8. Remind | Alert on expiring holds | System | send-reservation-reminders | Manual tracking | Auto-reminders |
| 9. Follow Up | Contact customer for decision | Accounting | - | Forgotten | Scheduled tasks |
| 10a. Convert | Customer confirms, create order | Accounting | convert to order | Re-entry | One-click convert |
| 10b. Cancel | Customer declines, release stock | Accounting | cancel reservation | - | One-click release |
| 11. Update | Reserved meters returned to available | System | Update lot reserved_meters | - | Automatic |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Reservation creation | 5 min | 2 min |
| Conversion rate | 60% | 75% |
| Expired reservations | 20% | 5% |
| Auto-release compliance | 50% | 100% |

### Related Features

- Reservations page (`/reservations`)
- Reservation Dialog (`ReservationDialog`)
- Convert Dialog (`ReservationConvertDialog`)
- Cancel Dialog (`ReservationCancelDialog`)
- Reminders (`send-reservation-reminders`)

---

## Journey 6: Forecasting & Purchasing (Manager)

### Scenario
Monthly planning cycle. Manager reviews demand forecasts, identifies gaps, creates purchase recommendations.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   IMPORT    │───▶│   RUN       │───▶│   REVIEW    │───▶│   DECIDE    │───▶│   ORDER     │
│   History   │    │   Forecast  │    │   Results   │    │   Actions   │    │   MOs       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Configure | Set forecast parameters | Admin | forecast_settings_global | Complex options | Sensible defaults |
| 2. Override | Per-quality settings | Manager | forecast_settings_per_quality | - | Only exceptions |
| 3. Import | Load historical demand | Manager | forecast-import-history | Format issues | Template download |
| 4. Run | Execute forecast engine | Manager | forecast-engine | Long wait | Background job |
| 5. Results | View forecasts by quality×color | Manager | forecast_results | Dense data | Visual charts |
| 6. Scenarios | Compare conservative/normal/aggressive | Manager | - | No comparison | Side-by-side |
| 7. Alerts | Review stock alerts | Manager | forecast_alerts | Overwhelming | Prioritized list |
| 8. Recommendations | Review purchase suggestions | Manager | purchase_recommendations | - | One-click MO |
| 9. Adjust | Override recommendations if needed | Manager | Update rec | - | Inline edit |
| 10. Action | Create MOs from recommendations | Manager | Link to MO | Manual creation | Auto-create MO |
| 11. Digest | Email summary to stakeholders | System | send-forecast-digest | - | Scheduled weekly |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Forecast accuracy | 75% | 85% |
| Alert response time | 3 days | Same day |
| Recommendation adoption | 60% | 80% |
| Stockout prevention | 70% | 95% |

### Related Features

- Forecast page (`/forecast`)
- Forecast Settings (`/forecast-settings`)
- Forecast Drawer (`ForecastDetailDrawer`)
- Import Modal (`HistoricalImportModal`)

---

## Journey 7: New User Onboarding (Admin → New User)

### Scenario
New employee joins. Admin invites them, assigns role, new user sets up account and starts using system.

### Journey Map

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   INVITE    │───▶│   RECEIVE   │───▶│   REGISTER  │───▶│   EXPLORE   │───▶│   WORK      │
│   Email     │    │   Link      │    │   Account   │    │   Features  │    │   Daily     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Detailed Steps

| Stage | Action | Actor | System | Pain Point | Ideal State |
|-------|--------|-------|--------|------------|-------------|
| 1. Request | Manager requests new user | Manager | - | Informal | Request form |
| 2. Create | Admin creates invitation | Admin | user_invitations | - | Quick form |
| 3. Role | Assign appropriate role | Admin | - | Unclear what each does | Role descriptions |
| 4. Send | System sends invite email | System | send-invitation | Email issues | Retry mechanism |
| 5. Receive | New user gets email | New User | - | Spam folder | Clear sender |
| 6. Click | Click invite link | New User | - | Link expired | 7-day validity |
| 7. Accept | Accept invite page | New User | `/invite-accept` | Confusing | Clear instructions |
| 8. Password | Set secure password | New User | Auth | Weak passwords | Strength indicator |
| 9. Profile | Complete profile info | New User | - | - | Optional fields |
| 10. Dashboard | Land on appropriate home | System | - | Same for all | Role-based home |
| 11. Tour | Guided feature tour | System | - | No guidance | Interactive onboarding |
| 12. First Task | Complete first action | New User | - | Unsure what to do | Suggested tasks |
| 13. Support | Access help if needed | New User | - | No documentation | In-app help |

### Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Invite to active | 2 days | 30 min |
| First action completion | 50% | 90% |
| Help requests Day 1 | 5 | 1 |
| 7-day retention | 80% | 95% |

### Related Features

- User Management (`/admin` → Users tab)
- Invitation System (`user_invitations`)
- Accept Page (`/invite-accept`)
- Password Strength (`PasswordStrengthIndicator`)

---

## Journey Map Summary

### Time Investment by Journey

| Journey | Current Duration | Target Duration | Frequency |
|---------|-----------------|-----------------|-----------|
| Lot Intake | 15 min | 5 min | 10/day |
| Order Fulfillment | 30 min | 10 min | 20/day |
| Stock Take (full) | 3 days | 1 day | Monthly |
| Manufacturing Order | 20 min | 8 min | 5/week |
| Reservation | 10 min | 4 min | 15/day |
| Forecasting | 2 hours | 30 min | Weekly |
| Onboarding | 2 days | 1 hour | As needed |

### Pain Point Frequency

| Category | Occurrences | Priority |
|----------|-------------|----------|
| Manual data entry | 150/day | Critical |
| Slow mobile loading | 50/day | High |
| Missing notifications | 20/day | High |
| Unclear next steps | 10/day | Medium |
| Permission confusion | 5/day | Low |

### Opportunity Impact Matrix

```
                    HIGH IMPACT
                         │
    ┌───────────────────┼───────────────────┐
    │   AI Extraction   │   Mobile PWA      │
    │   Offline Mode    │   Push Notifs     │
    │                   │                   │
LOW ├───────────────────┼───────────────────┤ HIGH
EFFORT                  │                   EFFORT
    │   Autocomplete    │   Forecasting     │
    │   Bulk Actions    │   OCR Accuracy    │
    │                   │                   │
    └───────────────────┼───────────────────┘
                         │
                    LOW IMPACT
```
