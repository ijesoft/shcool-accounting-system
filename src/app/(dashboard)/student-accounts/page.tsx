import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"
import { SearchPagination } from "@/components/ui/search-pagination"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 20

export default async function StudentAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "student_accounts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const sp = await searchParams
  const q = sp.q ?? ""
  const page = Number(sp.page) || 1

  const { rows: students, total } = await studentAccountService.list(entity.schemaName, { q, page, limit: PAGE_SIZE })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Accounts</h1>
      <div className="rounded-lg border bg-card">
        <div className="px-4">
          <SearchPagination
            totalCount={total}
            currentPage={page}
            pageSize={PAGE_SIZE}
            searchValue={q}
            placeholder="Search by name, student no., course…"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Student #</th>
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Course/Grade</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={5} className="text-center p-6 text-muted-foreground">No students found.</td></tr>}
              {students.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/student-accounts/${s.id}`} className="text-blue-600 hover:underline">{s.student_number}</Link>
                  </td>
                  <td className="p-3">{s.full_name}</td>
                  <td className="p-3 text-xs">{s.course || s.grade_level || "—"}</td>
                  <td className="p-3 text-xs capitalize">{s.status}</td>
                  <td className="p-3 text-right font-mono">{Number(s.total_balance).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
