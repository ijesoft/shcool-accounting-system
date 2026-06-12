import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { verifySsoToken } from "@/lib/auth/service-auth"
import { prisma } from "@/lib/db"

// el-school admins arrive here with a short-lived HMAC token (60s TTL) minted
// by el-school's /admin/accounting page. Only privileged el-school roles are
// accepted; everyone maps to the shared integration account unless a matching
// accounting user exists for their email.
const ALLOWED_ROLES = ["Admin", "Superadmin", "Accountant"]

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const payload = token ? verifySsoToken(token) : null
  if (!payload || !ALLOWED_ROLES.includes(payload.role)) {
    return NextResponse.json({ success: false, error: { code: "ERR_UNAUTHORIZED", message: "Invalid SSO token" } }, { status: 401 })
  }

  let user = await prisma.user.findUnique({ where: { email: payload.email }, include: { role: true } })
  if (!user || !user.isActive) {
    const fallbackEmail = process.env.INTEGRATION_USER_EMAIL || "admin@school.edu"
    user = await prisma.user.findUnique({ where: { email: fallbackEmail }, include: { role: true } })
  }
  if (!user || !user.isActive) {
    return NextResponse.json({ success: false, error: { code: "ERR_NOT_FOUND", message: "No accounting user available for SSO" } }, { status: 404 })
  }

  let entityId = user.entityId
  if (!entityId) {
    const entity = await prisma.entity.findFirst({ orderBy: { createdAt: "asc" } })
    entityId = entity?.id ?? null
  }

  const session = await getSession()
  session.userId = user.id
  session.email = user.email
  session.fullName = user.fullName
  session.roleId = user.roleId
  session.roleName = user.role.name
  session.entityId = entityId ?? undefined
  session.isActive = true
  await session.save()

  return NextResponse.redirect(new URL("/", request.url))
}
