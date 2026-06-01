import { prisma } from "@/lib/db"
import { getBirSettings } from "@/lib/entity-settings"

export interface InvoiceTemplateData {
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  payorName: string
  payorAddress?: string
  payorTin?: string
  sellerTin: string
  sellerName: string
  sellerAddress: string
  birSerialNumber?: string
  birPermitNumber?: string
  accreditedPrinterTin?: string
  lines: {
    description: string
    vatExemptSales: number
    vatSales: number
    zeroRatedSales: number
    vatAmount: number
    total: number
  }[]
  totals: {
    vatExemptSales: number
    vatSales: number
    zeroRatedSales: number
    totalVat: number
    grandTotal: number
  }
}

export interface OrTemplateData {
  orNumber: string
  orDate: string
  payorName: string
  payorAddress?: string
  payorTin?: string
  sellerTin: string
  sellerName: string
  sellerAddress: string
  birSerialNumber?: string
  birPermitNumber?: string
  accreditedPrinterTin?: string
  lines: {
    description: string
    amount: number
  }[]
  total: number
}

export const documentTemplates = {
  async buildInvoiceData(
    entityId: string,
    invoiceNumber: string,
    invoiceDate: string,
    payorName: string,
    payorAddress?: string,
    payorTin?: string,
    lines?: { description: string; vatExemptSales: number; vatSales: number; zeroRatedSales: number; vatAmount: number; total: number }[],
    birSerialNumber?: string,
    birPermitNumber?: string,
    accreditedPrinterTin?: string
  ): Promise<InvoiceTemplateData> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { name: true, tin: true, settings: true },
    })
    if (!entity) throw new Error("Entity not found")

    const bir = await getBirSettings(entityId)
    const sellerName = bir.businessName || entity.name
    const sellerAddress = bir.businessAddress || ""
    const sellerTin = entity.tin || bir.businessName || ""

    const defaultLines = lines ?? [
      {
        description: "Tuition - VAT Exempt",
        vatExemptSales: 0,
        vatSales: 0,
        zeroRatedSales: 0,
        vatAmount: 0,
        total: 0,
      },
    ]

    const totals = defaultLines.reduce(
      (acc, line) => ({
        vatExemptSales: acc.vatExemptSales + line.vatExemptSales,
        vatSales: acc.vatSales + line.vatSales,
        zeroRatedSales: acc.zeroRatedSales + line.zeroRatedSales,
        totalVat: acc.totalVat + line.vatAmount,
        grandTotal: acc.grandTotal + line.total,
      }),
      { vatExemptSales: 0, vatSales: 0, zeroRatedSales: 0, totalVat: 0, grandTotal: 0 }
    )

    return {
      invoiceNumber,
      invoiceDate,
      payorName,
      payorAddress,
      payorTin,
      sellerTin,
      sellerName,
      sellerAddress,
      birSerialNumber,
      birPermitNumber,
      accreditedPrinterTin,
      lines: defaultLines,
      totals,
    }
  },

  async buildOrData(
    entityId: string,
    orNumber: string,
    orDate: string,
    payorName: string,
    payorAddress?: string,
    payorTin?: string,
    lines?: { description: string; amount: number }[],
    birSerialNumber?: string,
    birPermitNumber?: string,
    accreditedPrinterTin?: string
  ): Promise<OrTemplateData> {
    const entity = await prisma.entity.findUnique({
      where: { id: entityId },
      select: { name: true, tin: true },
    })
    if (!entity) throw new Error("Entity not found")

    const bir = await getBirSettings(entityId)
    const sellerName = bir.businessName || entity.name
    const sellerAddress = bir.businessAddress || ""
    const sellerTin = entity.tin || ""

    const defaultLines = lines ?? [{ description: "Tuition Payment", amount: 0 }]
    const total = defaultLines.reduce((acc, line) => acc + line.amount, 0)

    return {
      orNumber,
      orDate,
      payorName,
      payorAddress,
      payorTin,
      sellerTin,
      sellerName,
      sellerAddress,
      birSerialNumber,
      birPermitNumber,
      accreditedPrinterTin,
      lines: defaultLines,
      total: Number(total.toFixed(2)),
    }
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(amount)
  },

  formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  },
}
