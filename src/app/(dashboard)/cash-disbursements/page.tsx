import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { cashDisbursementsService } from "@/services/cash-disbursements.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function CashDisbursementsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "cash_disbursements", "read")) redirect("/dashboard")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const disbursements = await cashDisbursementsService.list(entity.schemaName)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cash Disbursements</h1>
        <Link href="/dashboard/cash-disbursements/new"><Button>New Disbursement</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">CV #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Payee</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-center p-3 font-medium">Posted</th>
            </tr>
          </thead>
          <tbody>
            {disbursements.length === 0 && <tr><td colSpan={8} className="text-center p-6 text-muted-foreground">No disbursements found.</td></tr>}
            {disbursements.map((d: any) => (
              <tr key={d.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{d.cv_number}</td>
                <td className="p-3">{new Date(d.cv_date).toLocaleDateString()}</td>
                <td className="p-3">{d.payee_name}</td>
                <td className="p-3 text-xs capitalize">{d.payee_type}</td>
                <td className="p-3 text-right font-mono">{Number(d.amount).toFixed(2)}</td>
                <td className="p-3 text-xs">{d.payment_method}</td>
                <td className="p-3 text-xs capitalize">{d.status || "draft"}</td>
                <td className="p-3 text-center">{d.journal_entry_id ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
