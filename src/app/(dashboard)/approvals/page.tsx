import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { approvalRepository } from "@/repositories/approval.repository"

export const dynamic = "force-dynamic"

export default async function ApprovalsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!session.entityId) {
    return <p className="p-6 text-muted-foreground">Please select an entity.</p>
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { roleId: true },
  })

  const pendingApprovals = user?.roleId
    ? await approvalRepository.getPendingApprovals(entity.schemaName, session.userId, user.roleId)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Approval Inbox</h1>
        <p className="text-sm text-muted-foreground">Pending items awaiting your approval</p>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium">Entry #</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Description</th>
              <th className="p-3 font-medium">Source</th>
              <th className="p-3 font-medium text-right">Amount</th>
              <th className="p-3 font-medium">Level</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingApprovals.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No pending approvals.
                </td>
              </tr>
            )}
            {pendingApprovals.map((je: any) => (
              <tr key={je.id} className="border-b">
                <td className="p-3 font-mono text-xs">
                  <a href={`/journal-entries/${je.id}`} className="text-blue-600 hover:underline">
                    {je.entry_number}
                  </a>
                </td>
                <td className="p-3 text-xs">{je.entry_date}</td>
                <td className="p-3 max-w-xs truncate">{je.description}</td>
                <td className="p-3 text-xs">{je.source_module}</td>
                <td className="p-3 text-right font-mono">
                  {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(je.total_amount))}
                </td>
                <td className="p-3 text-center">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Level {je.level}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <a
                      href={`/journal-entries/${je.id}/approve`}
                      className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                    >
                      Approve
                    </a>
                    <a
                      href={`/journal-entries/${je.id}/reject`}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                    >
                      Reject
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
