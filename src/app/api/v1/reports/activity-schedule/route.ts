import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { activitySchedule } from "@/lib/accounting/activity-schedule"
import { getEntitySchema } from "@/lib/api/entity"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_ENTITY_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "from and to dates are required"), { status: 400 })
    }

    const data = await activitySchedule.generate(schema, from, to)
    const groupedReceipts = activitySchedule.groupByCategory(data.receipts)
    const groupedDisbursements = activitySchedule.groupByCategory(data.disbursements)

    return NextResponse.json(formatApiResponse({
      ...data,
      receipts: groupedReceipts,
      disbursements: groupedDisbursements,
    }))
  } catch (error) {
    console.error("Activity schedule error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate activity schedule"), { status: 500 })
  }
}
