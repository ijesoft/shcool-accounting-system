import { prisma } from "@/lib/db"

function err(message: string, code: string = "ERR_VALIDATION", status: number = 400) {
  return Object.assign(new Error(message), { status, code })
}

export const jeAllocationService = {
  /**
   * Applies a portion of a journal entry line's amount to an open subledger document
   * (student_invoice for AR, vendor_invoice for AP). The JE itself is not modified;
   * this only reduces the subledger document's balance.
   *
   * Returns the updated invoice/bill.
   */
  async applyToDocument(
    entitySchema: string,
    lineId: string,
    data: { documentId: string; amount: number }
  ) {
    const lines = await prisma.$queryRawUnsafe<Array<{
      id: string
      party_type: string | null
      party_id: string | null
      debit: number
      credit: number
      subledger_type: string | null
    }>>(
      `SELECT jel.id, jel.party_type, jel.party_id, jel.debit, jel.credit, a.subledger_type
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE jel.id = $1::uuid`,
      lineId
    )
    const line = lines[0]
    if (!line) throw new Error("Line not found")
    if (!line.party_type || !line.party_id) {
      throw err("Line is not tagged with a party")
    }

    const lineAmount = Number(line.debit) - Number(line.credit)
    if (line.party_type === "student") {
      if (data.amount > lineAmount) throw err("Apply amount exceeds line amount")
      const docs = await prisma.$queryRawUnsafe<Array<{
        id: string
        balance: number
        total_amount: number
        status: string
      }>>(
        `SELECT id, balance, total_amount, status FROM "${entitySchema}".student_invoice WHERE id = $1::uuid FOR UPDATE`,
        data.documentId
      )
      const doc = docs[0]
      if (!doc) throw new Error("Invoice not found")
      if (Number(data.amount) > Number(doc.balance)) {
        throw err("Apply amount exceeds invoice balance")
      }
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".student_invoice
         SET balance = balance - $1,
             status = CASE
               WHEN balance - $1 <= 0 THEN 'paid'
               WHEN balance - $1 < total_amount THEN 'partial'
               ELSE status
             END
         WHERE id = $2::uuid`,
        data.amount, data.documentId
      )
    } else if (line.party_type === "vendor") {
      if (-data.amount > lineAmount) throw err("Apply amount exceeds line amount")
      const docs = await prisma.$queryRawUnsafe<Array<{
        id: string
        balance: number
        total_amount: number
        status: string
      }>>(
        `SELECT id, balance, total_amount, status FROM "${entitySchema}".vendor_invoice WHERE id = $1::uuid FOR UPDATE`,
        data.documentId
      )
      const doc = docs[0]
      if (!doc) throw new Error("Bill not found")
      if (Number(data.amount) > Number(doc.balance)) {
        throw err("Apply amount exceeds bill balance")
      }
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".vendor_invoice
         SET balance = balance - $1,
             status = CASE
               WHEN balance - $1 <= 0 THEN 'paid'
               WHEN balance - $1 < total_amount THEN 'partial'
               ELSE status
             END
         WHERE id = $2::uuid`,
        data.amount, data.documentId
      )
    } else {
      throw err(`Apply flow not supported for party_type=${line.party_type}`)
    }
    return { ok: true, applied: data.amount, documentId: data.documentId }
  },
}
