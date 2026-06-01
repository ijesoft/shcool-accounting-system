import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { studentAccountService } from "@/services/student-account.service"
import { prisma } from "@/lib/db"
import { enrollmentDepositService } from "@/services/enrollment-deposit.service"
import { CreateStudentInvoiceForm } from "./create-invoice-form"
import { EnrollmentDepositActions } from "./enrollment-deposit-actions"

export const dynamic = "force-dynamic"

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "student_accounts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const schema = entity.schemaName
  const student = await studentAccountService.getById(schema, id)
  if (!student) return <p className="p-6 text-muted-foreground">Student not found.</p>

  const invoices = await studentAccountService.getInvoices(schema, id)
  const payments = await studentAccountService.getPayments(schema, id)
  const heldDeposits = await enrollmentDepositService.listHeldDeposits(schema, id)

  return (
    <div className="space-y-6">
      <Link href="/student-accounts" className="text-sm text-blue-600 hover:underline">&larr; Back to Student Accounts</Link>
      <h1 className="text-3xl font-bold">{student.full_name}</h1>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="font-medium">Student #:</span> {student.student_number}</div>
        <div><span className="font-medium">Status:</span> <span className="capitalize">{student.status}</span></div>
        {student.course && <div><span className="font-medium">Course:</span> {student.course}</div>}
        {student.grade_level && <div><span className="font-medium">Grade Level:</span> {student.grade_level}</div>}
      </div>

      {hasPermission(session.roleName, "student_accounts", "create") && (
        <CreateStudentInvoiceForm studentId={id} />
      )}

      <h2 className="text-xl font-semibold">Invoices</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Invoice #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Due Date</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-right p-3 font-medium">Balance</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Term</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No invoices.</td></tr>}
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                <td className="p-3">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td className="p-3">{new Date(inv.due_date).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono">{Number(inv.total_amount).toFixed(2)}</td>
                <td className="p-3 text-right font-mono">{Number(inv.balance).toFixed(2)}</td>
                <td className="p-3 text-xs capitalize">{inv.status}</td>
                <td className="p-3 text-xs">{inv.term || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold">Enrollment Deposits (Held)</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Transaction #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {heldDeposits.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center p-6 text-muted-foreground">
                  No held enrollment deposits.
                </td>
              </tr>
            )}
            {heldDeposits.map((deposit: any) => (
              <tr key={deposit.id} className="border-b">
                <td className="p-3 font-mono text-xs">{deposit.transaction_number}</td>
                <td className="p-3">{new Date(deposit.payment_date).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono">{Number(deposit.amount).toFixed(2)}</td>
                <td className="p-3">
                  {hasPermission(session.roleName, "cash_receipts", "post") && (
                    <EnrollmentDepositActions
                      depositId={deposit.id}
                      invoices={invoices.map((inv: any) => ({
                        id: inv.id,
                        invoice_number: inv.invoice_number,
                        balance: Number(inv.balance),
                        status: inv.status,
                      }))}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold">Payment History</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Transaction #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Invoice</th>
              <th className="text-right p-3 font-medium">Amount</th>
              <th className="text-left p-3 font-medium">Method</th>
              <th className="text-left p-3 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No payments.</td></tr>}
            {payments.map((p: any) => (
              <tr key={p.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{p.transaction_number}</td>
                <td className="p-3">{new Date(p.payment_date).toLocaleDateString()}</td>
                <td className="p-3 text-xs">{p.invoice_number || "—"}</td>
                <td className="p-3 text-right font-mono">{Number(p.amount).toFixed(2)}</td>
                <td className="p-3 text-xs">{p.payment_method}</td>
                <td className="p-3 text-xs capitalize">{(p.payment_type || "tuition").replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
