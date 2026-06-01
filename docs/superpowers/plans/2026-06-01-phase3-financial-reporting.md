# Phase 3: Financial Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cash Flow Statement, report export (CSV/XLSX), and report UI pages for Trial Balance, Income Statement, Balance Sheet, and Cash Flow.

**Architecture:** Extend `financial-statements.ts` with cash flow query (indirect method — adjusts net income for non-cash items + working capital changes). Add CSV/XLSX export to `report.service.ts`. Create server-rendered report pages under `(dashboard)/reports/` that fetch data server-side and render in tables.

**Tech Stack:** Next.js 14 Server Components, raw SQL for cash flow, exceljs for XLSX export, native JavaScript for CSV.

---

### Task 1: Cash Flow Statement Engine

**Files:**
- Modify: `src/lib/accounting/financial-statements.ts` (add `cashFlowStatement`)
- Modify: `src/types/accounting.ts` (add `CashFlowEntry` type)

- [ ] **Step 1: Add CashFlowEntry type**

Edit `src/types/accounting.ts` — find the existing types and add:

```ts
export interface CashFlowEntry {
  section: "operating" | "investing" | "financing"
  label: string
  amount: number
  accountCode?: string
}
```

- [ ] **Step 2: Add `cashFlowStatement` to financial statement engine**

Edit `src/lib/accounting/financial-statements.ts` — add this method inside the `financialStatementEngine` object, after `balanceSheet`:

```ts
async cashFlowStatement(entitySchema: string, fromDate: string, toDate: string) {
  const netIncome = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(
       CASE WHEN a.normal_balance = 'debit'
         THEN jel.debit - jel.credit
         ELSE jel.credit - jel.debit
       END), 0) as amount
     FROM "${entitySchema}".account a
     JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
     JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       AND je.status = 'posted'
       AND je.entry_date >= $1::date AND je.entry_date <= $2::date
     WHERE a.account_type IN ('revenue', 'expense', 'contra_revenue')`,
    fromDate, toDate
  )

  const nonCashChanges = await prisma.$queryRawUnsafe<any[]>(
    `SELECT a.account_code, a.account_name, a.account_type,
            COALESCE(SUM(jel.debit), 0) as total_debits,
            COALESCE(SUM(jel.credit), 0) as total_credits
     FROM "${entitySchema}".account a
     JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
     JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       AND je.status = 'posted'
       AND je.entry_date >= $1::date AND je.entry_date <= $2::date
     WHERE a.account_type IN ('asset', 'liability', 'equity')
     GROUP BY a.id, a.account_code, a.account_name, a.account_type
     ORDER BY a.account_code`,
    fromDate, toDate
  )

  const income = Number(netIncome[0]?.amount || 0)
  const sections: { operating: CashFlowEntry[]; investing: CashFlowEntry[]; financing: CashFlowEntry[] } = {
    operating: [{ section: "operating", label: "Net Income", amount: income }],
    investing: [],
    financing: [],
  }

  for (const row of nonCashChanges) {
    const debits = Number(row.total_debits)
    const credits = Number(row.total_credits)
    const netChange = debits - credits
    if (Math.abs(netChange) < 0.01) continue

    const entry: CashFlowEntry = {
      section: row.account_type === "asset" ? "investing" : "financing",
      label: `${row.account_name} (${row.account_code})`,
      amount: netChange,
      accountCode: row.account_code,
    }
    if (entry.section === "investing") sections.investing.push(entry)
    else sections.financing.push(entry)
  }

  const opTotal = sections.operating.reduce((s, e) => s + e.amount, 0)
  const invTotal = sections.investing.reduce((s, e) => s + e.amount, 0)
  const finTotal = sections.financing.reduce((s, e) => s + e.amount, 0)

  return { sections, totals: { operating: opTotal, investing: invTotal, financing: finTotal, net: opTotal + invTotal + finTotal } }
}
```

- [ ] **Step 3: Add CashFlowEntry import**

Add import at top of `financial-statements.ts`:

```ts
import type { CashFlowEntry } from "@/types/accounting"
```

- [ ] **Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

---

### Task 2: Cash Flow Statement Service & API Route

**Files:**
- Modify: `src/services/report.service.ts` (add `getCashFlowStatement`)
- Create: `src/app/api/v1/financial-reports/cash-flow/route.ts`

- [ ] **Step 1: Add `getCashFlowStatement` to report service**

Edit `src/services/report.service.ts` — add after `getBalanceSheet`:

```ts
async getCashFlowStatement(entitySchema: string, fromDate: string, toDate: string) {
  return financialStatementEngine.cashFlowStatement(entitySchema, fromDate, toDate)
},
```

- [ ] **Step 2: Create cash-flow API route**

Create `src/app/api/v1/financial-reports/cash-flow/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { reportService } from "@/services/report.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const from = request.nextUrl.searchParams.get("from")
    const to = request.nextUrl.searchParams.get("to")
    if (!from || !to) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "from and to query params required"), { status: 400 })
    }

    const result = await reportService.getCashFlowStatement(schema, from, to)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Cash flow error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate cash flow statement"), { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

---

### Task 3: Install Export Libraries

**Files:**
- Modify: `package.json` (add exceljs)

- [ ] **Step 1: Install exceljs**

Run: `npm install exceljs`
Expected: package added to dependencies

---

### Task 4: CSV Export Service

**Files:**
- Create: `src/lib/export/csv.ts`

- [ ] **Step 1: Create CSV export utility**

Create `src/lib/export/csv.ts`:

```ts
export function generateCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const header = columns.map((c) => `"${c.header}"`).join(",")
  const body = rows
    .map((row) => columns.map((c) => `"${String(row[c.key] ?? "")}"`).join(","))
    .join("\n")
  return `${header}\n${body}`
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  })
}
```

- [ ] **Step 2: Register in report service**

Edit `src/services/report.service.ts` — add import and method:

```ts
import { generateCsv } from "@/lib/export/csv"

// After existing methods:
async exportCsv(entitySchema: string, reportType: string, params: Record<string, string>) {
  let rows: any[] = []
  let columns: { key: string; header: string }[] = []

  if (reportType === "trial-balance") {
    const data = await financialStatementEngine.trialBalance(entitySchema, params.period)
    rows = data.accounts
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else if (reportType === "income-statement") {
    const data = await financialStatementEngine.incomeStatement(entitySchema, params.from, params.to)
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
      { key: "balance", header: "Balance" },
    ]
  } else if (reportType === "balance-sheet") {
    const data = await financialStatementEngine.balanceSheet(entitySchema, params.as_of)
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else {
    throw new Error(`Unknown report type: ${reportType}`)
  }

  return generateCsv(rows, columns)
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

---

### Task 5: XLSX Export Service

**Files:**
- Create: `src/lib/export/xlsx.ts`

- [ ] **Step 1: Create XLSX export utility**

Create `src/lib/export/xlsx.ts`:

```ts
import ExcelJS from "exceljs"

export async function generateXlsx(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
  sheetName: string
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 20 }))
  sheet.addRows(rows)

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

export function xlsxResponse(buffer: Uint8Array, filename: string): Response {
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
    },
  })
}
```

- [ ] **Step 2: Add XLSX export method to report service**

Edit `src/services/report.service.ts` — add import and method:

```ts
import { generateXlsx } from "@/lib/export/xlsx"

// After exportCsv:
async exportXlsx(entitySchema: string, reportType: string, params: Record<string, string>) {
  let rows: any[] = []
  let columns: { key: string; header: string }[] = []

  if (reportType === "trial-balance") {
    const data = await financialStatementEngine.trialBalance(entitySchema, params.period)
    rows = data.accounts
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else if (reportType === "income-statement") {
    const data = await financialStatementEngine.incomeStatement(entitySchema, params.from, params.to)
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
      { key: "balance", header: "Balance" },
    ]
  } else if (reportType === "balance-sheet") {
    const data = await financialStatementEngine.balanceSheet(entitySchema, params.as_of)
    rows = data
    columns = [
      { key: "account_code", header: "Account Code" },
      { key: "account_name", header: "Account Name" },
      { key: "account_type", header: "Type" },
      { key: "total_debits", header: "Debits" },
      { key: "total_credits", header: "Credits" },
    ]
  } else {
    throw new Error(`Unknown report type: ${reportType}`)
  }

  return generateXlsx(rows, columns, reportType)
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

---

### Task 6: Export API Route

**Files:**
- Create: `src/app/api/v1/financial-reports/export/[type]/route.ts`

- [ ] **Step 1: Create export API route**

Create `src/app/api/v1/financial-reports/export/[type]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { reportService } from "@/services/report.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"
import { csvResponse } from "@/lib/export/csv"
import { xlsxResponse } from "@/lib/export/xlsx"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const format = request.nextUrl.searchParams.get("format") || "csv"
    const reportType = request.nextUrl.searchParams.get("report")
    if (!reportType) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "report query param required (trial-balance, income-statement, balance-sheet)"), { status: 400 })
    }

    const params: Record<string, string> = {}
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "format" && key !== "report") params[key] = value
    })

    if (format === "csv") {
      const csv = await reportService.exportCsv(schema, reportType, params)
      return csvResponse(csv, `${reportType}-${new Date().toISOString().split("T")[0]}`)
    } else if (format === "xlsx") {
      const buffer = await reportService.exportXlsx(schema, reportType, params)
      return xlsxResponse(buffer, `${reportType}-${new Date().toISOString().split("T")[0]}`)
    } else {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid format. Use csv or xlsx"), { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate export"), { status: 500 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: zero errors

---

### Task 7: Reports Layout Page

**Files:**
- Create: `src/app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Create reports hub page**

Create `src/app/(dashboard)/reports/page.tsx`:

```tsx
import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

const reportLinks = [
  {
    href: "/dashboard/reports/trial-balance",
    title: "Trial Balance",
    description: "List of all accounts with debit/credit balances for a given period.",
  },
  {
    href: "/dashboard/reports/income-statement",
    title: "Income Statement",
    description: "Revenue and expense summary showing profit/loss for a date range.",
  },
  {
    href: "/dashboard/reports/balance-sheet",
    title: "Balance Sheet",
    description: "Assets, liabilities, and equity as of a specific date.",
  },
  {
    href: "/dashboard/reports/cash-flow",
    title: "Cash Flow Statement",
    description: "Cash inflows and outflows from operating, investing, and financing activities.",
  },
]

export default async function ReportsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Financial Reports</h1>
      <p className="text-muted-foreground">Select a report to view or export.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {reportLinks.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm text-blue-600">View Report →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

---

### Task 8: Trial Balance Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/trial-balance/page.tsx`

- [ ] **Step 1: Create trial balance report page**

Create `src/app/(dashboard)/reports/trial-balance/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, periodId?: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getTrialBalance(entity.schemaName, periodId)
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period } = await searchParams
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, period)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trial Balance</h1>
        <div className="flex gap-2 text-sm">
          <a
            href={`/api/v1/financial-reports/export/csv?format=csv&report=trial-balance${period ? `&period=${period}` : ""}`}
            className="text-blue-600 hover:underline"
          >
            Download CSV
          </a>
          <a
            href={`/api/v1/financial-reports/export/csv?format=xlsx&report=trial-balance${period ? `&period=${period}` : ""}`}
            className="text-blue-600 hover:underline"
          >
            Download XLSX
          </a>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Account Code</th>
                <th className="text-left p-3 font-medium">Account Name</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-right p-3 font-medium">Debits</th>
                <th className="text-right p-3 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((account: any) => (
                <tr key={account.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">{account.account_code}</td>
                  <td className="p-3">{account.account_name}</td>
                  <td className="p-3 text-xs capitalize">{account.account_type}</td>
                  <td className="p-3 text-right font-mono">
                    {Number(account.total_debits).toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {Number(account.total_credits).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td colSpan={3} className="p-3 text-right">Totals</td>
                <td className="p-3 text-right font-mono">{Number(data.totalDebits).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(data.totalCredits).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className={`text-sm ${data.balanced ? "text-green-600" : "text-red-600"}`}>
        {data.balanced ? "✓ Trial balance is balanced." : "✗ Trial balance is NOT balanced."}
      </p>
    </div>
  )
}
```

---

### Task 9: Income Statement Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/income-statement/page.tsx`

- [ ] **Step 1: Create income statement page**

Create `src/app/(dashboard)/reports/income-statement/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, from: string, to: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getIncomeStatement(entity.schemaName, from, to)
}

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const from = params.from || `${now.getFullYear()}-01-01`
  const to = params.to || now.toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, from, to)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const totalRevenue = data
    .filter((r: any) => r.account_type === "revenue")
    .reduce((s: number, r: any) => s + Number(r.balance), 0)
  const totalExpenses = data
    .filter((r: any) => r.account_type === "expense")
    .reduce((s: number, r: any) => s + Math.abs(Number(r.balance)), 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Statement</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=income-statement&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=income-statement&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Revenue</td>
              </tr>
              {data.filter((r: any) => r.account_type === "revenue").map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{Number(row.balance).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Revenue</td>
                <td className="p-3 text-right font-mono">{totalRevenue.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Expenses</td>
              </tr>
              {data.filter((r: any) => r.account_type === "expense").map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{Math.abs(Number(row.balance)).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Expenses</td>
                <td className="p-3 text-right font-mono">{totalExpenses.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Net Income (Loss)</td>
                <td className={`p-3 text-right font-mono ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {netIncome.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 10: Balance Sheet Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/balance-sheet/page.tsx`

- [ ] **Step 1: Create balance sheet page**

Create `src/app/(dashboard)/reports/balance-sheet/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, asOf: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getBalanceSheet(entity.schemaName, asOf)
}

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>
}) {
  const { as_of } = await searchParams
  const asOf = as_of || new Date().toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, asOf)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const totalAssets = data
    .filter((r: any) => r.account_type === "asset" || r.account_type === "contra_asset")
    .reduce((s: number, r: any) => {
      const net = r.normal_balance === "debit"
        ? Number(r.total_debits) - Number(r.total_credits)
        : Number(r.total_credits) - Number(r.total_debits)
      return s + net
    }, 0)

  const totalLiabilities = data
    .filter((r: any) => r.account_type === "liability" || r.account_type === "contra_liability")
    .reduce((s: number, r: any) => {
      const net = r.normal_balance === "credit"
        ? Number(r.total_credits) - Number(r.total_debits)
        : Number(r.total_debits) - Number(r.total_credits)
      return s + net
    }, 0)

  const totalEquity = data
    .filter((r: any) => r.account_type === "equity")
    .reduce((s: number, r: any) => {
      const net = r.normal_balance === "credit"
        ? Number(r.total_credits) - Number(r.total_debits)
        : Number(r.total_debits) - Number(r.total_credits)
      return s + net
    }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">As of {new Date(asOf).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=balance-sheet&as_of=${asOf}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=balance-sheet&as_of=${asOf}`} className="text-blue-600 hover:underline">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Assets</td>
              </tr>
              {data.filter((r: any) => r.account_type === "asset" || r.account_type === "contra_asset").map((row: any) => {
                const net = row.normal_balance === "debit"
                  ? Number(row.total_debits) - Number(row.total_credits)
                  : Number(row.total_credits) - Number(row.total_debits)
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50">
                    <td className="p-3 pl-8">{row.account_name}</td>
                    <td className="p-3 text-right font-mono">{net.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Assets</td>
                <td className="p-3 text-right font-mono">{totalAssets.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Liabilities</td>
              </tr>
              {data.filter((r: any) => r.account_type === "liability" || r.account_type === "contra_liability").map((row: any) => {
                const net = row.normal_balance === "credit"
                  ? Number(row.total_credits) - Number(row.total_debits)
                  : Number(row.total_debits) - Number(row.total_credits)
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50">
                    <td className="p-3 pl-8">{row.account_name}</td>
                    <td className="p-3 text-right font-mono">{net.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Liabilities</td>
                <td className="p-3 text-right font-mono">{totalLiabilities.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Equity</td>
              </tr>
              {data.filter((r: any) => r.account_type === "equity").map((row: any) => {
                const net = row.normal_balance === "credit"
                  ? Number(row.total_credits) - Number(row.total_debits)
                  : Number(row.total_debits) - Number(row.total_credits)
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50">
                    <td className="p-3 pl-8">{row.account_name}</td>
                    <td className="p-3 text-right font-mono">{net.toFixed(2)}</td>
                  </tr>
                )
              })}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Equity</td>
                <td className="p-3 text-right font-mono">{totalEquity.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Total Liabilities & Equity</td>
                <td className="p-3 text-right font-mono">{(totalLiabilities + totalEquity).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 11: Cash Flow Statement Report Page

**Files:**
- Create: `src/app/(dashboard)/reports/cash-flow/page.tsx`

- [ ] **Step 1: Create cash flow page**

Create `src/app/(dashboard)/reports/cash-flow/page.tsx`:

```tsx
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, from: string, to: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getCashFlowStatement(entity.schemaName, from, to)
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const from = params.from || `${now.getFullYear()}-01-01`
  const to = params.to || now.toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, from, to)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sections = [
    { key: "operating" as const, label: "Operating Activities" },
    { key: "investing" as const, label: "Investing Activities" },
    { key: "financing" as const, label: "Financing Activities" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Item</th>
                <th className="text-right p-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <>
                  <tr key={section.key} className="border-b bg-muted/30">
                    <td className="p-3 font-bold" colSpan={2}>{section.label}</td>
                  </tr>
                  {data.sections[section.key].length === 0 && (
                    <tr className="border-b">
                      <td className="p-3 pl-8 text-muted-foreground italic" colSpan={2}>No items</td>
                    </tr>
                  )}
                  {data.sections[section.key].map((entry: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-3 pl-8">{entry.label}</td>
                      <td className={`p-3 text-right font-mono ${entry.amount >= 0 ? "" : "text-red-600"}`}>
                        {entry.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b font-medium">
                    <td className="p-3 pl-8">Net {section.label}</td>
                    <td className={`p-3 text-right font-mono ${data.totals[section.key] >= 0 ? "" : "text-red-600"}`}>
                      {data.totals[section.key].toFixed(2)}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Net Cash Flow</td>
                <td className={`p-3 text-right font-mono ${data.totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.totals.net.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
```

---

### Task 12: TypeScript Verification

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 2: Fix any errors**
If errors are found, fix them and re-run until zero.
