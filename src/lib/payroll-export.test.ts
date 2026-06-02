import { describe, it, expect } from "vitest"
import { payrollExport } from "@/lib/payroll-export"
import { generateCsv } from "@/lib/export/csv"
import { generateXlsx } from "@/lib/export/xlsx"

describe("payrollExport", () => {
  describe("generatePayslipHtml", () => {
    it("is a callable function", () => {
      expect(typeof payrollExport.generatePayslipHtml).toBe("function")
    })

    it("returns null for non-existent pay run", async () => {
      const result = await payrollExport.generatePayslipHtml(
        "entity_main",
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000"
      )
      expect(result).toBeNull()
    })
  })

  describe("generatePayrollRegister", () => {
    it("is a callable function", () => {
      expect(typeof payrollExport.generatePayrollRegister).toBe("function")
    })

    it("throws for non-existent pay run", async () => {
      await expect(
        payrollExport.generatePayrollRegister(
          "entity_main",
          "00000000-0000-0000-0000-000000000000",
          "csv"
        )
      ).rejects.toThrow()
    })
  })
})

describe("csv export", () => {
  it("generates CSV with headers and data", () => {
    const rows = [
      { code: "001", name: "John Doe", amount: 25000 },
      { code: "002", name: "Jane Smith", amount: 30000 },
    ]
    const columns = [
      { key: "code", header: "Code" },
      { key: "name", header: "Name" },
      { key: "amount", header: "Amount" },
    ]
    const csv = generateCsv(rows, columns)
    expect(csv).toContain("Code")
    expect(csv).toContain("John Doe")
    expect(csv).toContain("25000")
  })

  it("handles empty rows", () => {
    const csv = generateCsv([], [{ key: "a", header: "A" }])
    expect(csv).toContain("A")
  })

  it("handles special characters", () => {
    const rows = [{ name: "O'Brien, John" }]
    const columns = [{ key: "name", header: "Name" }]
    const csv = generateCsv(rows, columns)
    expect(csv).toContain("O'Brien")
  })
})

describe("xlsx export", () => {
  it("generates XLSX with headers and data", () => {
    const rows = [
      { code: "001", name: "John Doe", amount: 25000 },
    ]
    const columns = [
      { key: "code", header: "Code" },
      { key: "name", header: "Name" },
      { key: "amount", header: "Amount" },
    ]
    const xlsx = generateXlsx(rows, columns, "Test")
    expect(xlsx).toContain("Code")
    expect(xlsx).toContain("John Doe")
    expect(xlsx).toContain("25000")
  })

  it("escapes XML special characters", () => {
    const rows = [{ name: "A & B <Corp>" }]
    const columns = [{ key: "name", header: "Name" }]
    const xlsx = generateXlsx(rows, columns, "Test")
    expect(xlsx).toContain("&amp;")
    expect(xlsx).toContain("&lt;")
    expect(xlsx).toContain("&gt;")
  })

  it("detects numeric values", () => {
    const rows = [{ amount: 25000 }]
    const columns = [{ key: "amount", header: "Amount" }]
    const xlsx = generateXlsx(rows, columns, "Test")
    expect(xlsx).toContain('ss:Type="Number"')
  })
})
