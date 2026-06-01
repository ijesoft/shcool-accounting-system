import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { CreateEntityDialog } from "@/components/entities/entity-form"
import { EntityRow } from "./entity-row"

export const dynamic = "force-dynamic"

export default async function EntitiesPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "entities", "read")) redirect("/")

  const entities = await prisma.entity.findMany({ orderBy: { name: "asc" } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Branches</h1>
          <p className="text-muted-foreground">Manage school branches and campuses</p>
        </div>
        <CreateEntityDialog />
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left font-medium">Code</th>
              <th className="p-3 text-left font-medium">Name</th>
              <th className="p-3 text-left font-medium">TIN</th>
              <th className="p-3 text-left font-medium">Schema</th>
              <th className="p-3 text-left font-medium">Status</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entities.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No branches yet. Click &ldquo;Add Branch&rdquo; to create one.
                </td>
              </tr>
            )}
            {entities.map((entity) => (
              <EntityRow key={entity.id} entity={entity} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
