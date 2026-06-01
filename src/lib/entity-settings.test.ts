import { describe, it, expect } from "vitest"

function getRevenueAccountForFeeType(feeType: string): string {
  const key = feeType.trim().toLowerCase().replace(/\s+/g, "_")
  const map: Record<string, string> = {
    tuition: "41100",
    misc: "41200",
    miscellaneous: "41200",
    laboratory: "41300",
    lab: "41300",
    other: "41400",
  }
  return map[key] ?? "41100"
}

function getDeferredAccountForFeeType(
  feeType: string,
  method: "term_straight_line" | "immediate"
): string {
  if (method === "immediate") {
    return getRevenueAccountForFeeType(feeType)
  }
  const key = feeType.trim().toLowerCase().replace(/\s+/g, "_")
  if (key === "tuition" || key === "registration") {
    return "21300"
  }
  return getRevenueAccountForFeeType(feeType)
}

describe("entity settings account mapping", () => {
  it("defers tuition under term_straight_line", () => {
    expect(getDeferredAccountForFeeType("tuition", "term_straight_line")).toBe("21300")
  })

  it("recognizes tuition immediately when configured", () => {
    expect(getDeferredAccountForFeeType("tuition", "immediate")).toBe("41100")
  })

  it("maps misc fees to miscellaneous revenue", () => {
    expect(getRevenueAccountForFeeType("misc")).toBe("41200")
  })
})
