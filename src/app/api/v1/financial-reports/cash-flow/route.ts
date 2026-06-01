import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { reportService } from "@/services/report.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const from = request.nextUrl.searchParams.get("from")
    const to = request.nextUrl.searchParams.get("to")
    if (!from || !to) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "from and to query params required"), { status: 400 })
    }

    const result = await reportService.getCashFlowStatement(schema, from, to)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Cash flow error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate cash flow statement"), { status: 500 })
  }
}
