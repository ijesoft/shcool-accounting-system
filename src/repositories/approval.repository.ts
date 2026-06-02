import { prisma } from "@/lib/db"

export const approvalRepository = {
  async getPendingApprovals(entitySchema: string, userId: string, roleId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT je.*, 
        COALESCE(SUM(jel.debit), 0) as total_amount,
        je.current_approval_level as level
       FROM "${entitySchema}".journal_entry je
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.journal_entry_id = je.id
       WHERE je.status = 'pending_approval'
       AND je.id IN (
         SELECT ar.record_id FROM "${entitySchema}".approval_request ar
         WHERE ar.status = 'pending'
         AND ar.approver_role_id = $2::uuid
       )
       GROUP BY je.id
       ORDER BY je.created_at DESC`,
      userId, roleId
    )
  },

  async getApprovalHistory(entitySchema: string, entryId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT aa.*, u.full_name as approver_name, r.name as approver_role
       FROM "${entitySchema}".approval_action aa
       JOIN public.user_account u ON u.id = aa.approver_id
       JOIN public.role r ON r.id = u.role_id
       WHERE aa.approval_request_id IN (
         SELECT ar.id FROM "${entitySchema}".approval_request ar
         WHERE ar.record_id = $1::uuid
       )
       ORDER BY aa.created_at`,
      entryId
    )
  },

  async createApprovalRule(
    entitySchema: string,
    data: {
      module: string
      minAmount: number
      maxAmount?: number
      approverRoles: string[]
    }
  ) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".approval_rule (module, min_amount, max_amount, approver_roles)
       VALUES ($1, $2, $3, $4::jsonb) RETURNING *`,
      data.module, data.minAmount, data.maxAmount || null, JSON.stringify(data.approverRoles)
    ).then(r => r[0])
  },

  async listApprovalRules(entitySchema: string, module?: string) {
    if (module) {
      return prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${entitySchema}".approval_rule WHERE module = $1 ORDER BY min_amount`,
        module
      )
    }
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".approval_rule ORDER BY module, min_amount`
    )
  },
}
