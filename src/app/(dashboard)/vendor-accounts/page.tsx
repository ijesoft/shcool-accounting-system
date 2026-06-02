import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { vendorAccountService } from "@/services/vendor-account.service"
import { prisma } from "@/lib/db"
import { SearchPagination } from "@/components/ui/search-pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function VendorAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "vendor_accounts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sp = await searchParams
  const q = sp.q ?? ""
  const page = Number(sp.page) || 1

  const { rows: vendors, total } = await vendorAccountService.list(entity.schemaName, { q, page, limit: PAGE_SIZE })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vendor Accounts</h1>
      <div className="rounded-lg border bg-card">
        <div className="px-4">
          <SearchPagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchValue={q}
            placeholder="Search by name, code, TIN…"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Vendor Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Contact Person</th>
                <th className="text-left p-3 font-medium">TIN</th>
                <th className="text-left p-3 font-medium">Payment Terms</th>
                <th className="text-right p-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No vendors found.</td></tr>}
              {vendors.map((v: any) => (
                <tr key={v.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">{v.vendor_code}</td>
                  <td className="p-3">
                    <Link href={`/vendor-accounts/${v.id}`} className="text-blue-600 hover:underline">
                      {v.vendor_name}
                    </Link>
                  </td>
                  <td className="p-3 text-xs">{v.contact_person || "—"}</td>
                  <td className="p-3 font-mono text-xs">{v.tin || "—"}</td>
                  <td className="p-3 text-xs">{v.payment_terms || "—"}</td>
                  <td className="p-3 text-right font-mono">{(Number(v.total_balance) || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
