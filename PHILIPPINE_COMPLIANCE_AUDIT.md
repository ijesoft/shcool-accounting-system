# Philippine Compliance Audit — School Accounting System
**Date:** 2026-06-02  
**Overall Score: 68 / 100**

The system has a solid double-entry foundation but has critical compliance gaps against Philippine regulations (BIR, SSS/PhilHealth, PFRS).

---

## Module Scorecard

| # | Module | Score | Status |
|---|--------|-------|--------|
| 1 | Core General Ledger | 9/10 | Excellent |
| 2 | BIR Compliance | 4/10 | Critical gaps |
| 3 | Payroll (DOLE/SSS/PhilHealth/Pag-IBIG) | 5/10 | Outdated tables |
| 4 | School-Specific (DepEd/CHED) | 5/10 | Missing key reports |
| 5 | Financial Reporting (PFRS) | 7/10 | Incomplete notes |
| 6 | Audit Trail | 8/10 | Good |
| 7 | Cash Management | 8/10 | Good |
| 8 | Fixed Assets (PAS 16) | 7/10 | Minor gaps |
| 9 | Access Control / RBAC | 7/10 | Needs MFA |
| 10 | UI/UX & Usability | 5/10 | Functional but bare |

---

## CRITICAL Issues

### 1. SSS Contribution Table is Outdated
File: src/lib/accounting/payroll-engine.ts

Current table shows max employee share of PHP 555 / employer PHP 600. Under R.A. 11199 the correct 2024 values are:
- 2024: 14% total, Max MSC PHP 30,000, employee PHP 1,350, employer PHP 2,850
- 2025: 15% total, Max MSC PHP 35,000, employee PHP 1,750, employer PHP 3,500

### 2. PhilHealth 2025 Rate Not Applied
File: src/lib/accounting/payroll-engine.ts

PhilHealth Circular 2024-0004 mandates 5% beginning January 2025.
- Salary floor: PHP 10,000, min PHP 500 per side
- Salary ceiling: PHP 100,000, max PHP 2,500 per side

### 3. BIR Filing Forms Missing

| Required Form | Purpose | Status |
|--------------|---------|--------|
| BIR Form 2307 | Certificate of Creditable Tax Withheld | Missing |
| BIR Form 2316 | Annual compensation certificate per employee | Missing |
| BIR Form 1601-EQ | Quarterly EWT return | Missing |
| BIR Form 2550Q | Quarterly VAT return | Missing |
| BIR Form 1702-RT | Annual Corporate ITR | Missing |
| SAWT | Summary Alphalist of Withholding Taxes | Missing |
| SLSP | Summary List of Sales and Purchases | Missing |
| Alphalist 1604-E/C/F | Annual alphalist of employees/payees | Missing |

### 4. 13th Month Pay Tax Exemption Not Applied
- PHP 90,000 exempt ceiling (TRAIN Law, R.A. 10963) is not computed
- De minimis benefits are not tracked or aggregated for 2316

---

## HIGH Priority Issues

### 5. DepEd/CHED Reports Missing

| Report | Regulatory Basis | Status |
|--------|-----------------|--------|
| Statement of Tuition and Other Fees (STOF) | CMO 03-2003 | Missing |
| 70/20/10 Fund Allocation Report | CMO 03-2003 | Missing |
| Annual Report on Tuition Fee Increases | CMO 03-2003 | Missing |
| CHED Financial Report | CHED requirements | Missing |
| School Year-based billing (June-March) | DepEd School Year | Calendar year only |

The 70/20/10 rule is critical: 70% of tuition increases go to personnel, 20% capital outlay, 10% student services.

### 6. Payroll Missing DOLE-Mandated Components
- Holiday pay (regular 100%, special non-working 30%)
- Overtime premium (OT 25%, night differential 10%)
- Service Incentive Leave (SIL) monetization per Labor Code Art. 95
- Night differential (10% of basic hourly rate, 10pm-6am)
- De minimis benefits tracker

### 7. PFRS Notes to FS Not Auto-Populated
afs-package.ts generates a notesTemplate with PLACEHOLDER markers. For SEC filing all notes must contain live figures.

---

## MEDIUM Priority Issues

### 8. No BIR CAS Permit Module
BIR Revenue Regulation 9-2009 requires a CAS permit number printed on all ORs and invoices.

### 9. VAT Classification Guard Missing
No guard prevents enabling VAT on tuition (VAT-exempt per NIRC Sec. 109(1)(H)).

### 10. Bank Reconciliation - No Stale Check Aging
Outstanding checks over 6 months should be flagged per BSP Circular 683.

---

## UI/UX Audit: 5/10

| Dimension | Score | Finding |
|-----------|-------|---------|
| Color palette | 3/10 | Default shadcn dark navy, no institutional identity |
| Print/PDF styles | 2/10 | No @media print styles |
| Dashboard home | 3/10 | Blank, no KPI cards or daily summaries |
| Mobile/responsive | 3/10 | flex h-screen sidebar breaks on mobile |
| Empty states | 3/10 | Likely blank tables with no guidance |

---

## What is Working Well

- Double-entry bookkeeping with debit/credit validation
- Multi-entity architecture with dynamic PostgreSQL schemas
- Journal entry approval workflow (multi-level)
- Bank reconciliation module
- Revenue recognition (term straight-line and immediate methods)
- Fixed asset depreciation (SL, declining balance, SYD)
- VAT engine with VAT-exempt/zero-rated/taxable classification
- eOPT invoice with BIR serial range tracking
- Audit log (audit.audit_log schema)
- AFS package structure (Balance Sheet, IS, CF, Changes in Equity)
- Budget vs Actual comparison
- AR Aging report
