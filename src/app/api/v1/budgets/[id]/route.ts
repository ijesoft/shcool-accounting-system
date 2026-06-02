import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { budgetService } from "@/services/budget.service"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT b.*, a.account_code, a.account_name
       FROM "${schema}".budget b
       JOIN "${schema}".account a ON a.id = b.account_id
       WHERE b.id = $1::uuid`,
      (await params).id
    )
    if (!result[0]) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Budget not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result[0]))
  } catch (error) {
    console.error("Budget get error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get budget"), { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "budget", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${schema}".budget SET budgeted_amount = $1, notes = $2, updated_at = NOW()
       WHERE id = $3::uuid RETURNING *`,
      body.budgetedAmount ?? null, body.notes ?? null, (await params).id
    )
    if (!result[0]) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Budget not found"), { status: 404 })
    return NextResponse.json(formatApiResponse(result[0]))
  } catch (error) {
    console.error("Budget update error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to update budget"), { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "budget", "delete")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    await budgetService.deleteBudget(schema, session.userId, (await params).id)
    return NextResponse.json(formatApiResponse({ success: true }))
  } catch (error) {
    console.error("Budget delete error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to delete budget"), { status: 500 })
  }
}
