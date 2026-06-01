import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { eoptInvoiceService } from "@/services/eopt-invoice.service"
import { getEntitySchema } from "@/lib/api/entity"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "cash_receipts", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_ENTITY_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const invoice = await eoptInvoiceService.void(schema, id, body.reason)
    return NextResponse.json(formatApiResponse(invoice))
  } catch (error: any) {
    console.error("Void EOPT invoice error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to void invoice"), { status: 500 })
  }
}
