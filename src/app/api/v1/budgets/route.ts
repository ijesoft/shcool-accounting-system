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

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const url = new URL(request.url)
    const fiscalYearId = url.searchParams.get("fiscalYearId") || undefined

    const result = await budgetService.listBudgets(schema, fiscalYearId)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Budget list error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list budgets"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "budget", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    const body = await request.json()
    const result = await budgetService.upsertBudget(schema, session.userId, body)
    return NextResponse.json(formatApiResponse(result))
  } catch (error) {
    console.error("Budget upsert error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to upsert budget"), { status: 500 })
  }
}
