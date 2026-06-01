import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"

export const cashDisbursementsService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement ORDER BY cv_date DESC LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement WHERE id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    cvDate: string; payeeType: string; payeeName: string; payeeAddress?: string; tin?: string
    amount: number; paymentMethod: string; checkNumber?: string; checkDate?: string; bankAccount?: string
    withholdingTaxRate?: number; description?: string
  }) {
    const wtAmount = data.withholdingTaxRate ? (data.amount * data.withholdingTaxRate / 100) : 0
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".disbursement (cv_number, cv_date, payee_type, payee_name, payee_address, tin, amount, payment_method, check_number, check_date, bank_account, withholding_tax_amount, withholding_tax_rate, created_by)
       VALUES (
         (SELECT CONCAT('CV-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(cv_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".disbursement),
         $1::date, $2, $3, $4, $5, $6, $7, $8, $9::date, $10, $11, $12, $13
       ) RETURNING *`,
      data.cvDate, data.payeeType, data.payeeName, data.payeeAddress || null, data.tin || null,
      data.amount, data.paymentMethod, data.checkNumber || null, data.checkDate || null,
      data.bankAccount || null, wtAmount, data.withholdingTaxRate || null, userId
    )
    return rows[0]
  },

  async post(entitySchema: string, userId: string, disbursementId: string) {
    const dv = await this.getById(entitySchema, disbursementId)
    if (!dv) throw new Error("Disbursement not found")
    if (dv.journal_entry_id) throw new Error("Already posted")
    if (dv.status !== "draft") throw new Error("Can only post draft disbursements")

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2, $3)`,
      "11120", "21110", "21500"
    )
    const cashBankId = accounts.find((a: any) => a.account_code === "11120")?.id
    const apTradeId = accounts.find((a: any) => a.account_code === "21110")?.id
    const wtpId = accounts.find((a: any) => a.account_code === "21500")?.id
    if (!cashBankId) throw new Error("Cash in Bank account not found")

    const lines: { accountId: string; debit: number; credit: number }[] = []

    if (dv.payee_type === "vendor" && dv.ap_invoice_id) {
      if (!apTradeId) throw new Error("AP Trade account not found")
      lines.push({ accountId: apTradeId, debit: Number(dv.amount), credit: 0 })
    } else {
      lines.push({ accountId: (apTradeId || cashBankId), debit: Number(dv.amount), credit: 0 })
    }

    const wtAmount = Number(dv.withholding_tax_amount)
    if (wtAmount > 0 && wtpId) {
      lines.push({ accountId: wtpId, debit: 0, credit: wtAmount })
      lines.push({ accountId: cashBankId, debit: 0, credit: Number(dv.amount) - wtAmount })
    } else {
      lines.push({ accountId: cashBankId, debit: 0, credit: Number(dv.amount) })
    }

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: dv.cv_date.toISOString().split("T")[0],
      sourceModule: "CD",
      description: `Payment to ${dv.payee_name} - ${dv.cv_number}`,
      createdBy: userId,
      lines: lines.map((l, i) => ({ ...l, lineOrder: i + 1 })),
    })

    const result = await postingEngine.post(
      entitySchema, entry.id, userId,
      dv.cv_date.toISOString().split("T")[0],
      entry.lines.map((l: any) => ({
        accountId: l.account_id,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
    )
    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".disbursement SET journal_entry_id = $1, status = 'paid' WHERE id = $2`,
      entry.id, disbursementId
    )

    if (dv.ap_invoice_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".vendor_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2`,
        dv.amount, dv.ap_invoice_id
      )
    }

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "post",
        tableName: "disbursement",
        recordId: disbursementId,
        newValues: { cv_number: dv.cv_number },
      })
    }

    return { journalEntry: entry }
  },
}
