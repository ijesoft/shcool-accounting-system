import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { getEntitySchema } from "@/lib/api/entity"
import { revenueRecognitionService } from "@/services/revenue-recognition.service"

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "post")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_ENTITY_REQUIRED", "Please select an entity"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    if (!body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", "periodStart and periodEnd are required"),
        { status: 400 }
      )
    }

    const result = await revenueRecognitionService.run(schema, session.entityId, session.userId, {
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      fiscalPeriodId: body.fiscalPeriodId,
    })

    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run revenue recognition"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 400 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const asOf = request.nextUrl.searchParams.get("asOf") || new Date().toISOString().split("T")[0]
    const report = await revenueRecognitionService.getRollForward(schema, asOf)
    return NextResponse.json(formatApiResponse(report))
  } catch (error) {
    console.error("Roll-forward error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate roll-forward"), { status: 500 })
  }
}
