import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { SearchPagination } from "@/components/ui/search-pagination"
import { formatAmount } from "@/lib/utils"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "fixed_assets", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sp = await searchParams
  const q = sp.q ?? ""
  const page = Number(sp.page) || 1

  const { rows: assets, total } = await fixedAssetService.list(entity.schemaName, { q, page, limit: PAGE_SIZE })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fixed Assets</h1>
        <Link href="/fixed-assets/new"><Button>Capitalize Asset</Button></Link>
      </div>
      <div className="rounded-lg border bg-card">
        <div className="px-4">
          <SearchPagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchValue={q}
            placeholder="Search by code, name, category, status…"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Asset Code</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Cost</th>
                <th className="text-right p-3 font-medium">Accum. Depr.</th>
                <th className="text-right p-3 font-medium">Net Book Value</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No assets found.</td></tr>}
              {assets.map((a: any) => (
                <tr key={a.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/fixed-assets/${a.id}`} className="text-blue-600 hover:underline">{a.asset_code}</Link>
                  </td>
                  <td className="p-3">{a.asset_name}</td>
                  <td className="p-3 text-xs capitalize">{a.asset_category}</td>
                  <td className="p-3 text-right font-mono">{formatAmount(Number(a.acquisition_cost))}</td>
                  <td className="p-3 text-right font-mono">{formatAmount(Number(a.accumulated_depreciation))}</td>
                  <td className="p-3 text-right font-mono">{formatAmount(Number(a.net_book_value))}</td>
                  <td className="p-3 text-xs capitalize">{a.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
