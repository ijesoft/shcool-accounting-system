import { prisma } from "@/lib/db"

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function formatFiscalYearLabel(startDate: Date): string {
  const startYear = startDate.getFullYear()
  const endYear = startDate.getMonth() === 0 && startDate.getDate() === 1
    ? startYear
    : startYear + 1
  return startYear === endYear ? `FY ${startYear}` : `SY ${startYear}-${String(endYear).slice(-2)}`
}

export async function ensureFiscalCalendar(entityId: string, fiscalYearStart: Date) {
  const existing = await prisma.fiscalYear.findFirst({
    where: { entityId, isClosed: false },
    orderBy: { startDate: "desc" },
    include: { periods: { orderBy: { periodNumber: "asc" } } },
  })
  if (existing) return existing

  const startDate = new Date(fiscalYearStart)
  startDate.setHours(0, 0, 0, 0)

  const endDate = addMonths(startDate, 12)
  endDate.setDate(endDate.getDate() - 1)

  const label = formatFiscalYearLabel(startDate)

  const periods = Array.from({ length: 12 }, (_, index) => {
    const periodStart = addMonths(startDate, index)
    const periodEnd = addMonths(startDate, index + 1)
    periodEnd.setDate(periodEnd.getDate() - 1)
    return {
      periodNumber: index + 1,
      startDate: periodStart,
      endDate: periodEnd,
    }
  })

  return prisma.fiscalYear.create({
    data: {
      entityId,
      label,
      startDate,
      endDate,
      periods: { create: periods },
    },
    include: { periods: true },
  })
}
