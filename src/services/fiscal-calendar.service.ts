import { prisma } from "@/lib/db"
import { periodControl } from "@/lib/accounting/period-control"
import { ensureFiscalCalendar } from "@/lib/accounting/fiscal-calendar"

export const fiscalCalendarService = {
  async listYears(entityId: string) {
    return prisma.fiscalYear.findMany({
      where: { entityId },
      include: { periods: { orderBy: { periodNumber: "asc" } } },
      orderBy: { startDate: "desc" },
    })
  },

  async getCurrentYear(entityId: string) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    if (!entity) throw new Error("Entity not found")

    let year = await prisma.fiscalYear.findFirst({
      where: { entityId, isClosed: false },
      include: { periods: { orderBy: { periodNumber: "asc" } } },
      orderBy: { startDate: "desc" },
    })

    if (!year) {
      year = await ensureFiscalCalendar(entityId, entity.fiscalYearStart)
    }

    return year
  },

  async bootstrap(entityId: string) {
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    if (!entity) throw new Error("Entity not found")
    return ensureFiscalCalendar(entityId, entity.fiscalYearStart)
  },

  async closePeriod(entitySchema: string, periodId: string, userId: string) {
    return periodControl.closePeriod(entitySchema, periodId, userId)
  },

  async reopenPeriod(entitySchema: string, periodId: string, userId: string) {
    return periodControl.reopenPeriod(entitySchema, periodId, userId)
  },

  async closeYear(entitySchema: string, fiscalYearId: string, userId: string) {
    return periodControl.closeYear(entitySchema, fiscalYearId, userId)
  },
}
