import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema, getServiceUserId } from "@/lib/auth/service-auth"
import { studentAccountService } from "@/services/student-account.service"

const invoiceLineSchema = z.object({
  feeType: z.string().min(1).max(100),
  amount: z.number().positive(),
  discountType: z.string().max(50).optional(),
  discountAmount: z.number().min(0).optional(),
})

const invoiceSchema = z.object({
  reference: z.string().min(1).max(100),
  studentNumber: z.string().min(1).max(30),
  term: z.string().min(1).max(100),
  invoiceDate: z.string().min(1),
  dueDate: z.string().min(1),
  termStartDate: z.string().optional(),
  termEndDate: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1),
})

// Creates a student invoice from el-school fee masters. Idempotent on `reference`.
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
    const parsed = invoiceSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }
    const data = parsed.data

    const existing = await studentAccountService.getInvoiceByReference(schema, data.reference)
    if (existing) {
      return NextResponse.json(formatApiResponse({ ...existing, replay: true }))
    }

    const student = await studentAccountService.getByStudentNumber(schema, data.studentNumber)
    if (!student) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Student not found — sync student first"), { status: 404 })
    }

    const totalAmount = data.lines.reduce((sum, line) => sum + line.amount - (line.discountAmount ?? 0), 0)
    const invoice = await studentAccountService.createInvoice(schema, userId, {
      studentId: student.id,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      totalAmount,
      term: data.reference,
      termStartDate: data.termStartDate,
      termEndDate: data.termEndDate,
      lines: data.lines,
    })

    return NextResponse.json(formatApiResponse({ ...invoice, termLabel: data.term, replay: false }), { status: 201 })
  } catch (error) {
    console.error("Integration invoice error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create invoice"), { status: 500 })
  }
}
