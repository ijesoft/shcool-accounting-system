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
    const prevYear = String(Number(fiscalYear) - 1)
    const prevFrom = `${prevYear}-01-01`
    const prevTo = `${prevYear}-12-31`

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
