import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { entityService } from "@/services/entity.service"
import { createEntitySchema } from "@/lib/validators/entity"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    const entities = await entityService.list()
    return NextResponse.json(formatApiResponse(entities))
  } catch (error) {
    console.error("List entities error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list entities"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }

    if (!hasPermission(session.roleName, "entities", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const body = await request.json()
    const parsed = createEntitySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const entity = await entityService.create(parsed.data)
    return NextResponse.json(formatApiResponse(entity), { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create entity"
    return NextResponse.json(formatApiError("ERR_INTERNAL", message), { status: 500 })
  }
}
