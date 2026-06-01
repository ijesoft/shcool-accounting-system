import { prisma } from "@/lib/db"

export interface ApprovalEngineError {
  code: string
  message: string
}

export interface ApprovalResult {
  success: boolean
  errors: ApprovalEngineError[]
}

export const approvalEngine = {
  async getRequiredApprovals(
    entitySchema: string,
    sourceModule: string,
    totalAmount: number
  ): Promise<{ level: number; approverRoleId: string; ruleId: string }[]> {
    const rules = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, level, approver_roles FROM "${entitySchema}".approval_rule 
       WHERE module = $1 AND $2 >= min_amount AND (max_amount IS NULL OR $2 <= max_amount)
       ORDER BY level`,
      sourceModule, totalAmount
    )

    const requiredApprovals: { level: number; approverRoleId: string; ruleId: string }[] = []
    for (const rule of rules) {
      const roles = rule.approver_roles as string[]
      for (const roleId of roles) {
        requiredApprovals.push({ level: rule.level, approverRoleId: roleId, ruleId: rule.id })
      }
    }
    return requiredApprovals
  },

  async submitForApproval(
    entitySchema: string,
    entryId: string,
    userId: string
  ): Promise<ApprovalResult> {
    const entry = await prisma.$queryRawUnsafe<any[]>(
      `SELECT je.*, COALESCE(SUM(jel.debit), 0) as total_amount
       FROM "${entitySchema}".journal_entry je
       LEFT JOIN "${entitySchema}".journal_entry_line jel ON jel.journal_entry_id = je.id
       WHERE je.id = $1
       GROUP BY je.id`,
      entryId
    )

    if (!entry[0]) {
      return { success: false, errors: [{ code: "ERR_ENTRY_NOT_FOUND", message: "Journal entry not found" }] }
    }

    if (entry[0].status !== "draft") {
      return { success: false, errors: [{ code: "ERR_INVALID_STATUS", message: "Only draft entries can be submitted for approval" }] }
    }

    const totalAmount = Number(entry[0].total_amount)
    const requiredApprovals = await this.getRequiredApprovals(
      entitySchema, entry[0].source_module, totalAmount
    )

    if (requiredApprovals.length === 0) {
      // No approval required — auto-approve
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".journal_entry 
         SET status = 'approved', current_approval_level = 0, updated_at = NOW()
         WHERE id = $1`,
        entryId
      )
      return { success: true, errors: [] }
    }

    const maxLevel = Math.max(...requiredApprovals.map(r => r.level))

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".journal_entry 
       SET status = 'pending_approval', current_approval_level = 1, updated_at = NOW()
       WHERE id = $1`,
      entryId
    )

    for (const req of requiredApprovals) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".approval_request (record_type, record_id, level, approver_role_id, approval_rule_id, status, requested_by)
         VALUES ('journal_entry', $1, $2, $3, $4, 'pending', $5)`,
        entryId, req.level, req.approverRoleId, req.ruleId, userId
      )
    }

    return { success: true, errors: [] }
  },

  async approve(
    entitySchema: string,
    entryId: string,
    approverId: string,
    approverRoleId: string,
    comments?: string
  ): Promise<ApprovalResult> {
    const entry = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".journal_entry WHERE id = $1`,
      entryId
    )

    if (!entry[0]) {
      return { success: false, errors: [{ code: "ERR_ENTRY_NOT_FOUND", message: "Journal entry not found" }] }
    }

    if (entry[0].status !== "pending_approval") {
      return { success: false, errors: [{ code: "ERR_INVALID_STATUS", message: "Entry is not pending approval" }] }
    }

    const currentLevel = Number(entry[0].current_approval_level)

    const totalAmount = Number(
      (await prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(debit), 0) as total FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = $1`,
        entryId
      ))[0].total
    )

    const requiredApprovals = await this.getRequiredApprovals(
      entitySchema, entry[0].source_module, totalAmount
    )

    const needsThisLevel = requiredApprovals.some(
      r => r.level === currentLevel && r.approverRoleId === approverRoleId
    )

    if (!needsThisLevel) {
      return { success: false, errors: [{ code: "ERR_APPROVAL_NOT_NEEDED", message: "This approval is not required at this level" }] }
    }

    const approvalRequest = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${entitySchema}".approval_request 
       WHERE record_id = $1 AND level = $2 AND approver_role_id = $3 AND status = 'pending'
       LIMIT 1`,
      entryId, currentLevel, approverRoleId
    )

    if (!approvalRequest[0]) {
      return { success: false, errors: [{ code: "ERR_APPROVAL_REQUEST_NOT_FOUND", message: "No pending approval request found for this level" }] }
    }

    await prisma.$queryRawUnsafe(
      `INSERT INTO "${entitySchema}".approval_action (approval_request_id, approver_id, action, comments)
       VALUES ($1, $2, 'approved', $3)`,
      approvalRequest[0].id, approverId, comments || null
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".approval_request 
       SET status = 'approved' 
       WHERE id = $1`,
      approvalRequest[0].id
    )

    const maxLevel = Math.max(...requiredApprovals.map(r => r.level))

    if (currentLevel >= maxLevel) {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".journal_entry 
         SET status = 'approved', current_approval_level = $1, updated_at = NOW()
         WHERE id = $2`,
        maxLevel, entryId
      )
    } else {
      await prisma.$queryRawUnsafe(
        `UPDATE "${entitySchema}".journal_entry 
         SET current_approval_level = $1, updated_at = NOW()
         WHERE id = $2`,
        currentLevel + 1, entryId
      )
    }

    return { success: true, errors: [] }
  },

  async reject(
    entitySchema: string,
    entryId: string,
    approverId: string,
    reason: string
  ): Promise<ApprovalResult> {
    const entry = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".journal_entry WHERE id = $1`,
      entryId
    )

    if (!entry[0]) {
      return { success: false, errors: [{ code: "ERR_ENTRY_NOT_FOUND", message: "Journal entry not found" }] }
    }

    if (entry[0].status !== "pending_approval") {
      return { success: false, errors: [{ code: "ERR_INVALID_STATUS", message: "Entry is not pending approval" }] }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".journal_entry 
       SET status = 'draft', rejected_at = NOW(), rejection_reason = $1, current_approval_level = 0, updated_at = NOW()
       WHERE id = $2`,
      reason, entryId
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".approval_request 
       SET status = 'rejected' 
       WHERE record_id = $1 AND status = 'pending'`,
      entryId
    )

    return { success: true, errors: [] }
  },
}
