import { prisma } from "../src/lib/db"
import { studentAccountService } from "../src/services/student-account.service"

// Cancels (reverses) a posted student invoice through the billing engine so
// the GL stays consistent. Usage:
//   DATABASE_URL=... npx tsx scripts/cancel-invoice.ts <entitySchema> <invoiceNumber>
async function main() {
  const [schema, invoiceNumber] = process.argv.slice(2)
  if (!schema || !invoiceNumber) {
    console.error("Usage: tsx scripts/cancel-invoice.ts <entitySchema> <invoiceNumber>")
    process.exit(1)
  }

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${schema}".student_invoice WHERE invoice_number = $1`,
    invoiceNumber
  )
  if (!rows[0]) throw new Error(`Invoice ${invoiceNumber} not found in ${schema}`)

  const email = process.env.INTEGRATION_USER_EMAIL || "admin@school.edu"
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new Error(`User ${email} not found`)

  await studentAccountService.cancelInvoice(schema, user.id, rows[0].id)
  console.log(`Cancelled ${invoiceNumber} in ${schema} (reversal posted)`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
