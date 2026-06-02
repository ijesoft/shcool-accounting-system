import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { maskSalary, formatCurrency } from "@/lib/utils/mask"
import { payrollService } from "@/services/payroll.service"
import { SearchPagination } from "@/components/ui/search-pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  posted: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ q_emp?: string; page_emp?: string; q_run?: string; page_run?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Payroll</h1>
        <p className="text-muted-foreground">Please select an entity to view payroll.</p>
      </div>
    )
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sp = await searchParams
  const qEmp = sp.q_emp ?? ""
  const pageEmp = Number(sp.page_emp) || 1
  const qRun = sp.q_run ?? ""
  const pageRun = Number(sp.page_run) || 1

  const [{ rows: employees, total: totalEmp }, { rows: payRuns, total: totalRuns }] = await Promise.all([
    payrollService.listEmployees(entity.schemaName, { q: qEmp, page: pageEmp, limit: PAGE_SIZE }),
    payrollService.listPayRuns(entity.schemaName, { q: qRun, page: pageRun, limit: PAGE_SIZE }),
  ])

  const isAdmin = ["super_admin", "admin", "finance_manager"].includes(session.roleName)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">{entity.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/payroll/employees/new">
            <Button variant="outline">Add Employee</Button>
          </Link>
          <Link href="/payroll/runs/new">
            <Button>New Pay Run</Button>
          </Link>
        </div>
      </div>

      {/* Employees */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Employees ({totalEmp})</h2>
        </div>
        <div className="px-4">
          <SearchPagination
            totalCount={totalEmp}
            currentPage={pageEmp}
            pageSize={PAGE_SIZE}
            searchValue={qEmp}
            placeholder="Search employees…"
            qParam="q_emp"
            pageParam="page_emp"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Position</th>
                <th className="text-left p-3 font-medium">Department</th>
                <th className="text-right p-3 font-medium">Basic Pay</th>
                <th className="text-right p-3 font-medium">Allowances</th>
                <th className="text-center p-3 font-medium">Active</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-muted-foreground">
                    No employees yet. Add your first employee.
                  </td>
                </tr>
              )}
              {employees.map((emp: any) => (
                <tr key={emp.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono">{emp.employee_code}</td>
                  <td className="p-3">{emp.full_name}</td>
                  <td className="p-3">{emp.position || "-"}</td>
                  <td className="p-3">{emp.department || "-"}</td>
                  <td className="p-3 text-right">
                    {isAdmin ? formatCurrency(Number(emp.basic_pay)) : maskSalary(Number(emp.basic_pay))}
                  </td>
                  <td className="p-3 text-right">
                    {isAdmin ? formatCurrency(Number(emp.allowances || 0)) : maskSalary(Number(emp.allowances || 0))}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${emp.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {emp.is_active ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Runs */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Pay Runs</h2>
        </div>
        <div className="px-4">
          <SearchPagination
            totalCount={totalRuns}
            currentPage={pageRun}
            pageSize={PAGE_SIZE}
            searchValue={qRun}
            placeholder="Search payroll runs…"
            qParam="q_run"
            pageParam="page_run"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Run #</th>
                <th className="text-left p-3 font-medium">Run Date</th>
                <th className="text-left p-3 font-medium">Period</th>
                <th className="text-right p-3 font-medium">Gross Pay</th>
                <th className="text-right p-3 font-medium">Deductions</th>
                <th className="text-right p-3 font-medium">Net Pay</th>
                <th className="text-center p-3 font-medium">Status</th>
                <th className="text-center p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payRuns.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center p-6 text-muted-foreground">
                    No pay runs yet. Create your first pay run.
                  </td>
                </tr>
              )}
              {payRuns.map((run: any) => (
                <tr key={run.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono">{run.run_number}</td>
                  <td className="p-3">
                    {run.run_date instanceof Date ? run.run_date.toLocaleDateString("en-PH") : run.run_date}
                  </td>
                  <td className="p-3">
                    {run.pay_period_start instanceof Date ? run.pay_period_start.toLocaleDateString("en-PH") : run.pay_period_start}{" "}
                    to{" "}
                    {run.pay_period_end instanceof Date ? run.pay_period_end.toLocaleDateString("en-PH") : run.pay_period_end}
                  </td>
                  <td className="p-3 text-right">
                    {Number(run.total_gross_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right">
                    {Number(run.total_deductions).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {Number(run.total_net_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${statusColors[run.status] || ""}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <a href={`/api/v1/payroll-runs/${run.id}/register?format=csv`} className="text-blue-600 hover:underline text-xs">CSV</a>
                      <a href={`/api/v1/payroll-runs/${run.id}/register?format=xlsx`} className="text-blue-600 hover:underline text-xs">XLS</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
