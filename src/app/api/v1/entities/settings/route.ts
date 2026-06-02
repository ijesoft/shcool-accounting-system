import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { getEntitySettings, updateEntitySettings } from "@/lib/entity-settings"

export async function GET() {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "No entity selected"), { status: 400 })
    }
    const settings = await getEntitySettings(session.entityId)
    return NextResponse.json(formatApiResponse(settings))
  } catch (error) {
    console.error("Get entity settings error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to get settings"), { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NOT_FOUND", "No entity selected"), { status: 400 })
    }
    const body = await request.json()
    const updated = await updateEntitySettings(session.entityId, body)
    return NextResponse.json(formatApiResponse(updated))
  } catch (error) {
    console.error("Update entity settings error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to update settings"), { status: 500 })
  }
}
