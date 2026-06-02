import { prisma } from "@/lib/db"

export const accountRepository = {
  async findAll(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" ORDER BY account_code`
    )
  },

  async findById(entitySchema: string, id: string) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE id::text = $1`,
      id
    )
    return results[0] || null
  },

  async findByCode(entitySchema: string, code: string) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE account_code = $1`,
      code
    )
    return results[0] || null
  },

  async findChildren(entitySchema: string, parentId: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}"."account" WHERE parent_id = $1 ORDER BY account_code`,
      parentId
    )
  },

  async create(
    entitySchema: string,
    data: {
      accountCode: string
      accountName: string
      accountType: string
      normalBalance: string
      parentId?: string
      level: number
      description?: string
    }
  ) {
    const results = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}"."account" (account_code, account_name, account_type, normal_balance, parent_id, level, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      data.accountCode, data.accountName, data.accountType, data.normalBalance,
      data.parentId || null, data.level, data.description || null
    )
    return results[0]
  },

  async update(entitySchema: string, id: string, data: { accountName?: string; isActive?: boolean; description?: string }) {
    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (data.accountName !== undefined) { sets.push(`account_name = $${idx++}`); values.push(data.accountName) }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(data.isActive) }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); values.push(data.description) }

    if (sets.length === 0) {
      const results = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM "${entitySchema}"."account" WHERE id::text = $1`, id
      )
      return results[0]
    }

    values.push(id)
    const results = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}"."account" SET ${sets.join(", ")} WHERE id::text = $${idx} RETURNING *`,
      ...values
    )
    return results[0]
  },
}
