import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { afsPackageService } from "@/lib/accounting/afs-package"
import { getEntitySchema } from "@/lib/api/entity"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_ENTITY_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const fiscalYear = searchParams.get("year")

    if (!fiscalYear) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "fiscal year is required"), { status: 400 })
    }

    const package_ = await afsPackageService.generate(schema, session.entityId, fiscalYear)
    return NextResponse.json(formatApiResponse(package_))
  } catch (error) {
    console.error("AFS package error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate AFS package"), { status: 500 })
  }
}
