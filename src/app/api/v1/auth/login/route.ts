import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth/session"
import { formatApiError } from "@/lib/utils"

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
})

interface AttemptRecord {
  count: number
  firstAttempt: number
  lockedUntil?: number
}

const loginAttempts = new Map<string, AttemptRecord>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

function getAttemptKey(email: string): string {
  return email.toLowerCase()
}

function checkRateLimit(email: string): { blocked: boolean; remaining?: number } {
  const key = getAttemptKey(email)
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record) return { blocked: false }

  if (record.lockedUntil && now < record.lockedUntil) {
    const remaining = Math.ceil((record.lockedUntil - now) / 60000)
    return { blocked: true, remaining }
  }

  if (record.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(key)
    return { blocked: false }
  }

  if (now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(key)
    return { blocked: false }
  }

  return { blocked: false }
}

function recordFailedAttempt(email: string): void {
  const key = getAttemptKey(email)
  const now = Date.now()
  const record = loginAttempts.get(key)

  if (!record || now - record.firstAttempt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
    return
  }

  const newCount = record.count + 1
  if (newCount >= MAX_ATTEMPTS) {
    loginAttempts.set(key, { count: newCount, firstAttempt: record.firstAttempt, lockedUntil: now + LOCKOUT_MS })
  } else {
    loginAttempts.set(key, { count: newCount, firstAttempt: record.firstAttempt })
  }
}

function clearAttempts(email: string): void {
  loginAttempts.delete(getAttemptKey(email))
}

async function writeAuditLog(
  userId: string,
  action: string,
  ipAddress: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO audit.audit_log (user_id, action, table_name, record_id, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT DO NOTHING`,
      userId, action, "user_account", userId, ipAddress
    )
  } catch {
    // Audit log table may not exist in all environments; swallow silently
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        formatApiError("ERR_VALIDATION", parsed.error.message),
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const rateCheck = checkRateLimit(email)
    if (rateCheck.blocked) {
      return NextResponse.json(
        formatApiError("ERR_RATE_LIMITED", `Too many login attempts. Try again in ${rateCheck.remaining ?? 15} minutes.`),
        { status: 429 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      recordFailedAttempt(email)
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      recordFailedAttempt(email)
      const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"
      await writeAuditLog(user.id, "LOGIN_FAILED", ipAddress)
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

    clearAttempts(email)

    const session = await getSession()
    session.userId = user.id
    session.email = user.email
    session.fullName = user.fullName
    session.roleId = user.roleId
    session.roleName = user.role.name
    session.entityId = user.entityId ?? undefined
    session.isActive = user.isActive
    await session.save()

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const ipAddress = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"
    await writeAuditLog(user.id, "LOGIN", ipAddress)

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role.name,
        entityId: user.entityId,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
