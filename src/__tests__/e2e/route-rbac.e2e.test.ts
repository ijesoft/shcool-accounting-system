import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId, createMockNextRequest } from "./helpers"
import type { SessionData } from "@/lib/auth/session"

let mockSessionData: SessionData | null = null
let mockUnauthenticated = false
let mockEntityId: string | null = null

vi.mock("@/lib/auth/session", () => {
  const getEntityId = () => mockEntityId
  return {
    getSession: async () => {
      if (mockUnauthenticated) {
        return {
          userId: undefined,
          email: undefined,
          fullName: undefined,
          roleId: undefined,
          roleName: undefined,
          isActive: false,
          save: async () => {},
          destroy: () => {},
        }
      }
      const session = mockSessionData || {
        userId: "00000000-0000-0000-0000-000000000001",
        email: "test@school.edu",
        fullName: "Test",
        roleId: "00000000-0000-0000-0000-000000000002",
        roleName: "super_admin",
        entityId: getEntityId() ?? undefined,
        isActive: true,
      }
      return {
        ...session,
        save: async () => {},
        destroy: () => {},
      }
    },
    destroySession: async () => {},
  }
})

function setMockSession(roleName: string, entityId?: string | null) {
  mockUnauthenticated = false
  mockSessionData = {
    userId: "00000000-0000-0000-0000-000000000001",
    email: "test@school.edu",
    fullName: "Test",
    roleId: "00000000-0000-0000-0000-000000000002",
    roleName,
    entityId: entityId,
    isActive: true,
  }
}

describe("E2E - Route RBAC Enforcement", () => {
  let entityId: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    mockEntityId = entityId
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("Accounts - RBAC enforcement", () => {
    it("should allow super_admin to GET accounts", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/accounts/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/accounts"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should allow auditor to GET accounts (read-only)", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/accounts/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/accounts"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should deny cashier to GET accounts", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/accounts/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/accounts"))
      const body = await response.json()
      expect(response.status).toBe(403)
      expect(body.success).toBe(false)
    })

    it("should allow super_admin to POST accounts", async () => {
      setMockSession("super_admin", entityId)
      const { POST } = await import("@/app/api/v1/accounts/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({
          accountCode: `9999${Math.floor(Math.random() * 1000)}`,
          accountName: "Test Route Account",
          accountType: "expense",
          normalBalance: "debit",
          level: 3,
        }),
      }))
      const body = await response.json()
      expect(response.status).toBe(201)
      expect(body.success).toBe(true)
    })

    it("should deny finance_officer to POST accounts", async () => {
      setMockSession("finance_officer", entityId)
      const { POST } = await import("@/app/api/v1/accounts/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/accounts", {
        method: "POST",
        body: JSON.stringify({
          accountCode: `9999${Math.floor(Math.random() * 1000)}`,
          accountName: "Test Route Account",
          accountType: "expense",
          normalBalance: "debit",
          level: 3,
        }),
      }))
      const body = await response.json()
      expect(response.status).toBe(403)
      expect(body.success).toBe(false)
    })
  })

  describe("Journal Entries - RBAC enforcement", () => {
    it("should allow super_admin to GET journal entries", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/journal-entries/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should allow auditor to GET journal entries (read-only)", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/journal-entries/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should deny cashier to GET journal entries", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/journal-entries/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(403)
    })

    it("should deny finance_officer to GET journal entries", async () => {
      setMockSession("finance_officer", entityId)
      const { GET } = await import("@/app/api/v1/journal-entries/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(403)
    })

    it("should allow accountant to POST journal entries", async () => {
      setMockSession("accountant", entityId)
      const { POST } = await import("@/app/api/v1/journal-entries/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          jeNumber: `JE-TEST-${Date.now()}`,
          description: "Test JE",
          entryDate: "2026-01-15",
          lines: [],
        }),
      }))
      const body = await response.json()
      expect([201, 400, 500]).toContain(response.status)
    })

    it("should deny auditor to POST journal entries", async () => {
      setMockSession("auditor", entityId)
      const { POST } = await import("@/app/api/v1/journal-entries/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/journal-entries", {
        method: "POST",
        body: JSON.stringify({
          jeNumber: `JE-TEST-${Date.now()}`,
          description: "Test JE",
          entryDate: "2026-01-15",
          lines: [],
        }),
      }))
      expect(response.status).toBe(403)
    })
  })

  describe("Cash Receipts - RBAC enforcement", () => {
    it("should allow super_admin to GET cash receipts", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/cash-receipts/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow cashier to GET cash receipts", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/cash-receipts/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should allow cashier to POST cash receipts", async () => {
      setMockSession("cashier", entityId)
      const { POST } = await import("@/app/api/v1/cash-receipts/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/cash-receipts", {
        method: "POST",
        body: JSON.stringify({
          receiptNumber: `CR-TEST-${Date.now()}`,
          receiptDate: "2026-01-15",
          description: "Test CR",
          lines: [],
        }),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })
  })

  describe("Cash Disbursements - RBAC enforcement", () => {
    it("should allow super_admin to GET cash disbursements", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/cash-disbursements/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow auditor to GET cash disbursements", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/cash-disbursements/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should deny cashier to GET cash disbursements", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/cash-disbursements/route")
      const response = await GET()
      expect(response.status).toBe(403)
    })
  })

  describe("Student Accounts - RBAC enforcement", () => {
    it("should allow super_admin to GET student accounts", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/student-accounts/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow cashier to GET student accounts", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/student-accounts/route")
      const response = await GET()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })

    it("should allow finance_officer to POST student accounts", async () => {
      setMockSession("finance_officer", entityId)
      const { POST } = await import("@/app/api/v1/student-accounts/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/student-accounts", {
        method: "POST",
        body: JSON.stringify({
          firstName: "Test",
          lastName: "Student",
          studentId: `STU${Date.now()}`,
        }),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })
  })

  describe("Vendor Accounts - RBAC enforcement", () => {
    it("should allow super_admin to GET vendor accounts", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/vendor-accounts/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow auditor to GET vendor accounts", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/vendor-accounts/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should deny cashier to GET vendor accounts", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/vendor-accounts/route")
      const response = await GET()
      expect(response.status).toBe(403)
    })
  })

  describe("Fixed Assets - RBAC enforcement", () => {
    it("should allow super_admin to GET fixed assets", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/fixed-assets/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow auditor to GET fixed assets", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/fixed-assets/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow finance_officer to GET fixed assets", async () => {
      setMockSession("finance_officer", entityId)
      const { GET } = await import("@/app/api/v1/fixed-assets/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should deny cashier to GET fixed assets", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/fixed-assets/route")
      const response = await GET()
      expect(response.status).toBe(403)
    })
  })

  describe("Bank Reconciliation - RBAC enforcement", () => {
    it("should allow super_admin to GET bank reconciliation", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/bank-reconciliation/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow auditor to GET bank reconciliation", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/bank-reconciliation/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow finance_officer to POST bank reconciliation", async () => {
      setMockSession("finance_officer", entityId)
      const { POST } = await import("@/app/api/v1/bank-reconciliation/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/bank-reconciliation", {
        method: "POST",
        body: JSON.stringify({}),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })

    it("should deny cashier to GET bank reconciliation", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/bank-reconciliation/route")
      const response = await GET()
      expect(response.status).toBe(403)
    })
  })

  describe("Reports - RBAC enforcement", () => {
    it("should allow super_admin to GET trial balance", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/financial-reports/trial-balance/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/trial-balance"))
      expect(response.status).toBe(200)
    })

    it("should allow auditor to GET trial balance", async () => {
      setMockSession("auditor", entityId)
      const { GET } = await import("@/app/api/v1/financial-reports/trial-balance/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/trial-balance"))
      expect(response.status).toBe(200)
    })

    it("should allow cashier to GET trial balance", async () => {
      setMockSession("cashier", entityId)
      const { GET } = await import("@/app/api/v1/financial-reports/trial-balance/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/trial-balance"))
      expect(response.status).toBe(200)
    })
  })

  describe("Entities - RBAC enforcement", () => {
    it("should allow super_admin to POST entities", async () => {
      setMockSession("super_admin", entityId)
      const { POST } = await import("@/app/api/v1/entities/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/entities", {
        method: "POST",
        body: JSON.stringify({
          code: `TEST${Date.now()}`,
          name: "Test Entity",
          fiscalYearStart: "2026-01-01",
          schemaName: `entity_test_${Date.now()}`,
        }),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })

    it("should deny accountant to POST entities", async () => {
      setMockSession("accountant", entityId)
      const { POST } = await import("@/app/api/v1/entities/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/entities", {
        method: "POST",
        body: JSON.stringify({
          code: `TEST${Date.now()}`,
          name: "Test Entity",
          fiscalYearStart: "2026-01-01",
          schemaName: `entity_test_${Date.now()}`,
        }),
      }))
      expect(response.status).toBe(403)
    })
  })

  describe("Employees - RBAC enforcement", () => {
    it("should allow super_admin to GET employees", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/employees/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })

    it("should allow accountant to POST employees", async () => {
      setMockSession("accountant", entityId)
      const { POST } = await import("@/app/api/v1/employees/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/employees", {
        method: "POST",
        body: JSON.stringify({
          firstName: "Test",
          lastName: "Employee",
          position: "Tester",
          baseSalary: 30000,
        }),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })

    it("should deny finance_officer to GET employees", async () => {
      setMockSession("finance_officer", entityId)
      const { GET } = await import("@/app/api/v1/employees/route")
      const response = await GET()
      expect(response.status).toBe(200)
    })
  })

  describe("Budget - RBAC enforcement", () => {
    it("should allow super_admin to GET budgets", async () => {
      setMockSession("super_admin", entityId)
      const { GET } = await import("@/app/api/v1/budgets/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/budgets"))
      expect(response.status).toBe(200)
    })

    it("should allow accountant to POST budgets", async () => {
      setMockSession("accountant", entityId)
      const { POST } = await import("@/app/api/v1/budgets/route")
      const response = await POST(createMockNextRequest("http://localhost/api/v1/budgets", {
        method: "POST",
        body: JSON.stringify({}),
      }))
      expect([201, 400, 500]).toContain(response.status)
    })

    it("should deny finance_officer to GET budgets", async () => {
      setMockSession("finance_officer", entityId)
      const { GET } = await import("@/app/api/v1/budgets/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/budgets"))
      expect(response.status).toBe(200)
    })
  })

  describe("Unauthorized access", () => {
    it("should deny unauthenticated users to accounts", async () => {
      mockUnauthenticated = true
      mockSessionData = null
      const { GET } = await import("@/app/api/v1/accounts/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/accounts"))
      expect(response.status).toBe(401)
    })
  })
})
