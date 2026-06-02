import { prisma } from "@/lib/db"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

const CASH_ACCOUNT = "11120"
const DEFERRED_DEPOSIT_ACCOUNT = "21800"
const UNEARNED_TUITION_ACCOUNT = "21300"
const AR_STUDENT_ACCOUNT = "11210"

async function getAccountId(entitySchema: string, accountCode: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 AND is_active = TRUE`,
    accountCode
  )
  if (!rows[0]) throw new Error(`Account ${accountCode} not found`)
  return rows[0].id
}

export const enrollmentDepositService = {
  async applyToInvoice(
    entitySchema: string,
    userId: string,
    paymentId: string,
    invoiceId: string
  ) {
    const paymentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payment_transaction WHERE id = $1::uuid`,
      paymentId
    )
    const payment = paymentRows[0]
    if (!payment) throw new Error("Deposit payment not found")
    if (payment.payment_type !== "enrollment_deposit") {
      throw new Error("Payment is not an enrollment deposit")
    }
    if (payment.deposit_status !== "held") {
      throw new Error("Deposit is not in held status")
    }

    const invoiceRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".student_invoice WHERE id = $1::uuid`,
      invoiceId
    )
    const invoice = invoiceRows[0]
    if (!invoice) throw new Error("Invoice not found")
    if (Number(invoice.balance) <= 0) throw new Error("Invoice has no balance")

    const amount = Math.min(Number(payment.amount), Number(invoice.balance))
    const deferredId = await getAccountId(entitySchema, DEFERRED_DEPOSIT_ACCOUNT)
    const arId = await getAccountId(entitySchema, AR_STUDENT_ACCOUNT)

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: new Date().toISOString().split("T")[0],
      reference: payment.transaction_number,
      sourceModule: "CM",
      description: `Apply enrollment deposit ${payment.transaction_number} to ${invoice.invoice_number}`,
      createdBy: userId,
      lines: [
        {
          accountId: deferredId,
          debit: amount,
          credit: 0,
          lineDescription: "Apply deposit to AR",
          lineOrder: 1,
        },
        {
          accountId: arId,
          debit: 0,
          credit: amount,
          lineDescription: `Reduce AR - ${invoice.invoice_number}`,
          lineOrder: 2,
        },
      ],
    })

    const postResult = await postingEngine.post(
      entitySchema,
      entry.id,
      userId,
      entry.entry_date.toISOString().split("T")[0],
      [
        { accountId: deferredId, debit: amount, credit: 0 },
        { accountId: arId, debit: 0, credit: amount },
      ]
    )
    if (!postResult.success) {
      throw new Error(postResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".student_invoice
       SET balance = balance - $1,
           status = CASE
             WHEN balance - $1 <= 0 THEN 'paid'
             WHEN balance - $1 < total_amount THEN 'partial'
             ELSE status
           END,
           updated_at = NOW()
       WHERE id = $2::uuid`,
      amount,
      invoiceId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction
       SET deposit_status = 'applied', invoice_id = $2::uuid
       WHERE id = $1::uuid`,
      paymentId,
      invoiceId
    )

    return { amountApplied: amount, journalEntryId: entry.id }
  },

  async convertToUnearnedTuition(entitySchema: string, userId: string, paymentId: string) {
    const paymentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payment_transaction WHERE id = $1::uuid`,
      paymentId
    )
    const payment = paymentRows[0]
    if (!payment) throw new Error("Deposit payment not found")
    if (payment.payment_type !== "enrollment_deposit") {
      throw new Error("Payment is not an enrollment deposit")
    }
    if (payment.deposit_status !== "held") {
      throw new Error("Deposit is not in held status")
    }

    const amount = Number(payment.amount)
    const deferredId = await getAccountId(entitySchema, DEFERRED_DEPOSIT_ACCOUNT)
    const unearnedId = await getAccountId(entitySchema, UNEARNED_TUITION_ACCOUNT)

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: new Date().toISOString().split("T")[0],
      reference: payment.transaction_number,
      sourceModule: "CM",
      description: `Convert enrollment deposit ${payment.transaction_number} to unearned tuition`,
      createdBy: userId,
      lines: [
        {
          accountId: deferredId,
          debit: amount,
          credit: 0,
          lineDescription: "Release deferred deposit",
          lineOrder: 1,
        },
        {
          accountId: unearnedId,
          debit: 0,
          credit: amount,
          lineDescription: "Credit unearned tuition",
          lineOrder: 2,
        },
      ],
    })

    const postResult = await postingEngine.post(
      entitySchema,
      entry.id,
      userId,
      entry.entry_date.toISOString().split("T")[0],
      [
        { accountId: deferredId, debit: amount, credit: 0 },
        { accountId: unearnedId, debit: 0, credit: amount },
      ]
    )
    if (!postResult.success) {
      throw new Error(postResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction SET deposit_status = 'applied' WHERE id = $1::uuid`,
      paymentId
    )

    return { amount, journalEntryId: entry.id }
  },

  async refund(entitySchema: string, userId: string, paymentId: string) {
    const paymentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payment_transaction WHERE id = $1::uuid`,
      paymentId
    )
    const payment = paymentRows[0]
    if (!payment) throw new Error("Deposit payment not found")
    if (payment.payment_type !== "enrollment_deposit") {
      throw new Error("Payment is not an enrollment deposit")
    }
    if (payment.deposit_status !== "held") {
      throw new Error("Only held deposits can be refunded")
    }
    if (!payment.journal_entry_id) {
      throw new Error("Deposit has no posted journal entry")
    }

    const reverseResult = await postingEngine.reverse(
      entitySchema,
      payment.journal_entry_id,
      userId
    )
    if (!reverseResult.success) {
      throw new Error(reverseResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payment_transaction
       SET deposit_status = 'refunded', journal_entry_id = NULL
       WHERE id = $1::uuid`,
      paymentId
    )

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`,
      entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "void",
        tableName: "enrollment_deposit",
        recordId: paymentId,
        newValues: { transaction_number: payment.transaction_number },
      })
    }

    return { refunded: true }
  },

  async listHeldDeposits(entitySchema: string, studentId?: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, s.full_name as student_name
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student s ON s.id = pt.student_id
       WHERE pt.payment_type = 'enrollment_deposit'
         AND pt.deposit_status = 'held'
         AND ($1::uuid IS NULL OR pt.student_id = $1::uuid)
       ORDER BY pt.payment_date DESC`,
      studentId || null
    )
  },

  getDepositAccountCodes() {
    return { cash: CASH_ACCOUNT, deferred: DEFERRED_DEPOSIT_ACCOUNT }
  },
}
