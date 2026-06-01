import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { createEntitySchema } from "../src/lib/entity-schema"

const prisma = new PrismaClient()

const rolePermissions: Record<string, { resource: string; action: string }[]> = {
  super_admin: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "accounts", action: "delete" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "update" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "users", action: "create" },
    { resource: "users", action: "read" },
    { resource: "users", action: "update" },
    { resource: "users", action: "delete" },
    { resource: "entities", action: "create" },
    { resource: "entities", action: "read" },
    { resource: "entities", action: "update" },
    { resource: "entities", action: "delete" },
    { resource: "audit_log", action: "read" },
    { resource: "fiscal_periods", action: "create" },
    { resource: "fiscal_periods", action: "update" },
  ],
  accountant: [
    { resource: "accounts", action: "create" },
    { resource: "accounts", action: "read" },
    { resource: "accounts", action: "update" },
    { resource: "journal_entries", action: "create" },
    { resource: "journal_entries", action: "read" },
    { resource: "journal_entries", action: "post" },
    { resource: "journal_entries", action: "approve" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
  ],
  finance_officer: [
    { resource: "accounts", action: "read" },
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "create" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
  auditor: [
    { resource: "accounts", action: "read" },
    { resource: "journal_entries", action: "read" },
    { resource: "cash_receipts", action: "read" },
    { resource: "cash_disbursements", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "vendor_accounts", action: "read" },
    { resource: "reports", action: "read" },
    { resource: "reports", action: "export" },
    { resource: "audit_log", action: "read" },
  ],
  cashier: [
    { resource: "cash_receipts", action: "create" },
    { resource: "cash_receipts", action: "read" },
    { resource: "official_receipts", action: "create" },
    { resource: "official_receipts", action: "read" },
    { resource: "student_accounts", action: "read" },
    { resource: "reports", action: "read" },
  ],
}

async function main() {
  console.log("Seeding database...")

  // Create permissions
  const permissionMap = new Map<string, string>()
  for (const [_, perms] of Object.entries(rolePermissions)) {
    for (const perm of perms) {
      const key = `${perm.resource}:${perm.action}`
      if (!permissionMap.has(key)) {
        const created = await prisma.permission.upsert({
          where: {
            resource_action: {
              resource: perm.resource,
              action: perm.action,
            },
          },
          update: {},
          create: { resource: perm.resource, action: perm.action },
        })
        permissionMap.set(key, created.id)
      }
    }
  }

  // Create roles and assign permissions
  for (const [roleName, perms] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    })

    for (const perm of perms) {
      const permId = permissionMap.get(`${perm.resource}:${perm.action}`)
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        })
      }
    }
  }

  // Create default entities
  const mainEntity = await prisma.entity.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      code: "MAIN",
      name: "Main School",
      address: "123 Education St",
      fiscalYearStart: new Date("2026-01-01"),
      schemaName: "entity_main",
    },
  })

  // Create the entity's database schema and tables
  await createEntitySchema("entity_main")

  // Create super admin user (assign to the main entity)
  const superAdminRole = await prisma.role.findUnique({ where: { name: "super_admin" } })
  if (superAdminRole) {
    const passwordHash = await bcrypt.hash("admin123", 12)
    await prisma.user.upsert({
      where: { email: "admin@school.edu" },
      update: {},
      create: {
        email: "admin@school.edu",
        passwordHash,
        fullName: "System Administrator",
        roleId: superAdminRole.id,
        entityId: mainEntity.id,
        isActive: true,
      },
    })
  }

  console.log("Seed complete!")
  console.log("Default login: admin@school.edu / admin123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
