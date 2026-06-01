# Phase 1: Foundation — Complete Prisma Schema + Security Fixes

## Overview

Complete the Prisma schema with all missing accounting models and fix critical security vulnerabilities in existing code.

## Scope

### In Scope
1. Complete Prisma schema with all accounting models
2. Fix SQL injection in financial statements
3. Replace manual transaction handling with `prisma.$transaction()`

### Out of Scope
- Approval workflow (Phase 2)
- Period closing controls (Phase 2)
- Depreciation engine (Phase 3)
- Official receipts numbering (Phase 4)
- Bank reconciliation matching (Phase 4)

---

## 1. Prisma Schema Design

### 1.1 Chart of Accounts

```prisma
model Account {
  id              String   @id @default(uuid())
  accountCode     String   @unique @map("account_code") @db.VarChar(20)
  accountName     String   @map("account_name") @db.VarChar(200)
  accountType     String   @map("account_type") @db.VarChar(30)
  normalBalance   String   @map("normal_balance") @db.VarChar(10)
  level           Int      // 1=Control, 2=Category, 3=Account, 4=Sub-account
  parentId        String?  @map("parent_id") @db.Uuid
  isActive        Boolean  @default(true) @map("is_active")
  isPostable      Boolean  @default(true) @map("is_postable")
  description     String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  parent    Account?   @relation("AccountHierarchy", fields: [parentId], references: [id])
  children  Account[]  @relation("AccountHierarchy")

  @@map("account")
}
```

Account types: `asset`, `liability`, `equity`, `revenue`, `expense`, `contra_asset`, `contra_liability`, `contra_revenue`
Normal balance: `debit`, `credit`

### 1.2 Number Series

```prisma
model NumberSeries {
  id           String   @id @default(uuid())
  seriesType   String   @unique @map("series_type") @db.VarChar(10)
  prefix       String   @db.VarChar(10)
  nextNumber   Int      @default(1) @map("next_number")
  createdAt    DateTime @default(now()) @map("created_at")

  @@map("number_series")
}
```

Series types: `JE` (journal entry), `CR` (cash receipt), `CD` (cash disbursement), `OR` (official receipt), `SI` (student invoice), `VB` (vendor bill), `FA` (fixed asset), `DR` (depreciation)

### 1.3 Journal Entry

```prisma
model JournalEntry {
  id             String    @id @default(uuid())
  entryNumber    String    @map("entry_number") @db.VarChar(30)
  entryDate      DateTime  @map("entry_date") @db.Date
  reference      String?   @db.VarChar(100)
  sourceModule   String    @map("source_module") @db.VarChar(50)
  description    String?   @db.Text
  status         String    @default("draft") @db.VarChar(20)
  fiscalPeriodId String?   @map("fiscal_period_id") @db.Uuid
  postedAt       DateTime? @map("posted_at")
  postedBy       String?   @map("posted_by") @db.Uuid
  createdBy      String    @map("created_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  lines         JournalEntryLine[]
  approvalLogs  ApprovalLog[]

  @@map("journal_entry")
}

model JournalEntryLine {
  id              String   @id @default(uuid())
  journalEntryId  String   @map("journal_entry_id") @db.Uuid
  accountId       String   @map("account_id") @db.Uuid
  debit           Decimal  @db.Decimal(18, 2)
  credit          Decimal  @db.Decimal(18, 2)
  lineDescription String?  @map("line_description") @db.VarChar(500)
  lineOrder       Int      @map("line_order")

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id])

  @@map("journal_entry_line")
}
```

Status flow: `draft` → `pending_approval` → `approved` → `posted` → `void`

### 1.4 General Ledger

```prisma
model GeneralLedger {
  id              String   @id @default(uuid())
  journalEntryId  String   @map("journal_entry_id") @db.Uuid
  accountId       String   @map("account_id") @db.Uuid
  postingDate     DateTime @map("posting_date") @db.Date
  debit           Decimal  @db.Decimal(18, 2)
  credit          Decimal  @db.Decimal(18, 2)
  runningBalance  Decimal  @map("running_balance") @db.Decimal(18, 2)
  description     String?  @db.VarChar(500)
  reference       String?  @db.VarChar(100)
  createdAt       DateTime @default(now()) @map("created_at")

  @@map("general_ledger")
}
```

### 1.5 Student Accounts Receivable

```prisma
model StudentInvoice {
  id              String   @id @default(uuid())
  invoiceNumber   String   @unique @map("invoice_number") @db.VarChar(30)
  studentId       String   @map("student_id") @db.VarChar(50)
  studentName     String   @map("student_name") @db.VarChar(200)
  issueDate       DateTime @map("issue_date") @db.Date
  dueDate         DateTime @map("due_date") @db.Date
  status          String   @default("unpaid") @db.VarChar(20)
  totalAmount     Decimal  @map("total_amount") @db.Decimal(18, 2)
  paidAmount      Decimal  @default(0) @map("paid_amount") @db.Decimal(18, 2)
  balance         Decimal  @db.Decimal(18, 2)
  remarks         String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  lines StudentInvoiceLine[]

  @@map("student_invoice")
}

model StudentInvoiceLine {
  id                String   @id @default(uuid())
  studentInvoiceId  String   @map("student_invoice_id") @db.Uuid
  description       String   @db.VarChar(200)
  quantity          Int      @default(1)
  unitPrice         Decimal  @map("unit_price") @db.Decimal(18, 2)
  amount            Decimal  @db.Decimal(18, 2)

  studentInvoice StudentInvoice @relation(fields: [studentInvoiceId], references: [id])

  @@map("student_invoice_line")
}
```

Status: `unpaid`, `partial`, `paid`, `void`

### 1.6 Vendor Accounts Payable

```prisma
model VendorBill {
  id              String   @id @default(uuid())
  billNumber      String   @unique @map("bill_number") @db.VarChar(30)
  vendorId        String   @map("vendor_id") @db.VarChar(50)
  vendorName      String   @map("vendor_name") @db.VarChar(200)
  billDate        DateTime @map("bill_date") @db.Date
  dueDate         DateTime @map("due_date") @db.Date
  status          String   @default("unpaid") @db.VarChar(20)
  totalAmount     Decimal  @map("total_amount") @db.Decimal(18, 2)
  paidAmount      Decimal  @default(0) @map("paid_amount") @db.Decimal(18, 2)
  balance         Decimal  @db.Decimal(18, 2)
  remarks         String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  lines VendorBillLine[]

  @@map("vendor_bill")
}

model VendorBillLine {
  id            String   @id @default(uuid())
  vendorBillId  String   @map("vendor_bill_id") @db.Uuid
  description   String   @db.VarChar(200)
  quantity      Int      @default(1)
  unitPrice     Decimal  @map("unit_price") @db.Decimal(18, 2)
  amount        Decimal  @db.Decimal(18, 2)

  vendorBill VendorBill @relation(fields: [vendorBillId], references: [id])

  @@map("vendor_bill_line")
}
```

### 1.7 Cash Receipts

```prisma
model CashReceipt {
  id               String   @id @default(uuid())
  receiptNumber    String   @unique @map("receipt_number") @db.VarChar(30)
  receiptDate      DateTime @map("receipt_date") @db.Date
  source           String   @db.VarChar(50)
  payeeName        String   @map("payee_name") @db.VarChar(200)
  paymentMethod    String   @map("payment_method") @db.VarChar(30)
  totalAmount      Decimal  @map("total_amount") @db.Decimal(18, 2)
  status           String   @default("posted") @db.VarChar(20)
  journalEntryId   String?  @map("journal_entry_id") @db.Uuid
  createdAt        DateTime @default(now()) @map("created_at")
  createdBy        String   @map("created_by") @db.Uuid

  lines CashReceiptLine[]

  @@map("cash_receipt")
}

model CashReceiptLine {
  id             String   @id @default(uuid())
  cashReceiptId  String   @map("cash_receipt_id") @db.Uuid
  description    String   @db.VarChar(200)
  amount         Decimal  @db.Decimal(18, 2)

  cashReceipt CashReceipt @relation(fields: [cashReceiptId], references: [id])

  @@map("cash_receipt_line")
}
```

### 1.8 Cash Disbursements

```prisma
model CashDisbursement {
  id                String   @id @default(uuid())
  disbursementNumber String  @unique @map("disbursement_number") @db.VarChar(30)
  disbursementDate  DateTime @map("disbursement_date") @db.Date
  payeeName         String   @map("payee_name") @db.VarChar(200)
  paymentMethod     String   @map("payment_method") @db.VarChar(30)
  totalAmount       Decimal  @map("total_amount") @db.Decimal(18, 2)
  status            String   @default("posted") @db.VarChar(20)
  journalEntryId    String?  @map("journal_entry_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at")
  createdBy         String   @map("created_by") @db.Uuid

  lines CashDisbursementLine[]

  @@map("cash_disbursement")
}

model CashDisbursementLine {
  id                 String   @id @default(uuid())
  cashDisbursementId String   @map("cash_disbursement_id") @db.Uuid
  description        String   @db.VarChar(200)
  amount             Decimal  @db.Decimal(18, 2)

  cashDisbursement CashDisbursement @relation(fields: [cashDisbursementId], references: [id])

  @@map("cash_disbursement_line")
}
```

### 1.9 Official Receipts

```prisma
model OfficialReceipt {
  id              String   @id @default(uuid())
  receiptNumber   String   @unique @map("receipt_number") @db.VarChar(30)
  receiptDate     DateTime @map("receipt_date") @db.Date
  issuedBy        String   @map("issued_by") @db.Uuid
  payeeName       String   @map("payee_name") @db.VarChar(200)
  totalAmount     Decimal  @map("total_amount") @db.Decimal(18, 2)
  status          String   @default("issued") @db.VarChar(20)
  createdAt       DateTime @default(now()) @map("created_at")

  lines OfficialReceiptLine[]

  @@map("official_receipt")
}

model OfficialReceiptLine {
  id               String   @id @default(uuid())
  officialReceiptId String  @map("official_receipt_id") @db.Uuid
  description      String   @db.VarChar(200)
  amount           Decimal  @db.Decimal(18, 2)

  officialReceipt OfficialReceipt @relation(fields: [officialReceiptId], references: [id])

  @@map("official_receipt_line")
}
```

### 1.10 Fixed Assets

```prisma
model FixedAsset {
  id                    String   @id @default(uuid())
  assetTag              String   @unique @map("asset_tag") @db.VarChar(30)
  description           String   @db.VarChar(500)
  category              String   @db.VarChar(100)
  acquisitionDate       DateTime @map("acquisition_date") @db.Date
  acquisitionCost       Decimal  @map("acquisition_cost") @db.Decimal(18, 2)
  usefulLife            Int      @map("useful_life") // in years
  salvageValue          Decimal  @default(0) @map("salvage_value") @db.Decimal(18, 2)
  depreciationMethod    String   @map("depreciation_method") @db.VarChar(30)
  accumulatedDepreciation Decimal @map("accumulated_depreciation") @default(0) @db.Decimal(18, 2)
  netBookValue          Decimal  @map("net_book_value") @db.Decimal(18, 2)
  status                String   @default("active") @db.VarChar(20)
  createdAt             DateTime @default(now()) @map("created_at")

  depreciationSchedules DepreciationSchedule[]

  @@map("fixed_asset")
}

model DepreciationSchedule {
  id              String   @id @default(uuid())
  fixedAssetId    String   @map("fixed_asset_id") @db.Uuid
  periodDate      DateTime @map("period_date") @db.Date
  depreciationAmount Decimal @map("depreciation_amount") @db.Decimal(18, 2)
  accumulatedDepreciation Decimal @map("accumulated_depreciation") @db.Decimal(18, 2)
  netBookValue    Decimal  @map("net_book_value") @db.Decimal(18, 2)
  journalEntryId  String?  @map("journal_entry_id") @db.Uuid

  fixedAsset FixedAsset @relation(fields: [fixedAssetId], references: [id])

  @@map("depreciation_schedule")
}
```

Depreciation methods: `straight_line`, `declining_balance`, `sum_of_years`

### 1.11 Bank Reconciliation

```prisma
model BankAccount {
  id              String   @id @default(uuid())
  accountName     String   @map("account_name") @db.VarChar(200)
  bankName        String   @map("bank_name") @db.VarChar(200)
  accountNumber   String   @map("account_number") @db.VarChar(50)
  openingBalance  Decimal  @default(0) @map("opening_balance") @db.Decimal(18, 2)
  currency        String   @default("PHP") @db.VarChar(10)
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")

  statementLines  BankStatementLine[]
  reconciliations BankReconciliation[]

  @@map("bank_account")
}

model BankStatementLine {
  id              String   @id @default(uuid())
  bankAccountId   String   @map("bank_account_id") @db.Uuid
  statementDate   DateTime @map("statement_date") @db.Date
  description     String   @db.VarChar(500)
  deposit         Decimal  @db.Decimal(18, 2)
  withdrawal      Decimal  @db.Decimal(18, 2)
  referenceNumber String?  @map("reference_number") @db.VarChar(100)
  isReconciled    Boolean  @default(false) @map("is_reconciled")
  reconciliationItemId String? @map("reconciliation_item_id") @db.Uuid

  bankAccount BankAccount @relation(fields: [bankAccountId], references: [id])

  @@map("bank_statement_line")
}

model BankReconciliation {
  id              String   @id @default(uuid())
  bankAccountId   String   @map("bank_account_id") @db.Uuid
  reconciliationDate DateTime @map("reconciliation_date") @db.Date
  bankBalance     Decimal  @map("bank_balance") @db.Decimal(18, 2)
  bookBalance     Decimal  @map("book_balance") @db.Decimal(18, 2)
  reconciledBalance Decimal @map("reconciled_balance") @db.Decimal(18, 2)
  isBalanced      Boolean  @default(false) @map("is_balanced")
  remarks         String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  bankAccount BankAccount @relation(fields: [bankAccountId], references: [id])
  items       BankReconciliationItem[]

  @@map("bank_reconciliation")
}

model BankReconciliationItem {
  id                     String   @id @default(uuid())
  bankReconciliationId   String   @map("bank_reconciliation_id") @db.Uuid
  type                   String   @db.VarChar(30) // "deposit_in_transit", "outstanding_check", "bank_charge", "interest", "error"
  description            String   @db.VarChar(500)
  amount                 Decimal  @db.Decimal(18, 2)
  referenceNumber        String?  @map("reference_number") @db.VarChar(100)

  bankReconciliation BankReconciliation @relation(fields: [bankReconciliationId], references: [id])

  @@map("bank_reconciliation_item")
}
```

### 1.12 Approval Workflow

```prisma
model ApprovalRule {
  id             String   @id @default(uuid())
  level          Int      // 1, 2, 3...
  minAmount      Decimal  @map("min_amount") @db.Decimal(18, 2)
  maxAmount      Decimal? @map("max_amount") @db.Decimal(18, 2)
  approverRoleId String   @map("approver_role_id") @db.Uuid
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")

  approverRole Role @relation(fields: [approverRoleId], references: [id])

  @@map("approval_rule")
}

model ApprovalLog {
  id              String   @id @default(uuid())
  journalEntryId  String   @map("journal_entry_id") @db.Uuid
  level           Int
  approverId      String   @map("approver_id") @db.Uuid
  action          String   @db.VarChar(20) // "approved", "rejected"
  remarks         String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id])

  @@map("approval_log")
}
```

### 1.13 Schema Placement Strategy

All accounting models (Account through BankReconciliationItem) will be placed in the entity's schema. The existing `@@schema("public")` on models like `Account` needs to be removed — instead, the schema is determined at runtime via the entity's `schemaName` field.

Models that stay in `public`: `Entity`, `FiscalYear`, `FiscalPeriod`, `Role`, `Permission`, `RolePermission`, `User`
Models that stay in `audit`: `AuditLog`

### 1.14 Multi-Schema Implementation

Since Prisma doesn't natively support per-tenant schemas with a single schema file, the approach is:
- Define all models in the Prisma schema without `@@schema` directives (defaults to public)
- Use raw SQL migrations to create tables in the correct schema
- Use `prisma.$queryRawUnsafe` with schema-qualified table names in repositories (existing pattern)
- The `entity.repository.ts` creates schemas dynamically

---

## 2. Security Fixes

### 2.1 SQL Injection in Financial Statements

**File**: `src/lib/accounting/financial-statements.ts`

**Current code (lines 7-8)**:
```typescript
const whereClause = fiscalPeriodId
  ? `WHERE je.status = 'posted' AND je.fiscal_period_id = '${fiscalPeriodId}'`
  : `WHERE je.status = 'posted'`
```

**Fix**: Parameterize the query:
```typescript
const baseQuery = `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id`

if (fiscalPeriodId) {
  return prisma.$queryRawUnsafe<any[]>(
    `${baseQuery} WHERE je.status = 'posted' AND je.fiscal_period_id = $1 GROUP BY ...`,
    fiscalPeriodId
  )
}
return prisma.$queryRawUnsafe<any[]>(
  `${baseQuery} WHERE je.status = 'posted' GROUP BY ...`
)
```

### 2.2 Transaction Handling in Posting Engine

**File**: `src/lib/accounting/posting-engine.ts`

**Current code (lines 90-119)**:
```typescript
await prisma.$executeRawUnsafe(`BEGIN`)
// ... operations
await prisma.$executeRawUnsafe(`COMMIT`)
// ...
await prisma.$executeRawUnsafe(`ROLLBACK`)
```

**Fix**: Replace with `prisma.$transaction()`:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // Update journal entry status
  await tx.$executeRawUnsafe(/* ... */)
  // Update GL running balances
  for (const line of lines) {
    // ...
  }
})
```

### 2.3 Additional SQL Injection Points

Review all `$queryRawUnsafe` calls across the codebase for string interpolation. Any user-controlled value being interpolated into SQL must be parameterized.

---

## 3. Data Types

All monetary values use `Decimal(18, 2)` — NOT `Float` or `Double` — to prevent floating-point precision issues in financial calculations.

---

## 4. Migration Strategy

1. Write complete Prisma schema
2. Generate migration SQL manually (since multi-schema is not fully supported by Prisma Migrate)
3. Apply migrations via raw SQL scripts
4. Verify schema matches expected structure
5. Fix security issues in existing code
6. Run tests

---

## 5. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Prisma Migrate doesn't support multi-schema well | Use raw SQL for schema creation, Prisma only for type generation |
| Decimal precision issues | Use Decimal(18,2) everywhere, never Float |
| Breaking existing API routes | Maintain backward compatibility in repository interfaces |
| Data loss during migration | Run migration in transaction, backup before applying |
