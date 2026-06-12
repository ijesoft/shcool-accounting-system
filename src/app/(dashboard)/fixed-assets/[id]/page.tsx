import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { fixedAssetService } from "@/services/fixed-asset.service"
import { prisma } from "@/lib/db"
import { AssetActions } from "./asset-actions"
import { formatAmount } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "fixed_assets", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const asset = await fixedAssetService.getById(entity.schemaName, id)
  if (!asset) return <p className="p-6 text-muted-foreground">Asset not found.</p>

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-3xl font-bold">{asset.asset_name}</h1>

      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Asset Code</p>
            <p className="font-mono">{asset.asset_code}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Category</p>
            <p className="capitalize">{asset.asset_category}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Acquisition Date</p>
            <p>{new Date(asset.acquisition_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cost</p>
            <p className="font-mono">{formatAmount(Number(asset.acquisition_cost))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Accum. Depreciation</p>
            <p className="font-mono">{formatAmount(Number(asset.accumulated_depreciation))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Net Book Value</p>
            <p className="font-mono">{formatAmount(Number(asset.acquisition_cost) - Number(asset.accumulated_depreciation))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Life (Years)</p>
            <p>{asset.estimated_life_years}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Salvage Value</p>
            <p className="font-mono">{formatAmount(Number(asset.salvage_value))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="capitalize">{asset.status.replace("_", " ")}</p>
          </div>
          {asset.disposal_date && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Disposal Date</p>
                <p>{new Date(asset.disposal_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disposal Amount</p>
                <p className="font-mono">{formatAmount(Number(asset.disposal_amount))}</p>
              </div>
            </>
          )}
        </div>

        <AssetActions assetId={asset.id} status={asset.status} />
      </div>

      <h2 className="text-xl font-semibold">Depreciation Schedule</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Period</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">JE #</th>
              <th className="text-left p-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(asset.depreciation_schedule || []).length === 0 && (
              <tr><td colSpan={4} className="text-center p-6 text-muted-foreground">No depreciation entries.</td></tr>
            )}
            {(asset.depreciation_schedule || []).map((d: any) => (
              <tr key={d.id} className="border-b">
                <td className="p-3 text-xs">{d.fiscal_period_id?.slice(0, 8) || "—"}</td>
                <td className="p-3 text-right font-mono">{formatAmount(Number(d.depreciation_amount))}</td>
                <td className="p-3 text-xs font-mono">{d.entry_number || "—"}</td>
                <td className="p-3 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
