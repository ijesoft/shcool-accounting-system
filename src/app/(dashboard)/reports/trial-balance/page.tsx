import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"
import { formatAmount } from "@/lib/utils"

async function getData(entityId: string, periodId?: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getTrialBalance(entity.schemaName, periodId)
}

export const dynamic = "force-dynamic"

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period } = await searchParams
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, period)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const q = period ? `period=${period}` : ""

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trial Balance</h1>
        <div className="flex gap-2 text-sm">
          <a href={`/api/v1/financial-reports/export/csv?format=csv&report=trial-balance&${q}`} className="text-blue-600 hover:underline">Download CSV</a>
          <a href={`/api/v1/financial-reports/export/csv?format=xlsx&report=trial-balance&${q}`} className="text-blue-600 hover:underline">Download XLSX</a>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Account Code</th>
                <th className="text-left p-3 font-medium">Account Name</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-right p-3 font-medium">Debits</th>
                <th className="text-right p-3 font-medium">Credits</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.length === 0 && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No data available.</td></tr>
              )}
              {data.accounts.map((account: any) => (
                <tr key={account.account_code} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">{account.account_code}</td>
                  <td className="p-3">{account.account_name}</td>
                  <td className="p-3 text-xs capitalize">{account.account_type}</td>
                  <td className="p-3 text-right font-mono">{formatAmount(Number(account.total_debits))}</td>
                  <td className="p-3 text-right font-mono">{formatAmount(Number(account.total_credits))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td colSpan={3} className="p-3 text-right">Totals</td>
                <td className="p-3 text-right font-mono">{formatAmount(Number(data.totalDebits))}</td>
                <td className="p-3 text-right font-mono">{formatAmount(Number(data.totalCredits))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className={`text-sm ${data.balanced ? "text-green-600" : "text-red-600"}`}>
        {data.balanced ? "✓ Trial balance is balanced." : "✗ Trial balance is NOT balanced."}
      </p>
    </div>
  )
}
