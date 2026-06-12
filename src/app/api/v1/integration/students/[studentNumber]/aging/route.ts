import { NextRequest, NextResponse } from "next/server"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema } from "@/lib/auth/service-auth"
import { studentAccountService } from "@/services/student-account.service"

// AR aging buckets for one student, looked up by admission number.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentNumber: string }> }
) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const { studentNumber } = await params
    const aging = await studentAccountService.getAgingByStudentNumber(schema, decodeURIComponent(studentNumber))
    if (!aging) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Student not found"), { status: 404 })
    }

    return NextResponse.json(formatApiResponse(aging))
  } catch (error) {
    console.error("Integration student aging error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get student aging"), { status: 500 })
  }
}
