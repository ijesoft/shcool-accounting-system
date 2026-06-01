import { prisma } from "@/lib/db"

export const entityRepository = {
  async findAll() {
    return prisma.entity.findMany({ orderBy: { name: "asc" } })
  },

  async findById(id: string) {
    return prisma.entity.findUnique({ where: { id } })
  },

  async findByCode(code: string) {
    return prisma.entity.findUnique({ where: { code } })
  },

  async create(data: {
    code: string
    name: string
    tin?: string
    address?: string
    fiscalYearStart: Date
    schemaName: string
  }) {
    return prisma.entity.create({ data })
  },

  async update(id: string, data: { name?: string; tin?: string; address?: string; status?: string }) {
    return prisma.entity.update({ where: { id }, data })
  },

  async delete(id: string) {
    return prisma.entity.update({ where: { id }, data: { status: "inactive" } })
  },
}
