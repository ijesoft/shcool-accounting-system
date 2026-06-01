import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "entities", "update")) redirect("/")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const [users, roles, pendingApprovals] = await Promise.all([
    prisma.user.findMany({
      where: { entityId: session.entityId },
      include: { role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
    }),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int FROM "${entity.schemaName}".approval_request WHERE status = 'pending'`
    ),
  ])

  const pendingCount = Number(pendingApprovals[0]?.count || 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-sm text-muted-foreground">Entity settings, users, and system controls</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/approvals" className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Pending Approvals</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <span className="text-2xl">📋</span>
          </div>
        </Link>

        <Link href="/admin/audit-log" className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Audit Log</p>
              <p className="text-2xl font-bold">→</p>
            </div>
            <span className="text-2xl">🔍</span>
          </div>
        </Link>

        <Link href="/entities" className="border rounded-lg p-4 hover:border-blue-400 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Entities</p>
              <p className="text-2xl font-bold">{entity?.name || "—"}</p>
            </div>
            <span className="text-2xl">🏢</span>
          </div>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">Users assigned to this entity</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b">
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{user.role?.name}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">System roles and their permissions</p>
        </div>
        <div className="divide-y">
          {roles.map((role) => (
            <div key={role.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">
                  {role.permissions.length} permissions
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {role.permissions.map((rp) => (
                  <span key={rp.permission.id} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {rp.permission.resource}:{rp.permission.action}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
