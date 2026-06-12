import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema, getServiceUserId } from "@/lib/auth/service-auth"
import { payrollService } from "@/services/payroll.service"

const employeeUpsertSchema = z.object({
  employeeCode: z.string().min(1).max(30),
  fullName: z.string().min(1).max(255),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  basicPay: z.number().min(0).optional(),
  tin: z.string().max(20).optional(),
  sssNumber: z.string().max(20).optional(),
  philhealthNumber: z.string().max(20).optional(),
  pagibigNumber: z.string().max(20).optional(),
  isActive: z.boolean().optional(),
})

// Upserts an employee from el-school staff keyed by employee ID / code.
export async function POST(request: NextRequest) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const userId = await getServiceUserId()
    if (!userId) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Integration user not found"), { status: 404 })

    const body = await request.json()
    const parsed = employeeUpsertSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const result = await payrollService.upsertByEmployeeCode(schema, userId, parsed.data)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Integration employee upsert error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to upsert employee"), { status: 500 })
  }
}
