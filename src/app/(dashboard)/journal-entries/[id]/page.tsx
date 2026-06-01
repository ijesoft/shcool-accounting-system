import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { JournalEntryWorkflow } from "./workflow-buttons"

async function getEntry(entityId: string, entryId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null

  const entries = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}".journal_entry WHERE id = $1`,
    entryId
  )
  if (!entries[0]) return null

  const lines = await prisma.$queryRawUnsafe<any[]>(
    `SELECT jel.*, a.account_code, a.account_name 
     FROM "${entity.schemaName}".journal_entry_line jel
     JOIN "${entity.schemaName}".account a ON a.id = jel.account_id
     WHERE jel.journal_entry_id = $1
     ORDER BY jel.line_order`,
    entryId
  )

  return { ...entries[0], lines }
}

export default async function JournalEntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "journal_entries", "read")) redirect("/")
  if (!session.entityId) redirect("/journal-entries")

  const entry = await getEntry(session.entityId, id)
  if (!entry) return <p className="p-6 text-muted-foreground">Entry not found.</p>

  const canApprove = hasPermission(session.roleName, "journal_entries", "approve")
  const canPost = hasPermission(session.roleName, "journal_entries", "post")

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{entry.entry_number}</h1>
          <p className="text-sm text-muted-foreground capitalize">Status: {entry.status.replace(/_/g, " ")}</p>
        </div>
        <div className="flex gap-2 items-start">
          <JournalEntryWorkflow
            entryId={id}
            status={entry.status}
            canApprove={canApprove}
            canPost={canPost}
          />
          {entry.status === "draft" && (
            <Link href={`/journal-entries/${id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          <Link href="/journal-entries">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Entry Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground">Date</dt><dd>{new Date(entry.entry_date).toLocaleDateString()}</dd></div>
            <div><dt className="text-muted-foreground">Reference</dt><dd>{entry.reference || "—"}</dd></div>
            <div><dt className="text-muted-foreground">Source Module</dt><dd>{entry.source_module}</dd></div>
            <div><dt className="text-muted-foreground">Posted At</dt><dd>{entry.posted_at ? new Date(entry.posted_at).toLocaleString() : "—"}</dd></div>
            <div className="col-span-2"><dt className="text-muted-foreground">Description</dt><dd>{entry.description || "—"}</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Journal Lines</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2 font-medium">Account</th>
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium text-right">Debit</th>
                <th className="p-2 font-medium text-right">Credit</th>
                <th className="p-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line: any) => (
                <tr key={line.id} className="border-b">
                  <td className="p-2">{line.account_name}</td>
                  <td className="p-2 font-mono text-xs">{line.account_code}</td>
                  <td className="p-2 text-right font-mono">{Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : ""}</td>
                  <td className="p-2 text-right font-mono">{Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : ""}</td>
                  <td className="p-2 text-xs text-muted-foreground">{line.line_description || ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={2} className="p-2 text-right">Totals</td>
                <td className="p-2 text-right font-mono">
                  {entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0).toFixed(2)}
                </td>
                <td className="p-2 text-right font-mono">
                  {entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0).toFixed(2)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
