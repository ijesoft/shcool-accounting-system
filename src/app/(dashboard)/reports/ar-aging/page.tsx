import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { revenueRecognitionService } from "@/services/revenue-recognition.service"

export const dynamic = "force-dynamic"

export default async function ArAgingReportPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const rows = await revenueRecognitionService.getArAging(entity.schemaName)
  const totals = rows.reduce(
    (acc, row: any) => ({
      current: acc.current + Number(row.current),
      days_1_30: acc.days_1_30 + Number(row.days_1_30),
      days_31_60: acc.days_31_60 + Number(row.days_31_60),
      days_61_90: acc.days_61_90 + Number(row.days_61_90),
      days_91_plus: acc.days_91_plus + Number(row.days_91_plus),
      total_balance: acc.total_balance + Number(row.total_balance),
    }),
    {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_91_plus: 0,
      total_balance: 0,
    }
  )

  const exportBase = `/api/v1/financial-reports/export/ar-aging?report=ar-aging&format=csv`

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Reports
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Accounts Receivable Aging</h1>
          <p className="text-sm text-muted-foreground">Student receivables by aging bucket</p>
        </div>
        {hasPermission(session.roleName, "reports", "export") && (
          <a href={exportBase} className="text-sm text-blue-600 hover:underline">
            Export CSV
          </a>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium">Student #</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium text-right">Current</th>
              <th className="p-3 font-medium text-right">1–30</th>
              <th className="p-3 font-medium text-right">31–60</th>
              <th className="p-3 font-medium text-right">61–90</th>
              <th className="p-3 font-medium text-right">91+</th>
              <th className="p-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No outstanding receivables.
                </td>
              </tr>
            )}
            {rows.map((row: any) => (
              <tr key={row.id} className="border-b">
                <td className="p-3 font-mono text-xs">
                  <Link href={`/student-accounts/${row.id}`} className="text-blue-600 hover:underline">
                    {row.student_number}
                  </Link>
                </td>
                <td className="p-3">{row.full_name}</td>
                <td className="p-3 text-right font-mono">{Number(row.current).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(row.days_1_30).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(row.days_31_60).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(row.days_61_90).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(row.days_91_plus).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(row.total_balance).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="font-medium border-t bg-muted/30">
                <td colSpan={2} className="p-3 text-right">Totals</td>
                <td className="p-3 text-right font-mono">{totals.current.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{totals.days_1_30.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{totals.days_31_60.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{totals.days_61_90.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{totals.days_91_plus.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{totals.total_balance.toFixed(2)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
