import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth/session"
import { formatApiError } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(
        formatApiError("ERR_UNAUTHORIZED", "Not authenticated"),
        { status: 401 }
      )
    }

    const entities = await prisma.entity.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    })

    return NextResponse.json({ success: true, data: { entities, currentEntityId: session.entityId } })
  } catch (error) {
    console.error("Entity list error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(
        formatApiError("ERR_UNAUTHORIZED", "Not authenticated"),
        { status: 401 }
      )
    }

    const body = await request.json()
    const { entityId } = body
    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", "entityId is required"),
        { status: 400 }
      )
    }

    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    if (!entity) {
      return NextResponse.json(
        formatApiError("ERR_NOT_FOUND", "Entity not found"),
        { status: 404 }
      )
    }

    session.entityId = entityId
    await session.save()

    return NextResponse.json({ success: true, data: { entityId } })
  } catch (error) {
    console.error("Entity update error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
