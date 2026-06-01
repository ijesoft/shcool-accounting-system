import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { journalEntryService } from "@/services/journal-entry.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { getEntitySchema } from "@/lib/api/entity"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "approve")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    if (!body.reason) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "Rejection reason is required"), { status: 400 })
    }

    const entry = await journalEntryService.reject(schema, id, session.userId, body.reason)
    return NextResponse.json(formatApiResponse(entry))
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json(formatApiError(error.code || "ERR_INTERNAL", error.message), { status: error.status })
    }
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to reject entry"), { status: 500 })
  }
}
