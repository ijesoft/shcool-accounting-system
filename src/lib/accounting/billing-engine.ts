import { prisma } from "@/lib/db"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { getEntitySettings, type RevenueRecognitionMethod } from "@/lib/entity-settings"
import { getBirSettings, isVatRegistered } from "@/lib/entity-settings"
import { vatEngine } from "@/lib/accounting/vat-engine"

const AR_ACCOUNT_CODE = "11210"
const UNEARNED_TUITION_CODE = "21310"
const TUITION_REVENUE_CODE = "41100"
const OUTPUT_VAT_CODE = "21410"

export interface BillingLine {
  feeType: string
  amount: number
  discountAmount?: number
}

function normalizeFeeType(feeType: string): string {
  return feeType.trim().toLowerCase().replace(/\s+/g, "_")
}

function getCreditAccountCode(feeType: string, method: RevenueRecognitionMethod): string {
  const key = normalizeFeeType(feeType)

  if (method === "immediate") {
    const immediateMap: Record<string, string> = {
      tuition: TUITION_REVENUE_CODE,
      misc: "42600",
      miscellaneous: "42600",
      laboratory: "42100",
      lab: "42100",
      other: "43100",
    }
    return immediateMap[key] ?? TUITION_REVENUE_CODE
  }

  const deferredMap: Record<string, string> = {
      tuition: UNEARNED_TUITION_CODE,
      registration: UNEARNED_TUITION_CODE,
      misc: "42600",
      miscellaneous: "42600",
      laboratory: "42100",
      lab: "42100",
      other: "43100",
    }
  return deferredMap[key] ?? UNEARNED_TUITION_CODE
}

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

async function resolveRecognitionMethod(
  entitySchema: string,
  entityId?: string
): Promise<RevenueRecognitionMethod> {
  if (entityId) {
    const settings = await getEntitySettings(entityId)
    return settings.revenueRecognitionMethod ?? "term_straight_line"
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM public.entity WHERE schema_name = $1 LIMIT 1`,
    entitySchema
  )
  if (!rows[0]) return "term_straight_line"
  const settings = await getEntitySettings(rows[0].id)
  return settings.revenueRecognitionMethod ?? "term_straight_line"
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1)
}

function overlapDays(
  rangeAStart: Date,
  rangeAEnd: Date,
  rangeBStart: Date,
  rangeBEnd: Date
): number {
  const start = rangeAStart > rangeBStart ? rangeAStart : rangeBStart
  const end = rangeAEnd < rangeBEnd ? rangeAEnd : rangeBEnd
  if (end < start) return 0
  return daysBetween(start, end)
}

export const billingEngine = {
  getCreditAccountCode,

  async postStudentInvoice(
    entitySchema: string,
    userId: string,
    data: {
      invoiceId: string
      invoiceNumber: string
      invoiceDate: string
      studentName: string
      lines: BillingLine[]
      entityId?: string
    }
  ) {
    const method = await resolveRecognitionMethod(entitySchema, data.entityId)
    const bir = data.entityId ? await getBirSettings(data.entityId) : null
    const vatRegistered = bir ? isVatRegistered(bir) : false
    const vatRate = bir?.vatRate ?? 12

    const lineAmounts = data.lines.map((line) => {
      const net = Number(line.amount) - Number(line.discountAmount ?? 0)
      if (net <= 0) {
        throw new Error(`Invalid line amount for fee type ${line.feeType}`)
      }
      return { feeType: line.feeType, net }
    })

    const totalAmount = lineAmounts.reduce((sum, line) => sum + line.net, 0)
    if (totalAmount <= 0) {
      throw new Error("Invoice total must be greater than zero")
    }

    const arAccountId = await getAccountId(entitySchema, AR_ACCOUNT_CODE)
    const creditByAccount = new Map<string, number>()

    for (const line of lineAmounts) {
      const code = getCreditAccountCode(line.feeType, method)
      creditByAccount.set(code, (creditByAccount.get(code) ?? 0) + line.net)
    }

    const jeLines: {
      accountId: string
      debit: number
      credit: number
      lineDescription?: string
      lineOrder: number
    }[] = []
    let order = 1

    jeLines.push({
      accountId: arAccountId,
      debit: totalAmount,
      credit: 0,
      lineDescription: `AR - ${data.invoiceNumber}`,
      lineOrder: order++,
    })

    if (vatRegistered) {
      for (const line of lineAmounts) {
        const isExempt = vatEngine.isFeeTypeVatExempt(line.feeType)
        const calc = vatEngine.calculate(line.net, vatRate, isExempt)

        if (calc.vatAmount > 0) {
          const revenueCode = getCreditAccountCode(line.feeType, method)
          const revenueId = await getAccountId(entitySchema, revenueCode)
          const outputVatId = await getAccountId(entitySchema, OUTPUT_VAT_CODE)

          const revenueAmount = Number((line.net - calc.vatAmount).toFixed(2))

          creditByAccount.set(revenueCode, (creditByAccount.get(revenueCode) ?? 0) - line.net + revenueAmount)
          creditByAccount.set(OUTPUT_VAT_CODE, (creditByAccount.get(OUTPUT_VAT_CODE) ?? 0) + calc.vatAmount)
        }
      }
    }

    for (const [accountCode, amount] of Array.from(creditByAccount.entries())) {
      if (amount <= 0) continue
      const accountId = await getAccountId(entitySchema, accountCode)
      jeLines.push({
        accountId,
        debit: 0,
        credit: amount,
        lineDescription: `${data.invoiceNumber} - ${accountCode}`,
        lineOrder: order++,
      })
    }

    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: data.invoiceDate,
      reference: data.invoiceNumber,
      sourceModule: "AR",
      description: `Student billing - ${data.studentName} - ${data.invoiceNumber}`,
      createdBy: userId,
      lines: jeLines,
    })

    const postResult = await postingEngine.post(
      entitySchema,
      entry.id,
      userId,
      data.invoiceDate,
      jeLines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
      }))
    )

    if (!postResult.success) {
      throw new Error(postResult.errors.map((e) => e.message).join("; "))
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".student_invoice SET journal_entry_id = $1, updated_at = NOW() WHERE id = $2`,
      entry.id,
      data.invoiceId
    )

    return entry
  },

  async reverseStudentInvoice(entitySchema: string, userId: string, invoiceId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT journal_entry_id, status FROM "${entitySchema}".student_invoice WHERE id = $1`,
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
      `UPDATE "${entitySchema}".student_invoice SET status = 'cancelled', balance = 0, updated_at = NOW() WHERE id = $1`,
      invoiceId
    )

    await prisma.$queryRawUnsafe(
      `DELETE FROM "${entitySchema}".revenue_recognition_entry WHERE student_invoice_id = $1`,
      invoiceId
    )

    return result
  },

  daysBetween,
  overlapDays,
}
