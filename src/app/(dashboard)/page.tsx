import { getSession } from "@/lib/auth/session"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

export const dynamic = "force-dynamic"

const phpFmt = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(n)

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

  const schema = entity.schemaName

  const [
    todayCollections,
    arAgingRows,
    pendingApprovalsRows,
    payrollLiabilityRows,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(amount), 0)::numeric as total
       FROM "${schema}".payment_transaction
       WHERE created_at::date = CURRENT_DATE AND status = 'posted'`
    ).catch(() => [{ total: 0 }]),

    prisma.$queryRawUnsafe<any[]>(
      `SELECT
         COUNT(CASE WHEN due_date >= CURRENT_DATE THEN 1 END)::int as current_count,
         COALESCE(SUM(CASE WHEN due_date >= CURRENT_DATE THEN balance_due ELSE 0 END), 0)::numeric as current_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN 1 END)::int as d30_count,
         COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND due_date >= CURRENT_DATE - 30 THEN balance_due ELSE 0 END), 0)::numeric as d30_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN 1 END)::int as d60_count,
         COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 30 AND due_date >= CURRENT_DATE - 60 THEN balance_due ELSE 0 END), 0)::numeric as d60_amount,
         COUNT(CASE WHEN due_date < CURRENT_DATE - 60 THEN 1 END)::int as d61plus_count,
         COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE - 60 THEN balance_due ELSE 0 END), 0)::numeric as d61plus_amount
       FROM "${schema}".student_invoice
       WHERE balance_due > 0`
    ).catch(() => [{}]),

    prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*)::int as cnt FROM "${schema}".journal_entry WHERE status = 'pending_approval'`
    ).catch(() => [{ cnt: 0 }]),

    prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(
         CASE WHEN a.normal_balance = 'credit'
           THEN COALESCE(SUM_credit.total_credits, 0) - COALESCE(SUM_credit.total_debits, 0)
           ELSE COALESCE(SUM_credit.total_debits, 0) - COALESCE(SUM_credit.total_credits, 0)
         END
       ), 0)::numeric as balance
       FROM "${schema}".account a
       LEFT JOIN (
         SELECT jel.account_id,
                SUM(jel.debit) as total_debits,
                SUM(jel.credit) as total_credits
         FROM "${schema}".journal_entry_line jel
         JOIN "${schema}".journal_entry je ON je.id = jel.journal_entry_id AND je.status = 'posted'
         GROUP BY jel.account_id
       ) SUM_credit ON SUM_credit.account_id = a.id
       WHERE a.account_code IN ('21610', '21620', '21630', '21510', '21520', '21530')`
    ).catch(() => [{ balance: 0 }]),
  ])

  const todayTotal = Number(todayCollections[0]?.total ?? 0)
  const aging = arAgingRows[0] ?? {}
  const pendingApprovals = Number(pendingApprovalsRows[0]?.cnt ?? 0)
  const payrollLiability = Number(payrollLiabilityRows[0]?.balance ?? 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {session.fullName}</p>
      </div>

      {pendingApprovals > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-orange-800">
              {pendingApprovals} pending approval{pendingApprovals > 1 ? "s" : ""}
            </p>
            <p className="text-sm text-orange-600">Journal entries awaiting your review</p>
          </div>
          <Link href="/journal-entries" className="text-sm text-orange-700 hover:underline font-medium">
            View &rarr;
          </Link>
        </div>
      )}

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Today&apos;s Collections</p>
          <p className="text-2xl font-bold text-green-600">{phpFmt(todayTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">Posted payments today</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pending Approvals</p>
          <p className="text-2xl font-bold text-orange-600">{pendingApprovals}</p>
          <p className="text-xs text-muted-foreground mt-1">Journal entries pending review</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Payroll Liabilities</p>
          <p className="text-2xl font-bold text-purple-600">{phpFmt(payrollLiability)}</p>
          <p className="text-xs text-muted-foreground mt-1">SSS / PhilHealth / Pag-IBIG payable</p>
        </div>
      </div>

      {/* AR Aging */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3">AR Aging Summary</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md bg-green-50 border border-green-200 p-3">
            <p className="text-xs text-green-700 font-medium">Current (Not Yet Due)</p>
            <p className="text-lg font-bold text-green-800">{phpFmt(Number(aging.current_amount ?? 0))}</p>
            <p className="text-xs text-green-600">{aging.current_count ?? 0} invoices</p>
          </div>
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-xs text-yellow-700 font-medium">1–30 Days Overdue</p>
            <p className="text-lg font-bold text-yellow-800">{phpFmt(Number(aging.d30_amount ?? 0))}</p>
            <p className="text-xs text-yellow-600">{aging.d30_count ?? 0} invoices</p>
          </div>
          <div className="rounded-md bg-orange-50 border border-orange-200 p-3">
            <p className="text-xs text-orange-700 font-medium">31–60 Days Overdue</p>
            <p className="text-lg font-bold text-orange-800">{phpFmt(Number(aging.d60_amount ?? 0))}</p>
            <p className="text-xs text-orange-600">{aging.d60_count ?? 0} invoices</p>
          </div>
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-700 font-medium">61+ Days Overdue</p>
            <p className="text-lg font-bold text-red-800">{phpFmt(Number(aging.d61plus_amount ?? 0))}</p>
            <p className="text-xs text-red-600">{aging.d61plus_count ?? 0} invoices</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/journal-entries/new"
            className="rounded-lg border bg-card p-4 hover:border-blue-400 transition-colors"
          >
            <p className="font-medium">New Journal Entry</p>
            <p className="text-sm text-muted-foreground">Record accounting transactions</p>
          </Link>
          <Link
            href="/cash-receipts/new"
            className="rounded-lg border bg-card p-4 hover:border-green-400 transition-colors"
          >
            <p className="font-medium">New Cash Receipt</p>
            <p className="text-sm text-muted-foreground">Record incoming payments</p>
          </Link>
          <Link
            href="/cash-disbursements/new"
            className="rounded-lg border bg-card p-4 hover:border-red-400 transition-colors"
          >
            <p className="font-medium">New Cash Disbursement</p>
            <p className="text-sm text-muted-foreground">Process outgoing payments</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
