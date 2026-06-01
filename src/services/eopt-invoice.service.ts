import { prisma } from "@/lib/db"
import { getBirSettings, isVatRegistered } from "@/lib/entity-settings"
import { vatEngine } from "@/lib/accounting/vat-engine"
import { documentTemplates } from "@/lib/bir/document-templates"
import { birSerialRangeService } from "@/services/bir-serial-range.service"

export const eoptInvoiceService = {
  async generateInvoice(
    entitySchema: string,
    entityId: string,
    userId: string,
    data: {
      studentId?: string
      studentInvoiceId?: string
      payorName: string
      payorAddress?: string
      payorTin?: string
      invoiceDate: string
      dueDate?: string
      lines: { feeType: string; amount: number }[]
    }
  ) {
    const bir = await getBirSettings(entityId)
    const vatRegistered = isVatRegistered(bir)
    const vatRate = bir.vatRate ?? 12

    const totalAmount = data.lines.reduce((sum, line) => sum + Number(line.amount), 0)
    if (totalAmount <= 0) {
      throw new Error("Invoice total must be greater than zero")
    }

    const lineCalcs = data.lines.map((line) => {
      const isExempt = vatEngine.isFeeTypeVatExempt(line.feeType)
      return vatEngine.calculateLine(
        line.feeType,
        line.feeType,
        Number(line.amount),
        vatRate,
        vatRegistered ? !isExempt : true,
        false
      )
    })

    const totalVat = Number(lineCalcs.reduce((sum, lc) => sum + lc.vatAmount, 0).toFixed(2))
    const totalVatExempt = Number(lineCalcs.reduce((sum, lc) => sum + lc.vatExemptSales, 0).toFixed(2))
    const totalZeroRated = Number(lineCalcs.reduce((sum, lc) => sum + lc.zeroRatedSales, 0).toFixed(2))

    const serialRange = await birSerialRangeService.list(entitySchema).then(
      (ranges) => ranges.find((r: any) => r.document_type === "invoice" && r.is_active)
    )

    const invRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".sales_invoice (
        invoice_number, student_id, student_invoice_id,
        payor_name, payor_address, payor_tin,
        invoice_date, due_date,
        amount, vat_amount, vat_exempt_amount, zero_rated_amount, vat_rate, is_vat_exempt,
        bir_serial_number, bir_accredited_printer_tin, bir_permit_number,
        created_by
      ) VALUES (
        (SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 6, '0'))
         FROM "${entitySchema}".number_series WHERE series_type = 'INVOICE' LIMIT 1),
        $1, $2, $3, $4, $5, $6, $7::date, $8::date,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18
      ) RETURNING *`,
      data.studentId || null,
      data.studentInvoiceId || null,
      data.payorName,
      data.payorAddress || null,
      data.payorTin || null,
      data.invoiceDate,
      data.dueDate || null,
      totalAmount,
      totalVat,
      totalVatExempt,
      totalZeroRated,
      vatRate,
      !vatRegistered || totalVat === 0,
      serialRange?.bir_serial_number || null,
      serialRange?.accredited_printer_tin || null,
      serialRange?.permit_number || null,
      userId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'INVOICE'`
    )

    const invoice = invRows[0]
    for (const lc of lineCalcs) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".sales_invoice_line (
          sales_invoice_id, fee_type, description, amount,
          vat_sales, vat_exempt_sales, zero_rated_sales, vat_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        invoice.id,
        lc.feeType,
        lc.description,
        lc.amount,
        lc.vatSales,
        lc.vatExemptSales,
        lc.zeroRatedSales,
        lc.vatAmount
      )
    }

    const templateData = await documentTemplates.buildInvoiceData(
      entityId,
      invoice.invoice_number,
      invoice.invoice_date.toISOString().split("T")[0],
      invoice.payor_name,
      invoice.payor_address,
      invoice.payor_tin,
      lineCalcs.map((lc) => ({
        description: lc.description,
        vatExemptSales: lc.vatExemptSales,
        vatSales: lc.vatSales,
        zeroRatedSales: lc.zeroRatedSales,
        vatAmount: lc.vatAmount,
        total: lc.totalWithVat,
      })),
      invoice.bir_serial_number,
      invoice.bir_permit_number,
      invoice.bir_accredited_printer_tin
    )

    return {
      invoice,
      templateData,
    }
  },

  async list(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT si.*,
        (SELECT COALESCE(JSON_AGG(json_build_object(
          'fee_type', sil.fee_type,
          'description', sil.description,
          'amount', sil.amount,
          'vat_sales', sil.vat_sales,
          'vat_exempt_sales', sil.vat_exempt_sales,
          'vat_amount', sil.vat_amount
        )), '[]'::json)
        FROM "${entitySchema}".sales_invoice_line sil WHERE sil.sales_invoice_id = si.id) as lines
      FROM "${entitySchema}".sales_invoice si
      ORDER BY si.invoice_date DESC
      LIMIT 100`
    )
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT si.*,
        (SELECT COALESCE(JSON_AGG(json_build_object(
          'fee_type', sil.fee_type,
          'description', sil.description,
          'amount', sil.amount,
          'vat_sales', sil.vat_sales,
          'vat_exempt_sales', sil.vat_exempt_sales,
          'vat_amount', sil.vat_amount
        )), '[]'::json)
        FROM "${entitySchema}".sales_invoice_line sil WHERE sil.sales_invoice_id = si.id) as lines
      FROM "${entitySchema}".sales_invoice si
      WHERE si.id = $1`,
      id
    )
    return rows[0] || null
  },

  async void(entitySchema: string, id: string, reason: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".sales_invoice
       SET status = 'void', void_reason = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'active'
       RETURNING *`,
      reason, id
    )
    if (!rows[0]) {
      throw new Error("Invoice not found or already voided")
    }
    return rows[0]
  },
}
