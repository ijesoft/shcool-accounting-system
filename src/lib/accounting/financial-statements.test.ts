import { describe, it, expect } from "vitest"
import { financialStatements } from "./financial-statements"

describe("financialStatements", () => {
  describe("trialBalance", () => {
    it("is a callable function", () => {
      expect(typeof financialStatements.trialBalance).toBe("function")
    })
  })

  describe("incomeStatement", () => {
    it("is a callable function", () => {
      expect(typeof financialStatements.incomeStatement).toBe("function")
    })
  })

  describe("balanceSheet", () => {
    it("is a callable function", () => {
      expect(typeof financialStatements.balanceSheet).toBe("function")
    })
  })

  describe("changesInEquity", () => {
    it("is a callable function", () => {
      expect(typeof financialStatements.changesInEquity).toBe("function")
    })
  })

  describe("cashFlow", () => {
    it("is a callable function", () => {
      expect(typeof financialStatements.cashFlow).toBe("function")
    })
  })
})
