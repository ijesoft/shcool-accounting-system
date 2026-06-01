import { prisma } from "@/lib/db"

export interface ActivityCategory {
  category: string
  accountCodes: string[]
  type: "receipt" | "disbursement"
}

export interface ActivityLine {
  category: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  net: number
}

const RECEIPT_CATEGORIES: ActivityCategory[] = [
  { category: "Tuition and Fees", accountCodes: ["41100", "41200", "41300", "41400"], type: "receipt" },
  { category: "Donations and Grants", accountCodes: ["41600", "41700"], type: "receipt" },
  { category: "Rental Income", accountCodes: ["41800"], type: "receipt" },
  { category: "Other Income", accountCodes: ["41500"], type: "receipt" },
]

const DISBURSEMENT_CATEGORIES: ActivityCategory[] = [
  { category: "Personnel Services", accountCodes: ["51100", "52000", "52100"], type: "disbursement" },
  { category: "Utilities", accountCodes: ["51200"], type: "disbursement" },
  { category: "Rent", accountCodes: ["51300"], type: "disbursement" },
  { category: "Depreciation", accountCodes: ["51400"], type: "disbursement" },
  { category: "Supplies", accountCodes: ["51500"], type: "disbursement" },
  { category: "Professional Fees", accountCodes: ["51600"], type: "disbursement" },
  { category: "Taxes and Licenses", accountCodes: ["51700"], type: "disbursement" },
  { category: "Miscellaneous", accountCodes: ["51800", "51900"], type: "disbursement" },
  { category: "Insurance", accountCodes: ["52200"], type: "disbursement" },
  { category: "Repairs and Maintenance", accountCodes: ["52300"], type: "disbursement" },
  { category: "Interest", accountCodes: ["52400"], type: "disbursement" },
  { category: "Training and Development", accountCodes: ["52500"], type: "disbursement" },
]

export const activitySchedule = {
  async generate(entitySchema: string, from: string, to: string) {
    const receiptData = await this.generateReceipts(entitySchema, from, to)
    const disbursementData = await this.generateDisbursements(entitySchema, from, to)

    const totalReceipts = receiptData.reduce((sum, r) => sum + r.net, 0)
    const totalDisbursements = disbursementData.reduce((sum, r) => sum + r.net, 0)

    return {
      period: { from, to },
      receipts: receiptData,
      disbursements: disbursementData,
      totalReceipts: Number(totalReceipts.toFixed(2)),
      totalDisbursements: Number(totalDisbursements.toFixed(2)),
    }
  },

  async generateReceipts(entitySchema: string, from: string, to: string) {
    const result: ActivityLine[] = []

    for (const cat of RECEIPT_CATEGORIES) {
      for (const code of cat.accountCodes) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT
            SUM(COALESCE(jel.debit, 0)) as total_debit,
            SUM(COALESCE(jel.credit, 0)) as total_credit
           FROM "${entitySchema}".journal_entry_line jel
           JOIN "${entitySchema}".account a ON a.id = jel.account_id
           JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
           WHERE a.account_code = $1
             AND je.status = 'posted'
             AND je.entry_date BETWEEN $2::date AND $3::date
             AND a.account_type IN ('revenue', 'contra_asset')`,
          code, from, to
        )

        const row = rows[0]
        const debit = Number(row.total_debit || 0)
        const credit = Number(row.total_credit || 0)
        const net = debit - credit

        if (net !== 0) {
          const accountRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT account_name FROM "${entitySchema}".account WHERE account_code = $1`,
            code
          )
          result.push({
            category: cat.category,
            accountCode: code,
            accountName: accountRows[0]?.account_name || code,
            debit: Number(debit.toFixed(2)),
            credit: Number(credit.toFixed(2)),
            net: Number(net.toFixed(2)),
          })
        }
      }
    }

    return result
  },

  async generateDisbursements(entitySchema: string, from: string, to: string) {
    const result: ActivityLine[] = []

    for (const cat of DISBURSEMENT_CATEGORIES) {
      for (const code of cat.accountCodes) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT
            SUM(COALESCE(jel.debit, 0)) as total_debit,
            SUM(COALESCE(jel.credit, 0)) as total_credit
           FROM "${entitySchema}".journal_entry_line jel
           JOIN "${entitySchema}".account a ON a.id = jel.account_id
           JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
           WHERE a.account_code = $1
             AND je.status = 'posted'
             AND je.entry_date BETWEEN $2::date AND $3::date
             AND a.account_type IN ('expense', 'asset', 'contra_revenue')`,
          code, from, to
        )

        const row = rows[0]
        const debit = Number(row.total_debit || 0)
        const credit = Number(row.total_credit || 0)
        const net = debit - credit

        if (net !== 0) {
          const accountRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT account_name FROM "${entitySchema}".account WHERE account_code = $1`,
            code
          )
          result.push({
            category: cat.category,
            accountCode: code,
            accountName: accountRows[0]?.account_name || code,
            debit: Number(debit.toFixed(2)),
            credit: Number(credit.toFixed(2)),
            net: Number(net.toFixed(2)),
          })
        }
      }
    }

    return result
  },

  groupByCategory(lines: ActivityLine[]) {
    const grouped = new Map<string, ActivityLine[]>()
    for (const line of lines) {
      if (!grouped.has(line.category)) {
        grouped.set(line.category, [])
      }
      grouped.get(line.category)!.push(line)
    }
    return Array.from(grouped.entries()).map(([category, lines]) => ({
      category,
      lines,
      total: Number(lines.reduce((sum, l) => sum + l.net, 0).toFixed(2)),
    }))
  },
}
