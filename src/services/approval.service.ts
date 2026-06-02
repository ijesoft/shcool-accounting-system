import { prisma } from "@/lib/db"
import { approvalEngine } from "@/lib/accounting/approval-engine"
import { approvalRepository } from "@/repositories/approval.repository"
import { auditLog } from "@/lib/audit/audit-log"

export const approvalService = {
  async submitForApproval(entitySchema: string, entryId: string, userId: string) {
    const result = await approvalEngine.submitForApproval(entitySchema, entryId, userId)
    if (!result.success) {
      throw { status: 400, code: result.errors[0].code, message: result.errors.map(e => e.message).join("; ") }
    }

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "approve",
        tableName: "journal_entry",
        recordId: entryId,
        newValues: { status: "pending_approval" },
      })
    }
  },

  async approve(entitySchema: string, entryId: string, userId: string, comments?: string) {
    const user = await prisma.$queryRawUnsafe<any[]>(
      `SELECT role_id FROM public.user_account WHERE id = $1::uuid`, userId
    )
    if (!user[0]) throw { status: 404, message: "User not found" }

    const result = await approvalEngine.approve(
      entitySchema, entryId, userId, user[0].role_id, comments
    )
    if (!result.success) {
      throw { status: 400, code: result.errors[0].code, message: result.errors.map(e => e.message).join("; ") }
    }

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "approve",
        tableName: "journal_entry",
        recordId: entryId,
        newValues: { action: "approved", comments },
      })
    }
  },

  async reject(entitySchema: string, entryId: string, userId: string, reason: string) {
    const result = await approvalEngine.reject(entitySchema, entryId, userId, reason)
    if (!result.success) {
      throw { status: 400, code: result.errors[0].code, message: result.errors.map(e => e.message).join("; ") }
    }

    const entityRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.entity WHERE schema_name = $1`, entitySchema
    )
    if (entityRows[0]) {
      await auditLog.record({
        entityId: entityRows[0].id,
        userId,
        action: "reject",
        tableName: "journal_entry",
        recordId: entryId,
        newValues: { action: "rejected", reason },
      })
    }
  },

  async getPendingApprovals(entitySchema: string, userId: string, roleId: string) {
    return approvalRepository.getPendingApprovals(entitySchema, userId, roleId)
  },

  async getApprovalHistory(entitySchema: string, entryId: string) {
    return approvalRepository.getApprovalHistory(entitySchema, entryId)
  },

  async createApprovalRule(entitySchema: string, data: {
    module: string
    minAmount: number
    maxAmount?: number
    approverRoles: string[]
  }) {
    return approvalRepository.createApprovalRule(entitySchema, data)
  },

  async listApprovalRules(entitySchema: string, module?: string) {
    return approvalRepository.listApprovalRules(entitySchema, module)
  },
}
