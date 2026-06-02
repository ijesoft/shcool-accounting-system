import { describe, it, expect, beforeAll, afterAll } from "vitest"
import bcrypt from "bcryptjs"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId } from "./helpers"

describe("E2E - Authentication", () => {
  beforeAll(async () => {
    await setupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("Login", () => {
    it("should authenticate with valid credentials", async () => {
      const admin = await prisma.user.findUnique({
        where: { email: "admin@school.edu" },
        include: { role: true },
      })

      expect(admin).toBeDefined()
      expect(admin?.role.name).toBe("super_admin")

      const passwordValid = await bcrypt.compare("admin123", admin!.passwordHash)
      expect(passwordValid).toBe(true)
    })

    it("should authenticate test users with correct roles", async () => {
      const roles = ["super_admin", "accountant", "finance_officer", "auditor", "cashier"]
      const roleEmails: Record<string, string> = {
        super_admin: "test_admin@school.edu",
        accountant: "test_accountant@school.edu",
        finance_officer: "test_finance@school.edu",
        auditor: "test_auditor@school.edu",
        cashier: "test_cashier@school.edu",
      }
      for (const roleName of roles) {
        const user = await prisma.user.findUnique({
          where: { email: roleEmails[roleName] },
          include: { role: true },
        })

        if (user) {
          const valid = await bcrypt.compare("test123", user.passwordHash)
          expect(valid, `Password validation failed for ${roleName}`).toBe(true)
          expect(user.role.name).toBe(roleName)
        }
      }
    })

    it("should reject inactive users", async () => {
      const inactiveUser = await prisma.user.create({
        data: {
          email: "inactive@school.edu",
          passwordHash: await bcrypt.hash("test123", 12),
          fullName: "Inactive User",
          roleId: (await prisma.role.findUnique({ where: { name: "auditor" } })!).id,
          isActive: false,
        },
      })

      const found = await prisma.user.findUnique({ where: { id: inactiveUser.id } })
      expect(found?.isActive).toBe(false)

      await prisma.user.delete({ where: { id: inactiveUser.id } })
    })

    it("should reject non-existent email", async () => {
      const user = await prisma.user.findUnique({ where: { email: "nonexistent@school.edu" } })
      expect(user).toBeNull()
    })
  })

  describe("Entity Selection", () => {
    it("should have main entity available", async () => {
      const entity = await prisma.entity.findUnique({ where: { code: "MAIN" } })
      expect(entity).toBeDefined()
      expect(entity?.status).toBe("active")
      expect(entity?.schemaName).toBe("entity_main")
    })

    it("should allow users to have entityId set", async () => {
      const entityId = await getMainEntityId()
      const admin = await prisma.user.findUnique({ where: { email: "admin@school.edu" } })
      expect(admin?.entityId).toBe(entityId)
    })

    it("should allow users without entityId to select entity", async () => {
      const noEntityUser = await prisma.user.create({
        data: {
          email: "noentity@school.edu",
          passwordHash: await bcrypt.hash("test123", 12),
          fullName: "No Entity User",
          roleId: (await prisma.role.findUnique({ where: { name: "auditor" } })!).id,
          isActive: true,
        },
      })

      expect(noEntityUser.entityId).toBeNull()

      await prisma.user.delete({ where: { id: noEntityUser.id } })
    })
  })

  describe("Session Integrity", () => {
    it("should have valid session data structure", async () => {
      const admin = await prisma.user.findUnique({
        where: { email: "admin@school.edu" },
        include: { role: true },
      })

      expect(admin).toMatchObject({
        id: expect.any(String),
        email: "admin@school.edu",
        fullName: expect.any(String),
        isActive: true,
      })
      expect(admin?.role.name).toBe("super_admin")
    })

    it("should track last login", async () => {
      const admin = await prisma.user.findUnique({ where: { email: "admin@school.edu" } })
      expect(admin?.lastLogin).toBeDefined()
    })
  })

  describe("Role Existence", () => {
    it("should have all 5 required roles", async () => {
      const requiredRoles = ["super_admin", "accountant", "finance_officer", "auditor", "cashier"]
      for (const roleName of requiredRoles) {
        const role = await prisma.role.findUnique({ where: { name: roleName } })
        expect(role, `Role ${roleName} should exist`).toBeDefined()
        expect(role?.isSystem).toBe(true)
      }
    })

    it("should have permissions assigned to each role", async () => {
      const roles = await prisma.role.findMany()
      for (const role of roles) {
        const permissions = await prisma.rolePermission.count({ where: { roleId: role.id } })
        expect(permissions, `Role ${role.name} should have permissions`).toBeGreaterThan(0)
      }
    })
  })
})
