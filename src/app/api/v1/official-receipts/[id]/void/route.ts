import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { officialReceiptService } from "@/services/official-receipt.service"
import { getEntitySchema } from "@/lib/api/entity"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "official_receipts", "void")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    await officialReceiptService.void(schema, session.userId, id, body.reason)

    return NextResponse.json(formatApiResponse({ voided: true }))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to void receipt"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 400 })
  }
}
