import { prisma } from "@/lib/db"
import { payrollEngine } from "@/lib/accounting/payroll-engine"
import { postingEngine } from "@/lib/accounting/posting-engine"
import { journalEntryRepository } from "@/repositories/journal-entry.repository"
import { auditLog } from "@/lib/audit/audit-log"

export const payrollService = {
  // --- Employee CRUD ---

  async listEmployees(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".employee ORDER BY full_name`
    )
  },

  async createEmployee(entitySchema: string, userId: string, data: {
    employeeCode: string; fullName: string; position?: string; department?: string
    tin?: string; sssNumber?: string; philhealthNumber?: string; pagibigNumber?: string
    basicPay: number; allowances?: number; hireDate?: string
  }) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".employee
       (employee_code, full_name, position, department, tin, sss_number, philhealth_number, pagibig_number,
        basic_pay, allowances, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      data.employeeCode, data.fullName, data.position || null, data.department || null,
      data.tin || null, data.sssNumber || null, data.philhealthNumber || null, data.pagibigNumber || null,
      data.basicPay, data.allowances || 0, data.hireDate ? new Date(data.hireDate) : null
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "create",
      tableName: "employee",
      recordId: rows[0].id,
      newValues: { employeeCode: data.employeeCode, fullName: data.fullName, basicPay: data.basicPay },
    })

    return rows[0]
  },

  async updateEmployee(entitySchema: string, userId: string, employeeId: string, data: {
    fullName?: string; position?: string; department?: string
    tin?: string; sssNumber?: string; philhealthNumber?: string; pagibigNumber?: string
    basicPay?: number; allowances?: number; hireDate?: string; isActive?: boolean
  }) {
    const sets: string[] = []
    const values: any[] = []
    let idx = 1

    if (data.fullName !== undefined) { sets.push(`full_name = $${idx++}`); values.push(data.fullName) }
    if (data.position !== undefined) { sets.push(`position = $${idx++}`); values.push(data.position || null) }
    if (data.department !== undefined) { sets.push(`department = $${idx++}`); values.push(data.department || null) }
    if (data.tin !== undefined) { sets.push(`tin = $${idx++}`); values.push(data.tin || null) }
    if (data.sssNumber !== undefined) { sets.push(`sss_number = $${idx++}`); values.push(data.sssNumber || null) }
    if (data.philhealthNumber !== undefined) { sets.push(`philhealth_number = $${idx++}`); values.push(data.philhealthNumber || null) }
    if (data.pagibigNumber !== undefined) { sets.push(`pagibig_number = $${idx++}`); values.push(data.pagibigNumber || null) }
    if (data.basicPay !== undefined) { sets.push(`basic_pay = $${idx++}`); values.push(data.basicPay) }
    if (data.allowances !== undefined) { sets.push(`allowances = $${idx++}`); values.push(data.allowances || 0) }
    if (data.hireDate !== undefined) { sets.push(`hire_date = $${idx++}`); values.push(data.hireDate ? new Date(data.hireDate) : null) }
    if (data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); values.push(data.isActive) }

    if (sets.length === 0) return this.getEmployeeById(entitySchema, employeeId)

    sets.push(`updated_at = NOW()`)
    values.push(employeeId)

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "${entitySchema}".employee SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      ...values
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "update",
      tableName: "employee",
      recordId: employeeId,
      newValues: data,
    })

    return rows[0] || null
  },

  async getEmployeeById(entitySchema: string, employeeId: string) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".employee WHERE id = $1`,
      employeeId
    )
    return rows[0] || null
  },

  // --- Payroll Run ---

  async listPayRuns(entitySchema: string) {
    return prisma.$queryRawUnsafe<any[]>(
      `SELECT pr.*, e.full_name as created_by_name
       FROM "${entitySchema}".payroll_run pr
       LEFT JOIN public."user" e ON e.id = pr.created_by
       ORDER BY pr.run_date DESC`
    )
  },

  async getPayRun(entitySchema: string, payRunId: string) {
    const runs = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "${entitySchema}".payroll_run WHERE id = $1`,
      payRunId
    )
    if (!runs[0]) return null

    const lines = await prisma.$queryRawUnsafe<any[]>(
      `SELECT prl.*, e.full_name as employee_name, e.employee_code
       FROM "${entitySchema}".payroll_run_line prl
       JOIN "${entitySchema}".employee e ON e.id = prl.employee_id
       WHERE prl.payroll_run_id = $1`,
      payRunId
    )

    return { ...runs[0], lines }
  },

  async createPayRun(entitySchema: string, userId: string, data: {
    runDate: string; payPeriodStart: string; payPeriodEnd: string
  }) {
    const runNumber = await prisma.$queryRawUnsafe<string[]>(
      `SELECT CONCAT(prefix, '-', LPAD(CAST(next_number AS TEXT), 5, '0'))
       FROM "${entitySchema}".number_series WHERE series_type = 'PR' LIMIT 1`
    )

    if (!runNumber[0]) {
      throw new Error("Number series 'PR' not found. Run db:seed to initialize.")
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "${entitySchema}".payroll_run
       (run_number, run_date, pay_period_start, pay_period_end, status, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5)
       RETURNING *`,
      runNumber[0], new Date(data.runDate), new Date(data.payPeriodStart),
      new Date(data.payPeriodEnd), userId
    )

    // Generate lines for all active employees
    const payLines = await payrollEngine.generatePayRunLines(
      entitySchema, data.payPeriodStart, data.payPeriodEnd
    )

    for (const { employeeId, calc } of payLines) {
      await prisma.$queryRawUnsafe(
        `INSERT INTO "${entitySchema}".payroll_run_line
         (payroll_run_id, employee_id, basic_pay, allowances, gross_pay,
          sss_employee, sss_employer, philhealth_employee, philhealth_employer,
          pagibig_employee, pagibig_employer, withholding_tax,
          total_deductions, net_pay, thirteenth_month_accrual)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        rows[0].id, employeeId,
        calc.basicPay, calc.allowances, calc.grossPay,
        calc.sssEmployee, calc.sssEmployer,
        calc.philhealthEmployee, calc.philhealthEmployer,
        calc.pagibigEmployee, calc.pagibigEmployer,
        calc.withholdingTax, calc.totalDeductions, calc.netPay,
        calc.thirteenthMonthAccrual
      )
    }

    // Update totals
    const totals = payLines.reduce((acc, { calc }) => ({
      grossPay: acc.grossPay + calc.grossPay,
      deductions: acc.deductions + calc.totalDeductions,
      netPay: acc.netPay + calc.netPay,
    }), { grossPay: 0, deductions: 0, netPay: 0 })

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payroll_run
       SET total_gross_pay = $1, total_deductions = $2, total_net_pay = $3, updated_at = NOW()
       WHERE id = $4`,
      totals.grossPay, totals.deductions, totals.netPay, rows[0].id
    )

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".number_series SET next_number = next_number + 1 WHERE series_type = 'PR'`
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "create",
      tableName: "payroll_run",
      recordId: rows[0].id,
      newValues: { runNumber: runNumber[0], runDate: data.runDate, employeeCount: payLines.length },
    })

    return this.getPayRun(entitySchema, rows[0].id)
  },

  async postPayRun(entitySchema: string, userId: string, payRunId: string) {
    const payRun = await this.getPayRun(entitySchema, payRunId)
    if (!payRun) throw new Error("Payroll run not found")
    if (payRun.status !== "draft") throw new Error("Only draft pay runs can be posted")
    if (!payRun.lines?.length) throw new Error("No payroll lines to post")

    // Build journal entry lines
    const jeLines = await payrollEngine.buildJournalEntryLines(entitySchema, payRun.lines)

    // Create journal entry
    const entry = await journalEntryRepository.create(entitySchema, {
      entryDate: payRun.run_date.toISOString().split("T")[0],
      reference: payRun.run_number,
      sourceModule: "PAYROLL",
      description: `Payroll run: ${payRun.run_number} (${payRun.pay_period_start} to ${payRun.pay_period_end})`,
      createdBy: userId,
      lines: jeLines,
    })

    // Post the journal entry
    const postResult = await postingEngine.post(
      entitySchema,
      entry!.id,
      userId,
      entry!.entry_date.toISOString().split("T")[0],
      entry!.lines.map((l: any) => ({ accountId: l.account_id, debit: Number(l.debit), credit: Number(l.credit) }))
    )

    if (!postResult.success) {
      throw new Error(`Posting failed: ${postResult.errors.map(e => e.message).join(", ")}`)
    }

    // Update pay run
    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payroll_run
       SET status = 'posted', journal_entry_id = $1, updated_at = NOW()
       WHERE id = $2`,
      entry!.id, payRunId
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "post",
      tableName: "payroll_run",
      recordId: payRunId,
      newValues: { runNumber: payRun.run_number, journalEntryId: entry!.id },
    })

    return this.getPayRun(entitySchema, payRunId)
  },

  async voidPayRun(entitySchema: string, userId: string, payRunId: string) {
    const payRun = await this.getPayRun(entitySchema, payRunId)
    if (!payRun) throw new Error("Payroll run not found")
    if (payRun.status !== "posted") throw new Error("Only posted pay runs can be voided")

    await prisma.$queryRawUnsafe(
      `UPDATE "${entitySchema}".payroll_run SET status = 'void', updated_at = NOW() WHERE id = $1`,
      payRunId
    )

    await auditLog.record({
      entityId: (await prisma.entity.findUnique({ where: { schemaName: entitySchema } }))!.id,
      userId,
      action: "void",
      tableName: "payroll_run",
      recordId: payRunId,
      newValues: { runNumber: payRun.run_number },
    })

    return this.getPayRun(entitySchema, payRunId)
  },
}
