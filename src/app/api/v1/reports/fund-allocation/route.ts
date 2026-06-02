import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fundAllocationService } from "@/lib/accounting/fund-allocation"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema || !session.entityId) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", "from and to query params are required"),
        { status: 400 }
      )
    }

    const report = await fundAllocationService.generate(schema, session.entityId, from, to)
    return NextResponse.json(formatApiResponse(report))
  } catch (error) {
    console.error("Fund allocation report error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", error instanceof Error ? error.message : "Failed to generate fund allocation report"),
      { status: 500 }
    )
  }
}
