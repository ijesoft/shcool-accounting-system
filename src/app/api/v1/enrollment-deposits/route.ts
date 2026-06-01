import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { getEntitySchema } from "@/lib/api/entity"
import { enrollmentDepositService } from "@/services/enrollment-deposit.service"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const studentId = request.nextUrl.searchParams.get("studentId") || undefined
    const deposits = await enrollmentDepositService.listHeldDeposits(schema, studentId)
    return NextResponse.json(formatApiResponse(deposits))
  } catch (error) {
    console.error("List deposits error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list deposits"), { status: 500 })
  }
}
