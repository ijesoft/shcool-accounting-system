import { prisma } from "@/lib/db"

interface SSSBracket {
  minCW: number
  maxCW: number
  employeeShare: number
  employerShare: number
}

interface PhilHealthBracket {
  minCW: number
  maxCW: number
  rate: number
  maxContribution: number
}

interface PagIBIGBracket {
  minCW: number
  maxCW: number
  rate: number
}

interface WHTBracket {
  minMonthly: number
  maxMonthly: number
  rate: number
  deduction: number
}

const SSS_TABLE: SSSBracket[] = [
  { minCW: 10000, maxCW: 10249, employeeShare: 100, employerShare: 150 },
  { minCW: 10500, maxCW: 10749, employeeShare: 113, employerShare: 158 },
  { minCW: 11000, maxCW: 11249, employeeShare: 120, employerShare: 165 },
  { minCW: 11500, maxCW: 11749, employeeShare: 128, employerShare: 173 },
  { minCW: 12000, maxCW: 12249, employeeShare: 135, employerShare: 180 },
  { minCW: 12500, maxCW: 12749, employeeShare: 143, employerShare: 188 },
  { minCW: 13000, maxCW: 13249, employeeShare: 150, employerShare: 195 },
  { minCW: 13500, maxCW: 13749, employeeShare: 158, employerShare: 203 },
  { minCW: 14000, maxCW: 14249, employeeShare: 165, employerShare: 210 },
  { minCW: 14500, maxCW: 14749, employeeShare: 173, employerShare: 218 },
  { minCW: 15000, maxCW: 15249, employeeShare: 180, employerShare: 225 },
  { minCW: 15500, maxCW: 15749, employeeShare: 188, employerShare: 233 },
  { minCW: 16000, maxCW: 16249, employeeShare: 195, employerShare: 240 },
  { minCW: 16500, maxCW: 16749, employeeShare: 203, employerShare: 248 },
  { minCW: 17000, maxCW: 17249, employeeShare: 210, employerShare: 255 },
  { minCW: 17500, maxCW: 17749, employeeShare: 218, employerShare: 263 },
  { minCW: 18000, maxCW: 18249, employeeShare: 225, employerShare: 270 },
  { minCW: 18500, maxCW: 18749, employeeShare: 233, employerShare: 278 },
  { minCW: 19000, maxCW: 19249, employeeShare: 240, employerShare: 285 },
  { minCW: 19500, maxCW: 19749, employeeShare: 248, employerShare: 293 },
  { minCW: 20000, maxCW: 20249, employeeShare: 255, employerShare: 300 },
  { minCW: 20500, maxCW: 20749, employeeShare: 263, employerShare: 308 },
  { minCW: 21000, maxCW: 21249, employeeShare: 270, employerShare: 315 },
  { minCW: 21500, maxCW: 21749, employeeShare: 278, employerShare: 323 },
  { minCW: 22000, maxCW: 22249, employeeShare: 285, employerShare: 330 },
  { minCW: 22500, maxCW: 22749, employeeShare: 293, employerShare: 338 },
  { minCW: 23000, maxCW: 23249, employeeShare: 300, employerShare: 345 },
  { minCW: 23500, maxCW: 23749, employeeShare: 308, employerShare: 353 },
  { minCW: 24000, maxCW: 24249, employeeShare: 315, employerShare: 360 },
  { minCW: 24500, maxCW: 24749, employeeShare: 323, employerShare: 368 },
  { minCW: 25000, maxCW: 25249, employeeShare: 330, employerShare: 375 },
  { minCW: 25500, maxCW: 25749, employeeShare: 338, employerShare: 383 },
  { minCW: 26000, maxCW: 26249, employeeShare: 345, employerShare: 390 },
  { minCW: 26500, maxCW: 26749, employeeShare: 353, employerShare: 398 },
  { minCW: 27000, maxCW: 27249, employeeShare: 360, employerShare: 405 },
  { minCW: 27500, maxCW: 27749, employeeShare: 368, employerShare: 413 },
  { minCW: 28000, maxCW: 28249, employeeShare: 375, employerShare: 420 },
  { minCW: 28500, maxCW: 28749, employeeShare: 383, employerShare: 428 },
  { minCW: 29000, maxCW: 29249, employeeShare: 390, employerShare: 435 },
  { minCW: 29500, maxCW: 29749, employeeShare: 398, employerShare: 443 },
  { minCW: 30000, maxCW: 30249, employeeShare: 405, employerShare: 450 },
  { minCW: 30500, maxCW: 30749, employeeShare: 413, employerShare: 458 },
  { minCW: 31000, maxCW: 31249, employeeShare: 420, employerShare: 465 },
  { minCW: 31500, maxCW: 31749, employeeShare: 428, employerShare: 473 },
  { minCW: 32000, maxCW: 32249, employeeShare: 435, employerShare: 480 },
  { minCW: 32500, maxCW: 32749, employeeShare: 443, employerShare: 488 },
  { minCW: 33000, maxCW: 33249, employeeShare: 450, employerShare: 495 },
  { minCW: 33500, maxCW: 33749, employeeShare: 458, employerShare: 503 },
  { minCW: 34000, maxCW: 34249, employeeShare: 465, employerShare: 510 },
  { minCW: 34500, maxCW: 34749, employeeShare: 473, employerShare: 518 },
  { minCW: 35000, maxCW: 35249, employeeShare: 480, employerShare: 525 },
  { minCW: 35500, maxCW: 35749, employeeShare: 488, employerShare: 533 },
  { minCW: 36000, maxCW: 36249, employeeShare: 495, employerShare: 540 },
  { minCW: 36500, maxCW: 36749, employeeShare: 503, employerShare: 548 },
  { minCW: 37000, maxCW: 37249, employeeShare: 510, employerShare: 555 },
  { minCW: 37500, maxCW: 37749, employeeShare: 518, employerShare: 563 },
  { minCW: 38000, maxCW: 38249, employeeShare: 525, employerShare: 570 },
  { minCW: 38500, maxCW: 38749, employeeShare: 533, employerShare: 578 },
  { minCW: 39000, maxCW: 39249, employeeShare: 540, employerShare: 585 },
  { minCW: 39500, maxCW: 39749, employeeShare: 548, employerShare: 593 },
  { minCW: 40000, maxCW: 50000, employeeShare: 555, employerShare: 600 },
  { minCW: 50001, maxCW: 1800000, employeeShare: 555, employerShare: 600 },
]

const PHILHEALTH_TABLE: PhilHealthBracket[] = [
  { minCW: 10000, maxCW: 10999, rate: 0.04, maxContribution: 440 },
  { minCW: 11000, maxCW: 11999, rate: 0.04, maxContribution: 480 },
  { minCW: 12000, maxCW: 12999, rate: 0.04, maxContribution: 520 },
  { minCW: 13000, maxCW: 13999, rate: 0.04, maxContribution: 560 },
  { minCW: 14000, maxCW: 14999, rate: 0.04, maxContribution: 600 },
  { minCW: 15000, maxCW: 15999, rate: 0.04, maxContribution: 640 },
  { minCW: 16000, maxCW: 16999, rate: 0.04, maxContribution: 680 },
  { minCW: 17000, maxCW: 17999, rate: 0.04, maxContribution: 720 },
  { minCW: 18000, maxCW: 18999, rate: 0.04, maxContribution: 760 },
  { minCW: 19000, maxCW: 19999, rate: 0.04, maxContribution: 800 },
  { minCW: 20000, maxCW: 20999, rate: 0.04, maxContribution: 840 },
  { minCW: 21000, maxCW: 21999, rate: 0.04, maxContribution: 880 },
  { minCW: 22000, maxCW: 22999, rate: 0.04, maxContribution: 920 },
  { minCW: 23000, maxCW: 23999, rate: 0.04, maxContribution: 960 },
  { minCW: 24000, maxCW: 24999, rate: 0.04, maxContribution: 1000 },
  { minCW: 25000, maxCW: 25999, rate: 0.04, maxContribution: 1040 },
  { minCW: 26000, maxCW: 26999, rate: 0.04, maxContribution: 1080 },
  { minCW: 27000, maxCW: 27999, rate: 0.04, maxContribution: 1120 },
  { minCW: 28000, maxCW: 28999, rate: 0.04, maxContribution: 1160 },
  { minCW: 29000, maxCW: 29999, rate: 0.04, maxContribution: 1200 },
  { minCW: 30000, maxCW: 30999, rate: 0.04, maxContribution: 1240 },
  { minCW: 31000, maxCW: 31999, rate: 0.04, maxContribution: 1280 },
  { minCW: 32000, maxCW: 32999, rate: 0.04, maxContribution: 1320 },
  { minCW: 33000, maxCW: 33999, rate: 0.04, maxContribution: 1360 },
  { minCW: 34000, maxCW: 34999, rate: 0.04, maxContribution: 1400 },
  { minCW: 35000, maxCW: 35999, rate: 0.04, maxContribution: 1440 },
  { minCW: 36000, maxCW: 36999, rate: 0.04, maxContribution: 1480 },
  { minCW: 37000, maxCW: 37999, rate: 0.04, maxContribution: 1520 },
  { minCW: 38000, maxCW: 38999, rate: 0.04, maxContribution: 1560 },
  { minCW: 39000, maxCW: 39999, rate: 0.04, maxContribution: 1600 },
  { minCW: 40000, maxCW: 1800000, rate: 0.04, maxContribution: 1600 },
]

const PAGIBIG_TABLE: PagIBIGBracket[] = [
  { minCW: 10000, maxCW: 18999, rate: 0.01 },
  { minCW: 19000, maxCW: 22999, rate: 0.02 },
  { minCW: 23000, maxCW: 1800000, rate: 0.02 },
]

const WHT_TABLE: WHTBracket[] = [
  { minMonthly: 0, maxMonthly: 25000, rate: 0, deduction: 0 },
  { minMonthly: 25001, maxMonthly: 50000, rate: 0.2, deduction: 0 },
  { minMonthly: 50001, maxMonthly: 67000, rate: 0.25, deduction: 3750 },
  { minMonthly: 67001, maxMonthly: 167000, rate: 0.3, deduction: 7125 },
  { minMonthly: 167001, maxMonthly: 417000, rate: 0.32, deduction: 14125 },
  { minMonthly: 417001, maxMonthly: 833000, rate: 0.35, deduction: 24625 },
  { minMonthly: 833001, maxMonthly: 8333333, rate: 0.375, deduction: 156125 },
]

function findSSS(contributionWage: number): { employee: number; employer: number } {
  const bracket = SSS_TABLE.find(b => contributionWage >= b.minCW && contributionWage <= b.maxCW)
  if (!bracket) {
    const closest = SSS_TABLE.reduce((best, b) =>
      Math.abs(contributionWage - b.minCW) < Math.abs(contributionWage - best.minCW) ? b : best
    )
    return { employee: closest.employeeShare, employer: closest.employerShare }
  }
  return { employee: bracket.employeeShare, employer: bracket.employerShare }
}

function findPhilHealth(contributionWage: number): number {
  const bracket = PHILHEALTH_TABLE.find(b => contributionWage >= b.minCW && contributionWage <= b.maxCW)
  if (!bracket) {
    const closest = PHILHEALTH_TABLE.reduce((best, b) =>
      Math.abs(contributionWage - b.minCW) < Math.abs(contributionWage - best.minCW) ? b : best
    )
    return Math.min(contributionWage * closest.rate, closest.maxContribution)
  }
  return Math.min(contributionWage * bracket.rate, bracket.maxContribution)
}

function findPagIBIG(contributionWage: number): number {
  const bracket = PAGIBIG_TABLE.find(b => contributionWage >= b.minCW && contributionWage <= b.maxCW)
  if (!bracket) {
    const closest = PAGIBIG_TABLE.reduce((best, b) =>
      Math.abs(contributionWage - b.minCW) < Math.abs(contributionWage - best.minCW) ? b : best
    )
    return contributionWage * closest.rate
  }
  return contributionWage * bracket.rate
}

function findWHT(monthlyGross: number): number {
  const bracket = WHT_TABLE.find(b => monthlyGross >= b.minMonthly && monthlyGross <= b.maxMonthly)
  if (!bracket) return 0
  const tax = monthlyGross * bracket.rate - bracket.deduction
  return Math.max(0, Math.round(tax))
}

export interface PayrollLineCalc {
  basicPay: number
  allowances: number
  grossPay: number
  sssEmployee: number
  sssEmployer: number
  philhealthEmployee: number
  philhealthEmployer: number
  pagibigEmployee: number
  pagibigEmployer: number
  withholdingTax: number
  totalDeductions: number
  netPay: number
  thirteenthMonthAccrual: number
}

export const payrollEngine = {
  calculateLine(basicPay: number, allowances: number, thirteenthMonthAccrual: number = 0): PayrollLineCalc {
    const grossPay = basicPay + allowances
    const sss = findSSS(basicPay)
    const philhealthTotal = findPhilHealth(basicPay)
    const pagibigAmt = findPagIBIG(basicPay)
    const wht = findWHT(grossPay)

    const totalDeductions = sss.employee + philhealthTotal + pagibigAmt + wht
    const netPay = grossPay - totalDeductions

    return {
      basicPay,
      allowances,
      grossPay,
      sssEmployee: sss.employee,
      sssEmployer: sss.employer,
      philhealthEmployee: philhealthTotal,
      philhealthEmployer: philhealthTotal,
      pagibigEmployee: pagibigAmt,
      pagibigEmployer: pagibigAmt,
      withholdingTax: wht,
      totalDeductions,
      netPay,
      thirteenthMonthAccrual,
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
      const calc = this.calculateLine(emp.basic_pay, emp.allowances || 0)
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

    // Debit: Employer contributions expense (employer shares above employee rates)
    const employerContribExpense = totals.sssEmployer - totals.sssEmployee +
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
      salaryExpense: "51100",
      contributionExpense: "52000",
      cash: "11120",
      sssPayable: "21600",
      philhealthPayable: "21600",
      pagibigPayable: "21600",
      whtPayable: "21500",
      thirteenthMonthPayable: "21700",
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
