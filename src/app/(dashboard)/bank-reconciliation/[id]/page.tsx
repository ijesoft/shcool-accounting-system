import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { bankReconciliationService } from "@/services/bank-reconciliation.service"
import { prisma } from "@/lib/db"
import { ReconciliationActions } from "./actions"

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

function fmt(v: any) {
  return Number(v).toLocaleString("en-PH", { style: "currency", currency: "PHP" })
}

export default async function BankReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "bank_reconciliation", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const rec = await bankReconciliationService.getById(entity.schemaName, id)
  if (!rec) return <p className="p-6 text-muted-foreground">Reconciliation not found.</p>

  const difference = Number(rec.statement_ending_balance) - Number(rec.book_ending_balance)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{rec.bank_name}</h1>
          {statusBadge(rec.status)}
        </div>
        <ReconciliationActions reconciliationId={rec.id} status={rec.status} />
      </div>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Summary</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Bank Name</p>
            <p className="font-medium">{rec.bank_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Account Number</p>
            <p className="font-mono">{rec.account_number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Statement Date</p>
            <p>{new Date(rec.statement_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="capitalize">{rec.status.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Statement Ending Balance</p>
            <p className="font-mono">{fmt(rec.statement_ending_balance)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Book Ending Balance</p>
            <p className="font-mono">{fmt(rec.book_ending_balance)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Difference</p>
            <p className={`font-mono ${difference === 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(Math.abs(difference))} {difference < 0 ? "(overstated)" : difference > 0 ? "(understated)" : ""}
            </p>
          </div>
          {rec.completed_at && (
            <div>
              <p className="text-sm text-muted-foreground">Completed At</p>
              <p>{new Date(rec.completed_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Reconciliation Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium">Cleared</th>
                <th className="text-left p-3 font-medium">JE #</th>
              </tr>
            </thead>
            <tbody>
              {(!rec.items || rec.items.length === 0) && (
                <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No items yet.</td></tr>
              )}
              {(rec.items || []).map((i: any) => (
                <tr key={i.id} className="border-b">
                  <td className="p-3 text-xs capitalize">{i.type.replace(/_/g, " ")}</td>
                  <td className="p-3 text-xs font-mono">{i.reference || "—"}</td>
                  <td className="p-3 text-right font-mono">{fmt(i.amount)}</td>
                  <td className="p-3">
                    {i.is_cleared
                      ? <span className="text-green-600 text-xs font-medium">Yes</span>
                      : <span className="text-gray-400 text-xs">No</span>}
                  </td>
                  <td className="p-3 text-xs font-mono">{i.journal_entry_id ? i.journal_entry_id.slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
