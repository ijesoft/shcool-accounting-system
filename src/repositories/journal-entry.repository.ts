import { prisma } from "@/lib/db"

export const journalEntryRepository = {
  async findAll(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT je.*, 
        (SELECT COUNT(*) FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = je.id) as line_count,
        (SELECT COALESCE(SUM(debit), 0) FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = je.id) as total_debit,
        (SELECT COALESCE(SUM(credit), 0) FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = je.id) as total_credit
       FROM "${entitySchema}".journal_entry je 
       ORDER BY je.created_at DESC`
    )
  },

  async findById(entitySchema: string, id: string) {
    const entries = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".journal_entry WHERE id = $1::uuid`,
      id
    )
    if (!entries[0]) return null

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `SELECT jel.*, a.account_code, a.account_name 
       FROM "${entitySchema}".journal_entry_line jel
       JOIN "${entitySchema}".account a ON a.id = jel.account_id
       WHERE jel.journal_entry_id = $1::uuid
       ORDER BY jel.line_order`,
      id
    )

    return { ...entries[0], lines }
  },

  async create(
    entitySchema: string,
    data: {
      entryDate: string
      reference?: string
      sourceModule: string
      description?: string
      createdBy: string
      lines: { accountId: string; debit: number; credit: number; lineDescription?: string; lineOrder: number }[]
    }
  ) {
    const result = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".journal_entry 
       (entry_number, entry_date, reference, source_module, description, status, created_by)
       VALUES (
         (SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 5, '0'))
          FROM "${entitySchema}".number_series WHERE series_type = 'JE' LIMIT 1),
         $1, $2, $3, $4, 'draft', $5
       ) RETURNING *`,
      new Date(data.entryDate), data.reference || null, data.sourceModule, data.description || null, data.createdBy
    )
    const entry = result[0]

    for (const line of data.lines) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".journal_entry_line
         (journal_entry_id, account_id, debit, credit, line_description, line_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        entry.id, line.accountId, line.debit, line.credit, line.lineDescription || null, line.lineOrder
      )
    }

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'JE'`
    )

    return this.findById(entitySchema, entry.id)
  },

  async update(
    entitySchema: string,
    id: string,
    data: {
      entryDate?: string
      reference?: string
      description?: string
      lines?: { accountId: string; debit: number; credit: number; lineDescription?: string; lineOrder: number }[]
    }
  ) {
    if (data.entryDate || data.reference || data.description) {
      const sets: string[] = []
      const values: any[] = []
      let idx = 1

      if (data.entryDate) { sets.push(`entry_date = $${idx++}`); values.push(new Date(data.entryDate)) }
      if (data.reference !== undefined) { sets.push(`reference = $${idx++}`); values.push(data.reference) }
      if (data.description !== undefined) { sets.push(`description = $${idx++}`); values.push(data.description) }

      if (sets.length > 0) {
        values.push(id)
        await prisma.$queryRawUnsafe(
          `UPDATE "${entitySchema}".journal_entry SET ${sets.join(", ")} WHERE id = $${idx}`,
          ...values
        )
      }
    }

    if (data.lines) {
      await prisma.$queryRawUnsafe(
        `DELETE FROM "${entitySchema}".journal_entry_line WHERE journal_entry_id = $1::uuid`,
        id
      )
      for (const line of data.lines) {
        await prisma.$queryRawUnsafe(
          `INSERT INTO "${entitySchema}".journal_entry_line
           (journal_entry_id, account_id, debit, credit, line_description, line_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          id, line.accountId, line.debit, line.credit, line.lineDescription || null, line.lineOrder
        )
      }
    }

    return this.findById(entitySchema, id)
  },
}
