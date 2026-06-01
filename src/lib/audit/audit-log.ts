import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export interface AuditEntry {
  entityId: string
  userId: string
  action: "create" | "update" | "delete" | "post" | "reverse" | "void" | "approve" | "reject"
  tableName: string
  recordId: string
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

export const auditLog = {
  async record(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        entityId: entry.entityId,
        userId: entry.userId,
        action: entry.action,
        tableName: entry.tableName,
        recordId: entry.recordId,
      oldValues: entry.oldValues || Prisma.DbNull,
      newValues: entry.newValues || Prisma.DbNull,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      },
    })
  },

  async query(params: {
    entityId?: string
    tableName?: string
    action?: string
    fromDate?: string
    toDate?: string
    limit?: number
    offset?: number
  }) {
    const where: string[] = []
    const values: any[] = []
    let idx = 1

    if (params.entityId) { where.push(`entity_id = $${idx++}`); values.push(params.entityId) }
    if (params.tableName) { where.push(`table_name = $${idx++}`); values.push(params.tableName) }
    if (params.action) { where.push(`action = $${idx++}`); values.push(params.action) }
    if (params.fromDate) { where.push(`created_at >= $${idx++}::timestamptz`); values.push(params.fromDate) }
    if (params.toDate) { where.push(`created_at <= $${idx++}::timestamptz`); values.push(params.toDate) }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
    const limit = params.limit || 50
    const offset = params.offset || 0

    return prisma.$queryRawUnsafe(
      `SELECT * FROM audit.audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      ...values, limit, offset
    )
  },

  async count(params: { entityId?: string; tableName?: string; action?: string; fromDate?: string; toDate?: string }) {
    const where: string[] = []
    const values: any[] = []
    let idx = 1

    if (params.entityId) { where.push(`entity_id = $${idx++}`); values.push(params.entityId) }
    if (params.tableName) { where.push(`table_name = $${idx++}`); values.push(params.tableName) }
    if (params.action) { where.push(`action = $${idx++}`); values.push(params.action) }
    if (params.fromDate) { where.push(`created_at >= $${idx++}::timestamptz`); values.push(params.fromDate) }
    if (params.toDate) { where.push(`created_at <= $${idx++}::timestamptz`); values.push(params.toDate) }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM audit.audit_log ${whereClause}`,
      ...values
    )
    return Number(result[0]?.count || 0)
  },
}
