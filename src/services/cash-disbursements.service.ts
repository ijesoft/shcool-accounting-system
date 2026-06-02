import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"
import { getBirSettings } from "@/lib/entity-settings"

export const cashDisbursementsService = {
  async list(entitySchema: string, opts?: { q?: string; page?: number; limit?: number }) {
    const q = opts?.q ?? ""
    const limit = opts?.limit ?? 20
    const page = opts?.page ?? 1
    const offset = (page - 1) * limit

    const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int as total
       FROM "${entitySchema}".disbursement d
       WHERE ($1 = '' OR d.cv_number ILIKE $2 OR d.payee_name ILIKE $2 OR COALESCE(d.tin,'') ILIKE $2 OR COALESCE(d.status,'') ILIKE $2 OR d.payment_method ILIKE $2)`,
      q, `%${q}%`
    )
    const total = countRows[0]?.total ?? 0

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement d
       WHERE ($1 = '' OR d.cv_number ILIKE $2 OR d.payee_name ILIKE $2 OR COALESCE(d.tin,'') ILIKE $2 OR COALESCE(d.status,'') ILIKE $2 OR d.payment_method ILIKE $2)
       ORDER BY d.cv_date DESC
       LIMIT $3 OFFSET $4`,
      q, `%${q}%`, limit, offset
    )

    return { rows, total }
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".disbursement WHERE id = $1::uuid`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    cvDate: string; payeeType: string; payeeName: string; payeeAddress?: string; tin?: string
    amount: number; paymentMethod: string; checkNumber?: string; checkDate?: string; bankAccount?: string
    withholdingTaxRate?: number; withholdingTaxType?: "expanded" | "creditable" | "final"
    withholdingFormCode?: string; description?: string
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

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (!entityRows[0]) throw new Error("Entity not found for schema")
    const entityId = entityRows[0].id

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2, $3)`,
      "11121", "21110", "21430"
    )
    const cashBankId = accounts.find((a: any) => a.account_code === "11121")?.id
    const apTradeId = accounts.find((a: any) => a.account_code === "21110")?.id
    const wtpId = accounts.find((a: any) => a.account_code === "21430")?.id
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
      `UPDATE "${entitySchema}".disbursement SET journal_entry_id = $1::uuid, status = 'paid' WHERE id = $2::uuid`,
      entry.id, disbursementId
    )

    if (dv.ap_invoice_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".vendor_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2::uuid`,
        dv.amount, dv.ap_invoice_id
      )
    }

    if (wtAmount > 0 && dv.tin) {
      const bir = await getBirSettings(entityId)
      const ewtRates = bir.ewtRates ?? []
      const matchedRate = ewtRates.find(
        (r: any) => Number(r.rate) === Number(dv.withholding_tax_rate)
      )

      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".withholding_tax_register (
          ewt_type, bir_form_code, disbursement_id,
          payee_name, payee_tin, payee_address,
          base_amount, tax_rate, tax_withheld, withholding_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::date)`,
        matchedRate?.ewtType || "expanded",
        matchedRate?.birFormCode || "0605E",
        dv.id,
        dv.payee_name,
        dv.tin,
        dv.payee_address || null,
        dv.amount,
        dv.withholding_tax_rate,
        wtAmount,
        dv.cv_date
      )
    }

    await auditLog.record({
      entityId,
      userId,
      action: "post",
      tableName: "disbursement",
      recordId: disbursementId,
      newValues: { cv_number: dv.cv_number },
    })

    return { journalEntry: entry }
  },
}
