import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function OfficialReceiptsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "official_receipts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT or_.*, pt.transaction_number as payment_ref
     FROM "${entity.schemaName}".official_receipt or_
     LEFT JOIN "${entity.schemaName}".payment_transaction pt ON pt.id = or_.cash_receipt_id
     ORDER BY or_.created_at DESC LIMIT 100`
  )

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Official Receipts</h1>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">OR #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Payor</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Payment Ref</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No receipts found.</td></tr>}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">
                  <Link href={`/official-receipts/${r.id}`} className="text-blue-600 hover:underline">{r.or_number}</Link>
                </td>
                <td className="p-3">{new Date(r.or_date).toLocaleDateString()}</td>
                <td className="p-3">{r.payor_name || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(r.amount).toFixed(2)}</td>
                <td className="p-3 text-xs">{r.payment_ref || "—"}</td>
                <td className="p-3 text-xs capitalize">{r.status || "active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
