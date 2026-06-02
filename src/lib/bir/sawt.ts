import { prisma } from "@/lib/db"

export interface SAWTLine {
  payeeTin: string
  payeeName: string
  atcCode: string
  grossAmount: number
  taxWithheld: number
  month: number
}

export const sawtService = {
  async generate(
    entitySchema: string,
    entityId: string,
    from: string,
    to: string
  ): Promise<SAWTLine[]> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
         v.tin                                         AS payee_tin,
         v.name                                        AS payee_name,
         COALESCE(cd.atc_code, 'WC158')               AS atc_code,
         COALESCE(SUM(cd.tax_base), 0)                AS gross_amount,
         COALESCE(SUM(cd.ewt_amount), 0)              AS tax_withheld,
         EXTRACT(MONTH FROM cd.disbursement_date)::int AS month
       FROM "${entitySchema}".vendor v
       INNER JOIN "${entitySchema}".cash_disbursement cd
         ON cd.vendor_id = v.id
         AND cd.disbursement_date BETWEEN $1 AND $2
         AND cd.status = 'posted'
       GROUP BY v.tin, v.name, cd.atc_code, EXTRACT(MONTH FROM cd.disbursement_date)
       ORDER BY month, v.name`,
      from,
      to
    )

    return rows.map(row => ({
      payeeTin: row.payee_tin ?? "",
      payeeName: row.payee_name ?? "",
      atcCode: row.atc_code ?? "WC158",
      grossAmount: Number(row.gross_amount),
      taxWithheld: Number(row.tax_withheld),
      month: Number(row.month),
    }))
  },

  toCsv(lines: SAWTLine[]): string {
    const headers = ["Payee TIN", "Payee Name", "ATC Code", "Gross Amount", "Tax Withheld", "Month"]
    const rows = lines.map(l => [
      l.payeeTin,
      `"${l.payeeName.replace(/"/g, '""')}"`,
      l.atcCode,
      l.grossAmount.toFixed(2),
      l.taxWithheld.toFixed(2),
      l.month.toString(),
    ].join(","))
    return [headers.join(","), ...rows].join("\r\n")
  },
}
