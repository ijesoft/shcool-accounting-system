import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { hasPermission } from "@/lib/auth/rbac"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { withholdingTaxRegisterService } from "@/services/withholding-tax-register.service"
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

    const { searchParams } = new URL(request.url)
    const ewtType = searchParams.get("ewtType") as "expanded" | "creditable" | "final" | undefined
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const payeeTin = searchParams.get("payeeTin")
    const summary = searchParams.get("summary")
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const quarter = searchParams.get("quarter")

    if (summary === "monthly" && year && month) {
      const data = await withholdingTaxRegisterService.getMonthlySummary(schema, Number(year), Number(month))
      return NextResponse.json(formatApiResponse(data))
    }

    if (summary === "quarterly" && year && quarter) {
      const data = await withholdingTaxRegisterService.getQuarterlySummary(schema, Number(year), Number(quarter))
      return NextResponse.json(formatApiResponse(data))
    }

    const filters: {
      ewtType?: "expanded" | "creditable" | "final"
      startDate?: string
      endDate?: string
      payeeTin?: string
    } = {}
    if (ewtType) filters.ewtType = ewtType
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate
    if (payeeTin) filters.payeeTin = payeeTin

    const data = await withholdingTaxRegisterService.list(schema, Object.keys(filters).length > 0 ? filters : undefined)
    return NextResponse.json(formatApiResponse(data))
  } catch (error) {
    console.error("Withholding register error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to fetch withholding register"), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    }
    if (!hasPermission(session.roleName, "reports", "read")) {
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
    const data = await withholdingTaxRegisterService.exportByPeriod(
      schema,
      body.startDate,
      body.endDate
    )
    return NextResponse.json(formatApiResponse(data))
  } catch (error) {
    console.error("Withholding register export error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to export withholding register"), { status: 500 })
  }
}
