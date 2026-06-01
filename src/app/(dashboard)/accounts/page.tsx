import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { AccountTreeView } from "./account-tree-view"

async function getAccounts(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return []

  const accounts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}"."account" ORDER BY account_code`
  )
  return accounts
}

export default async function AccountsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!hasPermission(session.roleName, "accounts", "read")) {
    redirect("/dashboard")
  }

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground">Please select an entity to view accounts.</p>
      </div>
    )
  }

  const accounts = await getAccounts(session.entityId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <span className="text-sm text-muted-foreground">{accounts.length} accounts</span>
      </div>
      <AccountTreeView accounts={accounts} />
    </div>
  )
}
