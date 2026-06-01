import { prisma } from "@/lib/db"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { postingEngine } from "@/lib/accounting/posting-engine"

const AP_ACCOUNT_CODE = "21110"
const DEFAULT_EXPENSE_ACCOUNT = "51800"

async function getAccountId(entitySchema: string, accountCode: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 AND is_active = TRUE`,
    accountCode
  )
  if (!rows[0]) {
    throw new Error(`Account ${accountCode} not found`)
  }
  return rows[0].id
}

export const apEngine = {
  async postVendorInvoice(
    entitySchema: string,
    userId: string,
    data: {
      invoiceId: string
      invoiceNumber: string
      invoiceDate: string
      vendorName: string
      totalAmount: number
      expenseAccountCode?: string
    }
  ) {
    const amount = Number(data.totalAmount)
    if (amount <= 0) {
      throw new Error("Invoice total must be greater than zero")
    }

    const expenseCode = data.expenseAccountCode ?? DEFAULT_EXPENSE_ACCOUNT
    const expenseAccountId = await getAccountId(entitySchema, expenseCode)
    const apAccountId = await getAccountId(entitySchema, AP_ACCOUNT_CODE)

    const lines = [
      {
        accountId: expenseAccountId,
        debit: amount,
        credit: 0,
        lineDescription: `Expense - ${data.invoiceNumber}`,
        lineOrder: 1,
      },
      {
        accountId: apAccountId,
        debit: 0,
        credit: amount,
        lineDescription: `AP - ${data.vendorName}`,
        lineOrder: 2,
      },
    ]

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: data.invoiceDate,
      reference: data.invoiceNumber,
      sourceModule: "AP",
      description: `Vendor invoice - ${data.vendorName} - ${data.invoiceNumber}`,
      createdBy: userId,
      lines,
    })

    const postResult = await postingEngine.post(
      entitySchema,
      entry.id,
      userId,
      data.invoiceDate,
      lines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
      }))
    )

    if (!postResult.success) {
      throw new Error(postResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".vendor_invoice SET journal_entry_id = $1, updated_at = NOW() WHERE id = $2`,
      entry.id,
      data.invoiceId
    )

    return entry
  },

  async reverseVendorInvoice(entitySchema: string, userId: string, invoiceId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT journal_entry_id, status FROM "${entitySchema}".vendor_invoice WHERE id = $1`,
      invoiceId
    )
    const invoice = rows[0]
    if (!invoice?.journal_entry_id) {
      throw new Error("Invoice has no posted journal entry")
    }
    if (invoice.status === "cancelled") {
      throw new Error("Invoice is already cancelled")
    }

    const result = await postingEngine.reverse(entitySchema, invoice.journal_entry_id, userId)
    if (!result.success) {
      throw new Error(result.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".vendor_invoice SET status = 'cancelled', balance = 0, updated_at = NOW() WHERE id = $1`,
      invoiceId
    )

    return result
  },
}
