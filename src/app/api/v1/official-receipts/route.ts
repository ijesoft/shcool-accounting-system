import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "official_receipts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT or_.*, pt.transaction_number as payment_ref
       FROM "${schema}".official_receipt or_
       LEFT JOIN "${schema}".payment_transaction pt ON pt.id = or_.cash_receipt_id
       ORDER BY or_.created_at DESC LIMIT 100`
    )
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("OR list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list receipts"), { status: 500 })
  }
}
