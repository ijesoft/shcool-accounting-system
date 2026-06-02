import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { vi } from "vitest"
import type { SessionData } from "@/lib/auth/session"

export const prisma = new PrismaClient()

export interface TestUser {
  id: string
  email: string
  roleName: string
  entityId: string | null
}

export const TEST_ROLES = ["super_admin", "accountant", "finance_officer", "auditor", "cashier"] as const

export type TestRole = (typeof TEST_ROLES)[number]

const roleEmailMap: Record<TestRole, string> = {
  super_admin: "test_admin@school.edu",
  accountant: "test_accountant@school.edu",
  finance_officer: "test_finance@school.edu",
  auditor: "test_auditor@school.edu",
  cashier: "test_cashier@school.edu",
}

let testUsers: Record<TestRole, TestUser> | null = null
let mainEntityId: string | null = null

export async function getMainEntityId(): Promise<string> {
  if (mainEntityId) return mainEntityId
  const entity = await prisma.entity.findFirst({ where: { code: "MAIN" } })
  if (!entity) throw new Error("Main entity not found. Run seed first.")
  mainEntityId = entity.id
  return mainEntityId
}

export async function setupTestUsers(): Promise<Record<TestRole, TestUser>> {
  if (testUsers) return testUsers

  const entityId = await getMainEntityId()
  testUsers = {} as Record<TestRole, TestUser>

  for (const role of TEST_ROLES) {
    const roleRecord = await prisma.role.findUnique({ where: { name: role } })
    if (!roleRecord) throw new Error(`Role ${role} not found`)

    const email = roleEmailMap[role]
    const existing = await prisma.user.findUnique({ where: { email } })

    const passwordHash = await bcrypt.hash("test123", 12)
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        fullName: `Test ${role}`,
        roleId: roleRecord.id,
        entityId,
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        fullName: `Test ${role}`,
        roleId: roleRecord.id,
        entityId,
        isActive: true,
      },
    })
    testUsers[role] = {
      id: user.id,
      email,
      roleName: role,
      entityId: user.entityId,
    }
  }

  return testUsers
}

export function createMockSession(roleName: TestRole, userId?: string, entityId?: string): SessionData {
  const users = testUsers
  if (!users) throw new Error("Test users not set up. Call setupTestUsers() first.")

  const user = users[roleName]
  return {
    userId: userId ?? user.id,
    email: user.email,
    fullName: `Test ${roleName}`,
    roleId: "",
    roleName,
    entityId: entityId ?? user.entityId ?? undefined,
    isActive: true,
  }
}

export async function cleanupTestUsers(): Promise<void> {
  if (!testUsers) return
  for (const role of TEST_ROLES) {
    const email = roleEmailMap[role]
    await prisma.user.deleteMany({ where: { email } })
  }
  testUsers = null
  mainEntityId = null
}

export function mockSession(session: SessionData) {
  vi.doMock("@/lib/auth/session", () => ({
    getSession: async () => ({
      ...session,
      save: async () => {},
      destroy: () => {},
    }),
    destroySession: async () => {},
  }))
}

export async function createTestFiscalYear(entityId: string) {
  const label = `FY26-${Date.now().toString().slice(-6)}`
  return prisma.fiscalYear.create({
    data: {
      entityId,
      label,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      isClosed: false,
    },
  })
}

import type { NextRequest } from "next/server"

export function createMockNextRequest(
  url: string,
  init?: RequestInit & { searchParams?: Record<string, string> },
): NextRequest {
  const urlObj = new URL(url.startsWith("http") ? url : `http://localhost${url}`)

  if (init?.searchParams) {
    Object.entries(init.searchParams).forEach(([k, v]) => urlObj.searchParams.set(k, v))
  }

  const req = new Request(urlObj, init)
  const mockReq = req as any
  mockReq.nextUrl = urlObj
  mockReq.cookies = { get: () => null }
  mockReq.geo = null
  mockReq.ip = "127.0.0.1"
  return mockReq as NextRequest
}

export async function createTestFiscalPeriod(fiscalYearId: string, periodNumber: number) {
  return prisma.fiscalPeriod.create({
    data: {
      fiscalYearId,
      periodNumber,
      startDate: new Date(`2026-${String(periodNumber).padStart(2, "0")}-01`),
      endDate: new Date(`2026-${String(periodNumber).padStart(2, "0")}-28`),
      isClosed: false,
    },
  })
}
