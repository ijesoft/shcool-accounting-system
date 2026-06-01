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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "fixed_assets", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getSchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await fixedAssetService.dispose(schema, id, body.disposalDate, body.disposalAmount, session.userId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    console.error("Dispose error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to dispose"), { status: 500 })
  }
}
