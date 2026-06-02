import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { hasPermission, type Resource, type Action } from "@/lib/auth/rbac"
import { prisma, setupTestUsers, cleanupTestUsers } from "./helpers"

const TEST_ROLES = ["super_admin", "accountant", "finance_officer", "auditor", "cashier"] as const

const ALL_RESOURCES: Resource[] = [
  "accounts", "journal_entries", "official_receipts", "cash_receipts",
  "cash_disbursements", "student_accounts", "vendor_accounts", "fixed_assets",
  "bank_reconciliation", "reports", "users", "entities", "audit_log",
  "fiscal_periods", "employees", "payroll", "budget",
]

const ALL_ACTIONS: Action[] = [
  "create", "read", "update", "delete", "post", "approve",
  "export", "void", "depreciate", "dispose", "submit", "reject",
]

describe("E2E - RBAC Authorization", () => {
  beforeAll(async () => {
    await setupTestUsers()
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("super_admin - full access", () => {
    it("should have read access to all resources", () => {
      for (const resource of ALL_RESOURCES) {
        expect(
          hasPermission("super_admin", resource, "read"),
          `super_admin should read ${resource}`
        ).toBe(true)
      }
    })

    it("should have create access to all modifiable resources", () => {
      const modifiable: Resource[] = [
        "accounts", "journal_entries", "cash_receipts", "cash_disbursements",
        "student_accounts", "vendor_accounts", "fixed_assets", "bank_reconciliation",
        "users", "entities", "fiscal_periods", "employees", "payroll", "budget",
      ]
      for (const resource of modifiable) {
        expect(
          hasPermission("super_admin", resource, "create"),
          `super_admin should create ${resource}`
        ).toBe(true)
      }
    })

    it("should have update access to all updatable resources", () => {
      const updatable: Resource[] = [
        "accounts", "journal_entries", "cash_receipts", "cash_disbursements",
        "student_accounts", "vendor_accounts", "fixed_assets", "bank_reconciliation",
        "users", "entities", "fiscal_periods", "employees", "budget",
      ]
      for (const resource of updatable) {
        expect(
          hasPermission("super_admin", resource, "update"),
          `super_admin should update ${resource}`
        ).toBe(true)
      }
    })

    it("should have delete access to all deletable resources", () => {
      const deletable: Resource[] = [
        "accounts", "cash_receipts", "cash_disbursements",
        "student_accounts", "vendor_accounts", "users", "entities", "budget",
      ]
      for (const resource of deletable) {
        expect(
          hasPermission("super_admin", resource, "delete"),
          `super_admin should delete ${resource}`
        ).toBe(true)
      }
    })

    it("should have post access to posting resources", () => {
      const postable: Resource[] = [
        "journal_entries", "cash_receipts", "cash_disbursements",
        "bank_reconciliation", "payroll",
      ]
      for (const resource of postable) {
        expect(
          hasPermission("super_admin", resource, "post"),
          `super_admin should post ${resource}`
        ).toBe(true)
      }
    })

    it("should have approve access to approvable resources", () => {
      expect(hasPermission("super_admin", "journal_entries", "approve")).toBe(true)
    })

    it("should have void access to voidable resources", () => {
      expect(hasPermission("super_admin", "official_receipts", "void")).toBe(true)
      expect(hasPermission("super_admin", "payroll", "void")).toBe(true)
    })

    it("should have depreciation and disposal access for fixed assets", () => {
      expect(hasPermission("super_admin", "fixed_assets", "depreciate")).toBe(true)
      expect(hasPermission("super_admin", "fixed_assets", "dispose")).toBe(true)
    })

    it("should have export access to reports", () => {
      expect(hasPermission("super_admin", "reports", "export")).toBe(true)
    })

    it("should have admin access", () => {
      expect(hasPermission("super_admin", "users", "create")).toBe(true)
      expect(hasPermission("super_admin", "entities", "create")).toBe(true)
      expect(hasPermission("super_admin", "audit_log", "read")).toBe(true)
    })
  })

  describe("accountant - broad access without admin", () => {
    it("should have read access to core resources", () => {
      expect(hasPermission("accountant", "accounts", "read")).toBe(true)
      expect(hasPermission("accountant", "journal_entries", "read")).toBe(true)
      expect(hasPermission("accountant", "cash_receipts", "read")).toBe(true)
      expect(hasPermission("accountant", "cash_disbursements", "read")).toBe(true)
      expect(hasPermission("accountant", "student_accounts", "read")).toBe(true)
      expect(hasPermission("accountant", "vendor_accounts", "read")).toBe(true)
      expect(hasPermission("accountant", "fixed_assets", "read")).toBe(true)
      expect(hasPermission("accountant", "bank_reconciliation", "read")).toBe(true)
      expect(hasPermission("accountant", "reports", "read")).toBe(true)
    })

    it("should have create access to accounting resources", () => {
      expect(hasPermission("accountant", "accounts", "create")).toBe(true)
      expect(hasPermission("accountant", "journal_entries", "create")).toBe(true)
      expect(hasPermission("accountant", "cash_receipts", "create")).toBe(true)
      expect(hasPermission("accountant", "cash_disbursements", "create")).toBe(true)
      expect(hasPermission("accountant", "student_accounts", "create")).toBe(true)
      expect(hasPermission("accountant", "vendor_accounts", "create")).toBe(true)
      expect(hasPermission("accountant", "fixed_assets", "create")).toBe(true)
      expect(hasPermission("accountant", "bank_reconciliation", "create")).toBe(true)
      expect(hasPermission("accountant", "employees", "create")).toBe(true)
      expect(hasPermission("accountant", "payroll", "create")).toBe(true)
      expect(hasPermission("accountant", "budget", "create")).toBe(true)
    })

    it("should have post and approve access", () => {
      expect(hasPermission("accountant", "journal_entries", "post")).toBe(true)
      expect(hasPermission("accountant", "journal_entries", "approve")).toBe(true)
      expect(hasPermission("accountant", "cash_receipts", "post")).toBe(true)
      expect(hasPermission("accountant", "cash_disbursements", "post")).toBe(true)
      expect(hasPermission("accountant", "payroll", "post")).toBe(true)
    })

    it("should have payroll and budget access", () => {
      expect(hasPermission("accountant", "employees", "read")).toBe(true)
      expect(hasPermission("accountant", "employees", "update")).toBe(true)
      expect(hasPermission("accountant", "payroll", "read")).toBe(true)
      expect(hasPermission("accountant", "payroll", "void")).toBe(true)
      expect(hasPermission("accountant", "budget", "read")).toBe(true)
      expect(hasPermission("accountant", "budget", "update")).toBe(true)
      expect(hasPermission("accountant", "budget", "delete")).toBe(true)
    })

    it("should NOT have admin access", () => {
      expect(hasPermission("accountant", "users", "create")).toBe(false)
      expect(hasPermission("accountant", "users", "read")).toBe(false)
      expect(hasPermission("accountant", "entities", "create")).toBe(false)
      expect(hasPermission("accountant", "entities", "read")).toBe(false)
      expect(hasPermission("accountant", "audit_log", "read")).toBe(false)
    })

    it("should NOT have delete access to core resources", () => {
      expect(hasPermission("accountant", "accounts", "delete")).toBe(false)
      expect(hasPermission("accountant", "journal_entries", "delete")).toBe(false)
      expect(hasPermission("accountant", "cash_receipts", "delete")).toBe(false)
      expect(hasPermission("accountant", "cash_disbursements", "delete")).toBe(false)
    })
  })

  describe("finance_officer - limited operational access", () => {
    it("should have read-only access to accounts", () => {
      expect(hasPermission("finance_officer", "accounts", "read")).toBe(true)
      expect(hasPermission("finance_officer", "accounts", "create")).toBe(false)
      expect(hasPermission("finance_officer", "accounts", "update")).toBe(false)
      expect(hasPermission("finance_officer", "accounts", "delete")).toBe(false)
    })

    it("should have full access to cash receipts and disbursements", () => {
      expect(hasPermission("finance_officer", "cash_receipts", "create")).toBe(true)
      expect(hasPermission("finance_officer", "cash_receipts", "read")).toBe(true)
      expect(hasPermission("finance_officer", "cash_receipts", "post")).toBe(true)
      expect(hasPermission("finance_officer", "cash_disbursements", "create")).toBe(true)
      expect(hasPermission("finance_officer", "cash_disbursements", "read")).toBe(true)
      expect(hasPermission("finance_officer", "cash_disbursements", "post")).toBe(true)
    })

    it("should have access to student and vendor accounts", () => {
      expect(hasPermission("finance_officer", "student_accounts", "create")).toBe(true)
      expect(hasPermission("finance_officer", "student_accounts", "read")).toBe(true)
      expect(hasPermission("finance_officer", "student_accounts", "update")).toBe(true)
      expect(hasPermission("finance_officer", "vendor_accounts", "create")).toBe(true)
      expect(hasPermission("finance_officer", "vendor_accounts", "read")).toBe(true)
      expect(hasPermission("finance_officer", "vendor_accounts", "update")).toBe(true)
    })

    it("should have read access to reports and fixed assets", () => {
      expect(hasPermission("finance_officer", "reports", "read")).toBe(true)
      expect(hasPermission("finance_officer", "fixed_assets", "read")).toBe(true)
    })

    it("should have access to bank reconciliation", () => {
      expect(hasPermission("finance_officer", "bank_reconciliation", "read")).toBe(true)
      expect(hasPermission("finance_officer", "bank_reconciliation", "create")).toBe(true)
    })

    it("should NOT have access to journal entries", () => {
      expect(hasPermission("finance_officer", "journal_entries", "read")).toBe(false)
      expect(hasPermission("finance_officer", "journal_entries", "create")).toBe(false)
    })

    it("should NOT have payroll or budget access", () => {
      expect(hasPermission("finance_officer", "employees", "read")).toBe(false)
      expect(hasPermission("finance_officer", "payroll", "read")).toBe(false)
      expect(hasPermission("finance_officer", "budget", "read")).toBe(false)
    })

    it("should NOT have admin access", () => {
      expect(hasPermission("finance_officer", "users", "create")).toBe(false)
      expect(hasPermission("finance_officer", "entities", "create")).toBe(false)
      expect(hasPermission("finance_officer", "audit_log", "read")).toBe(false)
    })
  })

  describe("auditor - read-only access", () => {
    it("should have read access to all auditable resources", () => {
      const auditable: Resource[] = [
        "accounts", "journal_entries", "cash_receipts", "cash_disbursements",
        "student_accounts", "vendor_accounts", "official_receipts", "reports",
        "fixed_assets", "bank_reconciliation", "audit_log",
      ]
      for (const resource of auditable) {
        expect(
          hasPermission("auditor", resource, "read"),
          `auditor should read ${resource}`
        ).toBe(true)
      }
    })

    it("should have export access to reports", () => {
      expect(hasPermission("auditor", "reports", "export")).toBe(true)
    })

    it("should NOT have create access to any resource", () => {
      for (const resource of ALL_RESOURCES) {
        expect(
          hasPermission("auditor", resource, "create"),
          `auditor should NOT create ${resource}`
        ).toBe(false)
      }
    })

    it("should NOT have update access to any resource", () => {
      for (const resource of ALL_RESOURCES) {
        expect(
          hasPermission("auditor", resource, "update"),
          `auditor should NOT update ${resource}`
        ).toBe(false)
      }
    })

    it("should NOT have delete access to any resource", () => {
      for (const resource of ALL_RESOURCES) {
        expect(
          hasPermission("auditor", resource, "delete"),
          `auditor should NOT delete ${resource}`
        ).toBe(false)
      }
    })

    it("should NOT have post access to any resource", () => {
      for (const resource of ALL_RESOURCES) {
        expect(
          hasPermission("auditor", resource, "post"),
          `auditor should NOT post ${resource}`
        ).toBe(false)
      }
    })

    it("should NOT have payroll or budget access", () => {
      expect(hasPermission("auditor", "employees", "read")).toBe(false)
      expect(hasPermission("auditor", "payroll", "read")).toBe(false)
      expect(hasPermission("auditor", "budget", "read")).toBe(false)
    })

    it("should NOT have admin access (except audit log)", () => {
      expect(hasPermission("auditor", "users", "read")).toBe(false)
      expect(hasPermission("auditor", "entities", "read")).toBe(false)
    })
  })

  describe("cashier - narrow operational access", () => {
    it("should have access to cash receipts", () => {
      expect(hasPermission("cashier", "cash_receipts", "create")).toBe(true)
      expect(hasPermission("cashier", "cash_receipts", "read")).toBe(true)
    })

    it("should have access to official receipts", () => {
      expect(hasPermission("cashier", "official_receipts", "create")).toBe(true)
      expect(hasPermission("cashier", "official_receipts", "read")).toBe(true)
      expect(hasPermission("cashier", "official_receipts", "void")).toBe(true)
    })

    it("should have read access to student accounts", () => {
      expect(hasPermission("cashier", "student_accounts", "read")).toBe(true)
    })

    it("should have read access to reports", () => {
      expect(hasPermission("cashier", "reports", "read")).toBe(true)
    })

    it("should NOT have access to accounts", () => {
      expect(hasPermission("cashier", "accounts", "read")).toBe(false)
    })

    it("should NOT have access to journal entries", () => {
      expect(hasPermission("cashier", "journal_entries", "read")).toBe(false)
    })

    it("should NOT have access to cash disbursements", () => {
      expect(hasPermission("cashier", "cash_disbursements", "read")).toBe(false)
    })

    it("should NOT have access to fixed assets", () => {
      expect(hasPermission("cashier", "fixed_assets", "read")).toBe(false)
    })

    it("should NOT have access to bank reconciliation", () => {
      expect(hasPermission("cashier", "bank_reconciliation", "read")).toBe(false)
    })

    it("should NOT have access to payroll or budget", () => {
      expect(hasPermission("cashier", "employees", "read")).toBe(false)
      expect(hasPermission("cashier", "payroll", "read")).toBe(false)
      expect(hasPermission("cashier", "budget", "read")).toBe(false)
    })

    it("should NOT have admin access", () => {
      expect(hasPermission("cashier", "users", "read")).toBe(false)
      expect(hasPermission("cashier", "entities", "read")).toBe(false)
      expect(hasPermission("cashier", "audit_log", "read")).toBe(false)
    })

    it("should NOT have post access", () => {
      expect(hasPermission("cashier", "cash_receipts", "post")).toBe(false)
    })
  })

  describe("unknown role - denied all access", () => {
    it("should deny all permissions for unknown roles", () => {
      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          expect(
            hasPermission("unknown_role", resource, action),
            `unknown role should NOT ${action} ${resource}`
          ).toBe(false)
        }
      }
    })
  })

  describe("role-permission matrix completeness", () => {
    it("should have at least one permission per role", async () => {
      const roles = await prisma.role.findMany()
      for (const role of roles) {
        const permCount = await prisma.rolePermission.count({ where: { roleId: role.id } })
        expect(permCount, `Role ${role.name} should have at least one permission`).toBeGreaterThan(0)
      }
    })

    it("should have consistent permissions between RBAC module and database", async () => {
      const roles = await prisma.role.findMany({
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      })

      for (const role of roles) {
        const dbPerms = role.permissions.map(p => ({
          resource: p.permission.resource,
          action: p.permission.action,
        }))

        for (const perm of dbPerms) {
          const rbacCheck = hasPermission(
            role.name,
            perm.resource as Resource,
            perm.action as Action
          )
          expect(
            rbacCheck,
            `RBAC module should grant ${role.name} ${perm.action} on ${perm.resource}`
          ).toBe(true)
        }
      }
    })
  })

  describe("principle of least privilege", () => {
    it("should ensure cashier has fewer permissions than finance_officer", () => {
      let cashierCount = 0
      let financeCount = 0

      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          if (hasPermission("cashier", resource, action)) cashierCount++
          if (hasPermission("finance_officer", resource, action)) financeCount++
        }
      }

      expect(cashierCount).toBeLessThan(financeCount)
    })

    it("should ensure auditor has fewer permissions than accountant", () => {
      let auditorCount = 0
      let accountantCount = 0

      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          if (hasPermission("auditor", resource, action)) auditorCount++
          if (hasPermission("accountant", resource, action)) accountantCount++
        }
      }

      expect(auditorCount).toBeLessThan(accountantCount)
    })

    it("should ensure accountant has fewer permissions than super_admin", () => {
      let accountantCount = 0
      let adminCount = 0

      for (const resource of ALL_RESOURCES) {
        for (const action of ALL_ACTIONS) {
          if (hasPermission("accountant", resource, action)) accountantCount++
          if (hasPermission("super_admin", resource, action)) adminCount++
        }
      }

      expect(accountantCount).toBeLessThan(adminCount)
    })
  })
})
