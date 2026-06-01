import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { journalEntryService } from "@/services/journal-entry.service"
import { createJournalEntrySchema } from "@/lib/validators/journal-entry"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const entries = await journalEntryService.list(schema)
    return NextResponse.json(formatApiResponse(entries))
  } catch (error) {
    console.error("List JE error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list entries"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "journal_entries", "create")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const body = await request.json()
    const parsed = createJournalEntrySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", parsed.error.message), { status: 400 })
    }

    const entry = await journalEntryService.create(schema, parsed.data, session.userId)
    return NextResponse.json(formatApiResponse(entry), { status: 201 })
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json(formatApiError(error.code, error.message), { status: error.status })
    }
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create entry"), { status: 500 })
  }
}
