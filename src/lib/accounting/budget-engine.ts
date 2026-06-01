import { prisma } from "@/lib/db"

export interface BudgetVsActualRow {
  accountCode: string
  accountName: string
  accountType: string
  budgeted: number
  actual: number
  variance: number
  variancePercent: number
}

export const budgetEngine = {
  async getBudgetVsActual(
    entitySchema: string,
    fiscalYearId: string | undefined,
    accountId?: string
  ): Promise<BudgetVsActualRow[]> {
    const accountFilter = accountId
      ? `AND a.id = '${accountId}'`
      : ""

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(b.budgeted_amount, 0) AS budgeted,
        COALESCE(
          (SELECT SUM(
            CASE
              WHEN a.normal_balance = 'debit' THEN jel.debit - jel.credit
              ELSE jel.credit - jel.debit
            END
          )
           FROM "${entitySchema}".journal_entry_line jel
           JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
           JOIN public.fiscal_period fp ON fp.id = je.fiscal_period_id
           WHERE je.status = 'posted'
             AND fp.fiscal_year_id = '${fiscalYearId}'
             AND jel.account_id = a.id
          ), 0
        ) AS actual
      FROM "${entitySchema}".account a
      LEFT JOIN "${entitySchema}".budget b
        ON b.account_id = a.id AND b.fiscal_year_id = '${fiscalYearId}'
      WHERE a.level >= 3
        AND a.account_type IN ('revenue', 'expense')
        ${accountFilter}
      ORDER BY a.account_code`
    )

    return rows.map((r: any) => ({
      accountCode: r.account_code,
      accountName: r.account_name,
      accountType: r.account_type,
      budgeted: Number(r.budgeted),
      actual: Number(r.actual),
      variance: Number(r.budgeted) - Number(r.actual),
      variancePercent: Number(r.budgeted) > 0
        ? ((Number(r.budgeted) - Number(r.actual)) / Number(r.budgeted)) * 100
        : 0,
    }))
  },

  async getBudgetSummary(
    entitySchema: string,
    fiscalYearId: string | undefined
  ): Promise<{
    totalBudgeted: number
    totalActual: number
    totalVariance: number
    revenueRows: BudgetVsActualRow[]
    expenseRows: BudgetVsActualRow[]
  }> {
    const allRows = await this.getBudgetVsActual(entitySchema, fiscalYearId)
    const revenueRows = allRows.filter(r => r.accountType === "revenue")
    const expenseRows = allRows.filter(r => r.accountType === "expense")

    const totalBudgeted = allRows.reduce((s, r) => s + r.budgeted, 0)
    const totalActual = allRows.reduce((s, r) => s + r.actual, 0)

    return {
      totalBudgeted,
      totalActual,
      totalVariance: totalBudgeted - totalActual,
      revenueRows,
      expenseRows,
    }
  },
}
