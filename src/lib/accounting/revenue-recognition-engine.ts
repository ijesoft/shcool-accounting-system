import { prisma } from "@/lib/db"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { getEntitySettings } from "@/lib/entity-settings"
import { billingEngine } from "@/lib/accounting/billing-engine"

const UNEARNED_TUITION_CODE = "21300"
const TUITION_REVENUE_CODE = "41100"

interface InvoiceRecognitionCandidate {
  id: string
  invoice_number: string
  invoice_date: Date
  term_start_date: Date | null
  term_end_date: Date | null
  tuition_amount: number
  recognized_amount: number
}

async function getAccountId(entitySchema: string, accountCode: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 AND is_active = TRUE`,
    accountCode
  )
  if (!rows[0]) throw new Error(`Account ${accountCode} not found`)
  return rows[0].id
}

function defaultTermEnd(invoiceDate: Date): Date {
  const end = new Date(invoiceDate)
  end.setMonth(end.getMonth() + 4)
  return end
}

export const revenueRecognitionEngine = {
  async runForPeriod(
    entitySchema: string,
    entityId: string,
    userId: string,
    periodStart: string,
    periodEnd: string,
    fiscalPeriodId?: string
  ) {
    const settings = await getEntitySettings(entityId)
    if (settings.revenueRecognitionMethod === "immediate") {
      return { recognized: 0, entries: [] as string[], message: "Entity uses immediate revenue recognition" }
    }

    const periodStartDate = new Date(periodStart)
    const periodEndDate = new Date(periodEnd)

    const invoices = await prisma.$queryRawUnsafe<InvoiceRecognitionCandidate[]>(
      `SELECT si.id, si.invoice_number, si.invoice_date, si.term_start_date, si.term_end_date,
              COALESCE(SUM(sil.amount - COALESCE(sil.discount_amount, 0)), 0) as tuition_amount,
              COALESCE((
                SELECT SUM(rre.amount) FROM "${entitySchema}".revenue_recognition_entry rre
                WHERE rre.student_invoice_id = si.id
              ), 0) as recognized_amount
       FROM "${entitySchema}".student_invoice si
       JOIN "${entitySchema}".student_invoice_line sil ON sil.invoice_id = si.id
       WHERE si.status NOT IN ('cancelled')
         AND si.journal_entry_id IS NOT NULL
         AND LOWER(sil.fee_type) IN ('tuition', 'registration')
       GROUP BY si.id, si.invoice_number, si.invoice_date, si.term_start_date, si.term_end_date`
    )

    if (fiscalPeriodId) {
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as count FROM "${entitySchema}".revenue_recognition_entry WHERE fiscal_period_id = $1`,
        fiscalPeriodId
      )
      if (Number(existing[0]?.count || 0) > 0) {
        throw new Error("Revenue already recognized for this fiscal period")
      }
    }

    const unearnedAccountId = await getAccountId(entitySchema, UNEARNED_TUITION_CODE)
    const revenueAccountId = await getAccountId(entitySchema, TUITION_REVENUE_CODE)

    let totalRecognized = 0
    const entryIds: string[] = []

    for (const invoice of invoices) {
      const tuitionAmount = Number(invoice.tuition_amount)
      if (tuitionAmount <= 0) continue

      const termStart = invoice.term_start_date
        ? new Date(invoice.term_start_date)
        : new Date(invoice.invoice_date)
      const termEnd = invoice.term_end_date
        ? new Date(invoice.term_end_date)
        : defaultTermEnd(new Date(invoice.invoice_date))

      const overlap = billingEngine.overlapDays(
        termStart,
        termEnd,
        periodStartDate,
        periodEndDate
      )
      if (overlap <= 0) continue

      const termDays = billingEngine.daysBetween(termStart, termEnd)
      const alreadyRecognized = Number(invoice.recognized_amount)
      const remaining = Math.max(0, tuitionAmount - alreadyRecognized)
      if (remaining <= 0.01) continue

      const prorated = (tuitionAmount * overlap) / termDays
      const amount = Math.min(remaining, Math.round(prorated * 100) / 100)
      if (amount <= 0.01) continue

      const entry = await journalEntryRepository.create(entitySchema, {
        entryDate: periodEnd,
        reference: `REV-${invoice.invoice_number}`,
        sourceModule: "DR",
        description: `Revenue recognition - ${invoice.invoice_number}`,
        createdBy: userId,
        lines: [
          {
            accountId: unearnedAccountId,
            debit: amount,
            credit: 0,
            lineDescription: `Earn tuition - ${invoice.invoice_number}`,
            lineOrder: 1,
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: amount,
            lineDescription: `Tuition revenue - ${invoice.invoice_number}`,
            lineOrder: 2,
          },
        ],
      })

      const postResult = await postingEngine.post(
        entitySchema,
        entry.id,
        userId,
        periodEnd,
        [
          { accountId: unearnedAccountId, debit: amount, credit: 0 },
          { accountId: revenueAccountId, debit: 0, credit: amount },
        ]
      )

      if (!postResult.success) {
        throw new Error(postResult.errors.map((e) => e.message).join("; "))
      }

      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".revenue_recognition_entry
         (student_invoice_id, recognition_date, amount, journal_entry_id, fiscal_period_id)
         VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (student_invoice_id, fiscal_period_id) DO NOTHING`,
        invoice.id,
        periodEnd,
        amount,
        entry.id,
        fiscalPeriodId || null
      )

      totalRecognized += amount
      entryIds.push(entry.id)
    }

    return {
      recognized: totalRecognized,
      entries: entryIds,
      message: `Recognized ${totalRecognized.toFixed(2)} for period ${periodStart} to ${periodEnd}`,
    }
  },

  async getRollForward(entitySchema: string, asOfDate: string) {
    const openingUnearned = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) as balance
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND je.entry_date < $1::date
         AND a.account_code = $2`,
      asOfDate,
      UNEARNED_TUITION_CODE
    )

    const billingInPeriod = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(jel.credit), 0) as amount
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND je.source_module = 'AR'
         AND je.entry_date <= $1::date
         AND a.account_code = $2`,
      asOfDate,
      UNEARNED_TUITION_CODE
    )

    const recognizedInPeriod = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(jel.debit), 0) as amount
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND je.source_module = 'DR'
         AND je.entry_date <= $1::date
         AND a.account_code = $2`,
      asOfDate,
      UNEARNED_TUITION_CODE
    )

    const opening = Number(openingUnearned[0]?.balance || 0)
    const billings = Number(billingInPeriod[0]?.amount || 0)
    const recognized = Number(recognizedInPeriod[0]?.amount || 0)
    const closing = opening + billings - recognized

    const details = await prisma.$queryRawUnsafe<any[]>(
      `SELECT si.invoice_number, si.term, si.invoice_date,
              COALESCE(SUM(sil.amount - COALESCE(sil.discount_amount, 0)), 0) as tuition_billed,
              COALESCE(SUM(rre.amount), 0) as recognized
       FROM "${entitySchema}".student_invoice si
       JOIN "${entitySchema}".student_invoice_line sil ON sil.invoice_id = si.id
       LEFT JOIN "${entitySchema}".revenue_recognition_entry rre ON rre.student_invoice_id = si.id
       WHERE si.status NOT IN ('cancelled')
         AND LOWER(sil.fee_type) IN ('tuition', 'registration')
         AND si.invoice_date <= $1::date
       GROUP BY si.id, si.invoice_number, si.term, si.invoice_date
       ORDER BY si.invoice_date DESC`,
      asOfDate
    )

    return {
      asOfDate,
      openingBalance: opening,
      billingsAdded: billings,
      revenueRecognized: recognized,
      closingBalance: closing,
      invoices: details.map((row) => ({
        invoiceNumber: row.invoice_number,
        term: row.term,
        invoiceDate: row.invoice_date,
        tuitionBilled: Number(row.tuition_billed),
        recognized: Number(row.recognized),
        unearnedRemaining: Number(row.tuition_billed) - Number(row.recognized),
      })),
      reportTitle: "Unearned Tuition Roll-Forward",
    }
  },
}
