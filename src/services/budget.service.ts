import { prisma } from "@/lib/db"
import { budgetEngine } from "@/lib/accounting/budget-engine"
import { auditLog } from "@/lib/audit/audit-log"

export const budgetService = {
  async listBudgets(entitySchema: string, fiscalYearId?: string) {
    const yearFilter = fiscalYearId ? `WHERE b.fiscal_year_id = ${fiscalYearId}` : ""
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT b.*, a.account_code, a.account_name, fy.year as fiscal_year
       FROM "${entitySchema}".budget b
       JOIN "${entitySchema}".account a ON a.id = b.account_id
       JOIN public.fiscal_year fy ON fy.id = b.fiscal_year_id
       ${yearFilter}
       ORDER BY fy.year, a.account_code`
    )
  },

  async upsertBudget(entitySchema: string, userId: string, data: {
    fiscalYearId: string; accountId: string; budgetedAmount: number; notes?: string
  }) {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM "${entitySchema}".budget
       WHERE fiscal_year_id = $1 AND account_id = $2`,
      data.fiscalYearId, data.accountId
    )

    let result
    if (existing[0]) {
      result = await prisma.$queryRawUnsafe<any[]>(
        `UPDATE "${entitySchema}".budget
         SET budgeted_amount = $1, notes = $2, updated_at = NOW()
         WHERE fiscal_year_id = $3 AND account_id = $4
         RETURNING *`,
        data.budgetedAmount, data.notes || null,
        data.fiscalYearId, data.accountId
      )
    } else {
      result = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "${entitySchema}".budget
         (fiscal_year_id, account_id, budgeted_amount, notes, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        data.fiscalYearId, data.accountId,
        data.budgetedAmount, data.notes || null, userId
      )
    }

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "create",
      tableName: "budget",
      recordId: result[0].id,
      newValues: { fiscalYearId: data.fiscalYearId, accountId: data.accountId, budgetedAmount: data.budgetedAmount },
    })

    return result[0]
  },

  async deleteBudget(entitySchema: string, userId: string, budgetId: string) {
    await prisma.$queryRawUnsafe(
      `DELETE FROM "${entitySchema}".budget WHERE id = $1`,
      budgetId
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "delete",
      tableName: "budget",
      recordId: budgetId,
    })
  },

  async getBudgetVsActual(entitySchema: string, fiscalYearId: string | undefined, accountId?: string) {
    return budgetEngine.getBudgetVsActual(entitySchema, fiscalYearId, accountId)
  },

  async getBudgetSummary(entitySchema: string, fiscalYearId: string | undefined) {
    return budgetEngine.getBudgetSummary(entitySchema, fiscalYearId)
  },

  async getFiscalYears(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT fy.*, e.name as entity_name
       FROM public.fiscal_year fy
       JOIN public.entity e ON e.id = fy.entity_id
       WHERE e.schema_name = (SELECT schema_name FROM public.entity WHERE id = (
         SELECT entity_id FROM public.fiscal_year WHERE id = fy.id
       ))
       ORDER BY fy.year DESC`
    )
  },
}
