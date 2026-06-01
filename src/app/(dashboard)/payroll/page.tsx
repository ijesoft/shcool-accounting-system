import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

async function getPayrollData(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return { employees: [], payRuns: [], entityName: "" }

  const employees = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}".employee ORDER BY full_name`
  )

  const payRuns = await prisma.$queryRawUnsafe<any[]>(
    `SELECT pr.*, e.full_name as created_by_name
     FROM "${entity.schemaName}".payroll_run pr
     LEFT JOIN public."user" e ON e.id = pr.created_by
     ORDER BY pr.run_date DESC LIMIT 50`
  )

  return { employees, payRuns, entityName: entity.name }
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  posted: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
}

export default async function PayrollPage() {
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

  const { employees, payRuns, entityName } = await getPayrollData(session.entityId)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">{entityName}</p>
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
          <h2 className="text-lg font-semibold">Employees ({employees.length})</h2>
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
                    {Number(emp.basic_pay).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right">
                    {Number(emp.allowances || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
                    <div className="flex gap-1 justify-center">
                      <a href={`/api/v1/payroll-runs/${run.id}/register?format=csv`} className="text-blue-600 hover:underline text-xs">CSV</a>
                      <a href={`/api/v1/payroll-runs/${run.id}/register?format=xlsx`} className="text-blue-600 hover:underline text-xs">XLS</a>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${statusColors[run.status] || ""}`}>
                      {run.status}
                    </span>
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
