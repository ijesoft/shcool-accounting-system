import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId, createMockNextRequest } from "./helpers"

let mockEntityId: string | null = null

vi.mock("@/lib/auth/session", () => {
  const getEntityId = () => mockEntityId
  return {
    getSession: async () => ({
      userId: "00000000-0000-0000-0000-000000000001",
      email: "test@school.edu",
      fullName: "Test",
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

describe("E2E - Financial Reports", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    mockEntityId = entityId
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("Trial Balance", () => {
    it("should have trial balance route handler", async () => {
      const { GET } = await import("@/app/api/v1/financial-reports/trial-balance/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/trial-balance"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Income Statement", () => {
    it("should have income statement route handler", async () => {
      const { GET } = await import("@/app/api/v1/financial-reports/income-statement/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/income-statement?from=2026-01-01&to=2026-12-31"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Balance Sheet", () => {
    it("should have balance sheet route handler", async () => {
      const { GET } = await import("@/app/api/v1/financial-reports/balance-sheet/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/balance-sheet?as_of=2026-12-31"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Cash Flow Statement", () => {
    it("should have cash flow route handler", async () => {
      const { GET } = await import("@/app/api/v1/financial-reports/cash-flow/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/cash-flow?from=2026-01-01&to=2026-12-31"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Changes in Equity", () => {
    it("should have changes in equity route handler", async () => {
      const { GET } = await import("@/app/api/v1/financial-reports/changes-in-equity/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/financial-reports/changes-in-equity?from=2026-01-01&to=2026-12-31"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("AR Aging", () => {
    it("should have AR aging route handler", async () => {
      const { GET } = await import("@/app/api/v1/reports/ar-aging/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/reports/ar-aging"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("AFS Package", () => {
    it("should have AFS package route handler", async () => {
      const { GET } = await import("@/app/api/v1/reports/afs-package/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/reports/afs-package?year=2026"))
      expect(response.status).toBe(200)
    })
  })

  describe("Activity Schedule", () => {
    it("should have activity schedule route handler", async () => {
      const { GET } = await import("@/app/api/v1/reports/activity-schedule/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/reports/activity-schedule?from=2026-01-01&to=2026-12-31"))
      expect(response.status).toBe(200)
    })
  })

  describe("Revenue Recognition", () => {
    it("should have revenue recognition GET route handler", async () => {
      const { GET } = await import("@/app/api/v1/revenue-recognition/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/revenue-recognition"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("BIR Withholding Register", () => {
    it("should have withholding register GET route handler", async () => {
      const { GET } = await import("@/app/api/v1/bir/withholding-register/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/bir/withholding-register"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("BIR Serial Ranges", () => {
    it("should have serial ranges GET route handler", async () => {
      const { GET } = await import("@/app/api/v1/bir/serial-ranges/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/bir/serial-ranges"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Audit Log", () => {
    it("should have audit log route handler", async () => {
      const { GET } = await import("@/app/api/v1/admin/audit-log/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/admin/audit-log"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })

  describe("Audit Log Schema", () => {
    it("should have audit_log table in audit schema", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'audit' AND table_name = 'audit_log'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have correct audit_log columns", async () => {
      const columns = await prisma.$queryRawUnsafe(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'audit' AND table_name = 'audit_log'`
      )

      const columnNames = (columns as { column_name: string }[]).map(c => c.column_name)
      expect(columnNames).toContain("id")
      expect(columnNames).toContain("entity_id")
      expect(columnNames).toContain("user_id")
      expect(columnNames).toContain("action")
      expect(columnNames).toContain("table_name")
      expect(columnNames).toContain("record_id")
      expect(columnNames).toContain("old_values")
      expect(columnNames).toContain("new_values")
      expect(columnNames).toContain("ip_address")
      expect(columnNames).toContain("user_agent")
      expect(columnNames).toContain("created_at")
    })
  })

  describe("Enrollment Deposits", () => {
    it("should have enrollment deposits GET route handler", async () => {
      const { GET } = await import("@/app/api/v1/enrollment-deposits/route")
      const response = await GET(createMockNextRequest("http://localhost/api/v1/enrollment-deposits"))
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
    })
  })
})
