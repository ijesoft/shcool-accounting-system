import { prisma } from "@/lib/db"
import { ledgerRepository } from "@/repositories/ledger.repository"
import { periodControl } from "./period-control"

export interface PostingError {
  code: string
  message: string
}

export interface PostingResult {
  success: boolean
  errors: PostingError[]
}

async function getCurrentFiscalPeriod(entitySchema: string, entryDate: Date): Promise<string | null> {
  const periods = await prisma.$queryRawUnsafe<any[]>(
    `SELECT fp.id FROM public.fiscal_period fp
     JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
     WHERE $1 BETWEEN fp.start_date AND fp.end_date
     AND fy.entity_id = (SELECT id FROM public.entity WHERE schema_name = $2)
     LIMIT 1`,
    entryDate, entitySchema
  )
  return periods[0]?.id || null
}

export const postingEngine = {
  async validate(
    entitySchema: string,
    entry: { lines: { accountId: string; debit: number; credit: number }[] }
  ): Promise<PostingError[]> {
    const errors: PostingError[] = []

    // Check all accounts exist and are postable (level >= 3)
    for (const line of entry.lines) {
      const accounts = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, account_code, account_name, level, is_active 
         FROM "${entitySchema}".account WHERE id = $1::uuid`,
        line.accountId
      )
      if (!accounts[0]) {
        errors.push({ code: "ERR_ACCOUNT_NOT_FOUND", message: `Account ${line.accountId} not found` })
        continue
      }
      const account = accounts[0]
      if (!account.is_active) {
        errors.push({ code: "ERR_ACCOUNT_INACTIVE", message: `Account ${account.account_code} is inactive` })
      }
      if (account.level < 3) {
        errors.push({ code: "ERR_ACCOUNT_NOT_POSTABLE", message: `Account ${account.account_code} is a header (level ${account.level}), not postable` })
      }
    }

    // Check balance
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errors.push({ code: "ERR_UNBALANCED_ENTRY", message: `Total debits (${totalDebit}) != total credits (${totalCredit})` })
    }

    return errors
  },

  async post(
    entitySchema: string,
    entryId: string,
    userId: string,
    entryDateStr: string,
    lines: { accountId: string; debit: number; credit: number }[]
  ): Promise<PostingResult> {
    const errors = await this.validate(entitySchema, { lines })
    if (errors.length > 0) {
      return { success: false, errors }
    }

    const entryDate = new Date(entryDateStr)
    const periodCheck = await periodControl.canPostToPeriod(entitySchema, entryDate)
    if (!periodCheck.allowed) {
      return { success: false, errors: [{ code: periodCheck.error!.code, message: periodCheck.error!.message }] }
    }

    const fiscalPeriodId = await getCurrentFiscalPeriod(entitySchema, entryDate)
    if (!fiscalPeriodId) {
      return { success: false, errors: [{ code: "ERR_FISCAL_PERIOD_NOT_FOUND", message: "No active fiscal period for this date" }] }
    }

    // Post within a transaction
    try {
      await prisma.$transaction(async (tx) => {
        // Update journal entry status
        await tx.$queryRawUnsafe(
          `UPDATE "${entitySchema}".journal_entry 
           SET status = 'posted', posted_at = NOW(), posted_by = $1::uuid, fiscal_period_id = $2::uuid, updated_at = NOW()
           WHERE id = $3::uuid`,
          userId, fiscalPeriodId, entryId
        )

        // Update GL running balances
        for (const line of lines) {
          const accounts = await tx.$queryRawUnsafe<any[]>(
            `SELECT normal_balance FROM "${entitySchema}".account WHERE id = $1::uuid`,
            line.accountId
          )
          if (accounts[0]) {
            await ledgerRepository.updateRunningBalance(
              entitySchema, line.accountId, fiscalPeriodId, line.debit, line.credit, accounts[0].normal_balance
            )
          }
        }
      })

      return { success: true, errors: [] }
    } catch (error) {
      return { success: false, errors: [{ code: "ERR_POSTING_FAILED", message: error instanceof Error ? error.message : "Posting failed" }] }
    }
  },

  async reverse(
    entitySchema: string,
    originalEntryId: string,
    userId: string
  ): Promise<PostingResult> {
    const original = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".journal_entry WHERE id = $1::uuid`,
      originalEntryId
    )
    if (!original[0]) return { success: false, errors: [{ code: "ERR_ENTRY_NOT_FOUND", message: "Original entry not found" }] }
    if (original[0].status !== 'posted') return { success: false, errors: [{ code: "ERR_ENTRY_NOT_POSTED", message: "Can only reverse a posted entry" }] }

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = $1::uuid ORDER BY line_order`,
      originalEntryId
    )
    if (!original[0]) {
      return { success: false, errors: [{ code: "ERR_ENTRY_NOT_FOUND", message: "Original entry not found" }] }
    }
    if (original[0].status !== 'posted') {
      return { success: false, errors: [{ code: "ERR_ENTRY_NOT_POSTED", message: "Can only reverse a posted entry" }] }
    }

    // Create reversing lines (swap debits and credits)
    const reversedLines = lines.map((l: any) => ({
      accountId: l.account_id,
      debit: l.credit,
      credit: l.debit,
      lineDescription: `Reversing: ${l.line_description || ''}`,
      lineOrder: l.line_order,
    }))

    // Create reversing entry on the original entry date
    const reverseDate = original[0].entry_date
    const newEntry = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".journal_entry 
       (entry_number, entry_date, reference, source_module, description, status, created_by)
       VALUES (
         (SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 5, '0'))
          FROM "${entitySchema}".number_series WHERE series_type = 'JE' LIMIT 1),
         $1::date, $2, 'JE', $3, 'approved', $4::uuid
       ) RETURNING *`,
      reverseDate, `REV-${original[0].entry_number}`, `Reversing entry for ${original[0].entry_number}`, userId
    )

    for (const line of reversedLines) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".journal_entry_line
         (journal_entry_id, account_id, debit, credit, line_description, line_order)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
        newEntry[0].id, line.accountId, line.debit, line.credit, line.lineDescription, line.lineOrder
      )
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'JE'`
    )

    // Mark original as void
    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".journal_entry SET status = 'void', updated_at = NOW() WHERE id = $1::uuid`,
      originalEntryId
    )

    // Auto-post the reversing entry
    const postResult = await this.post(
      entitySchema, newEntry[0].id, userId,
      newEntry[0].entry_date.toISOString().split('T')[0],
      reversedLines
    )

    return postResult
  },
}
