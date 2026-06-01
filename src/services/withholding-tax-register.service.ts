import { prisma } from "@/lib/db"

export const withholdingTaxRegisterService = {
  async list(entitySchema: string, filters?: {
    ewtType?: "expanded" | "creditable" | "final"
    startDate?: string
    endDate?: string
    payeeTin?: string
  }) {
    const whereClauses: string[] = []
    const params: any[] = []
    let i = 1

    if (filters?.ewtType) {
      whereClauses.push(`ewt_type = $${i}`)
      params.push(filters.ewtType)
      i++
    }
    if (filters?.startDate) {
      whereClauses.push(`withholding_date >= $${i}::date`)
      params.push(filters.startDate)
      i++
    }
    if (filters?.endDate) {
      whereClauses.push(`withholding_date <= $${i}::date`)
      params.push(filters.endDate)
      i++
    }
    if (filters?.payeeTin) {
      whereClauses.push(`payee_tin = $${i}`)
      params.push(filters.payeeTin)
      i++
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT wtr.*, d.cv_number
       FROM "${entitySchema}".withholding_tax_register wtr
       LEFT JOIN "${entitySchema}".disbursement d ON d.id = wtr.disbursement_id
       ${whereSql}
       ORDER BY wtr.withholding_date DESC`,
      ...params
    )
    return rows
  },

  async getMonthlySummary(entitySchema: string, year: number, month: number) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        ewt_type,
        bir_form_code,
        COUNT(*) as transaction_count,
        SUM(base_amount) as total_base_amount,
        SUM(tax_withheld) as total_tax_withheld,
        AVG(tax_rate) as avg_tax_rate
       FROM "${entitySchema}".withholding_tax_register
       WHERE EXTRACT(YEAR FROM withholding_date) = $1
         AND EXTRACT(MONTH FROM withholding_date) = $2
       GROUP BY ewt_type, bir_form_code
       ORDER BY ewt_type, bir_form_code`,
      year, month
    )
    return rows
  },

  async getQuarterlySummary(entitySchema: string, year: number, quarter: number) {
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = quarter * 3

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        ewt_type,
        bir_form_code,
        COUNT(*) as transaction_count,
        SUM(base_amount) as total_base_amount,
        SUM(tax_withheld) as total_tax_withheld,
        AVG(tax_rate) as avg_tax_rate
       FROM "${entitySchema}".withholding_tax_register
       WHERE EXTRACT(YEAR FROM withholding_date) = $1
         AND EXTRACT(MONTH FROM withholding_date) BETWEEN $2 AND $3
       GROUP BY ewt_type, bir_form_code
       ORDER BY ewt_type, bir_form_code`,
      year, startMonth, endMonth
    )
    return rows
  },

  async exportByPeriod(entitySchema: string, startDate: string, endDate: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        wtr.ewt_type,
        wtr.bir_form_code,
        wtr.payee_name,
        wtr.payee_tin,
        wtr.payee_address,
        wtr.base_amount,
        wtr.tax_rate,
        wtr.tax_withheld,
        wtr.withholding_date,
        d.cv_number
       FROM "${entitySchema}".withholding_tax_register wtr
       LEFT JOIN "${entitySchema}".disbursement d ON d.id = wtr.disbursement_id
       WHERE wtr.withholding_date BETWEEN $1::date AND $2::date
       ORDER BY wtr.withholding_date, wtr.ewt_type`,
      startDate, endDate
    )
    return rows
  },
}
