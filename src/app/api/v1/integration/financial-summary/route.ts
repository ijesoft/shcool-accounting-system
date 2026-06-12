import { NextRequest, NextResponse } from "next/server"
import { formatApiError, formatApiResponse } from "@/lib/utils"
import { verifyServiceKey, resolveServiceSchema } from "@/lib/auth/service-auth"
import { prisma } from "@/lib/db"

// Lightweight financial snapshot for the el-school admin dashboard card.
export async function GET(request: NextRequest) {
  try {
    if (!verifyServiceKey(request)) {
      return NextResponse.json(formatApiError("ERR_UNAUTHORIZED", "Invalid service key"), { status: 401 })
    }
    const schema = await resolveServiceSchema(request)
    if (!schema) return NextResponse.json(formatApiError("ERR_NOT_FOUND", "Entity not found"), { status: 404 })

    const [cashRows, collectionRows, arRows, orRows] = await Promise.all([
      prisma.$queryRawUnsafe<{ cash: number }[]>(
        `SELECT COALESCE(SUM(bal), 0)::float AS cash FROM (
           SELECT DISTINCT ON (gl.account_id)
             gl.beginning_balance + COALESCE(gl.total_debits, 0) - COALESCE(gl.total_credits, 0) AS bal
           FROM "${schema}".general_ledger gl
           JOIN "${schema}".account a ON a.id = gl.account_id
           WHERE a.account_code IN ('11110', '11120')
           ORDER BY gl.account_id, gl.updated_at DESC
         ) t`
      ),
      prisma.$queryRawUnsafe<{ today: number; month: number }[]>(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE payment_date = CURRENT_DATE), 0)::float AS today,
           COALESCE(SUM(amount) FILTER (WHERE date_trunc('month', payment_date) = date_trunc('month', CURRENT_DATE)), 0)::float AS month
         FROM "${schema}".payment_transaction`
      ),
      prisma.$queryRawUnsafe<{ ar: number }[]>(
        `SELECT COALESCE(SUM(balance), 0)::float AS ar
         FROM "${schema}".student_invoice WHERE status != 'paid'`
      ),
      prisma.$queryRawUnsafe<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM "${schema}".official_receipt WHERE or_date = CURRENT_DATE`
      ),
    ])

    return NextResponse.json(formatApiResponse({
      cashPosition: cashRows[0]?.cash ?? 0,
      collectionsToday: collectionRows[0]?.today ?? 0,
      collectionsThisMonth: collectionRows[0]?.month ?? 0,
      arOutstanding: arRows[0]?.ar ?? 0,
      orsIssuedToday: orRows[0]?.count ?? 0,
    }))
  } catch (error) {
    console.error("Integration financial-summary error:", error)
    return NextResponse.json(formatApiError("ERR_INTERNAL", "Failed to build summary"), { status: 500 })
  }
}
