import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { getEntitySchema } from "@/lib/api/entity"
import { fiscalCalendarService } from "@/services/fiscal-calendar.service"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "fiscal_periods", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    await fiscalCalendarService.reopenPeriod(schema, id, session.userId)
    return NextResponse.json(formatApiResponse({ reopened: true }))
  } catch (error: any) {
    const message = error?.message || "Failed to reopen fiscal period"
    return NextResponse.json(formatApiError(error?.code || "ERR_INTERNAL", message), { status: 400 })
  }
}
