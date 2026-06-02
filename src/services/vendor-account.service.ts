import { prisma } from "@/lib/db"
import { apEngine } from "@/lib/accounting/ap-engine"

export const vendorAccountService = {
  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT va.*,
        COALESCE((SELECT SUM(balance) FROM "${entitySchema}".vendor_invoice WHERE vendor_id = va.id AND status IN ('unpaid','partial')), 0) as total_balance
       FROM "${entitySchema}".vendor_account va
       ORDER BY va.vendor_name`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".vendor_account WHERE id = $1::uuid`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, data: {
    vendorCode: string; vendorName: string; contactPerson?: string; address?: string
    tin?: string; contactNumber?: string; email?: string; paymentTerms?: string
  }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".vendor_account (vendor_code, vendor_name, contact_person, address, tin, contact_number, email, payment_terms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      data.vendorCode, data.vendorName, data.contactPerson || null, data.address || null,
      data.tin || null, data.contactNumber || null, data.email || null, data.paymentTerms || null
    ).then(r => r[0])
  },

  async getInvoices(entitySchema: string, vendorId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".vendor_invoice
       WHERE vendor_id = $1::uuid
       ORDER BY invoice_date DESC`,
      vendorId
    )
  },

  async createInvoice(
    entitySchema: string,
    userId: string,
    data: {
      vendorId: string
      invoiceNumber: string
      invoiceDate: string
      dueDate: string
      totalAmount: number
      expenseAccountCode?: string
    }
  ) {
    const vendor = await this.getById(entitySchema, data.vendorId)
    if (!vendor) throw new Error("Vendor not found")

    const invoice = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".vendor_invoice (invoice_number, vendor_id, invoice_date, due_date, total_amount, balance)
       VALUES ($1, $2, $3::date, $4::date, $5, $5) RETURNING *`,
      data.invoiceNumber, data.vendorId, data.invoiceDate, data.dueDate, data.totalAmount
    ).then((r) => r[0])

    await apEngine.postVendorInvoice(entitySchema, userId, {
      invoiceId: invoice.id,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      vendorName: vendor.vendor_name,
      totalAmount: data.totalAmount,
      expenseAccountCode: data.expenseAccountCode,
    })

    return invoice
  },

  async cancelInvoice(entitySchema: string, userId: string, invoiceId: string) {
    return apEngine.reverseVendorInvoice(entitySchema, userId, invoiceId)
  },
}
