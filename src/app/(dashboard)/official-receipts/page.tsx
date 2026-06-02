import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { officialReceiptService } from "@/services/official-receipt.service"
import { SearchPagination } from "@/components/ui/search-pagination"
import { formatAmount } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function OfficialReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "official_receipts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sp = await searchParams
  const q = sp.q ?? ""
  const page = Number(sp.page) || 1

  const { rows, total } = await officialReceiptService.list(entity.schemaName, { q, page, limit: PAGE_SIZE })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Official Receipts</h1>
      <div className="rounded-lg border bg-card">
        <div className="px-4">
          <SearchPagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchValue={q}
            placeholder="Search by OR no., payor, status…"
          />
        </div>
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
                <td className="p-3 text-right font-mono">{formatAmount(Number(r.amount))}</td>
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
