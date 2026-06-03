import { prisma } from "@/lib/db"
import { financialStatementEngine } from "@/lib/accounting/financial-statements"
import { activitySchedule } from "@/lib/accounting/activity-schedule"

export interface AfsPackage {
  entityName: string
  fiscalYear: string
  tin: string
  secRegistrationNumber?: string
  trialBalance: any
  incomeStatement: any
  balanceSheet: any
  changesInEquity: any
  cashFlow: any
  activitySchedule: any
  notesTemplate: string
}

export const afsPackageService = {
  async generate(entitySchema: string, entityId: string, fiscalYear: string): Promise<AfsPackage> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { name: true, tin: true, settings: true },
    })
    if (!entity) throw new Error("Entity not found")

    const from = `${fiscalYear}-01-01`
    const to = `${fiscalYear}-12-31`

    const [trialBalance, incomeStatement, balanceSheet, changesInEquity, cashFlow, activityData] =
      await Promise.all([
        financialStatementEngine.trialBalance(entitySchema),
        financialStatementEngine.incomeStatement(entitySchema, from, to, true),
        financialStatementEngine.balanceSheet(entitySchema, to, true),
        financialStatementEngine.statementOfChangesInEquity(entitySchema, from, to),
        financialStatementEngine.cashFlowStatement(entitySchema, from, to),
        activitySchedule.generate(entitySchema, from, to),
      ])

    const groupedReceipts = activitySchedule.groupByCategory(activityData.receipts)
    const groupedDisbursements = activitySchedule.groupByCategory(activityData.disbursements)

    const notesTemplate = this.generateNotesTemplate(entity.name, fiscalYear, entity.tin || "")

    return {
      entityName: entity.name,
      fiscalYear,
      tin: entity.tin || "",
      trialBalance,
      incomeStatement,
      balanceSheet,
      changesInEquity,
      cashFlow,
      activitySchedule: {
        ...activityData,
        receipts: groupedReceipts,
        disbursements: groupedDisbursements,
      },
      notesTemplate,
    }
  },

  async generateNotesWithData(entitySchema: string, entityId: string, fiscalYear: string): Promise<string> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { name: true, tin: true },
    })
    if (!entity) throw new Error("Entity not found")

    const asOfDate = `${fiscalYear}-12-31`

    // Note 2: Cash balances
    const cashRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(CASE WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit ELSE jel.credit - jel.debit END), 0) as balance
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted' AND je.entry_date <= $1::date
       WHERE a.account_code IN ('11110', '11120')
       GROUP BY a.account_code, a.account_name ORDER BY a.account_code`,
      asOfDate
    ).catch(() => [] as any[])

    const cashTotal = cashRows.reduce((s: number, r: any) => s + Number(r.balance), 0)
    const cashLines = cashRows
      .map(
        (r: any) =>
          `  ${r.account_name} (${r.account_code}): PHP ${Number(r.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
      )
      .join("\n")

    // Note 3: AR Aging
    const arRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         SUM(CASE WHEN due_date >= CURRENT_DATE THEN balance ELSE 0 END) as current_amount,
         COUNT(CASE WHEN due_date >= CURRENT_DATE THEN 1 END) as current_count,
         SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN balance ELSE 0 END) as d30_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN 1 END) as d30_count,
         SUM(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN balance ELSE 0 END) as d60_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN 1 END) as d60_count,
         SUM(CASE WHEN due_date < CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90 THEN balance ELSE 0 END) as d90_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE - 60 AND due_date >= CURRENT_DATE - 90 THEN 1 END) as d90_count,
         SUM(CASE WHEN due_date < CURRENT_DATE - 90 THEN balance ELSE 0 END) as d91plus_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE - 90 THEN 1 END) as d91plus_count,
         SUM(balance) as total_ar
       FROM "${entitySchema}".student_invoice
       WHERE balance > 0`
    ).catch(() => [] as any[])

    const ar = arRows[0] ?? {}
    const arTotal = Number(ar.total_ar ?? 0)

    // Note 4: PPE
    const ppeRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT asset_class,
              COALESCE(SUM(cost), 0) as total_cost,
              COALESCE(SUM(accumulated_depreciation), 0) as total_accum_dep,
              COALESCE(SUM(cost - accumulated_depreciation), 0) as net_book_value
       FROM "${entitySchema}".fixed_asset
       WHERE is_disposed = FALSE
       GROUP BY asset_class ORDER BY asset_class`
    ).catch(() => [] as any[])

    const ppeLines =
      ppeRows.length > 0
        ? ppeRows
            .map(
              (r: any) =>
                `  ${r.asset_class}: Cost PHP ${Number(r.total_cost).toLocaleString("en-PH", { minimumFractionDigits: 2 })} | Accum Dep PHP ${Number(r.total_accum_dep).toLocaleString("en-PH", { minimumFractionDigits: 2 })} | NBV PHP ${Number(r.net_book_value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
            )
            .join("\n")
        : "  No fixed assets recorded."

    const ppeTotalCost = ppeRows.reduce((s: number, r: any) => s + Number(r.total_cost), 0)
    const ppeTotalNbv = ppeRows.reduce((s: number, r: any) => s + Number(r.net_book_value), 0)

    // Note 5: AP
    const apRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount_due), 0) as total_payables
       FROM "${entitySchema}".vendor_invoice
       WHERE status = 'unpaid'`
    ).catch(() => [] as any[])

    const totalPayables = Number(apRows[0]?.total_payables ?? 0)

    const template = this.generateNotesTemplate(entity.name, fiscalYear, entity.tin || "")

    const note2Text =
      `NOTE 2 — CASH AND CASH EQUIVALENTS\n\nAs of December 31, ${fiscalYear}:\n` +
      (cashLines || "  No cash account balances recorded.") +
      `\n  Total Cash and Cash Equivalents: PHP ${cashTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    const note3Text =
      `NOTE 3 — ACCOUNTS RECEIVABLE\n\nAccounts Receivable — Student Accounts as of December 31, ${fiscalYear}:\n` +
      `  Current (not yet due):   ${Number(ar.current_count ?? 0)} invoices  PHP ${Number(ar.current_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n` +
      `  1-30 days overdue:       ${Number(ar.d30_count ?? 0)} invoices  PHP ${Number(ar.d30_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n` +
      `  31-60 days overdue:      ${Number(ar.d60_count ?? 0)} invoices  PHP ${Number(ar.d60_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n` +
      `  61-90 days overdue:      ${Number(ar.d90_count ?? 0)} invoices  PHP ${Number(ar.d90_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n` +
      `  91+ days overdue:        ${Number(ar.d91plus_count ?? 0)} invoices  PHP ${Number(ar.d91plus_amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n` +
      `  Total Accounts Receivable: PHP ${arTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    const note4Text =
      `NOTE 4 — PROPERTY, PLANT AND EQUIPMENT\n\nAs of December 31, ${fiscalYear}:\n` +
      ppeLines +
      `\n  Total PPE at Cost:    PHP ${ppeTotalCost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` +
      `\n  Total Net Book Value: PHP ${ppeTotalNbv.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    const note5Text =
      `NOTE 5 — ACCOUNTS PAYABLE\n\nTotal Accounts Payable (unpaid vendor invoices) as of December 31, ${fiscalYear}:\n` +
      `  PHP ${totalPayables.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`

    let notes = template
    notes = notes.replace(/NOTE 2 — CASH AND CASH EQUIVALENTS[\s\S]*?(?=NOTE 3)/, note2Text + "\n\n")
    notes = notes.replace(/NOTE 3 — ACCOUNTS RECEIVABLE[\s\S]*?(?=NOTE 4)/, note3Text + "\n\n")
    notes = notes.replace(/NOTE 4 — PROPERTY, PLANT AND EQUIPMENT[\s\S]*?(?=NOTE 5)/, note4Text + "\n\n")
    notes = notes.replace(/NOTE 5 — ACCOUNTS PAYABLE[\s\S]*?(?=NOTE 6)/, note5Text + "\n\n")

    return notes
  },

  generateNotesTemplate(entityName: string, fiscalYear: string, tin: string): string {
    return `NOTES TO FINANCIAL STATEMENTS
${entityName}
For the Fiscal Year Ended December 31, ${fiscalYear}
TIN: ${tin}

NOTE 1 — SIGNIFICANT ACCOUNTING POLICIES

Statement of Compliance
The accompanying financial statements have been prepared in accordance with PFRS for SMEs.

Basis of Preparation
The financial statements have been prepared under the historical cost convention, except for certain financial instruments which are measured at fair value.

Revenue Recognition
Tuition and fees are recognized on a straight-line basis over the school term. Enrollment deposits are recognized upon enrollment confirmation.

Property, Plant and Equipment
PPE is stated at cost less accumulated depreciation. Depreciation is computed using the straight-line method over the estimated useful lives of the assets.

Property, Plant and Equipment
Land — indefinite
Buildings — 20-40 years
Equipment — 5-10 years
Vehicles — 4-8 years

Use of Estimates
The preparation of financial statements requires management to make estimates and assumptions that affect the reported amounts of assets, liabilities, income and expenses.

NOTE 2 — CASH AND CASH EQUIVALENTS

As of December 31, [PLACEHOLDER: INSERT BALANCE]

NOTE 3 — ACCOUNTS RECEIVABLE

As of December 31, [PLACEHOLDER: INSERT BALANCE]

NOTE 4 — PROPERTY, PLANT AND EQUIPMENT

[PLACEHOLDER: INSERT SCHEDULE]

NOTE 5 — ACCOUNTS PAYABLE

As of December 31, [PLACEHOLDER: INSERT BALANCE]

NOTE 6 — UNREVENUE TUTION

As of December 31, [PLACEHOLDER: INSERT BALANCE]

NOTE 7 — EQUITY

[PLACEHOLDER: INSERT DETAILS]

NOTE 8 — REVENUE

Tuition Revenue: [PLACEHOLDER]
Miscellaneous Fees: [PLACEHOLDER]
Other Income: [PLACEHOLDER]

NOTE 9 — EXPENSES BY NATURE

Salaries and Wages: [PLACEHOLDER]
Utilities: [PLACEHOLDER]
Depreciation: [PLACEHOLDER]
Other Expenses: [PLACEHOLDER]

NOTE 10 — RELATED PARTY TRANSACTIONS

[PLACEHOLDER: DISCLOSE IF ANY]

NOTE 11 — SUBSEQUENT EVENTS

[PLACEHOLDER: DISCLOSE IF ANY]
`
  },
}
