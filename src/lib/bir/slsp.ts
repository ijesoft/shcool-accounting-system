import { prisma } from "@/lib/db"

export interface SLSPSalesLine {
  buyerTin: string
  buyerName: string
  invoiceDate: string
  invoiceNumber: string
  grossAmount: number
  vatExempt: number
  vatSales: number
  vatAmount: number
}

export interface SLSPPurchaseLine {
  sellerTin: string
  sellerName: string
  invoiceDate: string
  invoiceNumber: string
  grossAmount: number
  inputVat: number
}

export const slspService = {
  async generateSales(
    entitySchema: string,
    entityId: string,
    from: string,
    to: string
  ): Promise<SLSPSalesLine[]> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(si.payor_tin, '')         AS buyer_tin,
         COALESCE(si.payor_name, '')        AS buyer_name,
         ori.or_date::text                  AS invoice_date,
         ori.or_number                      AS invoice_number,
         COALESCE(ori.total_amount, 0)      AS gross_amount,
         COALESCE(ori.vat_exempt_amount, 0) AS vat_exempt,
         COALESCE(ori.vat_sales, 0)        AS vat_sales,
         COALESCE(ori.vat_amount, 0)       AS vat_amount
       FROM "${entitySchema}".official_receipt ori
       LEFT JOIN "${entitySchema}".student_invoice si
         ON si.id = ori.student_invoice_id
       WHERE ori.or_date BETWEEN $1 AND $2
         AND ori.status = 'posted'
       ORDER BY ori.or_date, ori.or_number`,
      from,
      to
    )

    return rows.map(row => ({
      buyerTin: row.buyer_tin ?? "",
      buyerName: row.buyer_name ?? "",
      invoiceDate: row.invoice_date ?? "",
      invoiceNumber: row.invoice_number ?? "",
      grossAmount: Number(row.gross_amount),
      vatExempt: Number(row.vat_exempt),
      vatSales: Number(row.vat_sales),
      vatAmount: Number(row.vat_amount),
    }))
  },

  async generatePurchases(
    entitySchema: string,
    entityId: string,
    from: string,
    to: string
  ): Promise<SLSPPurchaseLine[]> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COALESCE(v.tin, '')               AS seller_tin,
         COALESCE(v.name, '')              AS seller_name,
         cd.disbursement_date::text        AS invoice_date,
         COALESCE(cd.reference_number, '') AS invoice_number,
         COALESCE(cd.gross_amount, cd.amount, 0) AS gross_amount,
         COALESCE(cd.input_vat, 0)         AS input_vat
       FROM "${entitySchema}".cash_disbursement cd
       LEFT JOIN "${entitySchema}".vendor v ON v.id = cd.vendor_id
       WHERE cd.disbursement_date BETWEEN $1 AND $2
         AND cd.status = 'posted'
       ORDER BY cd.disbursement_date, cd.reference_number`,
      from,
      to
    )

    return rows.map(row => ({
      sellerTin: row.seller_tin ?? "",
      sellerName: row.seller_name ?? "",
      invoiceDate: row.invoice_date ?? "",
      invoiceNumber: row.invoice_number ?? "",
      grossAmount: Number(row.gross_amount),
      inputVat: Number(row.input_vat),
    }))
  },

  toCsv(sales: SLSPSalesLine[], purchases: SLSPPurchaseLine[]): string {
    const lines: string[] = []

    lines.push("=== SUMMARY LIST OF SALES ===")
    lines.push(["Buyer TIN", "Buyer Name", "Invoice Date", "Invoice No.", "Gross Amount", "VAT Exempt", "VAT Sales", "VAT Amount"].join(","))
    for (const s of sales) {
      lines.push([
        s.buyerTin,
        `"${s.buyerName.replace(/"/g, '""')}"`,
        s.invoiceDate,
        s.invoiceNumber,
        s.grossAmount.toFixed(2),
        s.vatExempt.toFixed(2),
        s.vatSales.toFixed(2),
        s.vatAmount.toFixed(2),
      ].join(","))
    }

    lines.push("")
    lines.push("=== SUMMARY LIST OF PURCHASES ===")
    lines.push(["Seller TIN", "Seller Name", "Invoice Date", "Invoice No.", "Gross Amount", "Input VAT"].join(","))
    for (const p of purchases) {
      lines.push([
        p.sellerTin,
        `"${p.sellerName.replace(/"/g, '""')}"`,
        p.invoiceDate,
        p.invoiceNumber,
        p.grossAmount.toFixed(2),
        p.inputVat.toFixed(2),
      ].join(","))
    }

    return lines.join("\r\n")
  },
}
