import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, asOf: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getBalanceSheet(entity.schemaName, asOf)
}

function calcBalance(row: any): number {
  const net = Number(row.total_debits) - Number(row.total_credits)
  return row.normal_balance === "credit" ? -net : net
}

export const dynamic = "force-dynamic"

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>
}) {
  const { as_of } = await searchParams
  const asOf = as_of || new Date().toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, asOf)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const assets = data.filter((r: any) => r.account_type === "asset" || r.account_type === "contra_asset")
  const liabilities = data.filter((r: any) => r.account_type === "liability" || r.account_type === "contra_liability")
  const equity = data.filter((r: any) => r.account_type === "equity")

  const totalAssets = assets.reduce((s: number, r: any) => s + calcBalance(r), 0)
  const totalLiabilities = liabilities.reduce((s: number, r: any) => s + calcBalance(r), 0)
  const totalEquity = equity.reduce((s: number, r: any) => s + calcBalance(r), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-sm text-muted-foreground">As of {new Date(asOf).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=balance-sheet&as_of=${asOf}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=balance-sheet&as_of=${asOf}`} className="text-blue-600 hover:underline">Download XLSX</a>
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
                <tr><td colSpan={2} className="text-center p-6 text-muted-foreground">No data available.</td></tr>
              )}
              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Assets</td>
              </tr>
              {assets.map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{calcBalance(row).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Assets</td>
                <td className="p-3 text-right font-mono">{totalAssets.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Liabilities</td>
              </tr>
              {liabilities.map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{calcBalance(row).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Liabilities</td>
                <td className="p-3 text-right font-mono">{totalLiabilities.toFixed(2)}</td>
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-3 font-bold" colSpan={2}>Equity</td>
              </tr>
              {equity.map((row: any) => (
                <tr key={row.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 pl-8">{row.account_name}</td>
                  <td className="p-3 text-right font-mono">{calcBalance(row).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="border-b font-medium">
                <td className="p-3 pl-8">Total Equity</td>
                <td className="p-3 text-right font-mono">{totalEquity.toFixed(2)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Total Liabilities & Equity</td>
                <td className="p-3 text-right font-mono">{(totalLiabilities + totalEquity).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
