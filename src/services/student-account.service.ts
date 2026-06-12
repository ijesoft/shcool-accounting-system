import { prisma } from "@/lib/db"
import { billingEngine } from "@/lib/accounting/billing-engine"

export const studentAccountService = {
  async list(entitySchema: string, opts?: { q?: string; page?: number; limit?: number }) {
    const q = opts?.q ?? ""
    const limit = opts?.limit ?? 20
    const page = opts?.page ?? 1
    const offset = (page - 1) * limit

    const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
      `SELECT COUNT(*)::int as total
       FROM "${entitySchema}".student s
       WHERE ($1 = '' OR s.full_name ILIKE $2 OR s.student_number ILIKE $2 OR COALESCE(s.course,'') ILIKE $2 OR COALESCE(s.grade_level,'') ILIKE $2)`,
      q, `%${q}%`
    )
    const total = countRows[0]?.total ?? 0

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.*,
        COALESCE((SELECT SUM(balance) FROM "${entitySchema}".student_invoice WHERE student_id = s.id AND status IN ('unpaid','partial')), 0) as total_balance
       FROM "${entitySchema}".student s
       WHERE ($1 = '' OR s.full_name ILIKE $2 OR s.student_number ILIKE $2 OR COALESCE(s.course,'') ILIKE $2 OR COALESCE(s.grade_level,'') ILIKE $2)
       ORDER BY s.full_name
       LIMIT $3 OFFSET $4`,
      q, `%${q}%`, limit, offset
    )

    return { rows, total }
  },

  async getById(entitySchema: string, id: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".student WHERE id = $1::uuid`, id
    )
    return rows[0] || null
  },

  async create(entitySchema: string, data: { studentNumber: string; fullName: string; course?: string; gradeLevel?: string; status: string }) {
    return prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".student (student_number, full_name, course, grade_level, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      data.studentNumber, data.fullName, data.course || null, data.gradeLevel || null, data.status
    ).then(r => r[0])
  },

  async update(entitySchema: string, id: string, data: { fullName?: string; course?: string; gradeLevel?: string; status?: string }) {
    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (data.fullName !== undefined) { sets.push(`full_name = $${i}`); vals.push(data.fullName); i++ }
    if (data.course !== undefined) { sets.push(`course = $${i}`); vals.push(data.course); i++ }
    if (data.gradeLevel !== undefined) { sets.push(`grade_level = $${i}`); vals.push(data.gradeLevel); i++ }
    if (data.status !== undefined) { sets.push(`status = $${i}`); vals.push(data.status); i++ }
    vals.push(id)
    return prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".student SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      ...vals
    ).then(r => r[0])
  },

  async getInvoices(entitySchema: string, studentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT si.*,
        (SELECT COALESCE(JSON_AGG(json_build_object('fee_type', sil.fee_type, 'amount', sil.amount, 'discount_type', sil.discount_type, 'discount_amount', sil.discount_amount)), '[]'::json)
         FROM "${entitySchema}".student_invoice_line sil WHERE sil.invoice_id = si.id) as lines
       FROM "${entitySchema}".student_invoice si
       WHERE si.student_id = $1::uuid
       ORDER BY si.invoice_date DESC`,
      studentId
    )
  },

  async createInvoice(
    entitySchema: string,
    userId: string,
    data: {
      studentId: string
      invoiceDate: string
      dueDate: string
      totalAmount: number
      term?: string
      termStartDate?: string
      termEndDate?: string
      entityId?: string
      lines: { feeType: string; amount: number; discountType?: string; discountAmount?: number }[]
    }
  ) {
    const student = await this.getById(entitySchema, data.studentId)
    if (!student) throw new Error("Student not found")

    const invRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".student_invoice
       (invoice_number, student_id, term, term_start_date, term_end_date, invoice_date, due_date, total_amount, balance)
       VALUES (
         (SELECT CONCAT('INV-', LPAD((COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INT)), 0) + 1)::text, 6, '0')) FROM "${entitySchema}".student_invoice),
         $1::uuid, $2, $3::date, $4::date, $5::date, $6::date, $7, $7
       ) RETURNING *`,
      data.studentId,
      data.term || null,
      data.termStartDate || null,
      data.termEndDate || null,
      data.invoiceDate,
      data.dueDate,
      data.totalAmount
    )
    const invoice = invRows[0]
    for (const line of data.lines) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".student_invoice_line (invoice_id, fee_type, amount, discount_type, discount_amount) VALUES ($1::uuid, $2, $3, $4, $5)`,
        invoice.id, line.feeType, line.amount, line.discountType || null, line.discountAmount || 0
      )
    }

    await billingEngine.postStudentInvoice(entitySchema, userId, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: data.invoiceDate,
      studentName: student.full_name,
      entityId: data.entityId,
      lines: data.lines.map((line) => ({
        feeType: line.feeType,
        amount: line.amount,
        discountAmount: line.discountAmount,
      })),
    })

    return this.getInvoices(entitySchema, data.studentId).then((rows) =>
      rows.find((row: any) => row.id === invoice.id) ?? invoice
    )
  },

  async cancelInvoice(entitySchema: string, userId: string, invoiceId: string) {
    return billingEngine.reverseStudentInvoice(entitySchema, userId, invoiceId)
  },

  async getPayments(entitySchema: string, studentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pt.*, si.invoice_number
       FROM "${entitySchema}".payment_transaction pt
       LEFT JOIN "${entitySchema}".student_invoice si ON si.id = pt.invoice_id
       WHERE pt.student_id = $1::uuid
       ORDER BY pt.payment_date DESC`,
      studentId
    )
  },


  async getByStudentNumber(entitySchema: string, studentNumber: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".student WHERE student_number = $1 LIMIT 1`,
      studentNumber
    )
    return rows[0] || null
  },

  async upsertByStudentNumber(
    entitySchema: string,
    data: { studentNumber: string; fullName: string; course?: string; gradeLevel?: string; status?: string }
  ) {
    const existing = await this.getByStudentNumber(entitySchema, data.studentNumber)
    if (existing) {
      return this.update(entitySchema, existing.id, {
        fullName: data.fullName,
        course: data.course,
        gradeLevel: data.gradeLevel,
        status: data.status || existing.status || "enrolled",
      })
    }
    return this.create(entitySchema, {
      studentNumber: data.studentNumber,
      fullName: data.fullName,
      course: data.course,
      gradeLevel: data.gradeLevel,
      status: data.status || "enrolled",
    })
  },

  async getInvoiceByReference(entitySchema: string, reference: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, invoice_number, student_id, term, invoice_date, due_date, total_amount, balance, status
       FROM "${entitySchema}".student_invoice WHERE term = $1 LIMIT 1`,
      reference
    )
    return rows[0] || null
  },

  async getAgingByStudentNumber(entitySchema: string, studentNumber: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s.student_number, s.full_name,
              COALESCE(SUM(CASE WHEN si.due_date >= CURRENT_DATE THEN si.balance ELSE 0 END), 0) as current,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1 THEN si.balance ELSE 0 END), 0) as days_1_30,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 31 THEN si.balance ELSE 0 END), 0) as days_31_60,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 61 THEN si.balance ELSE 0 END), 0) as days_61_90,
              COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 90 THEN si.balance ELSE 0 END), 0) as days_91_plus,
              COALESCE(SUM(si.balance), 0) as total_balance
       FROM "${entitySchema}".student s
       LEFT JOIN "${entitySchema}".student_invoice si ON si.student_id = s.id AND si.status IN ('unpaid', 'partial')
       WHERE s.student_number = $1
       GROUP BY s.id, s.student_number, s.full_name`,
      studentNumber
    )
    return rows[0] || null
  },
  async getAging(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT s.id, s.student_number, s.full_name,
              COALESCE(SUM(CASE WHEN si.due_date >= CURRENT_DATE THEN si.balance ELSE 0 END), 0) as current,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE - 1 THEN si.balance ELSE 0 END), 0) as days_1_30,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 60 AND CURRENT_DATE - 31 THEN si.balance ELSE 0 END), 0) as days_31_60,
              COALESCE(SUM(CASE WHEN si.due_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 61 THEN si.balance ELSE 0 END), 0) as days_61_90,
              COALESCE(SUM(CASE WHEN si.due_date < CURRENT_DATE - 90 THEN si.balance ELSE 0 END), 0) as days_91_plus,
              COALESCE(SUM(si.balance), 0) as total_balance
       FROM "${entitySchema}".student s
       JOIN "${entitySchema}".student_invoice si ON si.student_id = s.id AND si.status IN ('unpaid', 'partial')
       GROUP BY s.id, s.student_number, s.full_name
       ORDER BY total_balance DESC`
    )
  },

  async getGlActivity(entitySchema: string, studentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT je.id as entry_id, jel.id as line_id, jel.debit, jel.credit, jel.line_description,
              a.account_code, a.account_name,
              je.entry_number, je.entry_date, je.status
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".journal_entry je ON je.id = jel.journal_entry_id
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE jel.party_type = 'student' AND jel.party_id = $1::uuid
       ORDER BY je.entry_date DESC, je.created_at DESC`,
      studentId
    )
  },

  async getOrGenerateInvoiceNumber(entitySchema: string): Promise<string> {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INT)), 0) + 1 as next FROM "${entitySchema}".student_invoice`
    )
    return `INV-${String(rows[0].next).padStart(6, "0")}`
  },
}
