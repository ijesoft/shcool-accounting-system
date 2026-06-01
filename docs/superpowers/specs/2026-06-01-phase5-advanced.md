# Phase 5: Fixed Assets & Bank Reconciliation — Design Specification

**Date:** 2026-06-01
**Status:** Approved
**Version:** 1.0

---

## 1. Scope

Phase 5 implements the last two operational modules from the main design spec:

1. **Fixed Assets** — asset register, straight-line depreciation engine, disposal workflow
2. **Bank Reconciliation** — statement upload (CSV), transaction matching, adjustments

### Decisions Made During Brainstorming

| Decision | Choice |
|----------|--------|
| Depreciation method | Straight-Line only |
| Statement upload | CSV only |
| Scope | Full: services + API + UI pages |

---

## 2. Fixed Assets

### 2.1 Tables (already in `entity-schema.ts`)

- `fixed_asset` — asset code, name, category, cost, life years, salvage value, accumulated depreciation, status, disposal info
- `depreciation_entry` — period-specific depreciation amounts, linked to JE

### 2.2 Service: `src/services/fixed-asset.service.ts`

```
- list(entityId, opts)        → paginated asset list
- getById(entityId, id)        → asset detail + cumulative depreciation
- create(entityId, data)       → capitalize asset
- update(entityId, id, data)   → edit if active, not disposed
- depreciate(entityId, assetId, fiscalPeriodId) → compute & post SL depreciation
- dispose(entityId, assetId, date, amount)      → create disposal JE
```

**Depreciation Logic (Straight-Line):**
```
monthlyDep = (acquisition_cost - salvage_value) / (estimated_life_years * 12)
```
- Skip if `accumulated_depreciation >= (acquisition_cost - salvage_value)`
- Skip if already depreciated for this `fiscal_period_id` (unique constraint)
- Creates JE: `Dr. Depreciation Expense (51400) / Cr. Accum. Depreciation (12130 or 12150)`
- Updates `fixed_asset.accumulated_depreciation`
- Sets status to `fully_depreciated` when fully depreciated

**Disposal JE:**
- Dr. Accumulated Depreciation (remove accumulated dep)
- Dr. Loss on Disposal (if book value > disposal amount)
- Cr. Fixed Asset (original cost)
- Cr. Gain on Disposal (if disposal amount > book value)

### 2.3 API Routes: `/api/v1/fixed-assets/`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List assets (paginated) |
| POST | `/` | Capitalize asset |
| GET | `/[id]` | Asset detail |
| PATCH | `/[id]` | Update asset |
| POST | `/[id]/depreciate` | Run depreciation for period |
| POST | `/[id]/dispose` | Dispose asset |

### 2.4 UI Pages: `src/app/(dashboard)/fixed-assets/`

- `page.tsx` — Table: asset code, name, category, cost, NBV, status. Action buttons: Depreciate, Dispose
- `[id]/page.tsx` — Detail card + depreciation schedule table + action buttons
- `new/page.tsx` — Form: asset code, name, category (dropdown), acquisition date, cost, life (years), salvage value

---

## 3. Bank Reconciliation

### 3.1 Tables (already in `entity-schema.ts`)

- `bank_account` — bank name, account number, type (checking/savings/time_deposit), linked to CoA
- `bank_reconciliation` — statement date, statement balance, book balance, status
- `reconciliation_item` — type (deposit_in_transit, outstanding_check, bank_error, book_error, bank_charge, interest, nsf), reference, amount, cleared flag

### 3.2 Service: `src/services/bank-reconciliation.service.ts`

```
- listBankAccounts(entityId)                     → active bank accounts
- createBankAccount(entityId, data)              → register bank account
- list(entityId)                                 → reconciliation history
- start(entityId, data)                          → create new reconciliation
- getById(entityId, id)                          → detail with items
- uploadStatement(entityId, bankAccountId, csv)  → parse CSV, create items
- addItem(entityId, reconciliationId, data)      → manually add item
- reconcile(entityId, id)                        → confirm + create adjusting JEs
- getSuggestedMatches(entityId, id)              → match book vs bank items
```

**Reconciliation Logic:**
- Opening balance (book) = previous reconciliation's book ending balance
- Statement ending balance must match: book ending balance + outstanding deposits - outstanding checks +/- adjustments
- Auto-create JE for: bank charges, interest, NSF checks, book errors
- Manual items: deposit_in_transit, outstanding_check (no JE needed)

### 3.3 CSV Parser

Basic format (no bank-specific adapters in Phase 5):
| Date | Description | Debit | Credit | Reference |
Columns can be in any order — first row defines mapping.

### 3.4 API Routes: `/api/v1/bank-reconciliation/`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/bank-accounts` | List bank accounts |
| POST | `/bank-accounts` | Create bank account |
| GET | `/` | List reconciliations |
| POST | `/` | Start new reconciliation |
| GET | `/[id]` | Detail with items |
| POST | `/[id]/items` | Add item |
| POST | `/[id]/upload` | Upload CSV statement |
| POST | `/[id]/reconcile` | Confirm reconciliation |

### 3.5 UI Pages: `src/app/(dashboard)/bank-reconciliation/`

- `page.tsx` — Bank accounts table + reconciliation history table. Link to create new
- `[id]/page.tsx` — Detail: statement info, items table (cleared/uncleared), match suggestions, reconcile button
- `new/page.tsx` — Form: select bank account, statement date, statement balance, book balance, CSV file upload

---

## 4. Cross-Cutting

### 4.1 RBAC (update `src/lib/auth/rbac.ts`)

Add resources `fixed_assets` and `bank_reconciliation` with actions:
- `super_admin`: all actions
- `accountant`: all actions
- `finance_officer`: read, create
- `auditor`: read only
- `cashier`: none

### 4.2 NavLinks (update `src/components/dashboard/nav-links.tsx`)

Add Fixed Assets and Bank Reconciliation links below Vendor Accounts.

---

## 5. Files to Create/Modify

### New Files (~16)
| File | Purpose |
|------|---------|
| `src/services/fixed-asset.service.ts` | FA service |
| `src/services/bank-reconciliation.service.ts` | BR service |
| `src/app/api/v1/fixed-assets/route.ts` | FA list/create |
| `src/app/api/v1/fixed-assets/[id]/route.ts` | FA get/update |
| `src/app/api/v1/fixed-assets/[id]/depreciate/route.ts` | FA depreciate |
| `src/app/api/v1/fixed-assets/[id]/dispose/route.ts` | FA dispose |
| `src/app/api/v1/bank-reconciliation/route.ts` | BR list/create |
| `src/app/api/v1/bank-reconciliation/[id]/route.ts` | BR detail |
| `src/app/api/v1/bank-reconciliation/[id]/items/route.ts` | BR add item |
| `src/app/api/v1/bank-reconciliation/[id]/upload/route.ts` | BR CSV upload |
| `src/app/api/v1/bank-reconciliation/[id]/reconcile/route.ts` | BR reconcile |
| `src/app/api/v1/bank-accounts/route.ts` | Bank account list/create |
| `src/app/(dashboard)/fixed-assets/page.tsx` | FA list |
| `src/app/(dashboard)/fixed-assets/new/page.tsx` | FA create |
| `src/app/(dashboard)/fixed-assets/[id]/page.tsx` | FA detail |
| `src/app/(dashboard)/bank-reconciliation/page.tsx` | BR list |
| `src/app/(dashboard)/bank-reconciliation/new/page.tsx` | BR create |
| `src/app/(dashboard)/bank-reconciliation/[id]/page.tsx` | BR detail |

### Modified Files (2)
| File | Change |
|------|--------|
| `src/lib/auth/rbac.ts` | Add FA + BR permissions |
| `src/components/dashboard/nav-links.tsx` | Add FA + BR links |

---

## 6. Dependencies & Risks

- Depreciation Engine: needs `general_ledger` repository for posting (reuse from Phase 2)
- Bank Reconciliation: CSV parser is basic — bank-specific adapters deferred to post-launch
- No new `number_series` types needed (FA uses JE series for depreciation entries)
- All tables already exist in `entity-schema.ts` — no migration needed
