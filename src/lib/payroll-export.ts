import { prisma } from "@/lib/db"
import { generateCsv, csvResponse } from "@/lib/export/csv"
import { generateXlsx, xlsxResponse } from "@/lib/export/xlsx"

export const payrollExport = {
  async generatePayslipHtml(
    entitySchema: string,
    payRunId: string,
    employeeId: string
  ): Promise<string | null> {
    const payRun = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payroll_run WHERE id::text = $1`,
      payRunId
    )
    if (!payRun[0]) return null

    const line = await prisma.$queryRawUnsafe<any[]>(
      `SELECT prl.*, e.full_name, e.employee_code, e.position, e.department,
              e.tin, e.sss_number, e.philhealth_number, e.pagibig_number
       FROM "${entitySchema}".payroll_run_line prl
       JOIN "${entitySchema}".employee e ON e.id::text = prl.employee_id::text
       WHERE prl.payroll_run_id::text = $1 AND prl.employee_id::text = $2`,
      payRunId, employeeId
    )
    if (!line[0]) return null

    const entity = await prisma.entity.findFirst({
      where: { schemaName: entitySchema },
    })

    const pl = line[0]
    const pr = payRun[0]

    const periodStart = pr.pay_period_start instanceof Date ? pr.pay_period_start.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : pr.pay_period_start
    const periodEnd = pr.pay_period_end instanceof Date ? pr.pay_period_end.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : pr.pay_period_end
    const runDate = pr.run_date instanceof Date ? pr.run_date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : pr.run_date

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Payslip - ${pl.full_name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 20px; }
  .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
  .header p { font-size: 10px; color: #555; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
  .info-item { display: flex; flex-direction: column; }
  .info-label { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
  .info-value { font-size: 11px; font-weight: 600; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; background: #f3f4f6; padding: 6px 10px; margin-bottom: 4px; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  td { padding: 4px 10px; }
  td.amount { text-align: right; font-family: 'Courier New', monospace; }
  tr.total td { border-top: 1px solid #1a1a1a; font-weight: 700; }
  tr.grand-total td { border-top: 2px solid #1a1a1a; border-bottom: 2px solid #1a1a1a; font-weight: 700; font-size: 12px; }
  .footer { text-align: center; font-size: 9px; color: #888; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${entity?.name || "School"}</h1>
    <p>PAYSLIP — ${pr.run_number}</p>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <span class="info-label">Employee</span>
      <span class="info-value">${pl.full_name}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Employee Code</span>
      <span class="info-value">${pl.employee_code}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Position</span>
      <span class="info-value">${pl.position || "-"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Department</span>
      <span class="info-value">${pl.department || "-"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Pay Period</span>
      <span class="info-value">${periodStart} to ${periodEnd}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Run Date</span>
      <span class="info-value">${runDate}</span>
    </div>
    <div class="info-item">
      <span class="info-label">TIN</span>
      <span class="info-value">${pl.tin || "-"}</span>
    </div>
    <div class="info-item">
      <span class="info-label">SSS / PhilHealth / Pag-IBIG</span>
      <span class="info-value">${pl.sss_number || "-"} / ${pl.philhealth_number || "-"} / ${pl.pagibig_number || "-"}</span>
    </div>
  </div>

  <div class="section-title">Earnings</div>
  <table>
    <tr><td>Basic Pay</td><td class="amount">${Number(pl.basic_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr><td>Allowances</td><td class="amount">${Number(pl.allowances || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr class="total"><td>Gross Pay</td><td class="amount">${Number(pl.gross_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
  </table>

  <div class="section-title">Deductions</div>
  <table>
    <tr><td>SSS (Employee)</td><td class="amount">${Number(pl.sss_employee).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr><td>PhilHealth (Employee)</td><td class="amount">${Number(pl.philhealth_employee).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr><td>Pag-IBIG (Employee)</td><td class="amount">${Number(pl.pagibig_employee).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr><td>Withholding Tax</td><td class="amount">${Number(pl.withholding_tax).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
    <tr class="total"><td>Total Deductions</td><td class="amount">${Number(pl.total_deductions).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
  </table>

  <table>
    <tr class="grand-total"><td>NET PAY</td><td class="amount">₱ ${Number(pl.net_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr>
  </table>

  <div class="footer">
    <p>This is a computer-generated payslip. ${entity?.name || "School"} — ${runDate}</p>
  </div>
</body>
</html>`
  },

  async generatePayrollRegister(
    entitySchema: string,
    payRunId: string,
    format: "csv" | "xlsx"
  ): Promise<Response> {
    const payRun = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payroll_run WHERE id = $1`,
      payRunId
    )
    if (!payRun[0]) throw new Error("Payroll run not found")

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `SELECT prl.*, e.full_name, e.employee_code, e.position, e.department
       FROM "${entitySchema}".payroll_run_line prl
       JOIN "${entitySchema}".employee e ON e.id = prl.employee_id
       WHERE prl.payroll_run_id = $1
       ORDER BY e.full_name`,
      payRunId
    )

    const rows = lines.map((pl: any) => ({
      employeeCode: pl.employee_code,
      employeeName: pl.full_name,
      position: pl.position || "",
      department: pl.department || "",
      basicPay: Number(pl.basic_pay),
      allowances: Number(pl.allowances || 0),
      grossPay: Number(pl.gross_pay),
      sssEmployee: Number(pl.sss_employee),
      sssEmployer: Number(pl.sss_employer),
      philhealthEmployee: Number(pl.philhealth_employee),
      philhealthEmployer: Number(pl.philhealth_employer),
      pagibigEmployee: Number(pl.pagibig_employee),
      pagibigEmployer: Number(pl.pagibig_employer),
      withholdingTax: Number(pl.withholding_tax),
      totalDeductions: Number(pl.total_deductions),
      netPay: Number(pl.net_pay),
      thirteenthMonthAccrual: Number(pl.thirteenth_month_accrual || 0),
    }))

    const columns = [
      { key: "employeeCode", header: "Employee Code" },
      { key: "employeeName", header: "Employee Name" },
      { key: "position", header: "Position" },
      { key: "department", header: "Department" },
      { key: "basicPay", header: "Basic Pay" },
      { key: "allowances", header: "Allowances" },
      { key: "grossPay", header: "Gross Pay" },
      { key: "sssEmployee", header: "SSS (Employee)" },
      { key: "sssEmployer", header: "SSS (Employer)" },
      { key: "philhealthEmployee", header: "PhilHealth (Employee)" },
      { key: "philhealthEmployer", header: "PhilHealth (Employer)" },
      { key: "pagibigEmployee", header: "Pag-IBIG (Employee)" },
      { key: "pagibigEmployer", header: "Pag-IBIG (Employer)" },
      { key: "withholdingTax", header: "Withholding Tax" },
      { key: "totalDeductions", header: "Total Deductions" },
      { key: "netPay", header: "Net Pay" },
      { key: "thirteenthMonthAccrual", header: "13th Month Accrual" },
    ]

    const filename = `payroll_register_${payRun[0].run_number}`

    if (format === "csv") {
      const csv = generateCsv(rows, columns)
      return csvResponse(csv, filename)
    } else {
      const xlsx = generateXlsx(rows, columns, "Payroll Register")
      return xlsxResponse(xlsx, filename)
    }
  },
}
