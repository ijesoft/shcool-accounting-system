import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { reportService } from "@/services/report.service"
import { prisma } from "@/lib/db"

async function getData(entityId: string, from: string, to: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null
  return reportService.getCashFlowStatement(entity.schemaName, from, to)
}

export const dynamic = "force-dynamic"

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const from = params.from || `${now.getFullYear()}-01-01`
  const to = params.to || now.toISOString().split("T")[0]

  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "reports", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const data = await getData(session.entityId, from, to)
  if (!data) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sections = [
    { key: "operating" as const, label: "Operating Activities" },
    { key: "investing" as const, label: "Investing Activities" },
    { key: "financing" as const, label: "Financing Activities" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cash Flow Statement</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(from).toLocaleDateString()} — {new Date(to).toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Item</th>
                <th className="text-right p-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <>
                  <tr key={section.key} className="border-b bg-muted/30">
                    <td className="p-3 font-bold" colSpan={2}>{section.label}</td>
                  </tr>
                  {data.sections[section.key].length === 0 && (
                    <tr className="border-b">
                      <td className="p-3 pl-8 text-muted-foreground italic" colSpan={2}>No items</td>
                    </tr>
                  )}
                  {data.sections[section.key].map((entry: any, i: number) => (
                    <tr key={`${section.key}-${i}`} className="border-b hover:bg-muted/50">
                      <td className="p-3 pl-8">{entry.label}</td>
                      <td className={`p-3 text-right font-mono ${entry.amount >= 0 ? "" : "text-red-600"}`}>
                        {entry.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b font-medium">
                    <td className="p-3 pl-8">Net {section.label}</td>
                    <td className={`p-3 text-right font-mono ${data.totals[section.key] >= 0 ? "" : "text-red-600"}`}>
                      {data.totals[section.key].toFixed(2)}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-bold text-lg">
                <td className="p-3">Net Cash Flow</td>
                <td className={`p-3 text-right font-mono ${data.totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.totals.net.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
