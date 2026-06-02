import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"
import { jeAllocationService } from "@/services/je-allocation.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"

async function getEntitySchema(entityId?: string) {
  if (!entityId) return null
  const e = await prisma.entity.findUnique({ where: { id: entityId } })
  return e?.schemaName ?? null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  try {
    const { id, lineId } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "post")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const heads = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM "${schema}".journal_entry WHERE id = $1::uuid`,
      id
    )
    if (!heads[0] || heads[0].status !== "posted") {
      return NextResponse.json(
        formatApiError("ERR_INVALID_STATE", "Apply is only available on posted entries"),
        { status: 400 }
      )
    }

    const body = await request.json()
    if (!body.documentId || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", "documentId and positive amount required"),
        { status: 400 }
      )
    }

    const result = await jeAllocationService.applyToDocument(schema, lineId, {
      documentId: body.documentId,
      amount: body.amount,
    })
    return NextResponse.json(formatApiResponse(result))
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json(formatApiError(error.code ?? "ERR_VALIDATION", error.message), {
        status: error.status,
      })
    }
    return NextResponse.json(formatApiError("ERR_INTERNAL", error?.message ?? "Apply failed"), {
      status: 500,
    })
  }
}
