import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { fiscalCalendarService } from "@/services/fiscal-calendar.service"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_ENTITY_REQUIRED", "Please select an entity"), { status: 400 })
    }
    if (!hasPermission(session.roleName, "fiscal_periods", "read") && !hasPermission(session.roleName, "fiscal_periods", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const years = await fiscalCalendarService.listYears(session.entityId)
    return NextResponse.json(formatApiResponse(years))
  } catch (error) {
    console.error("List fiscal years error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list fiscal years"), { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_ENTITY_REQUIRED", "Please select an entity"), { status: 400 })
    }
    if (!hasPermission(session.roleName, "fiscal_periods", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const year = await fiscalCalendarService.bootstrap(session.entityId)
    return NextResponse.json(formatApiResponse(year), { status: 201 })
  } catch (error) {
    console.error("Bootstrap fiscal year error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to bootstrap fiscal calendar"), { status: 500 })
  }
}
