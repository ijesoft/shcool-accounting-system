import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError } from "@/lib/utils"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(
        formatApiError("ERR_UNAUTHORIZED", "Not authenticated"),
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: session.userId,
        email: session.email,
        fullName: session.fullName,
        roleName: session.roleName,
        entityId: session.entityId,
      },
    })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json(
      formatApiError("ERR_INTERNAL", "An unexpected error occurred"),
      { status: 500 }
    )
  }
}
