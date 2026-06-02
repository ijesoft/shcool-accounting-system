# Implementation Plan — Philippine Compliance Upgrade
**Project:** shcool-accounting-system  
**Date:** 2026-06-02  
**Target:** Raise compliance score from 68/100 to 90+/100

---

## Phase 1 — Critical Payroll Corrections (Week 1)
*Legal risk: wrong deductions every payroll run*

### Task 1.1 — Rebuild SSS Contribution Table (2024)
**File:** `src/lib/accounting/payroll-engine.ts`
- Replace SSS_TABLE with R.A. 11199 2024 schedule
- Max MSC: PHP 30,000; Employee: PHP 1,350; Employer: PHP 2,850
- Add WISP column for MSC >= PHP 20,000 (1% each side)
- Add a `sssYear` parameter so table can be swapped annually
- Update unit tests in payroll-engine.test.ts

### Task 1.2 — Rebuild PhilHealth Contribution Table (2025)
**File:** `src/lib/accounting/payroll-engine.ts`
- Replace PHILHEALTH_TABLE with 5% rate (Circular 2024-0004)
- Floor: PHP 10,000 salary -> PHP 500 employee share
- Ceiling: PHP 100,000 salary -> PHP 2,500 employee share
- Update unit tests

### Task 1.3 — 13th Month Pay Tax Exemption (TRAIN Law)
**File:** `src/lib/accounting/payroll-engine.ts`
- Track cumulative 13th month + bonuses per employee per year
- Apply PHP 90,000 exempt ceiling before taxable income computation
- Store de minimis benefits per employee: rice (PHP 2,000/mo), clothing (PHP 6,000/yr), laundry (PHP 300/mo), medical (PHP 10,000/yr)
- Expose exemption breakdown in payslip data

### Task 1.4 — Holiday Pay and Overtime Components
**File:** `src/lib/accounting/payroll-engine.ts`
**New file:** `src/lib/accounting/leave-engine.ts`
- Regular holiday pay: 200% of daily rate (100% even if not worked)
- Special non-working holiday: 130% if worked, 100% if not (no work no pay rule)
- Overtime: basic rate x 125% (weekday), x 130% (rest day)
- Night differential: 10% of hourly rate for 10pm-6am hours
- SIL: 5 days/year monetization at daily rate for unused leaves

---

## Phase 2 — BIR Compliance Forms (Week 2)
*Legal risk: BIR penalties, inability to file returns*

### Task 2.1 — BIR Form 2307 Generator
**New file:** `src/lib/bir/form-2307.ts`
**New route:** `src/app/api/v1/bir/form-2307/route.ts`
- Query EWT deductions per payee per quarter
- Generate 2307 data structure: payee TIN, name, address, ATC code, amount, tax withheld
- Printable HTML template with BIR-standard layout
- Bulk generate for all vendors in a period

### Task 2.2 — BIR Form 2316 Generator
**New file:** `src/lib/bir/form-2316.ts`
**New route:** `src/app/api/v1/bir/form-2316/[employeeId]/route.ts`
- Annual certificate per employee
- Gross compensation income, non-taxable income, tax withheld
- De minimis benefits breakdown
- 13th month exemption applied
- Printable template matching BIR 2316 layout

### Task 2.3 — SAWT (Summary Alphalist of Withholding Taxes)
**New file:** `src/lib/bir/sawt.ts`
**New route:** `src/app/api/v1/bir/sawt/route.ts`
- Aggregate all 2307s issued per period
- Output CSV/Excel in BIR eBIRForms format
- Quarterly grouping with ATC code breakdown

### Task 2.4 — SLSP (Summary List of Sales and Purchases)
**New file:** `src/lib/bir/slsp.ts`
**New route:** `src/app/api/v1/bir/slsp/route.ts`
- Sales list: all ORs/invoices per quarter, grouped by buyer TIN
- Purchases list: all vendor invoices per quarter, grouped by seller TIN
- Output in BIR-required CSV format with headers

### Task 2.5 — BIR CAS Permit Field
**File:** `src/lib/entity-settings.ts`
- Add `casPermitNumber`, `casPermitDate`, `casRegistrationNumber` to EntitySettings
- Print CAS permit on all ORs and invoices

---

## Phase 3 — DepEd/CHED Compliance Reports (Week 3)
*Regulatory risk: CHED show-cause orders for non-compliant schools*

### Task 3.1 — 70/20/10 Fund Allocation Tracker
**New file:** `src/lib/accounting/fund-allocation.ts`
**New route:** `src/app/api/v1/reports/fund-allocation/route.ts`
**New page:** `src/app/(dashboard)/reports/fund-allocation/page.tsx`
- Tag accounts by fund type: Personnel (70%), Capital Outlay (20%), Student Services (10%)
- Add fund_type column to chart of accounts in entity schema
- Report: actual vs required allocation per SY, with variance
- Alert if any fund falls below required percentage

### Task 3.2 — STOF (Statement of Tuition and Other Fees)
**New file:** `src/lib/accounting/stof.ts`
**New page:** `src/app/(dashboard)/reports/stof/page.tsx`
- Per-student breakdown: tuition, misc fees, lab fees, other fees per semester
- SY comparison (current vs prior year)
- Per-student summary for CHED submission

### Task 3.3 — School Year Fiscal Period Support
**File:** `src/lib/accounting/fiscal-calendar.ts`
**File:** `src/lib/entity-settings.ts`
- Add `fiscalYearType: 'calendar' | 'school_year'` to EntitySettings
- School year: June 1 - May 31 (or June - March for basic ed)
- Fiscal period labels: SY 2025-2026, 1st Sem, 2nd Sem, Summer
- Affect all reports to show SY label when school_year type is active

---

## Phase 4 — Financial Reporting (PFRS) (Week 4)
*Audit risk: unqualified opinion, SEC filing rejection*

### Task 4.1 — Auto-populated Notes to Financial Statements
**File:** `src/lib/accounting/afs-package.ts`
- Note 2 (Cash): query bank account balances, classify petty cash vs bank
- Note 3 (AR): pull AR aging buckets (current, 30, 60, 90+ days)
- Note 4 (PPE): generate schedule with cost, accum depreciation, NBV per asset class
- Note 5 (Loans Payable): list each loan with principal, interest rate, maturity
- Replace all PLACEHOLDER markers with live SQL queries

### Task 4.2 — Print CSS and PDF Export
**New file:** `src/app/globals.css` (add @media print section)
**New file:** `src/lib/pdf/print-layout.ts`
- @media print styles for all report pages
- Hide sidebar, action buttons, navigation on print
- Page breaks before each financial statement
- Letter/A4 page size with 1-inch margins
- OR/invoice print template with BIR-compliant layout

### Task 4.3 — Comparative Figures in Financial Statements
**File:** `src/lib/accounting/financial-statements.ts`
- All FS (Balance Sheet, IS, CF) must show current year vs prior year columns
- PFRS requires two-year comparatives for audited FS
- Update API routes to accept optional priorYear parameter

---

## Phase 5 — UI/UX Improvements (Week 5)
*Usability: cashiers and finance officers need a better experience*

### Task 5.1 — Dashboard KPI Home Page
**File:** `src/app/(dashboard)/page.tsx`
- Today's collections (sum of ORs posted today)
- AR aging summary widget (current/30/60/90+ days overdue)
- Unpaid vendor invoices total
- Payroll liabilities outstanding
- Quick action buttons: New OR, New JE, Post Payroll

### Task 5.2 — Institutional Color Palette
**File:** `src/app/globals.css`
- Replace default shadcn navy with deep blue-gold institutional palette
- --primary: 220 70% 30% (deep navy blue)
- --accent: 45 90% 50% (gold/amber for trust)
- --success: 142 76% 36% (green for posted/approved)
- --warning: 38 92% 50% (amber for pending)

### Task 5.3 — Responsive Sidebar
**File:** `src/components/dashboard/sidebar.tsx`
- Collapsible sidebar for tablet/mobile
- Hamburger menu toggle
- Overlay on mobile, push layout on tablet

### Task 5.4 — Print-Ready OR and Invoice Templates
**New components:** `src/components/print/OfficialReceiptPrint.tsx`, `InvoicePrint.tsx`
- BIR-compliant OR layout with school letterhead
- CAS permit number, BIR serial, accredited printer TIN
- Line items with VAT breakdown
- Print button on OR detail page

---

## Phase 6 — Security Hardening (Week 6)

### Task 6.1 — Session Security
**File:** `src/lib/auth/session.ts`
- Session timeout after 30 minutes of inactivity
- Single session per user (revoke older sessions on new login)
- Log all login/logout events to audit.audit_log

### Task 6.2 — Input Validation Hardening
**Files:** All API route handlers
- Add Zod schemas to all POST/PATCH routes that lack them
- Sanitize raw SQL inputs in entity-schema queries
- Rate limiting on login endpoint (max 5 attempts / 15 min)

### Task 6.3 — Sensitive Data Masking
- Mask TIN in UI (show XXX-XXX-XXX, reveal on click)
- Mask employee salary in list views (show asterisks)
- Restrict salary fields to super_admin and HR roles only

---

## Effort Estimates

| Phase | Tasks | Estimated Days | Priority |
|-------|-------|---------------|----------|
| Phase 1 — Payroll Corrections | 4 tasks | 3 days | CRITICAL |
| Phase 2 — BIR Forms | 5 tasks | 5 days | CRITICAL |
| Phase 3 — DepEd/CHED Reports | 3 tasks | 4 days | HIGH |
| Phase 4 — PFRS Reporting | 3 tasks | 4 days | HIGH |
| Phase 5 — UI/UX | 4 tasks | 3 days | MEDIUM |
| Phase 6 — Security | 3 tasks | 2 days | MEDIUM |
| **Total** | **22 tasks** | **~21 days** | |

---

## Compliance Score Projection

| After Phase | Expected Score | Key Unlock |
|-------------|---------------|------------|
| Phase 1 complete | 75/100 | Legal payroll deductions correct |
| Phase 2 complete | 82/100 | BIR filing capable |
| Phase 3 complete | 87/100 | CHED reporting compliant |
| Phase 4 complete | 91/100 | Audit-ready AFS |
| Phase 5 complete | 93/100 | Production-grade UX |
| Phase 6 complete | 95/100 | Security-hardened |
