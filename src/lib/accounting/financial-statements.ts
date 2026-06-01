import { prisma } from "@/lib/db"
import type { CashFlowEntry } from "@/types/accounting"

function getPriorYearDateString(dateStr: string): string {
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    return `${year - 1}-${parts[1]}-${parts[2]}`
  }
  return dateStr
}

export const financialStatementEngine = {
  async trialBalance(entitySchema: string, fiscalPeriodId?: string) {
    if (fiscalPeriodId) {
      const results = await prisma.$queryRawUnsafe<any[]>(
        `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
                COALESCE(SUM(jel.debit), 0) as total_debits,
                COALESCE(SUM(jel.credit), 0) as total_credits
         FROM "${entitySchema}".account a
         LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
         LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
           AND je.status = 'posted' AND je.fiscal_period_id = $1
         GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
         ORDER BY a.account_code`,
        fiscalPeriodId
      )
      const totalDebits = results.reduce((s: number, r: any) => s + Number(r.total_debits), 0)
      const totalCredits = results.reduce((s: number, r: any) => s + Number(r.total_credits), 0)
      let runningBalance = 0
      const accountsWithRunning = results.map((r: any) => {
        runningBalance += Number(r.total_debits) - Number(r.total_credits)
        return { ...r, runningBalance }
      })
      return {
        accounts: accountsWithRunning,
        totalDebits,
        totalCredits,
        balanced: Math.abs(totalDebits - totalCredits) < 0.01,
        reportTitle: "Trial Balance"
      }
    }

    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`
    )
    const totalDebits = results.reduce((s: number, r: any) => s + Number(r.total_debits), 0)
    const totalCredits = results.reduce((s: number, r: any) => s + Number(r.total_credits), 0)
    let runningBalance = 0
    const accountsWithRunning = results.map((r: any) => {
      runningBalance += Number(r.total_debits) - Number(r.total_credits)
      return { ...r, runningBalance }
    })
    return {
      accounts: accountsWithRunning,
      totalDebits,
      totalCredits,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
      reportTitle: "Trial Balance"
    }
  },

  async incomeStatement(entitySchema: string, fromDate: string, toDate: string, comparative: boolean = false) {
    const runQuery = async (from: string, to: string) => {
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
        from, to
      )
    }

    const current = await runQuery(fromDate, toDate)
    const result: any = {
      current,
      reportTitle: "Statement of Comprehensive Income"
    }

    if (comparative) {
      const compFromDate = getPriorYearDateString(fromDate)
      const compToDate = getPriorYearDateString(toDate)
      result.comparative = await runQuery(compFromDate, compToDate)
    }

    return result
  },

  async balanceSheet(entitySchema: string, asOfDate: string, comparative: boolean = false) {
    const runQuery = async (asOf: string) => {
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
        asOf
      )
    }

    const current = await runQuery(asOfDate)
    const result: any = {
      current,
      reportTitle: "Statement of Financial Position"
    }

    if (comparative) {
      const compAsOfDate = getPriorYearDateString(asOfDate)
      result.comparative = await runQuery(compAsOfDate)
    }

    return result
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

    const depreciation = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(jel.debit), 0) as amount
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_code = '51400'`,
      fromDate, toDate
    )

    const workingCapitalChanges = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(jel.debit - jel.credit), 0) as net_change
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_code IN ('11100', '11200', '11300', '11400', '11500', '11600', '21100', '21200', '21300', '21400', '21500', '21600', '21700', '21800', '21900')
       GROUP BY a.id, a.account_code, a.account_name`,
      fromDate, toDate
    )

    const fixedAssetChanges = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(jel.debit - jel.credit), 0) as net_change
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_code IN ('12110', '12120', '12140', '12160', '12180')
       GROUP BY a.id, a.account_code, a.account_name`,
      fromDate, toDate
    )

    const financingChanges = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(jel.debit - jel.credit), 0) as net_change
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_code IN ('22100', '31100', '31200', '31300')
       GROUP BY a.id, a.account_code, a.account_name`,
      fromDate, toDate
    )

    const income = Number(netIncome[0]?.amount || 0)
    const depAmount = Number(depreciation[0]?.amount || 0)

    const sections: { operating: CashFlowEntry[]; investing: CashFlowEntry[]; financing: CashFlowEntry[] } = {
      operating: [
        { section: "operating", label: "Net Income", amount: income },
        { section: "operating", label: "Depreciation", amount: depAmount },
      ],
      investing: [],
      financing: [],
    }

    for (const row of workingCapitalChanges) {
      const change = Number(row.net_change)
      if (Math.abs(change) < 0.01) continue
      const accountCode = row.account_code
      const isAsset = accountCode.startsWith("1")
      const sign = isAsset ? -1 : 1
      sections.operating.push({
        section: "operating",
        label: `${row.account_name} (${accountCode})`,
        amount: change * sign,
        accountCode,
      })
    }

    for (const row of fixedAssetChanges) {
      const change = Number(row.net_change)
      if (Math.abs(change) < 0.01) continue
      sections.investing.push({
        section: "investing",
        label: `${row.account_name} (${row.account_code})`,
        amount: -change,
        accountCode: row.account_code,
      })
    }

    for (const row of financingChanges) {
      const change = Number(row.net_change)
      if (Math.abs(change) < 0.01) continue
      const accountCode = row.account_code
      const isLiability = accountCode.startsWith("2")
      const isEquity = accountCode.startsWith("3")
      const sign = isLiability || isEquity ? 1 : -1
      sections.financing.push({
        section: "financing",
        label: `${row.account_name} (${accountCode})`,
        amount: change * sign,
        accountCode,
      })
    }

    const opTotal = sections.operating.reduce((s, e) => s + e.amount, 0)
    const invTotal = sections.investing.reduce((s, e) => s + e.amount, 0)
    const finTotal = sections.financing.reduce((s, e) => s + e.amount, 0)

    return {
      sections,
      totals: { operating: opTotal, investing: invTotal, financing: finTotal, net: opTotal + invTotal + finTotal },
      reportTitle: "Statement of Cash Flows"
    }
  },

  async statementOfChangesInEquity(entitySchema: string, fromDate: string, toDate: string) {
    const beginningBalances = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(
                CASE WHEN a.normal_balance = 'debit'
                  THEN jel.debit - jel.credit
                  ELSE jel.credit - jel.debit
                END
              ), 0) as balance
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date < $1::date
       WHERE a.account_type = 'equity' AND a.account_code IN ('31100', '31200', '31300')
       GROUP BY a.id, a.account_code, a.account_name`,
      fromDate
    )

    const periodChanges = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name,
              COALESCE(SUM(
                CASE WHEN a.normal_balance = 'debit'
                  THEN jel.debit - jel.credit
                  ELSE jel.credit - jel.debit
                END
              ), 0) as net_change
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_type = 'equity' AND a.account_code IN ('31100', '31200', '31300')
       GROUP BY a.id, a.account_code, a.account_name`,
      fromDate, toDate
    )

    const netIncomeResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(
         CASE WHEN a.normal_balance = 'debit'
           THEN jel.debit - jel.credit
           ELSE jel.credit - jel.debit
         END
       ), 0) as amount
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date AND je.entry_date <= $2::date
       WHERE a.account_type IN ('revenue', 'expense', 'contra_revenue')`,
      fromDate, toDate
    )

    const netIncomeAmount = Number(netIncomeResult[0]?.amount || 0)

    const getBegBal = (code: string) => Number(beginningBalances.find((b: any) => b.account_code === code)?.balance || 0)
    const getPeriodChange = (code: string) => Number(periodChanges.find((c: any) => c.account_code === code)?.net_change || 0)

    const capitalRow = {
      account_code: "31100",
      account_name: "Capital",
      beginningBalance: getBegBal("31100"),
      netIncome: 0,
      otherChanges: getPeriodChange("31100"),
      endingBalance: getBegBal("31100") + getPeriodChange("31100")
    }

    const isNonProfit = getBegBal("31300") !== 0 || getPeriodChange("31300") !== 0
    const reNetIncome = isNonProfit ? 0 : netIncomeAmount
    const fbNetIncome = isNonProfit ? netIncomeAmount : 0

    const retainedEarningsRow = {
      account_code: "31200",
      account_name: "Retained Earnings",
      beginningBalance: getBegBal("31200"),
      netIncome: reNetIncome,
      otherChanges: getPeriodChange("31200"),
      endingBalance: getBegBal("31200") + reNetIncome + getPeriodChange("31200")
    }

    const fundBalanceRow = {
      account_code: "31300",
      account_name: "Fund Balance",
      beginningBalance: getBegBal("31300"),
      netIncome: fbNetIncome,
      otherChanges: getPeriodChange("31300"),
      endingBalance: getBegBal("31300") + fbNetIncome + getPeriodChange("31300")
    }

    const rows = [capitalRow, retainedEarningsRow, fundBalanceRow]

    const totals = {
      beginningBalance: rows.reduce((s, r) => s + r.beginningBalance, 0),
      netIncome: rows.reduce((s, r) => s + r.netIncome, 0),
      otherChanges: rows.reduce((s, r) => s + r.otherChanges, 0),
      endingBalance: rows.reduce((s, r) => s + r.endingBalance, 0)
    }

    return {
      reportTitle: "Statement of Changes in Equity",
      fromDate,
      toDate,
      rows,
      totals
    }
  }
}

