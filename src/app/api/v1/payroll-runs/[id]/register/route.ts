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
    const format = (url.searchParams.get("format") || "csv") as "csv" | "xlsx"

    const response = await payrollExport.generatePayrollRegister(schema, (await params).id, format)
    return response as unknown as NextResponse
  } catch (error) {
    console.error("Payroll register error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error instanceof Error ? error.message : "Failed to generate payroll register"), { status: 500 })
  }
}
