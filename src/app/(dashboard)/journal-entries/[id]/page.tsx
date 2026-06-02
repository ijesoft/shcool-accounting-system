import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { formatAmount } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { JournalEntryWorkflow } from "./workflow-buttons"
import { ApplyButton } from "./apply-button"

async function getEntry(entityId: string, entryId: string) {
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  if (!entity) return null

  const entries = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "${entity.schemaName}".journal_entry WHERE id = $1::uuid`,
    entryId
  )
  if (!entries[0]) return null

  const lines = await prisma.$queryRawUnsafe<any[]>(
    `SELECT jel.*, a.account_code, a.account_name,
            CASE jel.party_type
              WHEN 'student'  THEN s.full_name
              WHEN 'vendor'   THEN v.vendor_name
              WHEN 'employee' THEN e.full_name
              ELSE NULL
            END as party_name
     FROM "${entity.schemaName}".journal_entry_line jel
     JOIN "${entity.schemaName}".account a ON a.id = jel.account_id
     LEFT JOIN "${entity.schemaName}".student        s ON jel.party_type = 'student'  AND s.id = jel.party_id
     LEFT JOIN "${entity.schemaName}".vendor_account v ON jel.party_type = 'vendor'   AND v.id = jel.party_id
     LEFT JOIN "${entity.schemaName}".employee       e ON jel.party_type = 'employee' AND e.id = jel.party_id
     WHERE jel.journal_entry_id = $1::uuid
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
                <LineRow key={line.id} line={line} entryId={id} entryStatus={entry.status} />
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={2} className="p-2 text-right">Totals</td>
                <td className="p-2 text-right font-mono">
                  {formatAmount(entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0))}
                </td>
                <td className="p-2 text-right font-mono">
                  {formatAmount(entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0))}
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

function LineRow({ line, entryId, entryStatus }: { line: any; entryId: string; entryStatus: string }) {
  const isTagged = !!line.party_type
  return (
    <>
      <tr className="border-b">
        <td className="p-2">{line.account_name}</td>
        <td className="p-2 font-mono text-xs">{line.account_code}</td>
        <td className="p-2 text-right font-mono">{Number(line.debit) > 0 ? formatAmount(Number(line.debit)) : ""}</td>
        <td className="p-2 text-right font-mono">{Number(line.credit) > 0 ? formatAmount(Number(line.credit)) : ""}</td>
        <td className="p-2 text-xs text-muted-foreground">{line.line_description || ""}</td>
      </tr>
      {isTagged && (
        <tr className="bg-muted/30">
          <td colSpan={5} className="p-3 text-xs">
            <span className="font-medium">Party:</span>{" "}
            {line.party_name || line.party_id} ({line.party_type})
            {entryStatus === "posted" && line.party_type !== "employee" && (
              <ApplyButton
                entryId={entryId}
                lineId={line.id}
                partyType={line.party_type}
                partyId={line.party_id}
                lineAmount={Math.max(Number(line.debit), Number(line.credit))}
              />
            )}
            {entryStatus === "posted" && line.party_type === "employee" && (
              <p className="mt-1 text-muted-foreground">Apply not supported for employee AP yet.</p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
