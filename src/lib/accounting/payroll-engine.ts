import { prisma } from "@/lib/db"

// ─── SSS 2024 (R.A. 11199) ───────────────────────────────────────────────────
// MSC = clamp(round(salary / 500) * 500, 4000, 30000)
// Employee: 4.5%, Employer: 9.5%
// WISP (Mandatory Provident Fund): 1% each when MSC >= 20,000
// Max employee: PHP 1,350, max employer: PHP 2,850 at MSC 30,000

function computeMSC(salary: number): number {
  const rounded = Math.round(salary / 500) * 500
  return Math.min(Math.max(rounded, 4000), 30000)
}

function computeSSS(salary: number): { employee: number; employer: number; wisp: number } {
  const msc = computeMSC(salary)
  const employee = Math.min(Math.round(msc * 0.045), 1350)
  const employer = Math.min(Math.round(msc * 0.095), 2850)
  const wisp = msc >= 20000 ? Math.round(msc * 0.01) : 0
  return { employee, employer, wisp }
}

// ─── PhilHealth 2025 (Circular 2024-0004) ────────────────────────────────────
// Total 5%: 2.5% employee + 2.5% employer
// Floor: salary < 10,000 → PHP 500 each side
// Ceiling: salary > 100,000 → PHP 2,500 each side

function computePhilHealth(salary: number): { employee: number; employer: number } {
  let half: number
  if (salary < 10000) {
    half = 500
  } else if (salary > 100000) {
    half = 2500
  } else {
    half = Math.round(salary * 0.025)
  }
  return { employee: half, employer: half }
}

// ─── Pag-IBIG ────────────────────────────────────────────────────────────────
// Statutory max PHP 100 per side

interface PagIBIGBracket {
  minCW: number
  maxCW: number
  rate: number
}

const PAGIBIG_TABLE: PagIBIGBracket[] = [
  { minCW: 0, maxCW: 1499, rate: 0.01 },
  { minCW: 1500, maxCW: 1800000, rate: 0.02 },
]

function computePagIBIG(salary: number): number {
  const bracket = PAGIBIG_TABLE.find(b => salary >= b.minCW && salary <= b.maxCW)
  const rate = bracket ? bracket.rate : 0.02
  return Math.min(Math.round(salary * rate), 100)
}

// ─── Withholding Tax (TRAIN Law, 2023 tables) ─────────────────────────────────

interface WHTBracket {
  minMonthly: number
  maxMonthly: number
  rate: number
  deduction: number
}

const WHT_TABLE: WHTBracket[] = [
  { minMonthly: 0, maxMonthly: 25000, rate: 0, deduction: 0 },
  { minMonthly: 25001, maxMonthly: 50000, rate: 0.2, deduction: 0 },
  { minMonthly: 50001, maxMonthly: 67000, rate: 0.25, deduction: 3750 },
  { minMonthly: 67001, maxMonthly: 167000, rate: 0.3, deduction: 7125 },
  { minMonthly: 167001, maxMonthly: 417000, rate: 0.32, deduction: 14125 },
  { minMonthly: 417001, maxMonthly: 833000, rate: 0.35, deduction: 24625 },
  { minMonthly: 833001, maxMonthly: 8333333, rate: 0.375, deduction: 156125 },
]

function findWHT(monthlyTaxable: number): number {
  const bracket = WHT_TABLE.find(b => monthlyTaxable >= b.minMonthly && monthlyTaxable <= b.maxMonthly)
  if (!bracket) return 0
  const tax = monthlyTaxable * bracket.rate - bracket.deduction
  return Math.max(0, Math.round(tax))
}

// ─── De Minimis Benefits ─────────────────────────────────────────────────────

export interface DeMinimisBenefits {
  riceSubsidy?: number
  clothingAllowance?: number
  laundryAllowance?: number
  medicalCashAllowance?: number
  christmasGift?: number
  achievementAwards?: number
}

export const DE_MINIMIS_LIMITS = {
  riceSubsidyMonthly: 2000,
  clothingAllowanceAnnual: 6000,
  laundryAllowanceMonthly: 300,
  medicalCashAllowanceAnnual: 10000,
  christmasGiftAnnual: 5000,
  achievementAwardsAnnual: 10000,
}

export const THIRTEENTH_MONTH_EXEMPT_CEILING = 90000

// ─── Holiday and Overtime helpers ────────────────────────────────────────────

/**
 * Compute holiday pay per Labor Code Art. 94 and DOLE rules.
 * Regular holiday worked: 200% (dailyRate * 2)
 * Regular holiday not worked: 100% (dailyRate * 1) — paid leave
 * Special non-working worked: 130% (dailyRate * 1.3)
 * Special non-working not worked: 0 (no work no pay)
 */
export function computeHolidayPay(
  dailyRate: number,
  holidayType: "regular" | "special",
  worked: boolean
): number {
  if (holidayType === "regular") {
    return worked ? dailyRate * 2 : dailyRate * 1
  }
  // special non-working
  return worked ? dailyRate * 1.3 : 0
}

/**
 * Compute overtime pay.
 * Regular OT: hourlyRate * 1.25 * hours
 * Rest day OT: hourlyRate * 1.30 * hours
 * Holiday OT: hourlyRate * 1.30 * hours (same as rest day premium for holidays)
 * Night diff additional: +10% of hourly rate per hour
 */
export function computeOvertimePay(
  hourlyRate: number,
  overtimeHours: number,
  dayType: "regular" | "restday" | "holiday",
  isNightDiff: boolean = false
): number {
  let multiplier: number
  if (dayType === "regular") {
    multiplier = 1.25
  } else {
    // restday or holiday
    multiplier = 1.30
  }
  const base = hourlyRate * multiplier * overtimeHours
  const nightAdd = isNightDiff ? hourlyRate * 0.10 * overtimeHours : 0
  return Math.round((base + nightAdd) * 100) / 100
}

/**
 * Night differential: 10% of hourly rate for hours worked between 10pm-6am.
 */
export function computeNightDifferential(hourlyRate: number, nightHours: number): number {
  return Math.round(hourlyRate * 0.10 * nightHours * 100) / 100
}

/**
 * Service Incentive Leave monetization (Labor Code Art. 95).
 * Capped at 5 days/year.
 */
export function computeSILMonetization(dailyRate: number, unusedLeaveDays: number): number {
  const cappedDays = Math.min(unusedLeaveDays, 5)
  return Math.round(dailyRate * cappedDays * 100) / 100
}

// ─── PayrollLineCalc interface ────────────────────────────────────────────────

export interface PayrollLineCalc {
  basicPay: number
  allowances: number
  grossPay: number
  sssEmployee: number
  sssEmployer: number
  sssWisp: number
  philhealthEmployee: number
  philhealthEmployer: number
  pagibigEmployee: number
  pagibigEmployer: number
  withholdingTax: number
  totalDeductions: number
  netPay: number
  thirteenthMonthAccrual: number
  taxableBonuses: number
  nonTaxableBonuses: number
  holidayPay: number
  overtimePay: number
  nightDifferential: number
  silMonetization: number
}

// ─── payrollEngine ────────────────────────────────────────────────────────────

export const payrollEngine = {
  calculateLine(
    basicPay: number,
    allowances: number,
    thirteenthMonthAccrual: number = 0,
    cumulativeAnnualBonus: number = 0,
    extras: {
      holidayPay?: number
      overtimePay?: number
      nightDifferential?: number
      silMonetization?: number
    } = {}
  ): PayrollLineCalc {
    const holidayPay = extras.holidayPay ?? 0
    const overtimePay = extras.overtimePay ?? 0
    const nightDifferential = extras.nightDifferential ?? 0
    const silMonetization = extras.silMonetization ?? 0

    const grossPay = basicPay + allowances + holidayPay + overtimePay + nightDifferential + silMonetization

    // SSS 2024
    const sss = computeSSS(basicPay)

    // PhilHealth 2025
    const ph = computePhilHealth(basicPay)

    // Pag-IBIG (capped at PHP 100/side)
    const pagibigAmt = computePagIBIG(basicPay)

    // 13th month TRAIN Law: only taxable portion counts in WHT base
    const taxableBonuses = Math.max(0, cumulativeAnnualBonus - THIRTEENTH_MONTH_EXEMPT_CEILING)
    const nonTaxableBonuses = cumulativeAnnualBonus - taxableBonuses

    // WHT base = gross pay + taxable bonus portion (monthly allocation)
    const whtBase = grossPay + taxableBonuses
    const wht = findWHT(whtBase)

    const totalDeductions = sss.employee + ph.employee + pagibigAmt + wht
    const netPay = grossPay - totalDeductions

    return {
      basicPay,
      allowances,
      grossPay,
      sssEmployee: sss.employee,
      sssEmployer: sss.employer,
      sssWisp: sss.wisp,
      philhealthEmployee: ph.employee,
      philhealthEmployer: ph.employer,
      pagibigEmployee: pagibigAmt,
      pagibigEmployer: pagibigAmt,
      withholdingTax: wht,
      totalDeductions,
      netPay,
      thirteenthMonthAccrual,
      taxableBonuses,
      nonTaxableBonuses,
      holidayPay,
      overtimePay,
      nightDifferential,
      silMonetization,
    }
  },

  async generatePayRunLines(
    entitySchema: string,
    payPeriodStart: string,
    payPeriodEnd: string
  ): Promise<{ employeeId: string; calc: PayrollLineCalc }[]> {
    const employees = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".employee WHERE is_active = TRUE`
    )

    const lines = employees.map(emp => {
      const calc = this.calculateLine(Number(emp.basic_pay), Number(emp.allowances) || 0)
      return { employeeId: emp.id, calc }
    })

    return lines
  },

  async buildJournalEntryLines(
    entitySchema: string,
    payLines: { employeeId: string; calc: PayrollLineCalc }[]
  ): Promise<{ accountId: string; debit: number; credit: number; lineDescription: string; lineOrder: number }[]> {
    const accountMap = await this.getAccountMap(entitySchema)

    let order = 1
    const jeLines: { accountId: string; debit: number; credit: number; lineDescription: string; lineOrder: number }[] = []

    const totals = payLines.reduce((acc, { calc }) => ({
      grossPay: acc.grossPay + calc.grossPay,
      sssEmployer: acc.sssEmployer + calc.sssEmployer,
      sssEmployee: acc.sssEmployee + calc.sssEmployee,
      philhealthEmployer: acc.philhealthEmployer + calc.philhealthEmployer,
      philhealthEmployee: acc.philhealthEmployee + calc.philhealthEmployee,
      pagibigEmployer: acc.pagibigEmployer + calc.pagibigEmployer,
      pagibigEmployee: acc.pagibigEmployee + calc.pagibigEmployee,
      withholdingTax: acc.withholdingTax + calc.withholdingTax,
      totalDeductions: acc.totalDeductions + calc.totalDeductions,
      netPay: acc.netPay + calc.netPay,
      thirteenthMonthAccrual: acc.thirteenthMonthAccrual + calc.thirteenthMonthAccrual,
    }), {
      grossPay: 0, sssEmployer: 0, sssEmployee: 0,
      philhealthEmployer: 0, philhealthEmployee: 0,
      pagibigEmployer: 0, pagibigEmployee: 0,
      withholdingTax: 0, totalDeductions: 0,
      netPay: 0, thirteenthMonthAccrual: 0,
    })

    // Debit: Salaries and wages expense
    jeLines.push({
      accountId: accountMap.salaryExpense,
      debit: totals.grossPay,
      credit: 0,
      lineDescription: "Salaries and wages expense",
      lineOrder: order++,
    })

    // Debit: Employer contributions expense
    const employerContribExpense =
      (totals.sssEmployer - totals.sssEmployee) +
      (totals.philhealthEmployer - totals.philhealthEmployee) +
      (totals.pagibigEmployer - totals.pagibigEmployee)
    if (employerContribExpense > 0) {
      jeLines.push({
        accountId: accountMap.contributionExpense,
        debit: employerContribExpense,
        credit: 0,
        lineDescription: "Employer contributions expense (SSS/PhilHealth/Pag-IBIG)",
        lineOrder: order++,
      })
    }

    // Credit: Cash/bank (net pay)
    jeLines.push({
      accountId: accountMap.cash,
      debit: 0,
      credit: totals.netPay,
      lineDescription: "Cash disbursement - net pay",
      lineOrder: order++,
    })

    // Credit: SSS/PhilHealth/Pag-IBIG payable (employee + employer)
    const totalContribPayable = totals.sssEmployer + totals.philhealthEmployer + totals.pagibigEmployer
    if (totalContribPayable > 0) {
      jeLines.push({
        accountId: accountMap.sssPayable,
        debit: 0,
        credit: totalContribPayable,
        lineDescription: "SSS/PhilHealth/Pag-IBIG payable (employee + employer)",
        lineOrder: order++,
      })
    }

    // Credit: Withholding tax payable
    if (totals.withholdingTax > 0) {
      jeLines.push({
        accountId: accountMap.whtPayable,
        debit: 0,
        credit: totals.withholdingTax,
        lineDescription: "Withholding tax on compensation payable",
        lineOrder: order++,
      })
    }

    // Credit: 13th month accrual
    if (totals.thirteenthMonthAccrual > 0) {
      jeLines.push({
        accountId: accountMap.thirteenthMonthPayable,
        debit: 0,
        credit: totals.thirteenthMonthAccrual,
        lineDescription: "13th month pay accrual",
        lineOrder: order++,
      })
    }

    return jeLines
  },

  async getAccountMap(entitySchema: string): Promise<{
    salaryExpense: string
    contributionExpense: string
    cash: string
    sssPayable: string
    philhealthPayable: string
    pagibigPayable: string
    whtPayable: string
    thirteenthMonthPayable: string
  }> {
    const accountCodes = {
      salaryExpense: "51110",
      contributionExpense: "55270",
      cash: "11121",
      sssPayable: "21510",
      philhealthPayable: "21520",
      pagibigPayable: "21530",
      whtPayable: "21430",
      thirteenthMonthPayable: "21610",
    }

    const map: any = {}
    for (const [key, code] of Object.entries(accountCodes)) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM "${entitySchema}".account WHERE account_code = $1 LIMIT 1`,
        code
      )
      if (rows[0]) {
        map[key] = rows[0].id
      }
    }

    return map
  },
}
