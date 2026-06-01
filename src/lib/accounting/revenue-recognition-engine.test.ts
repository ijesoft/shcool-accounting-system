import { describe, it, expect } from "vitest"

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1)
}

function overlapDays(
  rangeAStart: Date,
  rangeAEnd: Date,
  rangeBStart: Date,
  rangeBEnd: Date
): number {
  const start = rangeAStart > rangeBStart ? rangeAStart : rangeBStart
  const end = rangeAEnd < rangeBEnd ? rangeAEnd : rangeBEnd
  if (end < start) return 0
  return daysBetween(start, end)
}

describe("revenue recognition proration helpers", () => {
  it("computes overlap within term and period", () => {
    const overlap = overlapDays(
      new Date("2026-01-01"),
      new Date("2026-04-30"),
      new Date("2026-01-01"),
      new Date("2026-01-31")
    )
    expect(overlap).toBeGreaterThan(0)
  })

  it("returns zero overlap for disjoint ranges", () => {
    expect(
      overlapDays(
        new Date("2026-01-01"),
        new Date("2026-01-31"),
        new Date("2026-03-01"),
        new Date("2026-03-31")
      )
    ).toBe(0)
  })
})
