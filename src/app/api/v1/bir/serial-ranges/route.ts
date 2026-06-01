import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { birSerialRangeService } from "@/services/bir-serial-range.service"
import { getEntitySchema } from "@/lib/api/entity"

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_ENTITY_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const ranges = await birSerialRangeService.list(schema)
    return NextResponse.json(formatApiResponse(ranges))
  } catch (error) {
    console.error("List BIR serial ranges error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list serial ranges"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "entities", "update")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }
    if (!session.entityId) {
      return NextResponse.json(formatApiError("ERR_NO_ENTITY", "No entity selected"), { status: 400 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) {
      return NextResponse.json(formatApiError("ERR_ENTITY_NOT_FOUND", "Entity not found"), { status: 404 })
    }

    const body = await request.json()
    const range = await birSerialRangeService.create(schema, {
      documentType: body.documentType,
      seriesPrefix: body.seriesPrefix,
      startNumber: body.startNumber,
      endNumber: body.endNumber,
      accreditedPrinterTin: body.accreditedPrinterTin,
      permitNumber: body.permitNumber,
      birSerialNumber: body.birSerialNumber,
    })
    return NextResponse.json(formatApiResponse(range), { status: 201 })
  } catch (error: any) {
    console.error("Create BIR serial range error:", error)
    if (error.code === "23505") {
      return NextResponse.json(formatApiError("ERR_DUPLICATE", "Serial range already exists for this document type and prefix"), { status: 409 })
    }
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to create serial range"), { status: 500 })
  }
}
