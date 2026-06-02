import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { formatAmount } from "@/lib/utils"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}

async function loadAccount(schema: string, accountId: string) {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, account_code, account_name, account_type, normal_balance, level, is_active, parent_id
     FROM "${schema}".account WHERE id = $1::uuid`, accountId
  )
  return rows[0] || null
}

async function loadLedger(schema: string, accountId: string, from?: string, to?: string) {
  const params: any[] = [accountId]
  let dateFilter = ""
  if (from) { params.push(from); dateFilter += ` AND je.entry_date >= $${params.length}::date` }
  if (to)   { params.push(to);   dateFilter += ` AND je.entry_date <= $${params.length}::date` }

  const lines = await prisma.$queryRawUnsafe<any[]>(
    `SELECT jel.id as line_id, jel.debit, jel.credit, jel.line_description,
            je.id as journal_id, je.entry_number, je.entry_date, je.description as entry_description,
            je.source_module, je.status as entry_status, je.reference
     FROM "${schema}".journal_entry_line jel
     JOIN "${schema}".journal_entry je ON je.id = jel.journal_entry_id
     WHERE jel.account_id = $1::uuid ${dateFilter}
     ORDER BY je.entry_date, je.entry_number, jel.line_order`,
    ...params
  )

  let running = 0
  const normalIsDebit = lines.length === 0
    ? true
    : await prisma.$queryRawUnsafe<any[]>(
        `SELECT normal_balance FROM "${schema}".account WHERE id = $1::uuid`, accountId
      ).then(r => r[0]?.normal_balance === "debit")

  const rows = lines.map((l: any) => {
    const d = Number(l.debit)
    const c = Number(l.credit)
    running += normalIsDebit ? d - c : c - d
    return { ...l, debit: d, credit: c, running }
  })

  const totals = rows.reduce(
    (acc: any, r: any) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
    { debit: 0, credit: 0 }
  )
  const finalBalance = normalIsDebit ? totals.debit - totals.credit : totals.credit - totals.debit

  return { rows, totals, finalBalance, normalIsDebit }
}

export default async function AccountLedgerPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "accounts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const account = await loadAccount(entity.schemaName, id)
  if (!account) return <p className="p-6 text-muted-foreground">Account not found.</p>

  const { rows, totals, finalBalance } = await loadLedger(entity.schemaName, id, sp.from, sp.to)

  return (
    <div className="space-y-6">
      <Link href="/accounts" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Chart of Accounts
      </Link>

      <div>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-2xl font-bold text-muted-foreground">{account.account_code}</span>
          <h1 className="text-3xl font-bold">{account.account_name}</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Type: <strong className="text-foreground capitalize">{account.account_type}</strong></span>
          <span>Normal balance: <strong className="text-foreground capitalize">{account.normal_balance}</strong></span>
          <span>Status: <strong className={account.is_active ? "text-emerald-600" : "text-red-600"}>{account.is_active ? "Active" : "Inactive"}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Total Debits</div>
          <div className="mt-1 text-2xl font-mono font-semibold">{formatAmount(totals.debit)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Total Credits</div>
          <div className="mt-1 text-2xl font-mono font-semibold">{formatAmount(totals.credit)}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase text-muted-foreground">Ending Balance</div>
          <div className={`mt-1 text-2xl font-mono font-semibold ${finalBalance < 0 ? "text-red-600" : ""}`}>
            {formatAmount(Math.abs(finalBalance))}
            <span className="ml-1 text-sm text-muted-foreground">
              {account.normal_balance === "debit"
                ? (finalBalance < 0 ? "Cr" : "Dr")
                : (finalBalance < 0 ? "Dr" : "Cr")}
            </span>
          </div>
        </div>
      </div>

      <form className="flex items-end gap-3" method="get">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="border rounded px-2 py-1 text-sm" />
        </div>
        <button type="submit" className="border rounded px-3 py-1 text-sm hover:bg-muted">Filter</button>
        {(sp.from || sp.to) && (
          <Link href={`/accounts/${id}`} className="text-sm text-blue-600 hover:underline">Clear</Link>
        )}
      </form>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Entry #</th>
              <th className="text-left p-3 font-medium">Source</th>
              <th className="text-left p-3 font-medium">Description</th>
              <th className="text-right p-3 font-medium">Debit</th>
              <th className="text-right p-3 font-medium">Credit</th>
              <th className="text-right p-3 font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No journal activity for this account.</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.line_id} className="border-b hover:bg-muted/50">
                <td className="p-3 whitespace-nowrap">{new Date(r.entry_date).toLocaleDateString()}</td>
                <td className="p-3 font-mono text-xs">
                  <Link href={`/journal-entries/${r.journal_id}`} className="text-blue-600 hover:underline">{r.entry_number}</Link>
                </td>
                <td className="p-3 text-xs">{r.source_module ?? "—"}</td>
                <td className="p-3">{r.line_description || r.entry_description || "—"}</td>
                <td className="p-3 text-right font-mono">{r.debit > 0 ? formatAmount(r.debit) : ""}</td>
                <td className="p-3 text-right font-mono">{r.credit > 0 ? formatAmount(r.credit) : ""}</td>
                <td className="p-3 text-right font-mono font-medium">{formatAmount(Math.abs(r.running))}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-medium">
                <td colSpan={4} className="p-3 text-right">Totals</td>
                <td className="p-3 text-right font-mono">{formatAmount(totals.debit)}</td>
                <td className="p-3 text-right font-mono">{formatAmount(totals.credit)}</td>
                <td className="p-3 text-right font-mono">{formatAmount(Math.abs(finalBalance))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
