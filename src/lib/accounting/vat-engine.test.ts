import { describe, it, expect } from "vitest"
import { vatEngine } from "./vat-engine"

describe("vatEngine", () => {
  describe("calculateVat", () => {
    it("calculates 12% VAT on taxable amount", () => {
      const result = vatEngine.calculateVat(1000, 12)
      expect(result.vatAmount).toBe(120)
      expect(result.totalWithVat).toBe(1120)
    })

    it("calculates 0% VAT for exempt amount", () => {
      const result = vatEngine.calculateVat(1000, 0)
      expect(result.vatAmount).toBe(0)
      expect(result.totalWithVat).toBe(1000)
    })

    it("handles zero amount", () => {
      const result = vatEngine.calculateVat(0, 12)
      expect(result.vatAmount).toBe(0)
      expect(result.totalWithVat).toBe(0)
    })
  })

  describe("extractVat", () => {
    it("extracts VAT-inclusive amount", () => {
      const result = vatEngine.extractVat(1120, 12)
      expect(result.baseAmount).toBeCloseTo(1000, 2)
      expect(result.vatAmount).toBeCloseTo(120, 2)
    })

    it("handles zero VAT rate", () => {
      const result = vatEngine.extractVat(1000, 0)
      expect(result.baseAmount).toBe(1000)
      expect(result.vatAmount).toBe(0)
    })
  })
})
