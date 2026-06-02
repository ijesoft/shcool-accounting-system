import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"
import { formatAmount } from "@/lib/utils"

async function getData(entityId: string, from: string, to: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getChangesInEquity(entity.schemaName, from, to)
}

export const dynamic = "force-dynamic"

export default async function ChangesInEquityPage({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statement of Changes in Equity</h1>
          <p className="text-sm text-muted-foreground">
            For the period {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=changes-in-equity&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=changes-in-equity&from=${from}&to=${to}`} className="text-blue-600 hover:underline">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold text-muted-foreground">Account Category</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Beginning Balance</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Net Income (Loss)</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Other Changes</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Ending Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4 font-medium text-foreground">{row.account_name} ({row.account_code})</td>
                  <td className="p-4 text-right font-mono">{formatAmount(row.beginningBalance)}</td>
                  <td className="p-4 text-right font-mono text-emerald-600">{row.netIncome !== 0 ? formatAmount(row.netIncome) : "—"}</td>
                  <td className="p-4 text-right font-mono">{row.otherChanges !== 0 ? formatAmount(row.otherChanges) : "—"}</td>
                  <td className="p-4 text-right font-mono font-semibold">{formatAmount(row.endingBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-bold text-base border-t-2">
                <td className="p-4">Total Equity</td>
                <td className="p-4 text-right font-mono">{formatAmount(data.totals.beginningBalance)}</td>
                <td className="p-4 text-right font-mono text-emerald-600">{formatAmount(data.totals.netIncome)}</td>
                <td className="p-4 text-right font-mono">{formatAmount(data.totals.otherChanges)}</td>
                <td className="p-4 text-right font-mono text-blue-600">{formatAmount(data.totals.endingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
