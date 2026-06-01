import { prisma } from "@/lib/db"

export interface PeriodControlError {
  code: string
  message: string
}

export const periodControl = {
  async canPostToPeriod(entitySchema: string, entryDate: Date): Promise<{ allowed: boolean; error?: PeriodControlError }> {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.id, fp.is_closed, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE $1 BETWEEN fp.start_date AND fp.end_date
       AND fy.entity_id = (SELECT id FROM public.entity WHERE schema_name = $2)
       LIMIT 1`,
      entryDate, entitySchema
    )

    if (!periodRows[0]) {
      return { allowed: false, error: { code: "ERR_PERIOD_NOT_FOUND", message: "No fiscal period found for this date" } }
    }

    if (periodRows[0].year_closed) {
      return { allowed: false, error: { code: "ERR_YEAR_CLOSED", message: "Fiscal year is closed" } }
    }

    if (periodRows[0].is_closed) {
      return { allowed: false, error: { code: "ERR_PERIOD_CLOSED", message: "Fiscal period is closed" } }
    }

    return { allowed: true }
  },

  async closePeriod(entitySchema: string, periodId: string, userId: string) {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.*, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE fp.id = $1`,
      periodId
    )

    if (!periodRows[0]) {
      throw { code: "ERR_PERIOD_NOT_FOUND", message: "Fiscal period not found" }
    }

    if (periodRows[0].is_closed) {
      throw { code: "ERR_PERIOD_ALREADY_CLOSED", message: "Fiscal period is already closed" }
    }

    const draftEntries = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM "${entitySchema}".journal_entry 
       WHERE status = 'draft' OR status = 'pending_approval'`
    )

    if (Number(draftEntries[0]?.count || 0) > 0) {
      throw { code: "ERR_DRAFT_ENTRIES_EXIST", message: "Cannot close period with draft or pending entries" }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_period SET is_closed = TRUE WHERE id = $1`,
      periodId
    )

    return { success: true }
  },

  async reopenPeriod(entitySchema: string, periodId: string, userId: string) {
    const periodRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT fp.*, fy.is_closed as year_closed
       FROM public.fiscal_period fp
       JOIN public.fiscal_year fy ON fy.id = fp.fiscal_year_id
       WHERE fp.id = $1`,
      periodId
    )

    if (!periodRows[0]) {
      throw { code: "ERR_PERIOD_NOT_FOUND", message: "Fiscal period not found" }
    }

    if (!periodRows[0].is_closed) {
      throw { code: "ERR_PERIOD_NOT_CLOSED", message: "Fiscal period is not closed" }
    }

    if (periodRows[0].year_closed) {
      throw { code: "ERR_YEAR_CLOSED", message: "Cannot reopen period — fiscal year is closed" }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_period SET is_closed = FALSE WHERE id = $1`,
      periodId
    )

    return { success: true }
  },

  async closeYear(entitySchema: string, fiscalYearId: string, userId: string) {
    const yearRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM public.fiscal_year WHERE id = $1`,
      fiscalYearId
    )

    if (!yearRows[0]) {
      throw { code: "ERR_YEAR_NOT_FOUND", message: "Fiscal year not found" }
    }

    if (yearRows[0].is_closed) {
      throw { code: "ERR_YEAR_ALREADY_CLOSED", message: "Fiscal year is already closed" }
    }

    const openPeriods = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM public.fiscal_period 
       WHERE fiscal_year_id = $1 AND is_closed = FALSE`,
      fiscalYearId
    )

    if (Number(openPeriods[0]?.count || 0) > 0) {
      throw { code: "ERR_OPEN_PERIODS_EXIST", message: "Cannot close year with open periods" }
    }

    await prisma.$queryRawUnsafe(
      `UPDATE public.fiscal_year SET is_closed = TRUE WHERE id = $1`,
      fiscalYearId
    )

    return { success: true }
  },
}
