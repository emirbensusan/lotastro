# LotAstro WMS - User Personas

> **Version**: 1.0.0  
> **Last Updated**: 2025-01-10  
> **Purpose**: Define target user archetypes for product design decisions

---

## Overview

LotAstro WMS serves four distinct user roles, each with unique needs, workflows, and system access patterns. This document defines detailed personas for each role to guide UX decisions, feature prioritization, and communication design.

---

## 1. Warehouse Staff (Depo Personeli)

### Profile

| Attribute | Details |
|-----------|---------|
| **Role Code** | `warehouse_staff` |
| **User Count** | 5-10 per warehouse |
| **Primary Device** | Mobile (70%), Desktop (30%) |
| **Session Frequency** | Multiple times per day |
| **Session Duration** | 2-10 minutes (quick tasks) |
| **Technical Proficiency** | Basic - comfortable with smartphones |
| **Language Preference** | Turkish (primary) |

### Representative User: Mehmet

**Age**: 35  
**Education**: High school  
**Experience**: 8 years in warehouse operations  
**Tech Comfort**: Uses WhatsApp daily, basic smartphone apps

### Goals

1. **Primary**: Complete daily intake and dispatch tasks quickly
2. **Secondary**: Find lot locations without asking colleagues
3. **Tertiary**: Record accurate data without complex forms

### Frustrations

| Pain Point | Impact | Current Workaround |
|------------|--------|-------------------|
| Complex forms with many fields | Slows down work | Asks accounting to enter data |
| Slow mobile page loads | Abandons task | Uses paper, enters later |
| Small touch targets | Mis-taps, errors | Repeats actions multiple times |
| English-only interfaces | Cannot understand | Guesses or asks for help |
| No offline capability | Work stops | Paper backup system |

### Daily Workflow

```
07:00 - Check lot queue for incoming deliveries
08:00 - Receive goods, scan QR, confirm quantities
10:00 - Pick rolls for customer orders
12:00 - Update stock locations after reorganization
14:00 - Process returns, update inventory
16:00 - Participate in stock take (when scheduled)
```

### Key Workflows

| Workflow | Frequency | Priority |
|----------|-----------|----------|
| Lot Intake | 5-10x/day | Critical |
| QR Code Scanning | 20-30x/day | Critical |
| Stock Take Capture | Weekly | High |
| Location Updates | 2-5x/day | Medium |
| Roll Selection for Orders | 5-10x/day | High |

### Feature Prioritization

| Feature | Importance | Notes |
|---------|------------|-------|
| Mobile-first design | ⭐⭐⭐⭐⭐ | Essential |
| Large touch targets | ⭐⭐⭐⭐⭐ | Essential |
| Turkish localization | ⭐⭐⭐⭐⭐ | Essential |
| Offline mode | ⭐⭐⭐⭐ | Important |
| Camera integration | ⭐⭐⭐⭐ | Important |
| Voice input | ⭐⭐ | Nice to have |

### Design Implications

- **Mobile-first layouts**: All warehouse features must work on phone
- **Large buttons**: Minimum 44px touch targets, ideally 48px+
- **Simple forms**: Minimize required fields, use autocomplete
- **Visual feedback**: Haptic feedback, clear success/error states
- **Offline support**: Queue actions when disconnected
- **Turkish default**: Auto-detect locale, remember preference

---

## 2. Accounting Team (Muhasebe)

### Profile

| Attribute | Details |
|-----------|---------|
| **Role Code** | `accounting` |
| **User Count** | 2-3 per company |
| **Primary Device** | Desktop (90%), Mobile (10%) |
| **Session Frequency** | Continuous during work hours |
| **Session Duration** | 30-60 minutes |
| **Technical Proficiency** | Intermediate - Excel proficient |
| **Language Preference** | Turkish (work), English (system) |

### Representative User: Ayşe

**Age**: 42  
**Education**: Bachelor's in Accounting  
**Experience**: 15 years in textile wholesale  
**Tech Comfort**: Expert in Excel, uses ERP systems

### Goals

1. **Primary**: Process customer orders accurately and quickly
2. **Secondary**: Maintain accurate catalog and pricing
3. **Tertiary**: Generate reports for management

### Frustrations

| Pain Point | Impact | Current Workaround |
|------------|--------|-------------------|
| Re-typing orders from emails | Time waste, errors | Copy-paste, manual verification |
| Finding lot availability | Customer waits on hold | Multiple system lookups |
| Matching invoices to shipments | Reconciliation delays | Manual spreadsheet tracking |
| No batch operations | Repetitive clicking | Workarounds in Excel |
| Missing reservation alerts | Overcommitted stock | Personal reminder system |

### Daily Workflow

```
09:00 - Review overnight orders from email/WhatsApp
09:30 - Enter orders into system, check stock availability
11:00 - Process reservation conversions
12:00 - Coordinate with warehouse on urgent dispatches
14:00 - Catalog maintenance, supplier updates
15:00 - Generate invoices, update records
16:30 - Prepare daily reports for management
```

### Key Workflows

| Workflow | Frequency | Priority |
|----------|-----------|----------|
| Order Entry | 10-30x/day | Critical |
| Reservation Management | 5-15x/day | Critical |
| Catalog Updates | 2-5x/day | High |
| Invoice Processing | 10-20x/day | High |
| Report Generation | 1-3x/day | Medium |

### Feature Prioritization

| Feature | Importance | Notes |
|---------|------------|-------|
| Keyboard navigation | ⭐⭐⭐⭐⭐ | Essential for speed |
| Bulk operations | ⭐⭐⭐⭐⭐ | Critical for efficiency |
| Excel export | ⭐⭐⭐⭐⭐ | Required for integration |
| AI order extraction | ⭐⭐⭐⭐ | Huge time saver |
| Advanced search | ⭐⭐⭐⭐ | Finding records quickly |
| Inline editing | ⭐⭐⭐ | Nice to have |

### Design Implications

- **Dense data views**: Maximize information per screen
- **Keyboard shortcuts**: Tab navigation, hotkeys for common actions
- **Batch selection**: Multi-select with bulk actions
- **Excel compatibility**: Export formats match accounting needs
- **Quick search**: Global search with filters
- **Autocomplete**: Smart suggestions for quality/color/customer

---

## 3. Senior Manager (Üst Düzey Yönetici)

### Profile

| Attribute | Details |
|-----------|---------|
| **Role Code** | `senior_manager` |
| **User Count** | 1-2 per company |
| **Primary Device** | Desktop (60%), Mobile (40%) |
| **Session Frequency** | 3-5x per day |
| **Session Duration** | 5-15 minutes |
| **Technical Proficiency** | Intermediate |
| **Language Preference** | English (reports), Turkish (communication) |

### Representative User: Ahmet Bey

**Age**: 55  
**Education**: MBA  
**Experience**: 25 years in textile industry, 10 as owner  
**Tech Comfort**: Uses iPad, basic computer skills

### Goals

1. **Primary**: Monitor business health at a glance
2. **Secondary**: Approve critical operations
3. **Tertiary**: Plan purchasing and production

### Frustrations

| Pain Point | Impact | Current Workaround |
|------------|--------|-------------------|
| No dashboard visibility | Asks staff for updates | Daily meetings |
| Approval bottlenecks | Delays when traveling | Phone calls to office |
| Stockout surprises | Lost sales, angry customers | Reactive purchasing |
| Inconsistent reports | Time wasted reconciling | Manual data gathering |
| No mobile approvals | Must wait for office | Delays decisions |

### Daily Workflow

```
08:00 - Review dashboard on iPad at breakfast
09:30 - Approve pending orders and reservations
11:00 - Review forecast alerts and recommendations
14:00 - Check manufacturing order status
16:00 - Approve catalog changes
17:00 - Review audit logs for unusual activity
```

### Key Workflows

| Workflow | Frequency | Priority |
|----------|-----------|----------|
| Dashboard Review | 3-5x/day | Critical |
| Approval Processing | 5-10x/day | Critical |
| Forecast Review | 1x/day | High |
| Report Consumption | 1-2x/day | High |
| Audit Review | 1x/week | Medium |

### Feature Prioritization

| Feature | Importance | Notes |
|---------|------------|-------|
| Executive dashboard | ⭐⭐⭐⭐⭐ | Essential |
| Mobile approvals | ⭐⭐⭐⭐⭐ | Essential |
| Email notifications | ⭐⭐⭐⭐ | Stay informed |
| Forecasting | ⭐⭐⭐⭐ | Strategic planning |
| Audit trail | ⭐⭐⭐ | Governance |
| Advanced analytics | ⭐⭐⭐ | Future need |

### Design Implications

- **Dashboard-first**: Landing page shows KPIs and alerts
- **Approval actions**: One-tap approve/reject with notes
- **Notification digest**: Email summary of pending items
- **Chart visualizations**: Trends and comparisons
- **Drill-down**: Click metrics to see details
- **Mobile-friendly approvals**: Works well on iPad

---

## 4. System Administrator (Sistem Yöneticisi)

### Profile

| Attribute | Details |
|-----------|---------|
| **Role Code** | `admin` |
| **User Count** | 1 per company |
| **Primary Device** | Desktop (95%), Mobile (5%) |
| **Session Frequency** | 1-2x per week (routine), more during setup |
| **Session Duration** | 15-60 minutes |
| **Technical Proficiency** | High |
| **Language Preference** | English (technical), Turkish (UI) |

### Representative User: Emre

**Age**: 30  
**Education**: Computer Science degree  
**Experience**: 5 years IT support, 2 years at company  
**Tech Comfort**: Very comfortable, manages all company systems

### Goals

1. **Primary**: Maintain system security and user access
2. **Secondary**: Configure system to match business processes
3. **Tertiary**: Troubleshoot issues for other users

### Frustrations

| Pain Point | Impact | Current Workaround |
|------------|--------|-------------------|
| No user activity logs | Can't diagnose issues | Asks users what happened |
| Complex permission setup | Errors in access | Overly permissive defaults |
| No test mode | Risk of production errors | Separate test account |
| Missing email debugging | Can't verify delivery | Check Resend dashboard |
| No bulk user management | Slow onboarding | Manual one-by-one |

### Daily Workflow

```
Monday: Review audit logs, check for anomalies
        User access reviews, permission updates
Wednesday: Email template updates if needed
           System health check
Friday: Onboard/offboard users as needed
        Review and clean up old drafts
```

### Key Workflows

| Workflow | Frequency | Priority |
|----------|-----------|----------|
| User Management | 1-2x/week | Critical |
| Permission Configuration | 1-2x/month | High |
| Audit Log Review | Weekly | High |
| Email Template Management | Monthly | Medium |
| System Settings | As needed | Medium |

### Feature Prioritization

| Feature | Importance | Notes |
|---------|------------|-------|
| User CRUD | ⭐⭐⭐⭐⭐ | Essential |
| Permission matrix | ⭐⭐⭐⭐⭐ | Essential |
| Audit logs | ⭐⭐⭐⭐⭐ | Essential |
| View As Role | ⭐⭐⭐⭐ | Testing feature |
| Email testing | ⭐⭐⭐⭐ | Verify configuration |
| Bulk operations | ⭐⭐⭐ | Efficiency |

### Design Implications

- **Detailed logs**: Full audit trail with filters
- **Permission visualization**: Matrix view of role×permission
- **User lifecycle**: Invite, activate, deactivate, delete
- **View As Role**: Test other roles without logout
- **Email testing**: Send test emails with preview
- **IP whitelist**: Security for admin operations

---

## 5. Persona Comparison Matrix

### Feature Importance by Role

| Feature | Warehouse | Accounting | Manager | Admin |
|---------|:---------:|:----------:|:-------:|:-----:|
| Mobile-first | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Keyboard shortcuts | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Dashboard | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Bulk operations | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Approvals | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Audit logs | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| QR/Camera | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐ |
| Reports | ⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Forecasting | ⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |

### Device Usage Pattern

| Metric | Warehouse | Accounting | Manager | Admin |
|--------|:---------:|:----------:|:-------:|:-----:|
| Desktop | 30% | 90% | 60% | 95% |
| Mobile | 70% | 10% | 40% | 5% |
| Peak Hours | 7-17 | 9-18 | 8-12, 16-18 | Varies |
| Session Length | 2-10 min | 30-60 min | 5-15 min | 15-60 min |

### Permission Summary

| Permission | Warehouse | Accounting | Manager | Admin |
|------------|:---------:|:----------:|:-------:|:-----:|
| Inventory View | ✅ | ✅ | ✅ | ✅ |
| Inventory Edit | ✅ | ❌ | ✅ | ✅ |
| Orders Create | ✅ | ✅ | ✅ | ✅ |
| Orders Approve | ❌ | ❌ | ✅ | ✅ |
| Catalog Edit | ❌ | ✅ | ✅ | ✅ |
| Catalog Approve | ❌ | ❌ | ✅ | ✅ |
| Manufacturing | ❌ | ✅ | ✅ | ✅ |
| Forecasting | ❌ | ❌ | ✅ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ |
| Settings | ❌ | ❌ | ❌ | ✅ |

---

## 6. Design Guidelines Summary

### Universal Guidelines

1. **Turkish First**: Default to Turkish, remember language preference
2. **Responsive Design**: All features work on all devices (with appropriate UX)
3. **Accessibility**: WCAG 2.1 AA compliance minimum
4. **Error Handling**: Clear, actionable error messages
5. **Loading States**: Skeleton loaders for data, disabled buttons during actions

### Role-Specific Guidelines

| Role | Primary Focus | Secondary Focus |
|------|---------------|-----------------|
| Warehouse | Speed, simplicity | Offline capability |
| Accounting | Efficiency, accuracy | Keyboard navigation |
| Manager | Visibility, control | Mobile approval |
| Admin | Security, configuration | Audit capability |

---

## 7. Research Notes

### User Interview Insights

1. **Warehouse staff** prefer Turkish and get frustrated with English-only systems
2. **Accounting team** spends 30% of time re-entering data from emails
3. **Managers** want to approve from phone when traveling
4. **All users** want faster page loads on mobile

### Behavioral Observations

1. Warehouse staff keep paper backup when system is slow
2. Accounting creates personal Excel sheets for quick reference
3. Managers check WhatsApp more than email
4. Admin relies on developer for complex troubleshooting

### Improvement Opportunities

1. Progressive Web App for offline warehouse operations
2. AI extraction eliminates 80% of order re-entry
3. Push notifications for urgent approvals
4. Self-service admin tools reduce developer dependency
