import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { budgetService } from "@/services/budget.service"
import { budgetEngine } from "@/lib/accounting/budget-engine"

async function getBudgetData(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return { entityName: "", fiscalYears: [], entitySchema: "" }

  const fiscalYears = await prisma.$queryRawUnsafe<any[]>(
    `SELECT fy.*, e.name as entity_name
     FROM public.fiscal_year fy
     JOIN public.entity e ON e.id = fy.entity_id
     WHERE e.id = $1
     ORDER BY fy.year DESC`,
    entityId
  )

  return { entityName: entity.name, fiscalYears, entitySchema: entity.schemaName }
}

export default async function BudgetVsActualPage({ searchParams }: { searchParams: { fy?: string } }) {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Budget vs Actual</h1>
        <p className="text-muted-foreground">Please select an entity to view budget vs actual.</p>
      </div>
    )
  }

  const { entityName, fiscalYears, entitySchema } = await getBudgetData(session.entityId)

  const fyFromParam = searchParams.fy
  const fyFromList = fiscalYears[0]?.id
  const fiscalYearId = fyFromParam || fyFromList

  let summary = null
  if (fiscalYearId) {
    try {
      summary = await budgetService.getBudgetSummary(entitySchema, fiscalYearId)
    } catch (e) {
      console.error("Budget summary error:", e)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Budget vs Actual</h1>
          <p className="text-sm text-muted-foreground">{entityName}</p>
        </div>
        <select
          className="rounded-md border px-3 py-2 text-sm bg-background"
          defaultValue={fiscalYearId}
          onChange={(e) => {
            const url = new URL(window.location.href)
            url.searchParams.set("fy", e.target.value)
            window.location.href = url.toString()
          }}
        >
          {fiscalYears.map((fy: any) => (
            <option key={fy.id} value={fy.id}>
              FY {fy.year}
            </option>
          ))}
        </select>
      </div>

      {summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Budgeted</p>
              <p className="text-2xl font-bold">
                {summary.totalBudgeted.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Actual</p>
              <p className="text-2xl font-bold">
                {summary.totalActual.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm text-muted-foreground">Total Variance</p>
              <p className={`text-2xl font-bold ${summary.totalVariance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {summary.totalVariance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Revenue Section */}
          {summary.revenueRows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Revenue</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">Account</th>
                      <th className="text-right p-3 font-medium">Budgeted</th>
                      <th className="text-right p-3 font-medium">Actual</th>
                      <th className="text-right p-3 font-medium">Variance</th>
                      <th className="text-right p-3 font-medium">% Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.revenueRows.map((row: any) => (
                      <tr key={row.accountCode} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-mono">{row.accountCode}</td>
                        <td className="p-3">{row.accountName}</td>
                        <td className="p-3 text-right">
                          {row.budgeted.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          {row.actual.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {row.variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right ${row.variancePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {row.variancePercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expense Section */}
          {summary.expenseRows.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Expenses</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Code</th>
                      <th className="text-left p-3 font-medium">Account</th>
                      <th className="text-right p-3 font-medium">Budgeted</th>
                      <th className="text-right p-3 font-medium">Actual</th>
                      <th className="text-right p-3 font-medium">Variance</th>
                      <th className="text-right p-3 font-medium">% Var</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.expenseRows.map((row: any) => (
                      <tr key={row.accountCode} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-mono">{row.accountCode}</td>
                        <td className="p-3">{row.accountName}</td>
                        <td className="p-3 text-right">
                          {row.budgeted.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          {row.actual.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right ${row.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {row.variance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`p-3 text-right ${row.variancePercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {row.variancePercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No budget data available. Set up a budget for the selected fiscal year.
        </div>
      )}
    </div>
  )
}
