import Link from "next/link"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { OfficialReceiptPrintWrapper } from "@/components/print/OfficialReceiptPrintWrapper"

export const dynamic = "force-dynamic"

export default async function OfficialReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect("/login")
  if (!hasPermission(session.roleName, "official_receipts", "read")) redirect("/")
  if (!session.entityId) return <p className="p-6 text-muted-foreground">Please select an entity.</p>

  const entity = await prisma.entity.findUnique({ where: { id: session.entityId } })
  if (!entity) return <p className="p-6 text-muted-foreground">Entity not found.</p>

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT or_.*, pt.transaction_number as payment_ref, pt.payment_method, pt.payment_date, pt.amount as payment_amount
     FROM "${entity.schemaName}".official_receipt or_
     LEFT JOIN "${entity.schemaName}".payment_transaction pt ON pt.official_receipt_id = or_.id
     WHERE or_.id = $1::uuid`, id
  )
  const or = rows[0]
  if (!or) return <p className="p-6 text-muted-foreground">Receipt not found.</p>

  const settings = (entity.settings ?? {}) as any
  const birSettings = settings?.bir ?? {}

  const printProps = {
    orNumber: or.or_number,
    orDate: or.or_date instanceof Date ? or.or_date.toISOString().slice(0, 10) : String(or.or_date),
    payorName: or.payor_name || "—",
    sellerName: entity.name,
    sellerTin: entity.tin || "",
    sellerAddress: birSettings.businessAddress || "",
    birSerialNumber: or.bir_serial_number || birSettings.birSerialNumber,
    birPermitNumber: birSettings.birPermitNumber,
    casPermitNumber: birSettings.casPermitNumber,
    lines: [{ description: "Payment received", amount: Number(or.amount) }],
    total: Number(or.amount),
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="print:hidden flex items-center justify-between">
        <Link href="/official-receipts" className="text-sm text-blue-600 hover:underline">&larr; Back to Official Receipts</Link>
        <OfficialReceiptPrintWrapper printProps={printProps} />
      </div>
      <h1 className="text-3xl font-bold print:hidden">Official Receipt {or.or_number}</h1>
      <div className="rounded-lg border bg-card p-6 space-y-4 print:hidden">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium">OR Number:</span> {or.or_number}</div>
          <div><span className="font-medium">Date:</span> {new Date(or.or_date).toLocaleDateString()}</div>
          <div><span className="font-medium">Payor:</span> {or.payor_name || "—"}</div>
          <div><span className="font-medium">Amount:</span> {Number(or.amount).toFixed(2)}</div>
          <div><span className="font-medium">Status:</span> <span className="capitalize">{or.status || "active"}</span></div>
          <div><span className="font-medium">Payment Ref:</span> {or.payment_ref || "—"}</div>
          <div><span className="font-medium">Payment Method:</span> {or.payment_method || "—"}</div>
          <div><span className="font-medium">Payment Date:</span> {or.payment_date ? new Date(or.payment_date).toLocaleDateString() : "—"}</div>
        </div>
        {or.journal_entry_id && (
          <p className="text-sm text-muted-foreground">Journal Entry: {or.journal_entry_id}</p>
        )}
      </div>
    </div>
  )
}
