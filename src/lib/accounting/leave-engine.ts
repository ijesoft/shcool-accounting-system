// Leave Engine — Labor Code of the Philippines compliance
// Service Incentive Leave, Holiday Pay, Overtime, Night Differential

export const LABOR_CODE_SIL_DAYS = 5

export const leaveEngine = {
  /**
   * Compute holiday pay per Labor Code Art. 94 and DOLE rules.
   * Regular holiday worked: dailyRate * 2 (200%)
   * Regular holiday not worked: dailyRate * 1 (100% — paid leave Art. 94)
   * Special non-working worked: dailyRate * 1.3 (130%)
   * Special non-working not worked: 0 (no work no pay)
   */
  computeHolidayPay(
    dailyRate: number,
    holidayType: "regular" | "special",
    worked: boolean
  ): number {
    if (holidayType === "regular") {
      return worked ? dailyRate * 2 : dailyRate * 1
    }
    return worked ? dailyRate * 1.3 : 0
  },

  /**
   * Compute overtime pay.
   * Weekday OT: hourlyRate * 1.25 * hours
   * Rest day OT: hourlyRate * 1.30 * hours
   * Holiday OT: hourlyRate * 1.30 * hours
   * Night diff additional: +10% of hourly rate per hour on top of OT
   */
  computeOvertimePay(
    hourlyRate: number,
    hours: number,
    dayType: "weekday" | "restday" | "holiday",
    isNightDiff: boolean = false
  ): number {
    const multiplier = dayType === "weekday" ? 1.25 : 1.30
    const base = hourlyRate * multiplier * hours
    const nightAdd = isNightDiff ? hourlyRate * 0.10 * hours : 0
    return Math.round((base + nightAdd) * 100) / 100
  },

  /**
   * Night differential: 10% of hourly rate for hours worked 10pm–6am.
   */
  computeNightDifferential(hourlyRate: number, nightHours: number): number {
    return Math.round(hourlyRate * 0.10 * nightHours * 100) / 100
  },

  /**
   * SIL monetization — Labor Code Art. 95.
   * Capped at 5 days/year.
   */
  computeSILMonetization(dailyRate: number, unusedDays: number): number {
    const cappedDays = Math.min(unusedDays, LABOR_CODE_SIL_DAYS)
    return Math.round(dailyRate * cappedDays * 100) / 100
  },

  /**
   * Compute monthly daily rate.
   * Default: 22 working days/month (DOLE standard for monthly-paid employees).
   */
  computeMonthlyDailyRate(monthlyBasic: number, workingDaysPerMonth: number = 22): number {
    return Math.round((monthlyBasic / workingDaysPerMonth) * 100) / 100
  },
}
