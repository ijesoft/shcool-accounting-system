import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { revenueRecognitionService } from "@/services/revenue-recognition.service"
import { RunRecognitionButton } from "./run-recognition-button"

export const dynamic = "force-dynamic"

export default async function UnearnedTuitionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ asOf?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const asOf = params.asOf || new Date().toISOString().split("T")[0]
  const report = await revenueRecognitionService.getRollForward(entity.schemaName, asOf)
  const canRun = hasPermission(session.roleName, "journal_entries", "post")

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Reports
      </Link>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{report.reportTitle}</h1>
          <p className="text-sm text-muted-foreground">As of {asOf}</p>
        </div>
        {canRun && <RunRecognitionButton />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Opening Unearned", value: report.openingBalance },
          { label: "Billings Added", value: report.billingsAdded },
          { label: "Revenue Recognized", value: report.revenueRecognized },
          { label: "Closing Unearned", value: report.closingBalance },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-xl font-mono font-semibold">{Number(item.value).toFixed(2)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium">Invoice #</th>
              <th className="p-3 font-medium">Term</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium text-right">Tuition Billed</th>
              <th className="p-3 font-medium text-right">Recognized</th>
              <th className="p-3 font-medium text-right">Unearned Remaining</th>
            </tr>
          </thead>
          <tbody>
            {report.invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No tuition invoices found.
                </td>
              </tr>
            )}
            {report.invoices.map((row) => (
              <tr key={row.invoiceNumber} className="border-b">
                <td className="p-3 font-mono text-xs">{row.invoiceNumber}</td>
                <td className="p-3">{row.term || "—"}</td>
                <td className="p-3">{new Date(row.invoiceDate).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono">{row.tuitionBilled.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{row.recognized.toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{row.unearnedRemaining.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
