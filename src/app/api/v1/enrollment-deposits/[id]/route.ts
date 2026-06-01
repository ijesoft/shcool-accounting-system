import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { getEntitySchema } from "@/lib/api/entity"
import { enrollmentDepositService } from "@/services/enrollment-deposit.service"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "cash_receipts", "post")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const action = body.action as "apply" | "convert" | "refund"

    if (action === "apply") {
      if (!body.invoiceId) {
        return NextResponse.json(formatApiError("ERR_VALIDATION", "invoiceId is required"), { status: 400 })
      }
      const result = await enrollmentDepositService.applyToInvoice(
        schema,
        session.userId,
        id,
        body.invoiceId
      )
      return NextResponse.json(formatApiResponse(result))
    }

    if (action === "convert") {
      const result = await enrollmentDepositService.convertToUnearnedTuition(
        schema,
        session.userId,
        id
      )
      return NextResponse.json(formatApiResponse(result))
    }

    if (action === "refund") {
      const result = await enrollmentDepositService.refund(schema, session.userId, id)
      return NextResponse.json(formatApiResponse(result))
    }

    return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid action"), { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Deposit action failed"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 400 })
  }
}
