import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { vendorAccountService } from "@/services/vendor-account.service"
import { prisma } from "@/lib/db"
import { CreateVendorInvoiceForm } from "./create-invoice-form"
import { formatAmount } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "vendor_accounts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const vendor = await vendorAccountService.getById(entity.schemaName, id)
  if (!vendor) return <p className="p-6 text-muted-foreground">Vendor not found.</p>

  const invoices = await vendorAccountService.getInvoices(entity.schemaName, id)
  const glActivity = await vendorAccountService.getGlActivity(entity.schemaName, id)

  return (
    <div className="space-y-6">
      <Link href="/vendor-accounts" className="text-sm text-blue-600 hover:underline">
        &larr; Back to Vendor Accounts
      </Link>
      <h1 className="text-3xl font-bold">{vendor.vendor_name}</h1>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="font-medium">Vendor Code:</span> {vendor.vendor_code}</div>
        <div><span className="font-medium">TIN:</span> {vendor.tin || "—"}</div>
        <div><span className="font-medium">Contact:</span> {vendor.contact_person || "—"}</div>
        <div><span className="font-medium">Payment Terms:</span> {vendor.payment_terms || "—"}</div>
      </div>

      {hasPermission(session.roleName, "vendor_accounts", "create") && (
        <CreateVendorInvoiceForm vendorId={id} />
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
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={6} className="text-center p-6 text-muted-foreground">No invoices.</td></tr>
            )}
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">{inv.invoice_number}</td>
                <td className="p-3">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                <td className="p-3">{new Date(inv.due_date).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono">{formatAmount(Number(inv.total_amount))}</td>
                <td className="p-3 text-right font-mono">{formatAmount(Number(inv.balance))}</td>
                <td className="p-3 text-xs capitalize">{inv.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold">GL Activity (Manual Bills/JEs)</h2>
      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Entry #</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-left p-3 font-medium">Account</th>
              <th className="text-right p-3 font-medium">Debit</th>
              <th className="text-right p-3 font-medium">Credit</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {glActivity.length === 0 && (
              <tr><td colSpan={7} className="text-center p-6 text-muted-foreground">No GL activity.</td></tr>
            )}
            {glActivity.map((g: any) => (
              <tr key={g.line_id} className="border-b hover:bg-muted/50">
                <td className="p-3 font-mono text-xs">
                  <Link href={`/journal-entries/${g.entry_id}`} className="hover:underline text-blue-600">{g.entry_number}</Link>
                </td>
                <td className="p-3">{new Date(g.entry_date).toLocaleDateString()}</td>
                <td className="p-3 text-xs font-mono">{g.account_code} {g.account_name}</td>
                <td className="p-3 text-right font-mono">{Number(g.debit) > 0 ? formatAmount(Number(g.debit)) : "—"}</td>
                <td className="p-3 text-right font-mono">{Number(g.credit) > 0 ? formatAmount(Number(g.credit)) : "—"}</td>
                <td className="p-3 text-xs capitalize">{g.status}</td>
                <td className="p-3 text-xs text-muted-foreground">{g.line_description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
