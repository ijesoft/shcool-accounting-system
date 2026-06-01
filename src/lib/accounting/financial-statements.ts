import { prisma } from "@/lib/db"
import type { CashFlowEntry } from "@/types/accounting"

export const financialStatementEngine = {
  async trialBalance(entitySchema: string, fiscalPeriodId?: string) {
    const whereClause = fiscalPeriodId
      ? `WHERE je.status = 'posted' AND je.fiscal_period_id = '${fiscalPeriodId}'`
      : `WHERE je.status = 'posted'`

    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id ${whereClause}
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`
    )

    const totalDebits = results.reduce((s: number, r: any) => s + Number(r.total_debits), 0)
    const totalCredits = results.reduce((s: number, r: any) => s + Number(r.total_credits), 0)

    return { accounts: results, totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 }
  },

  async incomeStatement(entitySchema: string, fromDate: string, toDate: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name, a.account_type,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits,
              CASE WHEN a.normal_balance = 'debit'
                THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
                ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
              END as balance
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date
         AND je.entry_date <= $2::date
       WHERE a.account_type IN ('revenue', 'expense', 'contra_revenue')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`,
      fromDate, toDate
    )
  },

  async balanceSheet(entitySchema: string, asOfDate: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date <= $1::date
       WHERE a.account_type IN ('asset', 'liability', 'equity', 'contra_asset', 'contra_liability')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`,
      asOfDate
    )
  },

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
  },
}
