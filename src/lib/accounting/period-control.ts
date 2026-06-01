import { prisma } from "@/lib/db"
import { postingEngine } from "./posting-engine"

export interface PeriodControlError {
  code: string
  message: string
}

export const periodControl = {
  async canPostToPeriod(entitySchema: string, entryDate: Date): Promise<{ allowed: boolean; error?: PeriodControlError }> {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.id, fp.is_closed, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE $1 BETWEEN fp.start_date AND fp.end_date
       AND fy.entity_id = (SELECT id FROM public.entity WHERE schema_name = $2)
       LIMIT 1`,
      entryDate, entitySchema
    )

    if (!periodRows[0]) {
      return { allowed: false, error: { code: "ERR_PERIOD_NOT_FOUND", message: "No fiscal period found for this date" } }
    }

    if (periodRows[0].year_closed) {
      return { allowed: false, error: { code: "ERR_YEAR_CLOSED", message: "Fiscal year is closed" } }
    }

    if (periodRows[0].is_closed) {
      return { allowed: false, error: { code: "ERR_PERIOD_CLOSED", message: "Fiscal period is closed" } }
    }

    return { allowed: true }
  },

  async closePeriod(entitySchema: string, periodId: string, userId: string) {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.*, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE fp.id = $1`,
      periodId
    )

    if (!periodRows[0]) {
      throw { code: "ERR_PERIOD_NOT_FOUND", message: "Fiscal period not found" }
    }

    if (periodRows[0].is_closed) {
      throw { code: "ERR_PERIOD_ALREADY_CLOSED", message: "Fiscal period is already closed" }
    }

    const draftEntries = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM "${entitySchema}".journal_entry 
       WHERE status = 'draft' OR status = 'pending_approval'`
    )

    if (Number(draftEntries[0]?.count || 0) > 0) {
      throw { code: "ERR_DRAFT_ENTRIES_EXIST", message: "Cannot close period with draft or pending entries" }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_period SET is_closed = TRUE WHERE id = $1`,
      periodId
    )

    return { success: true }
  },

  async reopenPeriod(entitySchema: string, periodId: string, userId: string) {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.*, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE fp.id = $1`,
      periodId
    )

    if (!periodRows[0]) {
      throw { code: "ERR_PERIOD_NOT_FOUND", message: "Fiscal period not found" }
    }

    if (!periodRows[0].is_closed) {
      throw { code: "ERR_PERIOD_NOT_CLOSED", message: "Fiscal period is not closed" }
    }

    if (periodRows[0].year_closed) {
      throw { code: "ERR_YEAR_CLOSED", message: "Cannot reopen period — fiscal year is closed" }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_period SET is_closed = FALSE WHERE id = $1`,
      periodId
    )

    return { success: true }
  },

  async generateClosingEntry(entitySchema: string, fiscalYearId: string, userId: string) {
    const yearRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.fiscal_year WHERE id = $1`,
      fiscalYearId
    )
    if (!yearRows[0]) {
      throw { code: "ERR_YEAR_NOT_FOUND", message: "Fiscal year not found" }
    }
    const year = yearRows[0]

    // 1. Get required accounts
    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ('39000', '31200', '31300')`
    )
    const incomeSummary = accounts.find((a: any) => a.account_code === '39000')
    const retainedEarnings = accounts.find((a: any) => a.account_code === '31200')
    const fundBalance = accounts.find((a: any) => a.account_code === '31300')

    if (!incomeSummary) {
      throw { code: "ERR_INCOME_SUMMARY_NOT_FOUND", message: "Income Summary account (39000) not found" }
    }

    const equityAccount = fundBalance ? fundBalance : retainedEarnings
    if (!equityAccount) {
      throw { code: "ERR_EQUITY_ACCOUNT_NOT_FOUND", message: "Retained Earnings (31200) or Fund Balance (31300) account not found" }
    }

    // 2. Query revenue & expense balances
    const balances = await prisma.$queryRawUnsafe<any[]>(
      `SELECT a.id, a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as debits,
              COALESCE(SUM(jel.credit), 0) as credits
       FROM "${entitySchema}".account a
       JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
         AND je.status = 'posted'
         AND je.entry_date >= $1::date
         AND je.entry_date <= $2::date
       WHERE a.account_type IN ('revenue', 'expense', 'contra_revenue')
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance`,
      year.start_date, year.end_date
    )

    if (balances.length === 0) {
      throw { code: "ERR_NO_TRANSACTIONS", message: "No revenue or expense transactions to close" }
    }

    // 3. Build JE lines
    const lines: any[] = []
    let lineOrder = 1
    let totalRevenue = 0
    let totalExpenses = 0

    for (const bal of balances) {
      const debits = Number(bal.debits)
      const credits = Number(bal.credits)

      if (bal.account_type === 'revenue') {
        const netCredit = credits - debits
        if (Math.abs(netCredit) < 0.01) continue
        totalRevenue += netCredit
        
        lines.push({
          accountId: bal.id,
          debit: netCredit > 0 ? netCredit : 0,
          credit: netCredit < 0 ? Math.abs(netCredit) : 0,
          lineDescription: `Closing revenue account ${bal.account_code}`,
          lineOrder: lineOrder++
        })
        lines.push({
          accountId: incomeSummary.id,
          debit: netCredit < 0 ? Math.abs(netCredit) : 0,
          credit: netCredit > 0 ? netCredit : 0,
          lineDescription: `Closing revenue account ${bal.account_code} to Income Summary`,
          lineOrder: lineOrder++
        })
      } else if (bal.account_type === 'expense') {
        const netDebit = debits - credits
        if (Math.abs(netDebit) < 0.01) continue
        totalExpenses += netDebit

        lines.push({
          accountId: bal.id,
          debit: netDebit < 0 ? Math.abs(netDebit) : 0,
          credit: netDebit > 0 ? netDebit : 0,
          lineDescription: `Closing expense account ${bal.account_code}`,
          lineOrder: lineOrder++
        })
        lines.push({
          accountId: incomeSummary.id,
          debit: netDebit > 0 ? netDebit : 0,
          credit: netDebit < 0 ? Math.abs(netDebit) : 0,
          lineDescription: `Closing expense account ${bal.account_code} to Income Summary`,
          lineOrder: lineOrder++
        })
      } else if (bal.account_type === 'contra_revenue') {
        const netDebit = debits - credits
        if (Math.abs(netDebit) < 0.01) continue
        totalRevenue -= netDebit

        lines.push({
          accountId: bal.id,
          debit: netDebit < 0 ? Math.abs(netDebit) : 0,
          credit: netDebit > 0 ? netDebit : 0,
          lineDescription: `Closing contra-revenue account ${bal.account_code}`,
          lineOrder: lineOrder++
        })
        lines.push({
          accountId: incomeSummary.id,
          debit: netDebit > 0 ? netDebit : 0,
          credit: netDebit < 0 ? Math.abs(netDebit) : 0,
          lineDescription: `Closing contra-revenue account ${bal.account_code} to Income Summary`,
          lineOrder: lineOrder++
        })
      }
    }

    const netIncome = totalRevenue - totalExpenses
    if (Math.abs(netIncome) > 0.01) {
      if (netIncome > 0) {
        lines.push({
          accountId: incomeSummary.id,
          debit: netIncome,
          credit: 0,
          lineDescription: `Closing Income Summary to ${equityAccount.account_code === '31300' ? 'Fund Balance' : 'Retained Earnings'}`,
          lineOrder: lineOrder++
        })
        lines.push({
          accountId: equityAccount.id,
          debit: 0,
          credit: netIncome,
          lineDescription: `Closing Income Summary to ${equityAccount.account_code === '31300' ? 'Fund Balance' : 'Retained Earnings'}`,
          lineOrder: lineOrder++
        })
      } else {
        const absLoss = Math.abs(netIncome)
        lines.push({
          accountId: incomeSummary.id,
          debit: 0,
          credit: absLoss,
          lineDescription: `Closing Income Summary (Loss) to ${equityAccount.account_code === '31300' ? 'Fund Balance' : 'Retained Earnings'}`,
          lineOrder: lineOrder++
        })
        lines.push({
          accountId: equityAccount.id,
          debit: absLoss,
          credit: 0,
          lineDescription: `Closing Income Summary (Loss) to ${equityAccount.account_code === '31300' ? 'Fund Balance' : 'Retained Earnings'}`,
          lineOrder: lineOrder++
        })
      }
    }

    if (lines.length === 0) {
      throw { code: "ERR_NO_TRANSACTIONS", message: "No balances to close" }
    }

    // 4. Generate JE number and insert approved JE
    const nextNumResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 5, '0')) as num 
       FROM "${entitySchema}".number_series WHERE series_type = 'JE' LIMIT 1`
    )
    if (!nextNumResult[0]) {
      throw { code: "ERR_NUMBER_SERIES_NOT_FOUND", message: "JE number series not found" }
    }
    const entryNumber = nextNumResult[0].num

    const entryResult = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".journal_entry 
       (entry_number, entry_date, reference, source_module, description, status, created_by)
       VALUES ($1, $2, $3, 'JE', $4, 'approved', $5) RETURNING *`,
      entryNumber, year.end_date, `CLSE-${year.name}`, `Year-end closing entry for ${year.name}`, userId
    )
    const entry = entryResult[0]

    for (const line of lines) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".journal_entry_line
         (journal_entry_id, account_id, debit, credit, line_description, line_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        entry.id, line.accountId, line.debit, line.credit, line.lineDescription, line.lineOrder
      )
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'JE'`
    )

    // 5. Post the closing entry
    const postResult = await postingEngine.post(
      entitySchema, entry.id, userId,
      entry.entry_date.toISOString().split('T')[0],
      lines
    )

    if (!postResult.success) {
      throw { code: "ERR_POSTING_CLOSING_ENTRY_FAILED", message: postResult.errors[0].message }
    }

    return { success: true, journalEntryId: entry.id }
  },

  async closeYear(entitySchema: string, fiscalYearId: string, userId: string) {
    const yearRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.fiscal_year WHERE id = $1`,
      fiscalYearId
    )

    if (!yearRows[0]) {
      throw { code: "ERR_YEAR_NOT_FOUND", message: "Fiscal year not found" }
    }

    if (yearRows[0].is_closed) {
      throw { code: "ERR_YEAR_ALREADY_CLOSED", message: "Fiscal year is already closed" }
    }

    // 1. Generate & Post closing entry
    await this.generateClosingEntry(entitySchema, fiscalYearId, userId)

    // 2. Close all periods
    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_period SET is_closed = TRUE WHERE fiscal_year_id = $1`,
      fiscalYearId
    )

    // 3. Close the fiscal year
    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_year SET is_closed = TRUE WHERE id = $1`,
      fiscalYearId
    )

    return { success: true }
  },
}
