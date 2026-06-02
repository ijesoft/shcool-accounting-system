import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma, setupTestUsers, cleanupTestUsers, getMainEntityId } from "./helpers"

describe("E2E - Cash Transactions CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("Cash Receipts", () => {
    it("should have official receipts table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'official_receipt'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have number series for official receipts", async () => {
      const series = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".number_series WHERE series_type = 'OR'`
      )
      expect(series.length).toBeGreaterThan(0)
    })
  })

  describe("Cash Disbursements", () => {
    it("should have cash disbursements table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'disbursement'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have number series for disbursements", async () => {
      const series = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".number_series WHERE series_type = 'CD'`
      )
      expect(series.length).toBeGreaterThan(0)
    })
  })

  describe("Official Receipts", () => {
    it("should have official receipts table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'official_receipt'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have official receipt lines table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'official_receipt_line'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have number series for official receipts", async () => {
      const series = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".number_series WHERE series_type = 'OR'`
      )
      expect(series.length).toBeGreaterThan(0)
    })
  })

  describe("General Ledger", () => {
    it("should have general ledger table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'general_ledger'`
      )
      expect(tables.length).toBe(1)
    })
  })
})

describe("E2E - Student & Vendor Accounts CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe("Student Accounts", () => {
    it("should have student table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'student'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have student invoice table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'student_invoice'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have student invoice line table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'student_invoice_line'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have payment transaction table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'payment_transaction'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have number series for invoices", async () => {
      const series = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".number_series WHERE series_type = 'INVOICE'`
      )
      expect(series.length).toBeGreaterThan(0)
    })

    it("should have number series for payments", async () => {
      const series = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${schemaName}".number_series WHERE series_type = 'PMT'`
      )
      expect(series.length).toBeGreaterThan(0)
    })
  })

  describe("Vendor Accounts", () => {
    it("should have vendor account table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'vendor_account'`
      )
      expect(tables.length).toBe(1)
    })

    it("should have vendor invoice table", async () => {
      const tables = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = '${schemaName}' AND table_name = 'vendor_invoice'`
      )
      expect(tables.length).toBe(1)
    })
  })
})

describe("E2E - Fixed Assets CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have fixed asset table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'fixed_asset'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have depreciation entry table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'depreciation_entry'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - Bank Reconciliation CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have bank account table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'bank_account'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have bank reconciliation table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'bank_reconciliation'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have reconciliation item table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'reconciliation_item'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - Employees & Payroll CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have employee table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'employee'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have payroll run table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'payroll_run'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have payroll run line table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'payroll_run_line'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - Budget CRUD", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have budget table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'budget'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - Revenue Recognition", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have revenue recognition entry table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'revenue_recognition_entry'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - BIR & Tax", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have BIR serial range table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'bir_serial_range'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have withholding tax register table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'withholding_tax_register'`
    )
    expect(tables.length).toBe(1)
  })
})

describe("E2E - Approval System", () => {
  let entityId: string
  let schemaName: string

  beforeAll(async () => {
    await setupTestUsers()
    entityId = await getMainEntityId()
    const entity = await prisma.entity.findUnique({ where: { id: entityId } })
    schemaName = entity?.schemaName!
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it("should have approval rule table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'approval_rule'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have approval request table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'approval_request'`
    )
    expect(tables.length).toBe(1)
  })

  it("should have approval action table", async () => {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = '${schemaName}' AND table_name = 'approval_action'`
    )
    expect(tables.length).toBe(1)
  })
})
