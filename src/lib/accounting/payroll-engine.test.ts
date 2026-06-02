import { describe, it, expect } from "vitest"
import { payrollEngine } from "./payroll-engine"

describe("payrollEngine", () => {
  describe("SSS contributions", () => {
    it("calculates SSS for minimum wage (10,000)", () => {
      const calc = payrollEngine.calculateLine(10000, 0)
      expect(calc.sssEmployee).toBe(100)
      expect(calc.sssEmployer).toBe(150)
    })

    it("calculates SSS for mid-range wage (25,000)", () => {
      const calc = payrollEngine.calculateLine(25000, 0)
      expect(calc.sssEmployee).toBe(330)
      expect(calc.sssEmployer).toBe(375)
    })

    it("caps SSS at maximum contribution (40,000+)", () => {
      const calc = payrollEngine.calculateLine(40000, 0)
      expect(calc.sssEmployee).toBe(555)
      expect(calc.sssEmployer).toBe(600)
    })

    it("caps SSS for very high wage (1,000,000)", () => {
      const calc = payrollEngine.calculateLine(1000000, 0)
      expect(calc.sssEmployee).toBe(555)
      expect(calc.sssEmployer).toBe(600)
    })
  })

  describe("PhilHealth contributions", () => {
    it("calculates PhilHealth for minimum wage (10,000)", () => {
      const calc = payrollEngine.calculateLine(10000, 0)
      expect(calc.philhealthEmployee).toBe(400)
      expect(calc.philhealthEmployer).toBe(400)
    })

    it("calculates PhilHealth for mid-range wage (25,000)", () => {
      const calc = payrollEngine.calculateLine(25000, 0)
      expect(calc.philhealthEmployee).toBe(1000)
      expect(calc.philhealthEmployer).toBe(1000)
    })

    it("caps PhilHealth at maximum (40,000+)", () => {
      const calc = payrollEngine.calculateLine(40000, 0)
      expect(calc.philhealthEmployee).toBe(1600)
      expect(calc.philhealthEmployer).toBe(1600)
    })
  })

  describe("Pag-IBIG contributions", () => {
    it("calculates Pag-IBIG at 1% for low wage (10,000)", () => {
      const calc = payrollEngine.calculateLine(10000, 0)
      expect(calc.pagibigEmployee).toBe(100)
      expect(calc.pagibigEmployer).toBe(100)
    })

    it("calculates Pag-IBIG at 2% for mid wage (20,000)", () => {
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.pagibigEmployee).toBe(400)
      expect(calc.pagibigEmployer).toBe(400)
    })
  })

  describe("Withholding tax", () => {
    it("no withholding tax for low income (20,000)", () => {
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.withholdingTax).toBe(0)
    })

    it("20% withholding tax for mid income (35,000)", () => {
      const calc = payrollEngine.calculateLine(35000, 0)
      expect(calc.withholdingTax).toBeGreaterThan(0)
      expect(calc.withholdingTax).toBeLessThan(10000)
    })

    it("higher withholding tax for high income (100,000)", () => {
      const calc = payrollEngine.calculateLine(100000, 0)
      expect(calc.withholdingTax).toBeGreaterThan(10000)
    })
  })

  describe("net pay calculation", () => {
    it("net pay equals gross minus deductions", () => {
      const basicPay = 25000
      const allowances = 5000
      const calc = payrollEngine.calculateLine(basicPay, allowances)
      const expectedGross = basicPay + allowances
      expect(calc.grossPay).toBe(expectedGross)
      expect(calc.netPay).toBe(
        calc.grossPay - calc.totalDeductions
      )
    })

    it("total deductions include all components", () => {
      const calc = payrollEngine.calculateLine(25000, 5000)
      const expectedDeductions =
        calc.sssEmployee +
        calc.philhealthEmployee +
        calc.pagibigEmployee +
        calc.withholdingTax
      expect(calc.totalDeductions).toBe(expectedDeductions)
    })

    it("net pay is positive for reasonable wages", () => {
      const calc = payrollEngine.calculateLine(15000, 2000)
      expect(calc.netPay).toBeGreaterThan(0)
    })
  })

  describe("with allowances", () => {
    it("includes allowances in gross pay", () => {
      const calc = payrollEngine.calculateLine(20000, 5000)
      expect(calc.grossPay).toBe(25000)
      expect(calc.allowances).toBe(5000)
    })

    it("allowances do not affect SSS contribution base", () => {
      const withAllowances = payrollEngine.calculateLine(20000, 5000)
      const withoutAllowances = payrollEngine.calculateLine(20000, 0)
      expect(withAllowances.sssEmployee).toBe(withoutAllowances.sssEmployee)
    })
  })

  describe("thirteenth month accrual", () => {
    it("defaults to zero", () => {
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.thirteenthMonthAccrual).toBe(0)
    })
  })
})
