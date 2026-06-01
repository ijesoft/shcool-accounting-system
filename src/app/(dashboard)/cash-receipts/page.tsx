import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { cashReceiptsService } from "@/services/cash-receipts.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function CashReceiptsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "cash_receipts", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const receipts = await cashReceiptsService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cash Receipts</h1>
        <Link href="/dashboard/cash-receipts/new"><Button>New Receipt</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Transaction #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Student</th>
              <th className="text-left p-3 font-medium">Invoice</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-center p-3 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No receipts found.</td></tr>}
            {receipts.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{r.transaction_number}</td>
                <td className="p-3">{new Date(r.payment_date).toLocaleDateString()}</td>
                <td className="p-3">{r.student_name || "—"}</td>
                <td className="p-3 text-xs">{r.invoice_number || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(r.amount).toFixed(2)}</td>
                <td className="p-3 text-xs">{r.payment_method}</td>
                <td className="p-3 text-center">{r.journal_entry_id ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
