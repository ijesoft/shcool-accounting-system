import { describe, it, expect } from "vitest"
import { budgetEngine } from "./budget-engine"

describe("budgetEngine", () => {
  describe("getBudgetVsActual", () => {
    it("is a callable function", () => {
      expect(typeof budgetEngine.getBudgetVsActual).toBe("function")
    })

    it("requires entitySchema and fiscalYearId", async () => {
      await expect(
        budgetEngine.getBudgetVsActual("", "")
      ).rejects.toThrow()
    })
  })

  describe("getBudgetSummary", () => {
    it("is a callable function", () => {
      expect(typeof budgetEngine.getBudgetSummary).toBe("function")
    })

    it("requires entitySchema and fiscalYearId", async () => {
      await expect(
        budgetEngine.getBudgetSummary("", "")
      ).rejects.toThrow()
    })
  })
})
