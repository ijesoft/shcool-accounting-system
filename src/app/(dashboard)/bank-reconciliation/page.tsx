import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    in_progress: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replace("_", " ")}
    </span>
  )
}

export default async function BankReconciliationPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "bank_reconciliation", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const reconciliations = await bankReconciliationService.list(entity.schemaName)

  function fmt(v: any) {
    return Number(v).toLocaleString("en-PH", { style: "currency", currency: "PHP" })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bank Reconciliation</h1>
        <Link href="/bank-reconciliation/new"><Button>New Reconciliation</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Bank Name</th>
                <th className="text-left p-3 font-medium">Statement Date</th>
                <th className="text-right p-3 font-medium">Statement Balance</th>
                <th className="text-right p-3 font-medium">Book Balance</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.length === 0 && (
                <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No reconciliations found.</td></tr>
              )}
              {reconciliations.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-muted/50">
                  <td className="p-3">
                    <Link href={`/bank-reconciliation/${r.id}`} className="text-blue-600 hover:underline">{r.bank_name}</Link>
                  </td>
                  <td className="p-3">{new Date(r.statement_date).toLocaleDateString()}</td>
                  <td className="p-3 text-right font-mono">{fmt(r.statement_ending_balance)}</td>
                  <td className="p-3 text-right font-mono">{fmt(r.book_ending_balance)}</td>
                  <td className="p-3">{statusBadge(r.status)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
