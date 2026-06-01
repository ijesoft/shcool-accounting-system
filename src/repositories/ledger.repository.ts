import { prisma } from "@/lib/db"

export const ledgerRepository = {
  async getBalances(entitySchema: string, fiscalPeriodId?: string) {
    if (fiscalPeriodId) {
      return prisma.$queryRawUnsafe<any[]>(
        `SELECT gl.*, a.account_code, a.account_name, a.account_type
         FROM "${entitySchema}".general_ledger gl
         JOIN "${entitySchema}".account a ON a.id = gl.account_id
         WHERE gl.fiscal_period_id = $1
         ORDER BY a.account_code`,
        fiscalPeriodId
      )
    }
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT a.id as account_id, a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted'
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`
    )
  },

  async updateRunningBalance(
    entitySchema: string,
    accountId: string,
    fiscalPeriodId: string,
    debit: number,
    credit: number,
    normalBalance: string
  ) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${entitySchema}".general_ledger 
       (account_id, fiscal_period_id, normal_balance, beginning_balance, total_debits, total_credits)
       VALUES ($1, $2, $3, 0, $4, $5)
       ON CONFLICT (account_id, fiscal_period_id)
       DO UPDATE SET 
         total_debits = general_ledger.total_debits + $4,
         total_credits = general_ledger.total_credits + $5,
         updated_at = NOW()`,
      accountId, fiscalPeriodId, normalBalance, debit, credit
    )
  },

  async getTrialBalance(entitySchema: string, fiscalPeriodId?: string) {
    if (fiscalPeriodId) {
      return prisma.$queryRawUnsafe<any[]>(
        `SELECT a.account_code, a.account_name, a.account_type,
                gl.total_debits, gl.total_credits,
                CASE WHEN a.normal_balance = 'debit' 
                  THEN gl.beginning_balance + gl.total_debits - gl.total_credits
                  ELSE gl.beginning_balance - gl.total_debits + gl.total_credits
                END as balance
         FROM "${entitySchema}".general_ledger gl
         JOIN "${entitySchema}".account a ON a.id = gl.account_id
         WHERE gl.fiscal_period_id = $1
         ORDER BY a.account_code`,
        fiscalPeriodId
      )
    }
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
              COALESCE(SUM(jel.debit), 0) as total_debits,
              COALESCE(SUM(jel.credit), 0) as total_credits
       FROM "${entitySchema}".account a
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.account_id = a.id
       LEFT JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted'
       GROUP BY a.id, a.account_code, a.account_name, a.account_type, a.normal_balance
       ORDER BY a.account_code`
    )
  },
}
