import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { form2316Service } from "@/lib/bir/form-2316"
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
    const yearStr = searchParams.get("year")
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear() - 1
    if (isNaN(year)) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid year"), { status: 400 })
    }

    const data = await form2316Service.generateAll(schema, session.entityId, year)
    return NextResponse.json(formatApiResponse(data))
  } catch (error) {
    console.error("Form 2316 all error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", error instanceof Error ? error.message : "Failed to generate Form 2316"),
      { status: 500 }
    )
  }
}
