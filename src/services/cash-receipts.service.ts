import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"

export const cashReceiptsService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       ORDER BY pt.payment_date DESC
       LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE pt.id = $1`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    studentId?: string; invoiceId?: string; paymentDate: string; amount: number
    paymentMethod: string; checkNumber?: string; checkDate?: string; bankName?: string; reference?: string
    payorName?: string; payorAddress?: string; tin?: string
  }) {
    const txns = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".payment_transaction (transaction_number, student_id, invoice_id, payment_date, amount, payment_method, check_number, check_date, bank_name, reference, payor_name, payor_address, tin)
       VALUES (
         (SELECT CONCAT('PMT-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(transaction_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".payment_transaction),
         $1, $2, $3::date, $4, $5, $6, $7::date, $8, $9, $10, $11, $12
       ) RETURNING *`,
      data.studentId || null, data.invoiceId || null, data.paymentDate, data.amount,
      data.paymentMethod, data.checkNumber || null, data.checkDate || null, data.bankName || null, data.reference || null,
      data.payorName || null, data.payorAddress || null, data.tin || null
    )
    return txns[0]
  },

  async post(entitySchema: string, userId: string, paymentId: string) {
    const payment = await this.getById(entitySchema, paymentId)
    if (!payment) throw new Error("Payment not found")
    if (payment.journal_entry_id) throw new Error("Already posted")

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2)`,
      "11120", "11210"
    )
    const cashBankId = accounts.find((a: any) => a.account_code === "11120")?.id
    const arStudentId = accounts.find((a: any) => a.account_code === "11210")?.id
    if (!cashBankId || !arStudentId) throw new Error("Required accounts not found")

    const payorName = payment.payor_name || payment.student_name || "unknown"
    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: payment.payment_date.toISOString().split("T")[0],
      sourceModule: "CM",
      description: `Payment from ${payorName} - ${payment.transaction_number}`,
      createdBy: userId,
      lines: [
        { accountId: cashBankId, debit: Number(payment.amount), credit: 0, lineOrder: 1 },
        { accountId: arStudentId, debit: 0, credit: Number(payment.amount), lineOrder: 2 },
      ],
    })

    const result = await postingEngine.post(
      entitySchema, entry.id, userId,
      payment.payment_date.toISOString().split("T")[0],
      entry.lines.map((l: any) => ({
        accountId: l.account_id,
        debit: Number(l.debit),
        credit: Number(l.credit),
      }))
    )
    if (!result.success) {
      throw new Error(result.errors.map(e => e.message).join("; "))
    }

    const orRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".official_receipt (or_number, or_date, cash_receipt_id, student_id, payor_name, payor_address, tin, amount, journal_entry_id, created_by)
       VALUES (
         (SELECT CONCAT('OR-', LPAD(COALESCE(MAX(CAST(SPLIT_PART(or_number, '-', 2) AS INT)), 0) + 1, 6, '0')) FROM "${entitySchema}".official_receipt),
         $1::date, $2, $3, $4, $5, $6, $7, $8, $9
       ) RETURNING *`,
      payment.payment_date, payment.id, payment.student_id, payorName,
      null, null, payment.amount, entry.id, userId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction SET journal_entry_id = $1, official_receipt_id = $2 WHERE id = $3`,
      entry.id, orRows[0].id, paymentId
    )

    if (payment.invoice_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2`,
        payment.amount, payment.invoice_id
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
        tableName: "cash_receipt",
        recordId: paymentId,
        newValues: { transaction_number: payment.transaction_number },
      })
    }

    return { journalEntry: entry, officialReceipt: orRows[0] }
  },
}
