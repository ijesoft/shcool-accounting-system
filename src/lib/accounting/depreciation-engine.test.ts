import { describe, it, expect } from "vitest"
import { depreciationEngine } from "./depreciation-engine"

describe("depreciationEngine", () => {
  it("straight line: total depreciation equals depreciable base", () => {
    const schedule = depreciationEngine.generateSchedule(
      "straight_line", 120000, 10000, 5, "2024-01-01", 60
    )
    const lastLine = schedule.lines[schedule.lines.length - 1]
    expect(lastLine.accumulatedDepreciation).toBeCloseTo(110000, 2)
    expect(lastLine.netBookValue).toBeCloseTo(10000, 2)
  })

  it("declining balance: never goes below salvage value", () => {
    const schedule = depreciationEngine.generateSchedule(
      "declining_balance", 100000, 5000, 5, "2024-01-01", 60
    )
    for (const line of schedule.lines) {
      expect(line.netBookValue).toBeGreaterThanOrEqual(5000)
    }
  })

  it("sum of years digits: total depreciation equals depreciable base", () => {
    const schedule = depreciationEngine.generateSchedule(
      "sum_of_years", 100000, 10000, 4, "2024-01-01", 48
    )
    const lastLine = schedule.lines[schedule.lines.length - 1]
    expect(lastLine.accumulatedDepreciation).toBeCloseTo(90000, 2)
  })
})
