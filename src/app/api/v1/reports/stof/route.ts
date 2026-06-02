import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { stofService } from "@/lib/accounting/stof"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not selected"), { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") ?? new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
    const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10)

    const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
    if (!entity) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const summary = await stofService.generate(entity.schemaName, from, to)
    return NextResponse.json(formatApiResponse(summary))
  } catch (error) {
    console.error("STOF report error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate STOF report"), { status: 500 })
  }
}
