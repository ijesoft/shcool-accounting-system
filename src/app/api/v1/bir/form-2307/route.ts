import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { form2307Service } from "@/lib/bir/form-2307"
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
    const bulk = searchParams.get("bulk") === "true"
    const vendorId = searchParams.get("vendorId")

    if (!from || !to) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "from and to query params are required"), { status: 400 })
    }

    if (bulk) {
      const data = await form2307Service.generateBulk(schema, session.entityId, from, to)
      return NextResponse.json(formatApiResponse(data))
    }

    if (!vendorId) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "vendorId is required when bulk=false"), { status: 400 })
    }

    const data = await form2307Service.generateForPayee(schema, session.entityId, vendorId, from, to)
    return NextResponse.json(formatApiResponse(data))
  } catch (error) {
    console.error("Form 2307 error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", error instanceof Error ? error.message : "Failed to generate Form 2307"),
      { status: 500 }
    )
  }
}
