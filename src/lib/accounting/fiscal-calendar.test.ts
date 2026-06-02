import { describe, it, expect } from "vitest"
import { fiscalCalendar } from "./fiscal-calendar"

describe("fiscalCalendar", () => {
  describe("generateFiscalPeriods", () => {
    it("generates 12 monthly periods for a fiscal year", () => {
      const periods = fiscalCalendar.generateFiscalPeriods("2024-01-01", "2024-12-31", "monthly")
      expect(periods).toHaveLength(12)
    })

    it("generates 4 quarterly periods for a fiscal year", () => {
      const periods = fiscalCalendar.generateFiscalPeriods("2024-01-01", "2024-12-31", "quarterly")
      expect(periods).toHaveLength(4)
    })

    it("generates 1 annual period for a fiscal year", () => {
      const periods = fiscalCalendar.generateFiscalPeriods("2024-01-01", "2024-12-31", "annual")
      expect(periods).toHaveLength(1)
    })

    it("periods are sequential without gaps", () => {
      const periods = fiscalCalendar.generateFiscalPeriods("2024-01-01", "2024-12-31", "monthly")
      for (let i = 1; i < periods.length; i++) {
        const prevEnd = new Date(periods[i - 1].endDate)
        const currStart = new Date(periods[i].startDate)
        expect(currStart.getTime()).toBeGreaterThan(prevEnd.getTime())
      }
    })
  })
})
