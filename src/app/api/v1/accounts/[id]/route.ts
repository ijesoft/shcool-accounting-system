import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { accountService } from "@/services/account.service"
import { updateAccountSchema } from "@/lib/validators/account"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
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
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const account = await accountService.getById(schema, id)
    if (!account) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Account not found"), { status: 404 })
    }

    return NextResponse.json(formatApiResponse(account))
  } catch (error) {
    console.error("Get account error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get account"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const parsed = updateAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const account = await accountService.update(schema, id, parsed.data)
    return NextResponse.json(formatApiResponse(account))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update account"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
