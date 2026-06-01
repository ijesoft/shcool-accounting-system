import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const tableName = searchParams.get("tableName")
    const fromDate = searchParams.get("fromDate")
    const toDate = searchParams.get("toDate")
    const userId = searchParams.get("userId")
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500)
    const offset = Number(searchParams.get("offset")) || 0

    const where: any = { entityId: session.entityId }
    if (action) where.action = action
    if (tableName) where.tableName = tableName
    if (userId) where.userId = userId
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])

    const userIds = Array.from(new Set(logs.map((l: any) => l.userId)))
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, email: true },
        })
      : []
    const userMap = new Map(users.map((u: any) => [u.id, u]))

    const enrichedLogs = logs.map((log: any) => ({
      ...log,
      user: userMap.get(log.userId) || null,
    }))

    return NextResponse.json(formatApiResponse({
      logs: enrichedLogs,
      total,
      limit,
      offset,
    }))
  } catch (error) {
    console.error("Audit log query error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to query audit log"), { status: 500 })
  }
}
