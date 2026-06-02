import { describe, it, expect } from "vitest"
import { hasPermission } from "@/lib/auth/rbac"

describe("RBAC - hasPermission", () => {
  describe("super_admin role", () => {
    it("has access to all core resources", () => {
      expect(hasPermission("super_admin", "accounts", "create")).toBe(true)
      expect(hasPermission("super_admin", "journal_entries", "create")).toBe(true)
      expect(hasPermission("super_admin", "cash_receipts", "create")).toBe(true)
      expect(hasPermission("super_admin", "cash_disbursements", "create")).toBe(true)
      expect(hasPermission("super_admin", "fixed_assets", "create")).toBe(true)
      expect(hasPermission("super_admin", "reports", "read")).toBe(true)
    })

    it("has access to payroll resources", () => {
      expect(hasPermission("super_admin", "employees", "create")).toBe(true)
      expect(hasPermission("super_admin", "employees", "read")).toBe(true)
      expect(hasPermission("super_admin", "employees", "update")).toBe(true)
      expect(hasPermission("super_admin", "employees", "delete")).toBe(true)
      expect(hasPermission("super_admin", "payroll", "create")).toBe(true)
      expect(hasPermission("super_admin", "payroll", "read")).toBe(true)
      expect(hasPermission("super_admin", "payroll", "post")).toBe(true)
      expect(hasPermission("super_admin", "payroll", "void")).toBe(true)
    })

    it("has access to budget resources", () => {
      expect(hasPermission("super_admin", "budget", "create")).toBe(true)
      expect(hasPermission("super_admin", "budget", "read")).toBe(true)
      expect(hasPermission("super_admin", "budget", "update")).toBe(true)
      expect(hasPermission("super_admin", "budget", "delete")).toBe(true)
    })

    it("has access to admin resources", () => {
      expect(hasPermission("super_admin", "users", "create")).toBe(true)
      expect(hasPermission("super_admin", "entities", "create")).toBe(true)
      expect(hasPermission("super_admin", "audit_log", "read")).toBe(true)
    })
  })

  describe("accountant role", () => {
    it("has access to core resources", () => {
      expect(hasPermission("accountant", "accounts", "create")).toBe(true)
      expect(hasPermission("accountant", "accounts", "read")).toBe(true)
      expect(hasPermission("accountant", "journal_entries", "create")).toBe(true)
      expect(hasPermission("accountant", "journal_entries", "post")).toBe(true)
      expect(hasPermission("accountant", "reports", "read")).toBe(true)
    })

    it("has access to payroll resources", () => {
      expect(hasPermission("accountant", "employees", "create")).toBe(true)
      expect(hasPermission("accountant", "employees", "read")).toBe(true)
      expect(hasPermission("accountant", "employees", "update")).toBe(true)
      expect(hasPermission("accountant", "payroll", "create")).toBe(true)
      expect(hasPermission("accountant", "payroll", "read")).toBe(true)
      expect(hasPermission("accountant", "payroll", "post")).toBe(true)
      expect(hasPermission("accountant", "payroll", "void")).toBe(true)
    })

    it("has access to budget resources", () => {
      expect(hasPermission("accountant", "budget", "create")).toBe(true)
      expect(hasPermission("accountant", "budget", "read")).toBe(true)
      expect(hasPermission("accountant", "budget", "update")).toBe(true)
      expect(hasPermission("accountant", "budget", "delete")).toBe(true)
    })

    it("cannot access admin resources", () => {
      expect(hasPermission("accountant", "users", "create")).toBe(false)
      expect(hasPermission("accountant", "entities", "create")).toBe(false)
    })
  })

  describe("finance_officer role", () => {
    it("has limited access to core resources", () => {
      expect(hasPermission("finance_officer", "accounts", "read")).toBe(true)
      expect(hasPermission("finance_officer", "accounts", "create")).toBe(false)
      expect(hasPermission("finance_officer", "cash_receipts", "create")).toBe(true)
      expect(hasPermission("finance_officer", "cash_receipts", "post")).toBe(true)
      expect(hasPermission("finance_officer", "reports", "read")).toBe(true)
    })

    it("cannot access payroll resources", () => {
      expect(hasPermission("finance_officer", "employees", "create")).toBe(false)
      expect(hasPermission("finance_officer", "payroll", "create")).toBe(false)
    })

    it("cannot access budget resources", () => {
      expect(hasPermission("finance_officer", "budget", "create")).toBe(false)
      expect(hasPermission("finance_officer", "budget", "read")).toBe(false)
    })
  })

  describe("auditor role", () => {
    it("has read-only access to reports", () => {
      expect(hasPermission("auditor", "reports", "read")).toBe(true)
      expect(hasPermission("auditor", "reports", "export")).toBe(true)
    })

    it("cannot create or modify resources", () => {
      expect(hasPermission("auditor", "accounts", "create")).toBe(false)
      expect(hasPermission("auditor", "journal_entries", "create")).toBe(false)
      expect(hasPermission("auditor", "cash_receipts", "create")).toBe(false)
    })

    it("cannot access payroll resources", () => {
      expect(hasPermission("auditor", "employees", "create")).toBe(false)
      expect(hasPermission("auditor", "payroll", "create")).toBe(false)
    })

    it("cannot access budget resources", () => {
      expect(hasPermission("auditor", "budget", "create")).toBe(false)
      expect(hasPermission("auditor", "budget", "read")).toBe(false)
    })
  })

  describe("unknown role", () => {
    it("denies all permissions", () => {
      expect(hasPermission("unknown_role", "accounts", "read")).toBe(false)
      expect(hasPermission("unknown_role", "payroll", "create")).toBe(false)
      expect(hasPermission("unknown_role", "budget", "read")).toBe(false)
    })
  })

  describe("unknown resource", () => {
    it("denies access to unknown resources", () => {
      expect(hasPermission("super_admin", "unknown_resource" as any, "read")).toBe(false)
    })
  })
})
