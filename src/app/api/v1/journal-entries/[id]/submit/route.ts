import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { journalEntryService } from "@/services/journal-entry.service"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { getEntitySchema } from "@/lib/api/entity"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const entry = await journalEntryService.submitForApproval(schema, id, session.userId)
    return NextResponse.json(formatApiResponse(entry))
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json(formatApiError(error.code, error.message), { status: error.status })
    }
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to submit entry"), { status: 500 })
  }
}
