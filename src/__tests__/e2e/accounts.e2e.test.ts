import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId } from "./helpers"

let mockEntityId: string | null = null

vi.mock("@/lib/auth/session", () => {
  const getEntityId = () => mockEntityId
  return {
    getSession: async () => ({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "test@school.edu",
      fullName: "Test User",
      roleId: "00000000-0000-0000-0000-000000000002",
      roleName: "super_admin",
      entityId: getEntityId() ?? undefined,
      isActive: true,
      save: async () => {},
      destroy: () => {},
    }),
    destroySession: async () => {},
  }
})

describe("E2E - Accounts CRUD", () => {
  beforeAll(async () => {
    await setupTestUsers()
    const entityId = await getMainEntityId()
    mockEntityId = entityId
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("GET /api/v1/accounts", () => {
    it("should list accounts for authenticated super_admin", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const accounts = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".account LIMIT 5`
      )
      expect(Array.isArray(accounts)).toBe(true)
      expect(accounts.length).toBeGreaterThan(0)
    })

    it("should have default chart of accounts seeded", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const accounts = await prisma.$queryRawUnsafe(
        `SELECT account_type FROM "${schemaName}".account`
      )
      const types = (accounts as { account_type: string }[]).map(a => a.account_type)

      expect(types).toContain("asset")
      expect(types).toContain("liability")
      expect(types).toContain("equity")
      expect(types).toContain("revenue")
      expect(types).toContain("expense")
    })
  })

  describe("POST /api/v1/accounts", () => {
    it("should create a new account", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const accountCode = `9999${Math.floor(Math.random() * 100)}`
      const result = await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, parent_id, is_active)
         VALUES ('${accountCode}', 'Test Account', 'expense', 'debit', NULL, true)
         RETURNING id, account_code, account_name, account_type`
      )

      expect(result.length).toBe(1)
      expect(result[0].account_code).toBe(accountCode)
      expect(result[0].account_type).toBe("expense")

      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schemaName}".account WHERE account_code = '${accountCode}'`
      )
    })

    it("should reject duplicate account code", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const existing = await prisma.$queryRawUnsafe(
        `SELECT account_code FROM "${schemaName}".account LIMIT 1`
      )
      const code = (existing[0] as { account_code: string }).account_code

      await expect(
        prisma.$queryRawUnsafe(
          `INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, parent_id, is_active)
           VALUES ('${code}', 'Duplicate Account', 'expense', 'debit', NULL, true)
           RETURNING id`
        )
      ).rejects.toThrow()
    })
  })

  describe("PATCH /api/v1/accounts/[id]", () => {
    it("should update an existing account", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const accountCode = `9998${Math.floor(Math.random() * 100)}`
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, parent_id, is_active)
         VALUES ('${accountCode}', 'Updateable Account', 'expense', 'debit', NULL, true)`
      )

      const updated = await prisma.$queryRawUnsafe(
        `UPDATE "${schemaName}".account SET account_name = 'Updated Name'
         WHERE account_code = '${accountCode}'
         RETURNING account_name`
      )

      expect(updated[0].account_name).toBe("Updated Name")

      await prisma.$executeRawUnsafe(
        `DELETE FROM "${schemaName}".account WHERE account_code = '${accountCode}'`
      )
    })
  })

  describe("DELETE /api/v1/accounts/[id]", () => {
    it("should deactivate an account (soft delete)", async () => {
      const entityId = await getMainEntityId()
      const entity = await prisma.entity.findUnique({ where: { id: entityId } })
      const schemaName = entity?.schemaName

      if (!schemaName) throw new Error("Schema name not found")

      const accountCode = `9997${Math.floor(Math.random() * 100)}`
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${schemaName}".account (account_code, account_name, account_type, normal_balance, parent_id, is_active)
         VALUES ('${accountCode}', 'Deletable Account', 'expense', 'debit', NULL, true)`
      )

      const deactivated = await prisma.$queryRawUnsafe(
        `UPDATE "${schemaName}".account SET is_active = false
         WHERE account_code = '${accountCode}'
         RETURNING is_active`
      )

      expect(deactivated[0].is_active).toBe(false)
    })
  })
})
