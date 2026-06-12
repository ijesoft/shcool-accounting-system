import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema } from "@/lib/auth/service-auth"
import { studentAccountService } from "@/services/student-account.service"

const studentUpsertSchema = z.object({
  studentNumber: z.string().min(1).max(30),
  fullName: z.string().min(1).max(255),
  course: z.string().max(100).optional(),
  gradeLevel: z.string().max(50).optional(),
  status: z.enum(["enrolled", "graduated", "transferred", "withdrawn"]).optional(),
})

// Upserts a student from el-school keyed by admission number (student_number).
export async function POST(request: NextRequest) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const body = await request.json()
    const parsed = studentUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const result = await studentAccountService.upsertByStudentNumber(schema, parsed.data)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Integration student upsert error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to upsert student"), { status: 500 })
  }
}
