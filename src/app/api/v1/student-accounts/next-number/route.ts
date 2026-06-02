import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "student_accounts", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not selected"), { status: 404 })
    }

    const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
    if (!entity) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const year = new Date().getFullYear()
    const rows = await prisma.$queryRawUnsafe<{ next: number }[]>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(student_number, '-', 2) AS INT)), 0) + 1 as next
       FROM "${entity.schemaName}".student
       WHERE student_number LIKE $1`,
      `${year}-%`
    )
    const nextNum = rows[0]?.next ?? 1
    const studentNumber = `${year}-${String(nextNum).padStart(4, "0")}`

    return NextResponse.json(formatApiResponse({ studentNumber }))
  } catch (error) {
    console.error("Next student number error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get next student number"), { status: 500 })
  }
}
