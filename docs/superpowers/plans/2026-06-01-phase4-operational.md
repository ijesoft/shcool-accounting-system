# Phase 4: Operational Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Student Accounts (AR), Vendor Accounts (AP), Cash Receipts / Official Receipts, and Cash Disbursements modules — the day-to-day operational workflows.

**Architecture:** Each module follows the existing pattern: service layer (`src/services/`) with business logic, API routes (`src/app/api/v1/`) with RBAC auth, and server-rendered UI pages (`src/app/(dashboard)/`). All accounting data lives in per-entity schemas accessed via raw SQL. Workflows that create journal entries (CR, CD) delegate to the posting engine.

**Tech Stack:** Next.js 14 Server Components, raw SQL for per-entity queries, existing posting-engine.ts and audit-log.ts.

---

## File Structure

**Modified:**
- `src/lib/entity-schema.ts` — add `vendor_account` and `vendor_invoice` tables

**New services:**
- `src/services/student-account.service.ts`
- `src/services/vendor-account.service.ts`
- `src/services/cash-receipts.service.ts`
- `src/services/cash-disbursements.service.ts`

**New API routes:**
- `src/app/api/v1/student-accounts/route.ts`
- `src/app/api/v1/student-accounts/[id]/route.ts`
- `src/app/api/v1/student-accounts/[id]/invoices/route.ts`
- `src/app/api/v1/student-accounts/[id]/payments/route.ts`
- `src/app/api/v1/vendor-accounts/route.ts`
- `src/app/api/v1/vendor-accounts/[id]/route.ts`
- `src/app/api/v1/vendor-accounts/[id]/invoices/route.ts`
- `src/app/api/v1/cash-receipts/route.ts`
- `src/app/api/v1/cash-receipts/[id]/route.ts`
- `src/app/api/v1/cash-receipts/[id]/post/route.ts`
- `src/app/api/v1/cash-disbursements/route.ts`
- `src/app/api/v1/cash-disbursements/[id]/route.ts`
- `src/app/api/v1/cash-disbursements/[id]/post/route.ts`
- `src/app/api/v1/official-receipts/route.ts`
- `src/app/api/v1/official-receipts/[id]/route.ts`
- `src/app/api/v1/official-receipts/[id]/void/route.ts`

**New UI pages:**
- `src/app/(dashboard)/student-accounts/page.tsx`
- `src/app/(dashboard)/student-accounts/[id]/page.tsx`
- `src/app/(dashboard)/cash-receipts/page.tsx`
- `src/app/(dashboard)/cash-receipts/new/page.tsx`
- `src/app/(dashboard)/cash-disbursements/page.tsx`
- `src/app/(dashboard)/cash-disbursements/new/page.tsx`
- `src/app/(dashboard)/official-receipts/page.tsx`
- `src/app/(dashboard)/official-receipts/[id]/page.tsx`
- `src/app/(dashboard)/vendor-accounts/page.tsx`

---

### Task 1: Add Vendor Tables to Entity Schema

**Files:**
- Modify: `src/lib/entity-schema.ts`

- [ ] **Step 1: Add vendor_account and vendor_invoice tables**

Read `src/lib/entity-schema.ts`. Find the `disbursement` table creation block (around line 166). After the disbursement table and before the fixed_asset table, add:

```sql
CREATE TABLE IF NOT EXISTS "${schemaName}".vendor_account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code VARCHAR(30) NOT NULL UNIQUE,
  vendor_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(200),
  address TEXT,
  tin VARCHAR(20),
  contact_number VARCHAR(50),
  email VARCHAR(100),
  payment_terms VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "${schemaName}".vendor_invoice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(30) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES "${schemaName}".vendor_account(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  balance DECIMAL(18,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('unpaid','partial','paid','cancelled')),
  journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Also add an `OR` series to the number_series seed insert:
Edit the number_series INSERT to include `('AP', 'AP', 1, 1)`:

```sql
INSERT INTO "${schemaName}".number_series (series_type, prefix, starting_number, next_number) VALUES
  ('JE', 'JE', 1, 1),
  ('OR', 'OR', 1, 1),
  ('CV', 'CV', 1, 1),
  ('CD', 'CD', 1, 1);
```

(e.g., add `('CD', 'CD', 1, 1)` line — note: `CD` is already in the series_type CHECK constraint)

Verify: `npx tsc --noEmit` passes.

---

### Task 2: Student Account Service

**Files:**
- Create: `src/services/student-account.service.ts`

- [ ] **Step 1: Create student account service**

```ts
import { prisma } from "@/lib/db"

export const studentAccountService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT s.*, 
        COALESCE((SELECT SUM(balance) FROM "${entitySchema}".student_invoice WHERE student_id = s.id AND status IN ('unpaid','partial')), 0) as total_balance
       FROM "${entitySchema}".student s
       ORDER BY s.full_name`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".student WHERE id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, data: { studentNumber: string; fullName: string; course?: string; gradeLevel?: string; status: string }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".student (student_number, full_name, course, grade_level, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      data.studentNumber, data.fullName, data.course || null, data.gradeLevel || null, data.status
    ).then(r => r[0])
  },

  async update(entitySchema: string, id: string, data: { fullName?: string; course?: string; gradeLevel?: string; status?: string }) {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (data.fullName !== undefined) { sets.push(`full_name = $${i}`); vals.push(data.fullName); i++ }
    if (data.course !== undefined) { sets.push(`course = $${i}`); vals.push(data.course); i++ }
    if (data.gradeLevel !== undefined) { sets.push(`grade_level = $${i}`); vals.push(data.gradeLevel); i++ }
    if (data.status !== undefined) { sets.push(`status = $${i}`); vals.push(data.status); i++ }
    vals.push(id)
    return prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".student SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      ...vals
    ).then(r => r[0])
  },

  async getInvoices(entitySchema: string, studentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT si.*, 
        (SELECT COALESCE(JSON_AGG(json_build_object('fee_type', sil.fee_type, 'amount', sil.amount, 'discount_type', sil.discount_type, 'discount_amount', sil.discount_amount)), '[]'::json)
         FROM "${entitySchema}".student_invoice_line sil WHERE sil.invoice_id = si.id) as lines
       FROM "${entitySchema}".student_invoice si
       WHERE si.student_id = $1
       ORDER BY si.invoice_date DESC`,
      studentId
    )
  },

  async createInvoice(entitySchema: string, data: {
    studentId: string; invoiceDate: string; dueDate: string; totalAmount: number; term?: string
    lines: { feeType: string; amount: number; discountType?: string; discountAmount?: number }[]
  }) {
    const invRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".student_invoice (invoice_number, student_id, term, invoice_date, due_date, total_amount, balance)
       VALUES (
         (SELECT CONCAT('INV-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".student_invoice),
         $1, $2, $3::date, $4::date, $5, $5
       ) RETURNING *`,
      data.studentId, data.term || null, data.invoiceDate, data.dueDate, data.totalAmount
    )
    const invoice = invRows[0]
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i]
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".student_invoice_line (invoice_id, fee_type, amount, discount_type, discount_amount) VALUES ($1, $2, $3, $4, $5)`,
        invoice.id, line.feeType, line.amount, line.discountType || null, line.discountAmount || 0
      )
    }
    return invoice
  },

  async getPayments(entitySchema: string, studentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE pt.student_id = $1
       ORDER BY pt.payment_date DESC`,
      studentId
    )
  },

  async getAging(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s.student_number, s.full_name,
              COALESCE(SUM(CASE WHEN si.due_date >= CURRENT_DATE THEN si.balance ELSE 0 END), 0) as current,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1 THEN si.balance ELSE 0 END), 0) as days_1_30,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 31 THEN si.balance ELSE 0 END), 0) as days_31_60,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 61 THEN si.balance ELSE 0 END), 0) as days_61_90,
              COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 90 THEN si.balance ELSE 0 END), 0) as days_91_plus,
              COALESCE(SUM(si.balance), 0) as total_balance
       FROM "${entitySchema}".student s
       JOIN "${entitySchema}".student_invoice si ON si.student_id = s.id AND si.status IN ('unpaid', 'partial')
       GROUP BY s.id, s.student_number, s.full_name
       ORDER BY total_balance DESC`
    )
  },

  async getOrGenerateInvoiceNumber(entitySchema: string): Promise<string> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INT)), 0) + 1 as next FROM "${entitySchema}".student_invoice`
    )
    return `INV-${String(rows[0].next).padStart(6, "0")}`
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 3: Vendor Account Service

**Files:**
- Create: `src/services/vendor-account.service.ts`

- [ ] **Step 1: Create vendor account service**

```ts
import { prisma } from "@/lib/db"

export const vendorAccountService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT va.*,
        COALESCE((SELECT SUM(balance) FROM "${entitySchema}".vendor_invoice WHERE vendor_id = va.id AND status IN ('unpaid','partial')), 0) as total_balance
       FROM "${entitySchema}".vendor_account va
       ORDER BY va.vendor_name`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".vendor_account WHERE id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, data: {
    vendorCode: string; vendorName: string; contactPerson?: string; address?: string
    tin?: string; contactNumber?: string; email?: string; paymentTerms?: string
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".vendor_account (vendor_code, vendor_name, contact_person, address, tin, contact_number, email, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      data.vendorCode, data.vendorName, data.contactPerson || null, data.address || null,
      data.tin || null, data.contactNumber || null, data.email || null, data.paymentTerms || null
    ).then(r => r[0])
  },

  async getInvoices(entitySchema: string, vendorId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".vendor_invoice
       WHERE vendor_id = $1
       ORDER BY invoice_date DESC`,
      vendorId
    )
  },

  async createInvoice(entitySchema: string, data: {
    vendorId: string; invoiceNumber: string; invoiceDate: string; dueDate: string; totalAmount: number
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".vendor_invoice (invoice_number, vendor_id, invoice_date, due_date, total_amount, balance)
       VALUES ($1, $2, $3::date, $4::date, $5, $5) RETURNING *`,
      data.invoiceNumber, data.vendorId, data.invoiceDate, data.dueDate, data.totalAmount
    ).then(r => r[0])
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 4: Cash Receipts Service

**Files:**
- Create: `src/services/cash-receipts.service.ts`

- [ ] **Step 1: Create cash receipts service**

```ts
import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const cashReceiptsService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       ORDER BY pt.payment_date DESC
       LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE pt.id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    studentId?: string; invoiceId?: string; paymentDate: string; amount: number
    paymentMethod: string; checkNumber?: string; checkDate?: string; bankName?: string; reference?: string
    payorName: string; payorAddress?: string; tin?: string
  }) {
    const txns = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".payment_transaction (transaction_number, student_id, invoice_id, payment_date, amount, payment_method, check_number, check_date, bank_name, reference)
       VALUES (
         (SELECT CONCAT('PMT-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(transaction_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".payment_transaction),
         $1, $2, $3::date, $4, $5, $6, $7::date, $8, $9
       ) RETURNING *`,
      data.studentId || null, data.invoiceId || null, data.paymentDate, data.amount,
      data.paymentMethod, data.checkNumber || null, data.checkDate || null, data.bankName || null, data.reference || null
    )
    return txns[0]
  },

  async post(entitySchema: string, userId: string, paymentId: string) {
    const payment = await this.getById(entitySchema, paymentId)
    if (!payment) throw new Error("Payment not found")
    if (payment.journal_entry_id) throw new Error("Already posted")

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2)`,
      "11120", "11210"
    )
    const cashBankId = accounts.find((a: any) => a.account_code === "11120")?.id
    const arStudentId = accounts.find((a: any) => a.account_code === "11210")?.id
    if (!cashBankId || !arStudentId) throw new Error("Required accounts not found")

    const je = await postingEngine.post(entitySchema, {
      entryDate: payment.payment_date.toISOString().split("T")[0],
      sourceModule: "CM",
      description: `Payment from ${payment.payor_name || payment.student_name} - ${payment.transaction_number}`,
      createdBy: userId,
      lines: [
        { accountId: cashBankId, debit: Number(payment.amount), credit: 0 },
        { accountId: arStudentId, debit: 0, credit: Number(payment.amount) },
      ],
    })

    const orRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".official_receipt (or_number, or_date, cash_receipt_id, student_id, payor_name, payor_address, tin, amount, journal_entry_id, created_by)
       VALUES (
         (SELECT CONCAT('OR-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(or_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".official_receipt),
         $1::date, $2, $3, $4, $5, $6, $7, $8, $9
       ) RETURNING *`,
      payment.payment_date, payment.id, payment.student_id, payment.payor_name || payment.student_name,
      null, null, payment.amount, je.id, userId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction SET journal_entry_id = $1, official_receipt_id = $2 WHERE id = $3`,
      je.id, orRows[0].id, paymentId
    )

    if (payment.invoice_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2`,
        payment.amount, payment.invoice_id
      )
    }

    await auditLog.log(entitySchema, {
      action: "post",
      recordType: "cash_receipt",
      recordId: paymentId,
      userId,
      description: `Posted cash receipt ${payment.transaction_number}`,
    })

    return { journalEntry: je, officialReceipt: orRows[0] }
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 5: Cash Disbursements Service

**Files:**
- Create: `src/services/cash-disbursements.service.ts`

- [ ] **Step 1: Create cash disbursements service**

```ts
import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const cashDisbursementsService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement ORDER BY cv_date DESC LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement WHERE id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    cvDate: string; payeeType: string; payeeName: string; payeeAddress?: string; tin?: string
    amount: number; paymentMethod: string; checkNumber?: string; checkDate?: string; bankAccount?: string
    withholdingTaxRate?: number; description?: string
  }) {
    const wtAmount = data.withholdingTaxRate ? (data.amount * data.withholdingTaxRate / 100) : 0
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".disbursement (cv_number, cv_date, payee_type, payee_name, payee_address, tin, amount, payment_method, check_number, check_date, bank_account, withholding_tax_amount, withholding_tax_rate, created_by)
       VALUES (
         (SELECT CONCAT('CV-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(cv_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".disbursement),
         $1::date, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13
       ) RETURNING *`,
      data.cvDate, data.payeeType, data.payeeName, data.payeeAddress || null, data.tin || null,
      data.amount, data.paymentMethod, data.checkNumber || null, data.checkDate || null,
      data.bankAccount || null, wtAmount, data.withholdingTaxRate || null, userId
    )
    return rows[0]
  },

  async post(entitySchema: string, userId: string, disbursementId: string) {
    const dv = await this.getById(entitySchema, disbursementId)
    if (!dv) throw new Error("Disbursement not found")
    if (dv.journal_entry_id) throw new Error("Already posted")
    if (dv.status !== "draft") throw new Error("Can only post draft disbursements")

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2, $3)`,
      "11120", "21110", "21500"
    )
    const cashBankId = accounts.find((a: any) => a.account_code === "11120")?.id
    const apTradeId = accounts.find((a: any) => a.account_code === "21110")?.id
    const wtpId = accounts.find((a: any) => a.account_code === "21500")?.id
    if (!cashBankId) throw new Error("Cash in Bank account not found")

    const lines: { accountId: string; debit: number; credit: number }[] = []

    if (dv.payee_type === "vendor" && dv.ap_invoice_id) {
      if (!apTradeId) throw new Error("AP Trade account not found")
      lines.push({ accountId: apTradeId, debit: Number(dv.amount), credit: 0 })
    } else {
      lines.push({ accountId: (apTradeId || cashBankId), debit: Number(dv.amount), credit: 0 })
    }

    const wtAmount = Number(dv.withholding_tax_amount)
    if (wtAmount > 0 && wtpId) {
      lines.push({ accountId: wtpId, debit: 0, credit: wtAmount })
      lines.push({ accountId: cashBankId, debit: 0, credit: Number(dv.amount) - wtAmount })
    } else {
      lines.push({ accountId: cashBankId, debit: 0, credit: Number(dv.amount) })
    }

    const je = await postingEngine.post(entitySchema, {
      entryDate: dv.cv_date.toISOString().split("T")[0],
      sourceModule: "CD",
      description: `Payment to ${dv.payee_name} - ${dv.cv_number}`,
      createdBy: userId,
      lines,
    })

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".disbursement SET journal_entry_id = $1, status = 'paid' WHERE id = $2`,
      je.id, disbursementId
    )

    if (dv.ap_invoice_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".vendor_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2`,
        dv.amount, dv.ap_invoice_id
      )
    }

    await auditLog.log(entitySchema, {
      action: "post",
      recordType: "disbursement",
      recordId: disbursementId,
      userId,
      description: `Posted disbursement ${dv.cv_number}`,
    })

    return { journalEntry: je }
  },
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 6: Student Account API Routes

**Files:**
- Create: `src/app/api/v1/student-accounts/route.ts`
- Create: `src/app/api/v1/student-accounts/[id]/route.ts`
- Create: `src/app/api/v1/student-accounts/[id]/invoices/route.ts`
- Create: `src/app/api/v1/student-accounts/[id]/payments/route.ts`

- [ ] **Step 1: Create student-accounts list + create route**

Create `src/app/api/v1/student-accounts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await studentAccountService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Student accounts list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list students"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const body = await request.json()
    const result = await studentAccountService.create(schema, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Student account create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create student"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create student-accounts get/update route**

Create `src/app/api/v1/student-accounts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await studentAccountService.getById(schema, id)
    if (!result) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Student not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Student account get error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get student"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await studentAccountService.update(schema, id, body)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Student account update error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to update student"), { status: 500 })
  }
}
```

- [ ] **Step 3: Create student invoices route**

Create `src/app/api/v1/student-accounts/[id]/invoices/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const invoices = await studentAccountService.getInvoices(schema, id)
    return NextResponse.json(formatApiResponse(invoices))
  } catch (error) {
    console.error("Student invoices error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get invoices"), { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const invoice = await studentAccountService.createInvoice(schema, { ...body, studentId: id })
    return NextResponse.json(formatApiResponse(invoice), { status: 201 })
  } catch (error) {
    console.error("Student invoice create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create invoice"), { status: 500 })
  }
}
```

- [ ] **Step 4: Create student payments route**

Create `src/app/api/v1/student-accounts/[id]/payments/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const payments = await studentAccountService.getPayments(schema, id)
    return NextResponse.json(formatApiResponse(payments))
  } catch (error) {
    console.error("Student payments error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get payments"), { status: 500 })
  }
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 7: Vendor Account API Routes

**Files:**
- Create: `src/app/api/v1/vendor-accounts/route.ts`
- Create: `src/app/api/v1/vendor-accounts/[id]/route.ts`
- Create: `src/app/api/v1/vendor-accounts/[id]/invoices/route.ts`

All follow the same pattern as Task 6. Each file checks RBAC, gets the entity schema, and calls the corresponding `vendorAccountService` method.

- [ ] **Step 1: Create vendor-accounts list + create**

Create `src/app/api/v1/vendor-accounts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { vendorAccountService } from "@/services/vendor-account.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "vendor_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await vendorAccountService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Vendor list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list vendors"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "vendor_accounts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await vendorAccountService.create(schema, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Vendor create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create vendor"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create vendor-accounts get route**

Create `src/app/api/v1/vendor-accounts/[id]/route.ts` — same pattern as student-accounts GET but using `vendorAccountService.getById`.

- [ ] **Step 3: Create vendor invoices route**

Create `src/app/api/v1/vendor-accounts/[id]/invoices/route.ts` — list and create invoices for a vendor.

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 8: Cash Receipts API Routes

**Files:**
- Create: `src/app/api/v1/cash-receipts/route.ts`
- Create: `src/app/api/v1/cash-receipts/[id]/route.ts`
- Create: `src/app/api/v1/cash-receipts/[id]/post/route.ts`

- [ ] **Step 1: Create cash-receipts route**

Create `src/app/api/v1/cash-receipts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_receipts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await cashReceiptsService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Cash receipts list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list receipts"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_receipts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await cashReceiptsService.create(schema, session.userId, body)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Cash receipt create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create receipt"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create cash-receipts get route**

Create `src/app/api/v1/cash-receipts/[id]/route.ts` — same pattern as other GET routes, calls `cashReceiptsService.getById`.

- [ ] **Step 3: Create cash-receipts post route**

Create `src/app/api/v1/cash-receipts/[id]/post/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_receipts", "post")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const result = await cashReceiptsService.post(schema, session.userId, id)
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    console.error("Cash receipt post error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to post"), { status: 500 })
  }
}
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 9: Cash Disbursements API Routes

**Files:**
- Create: `src/app/api/v1/cash-disbursements/route.ts`
- Create: `src/app/api/v1/cash-disbursements/[id]/route.ts`
- Create: `src/app/api/v1/cash-disbursements/[id]/post/route.ts`

Same pattern as Task 8. Uses `cashDisbursementsService`.

- [ ] **Step 1: Create disbursements list + create route**

Create `src/app/api/v1/cash-disbursements/route.ts` with GET (list) and POST (create) handlers, RBAC checked against `cash_disbursements`.

- [ ] **Step 2: Create disbursements get route**

Create `src/app/api/v1/cash-disbursements/[id]/route.ts` with GET handler.

- [ ] **Step 3: Create disbursements post route**

Create `src/app/api/v1/cash-disbursements/[id]/post/route.ts` with POST handler, checks `cash_disbursements:post` permission.

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 10: Official Receipts API Routes

**Files:**
- Create: `src/app/api/v1/official-receipts/route.ts`
- Create: `src/app/api/v1/official-receipts/[id]/route.ts`
- Create: `src/app/api/v1/official-receipts/[id]/void/route.ts`

- [ ] **Step 1: Create OR list route**

Create `src/app/api/v1/official-receipts/route.ts` with GET handler:

```ts
import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "official_receipts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT or_.*, pt.transaction_number as payment_ref
       FROM "${schema}".official_receipt or_
       LEFT JOIN "${schema}".payment_transaction pt ON pt.id = or_.cash_receipt_id
       ORDER BY or_.created_at DESC LIMIT 100`
    )
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("OR list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list receipts"), { status: 500 })
  }
}
```

- [ ] **Step 2: Create OR get + void routes**

- `src/app/api/v1/official-receipts/[id]/route.ts` — GET with `prisma.$queryRawUnsafe` to fetch by id
- `src/app/api/v1/official-receipts/[id]/void/route.ts` — POST handler that updates `status='void'` and logs audit trail

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 11: UI Pages

**Files:**
- Create: `src/app/(dashboard)/student-accounts/page.tsx`
- Create: `src/app/(dashboard)/student-accounts/[id]/page.tsx`
- Create: `src/app/(dashboard)/cash-receipts/page.tsx`
- Create: `src/app/(dashboard)/cash-receipts/new/page.tsx`
- Create: `src/app/(dashboard)/cash-disbursements/page.tsx`
- Create: `src/app/(dashboard)/cash-disbursements/new/page.tsx`
- Create: `src/app/(dashboard)/official-receipts/page.tsx`
- Create: `src/app/(dashboard)/official-receipts/[id]/page.tsx`
- Create: `src/app/(dashboard)/vendor-accounts/page.tsx`

- [ ] **Step 1: Student accounts list page**

Create `src/app/(dashboard)/student-accounts/page.tsx`:

```tsx
import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function StudentAccountsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "student_accounts", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const students = await studentAccountService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Accounts</h1>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Student #</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Course/Grade</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No students found.</td></tr>}
              {students.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/dashboard/student-accounts/${s.id}`} className="text-blue-600 hover:underline">{s.student_number}</Link>
                  </td>
                  <td className="p-3">{s.full_name}</td>
                  <td className="p-3 text-xs">{s.course || s.grade_level || "—"}</td>
                  <td className="p-3 text-xs capitalize">{s.status}</td>
                  <td className="p-3 text-right font-mono">{Number(s.total_balance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Student account detail page**

Create `src/app/(dashboard)/student-accounts/[id]/page.tsx` — shows student info, invoices table, payment history. Fetch data using `studentAccountService.getById`, `getInvoices`, `getPayments`.

- [ ] **Step 3: Cash receipts list page**

Create `src/app/(dashboard)/cash-receipts/page.tsx` — table with payment date, student name, invoice #, amount, status. Uses `cashReceiptsService.list`.

```tsx
import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function CashReceiptsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "cash_receipts", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const receipts = await cashReceiptsService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cash Receipts</h1>
        <Link href="/dashboard/cash-receipts/new"><Button>New Receipt</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Transaction #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Student</th>
              <th className="text-left p-3 font-medium">Invoice</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-center p-3 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No receipts found.</td></tr>}
            {receipts.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{r.transaction_number}</td>
                <td className="p-3">{new Date(r.payment_date).toLocaleDateString()}</td>
                <td className="p-3">{r.student_name || "—"}</td>
                <td className="p-3 text-xs">{r.invoice_number || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(r.amount).toFixed(2)}</td>
                <td className="p-3 text-xs">{r.payment_method}</td>
                <td className="p-3 text-center">{r.journal_entry_id ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Cash receipts create page**

Create `src/app/(dashboard)/cash-receipts/new/page.tsx` — client component form (similar to JE new page pattern) with fields: studentId, invoiceId, paymentDate, amount, paymentMethod, check fields, payor info.

- [ ] **Step 5: Cash disbursements list + create pages**

- List page at `cash-disbursements/page.tsx` — table of disbursements, "New Disbursement" button
- Create page at `cash-disbursements/new/page.tsx` — client form for CV details with payee type, amount, payment method, withholding tax

- [ ] **Step 6: Official receipts list + detail pages**

- List page at `official-receipts/page.tsx` — table with OR#, date, payor, amount, VAT, status
- Detail page at `official-receipts/[id]/page.tsx` — shows OR details + lines

- [ ] **Step 7: Vendor accounts list page**

Create `src/app/(dashboard)/vendor-accounts/page.tsx` — table of vendors with balances, links to detail.

- [ ] **Step 8: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 12: Update RBAC Permissions

**Files:**
- Modify: `src/lib/auth/rbac.ts`

- [ ] **Step 1: Read existing RBAC and add new module permissions**

Read `src/lib/auth/rbac.ts`. Add these new modules with appropriate permissions for each role:

- `student_accounts`: read (auditor, accountant, finance_officer, cashier), create/update (accountant, finance_officer)
- `vendor_accounts`: read (auditor, accountant, finance_officer), create/update (accountant, finance_officer)
- `cash_receipts`: read (auditor, accountant, finance_officer, cashier), create (cashier, finance_officer), post (accountant, finance_officer)
- `cash_disbursements`: read (auditor, accountant, finance_officer), create (finance_officer, accountant), post (accountant)
- `official_receipts`: read (auditor, accountant, finance_officer, cashier), void (accountant, finance_officer)

Follow the existing `PERMISSIONS` map pattern in the file.

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 13: Update NavLinks Sidebar

**Files:**
- Modify: `src/components/dashboard/nav-links.tsx`

- [ ] **Step 1: Verify the sidebar already has links for all modules**

Read `nav-links.tsx`. The sidebar already has links for: Cash Receipts, Cash Disbursements, Official Receipts, Student Accounts, Reports. If not, add the missing ones.

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`

---

### Task 14: TypeScript Verification

- [ ] **Step 1: Run TypeScript check**

```bash
node node_modules/typescript/bin/tsc --noEmit
```

Expected: zero errors. Fix any issues found, re-check, then mark complete.
