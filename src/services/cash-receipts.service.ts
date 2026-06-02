import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"
import { getBirSettings, isVatRegistered } from "@/lib/entity-settings"
import { vatEngine } from "@/lib/accounting/vat-engine"

export const cashReceiptsService = {
  async list(entitySchema: string, opts?: { q?: string; page?: number; limit?: number }) {
    const q = opts?.q ?? ""
    const limit = opts?.limit ?? 20
    const page = opts?.page ?? 1
    const offset = (page - 1) * limit

    const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int as total
       FROM "${entitySchema}".payment_transaction pt
       WHERE ($1 = '' OR pt.transaction_number ILIKE $2 OR COALESCE(pt.payor_name,'') ILIKE $2 OR pt.payment_method ILIKE $2 OR CAST(pt.amount AS TEXT) ILIKE $2)`,
      q, `%${q}%`
    )
    const total = countRows[0]?.total ?? 0

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE ($1 = '' OR pt.transaction_number ILIKE $2 OR COALESCE(pt.payor_name,'') ILIKE $2 OR pt.payment_method ILIKE $2 OR CAST(pt.amount AS TEXT) ILIKE $2)
       ORDER BY pt.payment_date DESC
       LIMIT $3 OFFSET $4`,
      q, `%${q}%`, limit, offset
    )

    return { rows, total }
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE pt.id = $1::uuid`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, userId: string, data: {
    studentId?: string; invoiceId?: string; paymentDate: string; amount: number
    paymentMethod: string; paymentType?: "tuition" | "enrollment_deposit"
    checkNumber?: string; checkDate?: string; bankName?: string; reference?: string
    payorName?: string; payorAddress?: string; tin?: string
  }) {
    const paymentType = data.paymentType || "tuition"
    const depositStatus = paymentType === "enrollment_deposit" ? "held" : null

    const txns = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".payment_transaction
       (transaction_number, student_id, invoice_id, payment_date, amount, payment_method,
        check_number, check_date, bank_name, reference, payor_name, payor_address, tin,
        payment_type, deposit_status)
       VALUES (
         (SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 6, '0'))
          FROM "${entitySchema}".number_series WHERE series_type = 'PMT' LIMIT 1),
         $1, $2, $3::date, $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13, $14
       ) RETURNING *`,
      data.studentId || null, data.invoiceId || null, data.paymentDate, data.amount,
      data.paymentMethod, data.checkNumber || null, data.checkDate || null, data.bankName || null, data.reference || null,
      data.payorName || null, data.payorAddress || null, data.tin || null,
      paymentType, depositStatus
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'PMT'`
    )
    return txns[0]
  },

  async post(entitySchema: string, userId: string, paymentId: string) {
    const payment = await this.getById(entitySchema, paymentId)
    if (!payment) throw new Error("Payment not found")
    if (payment.journal_entry_id) throw new Error("Already posted")

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (!entityRows[0]) throw new Error("Entity not found for schema")
    const entityId = entityRows[0].id

    const bir = await getBirSettings(entityId)
    const vatRegistered = isVatRegistered(bir)
    const vatRate = bir.vatRate ?? 12

    const isDeposit = payment.payment_type === "enrollment_deposit"
    const creditAccountCode = isDeposit ? "21800" : "11210"
    const debitAccountCode = "11120"

    const accounts = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, account_code FROM "${entitySchema}".account WHERE account_code IN ($1, $2)`,
      debitAccountCode, creditAccountCode
    )
    const cashBankId = accounts.find((a: any) => a.account_code === debitAccountCode)?.id
    const creditAccountId = accounts.find((a: any) => a.account_code === creditAccountCode)?.id
    if (!cashBankId || !creditAccountId) throw new Error("Required accounts not found")

    const payorName = payment.payor_name || payment.student_name || "unknown"
    const description = isDeposit
      ? `Enrollment deposit from ${payorName} - ${payment.transaction_number}`
      : `Payment from ${payorName} - ${payment.transaction_number}`

    const jeLines = [
      { accountId: cashBankId, debit: Number(payment.amount), credit: 0, lineOrder: 1 },
      { accountId: creditAccountId, debit: 0, credit: Number(payment.amount), lineOrder: 2 },
    ]

    if (vatRegistered) {
      const outputVatId = await vatEngine.getOutputVatAccountId(entitySchema)
      if (outputVatId) {
        const isExempt = vatEngine.isFeeTypeVatExempt("tuition")
        const calc = vatEngine.calculate(Number(payment.amount), vatRate, isExempt)
        if (calc.vatAmount > 0) {
          jeLines[1].credit = Number((jeLines[1].credit - calc.vatAmount).toFixed(2))
          jeLines.push({
            accountId: outputVatId,
            debit: 0,
            credit: calc.vatAmount,
            lineOrder: 3,
          })
        }
      }
    }

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: payment.payment_date.toISOString().split("T")[0],
      sourceModule: "CM",
      description,
      createdBy: userId,
      lines: jeLines,
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

    const isExempt = vatEngine.isFeeTypeVatExempt("tuition")
    const calc = vatEngine.calculate(Number(payment.amount), vatRate, isExempt)

    const serialRange = await this.getActiveSerialRange(entitySchema, "official_receipt")

    const orRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".official_receipt (
        or_number, or_date, cash_receipt_id, student_id, payor_name, payor_address, tin,
        amount, vat_amount, vat_exempt_amount, vat_rate, is_zero_rated,
        bir_serial_number, bir_accredited_printer_tin, bir_permit_number,
        journal_entry_id, created_by
      ) VALUES (
        (SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 6, '0'))
         FROM "${entitySchema}".number_series WHERE series_type = 'OR' LIMIT 1),
        $1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING *`,
      payment.payment_date,
      payment.id,
      payment.student_id,
      payorName,
      payment.payor_address || null,
      payment.tin || null,
      payment.amount,
      calc.vatAmount,
      calc.vatExemptAmount,
      vatRate,
      false,
      serialRange?.bir_serial_number || null,
      serialRange?.accredited_printer_tin || null,
      serialRange?.permit_number || null,
      entry.id,
      userId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'OR'`
    )

    const orId = orRows[0].id
    await prisma.$queryRawUnsafe(
      `INSERT INTO "${entitySchema}".official_receipt_line (
        official_receipt_id, description, amount, vat_exempt_sales, vat_sales, vat_amount
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      orId,
      isDeposit ? "Enrollment Deposit" : "Tuition Payment",
      payment.amount,
      calc.vatExemptAmount,
      calc.taxableAmount,
      calc.vatAmount
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction SET journal_entry_id = $1::uuid, official_receipt_id = $2::uuid WHERE id = $3::uuid`,
      entry.id, orId, paymentId
    )

    if (payment.invoice_id && !isDeposit) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'paid' WHEN balance - $1 < total_amount THEN 'partial' ELSE status END WHERE id = $2::uuid`,
        payment.amount, payment.invoice_id
      )
    }

    await auditLog.record({
      entityId,
      userId,
      action: "post",
      tableName: "cash_receipt",
      recordId: paymentId,
      newValues: { transaction_number: payment.transaction_number },
    })

    return { journalEntry: entry, officialReceipt: orRows[0] }
  },

  async getActiveSerialRange(entitySchema: string, documentType: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".bir_serial_range
       WHERE document_type = $1 AND is_active = TRUE
       ORDER BY created_at DESC LIMIT 1`,
      documentType
    )
    return rows[0] || null
  },
}
