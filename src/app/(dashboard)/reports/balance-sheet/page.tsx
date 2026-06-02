import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { formatAmount } from "@/lib/utils"

async function getData(entityId: string, asOf: string, comparative: boolean) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getBalanceSheet(entity.schemaName, asOf, comparative)
}

function calcBalance(row: any): number {
  const net = Number(row.total_debits) - Number(row.total_credits)
  return row.normal_balance === "credit" ? -net : net
}

export const dynamic = "force-dynamic"

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string; comparative?: string }>
}) {
  const params = await searchParams
  const asOf = params.as_of || new Date().toISOString().split("T")[0]
  const comparative = params.comparative === "true"

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, asOf, comparative)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const currentAssets = data.current.filter((r: any) => r.account_type === "asset" || r.account_type === "contra_asset")
  const currentLiabilities = data.current.filter((r: any) => r.account_type === "liability" || r.account_type === "contra_liability")
  const currentEquity = data.current.filter((r: any) => r.account_type === "equity")

  const totalAssets = currentAssets.reduce((s: number, r: any) => s + calcBalance(r), 0)
  const totalLiabilities = currentLiabilities.reduce((s: number, r: any) => s + calcBalance(r), 0)
  const totalEquity = currentEquity.reduce((s: number, r: any) => s + calcBalance(r), 0)

  let compAssets: any[] = []
  let compLiabilities: any[] = []
  let compEquity: any[] = []
  let totalCompAssets = 0
  let totalCompLiabilities = 0
  let totalCompEquity = 0

  if (comparative && data.comparative) {
    compAssets = data.comparative.filter((r: any) => r.account_type === "asset" || r.account_type === "contra_asset")
    compLiabilities = data.comparative.filter((r: any) => r.account_type === "liability" || r.account_type === "contra_liability")
    compEquity = data.comparative.filter((r: any) => r.account_type === "equity")

    totalCompAssets = compAssets.reduce((s: number, r: any) => s + calcBalance(r), 0)
    totalCompLiabilities = compLiabilities.reduce((s: number, r: any) => s + calcBalance(r), 0)
    totalCompEquity = compEquity.reduce((s: number, r: any) => s + calcBalance(r), 0)
  }

  const getCompRow = (code: string, category: "asset" | "liability" | "equity") => {
    if (!comparative || !data.comparative) return null
    const list = category === "asset" ? compAssets : category === "liability" ? compLiabilities : compEquity
    return list.find((r: any) => r.account_code === code)
  }

  const parts = asOf.split('-')
  const priorYearAsOf = parts.length === 3 ? `${parseInt(parts[0], 10) - 1}-${parts[1]}-${parts[2]}` : ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.reportTitle}</h1>
          <p className="text-sm text-muted-foreground">
            As of {new Date(asOf).toLocaleDateString()}
            {comparative && ` (Comparative Prior Year: As of ${new Date(priorYearAsOf).toLocaleDateString()})`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <Link
            href={`/reports/balance-sheet?as_of=${asOf}&comparative=${comparative ? "false" : "true"}`}
            className="rounded-md border bg-background px-3 py-1.5 font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            {comparative ? "Hide Comparative" : "Show Comparative"}
          </Link>
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=balance-sheet&as_of=${asOf}&comparative=${comparative}`} className="text-blue-600 hover:underline px-2">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=balance-sheet&as_of=${asOf}&comparative=${comparative}`} className="text-blue-600 hover:underline px-2">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold text-muted-foreground">Account Description</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Current Balance</th>
                {comparative && (
                  <th className="text-right p-4 font-semibold text-muted-foreground">Prior Year Balance</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.current.length === 0 && (
                <tr>
                  <td colSpan={comparative ? 3 : 2} className="text-center p-6 text-muted-foreground">
                    No data available.
                  </td>
                </tr>
              )}
              
              {/* Assets Section */}
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-bold text-foreground" colSpan={comparative ? 3 : 2}>Assets</td>
              </tr>
              {currentAssets.map((row: any) => {
                const compRow = getCompRow(row.account_code, "asset")
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4 pl-8 text-foreground">{row.account_name} ({row.account_code})</td>
                    <td className="p-4 text-right font-mono">{formatAmount(calcBalance(row))}</td>
                    {comparative && (
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        {compRow ? formatAmount(calcBalance(compRow)) : "0.00"}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="border-b font-semibold bg-muted/10">
                <td className="p-4 pl-8">Total Assets</td>
                <td className="p-4 text-right font-mono">{formatAmount(totalAssets)}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatAmount(totalCompAssets)}</td>
                )}
              </tr>

              {/* Liabilities Section */}
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-bold text-foreground" colSpan={comparative ? 3 : 2}>Liabilities</td>
              </tr>
              {currentLiabilities.map((row: any) => {
                const compRow = getCompRow(row.account_code, "liability")
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4 pl-8 text-foreground">{row.account_name} ({row.account_code})</td>
                    <td className="p-4 text-right font-mono">{formatAmount(calcBalance(row))}</td>
                    {comparative && (
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        {compRow ? formatAmount(calcBalance(compRow)) : "0.00"}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="border-b font-semibold bg-muted/10">
                <td className="p-4 pl-8">Total Liabilities</td>
                <td className="p-4 text-right font-mono">{formatAmount(totalLiabilities)}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatAmount(totalCompLiabilities)}</td>
                )}
              </tr>

              {/* Equity Section */}
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-bold text-foreground" colSpan={comparative ? 3 : 2}>Equity</td>
              </tr>
              {currentEquity.map((row: any) => {
                const compRow = getCompRow(row.account_code, "equity")
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4 pl-8 text-foreground">{row.account_name} ({row.account_code})</td>
                    <td className="p-4 text-right font-mono">{formatAmount(calcBalance(row))}</td>
                    {comparative && (
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        {compRow ? formatAmount(calcBalance(compRow)) : "0.00"}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="border-b font-semibold bg-muted/10">
                <td className="p-4 pl-8">Total Equity</td>
                <td className="p-4 text-right font-mono">{formatAmount(totalEquity)}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatAmount(totalCompEquity)}</td>
                )}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold text-base bg-muted/20">
                <td className="p-4">Total Liabilities & Equity</td>
                <td className="p-4 text-right font-mono">{(totalLiabilities + formatAmount(totalEquity))}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">
                    {(totalCompLiabilities + formatAmount(totalCompEquity))}
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
