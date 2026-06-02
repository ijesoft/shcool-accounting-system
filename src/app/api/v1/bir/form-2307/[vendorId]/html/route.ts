import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/session"
import { form2307Service } from "@/lib/bir/form-2307"
import { prisma } from "@/lib/db"

async function getEntitySchema(entityId?: string): Promise<string | null> {
  if (!entityId) return null
  const entity = await prisma.entity.findUnique({ where: { id: entityId } })
  return entity?.schemaName ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params
    const session = await getSession()
    if (!session.userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const schema = await getEntitySchema(session.entityId)
    if (!schema || !session.entityId) {
      return new NextResponse("Entity not found", { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return new NextResponse("from and to query params are required", { status: 400 })
    }

    const data = await form2307Service.generateForPayee(
      schema,
      session.entityId,
      vendorId,
      from,
      to
    )
    const html = form2307Service.buildHtmlTemplate(data)

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (error) {
    console.error("Form 2307 HTML error:", error)
    return new NextResponse(
      error instanceof Error ? error.message : "Failed to generate Form 2307",
      { status: 500 }
    )
  }
}
