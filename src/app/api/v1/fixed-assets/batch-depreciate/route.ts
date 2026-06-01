import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"

async function getSchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const body = await request.json()
    const { fiscalPeriodId } = body
    if (!fiscalPeriodId) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "fiscalPeriodId is required"), { status: 400 })
    }

    const result = await fixedAssetService.depreciateAll(schema, fiscalPeriodId, session.userId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Batch depreciation error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to process batch depreciation"), { status: 500 })
  }
}
