import { prisma } from "@/lib/db"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const officialReceiptService = {
  async void(entitySchema: string, userId: string, receiptId: string, reason?: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT or_.*, pt.id as payment_id, pt.invoice_id, pt.amount as payment_amount, pt.journal_entry_id as payment_je_id
       FROM "${entitySchema}".official_receipt or_
       LEFT JOIN "${entitySchema}".payment_transaction pt ON pt.id = or_.cash_receipt_id
       WHERE or_.id = $1::uuid`,
      receiptId
    )
    const receipt = rows[0]
    if (!receipt) throw new Error("Official receipt not found")
    if (receipt.status === "void") throw new Error("Receipt is already void")

    const journalEntryId = receipt.journal_entry_id || receipt.payment_je_id
    if (!journalEntryId) {
      throw new Error("Receipt has no linked journal entry")
    }

    const reverseResult = await postingEngine.reverse(entitySchema, journalEntryId, userId)
    if (!reverseResult.success) {
      throw new Error(reverseResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".official_receipt
       SET status = 'void', void_reason = $2
       WHERE id = $1::uuid`,
      receiptId,
      reason || null
    )

    if (receipt.payment_id) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".payment_transaction
         SET journal_entry_id = NULL, official_receipt_id = NULL
         WHERE id = $1::uuid`,
        receipt.payment_id
      )
    }

    if (receipt.invoice_id && receipt.payment_amount) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice
         SET balance = balance + $1,
             status = CASE
               WHEN balance + $1 >= total_amount THEN 'unpaid'
               WHEN balance + $1 > 0 THEN 'partial'
               ELSE status
             END,
             updated_at = NOW()
         WHERE id = $2::uuid`,
        receipt.payment_amount,
        receipt.invoice_id
      )
    }

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`,
      entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "void",
        tableName: "official_receipt",
        recordId: receiptId,
        newValues: { or_number: receipt.or_number, reason: reason || null },
      })
    }

    return receipt
  },
}
