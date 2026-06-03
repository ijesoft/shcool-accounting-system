import { prisma } from "@/lib/db"

export interface STOFLine {
  studentId: string
  studentName: string
  gradeLevel: string
  semester: string
  tuitionFee: number
  miscFees: number
  labFees: number
  otherFees: number
  totalFees: number
  amountPaid: number
  balance: number
}

export interface STOFSummary {
  periodLabel: string
  totalStudents: number
  totalBilled: number
  totalCollected: number
  totalBalance: number
  lines: STOFLine[]
}

export const stofService = {
  async generate(entitySchema: string, from: string, to: string): Promise<STOFSummary> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `WITH line_totals AS (
        SELECT
          sil.invoice_id,
          COALESCE(SUM(CASE WHEN LOWER(sil.fee_type) IN ('tuition', 'tuition fee') THEN sil.amount ELSE 0 END), 0) as tuition_fee,
          COALESCE(SUM(CASE WHEN LOWER(sil.fee_type) IN ('misc', 'miscellaneous', 'misc fee') THEN sil.amount ELSE 0 END), 0) as misc_fees,
          COALESCE(SUM(CASE WHEN LOWER(sil.fee_type) IN ('lab', 'laboratory', 'lab fee') THEN sil.amount ELSE 0 END), 0) as lab_fees,
          COALESCE(SUM(CASE WHEN LOWER(sil.fee_type) NOT IN ('tuition', 'tuition fee', 'misc', 'miscellaneous', 'misc fee', 'lab', 'laboratory', 'lab fee') THEN sil.amount ELSE 0 END), 0) as other_fees,
          COALESCE(SUM(sil.amount), 0) as total_fees
        FROM "${entitySchema}".student_invoice_line sil
        GROUP BY sil.invoice_id
      )
      SELECT
        si.student_id,
        COALESCE(s.full_name, si.student_id::text) as student_name,
        COALESCE(s.grade_level, '') as grade_level,
        COALESCE(si.term, '') as semester,
        COALESCE(SUM(lt.tuition_fee), 0)::numeric as tuition_fee,
        COALESCE(SUM(lt.misc_fees), 0)::numeric as misc_fees,
        COALESCE(SUM(lt.lab_fees), 0)::numeric as lab_fees,
        COALESCE(SUM(lt.other_fees), 0)::numeric as other_fees,
        COALESCE(SUM(lt.total_fees), 0)::numeric as total_fees,
        COALESCE(SUM(si.total_amount - si.balance), 0)::numeric as amount_paid,
        COALESCE(SUM(si.balance), 0)::numeric as balance_due
      FROM "${entitySchema}".student_invoice si
      LEFT JOIN "${entitySchema}".student s ON s.id = si.student_id
      LEFT JOIN line_totals lt ON lt.invoice_id = si.id
      WHERE si.invoice_date >= $1::date AND si.invoice_date <= $2::date
      GROUP BY si.student_id, s.full_name, s.grade_level, si.term
      ORDER BY student_name, si.term`,
      from, to
    )

    const lines: STOFLine[] = rows.map((r: any) => ({
      studentId: String(r.student_id),
      studentName: String(r.student_name),
      gradeLevel: String(r.grade_level),
      semester: String(r.semester),
      tuitionFee: Number(r.tuition_fee),
      miscFees: Number(r.misc_fees),
      labFees: Number(r.lab_fees),
      otherFees: Number(r.other_fees),
      totalFees: Number(r.total_fees),
      amountPaid: Number(r.amount_paid),
      balance: Number(r.balance_due),
    }))

    const totalStudents = new Set(lines.map((l) => l.studentId)).size
    const totalBilled = lines.reduce((s, l) => s + l.totalFees, 0)
    const totalCollected = lines.reduce((s, l) => s + l.amountPaid, 0)
    const totalBalance = lines.reduce((s, l) => s + l.balance, 0)

    const fromDate = new Date(from)
    const toDate = new Date(to)
    const periodLabel = `${fromDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })} to ${toDate.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}`

    return {
      periodLabel,
      totalStudents,
      totalBilled,
      totalCollected,
      totalBalance,
      lines,
    }
  },
}
