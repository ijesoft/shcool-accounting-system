import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { SearchPagination } from "@/components/ui/search-pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

async function getEntries(entityId: string, opts: { q: string; page: number }) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return { entries: [], entityName: "", total: 0 }

  const q = opts.q
  const limit = PAGE_SIZE
  const offset = (opts.page - 1) * limit

  const countRows = await prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT COUNT(*)::int as total
     FROM "${entity.schemaName}".journal_entry je
     WHERE ($1 = '' OR je.entry_number ILIKE $2 OR COALESCE(je.description,'') ILIKE $2 OR je.status ILIKE $2 OR COALESCE(je.source_module,'') ILIKE $2)`,
    q, `%${q}%`
  )
  const total = countRows[0]?.total ?? 0

  const entries = await prisma.$queryRawUnsafe<any[]>(
    `SELECT je.*,
      (SELECT COUNT(*) FROM "${entity.schemaName}".journal_entry_line WHERE journal_entry_id = je.id) as line_count,
      (SELECT COALESCE(SUM(debit), 0) FROM "${entity.schemaName}".journal_entry_line WHERE journal_entry_id = je.id) as total_debit,
      (SELECT COALESCE(SUM(credit), 0) FROM "${entity.schemaName}".journal_entry_line WHERE journal_entry_id = je.id) as total_credit
     FROM "${entity.schemaName}".journal_entry je
     WHERE ($1 = '' OR je.entry_number ILIKE $2 OR COALESCE(je.description,'') ILIKE $2 OR je.status ILIKE $2 OR COALESCE(je.source_module,'') ILIKE $2)
     ORDER BY je.created_at DESC
     LIMIT $3 OFFSET $4`,
    q, `%${q}%`, limit, offset
  )

  return { entries, entityName: entity.name, total }
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  posted: "bg-green-100 text-green-800",
  void: "bg-red-100 text-red-800",
}

export default async function JournalEntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "journal_entries", "read")) redirect("/")

  if (!session.entityId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Journal Entries</h1>
        <p className="text-muted-foreground">Please select an entity to view entries.</p>
      </div>
    )
  }

  const sp = await searchParams
  const q = sp.q ?? ""
  const page = Number(sp.page) || 1

  const { entries, entityName, total } = await getEntries(session.entityId, { q, page })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-sm text-muted-foreground">{entityName}</p>
        </div>
        <Link href="/journal-entries/new">
          <Button>New Journal Entry</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="px-4">
          <SearchPagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchValue={q}
            placeholder="Search by entry no., description, status…"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Entry #</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-right p-3 font-medium">Debit</th>
                <th className="text-right p-3 font-medium">Credit</th>
                <th className="text-center p-3 font-medium">Lines</th>
                <th className="text-center p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center p-6 text-muted-foreground">
                    No journal entries yet. Create your first entry.
                  </td>
                </tr>
              )}
              {entries.map((entry: any) => (
                <tr key={entry.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/journal-entries/${entry.id}`} className="text-blue-600 hover:underline">
                      {entry.entry_number}
                    </Link>
                  </td>
                  <td className="p-3">{new Date(entry.entry_date).toLocaleDateString()}</td>
                  <td className="p-3 text-xs text-muted-foreground">{entry.reference || "—"}</td>
                  <td className="p-3 text-xs">{entry.source_module}</td>
                  <td className="p-3 max-w-[200px] truncate">{entry.description || "—"}</td>
                  <td className="p-3 text-right font-mono text-xs">{Number(entry.total_debit).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono text-xs">{Number(entry.total_credit).toLocaleString()}</td>
                  <td className="p-3 text-center text-xs">{entry.line_count}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[entry.status] || ""}`}>
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
