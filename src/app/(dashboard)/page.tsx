import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.userId) redirect("/login")

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Please select an entity to view your dashboard.</p>
      </div>
    )
  }

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const [totalAccounts, totalJournalEntries, pendingInvoices, cashBalance, pendingApprovals] =
    await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int FROM "${entity.schemaName}".account WHERE is_active = TRUE`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int FROM "${entity.schemaName}".journal_entry WHERE status = 'posted'`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int FROM "${entity.schemaName}".student_invoice WHERE status IN ('unpaid', 'partial')`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(total_debits - total_credits), 0)::numeric as balance
         FROM "${entity.schemaName}".general_ledger
         WHERE account_id IN (
           SELECT id FROM "${entity.schemaName}".account WHERE account_code LIKE '111%'
         )`
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int FROM "${entity.schemaName}".approval_request WHERE status = 'pending'`
      ),
    ])

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n)

  const kpis = [
    {
      label: "Active Accounts",
      value: totalAccounts[0]?.count ?? 0,
      color: "text-blue-600",
    },
    {
      label: "Posted Entries",
      value: totalJournalEntries[0]?.count ?? 0,
      color: "text-green-600",
    },
    {
      label: "Pending Invoices",
      value: pendingInvoices[0]?.count ?? 0,
      color: "text-orange-600",
    },
    {
      label: "Cash Balance",
      value: formatCurrency(Number(cashBalance[0]?.balance ?? 0)),
      color: "text-emerald-600",
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome back, {session.fullName}</p>

      {pendingApprovals[0]?.count > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-orange-800">{pendingApprovals[0].count} pending approval{pendingApprovals[0].count > 1 ? "s" : ""}</p>
            <p className="text-sm text-orange-600">Items awaiting your review</p>
          </div>
          <a href="/approvals" className="text-sm text-orange-700 hover:underline font-medium">
            View →
          </a>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <a href="/cash-receipts" className="rounded-lg border bg-card p-4 hover:border-blue-400 transition-colors">
          <p className="font-medium">Cash Receipts</p>
          <p className="text-sm text-muted-foreground">Record and post payments</p>
        </a>
        <a href="/cash-disbursements" className="rounded-lg border bg-card p-4 hover:border-blue-400 transition-colors">
          <p className="font-medium">Cash Disbursements</p>
          <p className="text-sm text-muted-foreground">Process payments</p>
        </a>
        <a href="/reports" className="rounded-lg border bg-card p-4 hover:border-blue-400 transition-colors">
          <p className="font-medium">Reports</p>
          <p className="text-sm text-muted-foreground">Financial statements</p>
        </a>
      </div>
    </div>
  )
}
