import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { accountService } from "@/services/account.service"
import { createAccountSchema } from "@/lib/validators/account"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
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

    if (!hasPermission(session.roleName, "accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const tree = request.nextUrl.searchParams.get("tree") === "true"
    const accounts = tree ? await accountService.getTree(schema) : await accountService.list(schema)
    return NextResponse.json(formatApiResponse(accounts))
  } catch (error) {
    console.error("List accounts error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list accounts"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "accounts", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const parsed = createAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const account = await accountService.create(schema, parsed.data)
    return NextResponse.json(formatApiResponse(account), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create account"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
