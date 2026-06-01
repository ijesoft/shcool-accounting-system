import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { eoptInvoiceService } from "@/services/eopt-invoice.service"
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

    const invoices = await eoptInvoiceService.list(schema)
    return NextResponse.json(formatApiResponse(invoices))
  } catch (error) {
    console.error("List EOPT invoices error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to list invoices"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "cash_receipts", "create")) {
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
    const result = await eoptInvoiceService.generateInvoice(schema, session.entityId, session.userId, {
      studentId: body.studentId,
      studentInvoiceId: body.studentInvoiceId,
      payorName: body.payorName,
      payorAddress: body.payorAddress,
      payorTin: body.payorTin,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate,
      lines: body.lines,
    })
    return NextResponse.json(formatApiResponse(result), { status: 201 })
  } catch (error: any) {
    console.error("Generate EOPT invoice error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", error.message || "Failed to generate invoice"), { status: 500 })
  }
}
