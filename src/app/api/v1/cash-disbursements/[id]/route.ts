import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { cashDisbursementsService } from "@/services/cash-disbursements.service"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "cash_disbursements", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await cashDisbursementsService.getById(schema, id)
    if (!result) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Disbursement not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Disbursement get error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get disbursement"), { status: 500 })
  }
}
