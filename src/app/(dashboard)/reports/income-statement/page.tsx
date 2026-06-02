import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { formatAmount } from "@/lib/utils"

async function getData(entityId: string, from: string, to: string, comparative: boolean) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getIncomeStatement(entity.schemaName, from, to, comparative)
}

export const dynamic = "force-dynamic"

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; comparative?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const from = params.from || `${now.getFullYear()}-01-01`
  const to = params.to || now.toISOString().split("T")[0]
  const comparative = params.comparative === "true"

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, from, to, comparative)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const currentRevenue = data.current
    .filter((r: any) => r.account_type === "revenue")
    .reduce((s: number, r: any) => s + Number(r.balance), 0)
  const currentExpenses = data.current
    .filter((r: any) => r.account_type === "expense")
    .reduce((s: number, r: any) => s + Math.abs(Number(r.balance)), 0)
  const currentNetIncome = currentRevenue - currentExpenses

  let compRevenue = 0
  let compExpenses = 0
  let compNetIncome = 0

  if (comparative && data.comparative) {
    compRevenue = data.comparative
      .filter((r: any) => r.account_type === "revenue")
      .reduce((s: number, r: any) => s + Number(r.balance), 0)
    compExpenses = data.comparative
      .filter((r: any) => r.account_type === "expense")
      .reduce((s: number, r: any) => s + Math.abs(Number(r.balance)), 0)
    compNetIncome = compRevenue - compExpenses
  }

  const getCompRow = (code: string) => {
    if (!comparative || !data.comparative) return null
    return data.comparative.find((r: any) => r.account_code === code)
  }

  const parts = from.split('-')
  const priorYearFrom = parts.length === 3 ? `${parseInt(parts[0], 10) - 1}-01-01` : ""
  const priorYearTo = parts.length === 3 ? `${parseInt(parts[0], 10) - 1}-12-31` : ""

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{data.reportTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
            {comparative && ` (Comparative Prior Year: ${new Date(priorYearFrom).toLocaleDateString()} — ${new Date(priorYearTo).toLocaleDateString()})`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <Link
            href={`/reports/income-statement?from=${from}&to=${to}&comparative=${comparative ? "false" : "true"}`}
            className="rounded-md border bg-background px-3 py-1.5 font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            {comparative ? "Hide Comparative" : "Show Comparative"}
          </Link>
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=income-statement&from=${from}&to=${to}&comparative=${comparative}`} className="text-blue-600 hover:underline px-2">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=income-statement&from=${from}&to=${to}&comparative=${comparative}`} className="text-blue-600 hover:underline px-2">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-semibold text-muted-foreground">Account Description</th>
                <th className="text-right p-4 font-semibold text-muted-foreground">Current Period</th>
                {comparative && (
                  <th className="text-right p-4 font-semibold text-muted-foreground">Prior Year Period</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.current.length === 0 && (
                <tr>
                  <td colSpan={comparative ? 3 : 2} className="text-center p-6 text-muted-foreground">
                    No data for this period.
                  </td>
                </tr>
              )}
              <tr className="border-b bg-muted/30">
                <td className="p-4 font-bold text-foreground" colSpan={comparative ? 3 : 2}>Revenue</td>
              </tr>
              {data.current.filter((r: any) => r.account_type === "revenue").map((row: any) => {
                const compRow = getCompRow(row.account_code)
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4 pl-8 text-foreground">{row.account_name} ({row.account_code})</td>
                    <td className="p-4 text-right font-mono">{formatAmount(Number(row.balance))}</td>
                    {comparative && (
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        {compRow ? formatAmount(Number(compRow.balance)) : "0.00"}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="border-b font-semibold bg-muted/10">
                <td className="p-4 pl-8">Total Revenue</td>
                <td className="p-4 text-right font-mono">{formatAmount(currentRevenue)}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatAmount(compRevenue)}</td>
                )}
              </tr>

              <tr className="border-b bg-muted/30">
                <td className="p-4 font-bold text-foreground" colSpan={comparative ? 3 : 2}>Expenses</td>
              </tr>
              {data.current.filter((r: any) => r.account_type === "expense").map((row: any) => {
                const compRow = getCompRow(row.account_code)
                return (
                  <tr key={row.account_code} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-4 pl-8 text-foreground">{row.account_name} ({row.account_code})</td>
                    <td className="p-4 text-right font-mono">{formatAmount(Math.abs(Number(row.balance)), { sign: "never" })}</td>
                    {comparative && (
                      <td className="p-4 text-right font-mono text-muted-foreground">
                        {compRow ? formatAmount(Math.abs(Number(compRow.balance)), { sign: "never" }) : "0.00"}
                      </td>
                    )}
                  </tr>
                )
              })}
              <tr className="border-b font-semibold bg-muted/10">
                <td className="p-4 pl-8">Total Expenses</td>
                <td className="p-4 text-right font-mono">{formatAmount(currentExpenses)}</td>
                {comparative && (
                  <td className="p-4 text-right font-mono text-muted-foreground">{formatAmount(compExpenses)}</td>
                )}
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold text-base bg-muted/20">
                <td className="p-4">Net Income (Loss)</td>
                <td className={`p-4 text-right font-mono ${currentNetIncome >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatAmount(currentNetIncome)}
                </td>
                {comparative && (
                  <td className={`p-4 text-right font-mono ${compNetIncome >= 0 ? "text-emerald-600/70" : "text-red-600/70"}`}>
                    {formatAmount(compNetIncome)}
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
