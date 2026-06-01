import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { entityService } from "@/services/entity.service"
import { updateEntitySchema } from "@/lib/validators/entity"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    const entity = await entityService.getById(id)
    if (!entity) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    return NextResponse.json(formatApiResponse(entity))
  } catch (error) {
    console.error("Get entity error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get entity"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "entities", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const body = await request.json()
    const parsed = updateEntitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const entity = await entityService.update(id, parsed.data)
    return NextResponse.json(formatApiResponse(entity))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update entity"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
