import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { getEntitySchema } from "@/lib/api/entity"
import { revenueRecognitionService } from "@/services/revenue-recognition.service"

export async function GET() {
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

    const rows = await revenueRecognitionService.getArAging(schema)
    const totals = rows.reduce(
      (acc, row: any) => ({
        current: acc.current + Number(row.current),
        days_1_30: acc.days_1_30 + Number(row.days_1_30),
        days_31_60: acc.days_31_60 + Number(row.days_31_60),
        days_61_90: acc.days_61_90 + Number(row.days_61_90),
        days_91_plus: acc.days_91_plus + Number(row.days_91_plus),
        total_balance: acc.total_balance + Number(row.total_balance),
      }),
      {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_91_plus: 0,
        total_balance: 0,
      }
    )

    return NextResponse.json(formatApiResponse({ rows, totals, reportTitle: "Accounts Receivable Aging" }))
  } catch (error) {
    console.error("AR aging error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate AR aging"), { status: 500 })
  }
}
