import { describe, it, expect } from "vitest"

describe("fee type normalization", () => {
  function normalizeFeeType(feeType: string): string {
    return feeType.trim().toLowerCase().replace(/\s+/g, "_")
  }

  const FEE_TYPE_CREDIT_ACCOUNTS: Record<string, string> = {
    tuition: "21300",
    misc: "41200",
    miscellaneous: "41200",
    laboratory: "41300",
    lab: "41300",
    other: "41400",
  }

  function getCreditAccountCode(feeType: string): string {
    const key = normalizeFeeType(feeType)
    return FEE_TYPE_CREDIT_ACCOUNTS[key] ?? "21300"
  }

  it("maps tuition to unearned tuition", () => {
    expect(getCreditAccountCode("tuition")).toBe("21300")
  })

  it("maps laboratory fees to revenue account", () => {
    expect(getCreditAccountCode("laboratory")).toBe("41300")
  })

  it("defaults unknown fee types to unearned tuition", () => {
    expect(getCreditAccountCode("registration")).toBe("21300")
  })
})
