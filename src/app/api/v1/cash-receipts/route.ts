import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"


const createCashReceiptSchema = z.object({
  paymentDate: z.string().min(1, "Payment date is required"),
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.string().min(1).max(50),
  studentId: z.string().optional(),
  invoiceId: z.string().optional(),
  paymentType: z.enum(["tuition", "enrollment_deposit"]).optional(),
  checkNumber: z.string().max(100).optional(),
  checkDate: z.string().optional(),
  bankName: z.string().max(100).optional(),
  reference: z.string().max(100).optional(),
  payorName: z.string().max(255).optional(),
  payorAddress: z.string().max(500).optional(),
  tin: z.string().max(50).optional(),
}).passthrough()

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_receipts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await cashReceiptsService.list(schema)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Cash receipts list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list receipts"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_receipts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const parsed = createCashReceiptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }
    const result = await cashReceiptsService.create(schema, session.userId, parsed.data)
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error) {
    console.error("Cash receipt create error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create receipt"), { status: 500 })
  }
}
