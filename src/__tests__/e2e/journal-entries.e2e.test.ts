import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId, createTestFiscalYear, createTestFiscalPeriod } from "./helpers"

describe("E2E - Journal Entries CRUD", () => {
  let entityId: string
  let schemaName: string
  let fiscalYearId: string
  let fiscalPeriodId: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!

    const fiscalYear = await createTestFiscalYear(entityId)
    fiscalYearId = fiscalYear.id

    const fiscalPeriod = await createTestFiscalPeriod(fiscalYearId, 1)
    fiscalPeriodId = fiscalPeriod.id
  })

  afterAll(async () => {
    await prisma.fiscalPeriod.deleteMany({ where: { fiscalYearId } })
    await prisma.fiscalYear.deleteMany({ where: { id: fiscalYearId } })
    await cleanupTestUsers()
  })

  describe("Fiscal Calendar", () => {
    it("should create fiscal year", async () => {
      const fy = await prisma.fiscalYear.create({
        data: {
          entityId,
          label: "FY2027",
          startDate: new Date("2027-01-01"),
          endDate: new Date("2027-12-31"),
        },
      })

      expect(fy.id).toBeDefined()
      expect(fy.label).toBe("FY2027")
      expect(fy.isClosed).toBe(false)

      await prisma.fiscalYear.delete({ where: { id: fy.id } })
    })

    it("should create fiscal period", async () => {
      const period = await prisma.fiscalPeriod.create({
        data: {
          fiscalYearId,
          periodNumber: 2,
          startDate: new Date("2026-02-01"),
          endDate: new Date("2026-02-28"),
        },
      })

      expect(period.id).toBeDefined()
      expect(period.periodNumber).toBe(2)
      expect(period.isClosed).toBe(false)

      await prisma.fiscalPeriod.delete({ where: { id: period.id } })
    })

    it("should close and reopen fiscal period", async () => {
      const period = await prisma.fiscalPeriod.create({
        data: {
          fiscalYearId,
          periodNumber: 3,
          startDate: new Date("2026-03-01"),
          endDate: new Date("2026-03-31"),
        },
      })

      const closed = await prisma.fiscalPeriod.update({
        where: { id: period.id },
        data: { isClosed: true },
      })
      expect(closed.isClosed).toBe(true)

      const reopened = await prisma.fiscalPeriod.update({
        where: { id: period.id },
        data: { isClosed: false },
      })
      expect(reopened.isClosed).toBe(false)

      await prisma.fiscalPeriod.delete({ where: { id: period.id } })
    })

    it("should prevent duplicate fiscal year label per entity", async () => {
      await expect(
        prisma.fiscalYear.create({
          data: {
            entityId,
            label: "FY2026",
            startDate: new Date("2026-01-01"),
            endDate: new Date("2026-12-31"),
          },
        })
      ).rejects.toThrow()
    })
  })

  describe("Journal Entry Operations", () => {
    it("should create a journal entry", async () => {
      const jeNumber = `JE-${Date.now()}`

      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".journal_entry (entry_number, source_module, description, entry_date, fiscal_period_id, status, created_by)
         VALUES ('${jeNumber}', 'JE', 'Test JE', CURRENT_DATE, '${fiscalPeriodId}', 'draft', '00000000-0000-0000-0000-000000000001')
         RETURNING id, entry_number, status`
      )

      expect(result.length).toBe(1)
      expect(result[0].entry_number).toBe(jeNumber)
      expect(result[0].status).toBe("draft")

      const jeId = result[0].id

      const lines = await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".journal_entry_line (journal_entry_id, account_id, debit, credit, line_order)
         SELECT '${jeId}', id, 1000.00, 0.00, 1 FROM "${schemaName}".account WHERE account_type = 'asset' LIMIT 1
         RETURNING id`
      )
      expect(lines.length).toBe(1)

      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schemaName}".journal_entry_line WHERE journal_entry_id = '${jeId}'`
      )
      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schemaName}".journal_entry WHERE id = '${jeId}'`
      )
    })

    it("should update journal entry status", async () => {
      const jeNumber = `JE-${Date.now()}`

      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".journal_entry (entry_number, source_module, description, entry_date, fiscal_period_id, status, created_by)
         VALUES ('${jeNumber}', 'JE', 'Test JE', CURRENT_DATE, '${fiscalPeriodId}', 'draft', '00000000-0000-0000-0000-000000000001')
         RETURNING id`
      )

      const jeId = result[0].id

      const updated = await prisma.$queryRawUnsafe(
        `UPDATE "${schemaName}".journal_entry SET status = 'approved' WHERE id = '${jeId}'
         RETURNING status`
      )
      expect(updated[0].status).toBe("approved")

      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schemaName}".journal_entry WHERE id = '${jeId}'`
      )
    })

    it("should enforce unique journal entry number", async () => {
      const jeNumber = `JE-UNIQUE-${Date.now()}`

      await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".journal_entry (entry_number, source_module, description, entry_date, fiscal_period_id, status, created_by)
         VALUES ('${jeNumber}', 'JE', 'Test JE', CURRENT_DATE, '${fiscalPeriodId}', 'draft', '00000000-0000-0000-0000-000000000001')`
      )

      await expect(
        prisma.$queryRawUnsafe(
          `INSERT INTO "${schemaName}".journal_entry (entry_number, source_module, description, entry_date, fiscal_period_id, status, created_by)
           VALUES ('${jeNumber}', 'JE', 'Duplicate JE', CURRENT_DATE, '${fiscalPeriodId}', 'draft', '00000000-0000-0000-0000-000000000001')`
        )
      ).rejects.toThrow()
    })
  })
})
