import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError } from "@/lib/utils"
import { payrollExport } from "@/lib/payroll-export"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const url = new URL(request.url)
    const employeeId = url.searchParams.get("employeeId")
    if (!employeeId) {
      return NextResponse.json(formatApiError("ERR_INVALID_PARAMS", "employeeId query param is required"), { status: 400 })
    }

    const html = await payrollExport.generatePayslipHtml(schema, (await params).id, employeeId)
    if (!html) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Payslip not found"), { status: 404 })
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    })
  } catch (error) {
    console.error("Payslip error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate payslip"), { status: 500 })
  }
}
