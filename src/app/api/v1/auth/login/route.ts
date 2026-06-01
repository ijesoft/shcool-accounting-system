import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth/session"
import { loginSchema } from "@/lib/validators/auth"
import { formatApiError } from "@/lib/utils"

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

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json(
        formatApiError("ERR_INVALID_CREDENTIALS", "Invalid email or password"),
        { status: 401 }
      )
    }

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
