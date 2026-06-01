import { prisma } from "@/lib/db"
import { getBirSettings, isVatRegistered } from "@/lib/entity-settings"

const OUTPUT_VAT_CODE = "21900"
const INPUT_VAT_CODE = "11600"

export interface VatCalculation {
  taxableAmount: number
  vatExemptAmount: number
  zeroRatedAmount: number
  vatAmount: number
  vatRate: number
  totalWithVat: number
}

export interface VatLineCalculation {
  feeType: string
  description: string
  amount: number
  vatSales: number
  vatExemptSales: number
  zeroRatedSales: number
  vatAmount: number
  totalWithVat: number
}

export const vatEngine = {
  calculate(
    amount: number,
    vatRate: number,
    isVatExempt: boolean,
    isZeroRated: boolean = false
  ): VatCalculation {
    let taxableAmount = 0
    let vatExemptAmount = 0
    let zeroRatedAmount = 0
    let vatAmount = 0

    if (isVatExempt) {
      vatExemptAmount = amount
    } else if (isZeroRated) {
      taxableAmount = amount
      vatAmount = 0
    } else {
      taxableAmount = amount / (1 + vatRate / 100)
      vatAmount = amount - taxableAmount
    }

    const totalWithVat = taxableAmount + vatExemptAmount + zeroRatedAmount + vatAmount

    return {
      taxableAmount: Number(taxableAmount.toFixed(2)),
      vatExemptAmount: Number(vatExemptAmount.toFixed(2)),
      zeroRatedAmount: Number(zeroRatedAmount.toFixed(2)),
      vatAmount: Number(vatAmount.toFixed(2)),
      vatRate,
      totalWithVat: Number(totalWithVat.toFixed(2)),
    }
  },

  calculateLine(
    feeType: string,
    description: string,
    amount: number,
    vatRate: number,
    isVatExempt: boolean,
    isZeroRated: boolean = false
  ): VatLineCalculation {
    const calc = this.calculate(amount, vatRate, isVatExempt, isZeroRated)

    return {
      feeType,
      description,
      amount,
      vatSales: calc.taxableAmount,
      vatExemptSales: calc.vatExemptAmount,
      zeroRatedSales: calc.zeroRatedAmount,
      vatAmount: calc.vatAmount,
      totalWithVat: calc.totalWithVat,
    }
  },

  async calculateInvoice(entityId: string, lines: { feeType: string; amount: number }[]): Promise<{
    total: number
    totalVat: number
    totalVatExempt: number
    totalZeroRated: number
    lineCalcs: VatLineCalculation[]
  }> {
    const bir = await getBirSettings(entityId)
    const vatRate = bir.vatRate ?? 12
    const vatRegistered = isVatRegistered(bir)

    const lineCalcs: VatLineCalculation[] = []
    let total = 0
    let totalVat = 0
    let totalVatExempt = 0
    let totalZeroRated = 0

    for (const line of lines) {
      const isExempt = this.isFeeTypeVatExempt(line.feeType)
      const isZero = false

      const lineCalc = this.calculateLine(
        line.feeType,
        line.feeType,
        line.amount,
        vatRate,
        vatRegistered && !isExempt ? false : true,
        isZero
      )

      lineCalcs.push(lineCalc)
      total += lineCalc.totalWithVat
      totalVat += lineCalc.vatAmount
      totalVatExempt += lineCalc.vatExemptSales
      totalZeroRated += lineCalc.zeroRatedSales
    }

    return {
      total: Number(total.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2)),
      totalVatExempt: Number(totalVatExempt.toFixed(2)),
      totalZeroRated: Number(totalZeroRated.toFixed(2)),
      lineCalcs,
    }
  },

  isFeeTypeVatExempt(feeType: string): boolean {
    const key = feeType.trim().toLowerCase().replace(/\s+/g, "_")
    const exemptTypes = ["tuition", "registration", "admission", "enrollment", "laboratory", "lab", "library", "medical", "athletic", "id", "technology", "modular"]
    return exemptTypes.includes(key)
  },

  async getOutputVatAccountId(entitySchema: string): Promise<string | null> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 AND is_active = TRUE`,
      OUTPUT_VAT_CODE
    )
    return rows[0]?.id ?? null
  },

  async getInputVatAccountId(entitySchema: string): Promise<string | null> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 AND is_active = TRUE`,
      INPUT_VAT_CODE
    )
    return rows[0]?.id ?? null
  },
}
