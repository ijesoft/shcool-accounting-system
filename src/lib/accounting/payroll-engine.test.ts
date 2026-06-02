import { describe, it, expect } from "vitest"
import {
  payrollEngine,
  computeHolidayPay,
  computeOvertimePay,
  computeNightDifferential,
  computeSILMonetization,
  THIRTEENTH_MONTH_EXEMPT_CEILING,
  DE_MINIMIS_LIMITS,
} from "./payroll-engine"

describe("payrollEngine", () => {
  // ─── SSS 2024 (R.A. 11199) ──────────────────────────────────────────────────
  describe("SSS 2024 contributions", () => {
    it("computes SSS at 4.5% employee / 9.5% employer for MSC 4,000 (floor)", () => {
      // salary 3,000 → MSC = clamp(round(3000/500)*500=3000, 4000, 30000) = 4,000
      const calc = payrollEngine.calculateLine(3000, 0)
      expect(calc.sssEmployee).toBe(Math.min(Math.round(4000 * 0.045), 1350)) // 180
      expect(calc.sssEmployer).toBe(Math.min(Math.round(4000 * 0.095), 2850)) // 380
    })

    it("computes SSS for salary 20,000 (MSC 20,000) with WISP", () => {
      // MSC = round(20000/500)*500 = 20000
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.sssEmployee).toBe(Math.round(20000 * 0.045)) // 900
      expect(calc.sssEmployer).toBe(Math.round(20000 * 0.095)) // 1900
      expect(calc.sssWisp).toBe(Math.round(20000 * 0.01))     // 200 (WISP triggered)
    })

    it("caps SSS employee at PHP 1,350 for salary >= 30,000", () => {
      const calc = payrollEngine.calculateLine(30000, 0)
      expect(calc.sssEmployee).toBe(1350)
      expect(calc.sssEmployer).toBe(2850)
    })

    it("caps SSS for very high salary (100,000)", () => {
      const calc = payrollEngine.calculateLine(100000, 0)
      expect(calc.sssEmployee).toBe(1350)
      expect(calc.sssEmployer).toBe(2850)
    })

    it("no WISP when MSC < 20,000", () => {
      const calc = payrollEngine.calculateLine(15000, 0)
      expect(calc.sssWisp).toBe(0)
    })

    it("WISP is triggered at MSC exactly 20,000", () => {
      const calc = payrollEngine.calculateLine(19750, 0)
      // round(19750/500)*500 = round(39.5)*500 = 20*500 = 20000
      expect(calc.sssWisp).toBeGreaterThan(0)
    })
  })

  // ─── PhilHealth 2025 (Circular 2024-0004) ────────────────────────────────────
  describe("PhilHealth 2025 contributions", () => {
    it("applies PHP 500/side floor for salary below 10,000", () => {
      const calc = payrollEngine.calculateLine(8000, 0)
      expect(calc.philhealthEmployee).toBe(500)
      expect(calc.philhealthEmployer).toBe(500)
    })

    it("calculates 2.5% each side for salary 10,000-100,000", () => {
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.philhealthEmployee).toBe(Math.round(20000 * 0.025)) // 500
      expect(calc.philhealthEmployer).toBe(Math.round(20000 * 0.025)) // 500
    })

    it("calculates 2.5% each side for salary 50,000", () => {
      const calc = payrollEngine.calculateLine(50000, 0)
      expect(calc.philhealthEmployee).toBe(Math.round(50000 * 0.025)) // 1250
      expect(calc.philhealthEmployer).toBe(1250)
    })

    it("caps PhilHealth at PHP 2,500/side for salary above 100,000", () => {
      const calc = payrollEngine.calculateLine(100001, 0)
      expect(calc.philhealthEmployee).toBe(2500)
      expect(calc.philhealthEmployer).toBe(2500)
    })

    it("caps PhilHealth at PHP 2,500/side for very high salary", () => {
      const calc = payrollEngine.calculateLine(500000, 0)
      expect(calc.philhealthEmployee).toBe(2500)
      expect(calc.philhealthEmployer).toBe(2500)
    })

    it("PhilHealth employee and employer are equal (split 2.5%/2.5%)", () => {
      const calc = payrollEngine.calculateLine(40000, 0)
      expect(calc.philhealthEmployee).toBe(calc.philhealthEmployer)
    })
  })

  // ─── Pag-IBIG ────────────────────────────────────────────────────────────────
  describe("Pag-IBIG contributions (capped at PHP 100)", () => {
    it("caps Pag-IBIG at PHP 100 for high salary", () => {
      const calc = payrollEngine.calculateLine(50000, 0)
      expect(calc.pagibigEmployee).toBe(100)
      expect(calc.pagibigEmployer).toBe(100)
    })

    it("caps Pag-IBIG at PHP 100 for low salary (if rate * salary > 100)", () => {
      const calc = payrollEngine.calculateLine(10000, 0)
      // 10000 * 0.02 = 200 > 100, so cap applies
      expect(calc.pagibigEmployee).toBe(100)
    })
  })

  // ─── Withholding tax ─────────────────────────────────────────────────────────
  describe("Withholding tax (TRAIN Law)", () => {
    it("no withholding tax for income <= 25,000", () => {
      const calc = payrollEngine.calculateLine(20000, 0)
      expect(calc.withholdingTax).toBe(0)
    })

    it("20% withholding tax for income in 25,001-50,000 bracket", () => {
      const calc = payrollEngine.calculateLine(35000, 0)
      expect(calc.withholdingTax).toBeGreaterThan(0)
      expect(calc.withholdingTax).toBeLessThan(10000)
    })

    it("higher withholding tax for high income (100,000)", () => {
      const calc = payrollEngine.calculateLine(100000, 0)
      expect(calc.withholdingTax).toBeGreaterThan(10000)
    })
  })

  // ─── 13th month TRAIN Law exemption ──────────────────────────────────────────
  describe("13th month and TRAIN Law exemption", () => {
    it("bonus within PHP 90,000 ceiling is non-taxable", () => {
      const calc = payrollEngine.calculateLine(20000, 0, 0, 50000)
      expect(calc.nonTaxableBonuses).toBe(50000)
      expect(calc.taxableBonuses).toBe(0)
    })

    it("bonus exceeding PHP 90,000 ceiling has taxable portion", () => {
      const calc = payrollEngine.calculateLine(20000, 0, 0, 100000)
      expect(calc.taxableBonuses).toBe(10000) // 100000 - 90000
      expect(calc.nonTaxableBonuses).toBe(90000)
    })

    it("THIRTEENTH_MONTH_EXEMPT_CEILING is PHP 90,000", () => {
      expect(THIRTEENTH_MONTH_EXEMPT_CEILING).toBe(90000)
    })
  })

  // ─── Net pay ──────────────────────────────────────────────────────────────────
  describe("net pay calculation", () => {
    it("net pay equals gross minus deductions", () => {
      const basicPay = 25000
      const allowances = 5000
      const calc = payrollEngine.calculateLine(basicPay, allowances)
      const expectedGross = basicPay + allowances
      expect(calc.grossPay).toBe(expectedGross)
      expect(calc.netPay).toBe(calc.grossPay - calc.totalDeductions)
    })

    it("total deductions include all employee deduction components", () => {
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

  // ─── Extras (holiday, OT, ND, SIL) ───────────────────────────────────────────
  describe("extras in gross pay", () => {
    it("includes holiday pay in gross pay", () => {
      const calc = payrollEngine.calculateLine(20000, 0, 0, 0, { holidayPay: 1000 })
      expect(calc.grossPay).toBe(21000)
      expect(calc.holidayPay).toBe(1000)
    })

    it("includes overtime pay in gross pay", () => {
      const calc = payrollEngine.calculateLine(20000, 0, 0, 0, { overtimePay: 500 })
      expect(calc.overtimePay).toBe(500)
    })
  })
})

// ─── Holiday pay ────────────────────────────────────────────────────────────
describe("computeHolidayPay", () => {
  const dailyRate = 1000

  it("regular holiday worked: 200% of daily rate", () => {
    expect(computeHolidayPay(dailyRate, "regular", true)).toBe(2000)
  })

  it("regular holiday not worked: 100% of daily rate (Art. 94)", () => {
    expect(computeHolidayPay(dailyRate, "regular", false)).toBe(1000)
  })

  it("special non-working worked: 130% of daily rate", () => {
    expect(computeHolidayPay(dailyRate, "special", true)).toBe(1300)
  })

  it("special non-working not worked: 0 (no work no pay)", () => {
    expect(computeHolidayPay(dailyRate, "special", false)).toBe(0)
  })
})

// ─── Overtime pay ────────────────────────────────────────────────────────────
describe("computeOvertimePay", () => {
  const hourlyRate = 100

  it("regular OT: 125% × hours", () => {
    expect(computeOvertimePay(hourlyRate, 2, "regular")).toBe(250) // 100 * 1.25 * 2
  })

  it("rest day OT: 130% × hours", () => {
    expect(computeOvertimePay(hourlyRate, 2, "restday")).toBe(260) // 100 * 1.30 * 2
  })

  it("holiday OT: 130% × hours", () => {
    expect(computeOvertimePay(hourlyRate, 2, "holiday")).toBe(260)
  })

  it("night differential adds 10% per hour", () => {
    // regular OT + ND: 100 * 1.25 * 2 + 100 * 0.10 * 2 = 250 + 20 = 270
    expect(computeOvertimePay(hourlyRate, 2, "regular", true)).toBe(270)
  })
})

// ─── Night differential ──────────────────────────────────────────────────────
describe("computeNightDifferential", () => {
  it("computes 10% of hourly rate × hours", () => {
    expect(computeNightDifferential(100, 4)).toBe(40) // 100 * 0.10 * 4
  })
})

// ─── SIL monetization ────────────────────────────────────────────────────────
describe("computeSILMonetization", () => {
  it("monetizes unused leave days", () => {
    expect(computeSILMonetization(1000, 3)).toBe(3000)
  })

  it("caps at 5 days per Labor Code Art. 95", () => {
    expect(computeSILMonetization(1000, 10)).toBe(5000) // capped at 5 days
  })
})

// ─── De minimis constants ────────────────────────────────────────────────────
describe("DE_MINIMIS_LIMITS", () => {
  it("rice subsidy monthly limit is PHP 2,000", () => {
    expect(DE_MINIMIS_LIMITS.riceSubsidyMonthly).toBe(2000)
  })

  it("clothing allowance annual limit is PHP 6,000", () => {
    expect(DE_MINIMIS_LIMITS.clothingAllowanceAnnual).toBe(6000)
  })
})
