import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, from: string, to: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getIncomeStatement(entity.schemaName, from, to)
}

export const dynamic = "force-dynamic"

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const from = params.from || `${now.getFullYear()}-01-01`
  const to = params.to || now.toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, from, to)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const totalRevenue = data
    .filter((r: any) => r.account_type === "revenue")
    .reduce((s: number, r: any) => s + Number(r.balance), 0)
  const totalExpenses = data
    .filter((r: any) => r.account_type === "expense")
    .reduce((s: number, r: any) => s + Math.abs(Number(r.balance)), 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Statement</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=income-statement&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=income-statement&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Account</th>
                <th className="text-right p-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr><td colSpan={2} className="text-center p-6 text-muted-foreground">No data for this period.</td></tr>
              )}
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Revenue</td>
              </tr>
              {data.filter((r: any) => r.account_type === "revenue").map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{Number(row.balance).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Revenue</td>
                <td className="p-3 text-right font-mono">{totalRevenue.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Expenses</td>
              </tr>
              {data.filter((r: any) => r.account_type === "expense").map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{Math.abs(Number(row.balance)).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Expenses</td>
                <td className="p-3 text-right font-mono">{totalExpenses.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Net Income (Loss)</td>
                <td className={`p-3 text-right font-mono ${netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {netIncome.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
