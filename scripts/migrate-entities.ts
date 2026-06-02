import { PrismaClient } from "@prisma/client"
import { migrateEntitySchema } from "../src/lib/entity-schema"

const prisma = new PrismaClient()

async function main() {
  const entities = await prisma.entity.findMany({
    select: { id: true, code: true, name: true, schemaName: true },
    orderBy: { code: "asc" },
  })

  if (entities.length === 0) {
    console.log("No entities found. Nothing to migrate.")
    return
  }

  console.log(`Migrating ${entities.length} entity schema(s)…\n`)

  let ok = 0
  let failed = 0
  for (const entity of entities) {
    process.stdout.write(`  [${entity.code}] ${entity.schemaName} … `)
    try {
      await migrateEntitySchema(entity.schemaName)
      console.log("OK")
      ok++
    } catch (err) {
      console.log("FAIL")
      console.error(err)
      failed++
    }
  }

  console.log(`\nDone. ${ok} migrated, ${failed} failed.`)
  if (failed > 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
