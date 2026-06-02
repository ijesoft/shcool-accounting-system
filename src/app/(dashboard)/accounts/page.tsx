import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { AccountTreeView } from "./account-tree-view"
import { AddAccount } from "./add-account"

async function getAccounts(entityId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return { accounts: [], balances: {} as Record<string, { debit: number; credit: number }> }

  const accounts = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}"."account" ORDER BY account_code`
  )

  const activity = await prisma.$queryRawUnsafe<any[]>(
    `SELECT jel.account_id::text as account_id,
            COALESCE(SUM(jel.debit), 0)::float8 as total_debit,
            COALESCE(SUM(jel.credit), 0)::float8 as total_credit
     FROM "${entity.schemaName}".journal_entry_line jel
     JOIN "${entity.schemaName}".journal_entry je ON je.id = jel.journal_entry_id
     WHERE je.status = 'posted'
     GROUP BY jel.account_id`
  )

  const balances: Record<string, { debit: number; credit: number }> = {}
  for (const r of activity) {
    balances[r.account_id] = { debit: r.total_debit, credit: r.total_credit }
  }

  return { accounts, balances }
}

export default async function AccountsPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!hasPermission(session.roleName, "accounts", "read")) {
    redirect("/")
  }

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <p className="text-muted-foreground">Please select an entity to view accounts.</p>
      </div>
    )
  }

  const { accounts, balances } = await getAccounts(session.entityId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Chart of Accounts</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{accounts.length} accounts</span>
          <AddAccount accounts={accounts} />
        </div>
      </div>
      <AccountTreeView accounts={accounts} balances={balances} />
    </div>
  )
}
