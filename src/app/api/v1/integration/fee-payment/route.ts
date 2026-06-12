import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema, getServiceUserId } from "@/lib/auth/service-auth"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"

const feePaymentSchema = z.object({
  reference: z.string().min(1).max(100),
  paymentDate: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).max(50),
  payorName: z.string().max(255).optional(),
  payorAddress: z.string().max(500).optional(),
  description: z.string().max(255).optional(),
})

// Receives a fee payment from el-school, books the cash receipt + journal
// entry, and issues a BIR-sequenced Official Receipt. Idempotent on
// `reference`: replays return the already-issued OR instead of double-booking.
export async function POST(request: NextRequest) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const userId = await getServiceUserId()
    if (!userId) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Integration user not found"), { status: 404 })

    const body = await request.json()
    const parsed = feePaymentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }
    const data = parsed.data

    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.transaction_number, o.id AS or_id, o.or_number, o.or_date
       FROM "${schema}".payment_transaction pt
       LEFT JOIN "${schema}".official_receipt o ON o.id = pt.official_receipt_id
       WHERE pt.reference = $1 LIMIT 1`,
      data.reference
    )
    if (existing[0]?.or_number) {
      return NextResponse.json(formatApiResponse({
        transactionNumber: existing[0].transaction_number,
        orId: existing[0].or_id,
        orNumber: existing[0].or_number,
        orDate: existing[0].or_date,
        replay: true,
      }))
    }

    const payment = await cashReceiptsService.create(schema, userId, {
      paymentDate: data.paymentDate,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      payorName: data.payorName,
      payorAddress: data.payorAddress,
    })
    const posted = await cashReceiptsService.post(schema, userId, payment.id)

    return NextResponse.json(formatApiResponse({
      transactionNumber: payment.transaction_number,
      orId: posted.officialReceipt.id,
      orNumber: posted.officialReceipt.or_number,
      orDate: posted.officialReceipt.or_date,
      replay: false,
    }), { status: 201 })
  } catch (error) {
    console.error("Integration fee-payment error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to process fee payment"), { status: 500 })
  }
}
