import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { reportService } from "@/services/report.service"
import { formatApiError } from "@/lib/utils"
import { hasPermission } from "@/lib/auth/rbac"
import { prisma } from "@/lib/db"
import { csvResponse } from "@/lib/export/csv"
import { xlsxResponse } from "@/lib/export/xlsx"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Not authenticated"), { status: 401 })
    if (!hasPermission(session.roleName, "reports", "read")) {
      return NextResponse.json(formatApiError("ERR_INSUFFICIENT_PERMISSIONS", "Access denied"), { status: 403 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const format = request.nextUrl.searchParams.get("format") || "csv"
    const reportType = request.nextUrl.searchParams.get("report")
    if (!reportType) {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "report query param required (trial-balance, income-statement, balance-sheet)"), { status: 400 })
    }

    const params: Record<string, string> = {}
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== "format" && key !== "report") params[key] = value
    })

    if (format === "csv") {
      const csv = await reportService.exportCsv(schema, reportType, params)
      return csvResponse(csv, `${reportType}-${new Date().toISOString().split("T")[0]}`)
    } else if (format === "xlsx") {
      const xml = await reportService.exportXlsx(schema, reportType, params)
      return xlsxResponse(xml, `${reportType}-${new Date().toISOString().split("T")[0]}`)
    } else {
      return NextResponse.json(formatApiError("ERR_VALIDATION", "Invalid format. Use csv or xlsx"), { status: 400 })
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to generate export"), { status: 500 })
  }
}
