import { prisma } from "@/lib/db"

// CHED CMO 03-2003: 70/20/10 Fund Allocation for tuition fee increases
export const FUND_ALLOCATION_RULES = {
  personnel: 0.70,        // 70% of tuition increase
  capitalOutlay: 0.20,    // 20% of tuition increase
  studentServices: 0.10,  // 10% of tuition increase
}

export interface FundAllocationReport {
  syLabel: string
  totalTuitionIncrease: number
  required: {
    personnel: number
    capitalOutlay: number
    studentServices: number
  }
  actual: {
    personnel: number
    capitalOutlay: number
    studentServices: number
  }
  variance: {
    personnel: number
    capitalOutlay: number
    studentServices: number
  }
  compliant: boolean
}

export const fundAllocationService = {
  async generate(
    entitySchema: string,
    entityId: string,
    from: string,
    to: string
  ): Promise<FundAllocationReport> {
    // Compute actual tuition income for the period
    const tuitionRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total_tuition
       FROM "${entitySchema}".general_ledger gl
       INNER JOIN "${entitySchema}".account a ON a.id = gl.account_id
       WHERE a.account_code LIKE '411%'
         AND gl.entry_date BETWEEN $1 AND $2`,
      from,
      to
    )
    const totalTuitionIncrease = Math.abs(Number(tuitionRows[0]?.total_tuition ?? 0))

    // Personnel: salary expenses (account codes starting with 51)
    const personnelRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(gl.debit_amount - gl.credit_amount), 0) AS total
       FROM "${entitySchema}".general_ledger gl
       INNER JOIN "${entitySchema}".account a ON a.id = gl.account_id
       WHERE a.account_code LIKE '51%'
         AND gl.entry_date BETWEEN $1 AND $2`,
      from,
      to
    )
    const actualPersonnel = Number(personnelRows[0]?.total ?? 0)

    // Capital outlay: PPE additions (account codes starting with 16)
    const capitalRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(gl.debit_amount - gl.credit_amount), 0) AS total
       FROM "${entitySchema}".general_ledger gl
       INNER JOIN "${entitySchema}".account a ON a.id = gl.account_id
       WHERE a.account_code LIKE '16%'
         AND gl.entry_date BETWEEN $1 AND $2`,
      from,
      to
    )
    const actualCapitalOutlay = Number(capitalRows[0]?.total ?? 0)

    // Student services: account codes starting with 53 (student services expense)
    const studentRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(gl.debit_amount - gl.credit_amount), 0) AS total
       FROM "${entitySchema}".general_ledger gl
       INNER JOIN "${entitySchema}".account a ON a.id = gl.account_id
       WHERE a.account_code LIKE '53%'
         AND gl.entry_date BETWEEN $1 AND $2`,
      from,
      to
    )
    const actualStudentServices = Number(studentRows[0]?.total ?? 0)

    const required = {
      personnel: totalTuitionIncrease * FUND_ALLOCATION_RULES.personnel,
      capitalOutlay: totalTuitionIncrease * FUND_ALLOCATION_RULES.capitalOutlay,
      studentServices: totalTuitionIncrease * FUND_ALLOCATION_RULES.studentServices,
    }

    const actual = {
      personnel: actualPersonnel,
      capitalOutlay: actualCapitalOutlay,
      studentServices: actualStudentServices,
    }

    const variance = {
      personnel: actual.personnel - required.personnel,
      capitalOutlay: actual.capitalOutlay - required.capitalOutlay,
      studentServices: actual.studentServices - required.studentServices,
    }

    // Compliant if all actuals meet or exceed required allocations
    const compliant =
      actual.personnel >= required.personnel &&
      actual.capitalOutlay >= required.capitalOutlay &&
      actual.studentServices >= required.studentServices

    const syLabel = `${from.slice(0, 4)}-${to.slice(0, 4)}`

    return {
      syLabel,
      totalTuitionIncrease,
      required,
      actual,
      variance,
      compliant,
    }
  },
}
