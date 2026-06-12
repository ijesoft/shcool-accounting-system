import { NextRequest, NextResponse } from "next/server"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema } from "@/lib/auth/service-auth"
import { studentAccountService } from "@/services/student-account.service"

// Full AR aging report for integration consumers (el-school admin/parent portals).
export async function GET(request: NextRequest) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const rows = await studentAccountService.getAging(schema)
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

    return NextResponse.json(formatApiResponse({ rows, totals }))
  } catch (error) {
    console.error("Integration AR aging error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate AR aging"), { status: 500 })
  }
}
